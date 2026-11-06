/**
 * Sistem Desain Presentasi — NitZ-909
 *
 * Modul ini mengubah `ContentBlock[]` menjadi deck PowerPoint yang tertata,
 * bukan sekadar menumpahkan teks ke slide. Isinya tiga lapis:
 *
 *  1. **Tema** (`TEMA_PPT`) — palet, tipografi, pola latar, dan bentuk aksen.
 *     Sembilan tema siap pakai, dari Swiss Editorial sampai Olive Lapangan.
 *  2. **Layout** — fungsi per jenis slide: sampul, agenda, pemisah bagian,
 *     isi, KPI, tabel, grafik, proses, kutipan, gambar, kode, penutup.
 *  3. **Perencana** (`susunDeckPpt`) — membaca blok, mengelompokkannya jadi
 *     slide, dan memilih layout yang tepat untuk tiap kelompok.
 *
 * Geometri mengikuti slide 16:9 (13,333 × 7,5 inci). Semua koordinat dalam
 * inci, semua ukuran font dalam poin.
 *
 * Catatan teknis:
 *  - pptxgenjs mencocokkan tipe grafik secara case-sensitive; tipe di sini
 *    selalu huruf kecil (tipe huruf besar menghasilkan bingkai kosong tanpa
 *    error — bug yang pernah terjadi di jalur ekspor lama).
 *  - Warna ditulis 6 digit heksadesimal TANPA tanda '#'.
 */
import type PptxGenJS from "pptxgenjs";
import type {
  ChartBlock,
  ContentBlock,
  DiagramBlock,
  ImageBlock,
  ListBlock,
  TableBlock,
} from "../types";

type Slide = PptxGenJS.Slide;

/* =====================================================================
 * GEOMETRI
 * ===================================================================== */

/** Lebar & tinggi slide 16:9 (inci). */
const W = 13.333;
const H = 7.5;
/** Margin kiri/kanan. */
const M = 0.78;
/** Lebar area konten. */
const CW = W - M * 2;
/** Awal area isi (di bawah judul + garis aksen). */
const ATAS = 1.98;
/** Garis kaki slide. */
const KAKI = 6.9;

/* =====================================================================
 * WARNA
 * ===================================================================== */

function keRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const penuh =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.padEnd(6, "0").slice(0, 6);
  return [
    parseInt(penuh.slice(0, 2), 16),
    parseInt(penuh.slice(2, 4), 16),
    parseInt(penuh.slice(4, 6), 16),
  ];
}

