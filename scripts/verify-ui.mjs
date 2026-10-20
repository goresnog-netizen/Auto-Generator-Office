/**
 * Uji UI DeckCraft Studio lewat Chrome DevTools Protocol.
 * Menjalankan build deck di panel, lalu memotret hasilnya.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9333;
const OUT = path.resolve(process.env.OUT || "ui-deckcraft-studio.png");

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile"),
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
await sleep(6000);

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Panel DeckCraft Studio harus ada dan melaporkan DeckCraft tersedia.
const adaPanel = await evalJs(
  `!!document.querySelector('.dc-studio')`,
);
cek("panel DeckCraft Studio ada di DOM", adaPanel === true);

const versi = await evalJs(
  `(document.querySelector('.dc-pita')?.textContent || '').trim()`,
);
cek("pita versi DeckCraft terbaca", /0\.8\.0/.test(versi), versi);

// 2. Isi kanvas先 perlu ada: panggil API build langsung, lalu klik tombol.
const buildApi = await evalJs(
  `fetch('/api/deckcraft/build', {method:'POST',headers:{'Content-Type':'application/json'},
     body: JSON.stringify({blocks:[
       {id:'h1',type:'heading',level:1,text:'Laporan Kinerja 2026'},
       {id:'p1',type:'paragraph',text:'Ringkasan eksekutif dan temuan utama.'},
       {id:'h2',type:'heading',level:2,text:'Segmen Pasar'},
       {id:'t1',type:'table',headers:['Segmen','Porsi','YoY'],rows:[['Enterprise','48%','+18%'],['SMB','34%','+9%']]},
       {id:'h3',type:'heading',level:2,text:'Tren Pendapatan'},
       {id:'c1',type:'chart',chartType:'bar',data:{labels:['Q1','Q2','Q3','Q4'],datasets:[{label:'Pendapatan',data:[120,180,240,310]}]}}
     ], judul:'Laporan Kinerja 2026', tema:'Slate'})}).then(r=>r.json()).then(d=>({n:d.deck?.slides?.length||0}))`,
);
cek("API build mengembalikan deck", buildApi?.n > 0, `${buildApi?.n} slide`);

// 3. Klik tombol "Bangun Deck" di panel.
const diklik = await evalJs(
  `(() => {
     const btn = [...document.querySelectorAll('.dc-studio button')]
       .find(b => b.textContent.includes('Bangun Deck'));
     if (!btn) return false;
     btn.click();
     return true;
   })()`,
);
cek("tombol 'Bangun Deck' diklik", diklik === true);
await sleep(9000);

// 4. Daftar slide + pratinjau PNG harus muncul.
const jumlahSlide = await evalJs(
  `document.querySelectorAll('.dc-item-slide').length`,
);
cek("daftar slide muncul di panel", jumlahSlide > 0, `${jumlahSlide} slide`);

const adaGambar = await evalJs(
  `(() => { const i = document.querySelector('.dc-gambar');
            return i ? { src: (i.getAttribute('src')||'').slice(0,30), w: i.naturalWidth, h: i.naturalHeight } : null; })()`,
);
cek("pratinjau PNG dirender", !!adaGambar && adaGambar.w > 100,
  adaGambar ? `${adaGambar.w}x${adaGambar.h} ${adaGambar.src}` : "tidak ada");

const pesan = await evalJs(
  `(document.querySelector('.dc-pesan')?.textContent || '').trim()`,
);
cek("pesan status terbaca", pesan.length > 0, pesan);

// 5. Screenshot panel saja.
const box = await evalJs(
  `(() => { const e = document.querySelector('.dc-studio');
            if (!e) return null; const r = e.getBoundingClientRect();
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

// 6. Screenshot halaman penuh.
const full = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(
  path.resolve("ui-deckcraft-full.png"),
  Buffer.from(full.result.data, "base64"),
);

ws.close();
chrome.kill();
console.log("\nSelesai.");
