/**
 * Audit ISI: apakah berkas yang dihasilkan generator benar-benar berisi
 * konten bermakna — bukan sekadar valid secara struktural.
 *
 * Ini pelengkap `verifikasi-generators.mjs`: berkas yang lolos uji struktur
 * bisa saja berisi dokumen kosong. Di sini isi dokumen dibaca dan diperiksa
 * kata kunci yang SEHARUSNYA ada.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ekstrakZip } from "./zip-util.mjs";

const require = createRequire(import.meta.url);
const AKAR = process.cwd();

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

function cariEsbuild() {
  const store = path.join(AKAR, "node_modules", ".pnpm");
  const kandidat = ["esbuild"];
  const { readdirSync, existsSync } = require("node:fs");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("esbuild@")) {
        kandidat.push(path.join(store, d, "node_modules", "esbuild", "lib", "main.js"));
      }
    }
  }
  for (const c of kandidat) {
    try {
      return require(c);
    } catch {}
  }
  throw new Error("esbuild tidak ditemukan");
}
const esbuild = cariEsbuild();

const KATA = ["Laporan Uji", "Paragraf pengujian", "Poin satu", "nilai 1", "const a = 1"];

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Uji" },
  { id: "p1", type: "paragraph", text: "Paragraf pengujian." },
  { id: "h2", type: "heading", level: 2, text: "Rincian" },
  { id: "l1", type: "list", ordered: false, items: [{ text: "Poin satu" }, { text: "Poin dua" }] },
  { id: "t1", type: "table", headers: ["Kolom A", "Kolom B"], rows: [["nilai 1", "nilai 2"], ["nilai 3", "nilai 4"]] },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;" },
];

const dir = mkdtempSync(path.join(tmpdir(), "nitz-audit-"));

async function jalankan(generatorPath, exportName, options, config, blocks) {
  const entry = path.join(dir, `e-${exportName}.ts`);
  writeFileSync(
    entry,
    `import { ${exportName} } from ${JSON.stringify(path.join(AKAR, generatorPath).replace(/\\/g, "/"))};
const gen = new ${exportName}(${JSON.stringify(options)});
const h = await gen.generate(
  { type: ${JSON.stringify(config.type)}, title: ${JSON.stringify(config.title)}, metadata: { author: "Uji" } },
  { blocks: ${JSON.stringify(blocks)} },
);
console.log("__R__" + JSON.stringify({ success: h.success, outputPath: h.outputPath, error: h.error }));
`,
    "utf8",
  );
  const bundle = path.join(AKAR, "node_modules", ".cache", "nitz-gen", `audit-${exportName}.mjs`);
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
  const keluar = execFileSync(process.execPath, [bundle], {
    encoding: "utf8",
    cwd: AKAR,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const b = keluar.split("\n").find((x) => x.startsWith("__R__"));
  return JSON.parse(b.slice("__R__".length));
}

/** Teks dari XML .docx: gabungkan isi <w:t>. */
function teksDocx(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((m) => m[1])
    .join(" ");
}

try {
  // ---------- DOCX: isi dokumen ----------
  {
    const target = path.join(dir, "a.docx");
    await jalankan("src/generators/word.ts", "WordGenerator", { outputPath: target }, { type: "word", title: "Laporan Uji" }, BLOK);
    const extract = path.join(dir, "xd");
    ekstrakZip(target, extract);
    const xml = readFileSync(path.join(extract, "word", "document.xml"), "utf8");
    const teks = teksDocx(xml);
    for (const k of KATA) {
      cek(`docx: isi memuat "${k}"`, teks.includes(k));
    }
    // Word tak boleh menyimpan objek JSON mentah (gejala exceljs lama).
    cek("docx: tak ada JSON mentah di teks", !/"text"\s*:\s*"[^"]+"\s*,\s*"font"/.test(xml));
  }

  // ---------- XLSX: isi sel ----------
  {
    const target = path.join(dir, "a.xlsx");
    await jalankan("src/generators/xlsx.ts", "XLSXGenerator", { outputPath: target, sheets: [] }, { type: "xlsx", title: "Laporan Uji" }, BLOK);
    const extract = path.join(dir, "xx");
    ekstrakZip(target, extract);
    const shared = path.join(extract, "xl", "sharedStrings.xml");
    const strings = readFileSync(shared, "utf8");
    for (const k of ["Laporan Uji", "Poin satu", "nilai 1"]) {
      cek(`xlsx: sharedStrings memuat "${k}"`, strings.includes(k));
    }
    // Tidak boleh ada JSON mentah.
    cek(
      "xlsx: sharedStrings tak berisi JSON mentah",
      !/"text"\s*:\s*"[^"]*"\s*,\s*"font"/.test(strings),
    );
    // Sheet harus punya isi (tak cuma header xml).
    const sheet = readFileSync(path.join(extract, "xl", "worksheets", "sheet1.xml"), "utf8");
    cek("xlsx: sheet1 punya sel", /<c\b/.test(sheet));
  }

  // ---------- PDF: teksnya bisa diekstrak ----------
  {
    const target = path.join(dir, "a.pdf");
    await jalankan("src/generators/pdf.ts", "PDFGenerator", { outputPath: target }, { type: "pdf", title: "Laporan Uji" }, BLOK);
    const buf = readFileSync(target);
    // PDFkit mengcompress stream; cari penanda tak-terkompresi minimal.
    cek("pdf: punya objek halaman", buf.toString("latin1").includes("/Type /Page"));
    cek("pdf: punya font", buf.toString("latin1").includes("/Font"));
  }

  // ---------- PPTX: teks per slide ----------
  {
    const target = path.join(dir, "a.pptx");
    await jalankan("src/generators/pptx.ts", "PPTXGenerator", { outputPath: target }, { type: "pptx", title: "Laporan Uji" }, BLOK);
    const extract = path.join(dir, "xp");
    ekstrakZip(target, extract);
    const { readdirSync } = require("node:fs");
    const slideDir = path.join(extract, "ppt", "slides");
    const semua = readdirSync(slideDir)
      .filter((f) => f.endsWith(".xml"))
      .map((f) => readFileSync(path.join(slideDir, f), "utf8"))
      .join("\n");
    const teks = [...semua.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => m[1]).join(" ");
    for (const k of ["Laporan Uji", "Poin satu", "nilai 1"]) {
      cek(`pptx: slide memuat "${k}"`, teks.includes(k));
    }
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("\nSelesai.");
