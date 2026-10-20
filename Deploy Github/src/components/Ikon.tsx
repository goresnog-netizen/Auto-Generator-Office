import React from "react";

// NitZ-909 — Ikon SVG struktural (pengganti emoji, sesuai skill ui-ux-pro-max:
// ikon vektor, stroke konsisten 1.8px, warna ikut currentColor agar hemat token tema).
// Satu gaya garis untuk semua ikon — itulah yang membuat UI terlihat dirancang.

export type NamaIkon =
  | "dokumen"
  | "presentasi"
  | "spreadsheet"
  | "diagram"
  | "pdf"
  | "tambah"
  | "unduh"
  | "impor"
  | "kunci"
  | "simpan"
  | "ai"
  | "hapus"
  | "paket"
  | "statistik"
  | "panduan"
  | "prinsip"
  | "alur"
  | "galeri"
  | "catatan"
  | "info"
  | "cek"
  | "tutup"
  | "cari"
  | "contoh"
  | "laporan"
  | "pelajar"
  | "mahasiswa"
  | "bisnis"
  | "marketing"
  | "toko"
  | "legal"
  | "umum"
  | "akademik"
  | "gambar"
  | "medis"
  | "perisai";

const PATHS: Record<NamaIkon, React.ReactNode> = {
  dokumen: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 16h6" />
    </>
  ),
  presentasi: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v3M8.5 21h7" />
      <path d="M7 8.5l2.5 2L7 12.5M12 8.5h5" />
    </>
  ),
  spreadsheet: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1.5" />
      <path d="M4 9h16M4 14.5h16M10 9v12" />
    </>
  ),
  diagram: (
    <>
      <circle cx="6" cy="6" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M8 7l3 8M16 7l-3 8M8.4 6h7.2" />
    </>
  ),
  pdf: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9.5 15.5c-1.2 0-1.7-.9-1.7-2.3s.6-2.2 1.8-2.2h2.9v4.5" />
    </>
  ),
  tambah: <path d="M12 5v14M5 12h14" />,
  unduh: (
    <>
      <path d="M12 4v11M7.5 11L12 15.5 16.5 11" />
      <path d="M5 19.5h14" />
    </>
  ),
  impor: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  kunci: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="1.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" />
      <circle cx="12" cy="15" r="1.3" />
    </>
  ),
  simpan: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8.5 4v4.5h7V4" />
      <rect x="8.5" y="12.5" width="7" height="7.5" />
    </>
  ),
  ai: (
    <>
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z" />
      <path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  hapus: (
    <>
      <path d="M4.5 6.5h15M9.5 6V4.5h5V6" />
      <path d="M7 6.5l.8 13.5h8.4L17 6.5" />
      <path d="M10 10.5v7M14 10.5v7" />
    </>
  ),
  paket: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M12 12L4.2 7.6M12 12l7.8-4.4M12 12v9" />
    </>
  ),
  statistik: (
    <>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V7M17 20v-9" />
    </>
  ),
  panduan: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5l-2.3 4.7-4.7 2.3 2.3-4.7z" />
    </>
  ),
  prinsip: (
    <>
      <path d="M4 17L17 4l3 3L7 20z" />
      <path d="M8.5 12.5l1.5 1.5M11.5 9.5l1.5 1.5M14.5 6.5L16 8" />
    </>
  ),
  alur: (
    <>
      <circle cx="5.5" cy="12" r="2.5" />
      <circle cx="18.5" cy="6" r="2.5" />
      <circle cx="18.5" cy="18" r="2.5" />
      <path d="M8 12h5.5c2 0 1.5-3.5 3-4.3M8 12h5.5c2 0 1.5 3.5 3 4.3" />
    </>
  ),
  galeri: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </>
  ),
  catatan: (
    <>
      <path d="M5 19l1-4L16.5 4.5a2.1 2.1 0 013 3L9 18z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.6" />
    </>
  ),
  cek: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  tutup: <path d="M6 6l12 12M18 6L6 18" />,
  cari: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  contoh: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 14.5l2 2 4-4.5" />
    </>
  ),
  laporan: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 13l-1.2 3.2L11 15l2 2 3.5-5.5" />
    </>
  ),
  pelajar: (
    <>
      <path d="M12 4L2.5 8.5 12 13l9.5-4.5z" />
      <path d="M6.5 10.5V15c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3v-4.5" />
      <path d="M21.5 8.5V14" />
    </>
  ),
  mahasiswa: (
    <>
      <path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z" />
      <path d="M4 20.5V5.5" />
      <path d="M9 8h7M9 12h5" />
    </>
  ),
  bisnis: (
    <>
      <rect x="4" y="7.5" width="16" height="12.5" rx="1.5" />
      <path d="M9 7.5V6a3 3 0 016 0v1.5" />
      <path d="M4 12.5h16" />
    </>
  ),
  marketing: (
    <>
      <path d="M4 10.5V14a1.5 1.5 0 001.5 1.5H9l6 4v-11l-6-1H5.5A1.5 1.5 0 004 9z" />
      <path d="M18 9.5a3.5 3.5 0 010 5" />
    </>
  ),
  toko: (
    <>
      <path d="M4.5 9.5L6 4h12l1.5 5.5" />
      <path d="M4.5 9.5h15V20h-15z" />
      <path d="M9.5 20v-5h5v5" />
    </>
  ),
  legal: (
    <>
      <path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z" />
      <path d="M9 12l2 2 4-4.5" />
    </>
  ),
  umum: (
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z" />
  ),
  gambar: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M4.5 17.5l4.5-4.5 3 3 3.5-3.5 4 4" />
    </>
  ),
  medis: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  perisai: (
    <path d="M12 3l7.5 3v6c0 4.5-3.2 7.6-7.5 9-4.3-1.4-7.5-4.5-7.5-9V6z" />
  ),
  akademik: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c-5 5-5 12 0 17M12 3.5c5 5 5 12 0 17" />
    </>
  ),
};

export function Ikon({
  nama,
  ukuran = 16,
}: {
  nama: NamaIkon;
  ukuran?: number;
}) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "-3px" }}
    >
      {PATHS[nama]}
    </svg>
  );
}

// Ikon format file untuk kartu template — satu ikon per FORMAT (bukan per template),
// agar galeri terlihat sistematis, bukan tempelan acak.
export function IkonFormat({
  format,
  ukuran = 30,
}: {
  format: string;
  ukuran?: number;
}) {
  const peta: Record<string, NamaIkon> = {
    word: "dokumen",
    pptx: "presentasi",
    xlsx: "spreadsheet",
    diagram: "diagram",
    pdf: "pdf",
  };
  return <Ikon nama={peta[format] ?? "dokumen"} ukuran={ukuran} />;
}
