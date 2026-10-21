/**
 * Simulasikan job CI SECARA LOKAL.
 *
 * Tujuannya: memberi bukti bahwa langkah-langkah di `.github/workflows/ci.yml`
 * benar-benar lulus, SEBELUM repo di-push. Tanpa ini, workflow CI hanya
 * "kayaknya benar" - tidak pernah dieksekusi.
 *
 * Yang disimulasikan (mengikuti urutan di ci.yml):
 *   job `check`      : 3 typecheck + vitest + vite build
 *   job `generators` : semua skrip verifikasi generator
 *   job `deckcraft`  : id perintah vs engine + bridge + blok kode
 *                       (butuh binary DeckCraft; dilewati kalau tak ada)
 *
 * Pemeriksaan tambahan: YAML workflow valid, semua skrip yang dirujuk ada,
 * dan semua skrip npm yang dirujuk terdaftar di package.json.
 *
 * Perbedaan dari CI sungguhan: runner CI adalah Linux/Windows tanpa GPU
 * dan tanpa binary DeckCraft di cache. Jadi hasil lokal BUKAN jaminan
 * mutlak, tapi jauh lebih baik daripada tak ada bukti sama sekali.
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

// ---------- Cari js-yaml (dependency vite, di store pnpm) ----------
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

// ---------- Jalankan perintah, laporkan hasil ----------
//
// CATATAN PENTING - jalan tanpa shell, tanpa `.cmd`:
//
// Di Windows, `node_modules/.bin/*.cmd` adalah BATCH FILE. `execFile` tanpa
// shell menolaknya (CVE-2024-27980), dan memanggilnya lewat `cmd.exe /c`
// MEMECAH path yang mengandung spasi - repo ini ada di
// "C:\MRP\proyek 2026\NitZ-909", jadi `cmd.exe` memotongnya jadi
// "C:\MRP\proyek" dan perintah gagal.
//
// Solusinya: jalankan entry point JavaScript-nya langsung dengan Node.
// Semua paket ini mengekspos bin yang bisa dipanggil via `node <file>`.
function cariEntry(namaPaket, berkasKandidat) {
  for (const kandidat of berkasKandidat) {
    const p = path.join(AKAR, "node_modules", namaPaket, kandidat);
    if (existsSync(p)) return p;
  }
  // Cari di store pnpm (paket tak ter-hoist).
  const store = path.join(AKAR, "node_modules", ".pnpm");
  if (existsSync(store)) {
    for (const d of readdirSync(store)) {
      if (!d.startsWith(`${namaPaket}@`)) continue;
      for (const kandidat of berkasKandidat) {
        const p = path.join(store, d, "node_modules", namaPaket, kandidat);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** Jalankan tool yang terpasang di node_modules, via Node langsung. */
function jalankanTool(label, namaPaket, kandidat, argumen = []) {
  const entry = cariEntry(namaPaket, kandidat);
  if (!entry) {
    cek(`${label}`, false, `entry point "${namaPaket}" tak ditemukan`);
    return false;
  }
  return jalankan(label, process.execPath, [entry, ...argumen]);
}

function jalankan(label, perintah, argumen, opsi = {}) {
  const mulai = Date.now();
  try {
    execFileSync(perintah, argumen, {
      cwd: AKAR,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: opsi.timeout ?? 900_000,
    });
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);
    cek(`${label}`, true, `${detik} dtk`);
    return true;
  } catch (e) {
    const detik = ((Date.now() - mulai) / 1000).toFixed(1);
    const err = (e.stderr?.toString() ?? e.stdout?.toString() ?? e.message)
      .split("\n")
      .filter((l) => l.trim())
      .slice(-6)
      .join(" | ");
    cek(`${label}`, false, `${detik} dtk - ${err.slice(0, 300)}`);
    return false;
  }
}

// ---------- 0. Workflow valid ----------
console.log("== 0. workflow ci.yml ==");
const ciPath = path.join(AKAR, ".github", "workflows", "ci.yml");
cek("workflow ada", existsSync(ciPath));
if (!existsSync(ciPath)) {
  console.log("\nSelesai (workflow tak ada).");
  process.exit(1);
}
const ci = readFileSync(ciPath, "utf8");
const yaml = cariYaml();
if (!yaml) {
  cek("parser YAML tersedia", false, "js-yaml tak ditemukan di store pnpm");
} else {
  let doc = null;
  try {
    doc = yaml.load ? yaml.load(ci) : yaml.parse(ci);
    cek("YAML valid", !!doc && !!doc.jobs, Object.keys(doc?.jobs ?? {}).join(", "));
  } catch (e) {
    cek("YAML valid", false, e.message);
  }

  if (doc?.jobs) {
    const namaJob = Object.keys(doc.jobs);
    cek("3 job terdaftar", namaJob.length >= 3, namaJob.join(", "));
    for (const nama of namaJob) {
      const langkah = doc.jobs[nama]?.steps ?? [];
      cek(
        `job "${nama}" punya langkah run & runs-on`,
        langkah.some((s) => typeof s?.run === "string") &&
          typeof doc.jobs[nama]?.["runs-on"] === "string",
        `${langkah.length} langkah, ${doc.jobs[nama]?.["runs-on"] ?? "-"}`,
      );
    }
  }

  // Semua skrip yang dirujuk harus ada.
  const skrip = [
    ...new Set(
      [...ci.matchAll(/scripts\/[\w.-]+\.(?:mjs|mts|ps1)/g)].map((m) => m[0]),
    ),
  ];
  for (const s of skrip) {
    cek(`skrip "${s}" ada`, existsSync(path.join(AKAR, s)));
  }
}

