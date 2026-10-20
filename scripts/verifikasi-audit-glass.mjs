/**
 * Verifikasi audit Glassmorphism — mengukur kondisi NYATA di browser,
 * bukan membaca CSS.
 *
 * Menguji klaim:
 *  - F2: tombol segmented aktif kontrasnya turun drastis
 *  - F3: label kecil (dash-label, dc-item-slide) di bawah WCAG AA
 *  - F4: garis warna kategori hilang di kartu template
 *  - F7: hanya 1 dari 11 Card yang jadi kaca
 *  - F5: berapa elemen punya backdrop-filter
 *  - F9: kondisi tanpa dukungan backdrop-filter
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9340;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-audit2"),
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
await kirim("Page.navigate", { url: URL });
for (let i = 0; i < 40; i++) {
  await sleep(500);
  if ((await evalJs(`!!document.querySelector('.nitz-app-root') && document.querySelectorAll('*').length > 200`)) === true) break;
}
await sleep(2000);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
};

/**
 * Hitung kontras nyata: compositeSEMUA layer background ancestry
 * (yang opaque) lalu bandingkan dengan warna teks.
 * Ini lebih akurat daripada menebak: hasilnya sama dengan yang mata lihat.
 */
const helper = `
  (() => {
    const keRgb = (s) => {
      const m = (s || '').match(/[\\d.]+/g) || [];
      return { r: +m[0]||0, g: +m[1]||0, b: +m[2]||0, a: m[3]===undefined?1:+m[3] };
    };
    const campur = (atas, bawah) => ({
      r: atas.r*atas.a + bawah.r*(1-atas.a),
      g: atas.g*atas.a + bawah.g*(1-atas.a),
      b: atas.b*atas.a + bawah.b*(1-atas.a),
      a: 1,
    });
    const lum = (c) => {
      const f = (v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
      return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
    };
    const rasio = (a, b) => {
      const l1 = lum(a), l2 = lum(b);
      const hi = Math.max(l1,l2), lo = Math.min(l1,l2);
      return (hi+0.05)/(lo+0.05);
    };
    // Latar efektif: composite semua backgroundColor dari elemen ke root.
    const latarEfektif = (el) => {
      const rantai = [];
      let n = el;
      while (n && n.nodeType === 1) {
        const c = keRgb(getComputedStyle(n).backgroundColor);
        if (c.a > 0) rantai.push(c);
        n = n.parentElement;
      }
      let hasil = { r: 28, g: 29, b: 28, a: 1 };
      for (let i = rantai.length - 1; i >= 0; i--) {
        hasil = campur(rantai[i], hasil);
      }
      return hasil;
    };
    window.__ukur = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const bg = latarEfektif(el);
      const fg = keRgb(cs.color);
      return {
        sel,
        teks: cs.color,
        size: cs.fontSize,
        weight: cs.fontWeight,
        kontras: rasio(fg, bg),
        bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      };
    };
    return true;
  })()
`;
await evalJs(helper);

// ---- Bangun deck dulu agar elemen .dc-* ada ----
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll('.dc-studio button')]
      .find(b => b.textContent.includes('Bangun Deck'));
    if (btn) btn.click();
    return true;
  })()
`);
await sleep(9000);

console.log("=== F2: tombol segmented aktif ===");
for (const sel of [".segmen-dashboard button.aktif", ".segmen-tampilan button.aktif"]) {
  const k = await evalJs(`window.__ukur(${JSON.stringify(sel)})`);
  if (!k) { console.log(`  ${sel}: TIDAK ADA`); continue; }
  const ok = k.kontras >= 4.5;
  console.log(`  [${ok ? "OK  " : "GAGAL"}] ${sel} kontras=${k.kontras.toFixed(2)}:1 (${k.size}, ${k.teks} atas ${k.bg})`);
  if (!ok) process.exitCode = 1;
}

console.log("=== F3: label kecil ===");
for (const sel of [".dash-label", ".dc-item-slide", ".dc-pesan", ".dc-kosong", ".stat-label"]) {
  const k = await evalJs(`window.__ukur(${JSON.stringify(sel)})`);
  if (!k) { console.log(`  ${sel}: tidak ada`); continue; }
  const ok = k.kontras >= 4.5;
  console.log(`  [${ok ? "OK  " : "GAGAL"}] ${sel} kontras=${k.kontras.toFixed(2)}:1 (${k.size})`);
  if (!ok) process.exitCode = 1;
}

console.log("=== F4: garis warna kategori di kartu template ===");
const stripe = await evalJs(`
  (() => {
    const kartu = document.querySelector('.kartu-template');
    if (!kartu) return null;
    const cs = getComputedStyle(kartu);
    return {
      borderLeftWidth: cs.borderLeftWidth,
      borderLeftColor: cs.borderLeftColor,
      borderTopWidth: cs.borderTopWidth,
      inlineStyle: kartu.getAttribute('style') || '',
    };
  })()
