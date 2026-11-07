#!/usr/bin/env bash
#
# Unduh binary DeckCraft resmi untuk Linux/macOS.
#
# Padanan dari scripts/vendor-deckcraft.ps1 (Windows). Hasilnya diletakkan di
# jalur yang sama seperti yang dicari `defaultBinPath()` di src/lib/deckcraft.ts:
#
#   Linux   vendors/deckcraft-bin/app/deckcraft-<versi>-linux-x86_64/bin/deckcraft-cli
#   macOS   vendors/deckcraft-bin/app/deckcraft-cli-<versi>-macos-universal/deckcraft-cli
#
# Pemakaian:
#   ./scripts/vendor-deckcraft.sh              # versi bawaan
#   ./scripts/vendor-deckcraft.sh 0.8.0        # versi tertentu
#   DECKCRAFT_VERSION=0.8.0 ./scripts/vendor-deckcraft.sh
#
# Setelah selesai, jalankan `pnpm dev` atau `npm run serve`; panel
# "DeckCraft Studio" akan aktif tanpa perlu mengeset DECKCRAFT_CLI manual.

set -euo pipefail

VERSI="${1:-${DECKCRAFT_VERSION:-0.8.0}}"
REPO="storytold/deckcraft"

# Akar proyek = folder induk dari folder skrip ini.
AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$AKAR/vendors/deckcraft-bin"
APP_DIR="$BIN_DIR/app"

# --- Deteksi platform -------------------------------------------------------
SISTEM="$(uname -s)"
MESIN="$(uname -m)"

case "$SISTEM" in
  Linux)  OS="linux"  ;;
  Darwin) OS="macos"  ;;
  *)
    echo "Sistem '$SISTEM' belum didukung skrip ini." >&2
    echo "Di Windows pakai: powershell -ExecutionPolicy Bypass -File scripts/vendor-deckcraft.ps1" >&2
    exit 1
    ;;
esac

if [ "$OS" = "linux" ]; then
  case "$MESIN" in
    x86_64|amd64)  ARSIP="deckcraft-${VERSI}-linux-x86_64.tar.gz"  ; EKSTRAK="tar" ;;
    aarch64|arm64) ARSIP="deckcraft-${VERSI}-linux-aarch64.tar.gz" ; EKSTRAK="tar" ;;
    *)
      echo "Arsitektur Linux '$MESIN' tidak punya arsip resmi." >&2
      echo "Coba jalankan lewat Docker: docker compose up --build" >&2
      exit 1
      ;;
  esac
else
  # macOS: satu arsip universal untuk Intel maupun Apple Silicon.
  ARSIP="deckcraft-cli-${VERSI}-macos-universal.zip"
  EKSTRAK="zip"
fi

URL="https://github.com/${REPO}/releases/download/v${VERSI}/${ARSIP}"
MANIFEST="https://github.com/${REPO}/releases/download/v${VERSI}/SHA256SUMS.txt"
TUJUAN="$BIN_DIR/$ARSIP"

echo "== Vendoring DeckCraft v${VERSI} =="
echo "  Platform : $OS / $MESIN"
echo "  Arsip    : $ARSIP"
echo "  Tujuan   : $APP_DIR"

mkdir -p "$BIN_DIR" "$APP_DIR"

# --- Unduh ------------------------------------------------------------------
if [ -f "$TUJUAN" ]; then
  echo "  Arsip sudah ada, melewati unduhan."
else
  echo "  Mengunduh: $URL"
  # Progress bar hanya kalau terminal interaktif; di CI/log ia jadi ribuan
  # baris sampah.
  if [ -t 2 ]; then
    curl -fSL --retry 3 --retry-delay 2 --progress-bar "$URL" -o "$TUJUAN"
  else
    curl -fsSL --retry 3 --retry-delay 2 "$URL" -o "$TUJUAN"
  fi
fi

# --- Verifikasi checksum ----------------------------------------------------
# Diambil dari SHA256SUMS.txt rilis yang sama, bukan dari nilai yang
# ditanam di skrip, supaya tetap benar bila versi diganti.
echo "  Memverifikasi checksum SHA-256..."
HARAPAN="$(curl -fsSL --retry 3 "$MANIFEST" | awk -v a="$ARSIP" '$2 == a { print $1 }' | head -1)"

