/**
 * Verifikasi generator PDF bisa MENYEMBAM gambar sungguhan.
 *
 * Yang diperiksa:
 *  1. PDF yang berisi blok gambar PNG menghasilkan berkas valid.
 *  2. Berkas PDF memuat objek gambar (XObject / subtype Image) — bukti
 *     gambar benar-benar tertanam, bukan cuma placeholder teks.
 *  3. Jumlah halaman tetap konsisten (gambar tak memicu halaman kosong).
 *  4. Gambar tak bisa dibaca (SVG / file hilang) → jatuh ke keterangan teks,
 *     bukan crash.
 *
 * PNG dibuat on-the-fly tanpa dependency: tulis header PNG minimal yang
 * valid supaya bisa dipakai sebagai fixture.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const AKAR = process.cwd();

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

function cariEsbuild() {
  const candidates = ["esbuild"];
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("esbuild@")) {
        candidates.push(
          path.join(store, d, "node_modules", "esbuild", "lib", "main.js"),
        );
      }
    }
  }
  for (const c of candidates) {
    try {
      return require(c);
    } catch {
      /* coba berikutnya */
    }
  }
  throw new Error("esbuild tidak ditemukan.");
}

const esbuild = cariEsbuild();

/**
 * Buat PNG valid berwarna solid.
 *
 * Chunk PNG: signature 8 byte + IHDR + IDAT (zlib) + IEND, tiap chunk
 * punya panjang(4) + tipe(4) + data + crc(4).
 */
