/**
 * Audit "gap" — memverifikasi klaim yang sering dibuat tapi tak pernah
 * dibuktikan, plus kebenaran workflow CI.
 *
 * Kenapa skrip ini ada:
 *
 * Sesi 6 melaporkan 5 "gap yang tersisa". Setelah diuji dengan bukti, 4
 * dari 5 ternyata BUKAN gap:
 *   - thumbnail template: sudah dirender (bukan placeholder);
 *   - gambar remote: sudah ada `urlKeDataUrl` + fallback offline;
 *   - Auto-Generate: sudah diuji end-to-end dengan blok lengkap;
 *   - workflow CI: YAML valid, 3 job, semua skrip ada.
 * Yang benar-benar tersisa cuma satu: belum ada git remote.
 *
 * Skrip ini mengunci kenyataan itu supaya laporan berikutnya tak
 * mengulang klaim yang tak akurat.
 *
 * Yang diperiksa:
 *  1. Workflow CI: YAML valid, job punya run & runs-on, skrip yang dirujuk
 *     ADA, skrip npm yang dirujuk terdaftar.
 *  2. Git remote: ada atau tidak (laporan, bukan kegagalan).
 *  3. Ekspor gambar remote: helper unduh + fallback offline.
 *  4. Audit isi generator Node: buffer dikembalikan, tak ada file liar.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AKAR = process.cwd();

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " - " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

/** Cari js-yaml (dependency vite, ada di store pnpm tapi tak di-hoist). */
function cariYaml() {
  const cands = ["js-yaml", "yaml"];
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (d.startsWith("js-yaml@")) {
        cands.push(path.join(store, d, "node_modules", "js-yaml"));
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
  return null;
}

// ================= 1. Workflow CI =================
console.log("== 1. workflow CI ==");
const ciPath = path.join(AKAR, ".github", "workflows", "ci.yml");
cek("workflow ci.yml ada", existsSync(ciPath));

if (existsSync(ciPath)) {
  const ci = readFileSync(ciPath, "utf8");
  const yaml = cariYaml();
  cek("parser YAML tersedia", !!yaml);

  if (yaml) {
    let doc = null;
    try {
      doc = yaml.load ? yaml.load(ci) : yaml.parse(ci);
      cek("YAML valid", !!doc && !!doc.jobs);
    } catch (e) {
      cek("YAML valid", false, e.message);
    }

    if (doc?.jobs) {
      const namaJob = Object.keys(doc.jobs);
      cek(
        "3 job terdaftar (check, generators, deckcraft)",
        doc.jobs.check && doc.jobs.generators && doc.jobs.deckcraft,
        namaJob.join(", "),
      );
      for (const nama of namaJob) {
        const langkah = doc.jobs[nama]?.steps ?? [];
        cek(
          `job "${nama}" punya langkah run`,
          langkah.some((s) => typeof s?.run === "string"),
          `${langkah.length} langkah`,
        );
        cek(
          `job "${nama}" punya runs-on`,
          typeof doc.jobs[nama]?.["runs-on"] === "string",
          doc.jobs[nama]?.["runs-on"] ?? "-",
        );
      }
    }

    // Semua skrip yang dirujuk workflow harus ADA di repo.
    const skrip = [
      ...new Set(
        [...ci.matchAll(/scripts\/[\w.-]+\.(?:mjs|mts|ps1)/g)].map((m) => m[0]),
      ),
    ];
    for (const s of skrip) {
      cek(`skrip "${s}" ada`, existsSync(path.join(AKAR, s)));
    }

    // Semua skrip npm yang dirujuk harus terdaftar di package.json.
    const pkg = JSON.parse(readFileSync(path.join(AKAR, "package.json"), "utf8"));
    const BUKAN_SKRIP_NPM = new Set([
      "install",
      "exec",
      "mmdc",
      "tsc",
      "vitest",
      "vite",
    ]);
    for (const c of [
      ...new Set([...ci.matchAll(/run: pnpm (?:exec )?([\w:.-]+)/g)].map((m) => m[1])),
    ]) {
      if (BUKAN_SKRIP_NPM.has(c)) continue;
      cek(`skrip npm "${c}" terdaftar di package.json`, !!pkg.scripts?.[c]);
    }

    // Skrip baru yang WAJIB ada di CI (kalau lupa, CI tak mengujinya).
    for (const wajib of [
      "scripts/verifikasi-mermaid.mjs",
      "scripts/audit-isi-generator-node.mjs",
      "scripts/audit-negative-test.mjs",
    ]) {
      cek(
        `CI menjalankan "${wajib}"`,
        ci.includes(wajib),
        "kalau tidak, skrip ini tak diuji di CI",
      );
    }
  }
}

// ================= 2. Git remote =================
console.log("\n== 2. git remote ==");
let remote = "";
try {
  remote = execFileSync("git", ["remote"], { encoding: "utf8" }).trim();
} catch {
  remote = "";
}
let jumlahCommit = 0;
try {
  jumlahCommit = Number(
    execFileSync("git", ["rev-list", "--count", "HEAD"], { encoding: "utf8" }).trim(),
  );
} catch {
  jumlahCommit = 0;
}
if (remote) {
  cek("git remote ada (CI bisa jalan setelah push)", true, remote);
} else {
  // BUKAN kegagalan build - ini laporan, supaya tak terlupa.
  console.log(
    "  [CATATAN] Belum ada git remote. Workflow CI baru bisa dijalankan setelah:",
  );
  console.log("            git remote add origin <url-github> && git push -u origin master");
  console.log(`            (${jumlahCommit} commit lokal siap didorong)`);
}

// ================= 3. Ekspor gambar remote =================
console.log("\n== 3. ekspor gambar remote ==");
const exporter = readFileSync(path.join(AKAR, "src", "lib", "exporter.ts"), "utf8");
cek(
  "exporter mengunduh gambar remote jadi data-URL",
  /urlKeDataUrl/.test(exporter) && /await fetch\(s\)/.test(exporter),
);
cek(
  "kegagalan unduh ditangani (ekspor tetap jalan offline)",
  /catch \{\s*return null;/.test(exporter),
);
const pemanggil = (exporter.match(/urlKeDataUrl\(/g) || []).length;
cek(
  "dipakai di lebih dari 1 jalur ekspor",
  pemanggil >= 2,
  `${pemanggil} pemanggilan`,
);

// ================= 4. Audit isi generator Node =================
console.log("\n== 4. generator Node: buffer & file liar ==");
const pptxGen = readFileSync(
  path.join(AKAR, "src", "generators", "pptx.ts"),
  "utf8",
);
cek(
  "PPTX Node menulis ke buffer dulu (bukan langsung ke file)",
  /outputType: "nodebuffer"/.test(pptxGen) && /pptx\.write\(/.test(pptxGen),
);
cek(
  "PPTX Node menyimpan ke disk hanya kalau outputPath diberikan",
  /if \(outputPath\) \{/.test(pptxGen),
);
cek(
  "PPTX Node mengembalikan buffer (bukan undefined)",
  !/buffer: undefined/.test(pptxGen),
);
cek(
  "blok kode di PPTX Node ber-font monospace",
  /fontFace: "Consolas"/.test(pptxGen),
);

console.log("\nSelesai.");
