/**
 * Verifikasi render diagram Mermaid yang SESUNGGUHNYA (bukan fallback .mmd).
 *
 * Generator di-bundle dengan esbuild (pola `scripts/verifikasi-generators.mjs`):
 * `diagram.ts` mengimpor TIPE dari `../types/index.ts`, dan Node ESM tak
 * bisa menangani import itu saat berkas TypeScript dimuat langsung.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

/** Cari esbuild: coba root dulu, lalu store pnpm (pola dari verifikasi-generators.mjs). */
function cariEsbuild() {
  const candidates = ["esbuild"];
  const store = path.join(process.cwd(), "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("esbuild@")) {
        candidates.push(path.join(store, d, "node_modules", "esbuild", "lib", "main.js"));
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
  throw new Error("esbuild tidak ditemukan - install vite (membawa esbuild).");
}

const esbuild = cariEsbuild();

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

const AKAR = process.cwd();
const dir = path.join(tmpdir(), "nitz-mermaid-uji");
mkdirSync(dir, { recursive: true });

const configPuppeteer = path.join(AKAR, "config", "puppeteer.config.json");
const cliMmdc = path.join(AKAR, "node_modules", "@mermaid-js", "mermaid-cli", "src", "cli.js");

// ---------- 1. Instalasi ----------
cek("mermaid-cli terpasang lokal", existsSync(cliMmdc), path.relative(AKAR, cliMmdc));
const pkg = JSON.parse(readFileSync(path.join(AKAR, "package.json"), "utf8"));
cek("mermaid-cli tercatat sebagai devDependency", !!pkg.devDependencies?.["@mermaid-js/mermaid-cli"], pkg.devDependencies?.["@mermaid-js/mermaid-cli"] ?? "-");
cek("puppeteer tercatat sebagai devDependency", !!pkg.devDependencies?.["puppeteer"], pkg.devDependencies?.["puppeteer"] ?? "-");
cek("skrip pasang:mermaid ada di package.json", !!pkg.scripts?.["pasang:mermaid"], pkg.scripts?.["pasang:mermaid"] ?? "-");

// ---------- 2. Konfigurasi Puppeteer ----------
cek("konfigurasi Puppeteer ada", existsSync(configPuppeteer));
let cfg = {};
try {
  cfg = JSON.parse(readFileSync(configPuppeteer, "utf8"));
} catch (e) {
  cek("konfigurasi Puppeteer bisa diparse", false, e.message);
}
cek("konfigurasi Puppeteer headless", cfg.headless === true);
cek("konfigurasi Puppeteer memakai --no-sandbox", Array.isArray(cfg.args) && cfg.args.includes("--no-sandbox"));
cek("konfigurasi Puppeteer menunjuk executablePath", typeof cfg.executablePath === "string" && cfg.executablePath.length > 0, cfg.executablePath ?? "(tak ada - Puppeteer pakai Chrome sendiri)");
if (cfg.executablePath) cek("executablePath benar-benar ada di disk", existsSync(cfg.executablePath));

// ---------- 3. Render nyata ----------
// `cli.js` dipanggil langsung dengan Node - bukan lewat `mmdc.cmd`.
// Batch file tak bisa dijalankan `execFile` tanpa shell (CVE-2024-27980),
// dan `cmd.exe /c` memecah path yang mengandung spasi.
const DIAGRAM = [
  { nama: "flowchart", sumber: "flowchart LR\n  A[Riset] --> B[Desain]\n  B --> C[Rilis]", cekSvg: (s) => s.includes("<svg") && s.includes("Riset") && s.includes("Rilis") },
  { nama: "sequenceDiagram", sumber: "sequenceDiagram\n  Alice->>Bob: Halo\n  Bob-->>Alice: Hai", cekSvg: (s) => s.includes("<svg") && s.includes("Alice") },
  { nama: "pie", sumber: 'pie title Porsi\n  "A" : 40\n  "B" : 60', cekSvg: (s) => s.includes("<svg") && s.includes("40") },
];

let renderBerhasil = 0;
for (const d of DIAGRAM) {
  const mmd = path.join(dir, `${d.nama}.mmd`);
  const svg = path.join(dir, `${d.nama}.svg`);
  writeFileSync(mmd, d.sumber, "utf8");
  try {
    execFileSync(process.execPath, [cliMmdc, "-i", mmd, "-o", svg, "-t", "default", "-b", "transparent", "-p", configPuppeteer, "-q"], {
      encoding: "utf8", timeout: 180_000, stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    cek(`render ${d.nama}`, false, (e.stderr?.toString() ?? e.message ?? "").slice(0, 300));
    continue;
  }
  const ada = existsSync(svg);
  const isi = ada ? readFileSync(svg, "utf8") : "";
  cek(`render ${d.nama} -> SVG berisi node diagram`, ada && d.cekSvg(isi), ada ? `${isi.length} karakter` : "berkas tak dibuat");
  if (ada && d.cekSvg(isi)) renderBerhasil += 1;
}
cek("semua jenis diagram ter-render", renderBerhasil === DIAGRAM.length, `${renderBerhasil}/${DIAGRAM.length}`);

// ---------- 4. Generator NitZ-909 (di-bundle) ----------
const entry = path.join(dir, "entry-diagram.ts");
const bundle = path.join(AKAR, "node_modules", ".cache", "nitz-mermaid", "bundle-diagram.mjs");

async function jalankanGenerator(sumber, outputPath) {
  writeFileSync(entry, `import { DiagramGenerator } from ${JSON.stringify(path.join(AKAR, "src", "generators", "diagram.ts").replace(/\\/g, "/"))};
const gen = new DiagramGenerator({ outputPath: ${JSON.stringify(outputPath)} });
const hasil = await gen.generate(
  { type: "diagram", title: "Diagram Uji", metadata: { author: "Uji" } },
  { blocks: ${JSON.stringify(sumber)} },
);
console.log("__RESULT__" + JSON.stringify({
  success: hasil.success, error: hasil.error, outputPath: hasil.outputPath, metadata: hasil.metadata ?? null,
}));
`, "utf8");
  mkdirSync(path.dirname(bundle), { recursive: true });
  await esbuild.build({
    entryPoints: [entry], bundle: true, platform: "node", format: "esm", target: "node22",
    outfile: bundle, external: ["pptxgenjs", "docx", "exceljs", "pdfkit", "mermaid"], logLevel: "silent",
  });
  const keluar = execFileSync(process.execPath, [bundle], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], cwd: AKAR, timeout: 180_000 });
  const baris = keluar.split("\n").find((b) => b.startsWith("__RESULT__"));
  if (!baris) throw new Error(`tidak ada hasil dari generator: ${keluar.slice(0, 400)}`);
  return JSON.parse(baris.slice("__RESULT__".length));
}

const svgGen = path.join(dir, "gen.svg");
const hasil = await jalankanGenerator([
  { id: "d1", type: "diagram", diagramType: "mermaid", source: "flowchart TD\n  A[Mulai] --> B[Selesai]" },
], svgGen);
cek("generator: sukses", hasil.success === true, hasil.error ?? "");
cek("generator: berkas SVG ditulis", existsSync(svgGen));
if (existsSync(svgGen)) {
  const isi = readFileSync(svgGen, "utf8");
  cek("generator: SVG ter-render (bukan sumber .mmd)", isi.includes("<svg") && isi.includes("Mulai"), `${isi.length} karakter`);
}
cek("generator: tak jatuh ke fallback", !hasil.metadata?.fallback, hasil.metadata?.message ?? "");

const hasil2 = await jalankanGenerator([
  { id: "d2", type: "diagram", diagramType: "mermaid", source: "this is not valid mermaid at all {{{" },
], path.join(dir, "salah.svg"));
cek("sintaks salah: jatuh ke fallback", hasil2.metadata?.fallback === true, hasil2.metadata?.message ?? "");
cek("sintaks salah: pesan menyebut parse (bukan Chrome)", /parse|sintaks/i.test(hasil2.metadata?.message ?? ""), hasil2.metadata?.message ?? "");
cek("sintaks salah: TIDAK dilaporkan sebagai 'butuh Chrome'", hasil2.metadata?.butuhChrome !== true);

rmSync(dir, { recursive: true, force: true });
console.log("\nSelesai.");