function buatPng(lebar, tinggi, [r, g, b]) {
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipe, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(tipe, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lebar, 0);
  ihdr.writeUInt32BE(tinggi, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Baris mentah: tiap baris = 1 byte filter (0) + lebar*3 byte piksel.
  const baris = [];
  for (let y = 0; y < tinggi; y++) {
    const row = Buffer.alloc(1 + lebar * 3);
    for (let x = 0; x < lebar; x++) {
      row[1 + x * 3] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    baris.push(row);
  }
  const idat = deflateSync(Buffer.concat(baris));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Bundle generator PDF + jalankan dengan blok yang diberikan. */
async function jalankanPdf(blocks, target) {
  const dir = mkdtempSync(path.join(tmpdir(), "nitz-pdfimg-"));
  try {
    const entry = path.join(dir, "entry.ts");
    writeFileSync(
      entry,
      `import { PDFGenerator } from ${JSON.stringify(
        path.join(AKAR, "src/generators/pdf.ts").replace(/\\/g, "/"),
      )};
const gen = new PDFGenerator({ outputPath: ${JSON.stringify(target)} });
const hasil = await gen.generate(
  { type: "pdf", title: "Uji Gambar", metadata: { author: "Uji" } },
  { blocks: ${JSON.stringify(blocks)} },
);
console.log("__RESULT__" + JSON.stringify({
  success: hasil.success,
  error: hasil.error ?? null,
}));
`,
      "utf8",
    );
    const bundle = path.join(
      AKAR,
      "node_modules",
      ".cache",
      "nitz-gen",
      "bundle-pdf-gambar.mjs",
    );
    mkdirSync(path.dirname(bundle), { recursive: true });
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node22",
      outfile: bundle,
      external: ["pdfkit"],
      logLevel: "silent",
    });
    const keluar = execFileSync(process.execPath, [bundle], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: AKAR,
    });
    const baris = keluar.split("\n").find((b) => b.startsWith("__RESULT__"));
    if (!baris) throw new Error(`tidak ada hasil: ${keluar.slice(0, 300)}`);
    return JSON.parse(baris.slice("__RESULT__".length));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const dir = mkdtempSync(path.join(tmpdir(), "nitz-pdfimg-"));
try {
  // --- Kasus 1: PNG valid (file lokal) ---
  const pngPath = path.join(dir, "gambar.png");
  const png = buatPng(64, 48, [220, 40, 40]);
  writeFileSync(pngPath, png);
  cek("fixture PNG valid dibuat", png.subarray(1, 4).toString("ascii") === "PNG");

  const target = path.join(dir, "uji-gambar.pdf");
  const hasil = await jalankanPdf(
    [
      { id: "h1", type: "heading", level: 1, text: "Laporan Bergambar" },
      {
        id: "i1",
        type: "image",
        src: pngPath,
        alt: "Gambar uji",
        caption: "Gambar uji 64x48",
      },
      { id: "p1", type: "paragraph", text: "Paragraf setelah gambar." },
    ],
    target,
  );
  cek("pdf: generate() sukses", hasil.success === true, hasil.error ?? "");
  cek("pdf: berkas .pdf ada", existsSync(target));

  const isi = readFileSync(target).toString("latin1");
  cek("pdf: header %PDF valid", isi.startsWith("%PDF"));

  // Bukti gambar tertanam: PDFKit menulis gambar sebagai XObject dengan
  // /Subtype /Image.
  const jumlahGambar = (isi.match(/\/Subtype\s*\/Image/g) || []).length;
  cek(
    "pdf: gambar benar-benar tertanam (XObject /Subtype /Image)",
    jumlahGambar > 0,
    `${jumlahGambar} XObject gambar`,
  );

  // PNG harus muncul sebagai /FlateDecode stream dengan /DeviceRGB.
  cek(
    "pdf: stream gambar memakai /DeviceRGB",
    isi.includes("/DeviceRGB"),
    isi.includes("/DeviceRGB") ? "" : "warna tak ditemukan",
  );

  const ukuran = statSync(target).size;
  cek("pdf: ukuran > 2 KB (gambar menambah isi)", ukuran > 2048, `${ukuran} byte`);

  // Halaman harus tetap konsisten: gambar tak boleh menambah halaman kosong.
  const jumlahHalaman = (isi.match(/\/Type\s*\/Page[^s]/g) || []).length;
  cek("pdf: jumlah halaman wajar (2)", jumlahHalaman === 2, `${jumlahHalaman} halaman`);

  // --- Kasus 2: SVG (tak didukung pdfkit) → keterangan, bukan crash ---
  const svgPath = path.join(dir, "gambar.svg");
  writeFileSync(svgPath, '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', "utf8");
  const target2 = path.join(dir, "uji-svg.pdf");
  const hasil2 = await jalankanPdf(
    [
      {
        id: "i1",
        type: "image",
        src: svgPath,
        alt: "Gambar SVG",
      },
    ],
    target2,
  );
  cek("pdf: SVG tak memicu kegagalan", hasil2.success === true, hasil2.error ?? "");
  cek("pdf: berkas SVG-tak-dukungan tetap dibuat", existsSync(target2));

  // --- Kasus 3: file hilang → keterangan, bukan crash ---
  const target3 = path.join(dir, "uji-hilang.pdf");
  const hasil3 = await jalankanPdf(
    [
      {
        id: "i1",
        type: "image",
        src: path.join(dir, "tidak-ada.png"),
        alt: "Hilang",
      },
    ],
    target3,
  );
  cek("pdf: gambar hilang tak memicu kegagalan", hasil3.success === true, hasil3.error ?? "");
  cek("pdf: berkas untuk gambar hilang tetap dibuat", existsSync(target3));

  // --- Kasus 4: data URL base64 (format kanvas browser) ---
  const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
  const target4 = path.join(dir, "uji-dataurl.pdf");
  const hasil4 = await jalankanPdf(
    [
      {
        id: "i1",
        type: "image",
        src: dataUrl,
        alt: "Data URL",
      },
    ],
    target4,
  );
  cek("pdf: data URL base64 sukses", hasil4.success === true, hasil4.error ?? "");
  const isi4 = readFileSync(target4).toString("latin1");
  cek(
    "pdf: data URL menghasilkan gambar tertanam",
    (isi4.match(/\/Subtype\s*\/Image/g) || []).length > 0,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("\nSelesai.");
