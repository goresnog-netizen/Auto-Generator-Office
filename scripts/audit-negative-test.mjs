/**
 * Negative test: apakah skrip verifikasi benar-benar menangkap regresi?
 *
 * Metode: balik satu bug yang PERNAH ada, jalankan skrip, pastikan GAGAL
 * (exit != 0), lalu kembalikan. Kalau skrip tetap lulus saat bug-nya
 * dibalik, skrip itu tidak berguna.
 *
 * Bug yang diuji:
 *  A. PDF: nomor halaman ditulis di `page.height - 50` (di bawah maxY)
 *     → pdfkit menambah halaman kosong → jumlah label ≠ jumlah halaman.
 *  B. XLSX: nilai sel dikembalikan sebagai objek `{text, font}`
 *     → exceljs menulis JSON mentah.
 *  C. DOCX: reference numbering tak terdaftar
 *     → docx menulis numId literal `{...}`.
 *  D. PDF gambar: `muatGambar` selalu mengembalikan null (gambar tak pernah
 *     tertanam) → PDF tak punya XObject /Subtype /Image.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const AKAR = process.cwd();
const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

/**
 * Jalankan skrip verifikasi; kembalikan kode keluar.
 *
 * Render Mermaid butuh Chrome dan bisa gagal sesaat (proses lambat,
 * timeout, lock sementara). Supaya fluktuasi tak salah dibaca sebagai
 * regresi, kegagalan dicoba ulang sekali. Kalau tetap gagal, hasilnya
 * dianggap gagal.
 */
function jalankanSkrip(skrip = "scripts/verifikasi-generators.mjs") {
  let terakhir = { kode: -1, keluar: "" };
  for (let percobaan = 0; percobaan < 2; percobaan++) {
    try {
      execFileSync(process.execPath, [skrip], {
        cwd: AKAR,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 300_000,
      });
      return { kode: 0, keluar: "" };
    } catch (e) {
      terakhir = {
        kode: e.status ?? -1,
        keluar: `${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`,
      };
      // Kalau skrip sempat mencetak [GAGAL], ini regresi yang SENGAJA
      // (_dan_| bukan fluktuasi) — tak perlu diulang.
      if (terakhir.keluar.includes("[GAGAL]")) return terakhir;
    }
  }
  return terakhir;
}

/** Balik satu perubahan pada file, jalankan skrip, kembalikan file. */
function ujiRegresi(
  nama,
  file,
  Transformasi,
  expectGagal = true,
  skrip = "scripts/verifikasi-generators.mjs",
) {
  const asli = readFileSync(file, "utf8");
  const rusak = Transformasi(asli);
  if (rusak === asli) {
    cek(`${nama}: transformasi tak mengubah berkas (test tak valid)`, false);
    return;
  }
  writeFileSync(file, rusak, "utf8");
  try {
    const hasil = jalankanSkrip(skrip);
    const gagal = hasil.kode !== 0;
    const barisGagal = (hasil.keluar.match(/\[GAGAL\]/g) || []).length;
    cek(
      `${nama}: skrip menangkap regresi (exit ${hasil.kode})`,
      gagal === expectGagal,
      `${barisGagal} pemeriksaan GAGAL`,
    );
    if (gagal) {
      const contoh = hasil.keluar
        .split("\n")
        .filter((b) => b.includes("[GAGAL]"))
        .slice(0, 2)
        .map((b) => b.trim());
      for (const c of contoh) console.log(`         ${c}`);
    }
  } finally {
    writeFileSync(file, asli, "utf8");
  }
}

// --- A. PDF: nomor halaman di luar maxY ---
ujiRegresi(
  "A. PDF nomor halaman di bawah maxY",
  path.join(AKAR, "src", "generators", "pdf.ts"),
  (s) => s.replace("doc.page.maxY() - 20", "doc.page.height - 50"),
);

// --- B. XLSX: nilai sel jadi objek {text, font} ---
// Kode asli: `worksheet.addRow(row.map((sel) => sel.nilai))` — nilai sel
// primitif. Di balik jadi objek, exceljs menulis JSON mentah.
ujiRegresi(
  "B. XLSX nilai sel jadi objek",
  path.join(AKAR, "src", "generators", "xlsx.ts"),
  (s) =>
    s.replace(
      "worksheet.addRow(row.map((sel) => sel.nilai))",
      "worksheet.addRow(row.map((sel) => ({ text: String(sel.nilai) })))",
    ),
);

// --- C. DOCX: entri numbering "tanpa urutan" dihapus dari config ---
// Efeknya sama dengan reference tak terdaftar: docx menulis
// numId literal "{list-tanpa-urutan-0}" dan .docx rusak di Word.
ujiRegresi(
  "C. DOCX numbering tak terdaftar",
  path.join(AKAR, "src", "generators", "word.ts"),
  (s) => {
    // Hapus blok config untuk REFERENCE_TANPA_URUTAN.
    const pola = /\n            \{\n              reference: REFERENCE_TANPA_URUTAN,\n              levels: \[[\s\S]*?\n              \],\n            \},/;
    const baru = s.replace(pola, "");
    if (baru === s) {
      // Cadangan: ganti reference di config dengan yang tak terdaftar.
      return s.replace(
        "reference: REFERENCE_TANPA_URUTAN,",
        'reference: "reference-yang-tak-terdaftar",',
      );
    }
    return baru;
  },
);

// --- D. PDF: gambar tak pernah dimuat (muatGambar selalu null) ---
// Efeknya: `renderImage` jatuh ke keterangan teks, PDF tak punya
// XObject /Subtype /Image sama sekali.
ujiRegresi(
  "D. PDF gambar tak pernah tertanam",
  path.join(AKAR, "src", "generators", "pdf.ts"),
  (s) => s.replace("const buf = await this.muatGambar(block.src);", "const buf = null;"),
  true,
  "scripts/verifikasi-pdf-gambar.mjs",
);

// --- Sanity: setelah semua dibalik, skrip harus lulus lagi ---
const akhir = jalankanSkrip();
cek(
  "E. Setelah semua bug dikembalikan, skrip lulus lagi",
  akhir.kode === 0,
  `exit ${akhir.kode}`,
);

const akhirGambar = jalankanSkrip("scripts/verifikasi-pdf-gambar.mjs");
cek(
  "F. Setelah semua bug dikembalikan, skrip gambar lulus lagi",
  akhirGambar.kode === 0,
  `exit ${akhirGambar.kode}`,
);

console.log("\nSelesai.");
