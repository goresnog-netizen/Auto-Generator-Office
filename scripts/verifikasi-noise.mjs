/**
 * Uji F1: apakah noise overlay benar-benar terlihat?
 *
 * Cara: potret layar dengan noise aktif vs noise dimatikan, lalu bandingkan
 * byte PNG. Kalau identik → noise tidak terlihat (F1 terbukti).
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9341;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1200,800",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-noise"),
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = l.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch {}
    await sleep(500);
  }
  throw new Error("CDP tidak siap");
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pend = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
});
const kirim = (method, params = {}) => new Promise((res) => {
  const i = ++id; pend.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
const ev = async (e) => {
  const r = await kirim("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await ev(`!!document.querySelector('.nitz-app-root')`)) === true) break;
}
await sleep(2000);

// Status noise saat ini.
const status = await ev(`
  (() => {
    const cs = getComputedStyle(document.querySelector('.nitz-app-root'), '::before');
    return { content: cs.content, zIndex: cs.zIndex, position: cs.position,
             blend: cs.mixBlendMode, opacity: cs.opacity,
             hasImage: cs.backgroundImage.includes('data:image/svg+xml') };
  })()
`);
console.log("status ::before =", JSON.stringify(status));

// Potret area kosong (latar belakang, bukan panel).
const clip = { x: 20, y: 200, width: 260, height: 120, scale: 1 };

// Noise aktif.
const denganNoise = await kirim("Page.captureScreenshot", { format: "png", clip });
const a = Buffer.from(denganNoise.result.data, "base64");
writeFileSync(path.resolve("noise-dengan.png"), a);

// Noise dimatikan.
await ev(`
  (() => {
    const s = document.createElement('style');
    s.id = 'off';
    s.textContent = '.nitz-app-root::before { display: none !important; }';
    document.head.appendChild(s);
    return true;
  })()
`);
await sleep(500);
const tanpaNoise = await kirim("Page.captureScreenshot", { format: "png", clip });
const b = Buffer.from(tanpaNoise.result.data, "base64");
writeFileSync(path.resolve("noise-tanpa.png"), b);

const identik = a.equals(b);
console.log(`\ndengan noise : ${a.length} byte`);
console.log(`tanpa noise  : ${b.length} byte`);
console.log(identik
  ? "=> IDENTIK — noise overlay TIDAK terlihat (F1 terbukti)."
  : "=> BERBEDA — noise overlay terlihat (F1 tidak terbukti).");

// Berapa persen piksel yang beda? Bandingkan ukuran file saja sebagai proxy.
const delta = Math.abs(a.length - b.length) / Math.max(a.length, 1);
console.log(`delta ukuran: ${(delta * 100).toFixed(3)}%`);

ws.close(); chrome.kill();