function keHex(n: number): string {
  return Math.min(255, Math.max(0, Math.round(n)))
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/**
 * Campur dua warna. `t = 0` menghasilkan `a`, `t = 1` menghasilkan `b`.
 * Dipakai untuk membuat tint (warna aksen yang dilembutkan ke arah latar)
 * tanpa perlu mendaftarkan puluhan variasi warna di tema.
 */
export function campur(a: string, b: string, t: number): string {
  const k = Math.min(1, Math.max(0, t));
  const [r1, g1, b1] = keRgb(a);
  const [r2, g2, b2] = keRgb(b);
  return `${keHex(r1 + (r2 - r1) * k)}${keHex(g1 + (g2 - g1) * k)}${keHex(
    b1 + (b2 - b1) * k,
  )}`;
}

/** Warna teks yang terbaca di atas `latar` (hitam pekat atau putih). */
export function kontras(latar: string): string {
  const [r, g, b] = keRgb(latar);
  // Luminance relatif kasar — cukup untuk memilih hitam/putih.
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.58 ? "121212" : "FFFFFF";
}

/* =====================================================================
 * TEMA
 * ===================================================================== */

export type ModeTema = "terang" | "gelap";

/** Pola latar yang digambar di belakang isi slide. */
export type PolaLatar = "grid" | "mesh" | "pita" | "blok" | "diagonal" | "polos";

export interface WarnaTema {
  latar: string;
  latarAlt: string;
  permukaan: string;
  primer: string;
  aksen: string;
  teks: string;
  teksLembut: string;
  garis: string;
  pita: string;
}

export interface TipografiTema {
  /** Font judul slide & sampul. */
  judul: string;
  /** Font isi, tabel, dan keterangan. */
  isi: string;
  /** Font angka besar (KPI). */
  angka: string;
  /** Font blok kode. */
  mono: string;
}

/**
 * Gradien latar. Ditulis sebagai data, bukan gambar: nilainya dipakai untuk
 * membangkitkan satu citra JPEG saat ekspor (lihat `gradienLatar`).
 */
export interface GradienLatar {
  dari: string;
  ke: string;
  /** Sudut arah gradien dalam derajat (0 = kiri→kanan, 135 = diagonal). */
  sudut: number;
  jenis?: "linear" | "radial";
}

export interface TemaPpt {
  id: string;
  nama: string;
  /** Satu baris: kapan tema ini tepat dipakai. */
  deskripsi: string;
  mode: ModeTema;
  nuansa: string[];
  warna: WarnaTema;
  tipografi: TipografiTema;
  latar: PolaLatar;
  aksenBentuk: "persegi" | "lingkaran" | "diagonal" | "garis" | "blok";
  /** Gradien latar khusus tema ini; menimpa peta bawaan. */
  gradien?: GradienLatar;
}

/**
 * Sembilan tema. Semua memakai font yang lazim tersedia di Windows/macOS
 * supaya berkas tidak "berubah wujud" saat dibuka di mesin lain.
 */
export const TEMA_PPT: TemaPpt[] = [
  {
    id: "swiss",
    nama: "Swiss Editorial",
    deskripsi: "Putih bersih, garis tipis, aksen merah — untuk laporan dan analisis.",
    mode: "terang",
    nuansa: ["korporat", "editorial", "minimal"],
    warna: {
      latar: "FFFFFF",
      latarAlt: "F4F4F1",
      permukaan: "FFFFFF",
      primer: "121212",
      aksen: "D7263D",
      teks: "121212",
      teksLembut: "5F6368",
      garis: "E3E3DE",
      pita: "121212",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "grid",
    aksenBentuk: "garis",
  },
  {
    id: "navy",
    nama: "Navy Korporat",
    deskripsi: "Biru malam dengan aksen sian — untuk paparan direksi dan strategi.",
    mode: "gelap",
    nuansa: ["korporat", "eksekutif"],
    warna: {
      latar: "0A1B33",
      latarAlt: "0E2545",
      permukaan: "12294C",
      primer: "F2F6FC",
      aksen: "4CC9F0",
      teks: "F2F6FC",
      teksLembut: "A9BCD4",
      garis: "1E3A5F",
      pita: "4CC9F0",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "mesh",
    aksenBentuk: "blok",
  },
  {
    id: "sage",
    nama: "Sage Eksekutif",
    deskripsi: "Hijau zaitun lembut dengan judul serif — tenang dan berwibawa.",
    mode: "terang",
    nuansa: ["eksekutif", "institusi"],
    warna: {
      latar: "FFFFFF",
      latarAlt: "F5F7F1",
      permukaan: "FFFFFF",
      primer: "2F3A28",
      aksen: "82966F",
      teks: "1C1D1C",
      teksLembut: "6B7280",
      garis: "DCE3D2",
      pita: "82966F",
    },
    tipografi: {
      judul: "Georgia",
      isi: "Arial",
      angka: "Georgia",
      mono: "Consolas",
    },
    latar: "pita",
    aksenBentuk: "garis",
  },
  {
    id: "graphite",
    nama: "Grafit Teknologi",
    deskripsi: "Abu gelap dengan aksen kuning — untuk produk, data, dan teknologi.",
    mode: "gelap",
    nuansa: ["teknologi", "produk"],
    warna: {
      latar: "111318",
      latarAlt: "171A21",
      permukaan: "1C2029",
      primer: "F5F7FA",
      aksen: "F2B544",
      teks: "F5F7FA",
      teksLembut: "9AA3B2",
      garis: "2A303B",
      pita: "F2B544",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "grid",
    aksenBentuk: "persegi",
  },
  {
    id: "ivory",
    nama: "Gading Konsultan",
    deskripsi: "Kertas gading dan emas redup — untuk proposal dan studi kelayakan.",
    mode: "terang",
    nuansa: ["konsultan", "akademik"],
    warna: {
      latar: "FAF7F0",
      latarAlt: "F2EDE2",
      permukaan: "FFFFFF",
      primer: "1F1B16",
      aksen: "B08A3E",
      teks: "1F1B16",
      teksLembut: "6E655A",
      garis: "E4DCCC",
      pita: "1F1B16",
    },
    tipografi: {
      judul: "Georgia",
      isi: "Arial",
      angka: "Georgia",
      mono: "Consolas",
    },
    latar: "polos",
    aksenBentuk: "garis",
  },
  {
    id: "azure",
    nama: "Azure Data",
    deskripsi: "Biru terang dengan kartu putih — untuk dasbor dan laporan data.",
    mode: "terang",
    nuansa: ["data", "korporat"],
    warna: {
      latar: "F6F9FD",
      latarAlt: "EAF2FB",
      permukaan: "FFFFFF",
      primer: "0F2A47",
      aksen: "1B6FD6",
      teks: "0F2A47",
      teksLembut: "5A6E85",
      garis: "D7E4F3",
      pita: "1B6FD6",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "blok",
    aksenBentuk: "persegi",
  },
  {
    id: "crimson",
    nama: "Krimson Berani",
    deskripsi: "Putih dengan aksen merah tua — untuk kampanye dan presentasi penjualan.",
    mode: "terang",
    nuansa: ["marketing", "penjualan"],
    warna: {
      latar: "FFFFFF",
      latarAlt: "FBF3F4",
      permukaan: "FFFFFF",
      primer: "1A1214",
      aksen: "B3122E",
      teks: "1A1214",
      teksLembut: "6B5F62",
      garis: "EAD9DC",
      pita: "B3122E",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "pita",
    aksenBentuk: "diagonal",
  },
  {
    id: "olive",
    nama: "Olive Lapangan",
    deskripsi: "Hijau zaitun gelap dengan emas — untuk laporan lapangan dan operasi.",
    mode: "gelap",
    nuansa: ["lapangan", "institusi"],
    warna: {
      latar: "232B1E",
      latarAlt: "2A3322",
      permukaan: "2A3322",
      primer: "F1EEE4",
      aksen: "C9A227",
      teks: "F1EEE4",
      teksLembut: "A7B08F",
      garis: "3E4A32",
      pita: "C9A227",
    },
    tipografi: { judul: "Arial", isi: "Arial", angka: "Arial", mono: "Consolas" },
    latar: "mesh",
    aksenBentuk: "garis",
  },
  {
    id: "mono",
    nama: "Monokrom Cetak",
    deskripsi: "Hitam-putih tegas — untuk dokumen yang akan dicetak atau difotokopi.",
    mode: "terang",
    nuansa: ["cetak", "formal"],
    warna: {
      latar: "FFFFFF",
      latarAlt: "F2F2F2",
      permukaan: "FFFFFF",
      primer: "000000",
      aksen: "3A3A3A",
      teks: "000000",
      teksLembut: "666666",
      garis: "D0D0D0",
      pita: "000000",
    },
    tipografi: {
      judul: "Times New Roman",
      isi: "Arial",
      angka: "Times New Roman",
      mono: "Consolas",
    },
    latar: "polos",
    aksenBentuk: "garis",
  },
];

/**
 * Gradien latar bawaan tiap tema.
 *
 * Sengaja halus: gradien yang terlalu kontras membuat teks kehilangan
 * kontras di salah satu ujung slide. Tema yang identitasnya "putih bersih"
 * (swiss, mono) tidak diberi gradien sama sekali.
 */
const GRADIEN_TEMA: Record<string, GradienLatar> = {
  navy: { dari: "081729", ke: "163A66", sudut: 135 },
  graphite: { dari: "0E1014", ke: "1D2431", sudut: 135 },
  olive: { dari: "1E2619", ke: "33402A", sudut: 135 },
  sage: { dari: "FFFFFF", ke: "EEF2E4", sudut: 160 },
  ivory: { dari: "FBF8F2", ke: "F0E8D8", sudut: 160 },
  azure: { dari: "F7FAFE", ke: "E3EEFC", sudut: 150 },
  crimson: { dari: "FFFFFF", ke: "FBEEF0", sudut: 160 },
};

/** Ambil gradien bawaan sebuah tema (tanpa memaksa tema memilikinya). */
export function gradienTema(id: string): GradienLatar | undefined {
  return GRADIEN_TEMA[id];
}

/**
 * Cache citra gradien.
 *
 * Kunci = seluruh parameter, sehingga satu deck hanya membangkitkan satu
 * citra per tema. Tanpa cache, setiap slide akan membuat kanvas 1280×720
 * sendiri — lambat dan boros memori.
 */
const cacheGradien = new Map<string, string | null>();

/**
 * Bangkitkan gradien sebagai data URL JPEG.
 *
 * pptxgenjs tidak punya API gradien: `slide.background` hanya menerima
 * warna solid atau gambar. Karena itu gradien dibuat sebagai citra, lalu
 * dipasang sebagai latar slide — hasilnya tetap gradien nyata di PowerPoint,
 * bukan tumpukan bentuk yang menyerupai gradien.
 *
 * Mengembalikan `null` di lingkungan tanpa DOM (unit test Node), sehingga
 * pemanggil otomatis jatuh ke warna solid.
 */
export function gradienLatar(
  g: GradienLatar,
  lebar = 1280,
  tinggi = 720,
): string | null {
  const kunci = `${g.jenis ?? "linear"}|${g.dari}|${g.ke}|${g.sudut}|${lebar}x${tinggi}`;
  const tersimpan = cacheGradien.get(kunci);
  if (tersimpan !== undefined) return tersimpan;

  if (typeof document === "undefined") {
    cacheGradien.set(kunci, null);
    return null;
  }

  try {
    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) {
      cacheGradien.set(kunci, null);
      return null;
    }

    let isi: CanvasGradient;
    if ((g.jenis ?? "linear") === "radial") {
      isi = ctx.createRadialGradient(
        lebar * 0.5,
        tinggi * 0.4,
        Math.min(lebar, tinggi) * 0.08,
        lebar * 0.5,
        tinggi * 0.5,
        Math.max(lebar, tinggi) * 0.75,
      );
    } else {
      const rad = (g.sudut * Math.PI) / 180;
      const cx = lebar / 2;
      const cy = tinggi / 2;
      // Panjang proyeksi agar gradien menutup seluruh kotak, bukan hanya
      // lingkaran dalam di tengah.
      const panjang =
        Math.abs(lebar * Math.cos(rad)) + Math.abs(tinggi * Math.sin(rad));
      const dx = (Math.cos(rad) * panjang) / 2;
      const dy = (Math.sin(rad) * panjang) / 2;
      isi = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    }

    isi.addColorStop(0, `#${g.dari}`);
    isi.addColorStop(1, `#${g.ke}`);
    ctx.fillStyle = isi;
    ctx.fillRect(0, 0, lebar, tinggi);

    // JPEG, bukan PNG: gradien halus terkompresi jauh lebih kecil dan tidak
    // butuh transparansi.
    const url = kanvas.toDataURL("image/jpeg", 0.9);
    cacheGradien.set(kunci, url);
    return url;
  } catch {
    cacheGradien.set(kunci, null);
    return null;
  }
}

/** Tema bawaan bila id tidak dikenal. */
export const TEMA_BAWAAN = "swiss";

/** Ambil tema berdasarkan id; selalu mengembalikan tema yang valid. */
export function getTemaPpt(id?: string | null): TemaPpt {
  if (!id) return TEMA_PPT.find((t) => t.id === TEMA_BAWAAN) ?? TEMA_PPT[0];
  return TEMA_PPT.find((t) => t.id === id) ?? TEMA_PPT.find((t) => t.id === TEMA_BAWAAN) ?? TEMA_PPT[0];
}

/* =====================================================================
 * LATAR & KAKI
 * ===================================================================== */

type JenisSlide = "sampul" | "isi" | "seksi" | "tutup";

/** Gambar pola latar khas tema. */
function hiasLatar(
  slide: Slide,
  tema: TemaPpt,
  jenis: JenisSlide,
  opsi: { solid?: boolean } = {},
): void {
  const w = tema.warna;
  const latar = jenis === "seksi" ? w.latarAlt : w.latar;

  // Slide berisi gambar/diagram memakai latar solid: citra diagram sudah
  // membawa latar sendiri, dan gradien di belakangnya akan terlihat sebagai
  // sambungan yang mengganggu.
  const g = opsi.solid ? undefined : (tema.gradien ?? GRADIEN_TEMA[tema.id]);
  const gambar = g
    ? gradienLatar(jenis === "seksi" ? { ...g, dari: w.latarAlt } : g)
    : null;
  // `path` hanya dipakai pptxgenjs untuk menebak EKSTENSI berkas, bukan untuk
  // membaca apa pun (datanya sudah ada di `data`). Tanpa ini, citra JPEG
  // tersimpan sebagai `.png` — ekstensi tidak cocok dengan isinya dan
  // PowerPoint bisa memunculkan peringatan "perbaiki konten".
  slide.background = gambar
    ? { data: gambar, path: "preencoded.jpeg" }
    : { color: latar };

  const garisHalus = campur(w.garis, latar, tema.mode === "gelap" ? 0.35 : 0.5);

  switch (tema.latar) {
    case "grid": {
      for (let i = 1; i <= 6; i += 1) {
        slide.addShape("line", {
          x: (W / 6) * i,
          y: 0,
          w: 0,
          h: H,
          line: { color: garisHalus, width: 0.5 },
        });
      }
      for (let i = 1; i <= 3; i += 1) {
        slide.addShape("line", {
          x: 0,
          y: (H / 4) * i,
          w: W,
          h: 0,
          line: { color: garisHalus, width: 0.5 },
        });
      }
      break;
    }
    case "mesh": {
      slide.addShape("ellipse", {
        x: W - 3.9,
        y: -2.2,
        w: 6.6,
        h: 6.6,
        fill: { color: w.aksen, transparency: 88 },
        line: { color: w.aksen, width: 0 },
      });
      slide.addShape("ellipse", {
        x: -2.6,
        y: H - 2.6,
        w: 5.4,
        h: 5.4,
        fill: { color: w.pita, transparency: 92 },
        line: { color: w.pita, width: 0 },
      });
      break;
    }
    case "pita": {
      if (jenis === "sampul" || jenis === "tutup") {
        slide.addShape("rect", {
          x: -1.4,
          y: H - 2.5,
          w: W + 3,
          h: 1.15,
          fill: { color: w.aksen, transparency: tema.mode === "gelap" ? 70 : 90 },
          line: { color: w.aksen, width: 0 },
          rotate: -4,
        });
      } else {
        slide.addShape("rect", {
          x: W - 2.9,
          y: 0,
          w: 2.9,
          h: 0.1,
          fill: { color: w.aksen },
          line: { color: w.aksen, width: 0 },
        });
      }
      break;
    }
    case "blok": {
      if (jenis === "sampul" || jenis === "tutup") {
        slide.addShape("rect", {
          x: W - 4.1,
          y: 0,
          w: 4.1,
          h: H,
          fill: { color: w.primer },
          line: { color: w.primer, width: 0 },
        });
        slide.addShape("ellipse", {
          x: W - 3.5,
          y: 2.5,
          w: 2.9,
          h: 2.9,
          fill: { color: w.aksen, transparency: 55 },
          line: { color: w.aksen, width: 0 },
        });
      } else {
        slide.addShape("rect", {
          x: W - 0.34,
          y: 0,
          w: 0.34,
          h: H,
          fill: { color: campur(w.aksen, latar, 0.78) },
          line: { color: latar, width: 0 },
        });
      }
      break;
    }
    case "diagonal": {
      slide.addShape("rect", {
        x: W - 2.2,
        y: -1.5,
        w: 0.5,
        h: 4.6,
        fill: { color: w.aksen, transparency: 82 },
        line: { color: w.aksen, width: 0 },
        rotate: 24,
      });
      slide.addShape("rect", {
        x: W - 1.3,
        y: -1.5,
        w: 0.5,
        h: 4.6,
        fill: { color: w.aksen, transparency: 88 },
        line: { color: w.aksen, width: 0 },
        rotate: 24,
      });
      break;
    }
    case "polos":
    default:
      break;
  }
}

/** Garis + keterangan kaki slide. */
function kaki(slide: Slide, tema: TemaPpt, kiri: string, nomor?: number): void {
  const w = tema.warna;
  slide.addShape("line", {
    x: M,
    y: KAKI + 0.06,
    w: CW,
    h: 0,
    line: { color: w.garis, width: 0.75 },
  });
  slide.addText(kiri, {
    x: M,
    y: KAKI + 0.14,
    w: CW - 0.7,
    h: 0.26,
    fontFace: tema.tipografi.isi,
    fontSize: 8.5,
    color: w.teksLembut,
    charSpacing: 0.4,
  });
  if (typeof nomor === "number") {
    slide.addText(String(nomor).padStart(2, "0"), {
      x: W - M - 0.5,
      y: KAKI + 0.14,
      w: 0.5,
      h: 0.26,
      fontFace: tema.tipografi.angka,
      fontSize: 8.5,
      color: w.teksLembut,
      align: "right",
    });
  }
}

/** Judul slide isi + kicker + garis aksen. */
function judulIsi(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  kicker?: string,
): void {
  const w = tema.warna;
  if (kicker) {
    slide.addText(kicker.toUpperCase(), {
      x: M,
      y: 0.5,
      w: CW,
      h: 0.26,
      fontFace: tema.tipografi.isi,
      fontSize: 9.5,
      bold: true,
      color: w.aksen,
      charSpacing: 2,
    });
  }
  const n = judul.length;
  const ukuran = n <= 38 ? 27 : n <= 58 ? 24 : n <= 82 ? 21 : 19;
  slide.addText(judul, {
    x: M,
    y: kicker ? 0.8 : 0.62,
    w: CW,
    h: 0.92,
    fontFace: tema.tipografi.judul,
    fontSize: ukuran,
    bold: true,
    color: w.teks,
    valign: "top",
    lineSpacing: ukuran * 1.16,
  });
  slide.addShape("rect", {
    x: M,
    y: 1.76,
    w: 1.1,
    h: 0.05,
    fill: { color: w.aksen },
    line: { color: w.aksen, width: 0 },
  });
}

/* =====================================================================
 * LAYOUT SLIDE
 * ===================================================================== */

export interface MetaDeck {
  organisasi?: string;
  penyusun?: string;
  tanggal?: string;
}

export interface KartuKpi {
  nilai: string;
  label: string;
  catatan?: string;
}

/** Slide sampul. */
function slideSampul(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  subjudul: string | undefined,
  meta: MetaDeck,
  gambarSampul?: string,
): void {
  const w = tema.warna;
  const gelap = tema.mode === "gelap";
  hiasLatar(slide, tema, "sampul");

  // Foto sampul penuh + lapisan gelap agar judul tetap terbaca.
  if (gambarSampul) {
    slide.background = { data: gambarSampul };
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: W,
      h: H,
      fill: { color: "0B0D10", transparency: 48 },
      line: { color: "0B0D10", width: 0 },
    });
  }

  const warnaJudul = gambarSampul || gelap ? "FFFFFF" : w.teks;
  const warnaLembut = gambarSampul || gelap ? "D9DEE8" : w.teksLembut;

  // Pita atas sebagai penanda identitas deck.
  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: W,
    h: 0.2,
    fill: { color: gambarSampul ? w.aksen : w.pita },
    line: { color: gambarSampul ? w.aksen : w.pita, width: 0 },
  });

  const kicker = (meta.organisasi || "NitZ-909").toUpperCase();
  slide.addText(kicker, {
    x: M,
    y: 2.05,
    w: CW - 1.2,
    h: 0.28,
    fontFace: tema.tipografi.isi,
    fontSize: 10,
    bold: true,
    color: gambarSampul ? "FFFFFF" : w.aksen,
    charSpacing: 2.6,
  });

  const panjang = judul.length;
  const ukuran = panjang <= 30 ? 40 : panjang <= 52 ? 34 : panjang <= 76 ? 29 : 25;
  slide.addText(judul, {
    x: M,
    y: 2.4,
    w: CW - 1.4,
    h: 2.05,
    fontFace: tema.tipografi.judul,
    fontSize: ukuran,
    bold: true,
    color: warnaJudul,
    valign: "top",
    lineSpacing: ukuran * 1.1,
  });

  slide.addShape("rect", {
    x: M,
    y: 4.5,
    w: 1.6,
    h: 0.06,
    fill: { color: w.aksen },
    line: { color: w.aksen, width: 0 },
  });

  if (subjudul) {
    slide.addText(subjudul, {
      x: M,
      y: 4.72,
      w: CW - 2.2,
      h: 0.95,
      fontFace: tema.tipografi.isi,
      fontSize: 14,
      color: warnaLembut,
      valign: "top",
      lineSpacing: 19,
    });
  }

  const barisMeta = [meta.penyusun, meta.tanggal]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join("  ·  ");
  if (barisMeta) {
    slide.addText(barisMeta, {
      x: M,
      y: 6.55,
      w: CW - 1.6,
      h: 0.3,
      fontFace: tema.tipografi.isi,
      fontSize: 10,
      color: warnaLembut,
      charSpacing: 0.6,
    });
  }
  slide.addText("NitZ-909", {
    x: W - M - 1.2,
    y: 6.55,
    w: 1.2,
    h: 0.3,
    fontFace: tema.tipografi.isi,
    fontSize: 9,
    color: warnaLembut,
    align: "right",
    charSpacing: 1.2,
  });
}

/** Slide agenda: daftar bagian dalam dua kolom bernomor. */
function slideAgenda(slide: Slide, tema: TemaPpt, butir: string[]): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, "Agenda", "Rencana paparan");

  const n = Math.min(butir.length, 8);
  const perKolom = Math.ceil(n / 2);
  const kolomW = (CW - 0.5) / 2;

  for (let i = 0; i < n; i += 1) {
    const kolom = i < perKolom ? 0 : 1;
    const baris = i % perKolom;
    const x = M + kolom * (kolomW + 0.5);
    const y = ATAS + 0.1 + baris * 0.86;

    slide.addText(String(i + 1).padStart(2, "0"), {
      x,
      y,
      w: 0.6,
      h: 0.4,
      fontFace: tema.tipografi.angka,
      fontSize: 15,
      bold: true,
      color: w.aksen,
    });
    slide.addText(butir[i], {
      x: x + 0.62,
      y,
      w: kolomW - 0.62,
      h: 0.62,
      fontFace: tema.tipografi.isi,
      fontSize: 13.5,
      color: w.teks,
      valign: "top",
      lineSpacing: 17,
    });
    slide.addShape("line", {
      x,
      y: y + 0.68,
      w: kolomW,
      h: 0,
      line: { color: w.garis, width: 0.75 },
    });
  }
}

