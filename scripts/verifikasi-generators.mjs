/**
 * Verifikasi semua generator Node: benar-benar menulis berkas yang valid.
 *
 * CATATAN TEKNIS: generator adalah TypeScript dengan import directory
 * (`../types/index.ts`) dan parameter property — dua hal yang tidak didukung
 * `node --experimental-strip-types`. Karena itu berkas TS di-bundle lebih dulu
 * dengan esbuild (sudah ada sebagai dependency vite), lalu hasilnya dijalankan
 * sebagai .mjs biasa.
 *
 * Yang diperiksa per generator:
 *  1. `generate()` sukses,
 *  2. berkas hasil ADA di disk & > 0 byte,
 *  3. isi berkasnya valid (ZIP untuk docx/xlsx/pptx, header %PDF untuk pdf).
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
import { inflateSync } from "node:zlib";
import { ekstrakZip } from "./zip-util.mjs";

const require = createRequire(import.meta.url);

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

const AKAR = process.cwd();

/** Cari esbuild: coba root dulu, lalu store pnpm. */
function cariEsbuild() {
  const candidates = ["esbuild"];
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("esbuild@")) {
        candidates.push(
          path.join(
            store,
            d,
            "node_modules",
            "esbuild",
            "lib",
            "main.js",
          ),
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
  throw new Error("esbuild tidak ditemukan — install vite (mem bringing esbuild).");
}

const esbuild = cariEsbuild();

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Uji" },
  { id: "p1", type: "paragraph", text: "Paragraf pengujian." },
  { id: "h2", type: "heading", level: 2, text: "Rincian" },
  {
    id: "l1",
    type: "list",
    ordered: false,
    items: [{ text: "Poin satu" }, { text: "Poin dua" }],
  },
  {
    id: "t1",
    type: "table",
    headers: ["Kolom A", "Kolom B"],
    rows: [
      ["nilai 1", "nilai 2"],
      ["nilai 3", "nilai 4"],
    ],
  },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;" },
  { id: "d1", type: "diagram", diagramType: "mermaid", source: "A --> B" },
];

const dir = mkdtempSync(path.join(tmpdir(), "nitz-gen-"));

/**
 * Bundle satu generator + panggil `generate()`-nya.
 * Mengembalikan hasil yang dikembalikan generator.
 */
async function jalankan(generatorPath, exportName, options, config, blocks) {
  const entry = path.join(dir, `entry-${exportName}.ts`);
  writeFileSync(
    entry,
    `import { ${exportName} } from ${JSON.stringify(
      path.join(AKAR, generatorPath).replace(/\\/g, "/"),
    )};
const gen = new ${exportName}(${JSON.stringify(options)});
const hasil = await gen.generate(
  { type: ${JSON.stringify(config.type)}, title: ${JSON.stringify(
      config.title,
    )}, metadata: { author: "Uji" } },
  { blocks: ${JSON.stringify(blocks)} },
);
console.log("__RESULT__" + JSON.stringify({
  success: hasil.success,
  error: hasil.error,
  outputPath: hasil.outputPath,
  hasBuffer: !!hasil.buffer,
  bytes: hasil.buffer ? hasil.buffer.length : 0,
}));
`,
    "utf8",
  );

  // Bundle HARUS diletakkan di dalam folder proyek: kalau di temp,
  // Node tak bisa me-resolve paket (`docx`, `exceljs`, ...) dari sana.
  const bundle = path.join(
    AKAR,
    "node_modules",
    ".cache",
    "nitz-gen",
    `bundle-${exportName}.mjs`,
  );
  mkdirSync(path.dirname(bundle), { recursive: true });
  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: bundle,
    external: ["pptxgenjs", "docx", "exceljs", "pdfkit", "mermaid"],
    logLevel: "silent",
  });

  let keluar;
  try {
    keluar = execFileSync(process.execPath, [bundle], {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      cwd: AKAR,
      timeout: 180_000,
    });
  } catch (e) {
    console.error(
      `GAGAL menjalankan ${exportName}:\n${e.stderr?.toString() ?? e.message}`,
    );
    throw e;
  }
  const baris = keluar.split("\n").find((b) => b.startsWith("__RESULT__"));
  if (!baris) {
    throw new Error(`tidak ada hasil dari ${exportName}: ${keluar.slice(0, 400)}`);
  }
  return JSON.parse(baris.slice("__RESULT__".length));
}

