#!/bin/sh
# Entrypoint container IMaN:
#   1. prisma migrate deploy (dengan retry, menunggu database siap)
#   2. seed interviewer awal (idempoten: hanya jika tabel kosong)
#   3. jalankan server Next.js standalone
set -eu

# Docker/Railway bisa mengisi HOSTNAME dengan nama container; paksa bind ke semua interface.
export HOSTNAME="${BIND_HOST:-0.0.0.0}"
export PORT="${PORT:-1526}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[IMaN] ERROR: DATABASE_URL belum diatur." >&2
  exit 1
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "[IMaN] PERINGATAN: ADMIN_PASSWORD kosong, password default 'admin' dipakai. Segera ganti!" >&2
fi
if [ -z "${SESSION_SECRET:-}" ]; then
  echo "[IMaN] PERINGATAN: SESSION_SECRET kosong. Atur string acak minimal 32 karakter." >&2
fi

PRISMA="node /opt/prisma-cli/node_modules/prisma/build/index.js"
MAX_TRIES="${MIGRATE_MAX_TRIES:-30}"
i=1
echo "[IMaN] Menjalankan migrasi database..."
until $PRISMA migrate deploy --schema=prisma/schema.prisma; do
  if [ "$i" -ge "$MAX_TRIES" ]; then
    echo "[IMaN] ERROR: migrasi gagal setelah $MAX_TRIES percobaan." >&2
    exit 1
  fi
  echo "[IMaN] Database belum siap, mencoba lagi dalam 3 detik ($i/$MAX_TRIES)..."
  i=$((i + 1))
  sleep 3
done

if [ "${SKIP_SEED:-false}" != "true" ]; then
  echo "[IMaN] Menjalankan seed..."
  node prisma/seed.mjs
fi

echo "[IMaN] Server berjalan di http://${HOSTNAME}:${PORT}"
exec "$@"