/** Slide pemisah bagian: nomor raksasa + judul. */
function slideSeksi(
  slide: Slide,
  tema: TemaPpt,
  nomor: number,
  judul: string,
  deskripsi?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "seksi");

  slide.addText(String(nomor).padStart(2, "0"), {
    x: M - 0.08,
    y: 1.0,
    w: 4.4,
    h: 2.5,
    fontFace: tema.tipografi.judul,
    fontSize: 148,
    bold: true,
    color: campur(w.aksen, w.latarAlt, 0.72),
    valign: "top",
  });

  slide.addText(judul, {
    x: M,
    y: 3.62,
    w: CW - 1.6,
    h: 1.15,
    fontFace: tema.tipografi.judul,
    fontSize: judul.length > 52 ? 26 : 33,
    bold: true,
    color: w.teks,
    valign: "top",
    lineSpacing: 40,
  });

  slide.addShape("rect", {
    x: M,
    y: 4.85,
    w: 1.3,
    h: 0.06,
    fill: { color: w.aksen },
    line: { color: w.aksen, width: 0 },
  });

  if (deskripsi) {
    slide.addText(deskripsi, {
      x: M,
      y: 5.05,
      w: CW - 3,
      h: 0.8,
      fontFace: tema.tipografi.isi,
      fontSize: 13,
      color: w.teksLembut,
      valign: "top",
      lineSpacing: 18,
    });
  }
}

