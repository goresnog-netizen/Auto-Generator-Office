/**
 * Verifikasi silang: setiap id perintah yang dihasilkan konverter harus
 * benar-benar ada di `deckcraft-cli commands`.
 *
 * Ini menangkap kelas bug yang luput dari unit test: id perintah yang
 * kedengarannya masuk akal tapi tidak ada di engine (mis. `insert.shape`
 * vs `shape.insert`).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const EXE = path.resolve(
  "vendors/deckcraft-bin/app/deckcraft-0.8.0-windows-x64-portable/deckcraft-cli.exe",
);

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

if (!existsSync(EXE)) {
  console.log("Binary deckcraft-cli tidak ada — jalankan `pnpm vendor:deckcraft`.");
  process.exit(0);
}

// Daftar id perintah resmi dari binary.
const keluar = execFileSync(EXE, ["commands"], { encoding: "utf8" });
const perintahResmi = new Set(
  keluar
    .split(/\r?\n/)
    .map((b) => b.split(" —")[0].trim())
    .filter((b) => /^[a-z][a-zA-Z0-9.]*$/.test(b)),
);
console.log(`Perintah resmi terdaftar: ${perintahResmi.size}`);

// Perintah yang dipakai konverter NitZ-909.
const dipakai = [
  "file.new",
  "file.properties",
  "slide.new",
  "insert.textBox",
  "insert.table",
  "insert.chart",
  "insert.picture",
  "insert.smartArt",
  "shape.insert",
  "format.bullets",
];

for (const id of dipakai) {
  cek(`perintah "${id}" ada di engine`, perintahResmi.has(id));
}

// Parameter yang dipakai harus sesuai. Cek beberapa yang berisiko.
const periksaParam = (cmd, cekParams) => {
  const teks = execFileSync(EXE, ["describe", cmd], { encoding: "utf8" });
  for (const p of cekParams) {
    cek(
      `${cmd} menerima parameter "${p}"`,
      teks.includes(p),
      teks.includes(p) ? "" : "tidak ditemukan di describe",
    );
  }
};

periksaParam("shape.insert", ["preset", "rect", "text"]);
periksaParam("insert.smartArt", ["kind", "items"]);
periksaParam("insert.chart", ["type", "categories", "series", "rect"]);
periksaParam("insert.table", ["rows", "cols", "rect"]);
periksaParam("insert.textBox", ["rect", "text"]);
periksaParam("insert.picture", ["data", "name", "rect"]);
periksaParam("file.new", ["theme", "blank"]);
periksaParam("slide.new", ["layout", "title", "body"]);
periksaParam("format.bullets", ["on", "char"]);
periksaParam("file.properties", ["title", "author"]);

// `insert.table` menerima `data` tapi tidak mendokumentasikannya di `describe`
// (lihat crates/engine/src/cmd/insert.rs). Divergence ini harus tercatat.
const deskripsiTable = execFileSync(EXE, ["describe", "insert.table"], {
  encoding: "utf8",
});
cek(
  "insert.table menerima `data` walau tidak didokumentasikan",
  !deskripsiTable.includes("data") &&
    deskripsiTable.includes("rows") &&
    deskripsiTable.includes("cols"),
  "dicek langsung ke source engine",
);

// `insert.smartArt` TIDAK menerima `rect` — parameternya diabaikan diam-diam.
const deskripsiSmart = execFileSync(EXE, ["describe", "insert.smartArt"], {
  encoding: "utf8",
});
cek(
  "insert.smartArt tidak boleh diberi `rect`",
  !deskripsiSmart.includes("rect"),
  deskripsiSmart.includes("rect") ? "MASIH ADA rect" : "aman",
);

// Preset "line" harus benar-benar ada.
const presetOut = execFileSync(
  EXE,
  ["run", "--cmd", "shape.presets", "--print", "--save", path.join(process.env.TEMP || ".", "dc-presets.deckcraft")],
  { encoding: "utf8" },
);
const baris = presetOut.split(/\r?\n/).find((b) => b.includes("shape.presets"));
cek("preset 'line' tersedia", !!baris && baris.includes('"line"'));

console.log("\nSelesai.");