`);
const inlinePunya4px = /borderLeft:\s*4px/.test(stripe?.inlineStyle || "");
console.log(`  inline style punya borderLeft 4px? ${inlinePunya4px}`);
console.log(`  computed border-left: ${stripe?.borderLeftWidth} ${stripe?.borderLeftColor}`);
if (inlinePunya4px) {
  const hilang = parseFloat(stripe.borderLeftWidth) < 3.5;
  console.log(`  [${hilang ? "GAGAL" : "OK  "}] garis kategori ${hilang ? "HILANG (direset glass)" : "utuh"}`);
  if (hilang) process.exitCode = 1;
}

console.log("=== F7: berapa Card yang jadi kaca ===");
const card = await evalJs(`
  (() => {
    const semua = [...document.querySelectorAll('.dc-kartu, .kartu-kaca')];
    const semuaCard = [...document.querySelectorAll('main ~ aside > div, aside > div')];
    return {
      kaca: semua.length,
      backdrop: semua.filter(e => {
        const cs = getComputedStyle(e);
        return (cs.backdropFilter || cs.webkitBackdropFilter || '').includes('blur');
      }).length,
    };
  })()
`);
console.log(`  elemen .dc-kartu/.kartu-kaca: ${card.kaca}, dengan blur: ${card.backdrop}`);

console.log("=== F5: berapa elemen punya backdrop-filter ===");
const blur = await evalJs(`
  (() => {
    let n = 0, total = 0;
    for (const el of document.querySelectorAll('*')) {
      total++;
      const cs = getComputedStyle(el);
      if ((cs.backdropFilter || cs.webkitBackdropFilter || '').includes('blur')) n++;
    }
    return { n, total };
  })()
`);
console.log(`  ${blur.n} dari ${blur.total} elemen (${((blur.n/blur.total)*100).toFixed(1)}%)`);

console.log("=== F9: kondisi tanpa dukungan backdrop-filter ===");
await evalJs(`
  (() => {
    const s = document.createElement('style');
    s.id = 'matikan-blur2';
    s.textContent = '*, *::before, *::after { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }';
    document.head.appendChild(s);
    return true;
  })()
`);
await sleep(500);
for (const sel of [".dc-pesan", ".dc-item-slide", ".dash-label"]) {
  const k = await evalJs(`window.__ukur(${JSON.stringify(sel)})`);
  if (!k) continue;
  const ok = k.kontras >= 4.5;
  console.log(`  [${ok ? "OK  " : "GAGAL"}] ${sel} kontras tanpa blur=${k.kontras.toFixed(2)}:1`);
  if (!ok) process.exitCode = 1;
}
await evalJs(`document.getElementById('matikan-blur2')?.remove(); true`);

console.log("=== Dead CSS: apakah selector yang tidak terpakai ada? ===");
const dead = await evalJs(`
  (() => {
    const cek = (s) => {
      try { return document.querySelector(s) !== null; } catch { return false; }
    };
    return {
      glass: cek('.glass'),
      glassStrong: cek('.glass-strong'),
      glassSubtle: cek('.glass-subtle'),
      kartuKaca: cek('.kartu-kaca'),
      nitzKainvas: cek('.nitz-kanvas'),
      kanvasEditor: cek('.kanvas-editor'),
      editorCanvas: cek('.editor-canvas'),
      templateCard1_5: cek('.kartu-template[style*="1.5px solid"]'),
    };
  })()
`);
for (const [k, v] of Object.entries(dead)) {
  console.log(`  ${k}: ${v ? "ADA (match)" : "TIDAK ADA (dead CSS)"}`);
}

const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve("ui-audit-glass.png"), Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
console.log("\nSelesai.");