interface Butir {
  teks: string;
  level: number;
}

/** Slide isi: paragraf pengantar (opsional) + butir satu atau dua kolom. */
function slideIsi(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  kicker: string | undefined,
  butir: Butir[],
  lead?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul, kicker);

  let atas = ATAS;
  if (lead) {
    slide.addText(lead, {
      x: M,
      y: atas,
      w: CW - 0.6,
      h: 0.86,
      fontFace: tema.tipografi.isi,
      fontSize: 13.5,
      color: w.teksLembut,
      valign: "top",
      lineSpacing: 18,
    });
    atas += 1.0;
  }

  if (butir.length === 0) return;

  const n = butir.length;
  const ukuran = n <= 3 ? 17 : n <= 5 ? 15.5 : n <= 8 ? 13.5 : 12;
  const duaKolom = n > 6;
  const tinggi = Math.max(0.8, KAKI - 0.05 - atas);

  const buatRuns = (daftar: Butir[]): PptxGenJS.TextProps[] =>
    daftar.map((b) => ({
      text: b.teks,
      options: {
        fontFace: tema.tipografi.isi,
        fontSize: b.level > 0 ? ukuran - 1.5 : ukuran,
        color: b.level > 0 ? w.teksLembut : w.teks,
        bullet: b.level === 0 ? { code: "2022" } : { code: "25E6" },
        indentLevel: Math.min(2, b.level),
        breakLine: true,
        paraSpaceAfter: b.level > 0 ? 4 : 9,
        lineSpacing: ukuran * 1.3,
      },
    }));

  if (duaKolom) {
    const tengah = Math.ceil(n / 2);
    const lebar = (CW - 0.55) / 2;
    slide.addText(buatRuns(butir.slice(0, tengah)), {
      x: M,
      y: atas,
      w: lebar,
      h: tinggi,
      valign: "top",
    });
    slide.addText(buatRuns(butir.slice(tengah)), {
      x: M + lebar + 0.55,
      y: atas,
      w: lebar,
      h: tinggi,
      valign: "top",
    });
  } else {
    slide.addText(buatRuns(butir), {
      x: M,
      y: atas,
      w: CW - 0.4,
      h: tinggi,
      valign: "top",
    });
  }
}

