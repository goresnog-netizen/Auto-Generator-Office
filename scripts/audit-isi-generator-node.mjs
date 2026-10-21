/**
 * TEST RUN + AUDIT ISI: periksa dokumen hasil ekspor, bukan cuma ukurannya.
 *
 * Fokus: apa yang benar-benar ada di dalam file .docx/.xlsx/.pdf/.pptx.
 * Skrip `verifikasi-generators.mjs` sudah memeriksa struktur; skrip ini
 * memeriksa ISI - termasuk hal-hal yang baru ketahuan saat test run:
 *
 *  - PPTX Node sebelumnya menulis file ke folder kerja dan mengembalikan
 *    `buffer: undefined` (tak ada buffer sama sekali).
 *  - Blok `code` di PPTX Node sebelumnya jadi bullet biasa, bukan teks
 *    monospace.
 *
 * Generator di-bundle dengan esbuild (pola `verifikasi-generators.mjs`):
 * `src/generators/*.ts` mengimpor TIPE dari `../types/index.ts`, dan Node
 * ESM tak bisa menangani import itu saat berkas TypeScript dimuat langsung.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ekstrakZip } from "./zip-util.mjs";

const require = createRequire(import.meta.url);
const AKAR = process.cwd();

/** Cari esbuild: coba root dulu, lalu store pnpm. */
function cariEsbuild() {
  const cands = ["esbuild"];
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("esbuild@")) {
        cands.push(
          path.join(store, d, "node_modules", "esbuild", "lib", "main.js"),
        );
      }
    }
  }
  for (const c of cands) {
    try {
      return require(c);
    } catch {
      /* coba berikutnya */
    }
  }
  throw new Error("esbuild tidak ditemukan - install vite (membawa esbuild).");
}
const esbuild = cariEsbuild();

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Uji NitZ909" },
  { id: "p1", type: "paragraph", text: "Paragraf pembuka untuk laporan uji." },
  {
    id: "l1",
    type: "list",
    ordered: false,
    items: [{ text: "Poin pertama" }, { text: "Poin kedua" }],
  },
  { id: "h2", type: "heading", level: 2, text: "Tabel Data" },
  {
    id: "t1",
    type: "table",
    headers: ["Kolom A", "Kolom B"],
    rows: [
      ["1", "2"],
      ["3", "4"],
    ],
  },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;" },
  {
    id: "g1",
    type: "chart",
    chartType: "bar",
    data: {
      labels: ["Q1", "Q2"],
      datasets: [{ label: "X", data: [1, 2] }],
    },
  },
  {
    id: "d1",
    type: "diagram",
    diagramType: "mermaid",
    source: "flowchart LR\n A[Kiri] --> B[Kanan]",
  },
];

const dir = mkdtempSync(path.join(tmpdir(), "nitz-audit-isi-"));
const entry = path.join(dir, "entry.ts");
const bundle = path.join(AKAR, "node_modules", ".cache", "nitz-audit-isi", "b.mjs");
mkdirSync(path.dirname(bundle), { recursive: true });

writeFileSync(
  entry,
  `import { generateDocument } from ${JSON.stringify(
    path.join(AKAR, "src", "generators", "index.ts").replace(/\\/g, "/"),
  )};
const out = ${JSON.stringify(dir)};
for (const [type, ext] of [["word","docx"],["xlsx","xlsx"],["pdf","pdf"],["pptx","pptx"]]) {
  const hasil = await generateDocument(type,
    { type, title: "Laporan Uji NitZ909", metadata: { author: "Uji" } },
    { blocks: ${JSON.stringify(BLOK)} });
  const fs = await import("node:fs");
  if (hasil?.buffer) {
    fs.writeFileSync(out + "/gen." + ext, hasil.buffer);
    console.log("__DONE__" + type + ":" + hasil.buffer.length);
  } else {
    console.log("__DONE__" + type + ":0:" + (hasil?.error ?? "no buffer"));
  }
}
`,
  "utf8",
);

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

const keluar = execFileSync(process.execPath, [bundle], {
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
  cwd: AKAR,
  timeout: 300_000,
});
const hasil = new Map();
for (const b of keluar.split("\n").filter((l) => l.startsWith("__DONE__"))) {
  const [tipe, ukuran] = b.slice("__DONE__".length).split(":");
  hasil.set(tipe, { ukuran: Number(ukuran), sisa: b });
}
for (const [tipe, h] of hasil) {
  console.log(`  ${tipe}: ${h.ukuran} byte`);
}

// ---- Semua generator wajib mengembalikan buffer ----
for (const tipe of ["word", "xlsx", "pdf", "pptx"]) {
  cek(
    `${tipe}: generator mengembalikan buffer`,
    (hasil.get(tipe)?.ukuran ?? 0) > 0,
    hasil.get(tipe)?.sisa ?? "",
  );
}

