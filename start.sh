#!/usr/bin/env bash
# =============================================================
#  IMaN - Interviewer Monitoring at Nutrifood
#  Menjalankan aplikasi (dan PostgreSQL) dengan Docker Compose.
#
#  Pemakaian:
#    ./start.sh                 # app + PostgreSQL bawaan (volume persisten)
#    ./start.sh --external-db   # hanya app, memakai DATABASE_URL di .env
#    ./start.sh --no-build      # lewati build ulang image
#    ./start.sh --help
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

MODE="auto"
BUILD_FLAG="--build"

usage() {
  sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
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
docker info >/dev/null 2>&1 || fail "Docker daemon tidak berjalan. Jalankan Docker terlebih dahulu."
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
  NEW_ADMIN_PASSWORD="$(rand 12)"
  set_env ADMIN_PASSWORD "$NEW_ADMIN_PASSWORD"
  set_env SESSION_SECRET "$(rand 48)"
  set_env POSTGRES_PASSWORD "$(rand 24)"
  chmod 600 .env || true
  echo
  echo "  ============================================================"
  echo "   Password Admin Field (catat & simpan, hanya ditampilkan sekali):"
  echo "      ${NEW_ADMIN_PASSWORD}"
  echo "   (bisa diganti kapan saja di file .env -> ADMIN_PASSWORD)"
  echo "  ============================================================"
  echo
fi

ADMIN_PW="$(get_env ADMIN_PASSWORD)"
if [ -z "$ADMIN_PW" ] || [ "$ADMIN_PW" = "ganti-password-ini" ] || [ "$ADMIN_PW" = "admin" ]; then
  warn "ADMIN_PASSWORD di .env masih default/kosong. Sebaiknya ganti sebelum dipakai tim."
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
  warn "Aplikasi belum merespons setelah 3 menit. Cek log dengan:"
  warn "  ${COMPOSE[*]} logs -f app"
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