/** Slide KPI: 3–4 kartu angka besar. */
export function slideKpi(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  kartu: KartuKpi[],
  kicker?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul, kicker);

  const n = Math.min(Math.max(kartu.length, 1), 4);
  const jarak = 0.28;
  const lebar = (CW - jarak * (n - 1)) / n;
  // Kartu diberi tinggi cukup agar angka besar tidak "melayang" di slide
  // kosong, lalu diletakkan sedikit di bawah garis judul.
  const y = 2.42;
  const tinggi = 2.85;

  for (let i = 0; i < n; i += 1) {
    const k = kartu[i];
    const x = M + i * (lebar + jarak);

    slide.addShape("roundRect", {
      x,
      y,
      w: lebar,
      h: tinggi,
      rectRadius: 0.06,
      fill: { color: w.permukaan },
      line: { color: w.garis, width: 1 },
    });
    slide.addShape("rect", {
      x,
      y,
      w: lebar,
      h: 0.08,
      fill: { color: w.aksen },
      line: { color: w.aksen, width: 0 },
    });

    const panjangNilai = k.nilai.length;
    const ukuranNilai = panjangNilai <= 5 ? 32 : panjangNilai <= 8 ? 26 : 21;
    slide.addText(k.nilai, {
      x: x + 0.24,
      y: y + 0.52,
      w: lebar - 0.48,
      h: 0.82,
      fontFace: tema.tipografi.angka,
      fontSize: ukuranNilai,
      bold: true,
      color: w.aksen,
      valign: "top",
    });
    slide.addText(k.label, {
      x: x + 0.24,
      y: y + 1.5,
      w: lebar - 0.48,
      h: 0.62,
      fontFace: tema.tipografi.isi,
      fontSize: 11,
      color: w.teks,
      valign: "top",
      lineSpacing: 14,
    });
    if (k.catatan) {
      slide.addText(k.catatan, {
        x: x + 0.24,
        y: y + 2.28,
        w: lebar - 0.48,
        h: 0.32,
        fontFace: tema.tipografi.isi,
        fontSize: 9,
        italic: true,
        color: w.teksLembut,
      });
    }
  }
}

/** Slide tabel dengan lebar kolom proporsional dan baris zebra. */
export function slideTabel(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  headers: string[],
  rows: string[][],
  kicker?: string,
  caption?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul, kicker);

  const bobot = headers.map((h, i) => {
    const panjangSel = rows.reduce(
      (maks, r) => Math.max(maks, (r[i] ?? "").length),
      h.length,
    );
    return Math.min(Math.max(panjangSel, 6), 40);
  });
  const totalBobot = bobot.reduce((a, b) => a + b, 0) || 1;
  const colW = bobot.map((b) => (b / totalBobot) * CW);

  const kepala: PptxGenJS.TableCell[] = headers.map((h) => ({
    text: h,
    options: {
      fontFace: tema.tipografi.isi,
      fontSize: 10.5,
      bold: true,
      color: kontras(w.primer),
      fill: { color: w.primer },
      valign: "middle",
    },
  }));

  const isi: PptxGenJS.TableCell[][] = rows.map((r, i) =>
    r.map((c) => ({
      text: c,
      options: {
        fontFace: tema.tipografi.isi,
        fontSize: 9.8,
        color: w.teks,
        fill: {
          color: i % 2 === 0 ? w.permukaan : campur(w.latarAlt, w.permukaan, 0.35),
        },
        valign: "middle",
      },
    })),
  );

  // Tabel pendek diletakkan di tengah area isi (bukan menempel ke atas),
  // sedangkan tabel panjang tetap mulai dari atas agar tidak terpotong.
  const ruang = KAKI - ATAS - 0.45;
  const tinggiBaris = Math.min(0.42, ruang / (rows.length + 1));
  const tinggiTabel = tinggiBaris * (rows.length + 1);
  const y = ATAS + Math.max(0, (ruang - tinggiTabel) / 2);

  slide.addTable([kepala, ...isi], {
    x: M,
    y,
    w: CW,
    colW,
    rowH: tinggiBaris,
    border: { pt: 0.5, color: w.garis },
    fontFace: tema.tipografi.isi,
    fontSize: 9.8,
    autoPage: false,
  });

  if (caption) {
    slide.addText(caption, {
      x: M,
      y: Math.min(y + tinggiTabel + 0.14, KAKI - 0.1),
      w: CW,
      h: 0.24,
      fontFace: tema.tipografi.isi,
      fontSize: 8.5,
      italic: true,
      color: w.teksLembut,
    });
  }
}

/** Slide grafik native (bisa diklik dan diubah di PowerPoint). */
export function slideGrafik(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  blok: ChartBlock,
  kicker?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul, kicker);

  const tipe =
    blok.chartType === "bar" ||
    blok.chartType === "line" ||
    blok.chartType === "pie" ||
    blok.chartType === "area" ||
    blok.chartType === "scatter"
      ? blok.chartType
      : "bar";

  const palet = [
    w.aksen,
    w.primer,
    campur(w.aksen, w.teks, 0.45),
    campur(w.aksen, w.latar, 0.55),
    campur(w.primer, w.latar, 0.5),
  ];

  const data = blok.data.datasets.map((d) => ({
    name: d.label,
    labels: blok.data.labels,
    values: d.data,
  }));

  try {
    slide.addChart(tipe, data, {
      x: M,
      y: ATAS + 0.05,
      w: CW,
      h: KAKI - ATAS - 0.35,
      chartColors: palet,
      showLegend: blok.data.datasets.length > 1,
      legendPos: "b",
      legendColor: w.teksLembut,
      legendFontFace: tema.tipografi.isi,
      legendFontSize: 9,
      catAxisLabelColor: w.teksLembut,
      catAxisLabelFontFace: tema.tipografi.isi,
      catAxisLabelFontSize: 9,
      valAxisLabelColor: w.teksLembut,
      valAxisLabelFontFace: tema.tipografi.isi,
      valAxisLabelFontSize: 9,
      catAxisLineColor: w.garis,
      valAxisLineColor: w.garis,
      valGridLine: { color: w.garis, style: "solid", size: 0.5 },
      catGridLine: { style: "none" },
      showValue: tipe === "bar" || tipe === "pie",
      dataLabelColor: w.teks,
      dataLabelFontFace: tema.tipografi.isi,
      dataLabelFontSize: 9,
      barGapWidthPct: 55,
    });
  } catch {
    // Tipe tidak didukung engine → tampilkan data sebagai teks agar tetap jujur.
    slide.addText(
      `${blok.data.labels.join(" · ")}\n` +
        blok.data.datasets.map((d) => `${d.label}: ${d.data.join(", ")}`).join("\n"),
      {
        x: M,
        y: ATAS,
        w: CW,
        h: 2,
        fontFace: tema.tipografi.isi,
        fontSize: 12,
        color: w.teks,
      },
    );
  }
}

/** Slide proses: chevron bernomor untuk 3–5 tahap. */
export function slideProses(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  tahap: string[],
  kicker?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul, kicker);

  const n = Math.min(Math.max(tahap.length, 2), 5);
  const tumpang = 0.18;
  const lebar = (CW + tumpang * (n - 1)) / n;
  const y = 3.05;
  const tinggi = 1.15;

  for (let i = 0; i < n; i += 1) {
    const x = M + i * (lebar - tumpang);
    const isi = campur(w.aksen, w.latar, 0.1 + i * 0.16);
    slide.addShape("chevron", {
      x,
      y,
      w: lebar,
      h: tinggi,
      fill: { color: isi },
      line: { color: w.latar, width: 1.5 },
    });
    slide.addText(`${i + 1}`, {
      x: x + 0.18,
      y: y + 0.12,
      w: 0.4,
      h: 0.34,
      fontFace: tema.tipografi.angka,
      fontSize: 11,
      bold: true,
      color: kontras(isi),
    });
    slide.addText(tahap[i], {
      x: x + 0.18,
      y: y + 0.44,
      w: lebar - 0.55,
      h: 0.62,
      fontFace: tema.tipografi.isi,
      fontSize: 10.5,
      bold: true,
      color: kontras(isi),
      valign: "top",
      lineSpacing: 13,
    });
  }

  slide.addText("Alur kerja", {
    x: M,
    y: y - 0.55,
    w: CW,
    h: 0.3,
    fontFace: tema.tipografi.isi,
    fontSize: 10,
    color: w.teksLembut,
    charSpacing: 1.2,
  });
}

