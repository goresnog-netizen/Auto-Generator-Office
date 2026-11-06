#!/usr/bin/env bash
#
# Pastikan Node.js tersedia; unduh Node LTS resmi bila belum ada.
# Dipanggil oleh start.sh / install.sh. Harus di-DOT-SOURCE:
#   . ./scripts/bootstrap-node.sh
# supaya perubahan PATH bertahan di proses pemanggil.
#
# npm sudah termasuk di arsip Node, jadi tidak ada alat tambahan.

set -euo pipefail

AKAR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DIST="${NITZ_NODE_DIST:-latest-v22.x}"
VERSI_MINIMUM="${NITZ_NODE_MIN:-20}"
RUNTIME="$AKAR/.runtime"
UNDUH="$RUNTIME/unduhan"
PASANG="$RUNTIME/node"

versi_cukup() {
  local bin="$1" v
  v="$("$bin" --version 2>/dev/null || true)"
  v="${v#v}"
  local mayor="${v%%.*}"
  [[ "$mayor" =~ ^[0-9]+$ ]] && [ "$mayor" -ge "$VERSI_MINIMUM" ]
}

pakai_lokal() {
  local kandidat
  for kandidat in "$PASANG"/node-v*-*/bin/node; do
    if [ -x "$kandidat" ] && versi_cukup "$kandidat"; then
      export PATH="$(dirname "$kandidat"):$PATH"
      echo "[Node] Memakai unduhan lokal: $kandidat"
      return 0
    fi
  done
  return 1
}

# 1. Node sistem yang sudah memadai.
if command -v node >/dev/null 2>&1 && versi_cukup "$(command -v node)"; then
  echo "[Node] Sudah terpasang: $(node -v) — tidak perlu mengunduh."
  return 0 2>/dev/null || exit 0
fi

# 2. Unduhan sebelumnya.
if pakai_lokal; then
  return 0 2>/dev/null || exit 0
fi

# 3. Unduh rilis resmi.
case "$(uname -s)" in
  Linux) PLATFORM="linux" ;;
  Darwin) PLATFORM="darwin" ;;
  *) echo "[Node] Sistem operasi belum didukung: $(uname -s)" >&2; return 1 2>/dev/null || exit 1 ;;
esac

case "$(uname -m)" in
  x86_64 | amd64) ARCH="x64" ;;
  arm64 | aarch64) ARCH="arm64" ;;
  *) echo "[Node] Arsitektur belum didukung: $(uname -m)" >&2; return 1 2>/dev/null || exit 1 ;;
esac

command -v curl >/dev/null 2>&1 || {
  echo "[Node] curl diperlukan untuk mengunduh Node.js." >&2
  return 1 2>/dev/null || exit 1
}

mkdir -p "$UNDUH" "$PASANG"
BASE="https://nodejs.org/dist/$DIST"
echo "[Node] Node.js >= $VERSI_MINIMUM tidak ditemukan. Mengunduh dari $BASE ..."

SUMS="$UNDUH/SHASUMS256-$DIST.txt"
curl -fsSL "$BASE/SHASUMS256.txt" -o "$SUMS"

BERKAS="$(grep -E "node-v[0-9.]+-${PLATFORM}-${ARCH}\.tar\.xz" "$SUMS" | head -1 | awk '{print $2}')"
BERKAS="${BERKAS#\*}"
if [ -z "$BERKAS" ]; then
  echo "[Node] Arsip untuk ${PLATFORM}-${ARCH} tidak ditemukan di $DIST." >&2
  return 1 2>/dev/null || exit 1
fi

HASH="$(awk -v f="$BERKAS" '$2 == f || $2 == "*" f {print $1; exit}' "$SUMS")"
ARSIP="$UNDUH/$BERKAS"
if [ ! -f "$ARSIP" ]; then
  echo "[Node] Mengunduh $BERKAS ..."
  curl -fsSL "$BASE/$BERKAS" -o "$ARSIP"
fi

if command -v sha256sum >/dev/null 2>&1; then
  AKTUAL="$(sha256sum "$ARSIP" | awk '{print $1}')"
else
  AKTUAL="$(shasum -a 256 "$ARSIP" | awk '{print $1}')"
fi
if [ "$AKTUAL" != "$HASH" ]; then
  rm -f "$ARSIP"
  echo "[Node] Checksum tidak cocok. Unduhan dibuang; jalankan lagi." >&2
  return 1 2>/dev/null || exit 1
fi
echo "[Node] Checksum SHA256 cocok."

NAMA="${BERKAS%.tar.xz}"
if [ ! -x "$PASANG/$NAMA/bin/node" ]; then
  echo "[Node] Mengekstrak ke $PASANG/$NAMA ..."
  tar -xJf "$ARSIP" -C "$PASANG"
fi

export PATH="$PASANG/$NAMA/bin:$PATH"
echo "[Node] Siap: $(node -v) | npm $(npm -v)"
