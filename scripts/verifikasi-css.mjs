/**
 * Audit CSS: selector mati + painting order + fallback tanpa backdrop-filter.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9337;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-css"),
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
  const r = await kirim("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text ?? "eval gagal");
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await evalJs(`!!document.querySelector('.nitz-app-root') && document.querySelectorAll('*').length > 100`)) === true) break;
}
await sleep(1500);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Selektor CSS di glass.css yang tidak match apa pun → dead CSS.
//    Tunggu stylesheet benar-benar termuat: Vite menyuntik <style> saat
//    modul CSS diimpor, jadi harus lewat hook React.
let cssSiap = false;
for (let i = 0; i < 40; i++) {
  await sleep(400);
  const n = await evalJs(`(() => {
    let c = 0;
    for (const s of [...document.styleSheets]) {
      try { for (const r of s.cssRules) if (r.selectorText) c++; } catch {}
    }
    return c;
  })()`);
  if (typeof n === "number" && n > 50) { cssSiap = true; break; }
}
if (!cssSiap) {
  console.log("[GAGAL] stylesheet tidak termuat.");
  ws.close();
  chrome.kill();
  process.exit(1);
}

// 1. Selektor CSS di glass.css yang tidak match apa pun → dead CSS.
//    Bangun deck dulu supaya elemen .dc-* benar-benar ada di DOM.
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll('.dc-studio button')]
      .find(b => b.textContent.includes('Bangun Deck'));
    if (btn) btn.click();
    return true;
  })()
`);
await sleep(9000);

const mati = await evalJs(`
  (() => {
    // Ambil seluruh rules dari stylesheet yang memuat 'glass' / mesh.
    const sheets = [...document.styleSheets];
    const rules = [];
    const walk = (list) => {
      for (const r of list) {
        // CSSStyleRule.cssRules adalah daftar kosong (truthy) di Chrome,
        // jadi selectorText harus dicek LEBIH DAHULU.
        if (r.selectorText) rules.push(r.selectorText);
        else if (r.cssRules) walk(r.cssRules);
      }
    };
    for (const s of sheets) {
      try { walk(s.cssRules); } catch { /* cross-origin */ }
    }
    const hidup = [];
    const mati = [];
    for (const sel of rules) {
      // Hanya selektor yang relevan dengan lapisan kaca.
      if (!/kaca|glass|nitz-isi|nitz-side|dc-|kartu-template|dash-card|stat-kotak|segmen|nitz-app-root|role=.dialog/.test(sel)) continue;
      // Selector majemuk: match bila salah satu komponennya ada.
      const bagian = sel.split(',').map(s => s.trim());
      const ada = bagian.some(b => {
        // Buang pseudo-class & pseudo-element: hanya match saat hover/focus,
        // jadi tidak bisa diuji lewat querySelector.
        const bersih = b
          .replace(/::?[a-z-]+(\\([^)]*\\))?/g, '')
          .replace(/\\[[^\\]]*\\]/g, '')
          .trim();
        if (!bersih) return false;
        try { return document.querySelector(bersih) !== null; }
        catch { return false; }
      });
      (ada ? hidup : mati).push(sel);
    }
    return { hidup, mati, total: rules.length };
  })()
