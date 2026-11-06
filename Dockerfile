FROM node:22-alpine AS build

WORKDIR /app

# Salin hanya apa yang dibutuhkan untuk build.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY src ./src
COPY server ./server
COPY public ./public
COPY vite.config.ts tsconfig.json tsconfig.app.json ./

# Build Vite (tidak butuh pnpm untuk ini; npm bawaan Node sudah cukup).
RUN npm install --no-audit --no-fund --legacy-peer-deps && \
    npm run build

# === Production image ===
FROM node:22-alpine

RUN corepack enable && corepack prepare pnpm@9 activate

WORKDIR /app

# Salin artefak build dan server (tanpa node_modules).
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./package.json

# Unduh deckcraft-cli untuk Linux x64. Ini ditaruh di PATH.
RUN echo "=== Download DeckCraft CLI ===" && \
    curl -fsSL "https://github.com/nicholaswmin/deckcraft/releases/latest/download/deckcraft-x86_64-unknown-linux-musl.tar.gz" \
         -o /tmp/deckcraft.tar.gz && \
    mkdir -p /usr/local/bin && \
    tar -xzf /tmp/deckcraft.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/deckcraft && \
    rm /tmp/deckcraft.tar.gz && \
    deckcraft --version

EXPOSE 8090

ENV PORT=8090
ENV HOST=0.0.0.0

# Serve statis + API DeckCraft dalam satu proses.
CMD ["node", "--experimental-strip-types", "server/serve.ts"]
