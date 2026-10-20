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
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const AKAR = process.cwd();
const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

/** Jalankan skrip verifikasi; kembalikan kode keluar. */
function jalankanSkrip() {
  try {
    execFileSync(process.execPath, ["scripts/verifikasi-generators.mjs"], {
      cwd: AKAR,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { kode: 0, keluar: "" };
  } catch (e) {
    return {
      kode: e.status ?? -1,
      keluar: `${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`,
    };
  }
}

/** Balik satu perubahan pada file, jalankan skrip, kembalikan file. */
function ujiRegresi(nama, file,Transformasi, expectGagal = true) {
  const asli = readFileSync(file, "utf8");
  const rusak = Transformasi(asli);
  if (rusak === asli) {
    cek(`${nama}: transformasi tak mengubah berkas (test tak valid)`, false);
    return;
  }
  writeFileSync(file, rusak, "utf8");
  try {
    const hasil = jalankanSkrip();
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

// --- Sanity: setelah semua dibalik, skrip harus lulus lagi ---
const akhir = jalankanSkrip();
cek(
  "D. Setelah semua bug dikembalikan, skrip lulus lagi",
  akhir.kode === 0,
  `exit ${akhir.kode}`,
);

console.log("\nSelesai.");