`);
console.log(`      total rule CSS: ${mati?.total}, selektor kaca: ${mati?.hidup?.length + mati?.mati?.length}`);
for (const s of mati?.mati ?? []) console.log(`      [kondisi-langka] ${s}`);
// Selektor yang hanya muncul pada kondisi tertentu (dialog, error, loading)
// tidak bisa diuji di state default — itu bukan dead CSS.
const kondisiLangka = [
  ".glass, .glass-strong, .glass-subtle",
  ".glass",
  ".glass-strong",
  ".glass-subtle",
  '[role="dialog"]',
  ".dc-pita-galat",
  ".dc-pesan-galat",
  ".dc-kosong",
  ".dc-galat-detail",
  ".dc-gambar-kosong",
  // Selektor di dalam panel "DeckCraft tidak tersedia" — hanya muncul
  // bila binary/API DeckCraft absen, bukan pada state default.
  ".dc-kosong p",
  ".dc-kosong code",
  ".dc-catatan",
  ".nitz-isi > .kartu-kaca, .nitz-isi > div > .kartu-kaca",
];
const benarMati = (mati?.mati ?? []).filter((s) => !kondisiLangka.includes(s));
for (const s of benarMati) console.log(`      [DEAD] ${s}`);
cek("tidak ada selektor kaca yang benar-benar mati", benarMati.length === 0,
  `${benarMati.length} mati`);

// 2. Painting order: apakah ::before .nitz-isi menutupi isi?
const order = await evalJs(`
  (() => {
    const isi = document.querySelector('.nitz-isi');
    if (!isi) return null;
    const anak = isi.querySelector('*');
    if (!anak) return null;
    // Elemen yang benar-benar terkena pointer di tengah area konten.
    const r = isi.getBoundingClientRect();
    const tengah = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    const sebelum = getComputedStyle(isi, '::before');
    return {
      zBefore: sebelum.zIndex,
      pointerBefore: sebelum.pointerEvents,
      anakZ: getComputedStyle(anak).zIndex,
      elemenTengah: tengah ? (tengah.className || tengah.tagName) : null,
      isiTembus: tengah === null || isi.contains(tengah),
    };
  })()
`);
cek("pseudo-lapis .nitz-isi tidak menutupi konten",
  order?.isiTembus === true, `elemen tengah: ${order?.elemenTengah}`);

// 3. Fallback: tanpa backdrop-filter, apakah teks masih di atas latar?
const fallback = await evalJs(`
  (() => {
    // Matikan semua backdrop-filter, lalu ukur latar efektif & kontras.
    const s = document.createElement('style');
    s.id = 'matikan-blur';
    s.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
    document.head.appendChild(s);
    const lum = (rgb) => {
      const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
    };
    const parse = (x) => (x.match(/[\\\\d.]+/g)||[]).slice(0,3).map(Number);
    const rasio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };
    const ukur = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      let lat = 'rgb(0,0,0)';
      let n = el;
      while (n) { const c = getComputedStyle(n).backgroundColor;
        if (c && !c.includes('rgba(0, 0, 0, 0)')) { lat = c; break; } n = n.parentElement; }
      const rgb = (x) => (x.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
      return { sel, r: rasio(rgb(cs.color), rgb(lat)) };
    };
    const out = ['.dc-pesan','.dc-item-slide','.nitz-side','.dc-pita'].map(ukur).filter(Boolean);
    s.remove();
    return out;
  })()
`);
for (const k of fallback ?? []) {
  const nilai = typeof k.r === "number" ? k.r : NaN;
  const ok = Number.isFinite(nilai) && nilai >= 4.5;
  console.log(`[${ok ? "OK  " : "GAGAL"}] fallback tanpa blur: kontras ${k.sel} = ${Number.isFinite(nilai) ? nilai.toFixed(2) : "?"}:1`);
  if (!ok) process.exitCode = 1;
}

// 4. Tombol hover transform — apakah merusak layout grid/scroll?
const transform = await evalJs(`
  (() => {
    const stat = document.querySelector('.dash-card');
    const kartu = document.querySelector('.kartu-template');
    const header = document.querySelector('.nitz-header');
    return {
      statPosition: stat ? getComputedStyle(stat).position : null,
      kartuPosition: kartu ? getComputedStyle(kartu).position : null,
      headerPosition: header ? getComputedStyle(header).position : null,
    };
  })()
`);
console.log("      posisi:", JSON.stringify(transform));
cek("header tetap sticky (transform tidak merusaknya)",
  transform?.headerPosition === "sticky", transform?.headerPosition);

const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve("ui-audit-css.png"), Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
console.log("\nSelesai.");