if [ -z "$HARAPAN" ]; then
  echo "  PERINGATAN: '$ARSIP' tidak ada di SHA256SUMS.txt." >&2
  echo "  Unduhan dibatalkan demi keamanan." >&2
  rm -f "$TUJUAN"
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  AKTUAL="$(sha256sum "$TUJUAN" | awk '{ print $1 }')"
else
  AKTUAL="$(shasum -a 256 "$TUJUAN" | awk '{ print $1 }')"
fi

if [ "$AKTUAL" != "$HARAPAN" ]; then
  echo "  Checksum TIDAK cocok." >&2
  echo "    diharapkan : $HARAPAN" >&2
  echo "    ditemukan  : $AKTUAL" >&2
  echo "  Arsip dibuang; jalankan ulang skrip." >&2
  rm -f "$TUJUAN"
  exit 1
fi
echo "  Checksum OK: $AKTUAL"

# --- Ekstrak ----------------------------------------------------------------
# Ekstrak ke APP_DIR agar strukturnya persis seperti yang dicari
# defaultBinPath(): <app>/<nama-folder-arsip>/...
if [ "$EKSTRAK" = "tar" ]; then
  if [ -d "$APP_DIR/deckcraft-${VERSI}-linux-${MESIN}" ] || \
     [ -d "$APP_DIR/deckcraft-${VERSI}-linux-x86_64" ] || \
     [ -d "$APP_DIR/deckcraft-${VERSI}-linux-aarch64" ]; then
    echo "  Sudah terekstrak, melewati ekstraksi."
  else
    echo "  Mengekstrak..."
    tar -xzf "$TUJUAN" -C "$APP_DIR"
  fi
else
  if [ -d "$APP_DIR/deckcraft-cli-${VERSI}-macos-universal" ]; then
    echo "  Sudah terekstrak, melewati ekstraksi."
  else
    echo "  Mengekstrak..."
    unzip -q -o "$TUJUAN" -d "$APP_DIR"
  fi
fi

# --- Tentukan jalur binary --------------------------------------------------
if [ "$OS" = "linux" ]; then
  if [ -f "$APP_DIR/deckcraft-${VERSI}-linux-x86_64/bin/deckcraft-cli" ]; then
    CLI="$APP_DIR/deckcraft-${VERSI}-linux-x86_64/bin/deckcraft-cli"
  else
    CLI="$APP_DIR/deckcraft-${VERSI}-linux-aarch64/bin/deckcraft-cli"
  fi
else
  CLI="$APP_DIR/deckcraft-cli-${VERSI}-macos-universal/deckcraft-cli"
fi

if [ ! -f "$CLI" ]; then
  echo "  GAGAL: binary tidak ditemukan di $CLI" >&2
  echo "  Isi $APP_DIR:" >&2
  ls -la "$APP_DIR" >&2
  exit 1
fi

chmod +x "$CLI"

# macOS: binary belum ditandatangani; karantina Gatekeeper bisa memblokirnya.
if [ "$OS" = "macos" ] && command -v xattr >/dev/null 2>&1; then
  xattr -d com.apple.quarantine "$CLI" 2>/dev/null || true
fi

# --- Uji jalankan -----------------------------------------------------------
# Penting: kode keluar diperiksa, bukan hanya "ada output". Tanpa ini,
# kegagalan exec (mis. binary glibc dijalankan di sistem musl, atau arsip
# platform lain) hanya menghasilkan teks galat yang tetap dianggap sukses.
echo "  Menguji binary..."
set +e
LAPORAN="$("$CLI" --version 2>&1)"
KODE=$?
set -e

if [ "$KODE" -ne 0 ] || [ -z "$LAPORAN" ]; then
  echo "  GAGAL: '$CLI --version' keluar dengan kode $KODE." >&2
  echo "  Keluaran: ${LAPORAN:-(kosong)}" >&2
  echo "" >&2
  echo "  Kemungkinan penyebab:" >&2
  echo "   - arsitektur/OS tidak cocok dengan binary yang diunduh" >&2
  echo "   - sistem musl (Alpine) padahal binary butuh glibc" >&2
  echo "   - arsip rusak; hapus $TUJUAN lalu jalankan ulang" >&2
  exit 1
fi
echo "  deckcraft-cli melaporkan: $LAPORAN"

echo ""
echo "== Selesai =="
echo "Binary : $CLI"
echo "Jalankan app dengan API aktif:"
echo "  pnpm dev        # mode pengembangan"
echo "  npm run serve   # server produksi (butuh dist/, jalankan build dulu)"
echo "Lalu buka panel 'DeckCraft Studio' di sidebar Ekspor."
