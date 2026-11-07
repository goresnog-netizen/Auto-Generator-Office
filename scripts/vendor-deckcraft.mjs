#!/usr/bin/env node
/**
 * Dispatcher vendoring DeckCraft.
 *
 * `package.json` hanya punya satu perintah `vendor:deckcraft`, sementara
 * skrip sebenarnya berbeda per platform:
 *
 *   Windows  -> scripts/vendor-deckcraft.ps1  (PowerShell, unduh .zip)
 *   Linux    -> scripts/vendor-deckcraft.sh   (bash, unduh .tar.gz)
 *   macOS    -> scripts/vendor-deckcraft.sh   (bash, unduh .zip universal)
 *
 * Sebelumnya `vendor:deckcraft` memanggil PowerShell langsung, sehingga di
 * Linux/macOS perintah itu selalu gagal. Dispatcher ini memilih skrip yang
 * benar dan meneruskan argumen versi (opsional).
 *
 * Pemakaian:
 *   npm run vendor:deckcraft
 *   npm run vendor:deckcraft -- 0.8.0
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ini = path.dirname(fileURLToPath(import.meta.url));
const akar = path.resolve(ini, "..");

/** Argumen pertama yang bukan flag diteruskan sebagai versi. */
const versi = process.argv.slice(2).find((a) => !a.startsWith("-"));

function jalankan(perintah, argumen, keterangan) {
  console.log(`== Vendoring DeckCraft (${keterangan}) ==`);
  const anak = spawn(perintah, argumen, {
    cwd: akar,
    stdio: "inherit",
    shell: false,
  });
  anak.on("error", (e) => {
    console.error(`Gagal menjalankan ${perintah}: ${e.message}`);
    process.exit(1);
  });
  anak.on("exit", (kode) => process.exit(kode ?? 1));
}

if (process.platform === "win32") {
  const skrip = path.join(akar, "scripts", "vendor-deckcraft.ps1");
  if (!existsSync(skrip)) {
    console.error(`Skrip tidak ditemukan: ${skrip}`);
    process.exit(1);
  }
  const argumen = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    skrip,
  ];
  if (versi) argumen.push("-Versi", versi);
  jalankan("powershell", argumen, "Windows");
} else {
  const skrip = path.join(akar, "scripts", "vendor-deckcraft.sh");
  if (!existsSync(skrip)) {
    console.error(`Skrip tidak ditemukan: ${skrip}`);
    process.exit(1);
  }
  // `bash` dipanggil eksplisit: berkas .sh belum tentu punya bit executable
  // setelah checkout di beberapa filesystem (mis. mount Windows).
  jalankan("bash", [skrip, ...(versi ? [versi] : [])], process.platform);
}
