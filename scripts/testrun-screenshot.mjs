/**
 * TEST RUN: ambil screenshot nyata dari aplikasi NitZ-909.
 *
 * Menghasilkan:
 *  1. Tampilan utama (editor + sidebar).
 *  2. Panel DeckCraft Studio setelah deck dibangun (filmstrip terbuka).
 *  3. Pratinjau slide kode (bukti font monospace).
 *
 * Dipakai untuk memeriksa hasil kerja dengan mata, bukan cuma dengan log.
 */
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9336;
const OUT = path.resolve("testrun");
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1680,1050",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-testrun"),
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cariTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome belum siap */
    }
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
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
  }
  return r.result?.result?.value;
}
async function tungguPunsur(kueri, maksMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    if (await evalJs(`!!document.querySelector(${JSON.stringify(kueri)})`)) return true;
    await sleep(400);
  }
  return false;
}
async function shot(nama, clip = null) {
  const params = { format: "png" };
  if (clip) params.clip = { ...clip, scale: 2 };
  const s = await kirim("Page.captureScreenshot", params);
  const file = path.join(OUT, `${nama}.png`);
  writeFileSync(file, Buffer.from(s.result.data, "base64"));
  console.log(`  -> ${file}`);
  return file;
}

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
await sleep(3000);

console.log("== 1. tampilan utama ==");
await tungguPunsur(".nitz-app-root, .app-root, #root > *", 30000);
await sleep(2500);
await shot("01-utama");

// Isi kanvas dengan konten nyata (termasuk blok kode) lewat API,
// lalu bangun deck lewat UI.
console.log("\n== 2. DeckCraft Studio: build + filmstrip ==");
const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif dan temuan utama." },
  { id: "h2", type: "heading", level: 2, text: "Cuplikan Kode" },
  { id: "c1", type: "code", language: "ts", code: "constahun = 2026;\nconst pertumbuhan = 42;" },
  { id: "h3", type: "heading", level: 2, text: "Segmen Pasar" },
  { id: "t1", type: "table", headers: ["Segmen", "Porsi", "YoY"], rows: [
    ["Enterprise", "48%", "+18%"], ["SMB", "34%", "+9%"], ["Individu", "18%", "+3%"],
  ]},
  { id: "h4", type: "heading", level: 2, text: "Tren Pendapatan" },
  { id: "c2", type: "chart", chartType: "bar", data: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [{ label: "Pendapatan", data: [120, 180, 240, 310] }],
  }},
];

await evalJs(
  `fetch('/api/deckcraft/build', {method:'POST',headers:{'Content-Type':'application/json'},
     body: JSON.stringify({blocks:${JSON.stringify(BLOK)}, judul:'Laporan Kinerja 2026', tema:'Slate'})})
     .then(r=>r.json()).then(d=>({n:d.deck?.slides?.length||0}))`,
);

const diklik = await evalJs(
  `(() => { const b = [...document.querySelectorAll('.dc-studio button')].find(x => x.textContent.includes('Bangun Deck'));
     if (!b) return false; b.click(); return true; })()`,
);
console.log("  tombol 'Bangun Deck' diklik:", diklik);
const adaDaftar = await tungguPunsur(".dc-item-slide", 60000);
console.log("  daftar slide muncul:", adaDaftar);
await sleep(3000);

// Buka filmstrip.
await evalJs(
  `(() => { const b = [...document.querySelectorAll('.dc-studio button')].find(x => x.textContent.includes('Filmstrip'));
     if (!b) return false; b.click(); return true; })()`,
);
await sleep(1000);

// Tunggu thumbnail ter-render.
const t0 = Date.now();
let jumlah = 0;
while (Date.now() - t0 < 40000) {
  jumlah = await evalJs(`document.querySelectorAll('.dc-filmstrip-item').length`);
  const ok = await evalJs(
    `[...document.querySelectorAll('.dc-filmstrip-item img')].every(i => i.naturalWidth > 0)`,
  );
  if (jumlah > 0 && ok) break;
  await sleep(800);
}
console.log("  thumbnail filmstrip:", jumlah);

// Screenshot panel studio.
const box = await evalJs(
  `(() => { const e = document.querySelector('.dc-studio'); if (!e) return null;
     const r = e.getBoundingClientRect();
     return {x: Math.max(0,r.x-12), y: Math.max(0,r.y-12), width: r.width+24, height: r.height+24}; })()`,
);
if (box) await shot("02-deckcraft-studio", box);

// Pindah ke slide kode (index 1) lalu screenshot pratinjau.
console.log("\n== 3. pratinjau slide kode (font monospace) ==");
await evalJs(
  `(() => { const items = [...document.querySelectorAll('.dc-filmstrip-item')];
     if (items[1]) items[1].click(); return !!items[1]; })()`,
);
await sleep(4000);
const boxSlide = await evalJs(
  `(() => { const e = document.querySelector('.dc-lembar'); if (!e) return null;
     const r = e.getBoundingClientRect();
     return {x: Math.max(0,r.x-8), y: Math.max(0,r.y-8), width: r.width+16, height: r.height+16}; })()`,
);
if (boxSlide) await shot("03-pratinjau-slide-kode", boxSlide);

// Tampilan penuh.
await shot("04-utuh");

ws.close();
chrome.kill();
console.log("\nSelesai.");
