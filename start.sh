#!/usr/bin/env bash
# =============================================================
#  IMaN - Interviewer Monitoring at Nutrifood
#  Menjalankan aplikasi (dan PostgreSQL) dengan Docker Compose.
#
#  Pemakaian:
#    ./start.sh                 # app + PostgreSQL bawaan (volume persisten);
#                               # password admin ditanyakan saat start (ENTER = tetap)
#    IMAN_ADMIN_PASSWORD=xxx ./start.sh   # set password tanpa prompt
#    ./start.sh --external-db   # hanya app, memakai DATABASE_URL di .env
#    ./start.sh --no-build      # lewati build ulang image
#    ./start.sh --help
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

MODE="auto"
BUILD_FLAG="--build"

usage() {
  sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
}

for arg in "$@"; do
  case "$arg" in
    --external-db) MODE="external" ;;
    --internal-db) MODE="internal" ;;
    --no-build)    BUILD_FLAG="" ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "Opsi tidak dikenal: $arg" >&2; usage; exit 1 ;;
  esac
done

info()  { printf '\033[1;34m[IMaN]\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m[IMaN]\033[0m %s\n' "$*" >&2; }
fail()  { printf '\033[1;31m[IMaN]\033[0m %s\n' "$*" >&2; exit 1; }

# ---------- 1. Cek Docker & Compose ----------
command -v docker >/dev/null 2>&1 || fail "Docker belum terpasang. Pasang Docker Desktop / Docker Engine terlebih dahulu."
if ! docker info >/dev/null 2>&1; then
  # macOS: coba nyalakan Docker Desktop otomatis lalu tunggu daemon siap.
  if [ "$(uname -s)" = "Darwin" ] && open -a Docker >/dev/null 2>&1; then
    info "Docker belum berjalan, menyalakan Docker Desktop ..."
    for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  fi
  docker info >/dev/null 2>&1 || fail "Docker daemon tidak berjalan. Jalankan Docker terlebih dahulu (Linux: sudo systemctl start docker)."
fi
command -v curl >/dev/null 2>&1 || fail "curl belum terpasang (dibutuhkan untuk cek kesiapan aplikasi)."
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  fail "Docker Compose tidak ditemukan (butuh 'docker compose' v2)."
fi

