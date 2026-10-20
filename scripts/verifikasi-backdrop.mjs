/**
 * Verifikasi arsitektur backdrop root.
 *
 * Pertanyaan: apakah `backdrop-filter` panel benar-benar memburam mesh
 * `body`, atau terblokir oleh `mix-blend-mode`/`isolation` di leluhur?
 *
 * Cara ukur: potret area panel sidebar, lalu bandingkan dengan versi di
 * mana semua `backdrop-filter` dimatikan. Kalau blur bekerja, potretnya
 * BERBEDA (blurzebek lebih rata). Kalau terblokir, sama persis.
 *
 * Plus: ukur apakah `body` punya gradient mesh dan apakah root app benar
 * transparan (supaya mesh terlihat).
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9342;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-bd"),
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
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await ev(`!!document.querySelector('.nitz-app-root') && document.querySelectorAll('*').length > 200`)) === true) break;
}
await sleep(2000);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Struktur layering.
const struktur = await ev(`
  (() => {
    const body = getComputedStyle(document.body);
    const root = document.querySelector('.nitz-app-root');
    const rootCs = getComputedStyle(root);
    const latar = document.querySelector('.nitz-latar');
    const lCs = latar ? getComputedStyle(latar) : null;
    // Ancestor apa pun yang punya mix-blend-mode / filter / opacity<1
    // akan menjadi backdrop root dan memblokir blur.
    const blockers = [];
    for (const el of document.querySelectorAll('.kartu-kaca, .dc-kartu, .nitz-side, .nitz-header, .editor-canvas')) {
      let n = el.parentElement;
      while (n && n !== document.documentElement) {
        const cs = getComputedStyle(n);
        const blend = cs.mixBlendMode && cs.mixBlendMode !== 'normal';
        const filt = cs.filter && cs.filter !== 'none';
        const op = parseFloat(cs.opacity) < 1;
        if (blend || filt || op) {
          blockers.push({
            el: el.className.toString().slice(0, 30),
            ancestor: (n.className.toString() || n.tagName).slice(0, 30),
            blend, filt, op,
          });
          break;
        }
        n = n.parentElement;
      }
    }
    return {
      bodyHasMesh: body.backgroundImage.includes('radial-gradient'),
      bodyBlend: body.mixBlendMode,
      rootBackground: rootCs.backgroundColor,
      rootImage: rootCs.backgroundImage.slice(0, 40),
      rootIsolation: rootCs.isolation,
      latarExists: !!latar,
      latarBlend: lCs ? lCs.mixBlendMode : null,
      latarZ: lCs ? lCs.zIndex : null,
      blockers: blockers.slice(0, 8),
      blockerCount: blockers.length,
    };
  })()
`);
console.log("=== struktur layering ===");
console.log("  body punya mesh gradien :", struktur.bodyHasMesh);
console.log("  root background         :", struktur.rootBackground, "| image:", struktur.rootImage);
console.log("  root isolation          :", struktur.rootIsolation);
console.log("  .nitz-latar ada         :", struktur.latarExists, "| blend:", struktur.latarBlend, "| z:", struktur.latarZ);
console.log("  blocker backdrop-root   :", struktur.blockerCount, JSON.stringify(struktur.blockers));

cek("mesh ada di body (bukan root)", struktur.bodyHasMesh === true);
cek("root app transparan agar mesh terlihat", struktur.rootBackground.includes("rgba(0, 0, 0, 0)"), struktur.rootBackground);
cek("elemen .nitz-latar ada", struktur.latarExists === true);
cek("tidak ada ancestor yang memblokir blur", struktur.blockerCount === 0, `${struktur.blockerCount} blocker`);

// 2. Does the blur actually change the pixels?
const area = { x: 0, y: 280, width: 300, height: 200, scale: 1 };

const denganBlur = await kirim("Page.captureScreenshot", { format: "png", clip: area });
const a = Buffer.from(denganBlur.result.data, "base64");
writeFileSync(path.resolve("bd-dengan-blur.png"), a);

await ev(`
  (() => {
    const s = document.createElement('style');
    s.id = 'nobd';
    s.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
    document.head.appendChild(s);
    return true;
  })()
`);
await sleep(500);
const tanpaBlur = await kirim("Page.captureScreenshot", { format: "png", clip: area });
const b = Buffer.from(tanpaBlur.result.data, "base64");
writeFileSync(path.resolve("bd-tanpa-blur.png"), b);
await ev(`document.getElementById('nobd')?.remove(); true`);

const beda = !a.equals(b);
console.log(`\n  dengan blur : ${a.length} byte`);
console.log(`  tanpa blur  : ${b.length} byte`);
cek("backdrop-filter mengubah piksel (blur benar-benar bekerja)", beda,
  beda ? "berbeda" : "IDENTIK — blur tidak penetrates ke mesh");

ws.close();
chrome.kill();
console.log("\nSelesai.");
