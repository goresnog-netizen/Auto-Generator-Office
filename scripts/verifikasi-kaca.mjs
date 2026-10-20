/**
 * Verifikasi empiris efek kaca: apakah noise overlay benar-benar ter-render,
 * apakah backdrop-filter aktif, dan apakah kontras teks cukup.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9336;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-kaca"),
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
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Runtime.enable");
await kirim("Page.navigate", { url: URL });

// Tunggu React benar-benar mount (elemen .nitz-app-root muncul).
let siap = false;
for (let i = 0; i < 40; i++) {
  await sleep(500);
  const cek = await evalJs(
    `!!document.querySelector('.nitz-app-root') && document.querySelectorAll('*').length > 100`,
  );
  if (cek === true) { siap = true; break; }
}
if (!siap) {
  console.log("[GAGAL] React tidak mount dalam 20 detik.");
  ws.close();
  chrome.kill();
  process.exit(1);
}
await sleep(1500);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Noise overlay: apakah ::before punya background-image dan benar-benar di-render?
const noise = await evalJs(`
  (() => {
    const root = document.querySelector('.nitz-app-root');
    if (!root) return null;
    const cs = getComputedStyle(root, '::before');
    return {
      content: cs.content,
      hasImage: cs.backgroundImage.includes('data:image/svg+xml'),
      zIndex: cs.zIndex,
      opacity: cs.opacity,
      mixBlend: cs.mixBlendMode,
      position: cs.position,
    };
  })()
`);
cek("noise overlay punya gambar SVG", noise?.hasImage === true);
cek("noise overlay positioned fixed", noise?.position === "fixed");
cek("noise overlay blend mode = overlay", noise?.mixBlend === "overlay", noise?.mixBlend);

// 2. Apakah noise benar-benar tampak? Bandingkan piksel sebelum/sesudah
//    dengan mematikan noise sementara.
const piksel = await evalJs(`
  (() => {
    const root = document.querySelector('.nitz-app-root');
    if (!root) return null;
    const s = document.createElement('style');
    s.id = 'matikan-noise';
    s.textContent = '.nitz-app-root::before { display: none !important; }';
    document.head.appendChild(s);
    return true;
  })()
`);
await sleep(400);
const tanpaNoise = await kirim("Page.captureScreenshot", {
  format: "png",
  clip: { x: 0, y: 0, width: 400, height: 200, scale: 1 },
});
writeFileSync(path.resolve("kaca-tanpa-noise.png"), Buffer.from(tanpaNoise.result.data, "base64"));

await evalJs(`document.getElementById('matikan-noise')?.remove(); true`);
await sleep(400);
const denganNoise = await kirim("Page.captureScreenshot", {
  format: "png",
  clip: { x: 0, y: 0, width: 400, height: 200, scale: 1 },
});
writeFileSync(path.resolve("kaca-dengan-noise.png"), Buffer.from(denganNoise.result.data, "base64"));

const a = Buffer.from(tanpaNoise.result.data, "base64");
const b = Buffer.from(denganNoise.result.data, "base64");
cek("noise overlay menghasilkan piksel berbeda", !a.equals(b),
  `${a.length} vs ${b.length} byte`);

// 3. Berapa banyak elemen yang memakai backdrop-filter? (biaya kompositing)
const jumlahBlur = await evalJs(`
  (() => {
    let n = 0;
    const total = document.querySelectorAll('*').length;
    for (const el of document.querySelectorAll('*')) {
      const cs = getComputedStyle(el);
      if ((cs.backdropFilter || cs.webkitBackdropFilter || '').includes('blur')) n++;
    }
    return { n, total };
  })()
`);
console.log(`      elemen dengan backdrop-filter: ${jumlahBlur.n} dari ${jumlahBlur.total}`);

// 4. Kontras teks muted kecil di panel DeckCraft.
//    Bangun deck dulu supaya elemen pratinjau & daftar slide benar-benar ada.
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll('.dc-studio button')]
      .find(b => b.textContent.includes('Bangun Deck'));
    if (btn) btn.click();
    return true;
  })()
`);
await sleep(9000);

const kontras = await evalJs(`
  (() => {
    const lum = (rgb) => {
      const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
      return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
    };
    const parse = (s) => (s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
    const rasio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05); };
    const ukur = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      let lat = 'rgba(0, 0, 0, 0)';
      let node = el;
      while (node) {
        const c = getComputedStyle(node).backgroundColor;
        if (c && !c.includes('rgba(0, 0, 0, 0)')) { lat = c; break; }
        node = node.parentElement;
      }
      return { sel, size: cs.fontSize, color: cs.color, lat, rasio: rasio(parse(cs.color), parse(lat)) };
    };
    return ['.dc-item-slide', '.dc-item-judul', '.dc-pesan', '.dc-pita', '.nitz-side']
      .map(ukur).filter(Boolean);
  })()
`);
for (const k of kontras ?? []) {
  const ok = k.rasio >= 4.5;
  console.log(`[${ok ? "OK  " : "PERIKSA"}] kontras ${k.sel} ${k.size} = ${k.rasio.toFixed(2)}:1 (teks ${k.color} / latar ${k.lat})`);
  if (!ok) process.exitCode = 1;
}

ws.close();
chrome.kill();
console.log("\nSelesai.");
