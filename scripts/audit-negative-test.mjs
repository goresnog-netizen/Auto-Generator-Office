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

// --- G. Mirror Vercel: import statis server/deckcraft-api.ts ---
// Efeknya: build mirror ("Deploy Github/") gagal karena folder `server/`
// tak ikut disalin. Vite tidak bisa menemukan modulnya.
ujiRegresi(
  "G. Mirror Vercel import statis API DeckCraft",
  path.join(AKAR, "Deploy Github", "vite.config.ts"),
  (s) =>
    s.replace(
      'const modul = await import("./server/deckcraft-api.ts");',
      'const modul = { tanganiApi: async () => false }; // simulasi import statis',
    ),
  true,
  "scripts/verifikasi-fitur-deckcraft.mjs",
);

// --- H. Konverter: blok kode tak pakai font monospace ---
// Efeknya: perintah `format.font` hilang, jadi blok kode dirender dengan
// font body (bukan monospace) - persis masalah yang ditangani sesi ini.
ujiRegresi(
  "H. Blok kode tanpa font monospace",
  path.join(AKAR, "src", "lib", "deckcraft-ppt.ts"),
  (s) =>
    s.replace(
      // Pattern dibuat longgar (spasi fleksibel) supaya tak ikut rapuh
      // kalau format indentasi berkode berubah.
      /slideBaru\.push\(\{\s*command: "format\.font",\s*params: \{ family: FONT_KODE \},\s*\}\);\s*/,
      "",
    ),
  true,
  "scripts/verifikasi-fitur-deckcraft.mjs",
);

// --- I. Mirror Vercel: package.json diawali BOM ---
// Efeknya: PostCSS/Vite gagal parse JSON ("Unexpected token '\uFEFF'"),
// jadi build mirror pecah.
{
  const file = path.join(AKAR, "Deploy Github", "package.json");
  const asli = readFileSync(file);
  const rusak = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), asli]);
  writeFileSync(file, rusak);
  try {
    const hasil = jalankanSkrip("scripts/verifikasi-fitur-deckcraft.mjs");
    const barisGagal = (hasil.keluar.match(/\[GAGAL\]/g) || []).length;
    cek(
      "I. Mirror Vercel package.json berkode BOM",
      hasil.kode !== 0 && barisGagal > 0,
      `exit ${hasil.kode}, ${barisGagal} pemeriksaan GAGAL`,
    );
  } finally {
    writeFileSync(file, asli);
  }
}

// --- J. Generator diagram: metadata fallback dibuang ---
// Efeknya: pesan "Chrome tidak ditemukan" / "sintaks Mermaid salah"
// hilang total - user cuma melihat diagram gagal tanpa tahu apa yang kurang.
ujiRegresi(
  "J. Generator diagram buang metadata fallback",
  path.join(AKAR, "src", "generators", "diagram.ts"),
  (s) =>
    // Buang peny-spread metadata: kalau metadata tak diteruskan ke hasil
    // akhir, pesan fallback hilang. Pattern longgar supaya tahan perubahan
    // format.
    s.replace(/\s*\.\.\.\(Object\.keys\(metadataGabung\)\.length > 0[\s\S]{0,120}?:\s*\{\}\),/, ""),
  true,
  "scripts/verifikasi-mermaid.mjs",
);

// --- M. Generator PPTX Node: buffer dikembalikan, tak ada file liar ---
// Efeknya: `generateDocument("pptx", ...)` mengembalikan `buffer: undefined`
// dan menulis file .pptx ke folder kerja tanpa diminta.
ujiRegresi(
  "M. Generator PPTX Node tak kembalikan buffer",
  path.join(AKAR, "src", "generators", "pptx.ts"),
  (s) =>
    s.replace(
      /const buffer = \(await pptx\.write\(\{\s*outputType: "nodebuffer",\s*\}\)\) as Buffer;/,
      "const buffer = undefined as unknown as Buffer;",
    ),
  true,
  "scripts/audit-isi-generator-node.mjs",
);

// --- N. Generator PPTX Node: blok kode jadi bullet biasa ---
// Efeknya: blok kode dirender dengan font body + bullet, jadi tak pernah
// terlihat sebagai kode di PowerPoint.
ujiRegresi(
  "N. Generator PPTX Node blok kode tanpa monospace",
  path.join(AKAR, "src", "generators", "pptx.ts"),
  (s) =>
    // Ganti font monospace dengan font body: hasil PPTX lalu tak punya
    // typeface monospace sama sekali.
    s.replace(/fontFace: "Consolas"/g, 'fontFace: "Arial"'),
  true,
  "scripts/audit-isi-generator-node.mjs",
);

// --- O. Penjaga salah ketik di suite: "Jalarkan" bukan "Jalankan" ---
// Efeknya: satu langkah suite dieksekusi sebagai perintah yang tak dikenal,
// dan karena `$ErrorActionPreference = "Continue"`, suite tetap exit 0
// padahal langkah itu TAK PERNAH jalan. Guard di verifikasi-semua.ps1
// harus menangkapnya.
{
  const file = path.join(AKAR, "scripts", "verifikasi-semua.ps1");
  const asli = readFileSync(file, "utf8");
  const rusak = asli.replace(
    'Jalankan "Typecheck (browser)"',
    'Jalarkan "Typecheck (browser)"',
  );
  if (rusak === asli) {
    cek("O. Penjaga salah ketik: transformasi tak mengubah berkas", false);
  } else {
    writeFileSync(file, rusak, "utf8");
    try {
      const hasil = jalankanSkrip("scripts/verifikasi-semua.ps1");
      cek(
        "O. Penjaga salah ketik di suite menangkap typo",
        hasil.kode !== 0,
        `exit ${hasil.kode}`,
      );
      const pesan = hasil.keluar.split("\n").find((l) => l.includes("ERROR"));
      if (pesan) console.log(`         ${pesan.trim()}`);
    } finally {
      writeFileSync(file, asli, "utf8");
    }
  }
}

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

const akhirDeckcraft = jalankanSkrip("scripts/verifikasi-fitur-deckcraft.mjs");
cek(
  "K. Setelah semua bug dikembalikan, skrip fitur DeckCraft lulus lagi",
  akhirDeckcraft.kode === 0,
  `exit ${akhirDeckcraft.kode}`,
);

const akhirMermaid = jalankanSkrip("scripts/verifikasi-mermaid.mjs");
cek(
  "L. Setelah semua bug dikembalikan, skrip Mermaid lulus lagi",
  akhirMermaid.kode === 0,
  `exit ${akhirMermaid.kode}`,
);

console.log("\nSelesai.");