# ---------- 2. Siapkan .env ----------
rand() { (LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$1") 2>/dev/null || true; }

set_env() { # set_env KEY VALUE  -> ganti/tambah baris KEY="VALUE" di .env
  local key="$1" val="$2" tmp
  tmp="$(mktemp)"
  if grep -q "^${key}=" .env; then
    awk -v k="$key" -v v="$val" 'index($0, k"=")==1 {print k"=\""v"\""; next} {print}' .env >"$tmp"
  else
    cp .env "$tmp"; printf '%s="%s"\n' "$key" "$val" >>"$tmp"
  fi
  cat "$tmp" >.env; rm -f "$tmp"
}

get_env() { # get_env KEY -> nilai dari .env (tanpa tanda kutip), kosong jika tidak ada
  local line
  line="$(grep -E "^$1=" .env 2>/dev/null | tail -n 1 || true)"
  line="${line#*=}"; line="${line%\"}"; line="${line#\"}"; line="${line%\'}"; line="${line#\'}"
  printf '%s' "$line"
}

if [ ! -f .env ]; then
  [ -f .env.example ] || fail ".env.example tidak ditemukan."
  info "Membuat .env dari .env.example ..."
  cp .env.example .env
  set_env ADMIN_PASSWORD ""
  set_env SESSION_SECRET "$(rand 48)"
  set_env POSTGRES_PASSWORD "$(rand 24)"
  chmod 600 .env || true
fi

# ---------- 2b. Password Admin Field (ditanyakan setiap start) ----------
valid_pw() { # minimal 6 karakter, tanpa spasi/kutip/$/\/backtick (aman untuk .env & Compose)
  [ "${#1}" -ge 6 ] && [[ ! "$1" =~ [[:space:]\"\'\$\\\`] ]]
}

ADMIN_PW="$(get_env ADMIN_PASSWORD)"
[ "$ADMIN_PW" = "ganti-password-ini" ] && ADMIN_PW=""

if [ -n "${IMAN_ADMIN_PASSWORD:-}" ]; then
  # Non-interaktif (mis. otomatisasi): IMAN_ADMIN_PASSWORD=... bash start.sh
  valid_pw "$IMAN_ADMIN_PASSWORD" || fail "IMAN_ADMIN_PASSWORD tidak valid (min. 6 karakter, tanpa spasi/kutip/\$/\\/backtick)."
  ADMIN_PW="$IMAN_ADMIN_PASSWORD"; set_env ADMIN_PASSWORD "$ADMIN_PW"
  info "Password admin diatur dari IMAN_ADMIN_PASSWORD."
elif [ -t 0 ]; then
  echo
  echo "  ============================================================"
  echo "   Password Admin Field (untuk login ke ${APP_URL_HINT:-/admin})"
  echo "   - Minimal 6 karakter, tanpa spasi, kutip, \$, \\ atau backtick."
  if [ -n "$ADMIN_PW" ]; then
    echo "   - Tekan ENTER untuk tetap memakai password yang sekarang."
  else
    echo "   - Tekan ENTER untuk membuat password acak otomatis."
  fi
  echo "  ============================================================"
  while true; do
    read -r -s -p "  Password admin: " PW1; echo
    if [ -z "$PW1" ]; then
      if [ -n "$ADMIN_PW" ]; then
        info "Memakai password admin yang sudah ada."
      else
        ADMIN_PW="$(rand 12)"; set_env ADMIN_PASSWORD "$ADMIN_PW"
        echo "  Password acak dibuat (catat!):  ${ADMIN_PW}"
      fi
      break
    fi
    if ! valid_pw "$PW1"; then
      warn "Password tidak valid (min. 6 karakter, tanpa spasi/kutip/\$/\\/backtick). Coba lagi."
      continue
    fi
    read -r -s -p "  Ulangi password: " PW2; echo
    if [ "$PW1" != "$PW2" ]; then
      warn "Password tidak sama. Coba lagi."
      continue
    fi
    ADMIN_PW="$PW1"; set_env ADMIN_PASSWORD "$ADMIN_PW"
    info "Password admin disimpan di .env."
    break
  done
  unset PW1 PW2
  echo
elif [ -z "$ADMIN_PW" ]; then
  # Tidak ada terminal interaktif dan belum ada password -> buat acak.
  ADMIN_PW="$(rand 12)"; set_env ADMIN_PASSWORD "$ADMIN_PW"
  echo "  Password admin dibuat otomatis (catat!):  ${ADMIN_PW}"
fi

[ "$ADMIN_PW" = "admin" ] && warn "ADMIN_PASSWORD terlalu lemah ('admin'). Sebaiknya ganti."

SS="$(get_env SESSION_SECRET)"
if [ -z "$SS" ] || [ "$SS" = "ganti-dengan-string-acak-minimal-32-karakter" ]; then
  set_env SESSION_SECRET "$(rand 48)"
  info "SESSION_SECRET dibuat otomatis di .env."
fi

if [ -z "$(get_env POSTGRES_PASSWORD)" ]; then
  # Jika volume database sudah pernah dibuat, password lamanya adalah default compose
  # ('iman_password'); jangan diganti agar app tetap bisa masuk ke database lama.
  PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}"
  if docker volume inspect "${PROJECT}_pgdata" >/dev/null 2>&1; then
    set_env POSTGRES_PASSWORD "iman_password"
  else
    set_env POSTGRES_PASSWORD "$(rand 24)"
  fi
  info "POSTGRES_PASSWORD ditambahkan ke .env."
fi

# ---------- 3. Tentukan mode database ----------
DB_URL="$(get_env DATABASE_URL)"
is_local_url() { [[ "$1" =~ @(localhost|127\.0\.0\.1|db)(:|/) ]]; }

if [ "$MODE" = "auto" ]; then
  if [ -n "$DB_URL" ] && ! is_local_url "$DB_URL"; then
    MODE="external"
    info "DATABASE_URL eksternal terdeteksi di .env -> memakai database eksternal."
  else
    MODE="internal"
  fi
fi

APP_PORT="${APP_PORT:-$(get_env APP_PORT)}"; APP_PORT="${APP_PORT:-1526}"
export APP_PORT

# Port sudah dipakai program lain (bukan container IMaN ini)?
if ! "${COMPOSE[@]}" ps --status running app 2>/dev/null | grep -q app; then
  if (command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$APP_PORT" -sTCP:LISTEN >/dev/null 2>&1) \
     || curl -s -o /dev/null --max-time 2 "http://localhost:${APP_PORT}" 2>/dev/null; then
    fail "Port ${APP_PORT} sudah dipakai program lain. Hentikan program itu, atau jalankan: APP_PORT=1527 bash start.sh"
  fi
fi

if [ "$MODE" = "external" ]; then
  [ -n "$DB_URL" ] || fail "--external-db butuh DATABASE_URL di .env."
  if is_local_url "$DB_URL"; then
    warn "DATABASE_URL menunjuk ke localhost. Dari dalam container, gunakan host.docker.internal untuk PostgreSQL di komputer ini."
  fi
  info "Menjalankan aplikasi (database eksternal) ..."
  "${COMPOSE[@]}" up -d $BUILD_FLAG --no-deps app
else
  # Abaikan DATABASE_URL di .env (biasanya untuk development lokal) agar app memakai service `db`.
  export DATABASE_URL=""
  info "Menjalankan aplikasi + PostgreSQL ..."
  "${COMPOSE[@]}" up -d $BUILD_FLAG
fi

# ---------- 4. Tunggu health check ----------
URL="http://localhost:${APP_PORT}"
info "Menunggu aplikasi siap di ${URL}/api/health ..."
ok=""
for _ in $(seq 1 90); do
  if curl -fsS "${URL}/api/health" 2>/dev/null | grep -q '"ok"'; then ok=1; break; fi
  sleep 2
done

if [ -z "$ok" ]; then
  warn "Aplikasi belum merespons setelah 3 menit. Log terakhir:"
  "${COMPOSE[@]}" logs --tail 40 app db >&2 || true
  warn "Lihat log lengkap: ${COMPOSE[*]} logs -f app"
  exit 1
fi

echo
echo "  ============================================================"
echo "   IMaN berjalan!"
echo "   Form Interviewer : ${URL}"
echo "   Dashboard Admin  : ${URL}/admin"
echo "   Health check     : ${URL}/api/health"
echo
echo "   Lihat log  : ${COMPOSE[*]} logs -f app"
echo "   Hentikan   : ./stop.sh"
echo "  ============================================================"
