/**
 * Verifikasi UI Auto-Generate.
 *
 * Karena butuh API key LLM, respons provider di-mock di level `fetch`:
 *request ke host AI dikembalikan dengan JSON blok yang sudah jadi.
 * Dengan begitu alur lengkap (prompt → parse → kanvas terisi) bisa diuji
 * tanpa memanggil layanan apa pun.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9339;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-ag"),
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function cariTarget() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page");
      if (p?.webSocketDebuggerUrl) return p.webSocketDebuggerUrl;
    } catch { /* belum siap */ }
    await sleep(500);
  }
  throw new Error("CDP tidak siap");
}

const ws = new WebSocket(await cariTarget());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let msgId = 0;
const pending = new Map();
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const kirim = (method, params = {}) => new Promise((res) => {
  const id = ++msgId; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
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

await kirim("Page.enable");
await kirim("Runtime.enable");

// --- Pasang mock fetch SEBELUM halaman dimuat ---
await kirim("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (() => {
      const ASLI = window.fetch;
      window.__agCalls = [];
      window.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        // Panggil API DeckCraft & resource lokal apa adanya.
        if (url.startsWith('/api/') || url.startsWith('http://127.0.0.1:5180/')) {
          return ASLI(input, init);
        }
        // Panggilan ke provider AI → balas JSON blok.
        if (/openai|anthropic|google|groq|generativelanguage|localhost:5999/.test(url)) {
          window.__agCalls.push({ url, body: init && init.body });
          const blok = [
            { type: 'heading', level: 1, text: 'Proposal Transformasi Digital' },
            { type: 'paragraph', text: 'Dokumen dihasilkan dari satu prompt oleh auto-generate.' },
            { type: 'heading', level: 2, text: 'Latar Belakang' },
            { type: 'list', ordered: false, items: [
              { text: 'Proses manual masih dominan' },
              { text: 'Data tersebar di banyak sistem' },
            ]},
            { type: 'heading', level: 2, text: 'Anggaran' },
            { type: 'table', headers: ['Komponen', 'Biaya'], rows: [
              ['Infrastruktur', '1.200'],
              ['Pelatihan', '350'],
            ]},
            { type: 'heading', level: 2, text: 'Tren Realisasi' },
            { type: 'chart', chartType: 'bar', labels: ['Q1','Q2','Q3','Q4'],
              series: [{ name: 'Realisasi', values: [40, 65, 80, 95] }] },
            { type: 'heading', level: 2, text: 'Alur Pelaksanaan' },
            { type: 'diagram', source: 'flowchart LR\\n A[Audit] --> B[Perbaikan]\\n B --> C[Evaluasi]' },
            { type: 'blok_asing', text: 'harus dibuang' }
          ];
          const payload = JSON.stringify({ blocks: blok });
          return new Response(JSON.stringify({
            choices: [{ message: { content: payload } }],
            content: [{ type: 'text', text: payload }],
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return ASLI(input, init);
      };
    })();
  `,
});

await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await evalJs(`!!document.querySelector('.ag-panel')`)) === true) break;
}
await sleep(1500);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Panel ada.
const ada = await evalJs(`!!document.querySelector('.ag-panel')`);
cek("panel Auto-Generate ada di DOM", ada === true);

// 2. Isi prompt.
const diisi = await evalJs(`
  (() => {
    const ta = document.querySelector('.ag-panel textarea');
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(ta, 'Buat proposal transformasi digital untuk instansi pemerintah.');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
cek("prompt bisa diisi", diisi === true);
await sleep(400);

// 3. Simpan kunci API palsu ke localStorage, lalu muat ulang supaya
//    komponen membacanya.
await evalJs(`
  localStorage.setItem('nitz909-ai', JSON.stringify({
    kunci: { openai: 'kunci-uji-bukan-asli' },
    endpoint: ''
  }));
  true
`);
await kirim("Page.reload", { ignoreCache: true });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await evalJs(`!!document.querySelector('.ag-panel')`)) === true) break;
}
await sleep(1500);

await evalJs(`
  (() => {
    const ta = document.querySelector('.ag-panel textarea');
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(ta, 'Buat proposal transformasi digital untuk instansi pemerintah.');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()
`);
await sleep(400);

// 4. Klik "Susun Dokumen".
const diklik = await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll('.ag-panel button')]
      .find(b => b.textContent.includes('Susun Dokumen'));
    if (!btn) return false;
    btn.click();
    return true;
  })()
`);
cek("tombol 'Susun Dokumen' diklik", diklik === true);
await sleep(7000);

// 5. Hasil: prompt AI terpanggil.
const panggilan = await evalJs(`(window.__agCalls || []).length`);
cek("provider AI dipanggil", panggilan > 0, `${panggilan} panggilan`);

// 6. Pesan sukses & kanvas terisi.
const pesan = await evalJs(
  `(document.querySelector('.ag-pesan')?.textContent || '').trim()`,
);
cek("pesan sukses tampil", /Selesai/.test(pesan), pesan);

const galat = await evalJs(
  `(document.querySelector('.ag-galat')?.textContent || '').trim()`,
);
cek("tidak ada pesan galat", galat === "", galat);

// 7. Kanvas terisi: cek jumlah blok di editor.
const blokDiKanvas = await evalJs(`
  (() => {
    const panel = document.querySelector('.ag-panel');
    if (!panel) return -1;
    // Blok hasilgenerate mengisi kanvas; hitung elemen blok di editor.
    const editor = document.querySelector('[data-block-id]');
    return document.querySelectorAll('[data-block-id]').length;
  })()
`);
cek("kanvas terisi blok hasil generate", blokDiKanvas > 0, `${blokDiKanvas} blok`);

// 8. Statistik di pesan mencerminkan isi (tabel/grafik/diagram).
cek("statistik menyebut tabel/grafik/diagram",
  /tabel/.test(pesan) && /grafik/.test(pesan) && /diagram/.test(pesan), pesan);

// 9. Blok cacat dibuang: mock mengirim 11 blok (1 di antaranya tipe asing),
//    jadi 10 yang valid. Pesan harus menyebut 10 blok + 1 dibuang.
const total = Number((pesan.match(/(\d+) blok/) || [])[1] ?? 0);
const dibuang = Number((pesan.match(/(\d+) blok cacat dibuang/) || [])[1] ?? 0);
cek("blok cacat dibuang (10 valid dari 11 input)", total === 10 && dibuang === 1,
  `total=${total} dibuang=${dibuang}`);

// Screenshot.
const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve("ui-auto-generate.png"), Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
console.log("\nSelesai.");
