/**
 * Capture UI dalam tema terang (dan opsional tema lain) dengan Chrome DevTools.
 * Tema NitZ-909 disimpan di localStorage; setel sebelum halaman dimuat.
 */
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://127.0.0.1:5180/";
const PORT = 9334;
const TEMA = process.env.TEMA || "light";
const OUT = path.resolve(process.env.OUT || `ui-tema-${TEMA}.png`);

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--window-size=1600,1100",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=" + path.resolve("vendors/deckcraft-bin/chrome-profile-tema"),
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
      /* belum siap */
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
const kirim = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++msgId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
const evalJs = async (expr) => {
  const r = await kirim("Runtime.evaluate", {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  });
  return r.result?.result?.value;
};

await kirim("Page.enable");
await kirim("Runtime.enable");

// Muat halaman sekali supaya origin ter-set, lalu tulis tema ke localStorage.
await kirim("Page.navigate", { url: URL });
await sleep(5000);
await evalJs(`localStorage.setItem('nitz909-theme', '${TEMA}'); true`);
await kirim("Page.reload", { ignoreCache: true });
await sleep(7000);

const temaAktif = await evalJs(
  `document.documentElement.getAttribute('data-theme')`,
);
console.log(`Tema aktif: ${temaAktif}`);

const shot = await kirim("Page.captureScreenshot", { format: "png" });
writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
console.log(`Screenshot → ${OUT}`);

ws.close();
chrome.kill();
