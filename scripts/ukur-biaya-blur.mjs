/**
 * Isolasi biaya blur per kelompok elemen.
 *
 * Mengukur selisih biaya reaktif dengan vs tanpa blur untuk tiap kelompok
 * selector, supaya tahu mana yang mahal dan bisa di取舍.
 */
import { spawn } from "node:child_process";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9344;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  "--force-prefers-reduced-motion=no-preference",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-biaya"),
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
  const r = await kirim("Runtime.evaluate", { expression: e, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
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

const UKUR = `
  (() => {
    const samples = [];
    const root = document.querySelector('.nitz-app-root');
    for (let i = 0; i < 25; i++) {
      const t0 = performance.now();
      document.body.style.setProperty('--probe', String(i));
      void root.offsetHeight;
      document.body.style.removeProperty('--probe');
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  })()
`;

const kelompok = [
  ["Semua", "*"],
  [".kartu-kaca (Card)", ".kartu-kaca, .dc-kartu, .ag-kartu"],
  [".kartu-template (58)", ".kartu-template"],
  [".nitz-side (2)", ".nitz-side"],
  [".nitz-header", ".nitz-header"],
  [".editor-canvas + .nitz-isi", ".editor-canvas, .nitz-isi"],
  [".dash-card/.stat-kotak", ".dash-card, .stat-kotak"],
  ["input/select/textarea", "input, select, textarea"],
  [".segmen-*", ".segmen-tampilan, .segmen-dashboard"],
  [".dc-lembar + .dc-*", ".dc-lembar, .dc-gambar, .dc-daftar-slide, .dc-item-slide"],
  ["[role=dialog]", "[role='dialog']"],
];

console.log("kelompok".padEnd(28) + "biaya blur (ms)   jumlah elemen");
console.log("-".repeat(60));

for (const [nama, sel] of kelompok) {
  // Nonaktifkan blur hanya untuk kelompok ini.
  await ev(`
    (() => {
      document.getElementById('probe-blur')?.remove();
      const s = document.createElement('style');
      s.id = 'probe-blur';
      s.textContent = ${JSON.stringify(sel)} + ' { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
      document.head.appendChild(s);
      return true;
    })()
  `);
  await sleep(400);
  const tanpa = await ev(UKUR);
  await ev(`document.getElementById('probe-blur')?.remove(); true`);
  await sleep(400);
  const dengan = await ev(UKUR);
  const n = await ev(
    `document.querySelectorAll(${JSON.stringify(sel)}).length`,
  );
  const biaya = (dengan ?? 0) - (tanpa ?? 0);
  console.log(
    nama.padEnd(28) +
      biaya.toFixed(2).padStart(10) +
      "   " +
      n,
  );
}

ws.close();
chrome.kill();