/**
 * Daftar path di dalam sebuah ZIP (setelah diekstrak).
 *
 * Ekstraksi memakai utilitas ZIP Node (scripts/zip-util.mjs), bukan
 * `Expand-Archive` PowerShell: path sementara yang mengandung spasi
 * atau path 8.3 (C:\Users\BROKEN~1\...) tak selalu bisa dibuka
 * PowerShell, dan pemanggilan powershell.exe menambah hundreds of ms
 * per berkas.
 */
function daftarIsiZip(zipPath) {
  const target = path.join(dir, "x-" + path.basename(zipPath));
  rmSync(target, { recursive: true, force: true });
  const hasil = ekstrakZip(zipPath, target);
  return { target, hasil };
}

/**
 * Ekstrak teks dari PDF.
 *
 * PDFKit menulis teks sebagai glyph hex (`<4a> 20 <7564…> TJ`) di dalam
 * content stream yang dikompresi Flate. Script ini.inflate stream-nya lalu
 * decode array TJ menjadi teks biasa, supaya isi dokumen bisa diperiksa —
 * bukan cuma header/footer berkas.
 *
 * @param {string} pdfPath path berkas PDF
 * @returns {string} teks yang bisa dibaca
 */
function teksDariPdf(pdfPath) {
  const buf = readFileSync(pdfPath);
  const latin = buf.toString("latin1");
  const stream = [];

  let i = 0;
  while (true) {
    const s = latin.indexOf("stream", i);
    if (s < 0) break;
    let mulai = s + 6;
    if (latin[mulai] === "\r") mulai++;
    if (latin[mulai] === "\n") mulai++;
    const e = latin.indexOf("endstream", mulai);
    if (e < 0) break;
    try {
      stream.push(inflateSync(buf.subarray(mulai, e)).toString("latin1"));
    } catch {
      /* bukan stream Flate (mis. font) — abaikan */
    }
    i = e + 9;
  }

  let teks = "";
  for (const m of stream.join("\n").matchAll(/\[([^\]]*)\]\s*TJ/g)) {
    for (const h of m[1].matchAll(/<([0-9A-Fa-f]*)>/g)) {
      const hex = h[1];
      for (let k = 0; k + 1 < hex.length; k += 2) {
        teks += String.fromCharCode(parseInt(hex.slice(k, k + 2), 16));
      }
    }
    for (const lit of m[1].matchAll(/\(([^)]*)\)/g)) {
      teks += lit[1];
    }
    teks += "\n";
  }
  return teks;
}

