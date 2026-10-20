/**
 * Verifikasi PPTXGenerator Node: buktikan berkas .pptx yang dihasilkan
 * BENAR-BENAR ada dan isinya benar (bukan hanya "file exists").
 *
 * Pemeriksaan:
 *  1. `generate()` mengembalikan success:true
 *  2. outputPath benar-benar ada di disk & ukurannya > 0
 *  3. Berkas adalah ZIP valid (signature "PK")
 *  4. XML di dalamnya berisi: tabel native, grafik dengan seri non-kosong,
 *     gambar tertanam, dan jumlah slide sesuai harapan
 *  5. Semua 9 jenis blok menghasilkan sesuatu
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ekstrakZip } from "./zip-util.mjs";

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

// PNG 1x1 valid sebagai data-URL.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif dan temuan utama." },
  { id: "h2", type: "heading", level: 2, text: "Rincian" },
  {
    id: "l1",
    type: "list",
    ordered: false,
    items: [
      { text: "Pendapatan tumbuh 42% YoY" },
      { text: "Biaya turun 11%", children: [{ text: "Infrastruktur" }] },
    ],
  },
  { id: "h3", type: "heading", level: 2, text: "Anggaran" },
  {
    id: "t1",
    type: "table",
    headers: ["Komponen", "Biaya", "Porsi"],
    rows: [
      ["Infrastruktur", "1.200", "45%"],
      ["Pelatihan", "350", "13%"],
      ["Sistem", "1.100", "42%"],
    ],
  },
  { id: "h4", type: "heading", level: 2, text: "Tren Realisasi" },
  {
    id: "c1",
    type: "chart",
    chartType: "bar",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [
        { label: "Realisasi", data: [40, 65, 80, 95] },
        { label: "Target", data: [50, 60, 75, 100] },
      ],
    },
  },
  { id: "h5", type: "heading", level: 2, text: "Alur" },
  {
    id: "d1",
    type: "diagram",
    diagramType: "mermaid",
    source: "flowchart LR\n A[Audit] --> B[Perbaikan]\n B --> C[Evaluasi]",
  },
  { id: "i1", type: "image", src: PNG, alt: "Foto uji", caption: "Caption uji" },
  { id: "k1", type: "code", language: "ts", code: "const a = 1;" },
  { id: "dv", type: "divider" },
];

const dir = mkdtempSync(path.join(tmpdir(), "nitz-pptx-gen-"));
const target = path.join(dir, "hasil.pptx");

try {
  // Generator TypeScript → jalankan lewat node --experimental-strip-types.
  // Di Windows, path absolut harus jadi URL file:// agar bisa di-import ESM.
  const modulUrl = new URL(
    `file:///${path.resolve("src/generators/pptx.ts").replace(/\\/g, "/")}`,
  ).href;
  const skrip = `
    import { PPTXGenerator } from ${JSON.stringify(modulUrl)};
    const gen = new PPTXGenerator({ outputPath: ${JSON.stringify(target)} });
    const hasil = await gen.generate(
      { type: "pptx", title: "Laporan Kinerja 2026", metadata: { description: "Uji" } },
      { blocks: ${JSON.stringify(BLOK)} },
    );
    console.log(JSON.stringify(hasil));
  `;
  const skripFile = path.join(dir, "run.mts");
  const { writeFileSync } = await import("node:fs");
  writeFileSync(skripFile, skrip, "utf8");

  let keluar;
  try {
    keluar = execFileSync(
      process.execPath,
      ["--experimental-strip-types", skripFile],
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (e) {
    console.error("GAGAL menjalankan generator:", e.stderr?.toString() ?? e.message);
    throw e;
  }
  const hasil = JSON.parse(keluar.trim().split("\n").pop());
  console.log("  metadata:", JSON.stringify(hasil.metadata));

  cek("generate() sukses", hasil.success === true, hasil.error ?? "");
  cek("outputPath dikembalikan", typeof hasil.outputPath === "string");
  cek("berkas benar-benar ada di disk", existsSync(hasil.outputPath));
  const ukuran = statSync(hasil.outputPath).size;
  cek("ukuran berkas > 10 KB", ukuran > 10000, `${ukuran} byte`);

  // Signature ZIP.
  const buf = readFileSync(hasil.outputPath);
  cek("signature ZIP valid (PK)", buf[0] === 0x50 && buf[1] === 0x4b);

  // Ekstrak & periksa XML.
  // Utilitas ZIP Node, bukan `Expand-Archive` PowerShell (path dengan
  // spasi / path 8.3 tak selalu bisa dibuka PowerShell).
  const ekstrak = path.join(dir, "x");
  ekstrakZip(hasil.outputPath, ekstrak);

  const slideDir = path.join(ekstrak, "ppt", "slides");
  const slideFiles = existsSync(slideDir)
    ? readdirSync(slideDir).filter((f) => f.endsWith(".xml"))
    : [];
  cek("berkas berisi slide", slideFiles.length > 0, `${slideFiles.length} slide`);

  const slideXml = slideFiles
    .map((f) => readFileSync(path.join(slideDir, f), "utf8"))
    .join("\n");

  cek("tabel native ada (<a:tbl>)", slideXml.includes("<a:tbl>"));
  cek("grafik dirujuk di slide", slideXml.includes("chart"));

  const chartDir = path.join(ekstrak, "ppt", "charts");
  const chartFiles = existsSync(chartDir)
    ? readdirSync(chartDir).filter((f) => f.endsWith(".xml"))
    : [];
  const chartXml = chartFiles
    .map((f) => readFileSync(path.join(chartDir, f), "utf8"))
    .join("\n");
  cek("grafik punya <c:ser> (bukan bingkai kosong)", chartXml.includes("<c:ser>"));
  cek("grafik punya <c:barChart>", chartXml.includes("barChart"));
  // Dua seri harus ada (Realisasi + Target).
  const jumlahSeri = (chartXml.match(/<c:ser>/g) || []).length;
  cek("grafik berisi 2 seri data", jumlahSeri >= 2, `${jumlahSeri} seri`);

  const mediaDir = path.join(ekstrak, "ppt", "media");
  const mediaFiles = existsSync(mediaDir) ? readdirSync(mediaDir) : [];
  cek("gambar tertanam di berkas", mediaFiles.length > 0, `${mediaFiles.length} media`);

  // Teks dari semua jenis blok harus muncul.
  cek("judul dokumen ada di slide", slideXml.includes("Laporan Kinerja"));
  cek("isi tabel ada di slide", slideXml.includes("Infrastruktur"));
  cek("label grafik ada di slide", slideXml.includes("Realisasi"));
  cek("kode diblok ada di slide", slideXml.includes("const a = 1"));
  cek("sumber diagram ada di slide", slideXml.includes("Audit"));

  // Jumlah slide: sampul + 6 section (h1..h5 + isi) + penutup.
  cek("jumlah slide sesuai harapan (>= 5)", slideFiles.length >= 5, `${slideFiles.length}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log("\nSelesai.");
