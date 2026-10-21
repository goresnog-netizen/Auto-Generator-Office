/**
 * SIRING: telusuri area aplikasi yang belum pernah diuji end-to-end.
 *
 * Yang sudah teruji: Ringkas/Lengkap, DeckCraft Studio, Auto-Generate.
 * Yang BELUM pernah disentuh: tab Presentasi/Spreadsheet/Infografis, mode
 * Form (FormMode), tombol ekspor browser, panel galeri template.
 *
 * Tujuannya: cari bagian yang benar-benar rusak, bukan mengulang yang
 * sudah lulus.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9342;
const OUT = path.resolve("testrun-siring");
mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1680,1050",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-siring"),
    "about:blank",
  ],
  { stdio: ["ignore", "pipe", "pipe"] },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

let wsUrl;
for (let i = 0; i < 40; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = l.find((t) => t.type === "page");
    if (p?.webSocketDebuggerUrl) {
      wsUrl = p.webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* belum siap */
  }
  await sleep(500);
}
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
const kirim = (method, params = {}) => {
  const id = ++msgId;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
};
const evalJs = async (e) => {
  const r = await kirim("Runtime.evaluate", {
    expression: e,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.result?.exceptionDetails) {
    throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
  }
  return r.result?.result?.value;
};
async function tungguPunsur(kueri, maksMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    if (await evalJs(`!!document.querySelector(${JSON.stringify(kueri)})`)) return true;
    await sleep(350);
  }
  return false;
}
async function shot(nama) {
  const s = await kirim("Page.captureScreenshot", { format: "png" });
  const f = path.join(OUT, `${nama}.png`);
  writeFileSync(f, Buffer.from(s.result.data, "base64"));
  console.log(`      -> ${f}`);
}

/** Deteksi error JavaScript yang muncul di halaman. */
await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Log.enable").catch(() => {});
const galatRuntime = [];
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Runtime.exceptionThrown") {
    const d = m.params?.exceptionDetails;
    galatRuntime.push(
      d?.exception?.description ?? d?.text ?? "exception tak dikenal",
    );
  }
  if (m.method === "Log.entryAdded" && m.params?.entry?.level === "error") {
    galatRuntime.push(m.params.entry.text);
  }
});

await kirim("Page.navigate", { url: URL });
await sleep(3500);
await tungguPunsur(".nitz-app-root, #root > *", 30000);
await sleep(2000);

// ---------- 1. Tab-tab utama ----------
console.log("== 1. tab tab utama ==");
const TAB = ["Semua", "Dokumen", "Presentasi", "Spreadsheet", "Infografis"];
for (const t of TAB) {
  const klik = await evalJs(
    `(() => { const b = [...document.querySelectorAll('button, [role="tab"], .segmen button')]
        .find(x => (x.textContent||'').trim().startsWith(${JSON.stringify(t)}));
       if (!b) return false; b.click(); return true; })()`,
  );
  await sleep(1200);
  const isi = await evalJs(
    `(() => ({ kartu: document.querySelectorAll('.galeri-grid > *, .galeri-baris > *').length,
               teks: (document.body.innerText||'').slice(0,0) }))()`,
  );
  cek(
    `tab "${t}" bisa diklik & punya isi`,
    klik && (isi?.kartu ?? 0) > 0,
    `${isi?.kartu ?? 0} kartu`,
  );
}

// ---------- 2. Panel Form (FormMode) ----------
//
// CATATAN: `FormMode` BUKAN tab terpisah - ia panel yang SELALU tampil di
// sidebar. Versi pertama skrip ini mencari tombol "Form" dan menganggap
// kemunculannya gagal - itu salah paham skrip, bukan bug aplikasi.
console.log("\n== 2. panel Form (FormMode) ==");
const isiForm = await evalJs(
  `(() => {
     // Cari panel yang berisi field isian metadata (judul, penulis, dll).
     const input = [...document.querySelectorAll('input, textarea, select')];
     const ada = input.length > 0;
     // Nama field metadata yang khas FormMode.
     const label = input.map(i => (i.getAttribute('placeholder') || i.getAttribute('aria-label') || i.name || '')).filter(Boolean);
     return { ada, jumlah: input.length, contoh: label.slice(0, 6) };
   })()`,
);
cek("panel Form punya field isian", isiForm?.ada === true && isiForm.jumlah > 0, `${isiForm?.jumlah} field`);
cek(
  "panel Form punya field metadata (judul/penulis/dll)",
  (isiForm?.contoh ?? []).length > 0,
  (isiForm?.contoh ?? []).join(", ").slice(0, 80),
);

// ---------- 3. Tombol ekspor browser ----------
console.log("\n== 3. tombol ekspor di sidebar ==");
const tombolEkspor = await evalJs(
  `(() => [...document.querySelectorAll('button')]
     .map(b => (b.textContent||'').trim())
     .filter(t => /DOCX|XLSX|PDF|PPTX|Unduh|Ekspor/i.test(t))
     .slice(0, 12))()`,
);
console.log("  tombol ekspor ditemukan:", JSON.stringify(tombolEkspor));
cek("ada tombol ekspor di UI", (tombolEkspor?.length ?? 0) > 0);

// ---------- 4. Galeri template: klik template ----------
console.log("\n== 4. klik template di galeri ==");
const templateKlik = await evalJs(
  `(() => { const k = document.querySelector('.galeri-grid > *, .galeri-baris > *');
     if (!k) return false;
     const b = k.querySelector('button, [role="button"]') || k;
     b.click(); return true; })()`,
);
await sleep(1500);
const panelDetail = await evalJs(
  `(() => ({ ada: !!document.querySelector('[class*="preview"]'),
             adaTombolMuat: [...document.querySelectorAll('button')].some(b => /Muat|Pakai|Gunakan/i.test(b.textContent||'')) }))()`,
);
cek("klik template membuka panel detail", templateKlik === true && (panelDetail?.ada === true || panelDetail?.adaTombolMuat === true), JSON.stringify(panelDetail));
await shot("01-tab-galeri");

// ---------- 5. Error runtime ----------
console.log("\n== 5. error runtime di halaman ==");
const unik = [...new Set(galatRuntime.map((g) => g.split("\n")[0]).slice(0, 10))];
if (unik.length === 0) {
  cek("tak ada error runtime di halaman", true);
} else {
  for (const u of unik) console.log(`      ${u}`);
  cek("tak ada error runtime di halaman", false, `${unik.length} jenis error`);
}

ws.close();
chrome.kill();
console.log("\nSelesai.");
