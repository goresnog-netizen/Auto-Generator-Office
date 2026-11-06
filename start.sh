#!/usr/bin/env bash
#
# Satu perintah untuk menjalankan Auto Generator Office di Linux/macOS.
# Node.js TIDAK perlu dipasang dulu — bootstrap mengunduhnya bila perlu.
#
#   ./start.sh            jalankan server pengembangan
#   ./start.sh install    pasang dependensi + build produksi

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-dev}"

. "$AKAR/scripts/bootstrap-node.sh" "$AKAR"

echo ""
echo "== Auto Generator Office =="
echo "   Node $(node -v) | npm $(npm -v)"

cd "$AKAR"

if [ ! -d "$AKAR/node_modules" ]; then
  echo "[1/2] Memasang dependensi (npm bawaan Node) ..."
  npm install --no-audit --no-fund --legacy-peer-deps
else
  echo "[1/2] Dependensi sudah ada, dilewati."
fi

if [ "$MODE" = "install" ]; then
  echo "[2/2] Build produksi ..."
  npm run build
  echo ""
  echo "Selesai. Jalankan aplikasi dengan: ./start.sh"
else
  echo "[2/2] Menjalankan server: http://localhost:5173"
  echo "      Tekan Ctrl+C untuk berhenti."
  npm run dev
fi
