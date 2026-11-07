# syntax=docker/dockerfile:1
#
# NitZ-909 — Auto Generator Office
#
# Satu container menjalankan dua hal sekaligus:
#   1. aplikasi web statis (hasil `vite build`)
#   2. API DeckCraft (server/serve.ts) yang memanggil binary deckcraft-cli
#
# Base image WAJIB Debian/glibc, bukan Alpine. Binary resmi DeckCraft
# ditautkan ke `ld-linux-x86-64.so.2` (glibc); di Alpine (musl) ia gagal
# dijalankan dengan pesan "not found" yang menyesatkan.

# ---------------------------------------------------------------------------
# Tahap 1 — build aplikasi web
# ---------------------------------------------------------------------------
FROM node:22-slim AS build

WORKDIR /app

# Hanya berkas yang dibutuhkan Vite yang disalin lebih dulu agar cache
# layer tetap berguna saat kode berubah.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.json tsconfig.app.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

# npm dipakai (bukan pnpm) supaya tidak perlu Corepack di dalam image.
# Puppeteer tidak diunduh: hanya dipakai skrip verifikasi lokal.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm install --no-audit --no-fund --legacy-peer-deps \
 && npm run build

# ---------------------------------------------------------------------------
# Tahap 2 — image produksi
# ---------------------------------------------------------------------------
FROM node:22-slim

# Versi DeckCraft dipatok supaya build reproducible.
ARG DECKCRAFT_VERSION=0.8.0
ARG DECKCRAFT_SHA256=227b8c9cdd2c06b7866807f995fe5d2d0675523a61208f9bc26cf2760fddcb8f

WORKDIR /app

# Fonta sistem: deckcraft-cli merender slide ke PNG dan butuh fonta yang
# tersedia di sistem. Tanpa ini teks slide bisa tampil sebagai kotak kosong.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates curl \
      fontconfig \
      fonts-dejavu-core \
      fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# --- DeckCraft CLI ---
# Diunduh dari rilis resmi lalu diverifikasi terhadap SHA256SUMS.txt rilis
# yang sama. Bila checksum tidak cocok, build berhenti — tidak ada binary
# asing yang masuk ke image.
RUN set -eux; \
    arsip="deckcraft-${DECKCRAFT_VERSION}-linux-x86_64.tar.gz"; \
    url="https://github.com/storytold/deckcraft/releases/download/v${DECKCRAFT_VERSION}/${arsip}"; \
    curl -fsSL --retry 3 --retry-delay 2 "$url" -o /tmp/dc.tar.gz; \
    echo "${DECKCRAFT_SHA256}  /tmp/dc.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/dc.tar.gz -C /tmp; \
    install -m 0755 "/tmp/deckcraft-${DECKCRAFT_VERSION}-linux-x86_64/bin/deckcraft-cli" /usr/local/bin/deckcraft-cli; \
    rm -rf /tmp/dc.tar.gz "/tmp/deckcraft-${DECKCRAFT_VERSION}-linux-x86_64"; \
    deckcraft-cli --version

# --- Aplikasi ---
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY server ./server
COPY package.json ./

ENV PORT=8090
ENV HOST=0.0.0.0
# `defaultBinPath()` mencari binary di vendors/, sedangkan di image ini
# binary dipasang ke /usr/local/bin. Variabel ini yang menjembatani keduanya.
ENV DECKCRAFT_CLI=/usr/local/bin/deckcraft-cli
ENV NODE_ENV=production

EXPOSE 8090

# Healthcheck tanpa curl tambahan: Node sudah ada di image.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=4 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8090)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "server/serve.ts"]