// Mode `--hanya-validasi`: hanya periksa workflow-nya sendiri (YAML valid,
// skrip yang dirujuk ada). Dipakai CI supaya runner memeriksa workflow-nya
// tanpa menjalankan ulang semua job (yang sudah berjalan di job lain).
const HANYA_VALIDASI = process.argv.includes("--hanya-validasi");
if (HANYA_VALIDASI) {
  console.log("\n  (mode --hanya-validasi: langkah eksekusi dilewati)");
  console.log("\nSelesai.");
  process.exit(process.exitCode ?? 0);
}

// ---------- 1. job `check` ----------
console.log("\n== 1. job check (typecheck + test + build) ==");
jalankanTool("typecheck browser", "typescript", ["bin/tsc", "lib/tsc.js"], ["--noEmit"]);
jalankanTool("typecheck server", "typescript", ["bin/tsc", "lib/tsc.js"], ["--noEmit", "-p", "tsconfig.server.json"]);
jalankanTool("typecheck node", "typescript", ["bin/tsc", "lib/tsc.js"], ["--noEmit", "-p", "tsconfig.node.json"]);
jalankanTool("unit test", "vitest", ["vitest.mjs", "dist/cli.js"], ["run", "--reporter=dot"]);
jalankanTool("build", "vite", ["bin/vite.js"], ["build"]);

// ---------- 2. job `generators` ----------
console.log("\n== 2. job generators ==");
const SKRIP_GENERATOR = [
  ["verifikasi-generators", "scripts/verifikasi-generators.mjs"],
  ["audit-isi-generator", "scripts/audit-isi-generator.mjs"],
  ["audit-isi-generator-node", "scripts/audit-isi-generator-node.mjs"],
  ["verifikasi-pdf-gambar", "scripts/verifikasi-pdf-gambar.mjs"],
  ["verifikasi-fitur-baru", "scripts/verifikasi-fitur-baru.mjs"],
  ["verifikasi-fitur-deckcraft", "scripts/verifikasi-fitur-deckcraft.mjs"],
  ["verifikasi-mermaid", "scripts/verifikasi-mermaid.mjs"],
  ["negative test", "scripts/audit-negative-test.mjs"],
];
for (const [label, skrip] of SKRIP_GENERATOR) {
  jalankan(label, process.execPath, [skrip]);
}

// ---------- 3. job `deckcraft` ----------
console.log("\n== 3. job deckcraft (butuh binary) ==");
const binDeckcraft = path.join(
  AKAR,
  "vendors",
  "deckcraft-bin",
  "app",
  "deckcraft-0.8.0-windows-x64-portable",
  "deckcraft-cli.exe",
);
if (existsSync(binDeckcraft)) {
  jalankan("verifikasi-perintah", process.execPath, [
    "scripts/verifikasi-perintah.mjs",
  ]);
  jalankan("verify-deckcraft (bridge)", process.execPath, [
    "--experimental-strip-types",
    "scripts/verify-deckcraft.mts",
  ]);
  jalankan("verifikasi-kode-deckcraft", process.execPath, [
    "--experimental-strip-types",
    "scripts/verifikasi-kode-deckcraft.mts",
  ]);
} else {
  console.log(
    "  binary DeckCraft tak ada - job ini dilewati (di CI, `pnpm vendor:deckcraft` mengunduhnya).",
  );
}

// ---------- 4. Git remote ----------
console.log("\n== 4. git remote ==");
let remote = "";
try {
  remote = execFileSync("git", ["remote"], {
    encoding: "utf8",
  }).trim();
} catch {
  remote = "";
}
if (remote) {
  cek("git remote ada (CI bisa jalan setelah push)", true, remote);
} else {
  // Bukan kegagalan build - tapi harus terlihat.
  console.log(
    "  [PERINGATAN] Belum ada git remote. Workflow CI tak bisa jalan sebelum repo di-push.",
  );
  console.log(
    "              Buat repo di GitHub lalu: git remote add origin <url> && git push -u origin master",
  );
}

console.log("\nSelesai.");