try {
  // ---------- WORD ----------
  {
    const target = path.join(dir, "uji.docx");
    const h = await jalankan(
      "src/generators/word.ts",
      "WordGenerator",
      { outputPath: target },
      { type: "word", title: "Laporan Uji" },
      BLOK,
    );
    cek("word: generate() sukses", h.success === true, h.error ?? "");
    cek("word: berkas .docx ada", existsSync(target));
    const ukuran = statSync(target).size;
    cek("word: ukuran > 1 KB", ukuran > 1024, `${ukuran} byte`);
    const { target: t, hasil } = daftarIsiZip(target);
    cek("word: berisi word/document.xml", hasil.includes("word/document.xml"));
    const docXml = readFileSync(path.join(t, "word", "document.xml"), "utf8");
    cek("word: teks judul ada", docXml.includes("Laporan Uji"));
    // numbering harus valid: tak boleh ada numId literal berbentuk {...}
    const numIdLiteral = /w:numId w:val="\{/.test(docXml);
    cek("word: numId valid (tak ada literal {})", !numIdLiteral);
    // <w:numPr> tidak boleh dobel DALAM satu paragraf. Regex harus menghitung
    // paragraf, bukan seluruh dokumen (dua paragraf berbeda masing-masing punya
    // satu numPr — itu normal).
    const paragrafe = docXml.split(/<w:p[ >]/).slice(1);
    const adaDobel = paragrafe.some((p) => {
      const n = (p.match(/<w:numPr>/g) || []).length;
      return n > 1;
    });
    cek("word: tak ada <w:numPr> ganda dalam satu paragraf", !adaDobel);
    cek(
      "word: ada numPr di dokumen (list benar-benar bernomor)",
      /<w:numPr>/.test(docXml),
    );
  }

  // ---------- XLSX ----------
  {
    const target = path.join(dir, "uji.xlsx");
    const h = await jalankan(
      "src/generators/xlsx.ts",
      "XLSXGenerator",
      { outputPath: target, sheets: [] },
      { type: "xlsx", title: "Laporan Uji" },
      BLOK,
    );
    cek("xlsx: generate() sukses", h.success === true, h.error ?? "");
    cek("xlsx: berkas .xlsx ada", existsSync(target));
    const ukuran = statSync(target).size;
    cek("xlsx: ukuran > 1 KB", ukuran > 1024, `${ukuran} byte`);
    const { hasil } = daftarIsiZip(target);
    cek("xlsx: berisi xl/workbook.xml", hasil.includes("xl/workbook.xml"));
    cek(
      "xlsx: ada sheet yang dibuat",
      hasil.some((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)),
      hasil.filter((f) => f.includes("worksheets")).join(", "),
    );
    // Isi sel harus TEKS ASLI, bukan JSON hasil stringifikasi objek
    // (exceljs v4 tidak mengenali `{ text, font }` sebagai nilai sel).
    const { target: tx } = daftarIsiZip(target);
    const sharedPath = path.join(tx, "xl", "sharedStrings.xml");
    if (existsSync(sharedPath)) {
      const shared = readFileSync(sharedPath, "utf8");
      cek(
        "xlsx: isi sel berupa teks asli (bukan JSON mentah)",
        !shared.includes("&quot;text&quot;") && !shared.includes('{\\"'),
        shared.length > 0 ? `${shared.length} byte sharedStrings` : "",
      );
      cek(
        "xlsx: teks dokumen benar-benar tersimpan",
        shared.includes("Paragraf pengujian"),
      );
    } else {
      cek("xlsx: isi sel berupa teks asli (bukan JSON mentah)", false, "sharedStrings.xml tidak ada");
    }
  }

  // ---------- PDF ----------
  {
    const target = path.join(dir, "uji.pdf");
    const h = await jalankan(
      "src/generators/pdf.ts",
      "PDFGenerator",
      { outputPath: target },
      { type: "pdf", title: "Laporan Uji" },
      BLOK,
    );
    cek("pdf: generate() sukses", h.success === true, h.error ?? "");
    cek("pdf: berkas .pdf ada", existsSync(target));
    const ukuran = statSync(target).size;
    cek("pdf: ukuran > 1 KB", ukuran > 1024, `${ukuran} byte`);
    const kepala = readFileSync(target).subarray(0, 5).toString("latin1");
    cek("pdf: header %PDF valid", kepala.startsWith("%PDF"), kepala);
    // PDF harus tertutup penanda %%EOF dan punya minimal satu objek halaman.
    const isiPdf = readFileSync(target).toString("latin1");
    cek(
      "pdf: ditutup penanda %%EOF",
      isiPdf.trimEnd().endsWith("%%EOF"),
      isiPdf.trimEnd().slice(-8),
    );
    const jumlahHalaman = (isiPdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    cek("pdf: punya minimal satu halaman", jumlahHalaman > 0, `${jumlahHalaman} halaman`);
    // Teks dokumen harus benar-benar ada di dalam PDF (bukan PDF kosong).
    const teksPdf = teksDariPdf(target);
    cek(
      "pdf: teks dokumen tersimpan di dalam PDF",
      teksPdf.includes("Laporan Uji") && teksPdf.includes("Paragraf pengujian"),
      JSON.stringify(teksPdf.slice(0, 80)),
    );
    cek(
      "pdf: nomor halaman tercetak",
      /\d+\s*\/\s*\d+/.test(teksPdf),
      (teksPdf.match(/\d+\s*\/\s*\d+/g) || []).join(", "),
    );
    // Nomor halaman harus konsisten dengan jumlah halaman sebenarnya.
    // Pdfkit menambah halaman kosong otomatis kalau nomor halaman ditulis
    // di bawah margin bawah — gejalanya: /Count jadi 2x jumlah halaman.
    const label = (teksPdf.match(/(\d+)\s*\/\s*(\d+)/g) || []).map((s) =>
      s.split("/").map((x) => parseInt(x.trim(), 10)),
    );
    const totalLabel = label.length ? label[0][1] : 0;
    cek(
      "pdf: jumlah nomor halaman = jumlah halaman nyata",
      totalLabel > 0 && totalLabel === jumlahHalaman,
      `label ${totalLabel} vs /Type/Page ${jumlahHalaman}`,
    );
    cek(
      "pdf: semua halaman bernomor",
      label.length === jumlahHalaman,
      `${label.length} label untuk ${jumlahHalaman} halaman`,
    );
  }

  // ---------- DIAGRAM ----------
  {
    const target = path.join(dir, "uji-diagram.svg");
    const h = await jalankan(
      "src/generators/diagram.ts",
      "DiagramGenerator",
      { outputPath: target, format: "svg" },
      { type: "diagram", title: "Diagram Uji" },
      [
        {
          id: "d1",
          type: "diagram",
          diagramType: "mermaid",
          source: "graph LR\n A[Mulai] --> B[Selesai]",
        },
      ],
    );
    cek("diagram: generate() sukses", h.success === true, h.error ?? "");
    cek("diagram: berkas ada", existsSync(target));
    const isi = readFileSync(target, "utf8");
    cek("diagram: isi SVG/mermaid", isi.length > 20, `${isi.length} karakter`);
    // Hasil render Mermaid berisi node/edge; sumber .mmd mentah tidak.
    // Kalau hanya .mmd, generator gagal render (fallback), bukan gambar.
    cek(
      "diagram: benar-benar ter-render (bukan sumber .mmd)",
      isi.includes("<svg") && /<(g|path|rect|circle|polygon)\b/.test(isi),
      isi.includes("<svg") ? "SVG dengan elemen render" : "bukan SVG",
    );
  }

  // ---------- PPTX ----------
  {
    const target = path.join(dir, "uji.pptx");
    const h = await jalankan(
      "src/generators/pptx.ts",
      "PPTXGenerator",
      { outputPath: target },
      { type: "pptx", title: "Laporan Uji" },
      BLOK,
    );
    cek("pptx: generate() sukses", h.success === true, h.error ?? "");
    cek("pptx: berkas .pptx ada", existsSync(target));
    const { target: t, hasil } = daftarIsiZip(target);
    const slideFiles = hasil.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
    cek("pptx: punya slide", slideFiles.length > 0, `${slideFiles.length} slide`);
    // Tabel bisa berada di slide mana pun (tabel mendapat slide sendiri).
    const adaTabel = slideFiles.some((f) =>
      readFileSync(path.join(t, ...f.split("/")), "utf8").includes("<a:tbl>"),
    );
    cek("pptx: punya tabel native", adaTabel);
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("\nSelesai.");
