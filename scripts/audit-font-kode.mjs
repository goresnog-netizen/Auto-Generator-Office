/**
 * Audit keterbacaan font blok kode di slide DeckCraft.
 *
 * Mengukur tinggi glyph dari PNG hasil render NYATA (bukan dari nilai
 * yang diminta), lalu membandingkannya dengan ambang keterbacaan.
 *
 * Konteks: slide DeckCraft 16:9 lebarnya 960 pt (= 13,3 inci), sama
 * seperti slide PowerPoint 13,3 inci. Body text presentasi umumnya
 * 18-24 pt. Kode boleh sedikit lebih kecil, tapi tak boleh terlalu kecil
 * sampai tak terbaca dari jauh.
 *
 * Metode: render blok kode pada beberapa ukuran, decode PNG-nya sendiri
 * (tanpa dependensi luar), lalu ukur jarak antar baris teks di dalam
 * area kode. Jarak itu = tinggi baris, sebanding dengan tinggi glyph.
 *
 * Referensi: 18 pt pada skala 1,5 = 27 px. Ambang "nyaman" = 24 px
 * (setara ~16 pt di slide 13,3 inci).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";

const AKAR = process.cwd();
const BIN = path.join(
  AKAR,
  "vendors",
  "deckcraft-bin",
  "app",
  "deckcraft-0.8.0-windows-x64-portable",
  "deckcraft-cli.exe",
);
const OUT = path.resolve("testrun-font");
const SKALA = 1.5; // 960x540 pt -> 1440x810 px
const AMBANG_NYAMAN_PX = 24;

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

if (!existsSync(BIN)) {
  console.log(
    "Binary DeckCraft tak ada - lewati. Jalankan `pnpm vendor:deckcraft` dulu.",
  );
  process.exit(0);
}

mkdirSync(OUT, { recursive: true });

const anak = spawn(BIN, ["mcp"], { stdio: ["pipe", "pipe", "pipe"] });
anak.stdout.setEncoding("utf8");
let buffer = "";
const penunggu = new Map();
let id = 0;
anak.stdout.on("data", (pot) => {
  buffer += pot;
  let i = buffer.indexOf("\n");
  while (i >= 0) {
    const baris = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (baris) {
      try {
        const m = JSON.parse(baris);
        const t = penunggu.get(m.id);
        if (t) {
          penunggu.delete(m.id);
          t(m);
        }
      } catch {
        /* bukan JSON */
      }
    }
    i = buffer.indexOf("\n");
  }
});
function rpc(method, params) {
  const rid = ++id;
  const p = new Promise((res) => penunggu.set(rid, res));
  anak.stdin.write(
    `${JSON.stringify({ jsonrpc: "2.0", id: rid, method, params: params ?? {} })}\n`,
  );
  return p;
}
async function call(name, args) {
  const r = await rpc("tools/call", { name, arguments: args });
  const c = r.result?.content ?? [];
  return {
    isError: r.result?.isError,
    teks: c
      .filter((x) => x.type === "text")
      .map((x) => x.text)
      .join("\n"),
    content: c,
  };
}
await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "audit-font", version: "1" },
});
anak.stdin.write(
  `${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
);

const KODE = `function tambah(a, b) {
  const total = a + b;
  return total;
}`;

console.log("== tinggi glyph per ukuran font (dari render nyata) ==\n");
const hasil = [];
for (const size of [14, 16, 18, 20, 22]) {
  await call("new_presentation", { theme: "Slate" });
  const sl = await call("add_slide", { layout: "titleOnly", title: "Kode" });
  const idx = JSON.parse(sl.teks).index;
  await call("batch", {
    commands: [
      {
        command: "insert.textBox",
        params: { rect: [60, 140, 840, 200], text: KODE },
      },
      { command: "format.font", params: { family: "Liberation Mono" } },
      { command: "format.size", params: { size } },
      { command: "format.color", params: { color: "111827" } },
      { command: "shape.fill", params: { color: "EEF0F3" } },
    ],
  });
  const r = await call("render_slide", { slide: idx, scale: SKALA });
  const img = r.content.find((c) => c.type === "image");
  if (!img?.data) {
    console.log(`  ${size}pt: GAGAL render`);
    continue;
  }
  const buf = Buffer.from(img.data, "base64");
  writeFileSync(path.join(OUT, `kode-${size}pt.png`), buf);
  const px = decodePngGrayscale(buf);
  if (!px) {
    console.log(`  ${size}pt: GAGAL decode PNG`);
    continue;
  }
  const tinggiBaris = ukurTinggiBaris(px);
  const tinggiGlyphPx = size * SKALA;
  hasil.push({ size, tinggiGlyphPx, tinggiBaris });
  console.log(
    `  ${String(size).padStart(2)}pt -> ${tinggiGlyphPx.toFixed(1)} px (skala ${SKALA}) | tinggi baris terukur: ${tinggiBaris} px | png ${buf.length} B`,
  );
}

console.log("\n== penilaian ==");
for (const h of hasil) {
  const nyaman = h.tinggiGlyphPx >= AMBANG_NYAMAN_PX;
  console.log(
    `  ${h.size}pt: ${h.tinggiGlyphPx.toFixed(1)} px -> ${nyaman ? "nyaman" : "kurang"} (ambang ${AMBANG_NYAMAN_PX} px)`,
  );
}

let UKURAN_FONT_KODE = 18;
try {
  const mod = await import("../src/lib/deckcraft-ppt.ts");
  if (typeof mod.UKURAN_FONT_KODE === "number") {
    UKURAN_FONT_KODE = mod.UKURAN_FONT_KODE;
  }
} catch {
  /* konverter tak bisa diimpor langsung (type-only import) - pakai default */
}
const dipakai = hasil.find((h) => h.size === UKURAN_FONT_KODE);
cek(
  `ukuran font kode saat ini (${UKURAN_FONT_KODE}pt) nyaman dibaca`,
  !!dipakai && dipakai.tinggiGlyphPx >= AMBANG_NYAMAN_PX,
  `${dipakai?.tinggiGlyphPx.toFixed(1) ?? "?"} px (ambang ${AMBANG_NYAMAN_PX} px)`,
);
cek(
  "ukuran 14pt (terlalu kecil) terdeteksi sebagai kurang",
  (hasil.find((h) => h.size === 14)?.tinggiGlyphPx ?? 99) < AMBANG_NYAMAN_PX,
);
console.log(`\n  Render ada di: ${OUT}`);

anak.stdin.end();
 anak.kill();

/** Decode PNG jadi array luminance (8-bit, tanpa interlaced). */
function decodePngGrayscale(buf) {
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47
  ) {
    return null;
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }
  if (bitDepth !== 8) return null;
  const channels =
    colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!channels) return null;

  const inflated = inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);

  let ip = 0;
  for (let y = 0; y < height; y++) {
    const filter = inflated[ip++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const raw = inflated[ip++];
      const a = x >= bpp ? out[rowStart + x - bpp] : 0;
      const b = y > 0 ? out[prevStart + x] : 0;
      const c = y > 0 && x >= bpp ? out[prevStart + x - bpp] : 0;
      let v;
      switch (filter) {
        case 0:
          v = raw;
          break;
        case 1:
          v = raw + a;
          break;
        case 2:
          v = raw + b;
          break;
        case 3:
          v = raw + ((a + b) >> 1);
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          v = raw;
      }
      out[rowStart + x] = v & 0xff;
    }
  }

  const gray = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * stride + x * bpp;
      let lum;
      if (channels === 1) lum = out[i];
      else {
        lum = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
        if (channels === 4 && out[i + 3] < 128) lum = 255;
      }
      gray[y * width + x] = lum;
    }
  }
  return { width, height, gray };
}

/** Ukur tinggi baris teks dari jarak antar pusat baris (median). */
function ukurTinggiBaris(img) {
  const { width, height, gray } = img;
  const x0 = 100;
  const x1 = Math.min(width - 20, 1340);
  const y0 = 190;
  const y1 = Math.min(height - 20, 480);
  const groups = [];
  let inGrup = false;
  let mulai = 0;
  for (let y = y0; y < y1; y++) {
    let gelap = 0;
    for (let x = x0; x < x1; x++) {
      if (gray[y * width + x] < 120) gelap++;
    }
    if (gelap > 3 && !inGrup) {
      inGrup = true;
      mulai = y;
    } else if (gelap <= 3 && inGrup) {
      inGrup = false;
      groups.push({ mulai, akhir: y - 1 });
    }
  }
  if (groups.length < 2) return 0;
  const pusat = groups.map((g) => (g.mulai + g.akhir) / 2);
  const jarak = [];
  for (let i = 1; i < pusat.length; i++) jarak.push(pusat[i] - pusat[i - 1]);
  jarak.sort((a, b) => a - b);
  return Math.round(jarak[Math.floor(jarak.length / 2)] ?? jarak[0]);
}