// ---- Generator TIDAK boleh menulis file liar ke folder kerja ----
cek(
  "generator tidak menulis file .pptx liar ke folder kerja",
  !readdirSync(AKAR).some((f) => f.endsWith(".pptx") && f.includes("Uji")),
  readdirSync(AKAR).filter((f) => f.endsWith(".pptx")).join(", ") || "bersih",
);

// ---- DOCX ----
console.log("\n== DOCX ==");
{
  const target = path.join(dir, "docx");
  ekstrakZip(path.join(dir, "gen.docx"), target);
  const docXml = readFileSync(path.join(target, "word", "document.xml"), "utf8");
  cek("docx: ada heading", docXml.includes("Laporan Uji NitZ909"));
  cek("docx: ada paragraf", docXml.includes("Paragraf pembuka"));
  cek("docx: ada item list", docXml.includes("Poin pertama"));
  cek("docx: ada isi tabel", docXml.includes("Kolom A"));
  cek("docx: ada blok kode", docXml.includes("const a = 1;"));
  cek(
    "docx: blok kode ber-font monospace",
    /Consolas|Courier|Liberation Mono/i.test(docXml),
  );
  cek("docx: tak ada numId tak terdaftar", !/numId="\{/.test(docXml));
}

// ---- XLSX ----
console.log("\n== XLSX ==");
{
  const target = path.join(dir, "xlsx");
  ekstrakZip(path.join(dir, "gen.xlsx"), target);
  const shared = path.join(target, "xl", "sharedStrings.xml");
  const isi = existsSync(shared) ? readFileSync(shared, "utf8") : "";
  cek(
    "xlsx: ada teks asli",
    isi.includes("Poin pertama") || isi.includes("Kolom A"),
  );
  cek("xlsx: isi bukan JSON mentah", !/\\"text\\"/.test(isi));
  cek(
    "xlsx: ada worksheet",
    existsSync(path.join(target, "xl", "worksheets", "sheet1.xml")),
  );
}

// ---- PDF ----
console.log("\n== PDF ==");
{
  const buf = readFileSync(path.join(dir, "gen.pdf"));
  const teks = buf.toString("latin1");
  cek("pdf: signature %PDF", teks.startsWith("%PDF-"));
  cek("pdf: ada penanda %%EOF", teks.trimEnd().endsWith("%%EOF"));
  const halaman = (teks.match(/\/Type\s*\/Page[^s]/g) || []).length;
  cek("pdf: punya minimal 1 halaman", halaman >= 1, `${halaman} halaman`);
  cek("pdf: ukuran wajar", buf.length > 1500, `${buf.length} byte`);
}

// ---- PPTX (generator Node) ----
console.log("\n== PPTX (generator Node) ==");
{
  const target = path.join(dir, "pptx");
  ekstrakZip(path.join(dir, "gen.pptx"), target);
  const slidesDir = path.join(target, "ppt", "slides");
  const slides = existsSync(slidesDir)
    ? readdirSync(slidesDir).filter((f) => f.endsWith(".xml"))
    : [];
  cek("pptx: punya slide", slides.length > 0, `${slides.length} slide`);
  const semuaXml = slides
    .map((f) => readFileSync(path.join(slidesDir, f), "utf8"))
    .join("\n");
  cek("pptx: ada teks judul", semuaXml.includes("Laporan Uji"));
  cek("pptx: ada tabel", semuaXml.includes("<a:tbl>"));
  cek(
    "pptx: ada grafik (chart)",
    existsSync(path.join(target, "ppt", "charts")) &&
      readdirSync(path.join(target, "ppt", "charts")).some((f) =>
        f.endsWith(".xml"),
      ),
  );
  // Blok kode harus monospace - kalau jadi bullet biasa, tak ada typeface
  // monospace di slide itu.
  cek(
    "pptx: blok kode ber-font monospace",
    /typeface="Consolas"|typeface="Courier"|typeface="Liberation Mono"/i.test(
      semuaXml,
    ),
  );
  cek(
    "pptx: grafik punya seri data (bukan bingkai kosong)",
    (() => {
      const chartDir = path.join(target, "ppt", "charts");
      if (!existsSync(chartDir)) return false;
      const chartXml = readdirSync(chartDir)
        .filter((f) => f.endsWith(".xml"))
        .map((f) => readFileSync(path.join(chartDir, f), "utf8"))
        .join("\n");
      return /<c:ser>/.test(chartXml);
    })(),
  );
}

rmSync(dir, { recursive: true, force: true });
console.log("\nSelesai.");
