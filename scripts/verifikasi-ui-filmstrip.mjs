/**
 * Uji UI DeckCraft Studio: filmstrip semua slide + tombol ekspor PDF/GIF.
 *
 * Memakai Chrome DevTools Protocol seperti `verify-ui.mjs`.
 * Butuh server dev yang sudah jalan (URL, default http://127.0.0.1:5180/).
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9334;
const OUT = path.resolve(process.env.OUT || "ui-filmstrip.png");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-filmstrip"),
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

const wsUrl = await cariTarget();
const ws = new WebSocket(wsUrl);
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

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
await sleep(3000);

/**
 * Tunggu elemen muncul. Skrip sebelumnya memakai jeda tetap, dan panel
 * belum tentu siap pada detik ke-6 -> semua pemeriksaan gagal aunque
 * tampilannya benar.
 */
async function tungguPunsur(kueri, maksMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    const v = await evalJs(`!!document.querySelector(${JSON.stringify(kueri)})`);
    if (v === true) return true;
    await sleep(500);
  }
  return false;
}
async function tungguPanel() {
  return tungguPunsur(".dc-studio");
}
const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

// 0. Panel harus muncul (aplikasi React perlu mount).
cek("panel DeckCraft Studio muncul", await tungguPanel());

// 1. Panel ada.
cek(
  "panel DeckCraft Studio ada",
  (await evalJs(`!!document.querySelector('.dc-studio')`)) === true,
);

// 2. Tombol ekspor PDF & GIF ada.
const tombol = await evalJs(
  `(() => { const t = [...document.querySelectorAll('.dc-studio button')].map(b => b.textContent.trim());
     return { pdf: t.some(x => x.includes('PDF')), gif: t.some(x => x.includes('GIF')) }; })()`,
);
cek("tombol 'Unduh PDF' ada", tombol?.pdf === true);
cek("tombol 'Unduh GIF' ada", tombol?.gif === true);

// 3. Tombol ekspor nonaktif sebelum deck dibangun.
const nonaktifAwal = await evalJs(
  `(() => { const b = [...document.querySelectorAll('.dc-studio button')].find(x => x.textContent.includes('PDF'));
     return b ? b.disabled : null; })()`,
);
cek("tombol PDF nonaktif sebelum deck dibangun", nonaktifAwal === true);

// 4. Isi kanvas + bangun deck lewat UI.
await evalJs(
  `fetch('/api/deckcraft/build', {method:'POST',headers:{'Content-Type':'application/json'},
     body: JSON.stringify({blocks:[
       {id:'h1',type:'heading',level:1,text:'Laporan Kinerja 2026'},
       {id:'p1',type:'paragraph',text:'Ringkasan eksekutif dan temuan utama.'},
       {id:'h2',type:'heading',level:2,text:'Cuplikan Kode'},
       {id:'c1',type:'code',language:'ts',code:'const a = 1;\\nconst b = 2;'},
       {id:'h3',type:'heading',level:2,text:'Segmen Pasar'},
       {id:'t1',type:'table',headers:['Segmen','Porsi'],rows:[['Enterprise','48%'],['SMB','34%']]}
     ], judul:'Laporan Kinerja 2026', tema:'Slate'})}).then(r=>r.json()).then(()=>true)`,
);

const diklik = await evalJs(
  `(() => { const btn = [...document.querySelectorAll('.dc-studio button')].find(b => b.textContent.includes('Bangun Deck'));
     if (!btn) return false; btn.click(); return true; })()`,
);
cek("tombol 'Bangun Deck' diklik", diklik === true);
// Tunggu daftar slide muncul, bukan jeda tetap.
const adaDaftar = await tungguPunsur(".dc-item-slide", 40000);
cek("daftar slide muncul", adaDaftar);
await sleep(2500);

// 5. Filmstrip: toggle ada.
const adaToggle = await evalJs(
  `(() => { const b = [...document.querySelectorAll('.dc-studio button')].find(x => x.textContent.includes('Filmstrip'));
     return b ? { ada: true, expanded: b.getAttribute('aria-expanded') } : { ada: false }; })()`,
);
cek("toggle filmstrip ada", adaToggle?.ada === true);
cek(
  "toggle filmstrip awalnya tertutup",
  adaToggle?.expanded === "false",
  `aria-expanded=${adaToggle?.expanded}`,
);

// 6. Buka filmstrip.
await evalJs(
  `(() => { const b = [...document.querySelectorAll('.dc-studio button')].find(x => x.textContent.includes('Filmstrip'));
     if (!b) return false; b.click(); return true; })()`,
);
await sleep(2000);

// Tunggu thumbnail benar-benar ter-render (naturalWidth > 0), bukan cuma
// elemennya ada di DOM.
const t0 = Date.now();
let filmstrip = null;
while (Date.now() - t0 < 40000) {
  filmstrip = await evalJs(
    `(() => { const items = [...document.querySelectorAll('.dc-filmstrip-item')];
       return { jumlah: items.length,
                gambar: items.map(i => { const g = i.querySelector('img'); return g ? { w: g.naturalWidth, h: g.naturalHeight, src: (g.getAttribute('src')||'').slice(0,22) } : null; }) }; })()`,
  );
  if (
    filmstrip?.jumlah > 0 &&
    filmstrip.gambar.every((g) => g && g.w > 0)
  ) {
    break;
  }
  await sleep(1000);
}
cek(
  "filmstrip punya satu thumbnail per slide",
  (filmstrip?.jumlah ?? 0) > 0,
  `${filmstrip?.jumlah} thumbnail`,
);
cek(
  "semua thumbnail benar-benar ter-render (naturalWidth > 0)",
  Array.isArray(filmstrip?.gambar) &&
    filmstrip.gambar.length === filmstrip.jumlah &&
    filmstrip.gambar.every((g) => g && g.w > 0 && g.h > 0),
  filmstrip?.gambar?.[0] ? `${filmstrip.gambar[0].w}x${filmstrip.gambar[0].h} ${filmstrip.gambar[0].src}` : "-",
);
cek(
  "thumbnail memakai data-URL PNG",
  filmstrip?.gambar?.[0]?.src?.startsWith("data:image/png;base64"),
  filmstrip?.gambar?.[0]?.src,
);

// 7. Klik thumbnail pindah slide aktif.
const aktif = await evalJs(
  `(() => { const items = [...document.querySelectorAll('.dc-filmstrip-item')];
     if (items.length < 2) return null;
     items[1].click();
     return new Promise(r => setTimeout(() => r({
       aktifFilmstrip: items[1].className.includes('aktif'),
       aktifDaftar: [...document.querySelectorAll('.dc-item-slide')].map(b => b.className.includes('aktif')),
     }), 2500)); })()`,
);
cek(
  "klik thumbnail mengaktifkan slide yang sesuai",
  aktif?.aktifFilmstrip === true,
  JSON.stringify(aktif),
);

// 8. Screenshot panel.
const box = await evalJs(
  `(() => { const e = document.querySelector('.dc-studio'); if (!e) return null;
     const r = e.getBoundingClientRect();
     return {x: Math.max(0,r.x-12), y: Math.max(0,r.y-12), width: r.width+24, height: r.height+24}; })()`,
);
if (box) {
  const shot = await kirim("Page.captureScreenshot", {
    format: "png",
    clip: { ...box, scale: 2 },
  });
  writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
  console.log(`      screenshot panel → ${OUT}`);
}

ws.close();
chrome.kill();
console.log("\nSelesai.");
