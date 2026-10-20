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

/** Daftar path di dalam sebuah ZIP (setelah diekstrak). */
function daftarIsiZip(zipPath) {
  const target = path.join(dir, "x-" + path.basename(zipPath));
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Remove-Item -Recurse -Force '${target}' -ErrorAction SilentlyContinue; ` +
        `Expand-Archive -Path '${zipPath}' -DestinationPath '${target}' -Force`,
    ],
    { stdio: "pipe" },
  );
  const hasil = [];
  const jalan = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) jalan(f);
      else hasil.push(path.relative(target, f).replace(/\\/g, "/"));
    }
  };
  jalan(target);
  return { target, hasil };
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
