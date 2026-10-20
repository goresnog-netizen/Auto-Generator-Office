/**
 * Bagian standar susun-manual NitZ-909
 * 14 potongan isi siap sisip: heading + placeholder, plus
 * varian tabel, grafik, dan alur proses.
 */
import type { ContentBlock } from "../types";
import { b } from "./templates";

export interface BagianStandar {
  id: string;
  nama: string;
  deskripsi: string;
  blocks: ContentBlock[];
}

const ph = (topik: string) => `[Tulis ${topik} di sini]`;

const seksiTeks = (
  id: string,
  judul: string,
  topik: string,
): ContentBlock[] => [
  b(`${id}-j`, { type: "heading", level: 2, text: judul }),
  b(`${id}-p`, { type: "paragraph", text: ph(topik) }),
];

export const BAGIAN_STANDAR: BagianStandar[] = [
  {
    id: "identitas_dokumen",
    nama: "Identitas Dokumen",
    deskripsi: "Nomor, tanggal, unit, dan penanggung jawab.",
    blocks: seksiTeks(
      "bd-identitas",
      "Identitas Dokumen",
      "nomor dokumen, tanggal, unit kerja, dan penanggung jawab",
    ),
  },
  {
    id: "ringkasan",
    nama: "Ringkasan",
    deskripsi: "Ringkasan isi satu paragraf.",
    blocks: seksiTeks("bd-ringkas", "Ringkasan", "ringkasan isi dokumen"),
  },
  {
    id: "latar_belakang",
    nama: "Latar Belakang",
    deskripsi: "Konteks dan alasan penyusunan.",
    blocks: seksiTeks(
      "bd-latar",
      "Latar Belakang",
      "konteks dan alasan penyusunan dokumen",
    ),
  },
  {
    id: "tujuan",
    nama: "Tujuan",
    deskripsi: "Tujuan dan sasaran yang ingin dicapai.",
    blocks: seksiTeks(
      "bd-tujuan",
      "Tujuan",
      "tujuan dan sasaran yang ingin dicapai",
    ),
  },
  {
    id: "ruang_lingkup",
    nama: "Ruang Lingkup",
    deskripsi: "Batasan materi, waktu, dan cakupan unit.",
    blocks: seksiTeks(
      "bd-lingkup",
      "Ruang Lingkup",
      "batasan materi, periode waktu, dan cakupan unit kerja",
    ),
  },
  {
    id: "pelaksanaan",
    nama: "Pelaksanaan",
    deskripsi: "Uraian tahapan pelaksanaan kegiatan.",
    blocks: seksiTeks(
      "bd-laksana",
      "Pelaksanaan",
      "uraian tahapan pelaksanaan kegiatan",
    ),
  },
  {
    id: "hasil",
    nama: "Hasil",
    deskripsi: "Hasil yang dicapai secara ringkas.",
    blocks: seksiTeks("bd-hasil", "Hasil", "hasil yang dicapai secara ringkas"),
  },
  {
    id: "kendala",
    nama: "Kendala",
    deskripsi: "Hambatan yang ditemui selama pelaksanaan.",
    blocks: seksiTeks(
      "bd-kendala",
      "Kendala",
      "hambatan yang ditemui selama pelaksanaan",
    ),
  },
  {
    id: "kesimpulan",
    nama: "Kesimpulan",
    deskripsi: "Simpulan utama dokumen.",
    blocks: seksiTeks("bd-simpul", "Kesimpulan", "simpulan utama dokumen"),
  },
  {
    id: "rekomendasi",
    nama: "Rekomendasi",
    deskripsi: "Saran tindak lanjut yang konkret.",
    blocks: seksiTeks(
      "bd-saran",
      "Rekomendasi",
      "saran tindak lanjut yang konkret",
    ),
  },
  {
    id: "lampiran",
    nama: "Lampiran",
    deskripsi: "Daftar dokumen pendukung.",
    blocks: seksiTeks(
      "bd-lampir",
      "Lampiran",
      "daftar dokumen pendukung dan keterangannya",
    ),
  },
  {
    id: "tabel_data",
    nama: "Tabel Data",
    deskripsi: "Tabel kosong 3 kolom untuk diisi manual.",
    blocks: [
      b("bd-tabel-j", { type: "heading", level: 2, text: "Tabel Data" }),
      b("bd-tabel-p", {
        type: "paragraph",
        text: ph("keterangan atau ringkasan tabel"),
      }),
      b("bd-tabel-t", {
        type: "table",
        headers: ["Kolom 1", "Kolom 2", "Kolom 3"],
        rows: [
          ["Contoh 1", "Contoh 2", "Contoh 3"],
          ["Contoh 4", "Contoh 5", "Contoh 6"],
        ],
        caption: "Tabel data",
      }),
    ],
  },
  {
    id: "grafik_data",
    nama: "Grafik Data",
    deskripsi: "Grafik batang contoh 3 label.",
    blocks: [
      b("bd-grafik-j", { type: "heading", level: 2, text: "Grafik Data" }),
      b("bd-grafik-p", {
        type: "paragraph",
        text: ph("keterangan atau sorotan grafik"),
      }),
      b("bd-grafik-c", {
        type: "chart",
        chartType: "bar",
        data: {
          labels: ["Kelompok A", "Kelompok B", "Kelompok C"],
          datasets: [{ label: "Nilai", data: [4, 6, 5] }],
        },
      }),
    ],
  },
  {
    id: "alur_proses",
    nama: "Alur Proses",
    deskripsi: "Diagram 3 langkah plus penjelasan.",
    blocks: [
      b("bd-alur-j", { type: "heading", level: 2, text: "Alur Proses" }),
      b("bd-alur-p", {
        type: "paragraph",
        text: ph("penjelasan singkat tiap langkah alur"),
      }),
      b("bd-alur-d", {
        type: "diagram",
        diagramType: "mermaid",
        source: "graph LR; A[Mulai] --> B[Proses]; B --> C[Selesai];",
      }),
    ],
  },
];

export const getBagian = (id: string) =>
  BAGIAN_STANDAR.find((s) => s.id === id);
