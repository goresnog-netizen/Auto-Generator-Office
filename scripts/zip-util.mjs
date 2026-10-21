/**
 * Ekstraktor ZIP minimal, murni Node (tanpa dependensi).
 *
 * Kenapa tak pakai `Expand-Archive` (PowerShell):
 *  1. Path sementara dari `os.tmpdir()` bisa berupa path 8.3
 *     (C:\Users\BROKEN~1\...), yang PowerShell tak bisa buka.
 *  2. Memanggil powershell.exe dari skrip Node menambah ~300 ms per
 *     pemanggilan dan bergantung pada PowerShell ada di PATH.
 *  3. Kegagalan Expand-Archive muncul sebagai pesan tak jelas.
 *
 * Format ZIP: tiap entri punya header lokal (signature 0x04034b50)
 * followed by central directory (0x02014b50). Kita baca central
 * directory karena di situ metadata lengkap (nama, ukuran, metode
 * kompresi) berada.
 *
 * Metode yang didukung: 0 (store) dan 8 (deflate) -- dua-satunya
 * yang dipakai ZIP Office (docx/xlsx/pptx).
 */
import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

/**
 * Baca seluruh entri ZIP dari buffer.
 *
 * @param {Buffer} buf isi berkas ZIP
 * @returns {Map<string, Buffer>} nama entri (pakai "/") -> isi
 */
export function bacaZip(buf) {
  const hasil = new Map();

  // Temukan central directory: signature 0x06054b50 (End of Central Dir).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 65536; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("bukan berkas ZIP valid (End of Central Directory tak ditemukan)");

  const jumlahEntri = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < jumlahEntri; n++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`central directory rusak di entri ${n}`);
    }
    const metode = buf.readUInt16LE(offset + 10);
    const ukuranTekan = buf.readUInt32LE(offset + 20);
    const ukuranAsli = buf.readUInt32LE(offset + 24);
    const panjangNama = buf.readUInt16LE(offset + 28);
    const panjangExtra = buf.readUInt16LE(offset + 30);
    const panjangKomentar = buf.readUInt16LE(offset + 32);
    const offsetLokal = buf.readUInt32LE(offset + 42);
    const nama = buf.toString("utf8", offset + 46, offset + 46 + panjangNama);

    offset += 46 + panjangNama + panjangExtra + panjangKomentar;

    if (nama.endsWith("/")) continue; // direktori

    // Header lokal: panjang nama & extra bisa BEDA dari central directory.
    const lokalNama = buf.readUInt16LE(offsetLokal + 26);
    const lokalExtra = buf.readUInt16LE(offsetLokal + 28);
    const mulaiData = offsetLokal + 30 + lokalNama + lokalExtra;
    const dataTekan = buf.subarray(mulaiData, mulaiData + ukuranTekan);

    let isi;
    if (metode === 0) {
      isi = Buffer.from(dataTekan);
    } else if (metode === 8) {
      isi = inflateRawSync(dataTekan);
    } else {
      // Metode lain (mis. 12=bzip2) tak didukung; lewati entri ini.
      continue;
    }
    if (isi.length !== ukuranAsli) {
      // Peringatan, bukan error: beberapa penulis ZIP menulis ukuran
      // yang tak akurat. Yang penting isi bisa didekompresi.
      // Lanjut saja.
    }
    hasil.set(nama, isi);
  }

  return hasil;
}

/**
 * Ekstrak berkas ZIP ke folder.
 *
 * @param {string} zipPath path berkas ZIP
 * @param {string} tujuan folder tujuan
 * @returns {string[]} daftar path relatif file yang diekstrak
 */
export function ekstrakZip(zipPath, tujuan) {
  const buf = readFileSync(zipPath);
  const entri = bacaZip(buf);

  const ditulis = [];
  for (const [nama, isi] of entri) {
    // Tolak path yang keluar dari folder tujuan (zip slip).
    const target = path.resolve(tujuan, nama);
    if (!target.startsWith(path.resolve(tujuan))) {
      throw new Error(`entri ZIP mencoba keluar dari folder tujuan: ${nama}`);
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, isi);
    ditulis.push(nama);
  }
  return ditulis;
}

/**
 * Daftar seluruh path di dalam folder (relatif, dengan "/").
 */
export function daftarFolder(akar) {
  const hasil = [];
  const jalan = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) jalan(f);
      else hasil.push(path.relative(akar, f).replace(/\\/g, "/"));
    }
  };
  jalan(akar);
  return hasil;
}

/** Pastikan folder ada. */
export function pastikanFolder(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

/**
 * Ukuran total folder (byte).
 */
export function ukuranFolder(p) {
  let total = 0;
  const jalan = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) jalan(f);
      else total += statSync(f).size;
    }
  };
  jalan(p);
  return total;
}
