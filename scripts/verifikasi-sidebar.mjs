/**
 * Audit: pastikan panel DeckCraft Studio berada di sidebar Ekspor yang
 * terlihat, dan tombolnya bisa diklik (tidak tertutup elemen lain).
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9335;

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-audit"),
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
await sleep(6000);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Panel berada di dalam sidebar Ekspor (aside terakhir).
const posisi = await evalJs(`
  (() => {
    const st = document.querySelector('.dc-studio');
    if (!st) return null;
    const aside = st.closest('aside');
    const r = st.getBoundingClientRect();
    const kotakAside = aside ? aside.getBoundingClientRect() : null;
    const tombol = [...st.querySelectorAll('button')].find(b => b.textContent.includes('Bangun Deck'));
    const rt = tombol ? tombol.getBoundingClientRect() : null;
    const diTengah = rt ? (document.elementFromPoint(rt.x + rt.width/2, rt.y + rt.height/2) || {}) : null;
    return {
      diAside: !!aside,
      judulAside: aside ? (aside.querySelector('h3')?.textContent || '').trim() : '',
     Lebar: Math.round(r.width),
      tinggi: Math.round(r.height),
      tombolTersedia: !!tombol,
      tombolTampak: rt ? (rt.width > 0 && rt.height > 0) : false,
      tombolTertutup: diTengah ? !tombol.contains(diTengah) && diTengah !== tombol : false,
      dalamLayar: rt ? (rt.top >= 0 && rt.bottom <= window.innerHeight) : false,
    };
  })()
`);
cek("panel ada di dalam <aside>", posisi?.diAside === true);
cek("aside adalah panel Ekspor", /Ekspor/.test(posisi?.judulAside || ""), posisi?.judulAside);
cek("panel punya lebar nyata", (posisi?.Lebar || 0) > 150, `${posisi?.Lebar}px`);
cek("tombol 'Bangun Deck' ada", posisi?.tombolTersedia === true);
cek("tombol tidak tertutup elemen lain", posisi?.tombolTertutup === false);
cek("tombol berada di dalam layar", posisi?.dalamLayar === true);

// 2. Tema terang/gelap keduanya harus punya gaya kaca (backdrop-filter).
const gaya = await evalJs(`
  (() => {
    const st = document.querySelector('.dc-studio');
    const kartu = st?.closest('.dc-kartu') || st?.parentElement;
    const cs = kartu ? getComputedStyle(kartu) : null;
    return cs ? {
      backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
      radius: cs.borderRadius,
      border: cs.borderTopWidth,
    } : null;
  })()
`);
cek("kaca aktif (backdrop-filter)", /blur/.test(gaya?.backdrop || ""), gaya?.backdrop);

// 3. Latar aplikasi punya mesh gradien (bukan warna datar).
const latar = await evalJs(`
  (() => {
    const r = document.querySelector('.nitz-app-root');
    const cs = r ? getComputedStyle(r) : null;
    return cs ? { image: cs.backgroundImage, size: cs.backgroundSize } : null;
  })()
`);
cek("latar memakai gradient mesh", (latar?.image || "").includes("radial-gradient"));

// 4. Screenshot bukti.
const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(path.resolve("ui-audit.png"), Buffer.from(shot.result.data, "base64"));

ws.close();
chrome.kill();
console.log("\nSelesai.");