/** Slide kutipan / pernyataan kunci. */
export function slideKutipan(
  slide: Slide,
  tema: TemaPpt,
  teks: string,
  sumber?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "seksi");

  slide.addText("“", {
    x: M - 0.1,
    y: 1.05,
    w: 1.6,
    h: 1.6,
    fontFace: tema.tipografi.judul,
    fontSize: 120,
    bold: true,
    color: campur(w.aksen, w.latar, 0.55),
  });

  slide.addText(teks, {
    x: M,
    y: 2.55,
    w: CW - 1.8,
    h: 2.6,
    fontFace: tema.tipografi.judul,
    fontSize: teks.length > 220 ? 19 : teks.length > 140 ? 22 : 26,
    color: w.teks,
    valign: "top",
    lineSpacing: 34,
  });

  slide.addShape("rect", {
    x: M,
    y: 5.35,
    w: 1.1,
    h: 0.05,
    fill: { color: w.aksen },
    line: { color: w.aksen, width: 0 },
  });

  if (sumber) {
    slide.addText(sumber, {
      x: M,
      y: 5.52,
      w: CW - 2,
      h: 0.4,
      fontFace: tema.tipografi.isi,
      fontSize: 11,
      color: w.teksLembut,
      charSpacing: 0.8,
    });
  }
}

/**
 * Baca dimensi gambar langsung dari data URL.
 *
 * Diperlukan karena pptxgenjs menulis `<a:stretch/>` pada gambar yang diberi
 * `w`/`h` eksplisit — gambar akan DIPAKSA mengisi kotak dan rusak aspeknya.
 * (Opsi `sizing: contain` tidak selalu dihormati saat x/y/w/h ikut diisi.)
 * Dengan mengetahui ukuran asli, bingkai bisa dihitung sendiri sehingga
 * gambar tetap proporsional dan berada di tengah kotak.
 *
 * Hanya membaca header — tidak mendekode piksel.
 */
export function dimensiDataUrl(
  dataUrl: string,
): { w: number; h: number } | null {
  const cocok = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(dataUrl.trim());
  if (!cocok) return null;
  let biner: string;
  try {
    biner = atob(cocok[1].slice(0, 4096));
  } catch {
    return null;
  }
  const b = (i: number) => biner.charCodeAt(i) & 0xff;

  // PNG: signature 8 byte, lalu chunk IHDR (lebar/tinggi big-endian).
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) {
    const w = (b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19);
    const h = (b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23);
    return w > 0 && h > 0 ? { w, h } : null;
  }

  // GIF: lebar/tinggi little-endian di offset 6.
  if (b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46) {
    const w = b(6) | (b(7) << 8);
    const h = b(8) | (b(9) << 8);
    return w > 0 && h > 0 ? { w, h } : null;
  }

  // JPEG: cari penanda SOF0–SOF3, lalu baca tinggi/lebar.
  if (b(0) === 0xff && b(1) === 0xd8) {
    let i = 2;
    while (i < biner.length - 9) {
      if (b(i) !== 0xff) {
        i += 1;
        continue;
      }
      const penanda = b(i + 1);
      const panjang = (b(i + 2) << 8) | b(i + 3);
      if (penanda >= 0xc0 && penanda <= 0xc3) {
        const h = (b(i + 5) << 8) | b(i + 6);
        const w = (b(i + 7) << 8) | b(i + 8);
        return w > 0 && h > 0 ? { w, h } : null;
      }
      i += 2 + panjang;
    }
  }
  return null;
}

/** Slide gambar penuh dengan keterangan. */
function slideGambar(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  data: string,
  caption?: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi", { solid: true });
  judulIsi(slide, tema, judul);

  const tinggiKotak = caption ? 4.05 : 4.4;
  const dim = dimensiDataUrl(data);
  let posX = M;
  let posY = ATAS;
  let lebarGambar = CW;
  let tinggiGambar = tinggiKotak;

  if (dim) {
    const skala = Math.min(CW / dim.w, tinggiKotak / dim.h);
    lebarGambar = dim.w * skala;
    tinggiGambar = dim.h * skala;
    posX = M + (CW - lebarGambar) / 2;
    posY = ATAS + (tinggiKotak - tinggiGambar) / 2;
  }

  slide.addImage({
    data,
    x: posX,
    y: posY,
    w: lebarGambar,
    h: tinggiGambar,
  });

  if (caption) {
    slide.addText(caption, {
      x: M,
      y: ATAS + tinggiKotak + 0.1,
      w: CW,
      h: 0.34,
      fontFace: tema.tipografi.isi,
      fontSize: 9,
      italic: true,
      color: w.teksLembut,
      align: "center",
    });
  }
}

/** Slide blok kode / teks monospace. */
function slideKode(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  kode: string,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "isi");
  judulIsi(slide, tema, judul);

  const baris = kode.split("\n").slice(0, 22);
  const tinggi = Math.min(baris.length * 0.27 + 0.4, KAKI - ATAS - 0.2);

  slide.addText(baris.join("\n"), {
    x: M,
    y: ATAS,
    w: CW,
    h: tinggi,
    fontFace: tema.tipografi.mono,
    fontSize: 11,
    color: w.teks,
    fill: { color: campur(w.latarAlt, w.permukaan, 0.4) },
    line: { color: w.garis, width: 1 },
    valign: "top",
    lineSpacing: 15,
  });
}

/** Slide penutup. */
function slidePenutup(
  slide: Slide,
  tema: TemaPpt,
  judul: string,
  tindakLanjut: string | undefined,
  meta: MetaDeck,
): void {
  const w = tema.warna;
  hiasLatar(slide, tema, "tutup");

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: W,
    h: 0.2,
    fill: { color: w.pita },
    line: { color: w.pita, width: 0 },
  });

  slide.addText("Terima kasih", {
    x: M,
    y: 2.05,
    w: CW - 1.5,
    h: 1.1,
    fontFace: tema.tipografi.judul,
    fontSize: 38,
    bold: true,
    color: w.teks,
    valign: "top",
  });

  slide.addShape("rect", {
    x: M,
    y: 3.28,
    w: 1.5,
    h: 0.06,
    fill: { color: w.aksen },
    line: { color: w.aksen, width: 0 },
  });

  slide.addText(tindakLanjut || judul, {
    x: M,
    y: 3.5,
    w: CW - 2.2,
    h: 0.9,
    fontFace: tema.tipografi.isi,
    fontSize: 13,
    color: w.teksLembut,
    valign: "top",
    lineSpacing: 18,
  });

  const barisMeta = [meta.organisasi, meta.penyusun, meta.tanggal]
    .filter((x): x is string => Boolean(x && x.trim()))
    .join("  ·  ");
  slide.addText(barisMeta || "NitZ-909 · DATA UJI (sintetis)", {
    x: M,
    y: 6.6,
    w: CW - 1.4,
    h: 0.3,
    fontFace: tema.tipografi.isi,
    fontSize: 9,
    color: w.teksLembut,
    charSpacing: 0.5,
  });
}

/* =====================================================================
 * PEMBACAAN ISI
 * ===================================================================== */

/**
 * Ambil satu angka + label dari sebuah kalimat butir.
 * Contoh: "Realisasi anggaran: 81%" → { nilai: "81%", label: "Realisasi anggaran" }.
 */
