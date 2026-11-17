#!/usr/bin/env bash
# =============================================================
#  IMaN - menghentikan aplikasi.
#
#  Pemakaian:
#    ./stop.sh               # hentikan container, data PostgreSQL tetap aman di volume
#    ./stop.sh --hapus-data  # hentikan DAN hapus volume database (minta konfirmasi)
# =============================================================
set -euo pipefail

cd "$(dirname "$0")"

HAPUS_DATA=""
for arg in "$@"; do
  case "$arg" in
    --hapus-data) HAPUS_DATA=1 ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Opsi tidak dikenal: $arg" >&2; exit 1 ;;
  esac
done

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "[IMaN] Docker Compose tidak ditemukan." >&2; exit 1
fi

if [ -n "$HAPUS_DATA" ]; then
  echo "[IMaN] PERINGATAN: seluruh data database (rekap, project, interviewer) akan DIHAPUS PERMANEN."
  echo "[IMaN] Pastikan sudah backup (lihat README: Backup & Restore)."
  read -r -p "Ketik 'HAPUS' untuk melanjutkan: " jawab
  if [ "$jawab" != "HAPUS" ]; then
    echo "[IMaN] Dibatalkan. Tidak ada yang dihapus."
    exit 0
  fi
  "${COMPOSE[@]}" down -v
  echo "[IMaN] Aplikasi dihentikan dan volume database dihapus."
else
  "${COMPOSE[@]}" down
  echo "[IMaN] Aplikasi dihentikan. Data tetap tersimpan di volume Docker."
  echo "[IMaN] Jalankan kembali dengan ./start.sh"
fi
