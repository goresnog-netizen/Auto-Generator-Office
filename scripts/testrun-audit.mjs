/**
 * TEST RUN 2: audit area yang belum pernah diuji visual.
 *
 *  1. Tema terang & gelap (glassmorphism).
 *  2. Ekspor generator NitZ-909 sendiri (DOCX/XLSX/PDF) - jalur yang
 *     berbeda dari DeckCraft, dan belum pernah dilihat hasilnya.
 *  3. Panel Auto-Generate.
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9337;
const OUT = path.resolve("testrun");
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1680,1050",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-testrun2"),
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cariTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch { /* belum siap */ }
    await sleep(500);
  }
  throw new Error("Chrome DevTools tidak siap.");
}
const ws = new WebSocket(await cariTarget());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
function kirim(method, params = {}) {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expr) {
  const r = await kirim("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text);
  return r.result?.result?.value;
}
async function shot(nama, clip = null) {
  const params = { format: "png" };
  if (clip) params.clip = { ...clip, scale: 2 };
  const s = await kirim("Page.captureScreenshot", params);
  const f = path.join(OUT, `${nama}.png`);
  writeFileSync(f, Buffer.from(s.result.data, "base64"));
  console.log(`  -> ${f}`);
}

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
await sleep(4000);
await evalJs(`!!document.querySelector('.nitz-app-root, #root > *')`);
await sleep(2000);

// --- 1. Ganti tema ---
//
// Tombolnya saklar: label-nya "☾ Gelap" saat mode gelap, "☀ Terang" saat
// mode terang. Jadi cara yang benar: klik tombol, lalu BACA `data-theme`
// untuk memastikan mode mana yang aktif - bukan menebak dari label.
console.log("== ganti tema ==");
const temaAwal = await evalJs(`document.documentElement.getAttribute("data-theme")`);
console.log("  data-theme awal =", temaAwal);

const klikTema = async () =>
  evalJs(
    `(() => { const b = [...document.querySelectorAll('button')]
        .find(x => /☾|☀/.test(x.textContent || ''));
       if (!b) return false; b.click(); return true; })()`,
  );

await klikTema();
await sleep(2500);
const temaKedua = await evalJs(`document.documentElement.getAttribute("data-theme")`);
console.log("  data-theme setelah klik =", temaKedua);
console.log("  tombol berhasil ganti tema:", temaKedua !== temaAwal);
await shot(temaKedua === "light" ? "05-tema-terang" : "06-tema-gelap");

// Klik lagi -> kembali ke tema awal, untuk membandingkan kedua mode.
await klikTema();
await sleep(2500);
const temaKetiga = await evalJs(`document.documentElement.getAttribute("data-theme")`);
console.log("  data-theme setelah klik kedua =", temaKetiga);
await shot(temaKetiga === "light" ? "05-tema-terang" : "06-tema-gelap");

// --- 3. Panel Auto-Generate ---
console.log("\n== panel Auto-Generate ==");
const adaPanel = await evalJs(`!!document.querySelector('.ag-panel, .ag-kartu')`);
console.log("  panel ada:", adaPanel);
if (adaPanel) {
  const box = await evalJs(
    `(() => { const e = document.querySelector('.ag-panel') || document.querySelector('.ag-kartu');
       if (!e) return null; const r = e.getBoundingClientRect();
       return {x: Math.max(0,r.x-12), y: Math.max(0,r.y-12), width: r.width+24, height: r.height+24}; })()`,
  );
  if (box) await shot("07-auto-generate", box);
}

// --- 4. Ekspor generator NitZ-909 (bukan DeckCraft) ---
console.log("\n== ekspor generator NitZ-909 (DOCX/XLSX/PDF) ==");
const { generateDocument } = await import("../src/generators/index.ts");
const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Uji NitZ-909" },
  { id: "p1", type: "paragraph", text: "Paragraf pembuka untuk laporan uji." },
  { id: "l1", type: "list", ordered: false, items: [{ text: "Poin pertama" }, { text: "Poin kedua" }] },
  { id: "h2", type: "heading", level: 2, text: "Tabel Data" },
  { id: "t1", type: "table", headers: ["Kolom A", "Kolom B"], rows: [["1", "2"], ["3", "4"]] },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;" },
  { id: "d1", type: "diagram", diagramType: "mermaid", source: "flowchart LR\n A[Kiri] --> B[Kanan]" },
];
for (const [format, ext] of [["word", "docx"], ["xlsx", "xlsx"], ["pdf", "pdf"]]) {
  try {
    const hasil = await generateDocument(
      format,
      { type: format, title: "Laporan Uji NitZ-909", metadata: { author: "Uji" } },
      { blocks: BLOK },
    );
    const p = path.join(OUT, `nitz-uji.${ext}`);
    if (hasil?.buffer) {
      writeFileSync(p, hasil.buffer);
      console.log(`  ${format}: ${hasil.buffer.length} byte -> ${p}`);
    } else {
      console.log(`  ${format}: TIDAK ada buffer`, JSON.stringify(hasil).slice(0, 200));
    }
  } catch (e) {
    console.log(`  ${format}: GAGAL - ${e.message}`);
  }
}

ws.close();
chrome.kill();
console.log("\nSelesai.");
