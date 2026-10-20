/**
 * Server produksi NitZ-909.
 *
 * Menyajikan build statis `dist/` dan API DeckCraft di satu proses.
 * Dipakai untuk menjalankan aplikasi di luar mode dev Vite, di mana
 * middleware Vite tidak tersedia.
 *
 *   node --experimental-strip-types server/serve.ts
 *   PORT=8080 node --experimental-strip-types server/serve.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { tanganiApi, tutupDeckcraft } from "./deckcraft-api.ts";

const AKAR = process.cwd();
const DIST = path.join(AKAR, "dist");
const PORT = Number(process.env.PORT ?? 8080);
const HOST = process.env.HOST ?? "127.0.0.1";

const TIPE_MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

/** Sajikan berkas statis; kembalikan false bila path tidak ada. */
function layaniStatis(req: IncomingMessage, res: ServerResponse): boolean {
  const url = new URL(req.url ?? "/", "http://localhost");
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith("/")) rel += "index.html";
  const target = path.join(DIST, path.normalize(rel).replace(/^([/\\])+/, ""));

  // Cegah path traversal: target harus tetap di dalam DIST.
  if (!target.startsWith(DIST)) return false;
  if (!existsSync(target) || !statSync(target).isFile()) return false;

  const ext = path.extname(target).toLowerCase();
  res.writeHead(200, {
    "Content-Type": TIPE_MIME[ext] ?? "application/octet-stream",
    "Content-Length": statSync(target).size,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  createReadStream(target).pipe(res);
  return true;
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (await tanganiApi(req, res)) return;
      if (layaniStatis(req, res)) return;
      // SPA fallback: semua rute lain → index.html.
      const index = path.join(DIST, "index.html");
      if (existsSync(index)) {
        res.writeHead(200, { "Content-Type": TIPE_MIME[".html"] });
        createReadStream(index).pipe(res);
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 — build produksi belum ada. Jalankan `pnpm build`.");
    } catch (e) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        `500 — ${e instanceof Error ? e.message : "kesalahan tak diketahui"}`,
      );
    }
  })();
});

server.listen(PORT, HOST, () => {
  console.log(`NitZ-909 produksi → http://${HOST}:${PORT}`);
  console.log(`API DeckCraft     → http://${HOST}:${PORT}/api/deckcraft/status`);
});

async function tutup() {
  await tutupDeckcraft();
  server.close(() => process.exit(0));
}
process.on("SIGINT", tutup);
process.on("SIGTERM", tutup);
