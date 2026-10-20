/**
 * Verifikasi fitur yang diselesaikan pada sesi terakhir.
 *
 * Ini skrip STATIS: ia membaca berkas sumber dan memeriksa struktur yang
 * dijamin ada. Gunanya sebagai pagar regresi murah — bisa jalan di CI tanpa
 * browser, tanpa binary DeckCraft, tanpa API key.
 *
 * Yang diperiksa:
 *  1. Workflow CI GitHub Actions ada & punya langkah yang benar.
 *  2. Auto-Generate punya tombol undo/redo khusus (bukan hanya undo umum).
 *  3. Riwayat auto-generate pakai ref (aman dari state basi).
 *  4. Pesan DeckCraft membedakan "API tak ada" dari "binary belum ada".
 *  5. Generator diagram mengdiagnosis kebutuhan Chrome.
 *  6. Generator diagram tak memakai `exec` (shell) — anti command injection.
 *  7. Generator PDF mengembed gambar (bukan placeholder teks).
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const AKAR = process.cwd();
const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

const baca = (p) => readFileSync(path.join(AKAR, p), "utf8");

// ---------- 1. Workflow CI ----------
{
  const p = ".github/workflows/ci.yml";
  cek("ci: berkas workflow ada", existsSync(path.join(AKAR, p)), p);
  if (existsSync(path.join(AKAR, p))) {
    const y = baca(p);
    cek("ci: memicu saat push & pull_request", /on:\s*[\s\S]*push:/.test(y) && /pull_request:/.test(y));
    cek(
      "ci: punya job typecheck/test/build",
      /typecheck/i.test(y) && /vitest run/.test(y) && /vite build/.test(y),
    );
    cek("ci: menjalankan verifikasi generator", /verifikasi-generators\.mjs/.test(y));
    cek("ci: menjalankan negative test", /audit-negative-test\.mjs/.test(y));
    cek("ci: menjalankan verifikasi gambar PDF", /verifikasi-pdf-gambar\.mjs/.test(y));
    cek("ci: pnpm install pakai lockfile", /--frozen-lockfile/.test(y));
  }
}

// ---------- 2-3. Auto-Generate undo/redo ----------
{
  const ag = baca("src/components/AutoGenerate.tsx");
  const app = baca("src/components/App.tsx");

  cek("undo: panel punya tombol 'Batalkan Generate'", ag.includes("Batalkan Generate"));
  cek("undo: panel punya tombol 'Ulangi Generate'", ag.includes("Ulangi Generate"));
  cek("undo: tombol Nonaktif saat tak ada riwayat", /disabled=\{!bisaUndoAuto\}/.test(ag) && /disabled=\{!bisaRedoAuto\}/.test(ag));
  cek("undo: panel menerima prop canUndo/canRedo", /bisaUndoAuto\?: boolean/.test(ag) && /bisaRedoAuto\?: boolean/.test(ag));

  cek("undo: App menyimpan riwayat auto-generate", /riwayatAuto/.test(app));
  cek("undo: App menyediakan handler undo & redo", /onUndoAuto/.test(app) && /onRedoAuto/.test(app));
  // Penulisan riwayat harus lewat ref: state saja bisa basi karena React
  // membatching update → riwayat tertimpa dan undo kehilangan langkah.
  cek(
    "undo: riwayat ditulis lewat ref (aman dari state basi)",
    /riwayatAutoRef\.current\s*=/.test(app) && /indeksAutoRef\.current\s*=/.test(app),
  );
  cek("undo: undo mengembalikan judul dokumen", /setJudul\(s\.judul\)/.test(app));
  cek("undo: riwayat dibatasi (tak tumbuh tanpa batas)", /\.slice\(-20\)/.test(app));
}

// ---------- 4. Pesan DeckCraft ----------
{
  const dc = baca("src/components/DeckCraftStudio.tsx");
  const klien = baca("src/lib/deckcraft-client.ts");

  cek(
    "deckcraft: UI membedakan API tak ada vs binary belum ada",
    /apiTanpaServer/.test(dc) && /tidak menyediakan API DeckCraft/.test(dc),
  );
  cek("deckcraft: UI menawarkan opsi pnpm serve", dc.includes("pnpm serve"));
  cek("deckcraft: UI menyebut perintah vendor:deckcraft", dc.includes("vendor:deckcraft"));
  cek(
    "deckcraft: UI menyatakan fitur lain tetap jalan",
    dc.includes("tetap berfungsi tanpa DeckCraft"),
  );
  // Selektor CSS yang tidak match di state default tetap harus punya
  // elemen pasangannya di DOM. Kalau class di CSS tak ada di komponen,
    // itu dead CSS sungguhan, bukan "kondisi langka".
  cek(
    "deckcraft: DOM punya <p> di dalam .dc-kosong",
    /<div className="dc-kosong">[\s\S]*?<p>/.test(dc),
  );
  cek(
    "deckcraft: DOM punya elemen .dc-catatan",
    /className="dc-catatan"/.test(dc),
  );
  cek(
    "deckcraft: DOM punya <code> di dalam .dc-kosong",
    /<code>pnpm serve<\/code>/.test(dc),
  );
  cek(
    "deckcraft: klien mengenali respons non-JSON (hosting statis)",
    /tidak menyediakan API DeckCraft/.test(klien) && /content-type/.test(klien),
  );
  cek("deckcraft: status API tak ada tak melempar galat", /catch \(e\)[\s\S]*GalatDeckcraft/.test(klien));
}

// ---------- 5-6. Generator diagram ----------
{
  const dg = baca("src/generators/diagram.ts");
  cek("diagram: mendiagnosis kebutuhan Chrome", /butuhChrome/.test(dg) && /Chrome\/Chromium tidak ditemukan/.test(dg));
  cek("diagram: pesan fallback menyebut mermaid-cli", /mermaid-cli/i.test(dg));
  // Anti command injection: tak boleh ada `exec(` (shell) di modul ini.
  cek(
    "diagram: tak memakai exec()/shell",
    !/\bexecAsync\b/.test(dg) && !/exec\(/.test(dg.replace(/execFile/g, "")),
    "execFile aman",
  );
  cek("diagram: judul dokumen disanitasi sebelum masuk nama berkas", /judulAman/.test(dg));
  cek("diagram: detail teknis error dipisah dari pesan user", /detail: pesanError/.test(dg));
}

// ---------- 7. Generator PDF embed gambar ----------
{
  const pdf = baca("src/generators/pdf.ts");
  cek("pdf: punya muatGambar (data URL / path / URL)", /muatGambar/.test(pdf));
  cek("pdf: punya pembaca dimensi PNG/JPEG", /dimensiGambar/.test(pdf) && /readUInt32BE/.test(pdf));
  cek("pdf: gambar benar-benar digambar (doc.image)", /doc\.image\(/.test(pdf));
  cek("pdf: tak ada placeholder '[Image: ' lagi", !pdf.includes("[Image: "));
  cek("pdf: fallback teks untuk gambar tak terbaca", /tidak dapat ditampilkan/.test(pdf));
}

console.log("\nSelesai.");