export function uraiAngka(teks: string): KartuKpi | null {
  const pola =
    /(?:Rp\s?)?\d[\d.,]*\s*(?:%|persen|juta|miliar|triliun|ribu|rb|unit|orang|hari|bulan|tahun|kali|poin|jam|menit|kg|ton|kunjungan|halaman|berkas)?/i;
  const cocok = pola.exec(teks);
  if (!cocok) return null;

  const nilai = cocok[0].trim();
  if (!/\d/.test(nilai)) return null;

  const sebelum = teks.slice(0, cocok.index).replace(/[\s:–—-]+$/g, "").trim();
  const sesudah = teks
    .slice(cocok.index + cocok[0].length)
    .replace(/^[\s:–—-]+/g, "")
    .trim();

  // Label: bagian sebelum angka lebih informatif; sisanya jadi catatan.
  const label = (sebelum || sesudah || teks).slice(0, 90);
  if (!label) return null;
  const catatan = sebelum && sesudah ? sesudah.slice(0, 90) : undefined;

  return { nilai, label, ...(catatan ? { catatan } : {}) };
}

/** Ratakan daftar bertingkat menjadi butir dengan level indentasi. */
function ratakanButir(
  items: ListBlock["items"],
  level = 0,
  keluar: Butir[] = [],
): Butir[] {
  for (const it of items) {
    keluar.push({ teks: it.text, level });
    if (it.children?.length) ratakanButir(it.children, level + 1, keluar);
  }
  return keluar;
}

/** Apakah daftar cocok jadi slide proses (3–5 tahap, tiap butir pendek)? */
function layakProses(b: ListBlock): boolean {
  if (!b.ordered) return false;
  const butir = ratakanButir(b.items);
  if (butir.length < 3 || butir.length > 5) return false;
  return butir.every((x) => x.level === 0 && x.teks.split(/\s+/).length <= 7);
}

/** Apakah butir-butir ini bisa jadi kartu KPI? */
function kartuDariButir(butir: Butir[]): KartuKpi[] | null {
  if (butir.length < 3 || butir.length > 4) return null;
  const kartu = butir.map((b) => uraiAngka(b.teks));
  if (kartu.some((k) => k === null)) return null;
  return kartu as KartuKpi[];
}

/* =====================================================================
 * PERENCANA DECK
 * ===================================================================== */

export interface OpsiDeckPpt {
  judul: string;
  blocks: ContentBlock[];
  /** Daftar berkas/tautan sumber; muncul sebagai slide terakhir. */
  sumber?: string[];
  /** Id tema atau objek tema. */
  tema?: string | TemaPpt;
  meta?: MetaDeck;
  /** Data URL gambar sampul (opsional). */
  gambarSampul?: string;
  /**
   * Peta id blok diagram → data URL PNG hasil render Mermaid.
   * Diisi pemanggil (browser) sebelum deck disusun; kosong di Node.
   */
  gambarDiagram?: Record<string, string>;
}

export interface StatDeckPpt {
  slideCount: number;
  kpi: number;
  tabel: number;
  grafik: number;
  proses: number;
  gambar: number;
  diagram: number;
  kode: number;
}

interface Grup {
  judul: string;
  kicker?: string;
  blok: ContentBlock[];
}

interface Bagian {
  judul: string;
  grup: Grup[];
}

/** Pecah blok menjadi bagian (heading level 1) berisi grup (heading level 2). */
function bagiBagian(blocks: ContentBlock[], judulAwal: string): Bagian[] {
  const bagian: Bagian[] = [];
  let bagianAktif: Bagian = { judul: judulAwal, grup: [] };
  let grupAktif: Grup | null = null;

  const tutupGrup = () => {
    if (grupAktif && grupAktif.blok.length > 0) {
      bagianAktif.grup.push(grupAktif);
    }
    grupAktif = null;
  };

  const tutupBagian = () => {
    tutupGrup();
    if (bagianAktif.grup.length > 0) bagian.push(bagianAktif);
  };

  for (const b of blocks) {
    if (b.type === "heading" && b.level === 1) {
      tutupBagian();
      bagianAktif = { judul: b.text, grup: [] };
      grupAktif = { judul: b.text, blok: [] };
      continue;
    }
    if (b.type === "heading" && b.level === 2) {
      tutupGrup();
      // Kicker hanya bermakna bila bagian punya nama sendiri; kalau judul
      // bagian sama dengan judul dokumen, menampilkannya berarti mengulang
      // judul di setiap slide.
      const kicker =
        bagianAktif.judul.trim() === judulAwal.trim()
          ? undefined
          : bagianAktif.judul;
      grupAktif = { judul: b.text, ...(kicker ? { kicker } : {}), blok: [] };
      continue;
    }
    if (!grupAktif) {
      grupAktif = { judul: bagianAktif.judul, blok: [] };
    }
    grupAktif.blok.push(b);
  }

  tutupBagian();
  return bagian;
}

/**
 * Susun seluruh deck ke dalam `pptx`.
 *
 * Mengembalikan statistik agar pemanggil bisa melaporkan apa yang benar-benar
 * dibuat (dan apa yang dipotong), bukan sekadar "berhasil".
 */
export function susunDeckPpt(pptx: PptxGenJS, opsi: OpsiDeckPpt): StatDeckPpt {
  const tema =
    typeof opsi.tema === "object" && opsi.tema !== null
      ? opsi.tema
      : getTemaPpt(opsi.tema as string | undefined);

  const stat: StatDeckPpt = {
    slideCount: 0,
    kpi: 0,
    tabel: 0,
    grafik: 0,
    proses: 0,
    gambar: 0,
    diagram: 0,
    kode: 0,
  };

  const meta: MetaDeck = {
    organisasi: opsi.meta?.organisasi ?? "NitZ-909",
    ...(opsi.meta?.penyusun ? { penyusun: opsi.meta.penyusun } : {}),
    ...(opsi.meta?.tanggal ? { tanggal: opsi.meta.tanggal } : {}),
  };

  const slideBaru = (): Slide => {
    const s = pptx.addSlide();
    stat.slideCount += 1;
    return s;
  };

  // --- Sampul -----------------------------------------------------------
  const subjudul = opsi.blocks.find((b) => b.type === "paragraph");
  const teksSub =
    subjudul && subjudul.type === "paragraph"
      ? subjudul.text.split(/(?<=[.!?])\s/)[0]?.slice(0, 180)
      : undefined;

  slideSampul(
    slideBaru(),
    tema,
    opsi.judul,
    teksSub,
    meta,
    opsi.gambarSampul,
  );

  // --- Struktur ---------------------------------------------------------
  const bagian = bagiBagian(opsi.blocks, opsi.judul);

  // Slide pertama setelah sampul tidak boleh mengulang judul dokumen:
  // isinya digabung ke grup berikutnya, atau diberi judul "Ringkasan".
  const judulDeck = opsi.judul.trim();
  const grupPertama = bagian[0]?.grup[0];
  if (grupPertama && grupPertama.judul.trim() === judulDeck) {
    const sisa = grupPertama.blok.filter(
      (b) =>
        !(
          b.type === "paragraph" &&
          teksSub &&
          b.text.slice(0, 60) === teksSub.slice(0, 60)
        ),
    );
    if (bagian[0].grup.length > 1) {
      bagian[0].grup[1].blok.unshift(...sisa);
      bagian[0].grup.shift();
    } else if (sisa.length > 0) {
      grupPertama.judul = "Ringkasan";
      grupPertama.blok = sisa;
    } else {
      bagian[0].grup.shift();
    }
  }

  const adaIsi = bagian.some((b) => b.grup.length > 0);

  if (!adaIsi) {
    const s = slideBaru();
    slideKutipan(
      s,
      tema,
      "Dokumen ini belum memiliki isi. Tambahkan bagian, lalu ekspor ulang.",
    );
    return stat;
  }

  // Pemisah bagian hanya dipakai bila deck memang panjang — deck pendek
  // dengan pemisah justru terasa bertele-tele.
  const pakaiPemisah = bagian.length >= 3;
  const judulBagian = bagian
    .map((b) => b.judul)
    .filter((j) => Boolean(j) && j.trim() !== opsi.judul.trim());

  // --- Agenda -----------------------------------------------------------
  const agenda =
    judulBagian.length >= 2 && judulBagian.length <= 8
      ? judulBagian
      : bagian.flatMap((b) => b.grup.map((g) => g.judul)).slice(0, 8);
  if (agenda.length >= 2) {
    slideAgenda(slideBaru(), tema, agenda);
  }

  // --- Isi --------------------------------------------------------------
  let nomorBagian = 0;
  for (const b of bagian) {
    if (b.grup.length === 0) continue;
    nomorBagian += 1;

    // Pemisah hanya berguna kalau bagian itu berisi beberapa slide;
    // bila hanya satu, judulnya sudah tampil di slide isi.
    const perluPemisah =
      pakaiPemisah &&
      b.judul.trim() !== opsi.judul.trim() &&
      b.grup.length > 1;

    if (perluPemisah) {
      slideSeksi(
        slideBaru(),
        tema,
        nomorBagian,
        b.judul,
        `${b.grup.length} subbagian`,
      );
    }

    for (const g of b.grup) {
      renderGrup(g, tema, slideBaru, stat, judulDeck, opsi.gambarDiagram ?? {});
    }
  }

  // --- Sumber -----------------------------------------------------------
  if (opsi.sumber && opsi.sumber.length > 0) {
    const s = slideBaru();
    slideIsi(
      s,
      tema,
      "Sumber dan lampiran",
      "Rujukan",
      opsi.sumber.slice(0, 10).map((x) => ({ teks: x, level: 0 })),
      "Dokumen dan tautan yang menjadi bahan penyusunan materi ini.",
    );
    kaki(s, tema, opsi.judul, stat.slideCount);
  }

  // --- Penutup ----------------------------------------------------------
  const tindak = cariTindakLanjut(opsi.blocks);
  slidePenutup(slideBaru(), tema, opsi.judul, tindak, meta);

  return stat;
}

