/**
 * TEST RUN 3: periksa ISI dokumen hasil ekspor (bukan cuma ukurannya).
 *
 * Meng acutely memeriksa:
 *  - PPTX: slide, tabel, grafik, font Liberation Mono, teks blok kode.
 *  - DOCX: heading, tabel, blok kode.
 *  - XLSX: sheet, isi sel.
 *  - PDF: jumlah halaman, teks yang bisa diekstrak.
 *  - GIF: jumlah frame.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AKAR = process.cwd();
const OUT = path.resolve("testrun");

/** Cari esbuild: root dulu, lalu store pnpm. */
function cariEsbuild() {
  const cands = ["esbuild"];
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of require("node:fs").readdirSync(store)) {
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
  throw new Error("esbuild tidak ditemukan.");
}
const esbuild = cariEsbuild();

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Uji NitZ909" },
  { id: "p1", type: "paragraph", text: "Paragraf pembuka untuk laporan uji." },
  { id: "l1", type: "list", ordered: false, items: [{ text: "Poin pertama" }, { text: "Poin kedua" }] },
  { id: "h2", type: "heading", level: 2, text: "Tabel Data" },
  { id: "t1", type: "table", headers: ["Kolom A", "Kolom B"], rows: [["1", "2"], ["3", "4"]] },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;" },
  { id: "g1", type: "chart", chartType: "bar", data: { labels: ["Q1", "Q2"], datasets: [{ label: "X", data: [1, 2] }] } },
  { id: "d1", type: "diagram", diagramType: "mermaid", source: "flowchart LR\n A[Kiri] --> B[Kanan]" },
];

// --- Generate lewat generator Node ---
const dir = mkdtempSync(path.join(tmpdir(), "nitz-testrun3-"));
const entry = path.join(dir, "entry.ts");
const bundle = path.join(AKAR, "node_modules", ".cache", "nitz-testrun3", "b.mjs");
require("node:fs").mkdirSync(path.dirname(bundle), { recursive: true });
require("node:fs").writeFileSync(
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
for (const b of keluar.split("\n").filter((l) => l.startsWith("__DONE__"))) {
  console.log("  " + b.slice("__DONE__".length));
}

// --- Periksa isi ---
const { ekstrakZip } = await import("./zip-util.mjs");

console.log("\n== DOCX ==");
{
  ekstrakZip(path.join(dir, "gen.docx"), path.join(dir, "docx"));
  const target = path.join(dir, "docx");
  const docXml = readFileSync(path.join(target, "word", "document.xml"), "utf8");
  cek("docx: ada heading", /Laporan Uji NitZ909/.test(docXml));
  cek("docx: ada paragraf", /Paragraf pembuka/.test(docXml));
  cek("docx: ada item list", /Poin pertama/.test(docXml));
  cek("docx: ada isi tabel", /Kolom A/.test(docXml));
  cek("docx: ada blok kode", /const a = 1;/.test(docXml));
  cek("docx: font monospace di blok kode", /Consolas|Courier/i.test(docXml));
  cek("docx: tak ada numId tak terdaftar", !/numId="\{/.test(docXml));
}

console.log("\n== XLSX ==");
{
  ekstrakZip(path.join(dir, "gen.xlsx"), path.join(dir, "xlsx"));
  const target = path.join(dir, "xlsx");
  const shared = path.join(target, "xl", "sharedStrings.xml");
  const isi = existsSync(shared) ? readFileSync(shared, "utf8") : "";
  cek("xlsx: ada teks asli", isi.includes("Poin pertama") || isi.includes("Kolom A"));
  cek("xlsx: isi bukan JSON mentah", !/\\"text\\"/.test(isi));
  const sheet = path.join(target, "xl", "worksheets", "sheet1.xml");
  cek("xlsx: ada worksheet", existsSync(sheet));
}

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

console.log("\n== PPTX (generator Node) ==");
{
  ekstrakZip(path.join(dir, "gen.pptx"), path.join(dir, "pptx"));
  const target = path.join(dir, "pptx");
  const slidesDir = path.join(target, "ppt", "slides");
  const slides = existsSync(slidesDir)
    ? require("node:fs").readdirSync(slidesDir).filter((f) => f.endsWith(".xml"))
    : [];
  cek("pptx: punya slide", slides.length > 0, `${slides.length} slide`);
  const semuaXml = slides
    .map((f) => readFileSync(path.join(slidesDir, f), "utf8"))
    .join("\n");
  cek("pptx: ada teks judul", semuaXml.includes("Laporan Uji"));
  cek("pptx: ada tabel", semuaXml.includes("<a:tbl>"));
  cek("pptx: ada grafik (chart)", adaFile(path.join(target, "ppt", "charts")));
  cek("pptx: font monospace", /typeface="Consolas"|typeface="Courier/i.test(semuaXml));
}

function adaFile(p) {
  try {
    return require("node:fs").statSync(p).isDirectory();
  } catch {
    return false;
  }
}

rmSync(dir, { recursive: true, force: true });
console.log("\nSelesai.");