/** Cari butir "tindak lanjut"/"rekomendasi" terakhir untuk slide penutup. */
function cariTindakLanjut(blocks: ContentBlock[]): string | undefined {
  let hasil: string | undefined;
  for (const b of blocks) {
    if (b.type === "list") {
      for (const it of b.items) {
        if (/tindak lanjut|rekomendasi|saran|langkah berikut|next step/i.test(it.text)) {
          hasil = it.text;
        }
      }
    }
  }
  return hasil;
}

/** Render satu grup blok menjadi satu atau beberapa slide. */
function renderGrup(
  grup: Grup,
  tema: TemaPpt,
  slideBaru: () => Slide,
  stat: StatDeckPpt,
  judulDeck: string,
  petaGambar: Record<string, string>,
): void {
  let antre: Butir[] = [];
  let lead: string | undefined;
  let sudahPakaiLead = false;
  /** Jumlah slide yang sudah dibuat untuk grup ini (untuk judul lanjutan). */
  let slideKe = 0;

  /** Judul slide berikutnya; slide kedua dan seterusnya ditandai lanjutan. */
  const judulBerikut = (dasar: string) =>
    slideKe === 0 ? dasar : `${dasar} (lanjutan)`;

  const flush = () => {
    if (antre.length === 0 && !lead) return;

    const kartu = kartuDariButir(antre);
    if (kartu) {
      const s = slideBaru();
      slideKpi(s, tema, grup.judul, kartu, grup.kicker);
      kaki(s, tema, judulDeck, stat.slideCount);
      stat.kpi += 1;
      antre = [];
      lead = undefined;
      return;
    }

    const s = slideBaru();
    slideIsi(s, tema, judulBerikut(grup.judul), grup.kicker, antre, lead);
    kaki(s, tema, judulDeck, stat.slideCount);
    slideKe += 1;
    antre = [];
    lead = undefined;
  };

  for (const b of grup.blok) {
    switch (b.type) {
      case "heading": {
        antre.push({ teks: b.text, level: 1 });
        break;
      }
      case "paragraph": {
        // Paragraf pertama yang pendek dipakai sebagai kalimat pengantar.
        if (!sudahPakaiLead && antre.length === 0 && b.text.length <= 210) {
          lead = b.text;
          sudahPakaiLead = true;
        } else {
          antre.push({ teks: b.text, level: 0 });
        }
        break;
      }
      case "list": {
        if (layakProses(b)) {
          flush();
          const s = slideBaru();
          slideProses(
            s,
            tema,
            grup.judul,
            b.items.map((it) => it.text),
            grup.kicker,
          );
          kaki(s, tema, judulDeck, stat.slideCount);
          stat.proses += 1;
        } else {
          antre.push(...ratakanButir(b.items));
        }
        break;
      }
      case "table": {
        flush();
        const t = b as TableBlock;
        // Maksimal 9 baris per slide; sisanya jadi slide lanjutan.
        const perSlide = 9;
        for (let i = 0; i < Math.max(t.rows.length, 1); i += perSlide) {
          const potong = t.rows.slice(i, i + perSlide);
          const s = slideBaru();
          slideTabel(
            s,
            tema,
            judulBerikut(grup.judul),
            t.headers,
            potong,
            grup.kicker,
            t.caption,
          );
          kaki(s, tema, judulDeck, stat.slideCount);
          slideKe += 1;
          stat.tabel += 1;
        }
        break;
      }
      case "chart": {
        flush();
        const s = slideBaru();
        slideGrafik(s, tema, judulBerikut(grup.judul), b as ChartBlock, grup.kicker);
        kaki(s, tema, judulDeck, stat.slideCount);
        slideKe += 1;
        stat.grafik += 1;
        break;
      }
      case "image": {
        flush();
        const g = b as ImageBlock;
        if (/^data:image\//i.test(g.src)) {
          const s = slideBaru();
          slideGambar(s, tema, g.caption || grup.judul, g.src, g.caption);
          kaki(s, tema, judulDeck, stat.slideCount);
          stat.gambar += 1;
        } else {
          antre.push({ teks: g.caption || g.alt || "Gambar", level: 0 });
        }
        break;
      }
      case "diagram": {
        flush();
        const d = b as DiagramBlock;

        // Hasil render Mermaid (bila ada) selalu diutamakan: itulah diagram
        // yang sesungguhnya, bukan tafsiran kita atas teksnya.
        const png = petaGambar[b.id];
        if (png) {
          const s = slideBaru();
          slideGambar(s, tema, grup.judul, png, "Diagram");
          kaki(s, tema, judulDeck, stat.slideCount);
          stat.diagram += 1;
          break;
        }

        const label = [...d.source.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
        if (/-->/.test(d.source) && label.length >= 3 && label.length <= 5) {
          const s = slideBaru();
          slideProses(s, tema, grup.judul, label, grup.kicker);
          kaki(s, tema, judulDeck, stat.slideCount);
          stat.proses += 1;
        } else {
          const s = slideBaru();
          slideKode(s, tema, grup.judul, d.source);
          kaki(s, tema, judulDeck, stat.slideCount);
          stat.kode += 1;
        }
        break;
      }
      case "code": {
        flush();
        const s = slideBaru();
        slideKode(s, tema, grup.judul, b.code);
        kaki(s, tema, judulDeck, stat.slideCount);
        stat.kode += 1;
        break;
      }
      case "divider":
      default:
        break;
    }
  }

  flush();
}
