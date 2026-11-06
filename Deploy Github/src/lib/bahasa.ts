/**
 * Spesifikasi Bahasa & Retorika Dokumen — NitZ-909
 *
 * Modul ini adalah "otak bahasa" yang dipakai di dua tempat sekaligus:
 *
 *  1. **Sisi prompt** — `bangunPanduanBahasa()` menyusun blok instruksi yang
 *     ikut ke system prompt AI, sehingga teks yang lahir sudah patuh pada
 *     ragam, struktur, dan tata tulis yang benar (bukan diperbaiki belakangan).
 *  2. **Sisi kendali mutu** — `periksaBahasa()` memeriksa hasil secara
 *     deterministik (tanpa AI, tanpa jaringan) lalu memberi skor 0–100 dan
 *     daftar temuan. Ini yang membuat "laporan siap saji" bisa dibuktikan,
 *     bukan hanya diklaim.
 *
 * Semua aturan di sini mengacu pada:
 *  - PUEBI / EYD Edisi V (ejaan, tanda baca, penulisan angka & satuan);
 *  - kaidah kalimat efektif Bahasa Indonesia (SPOK, kepaduan, kehematan);
 *  - konvensi dokumen kedinasan & laporan profesional;
 *  - konvensi penulisan slide (satu gagasan per slide, judul aksi).
 *
 * Tidak ada dependensi eksternal — modul ini aman dipakai di browser.
 */
import type { ContentBlock, ListItem } from "../types";

/* =====================================================================
 * 1. RAGAM DOKUMEN
 * ===================================================================== */

/** Ragam dokumen yang punya profil bahasa & struktur sendiri. */
export type RagamDokumen =
  | "laporan"
  | "ringkasan"
  | "presentasi"
  | "proposal"
  | "analisis"
  | "notulen"
  | "sop";

export interface ProfilRagam {
  id: RagamDokumen;
  label: string;
  /** Satu kalimat: dokumen ini dipakai untuk apa. */
  tujuan: string;
  /** Kerangka baku, berurutan. */
  struktur: string[];
  /** Batas kata per kalimat (kaidah kalimat efektif). */
  maksKataKalimat: number;
  /** Batas butir per daftar. */
  maksButir: number;
  /** Batas kata per butir (dokumen vs slide berbeda jauh). */
  maksKataButir: number;
  /** Nada yang dituju. */
  nada: string;
}

/**
 * Angka batas di bawah bukan selera: 25 kata adalah ambang umum kalimat
 * efektif Indonesia; di atas itu pembaca kehilangan subjek. Untuk slide
 * batasnya jauh lebih ketat karena dibaca sambil mendengar.
 */
export const PROFIL_RAGAM: Record<RagamDokumen, ProfilRagam> = {
  laporan: {
    id: "laporan",
    label: "Laporan",
    tujuan:
      "Menyampaikan pelaksanaan, hasil, dan tindak lanjut secara berurutan sehingga pembaca dapat menilai capaian tanpa bertanya.",
    struktur: [
      "Identitas dan dasar pelaksanaan",
      "Latar belakang dan tujuan",
      "Ruang lingkup dan periode",
      "Pelaksanaan dan pembahasan",
      "Hasil yang terukur",
      "Kendala dan risiko",
      "Kesimpulan",
      "Rekomendasi tindak lanjut",
    ],
    maksKataKalimat: 25,
    maksButir: 7,
    maksKataButir: 22,
    nada: "formal, impersonal, faktual",
  },
  ringkasan: {
    id: "ringkasan",
    label: "Ringkasan eksekutif",
    tujuan:
      "Memberi keputusan dalam dua menit baca: apa yang diputuskan, angkanya berapa, risikonya apa.",
    struktur: [
      "Keputusan yang diminta",
      "Tiga temuan utama",
      "Angka kunci",
      "Risiko dan mitigasi",
      "Rekomendasi",
    ],
    maksKataKalimat: 22,
    maksButir: 5,
    maksKataButir: 18,
    nada: "padat, langsung, berorientasi keputusan",
  },
  presentasi: {
    id: "presentasi",
    label: "Materi presentasi",
    tujuan:
      "Satu slide satu gagasan; judul sudah menyampaikan kesimpulan, isi menjadi bukti.",
    struktur: [
      "Sampul",
      "Agenda",
      "Konteks dan masalah",
      "Temuan per bagian",
      "Data pendukung",
      "Implikasi",
      "Rekomendasi",
      "Penutup dan tindak lanjut",
    ],
    maksKataKalimat: 18,
    maksButir: 5,
    maksKataButir: 12,
    nada: "tegas, ringkas, berbicara",
  },
  proposal: {
    id: "proposal",
    label: "Proposal",
    tujuan:
      "Meyakinkan pembaca bahwa masalah nyata, solusi masuk akal, dan biaya serta risikonya terkendali.",
    struktur: [
      "Latar belakang",
      "Perumusan masalah",
      "Tujuan dan manfaat",
      "Ruang lingkup",
      "Metodologi dan tahapan",
      "Jadwal pelaksanaan",
      "Anggaran",
      "Risiko dan mitigasi",
      "Penutup",
    ],
    maksKataKalimat: 25,
    maksButir: 7,
    maksKataButir: 22,
    nada: "argumentatif, terukur, tanpa klaim berlebihan",
  },
  analisis: {
    id: "analisis",
    label: "Analisis",
    tujuan:
      "Menunjukkan hubungan sebab-akibat antara data dan kesimpulan, sehingga temuan dapat diuji ulang.",
    struktur: [
      "Konteks dan pertanyaan analisis",
      "Sumber dan metode",
      "Temuan per dimensi",
      "Pola dan anomali",
      "Keterbatasan data",
      "Implikasi",
      "Rekomendasi",
    ],
    maksKataKalimat: 25,
    maksButir: 7,
    maksKataButir: 20,
    nada: "netral, skeptis terhadap diri sendiri, berbasis bukti",
  },
  notulen: {
    id: "notulen",
    label: "Notulen rapat",
    tujuan:
      "Merekam keputusan dan siapa mengerjakan apa sampai kapan — bukan merekam percakapan.",
    struktur: [
      "Identitas rapat (hari, tanggal, waktu, tempat)",
      "Peserta dan yang tidak hadir",
      "Agenda",
      "Pokok pembahasan",
      "Keputusan",
      "Tindak lanjut: kegiatan, penanggung jawab, tenggat",
    ],
    maksKataKalimat: 22,
    maksButir: 8,
    maksKataButir: 18,
    nada: "ringkas, netral, tanpa opini",
  },
  sop: {
    id: "sop",
    label: "Prosedur kerja (SOP)",
    tujuan:
      "Siapa pun dengan pelatihan minimum dapat menjalankan langkah yang sama dengan hasil yang sama.",
    struktur: [
      "Tujuan",
      "Ruang lingkup",
      "Definisi dan singkatan",
      "Peran dan tanggung jawab",
      "Langkah kerja berurutan",
      "Catatan mutu dan keselamatan",
      "Dokumen terkait",
    ],
    maksKataKalimat: 20,
    maksButir: 12,
    maksKataButir: 16,
    nada: "imperatif, satu langkah satu kalimat",
  },
};

/* =====================================================================
 * 2. ATURAN BAHASA
 * ===================================================================== */

/** Aturan inti yang berlaku untuk SEMUA ragam dokumen. */
export const ATURAN_UMUM: string[] = [
  "Gunakan bahasa Indonesia baku sesuai PUEBI: tidak menyingkat kata di luar singkatan resmi, tidak memakai bentuk percakapan.",
  "Kalimat efektif: satu gagasan utama, subjek dan predikat berdekatan, hindari rantai keterangan sebelum predikat.",
  "Utamakan kalimat aktif. Kalimat pasif hanya untuk tindakan yang pelakunya memang tidak relevan.",
  "Paragraf 3–5 kalimat dengan kalimat topik di awal; satu paragraf satu gagasan.",
  "Istilah asing dicetak miring dan hanya dipakai bila padanan Indonesianya belum lazim; jelaskan sekali di awal.",
  "Singkatan dan akronim ditulis lengkap pada kemunculan pertama, contoh: Rencana Kerja dan Anggaran (RKA).",
  "Sebutkan sumber setiap angka: nama dokumen, periode, dan satuan. Angka tanpa sumber tidak dipakai.",
  "Hindari klaim tanpa bukti: 'sangat baik', 'paling efektif', 'signifikan' harus disertai angka atau rujukan.",
  "Gunakan istilah yang sama untuk hal yang sama dari awal sampai akhir; jangan berganti sinonim untuk konsep teknis.",
  "Tutup setiap bagian dengan implikasi, bukan dengan ringkasan ulang kalimat sebelumnya.",
];

/** Aturan khusus teks yang akan tampil di slide. */
export const ATURAN_SLIDE: string[] = [
  "Judul slide adalah pernyataan hasil, bukan label topik: 'Waktu proses turun 32%', bukan 'Proses'.",
  "Maksimal 5 butir per slide, maksimal 12 kata per butir, satu baris bila mungkin.",
  "Jangan menaruh paragraf di slide. Kalimat panjang dipindahkan ke catatan pembicara.",
  "Angka ditonjolkan lebih dulu, penjelasan menyusul: '32% lebih cepat — antrean turun dari 9 ke 6 menit'.",
  "Setiap slide hanya punya satu pesan; bila ada dua pesan, pecah jadi dua slide.",
  "Konsisten: pola judul, pola butir, dan penempatan angka sama di seluruh deck.",
];

/** Frasa pembuka klise yang melemahkan kredibilitas. */
export const FRASA_KLISE: string[] = [
  "di era globalisasi",
  "di era digital yang semakin berkembang",
  "seiring dengan perkembangan zaman",
  "seiring berjalannya waktu",
  "pada era modern ini",
  "tidak dapat dipungkiri bahwa",
  "sudah menjadi rahasia umum",
  "mari kita",
  "dapat disimpulkan bahwa",
  "pada dasarnya",
  "secara garis besar",
  "sangat penting sekali",
  "demikianlah",
  "untuk itu perlu kiranya",
];

/**
 * Kata tidak baku → bentuk baku (PUEBI). Kunci selalu huruf kecil.
 *
 * Hanya berisi pasangan yang tidak menimbulkan ambiguitas makna. Kata
 * percakapan (banget, gimana, nggak) TIDAK dimasukkan ke sini karena
 * penggantinya bergantung konteks — kata itu ditangani `KATA_INFORMAL`
 * sebagai temuan, bukan diperbaiki otomatis.
 */
export const KATA_TIDAK_BAKU: Record<string, string> = {
  aktifitas: "aktivitas",
  aktifitasnya: "aktivitasnya",
  analisa: "analisis",
  antri: "antre",
  apotik: "apotek",
  atlit: "atlet",
  azas: "asas",
  cendikiawan: "cendekiawan",
  dianalisa: "dianalisis",
  dibawah: "di bawah",
  diatas: "di atas",
  didalam: "di dalam",
  diluar: "di luar",
  dimana: "di mana",
  dipraktekan: "dipraktikkan",
  ekstrim: "ekstrem",
  faksimili: "faksimile",
  fikir: "pikir",
  frekwensi: "frekuensi",
  hipotesa: "hipotesis",
  ijin: "izin",
  jadual: "jadwal",
  jaman: "zaman",
  karir: "karier",
  katagori: "kategori",
  kedalam: "ke dalam",
  kemana: "ke mana",
  komplit: "komplet",
  konkrit: "konkret",
  kreatifitas: "kreativitas",
  kwalitas: "kualitas",
  kwantitas: "kuantitas",
  kwitansi: "kuitansi",
  managemen: "manajemen",
  menganalisa: "menganalisis",
  merubah: "mengubah",
  metoda: "metode",
  milyar: "miliar",
  nampak: "tampak",
  obyek: "objek",
  obyektif: "objektif",
  praktek: "praktik",
  praktekan: "praktikkan",
  produktifitas: "produktivitas",
  rejeki: "rezeki",
  resiko: "risiko",
  rubah: "ubah",
  standarisasi: "standardisasi",
  subyek: "subjek",
  tehnik: "teknik",
  tehnologi: "teknologi",
};

/** Kata/partikel percakapan yang tidak pantas di dokumen formal. */
export const KATA_INFORMAL: string[] = [
  "banget",
  "gimana",
  "gitu",
  "gini",
  "nggak",
  "gak",
  "udah",
  "pake",
  "cuma",
  "doang",
  "kayak",
  "gue",
  "gw",
  "lo",
  "bikin",
  "bilang",
  "kalian",
  "aku",
];

/* =====================================================================
 * 3. PANDUAN UNTUK PROMPT AI
 * ===================================================================== */

export interface OpsiPanduanBahasa {
  /** Ragam dokumen; menentukan struktur & batas panjang. */
  ragam?: RagamDokumen;
  /** Teks akan tampil di slide (aturan lebih ketat). */
  untukSlide?: boolean;
  /** Audiens spesifik, mis. "Kepala unit", "Pelajar kelas XI". */
  audiens?: string;
  /** Ringkas: buang contoh & penjelasan (hemat token). */
  ringkas?: boolean;
}

/**
 * Susun blok instruksi bahasa untuk system prompt.
 *
 * Sengaja ditulis sebagai daftar perintah pendek, bukan paragraf: model
 * mematuhi butir perintah jauh lebih konsisten daripada prosa panjang.
 */
export function bangunPanduanBahasa(opsi: OpsiPanduanBahasa = {}): string {
  const profil = PROFIL_RAGAM[opsi.ragam ?? "laporan"];
  const slide = opsi.untukSlide === true;
  const ringkas = opsi.ringkas === true;

  const bagian: string[] = [];

  bagian.push(
    `PERAN: Kamu penyunting dan penulis dokumen profesional berbahasa Indonesia. ` +
      `Tulisan harus layak diserahkan kepada pimpinan tanpa disunting ulang.`,
  );

  bagian.push(
    `RAGAM: ${profil.label} — ${profil.tujuan}\n` +
      `Struktur baku (ikuti urutannya, boleh digabung bila tidak relevan):\n` +
      profil.struktur.map((s, i) => `  ${i + 1}. ${s}`).join("\n"),
  );

  bagian.push(
    `ATURAN KALIMAT:\n` +
      `- Maksimal ${profil.maksKataKalimat} kata per kalimat; lebih dari itu pecah menjadi dua.\n` +
      `- Satu gagasan per kalimat; subjek dan predikat berdekatan.\n` +
      `- Kalimat aktif lebih diutamakan; hindari rantai kata "yang" lebih dari dua.\n` +
      `- Paragraf 3–5 kalimat, kalimat topik di awal.\n` +
      `- Nada: ${profil.nada}.`,
  );

  bagian.push(
    `TATA TULIS (PUEBI):\n` +
      `- Angka: 1.250.000 (titik ribuan), desimal dengan koma (12,5).\n` +
      `- Mata uang: Rp1.250.000 (tanpa spasi setelah Rp), persen: 12,5%.\n` +
      `- Satuan diberi spasi: 25 kg, 40 jam, 3 unit.\n` +
      `- Tanggal: 6 November 2026. Rentang: 2024–2026 (tanda pisah en).\n` +
      `- Singkatan dijelaskan pada kemunculan pertama: "Kebijakan Satu Data (KSD)".\n` +
      `- Tanpa spasi sebelum tanda baca; satu spasi setelahnya.`,
  );

  if (slide) {
    bagian.push(
      `ATURAN SLIDE:\n` +
        `- Judul = pernyataan hasil, maksimal 8 kata, tanpa titik.\n` +
        `- Maksimal ${profil.maksButir} butir per slide, maksimal ${profil.maksKataButir} kata per butir.\n` +
        `- Tanpa paragraf di slide; kalimat panjang menjadi catatan pembicara.\n` +
        `- Angka lebih dulu, penjelasan menyusul. Satu slide satu pesan.`,
    );
  } else {
    bagian.push(
      `ATURAN DAFTAR:\n` +
        `- Maksimal ${profil.maksButir} butir per daftar, maksimal ${profil.maksKataButir} kata per butir.\n` +
        `- Butir sejajar bentuknya (semua frasa nomina, atau semua kalimat perintah).\n` +
        `- Jangan menaruh lebih dari satu gagasan dalam satu butir.`,
    );
  }

  if (!ringkas) {
    bagian.push(
      `LARANGAN:\n` +
        `- Frasa klise pembuka: ${FRASA_KLISE.slice(0, 6).map((f) => `"${f}"`).join(", ")}, dan sejenisnya.\n` +
        `- Kata tidak baku seperti "dimana", "diatas", "resiko", "praktek", "aktifitas".\n` +
        `- Kata percakapan: "banget", "gimana", "nggak", "bikin".\n` +
        `- Klaim superlatif tanpa angka: "paling efektif", "sangat signifikan".\n` +
        `- Mengarang angka, nama orang, atau nama instansi yang tidak ada di permintaan.`,
    );

    bagian.push(
      `POLA TIAP BAGIAN: klaim → bukti/angka → implikasi. ` +
        `Bila data tidak tersedia, tulis kalimat yang menyebut data apa yang dibutuhkan, ` +
        `bukan angka karangan.`,
    );
  }

  if (opsi.audiens) {
    bagian.push(`AUDIENS: ${opsi.audiens}. Sesuaikan kedalaman istilah, bukan tingkat kebakuan.`);
  }

  return bagian.join("\n\n");
}

/** Versi satu paragraf — untuk prompt pendek / pemeriksaan cepat. */
export function panduanBahasaSingkat(ragam: RagamDokumen = "laporan"): string {
  const p = PROFIL_RAGAM[ragam];
  return (
    `Tulis dalam bahasa Indonesia baku dan kalimat efektif (maks. ${p.maksKataKalimat} kata). ` +
    `Nada ${p.nada}. Struktur: ${p.struktur.join("; ")}. ` +
    `Hindari frasa klise dan kata tidak baku. Setiap angka disertai satuan dan sumber.`
  );
}

/* =====================================================================
 * 4. PERBAIKAN EJAAN OTOMATIS
 * ===================================================================== */

/**
 * Kata yang aman diperbaiki otomatis.
 *
 * Diturunkan langsung dari `KATA_TIDAK_BAKU` supaya tidak pernah ada
 * ketidakcocokan antara daftar perbaikan dan daftar pemeriksaan.
 */
const AMAN_DIPERBAIKI = new Set(Object.keys(KATA_TIDAK_BAKU));

/**
 * Perbaiki ejaan & spasi yang jelas salah.
 *
 * Sengaja konservatif: hanya kata dalam daftar baku, spasi ganda, spasi
 * sebelum tanda baca, dan format mata uang/persen. Tidak mengubah pilihan
 * kata, tidak menyentuh istilah teknis, dan URL dilewati utuh.
 */
export function perbaikiEjaan(teks: string): string {
  if (!teks) return teks;
  // Pisahkan URL agar tautan tidak ikut "diperbaiki" (bisa merusak alamat).
  // Spasi di ujung baris baru dibuang SETELAH penggabungan — kalau dibuang
  // per segmen, spasi sebelum URL ikut hilang dan tautan menempel ke kata.
  return teks
    .split(/(\b(?:https?:\/\/|www\.)[^\s]+)/g)
    .map((bagian, i) => (i % 2 === 1 ? bagian : perbaikiSegmen(bagian)))
    .join("")
    .replace(/[ \t]+$/gm, "");
}

function perbaikiSegmen(teks: string): string {
  let s = teks;

  // 1. Kata tidak baku (hanya yang aman).
  s = s.replace(/[A-Za-z]+/g, (kata) => {
    const kunci = kata.toLowerCase();
    if (!AMAN_DIPERBAIKI.has(kunci)) return kata;
    const baku = KATA_TIDAK_BAKU[kunci];
    if (!baku) return kata;
    if (kata === kata.toUpperCase() && kata.length > 2) return baku.toUpperCase();
    if (kata[0] === kata[0].toUpperCase()) {
      return baku[0].toUpperCase() + baku.slice(1);
    }
    return baku;
  });

  // 2. Spasi & tanda baca.
  s = s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.;:!?%])/g, "$1")
    .replace(/([,;:])(?=[^\s\d/])/g, "$1 ")
    .replace(/\.{3,}/g, "…");

  // 3. Mata uang & persen.
  s = s
    .replace(/\bRp\.?\s*(?=\d)/g, "Rp")
    .replace(/(\d)\s+%/g, "$1%")
    .replace(/(\d)\s+(kg|km|cm|mm|ml|liter|ton|unit|orang|hari|bulan|tahun|jam|menit)\b/gi, "$1 $2");

  // 4. Tanda pisah rentang tahun: 2024-2026 → 2024–2026.
  s = s.replace(/\b(19|20)(\d{2})-(\d{2,4})\b/g, (_m, a, b, c) => `${a}${b}–${c}`);

  return s;
}

function perbaikiButir(items: ListItem[]): ListItem[] {
  return items.map((it) => ({
    ...it,
    text: perbaikiEjaan(it.text),
    ...(it.children ? { children: perbaikiButir(it.children) } : {}),
  }));
}

/**
 * Terapkan `perbaikiEjaan` ke seluruh blok teks.
 *
 * Blok `code` dan `diagram` dilewati: mengubah ejaan di sana merusak sintaks.
 */
export function rapikanEjaanBlok(blocks: ContentBlock[]): ContentBlock[] {
  return blocks.map((b) => {
    switch (b.type) {
      case "heading":
      case "paragraph":
        return { ...b, text: perbaikiEjaan(b.text) };
      case "list":
        return { ...b, items: perbaikiButir(b.items) };
      case "table":
        return {
          ...b,
          headers: b.headers.map(perbaikiEjaan),
          rows: b.rows.map((r) => r.map(perbaikiEjaan)),
          ...(b.caption ? { caption: perbaikiEjaan(b.caption) } : {}),
        };
      case "image":
        return {
          ...b,
          alt: perbaikiEjaan(b.alt),
          ...(b.caption ? { caption: perbaikiEjaan(b.caption) } : {}),
        };
      case "chart":
        return {
          ...b,
          data: {
            labels: b.data.labels.map(perbaikiEjaan),
            datasets: b.data.datasets.map((d) => ({
              ...d,
              label: perbaikiEjaan(d.label),
            })),
          },
        };
      default:
        return b;
    }
  });
}

/* =====================================================================
 * 5. PEMERIKSAAN MUTU
 * ===================================================================== */

export type LevelTemuan = "kritis" | "sedang" | "ringan";

export interface TemuanBahasa {
  kode: string;
  level: LevelTemuan;
  pesan: string;
  /** Id blok asal, bila temuan melekat pada satu blok. */
  blokId?: string;
  cuplikan?: string;
  saran?: string;
}

export interface LaporanBahasa {
  /** 0–100. 100 = tidak ada temuan. */
  skor: number;
  temuan: TemuanBahasa[];
  jumlahKata: number;
  ringkas: string;
}

export interface OpsiPeriksa {
  ragam?: RagamDokumen;
  /** Perketat batas butir & panjang kalimat untuk slide. */
  untukSlide?: boolean;
  /** Batas jumlah temuan yang dikembalikan (default 40). */
  maksTemuan?: number;
}

const BOBOT: Record<LevelTemuan, number> = {
  kritis: 8,
  sedang: 4,
  ringan: 1,
};

function hitungKata(teks: string): number {
  const t = teks.trim();
  return t ? t.split(/\s+/).length : 0;
}

function pecahKalimat(teks: string): string[] {
  return teks
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function cuplik(teks: string, maks = 90): string {
  const t = teks.replace(/\s+/g, " ").trim();
  return t.length <= maks ? t : `${t.slice(0, maks - 1)}…`;
}

interface TeksDiperiksa {
  id: string;
  jenis: "judul" | "paragraf" | "butir" | "sel" | "keterangan";
  teks: string;
  /** Jumlah butir dalam daftar asal (untuk aturan "butir berlebih"). */
  jumlahSaudara?: number;
}

function kumpulkanTeks(blocks: ContentBlock[]): TeksDiperiksa[] {
  const hasil: TeksDiperiksa[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        hasil.push({ id: b.id, jenis: "judul", teks: b.text });
        break;
      case "paragraph":
        hasil.push({ id: b.id, jenis: "paragraf", teks: b.text });
        break;
      case "list": {
        const semua = ratakanButir(b.items);
        for (const t of semua) {
          hasil.push({
            id: b.id,
            jenis: "butir",
            teks: t,
            jumlahSaudara: semua.length,
          });
        }
        break;
      }
      case "table": {
        for (const h of b.headers) hasil.push({ id: b.id, jenis: "sel", teks: h });
        for (const r of b.rows) {
          for (const c of r) hasil.push({ id: b.id, jenis: "sel", teks: c });
        }
        break;
      }
      case "image": {
        const t = b.caption || b.alt;
        if (t) hasil.push({ id: b.id, jenis: "keterangan", teks: t });
        break;
      }
      default:
        break;
    }
  }
  return hasil;
}

function ratakanButir(items: ListItem[]): string[] {
  const keluar: string[] = [];
  for (const it of items) {
    keluar.push(it.text);
    if (it.children?.length) keluar.push(...ratakanButir(it.children));
  }
  return keluar;
}

/**
 * Periksa mutu bahasa sekumpulan blok.
 *
 * Deterministik: aturan yang sama selalu menghasilkan temuan yang sama,
 * sehingga bisa dipakai sebagai gerbang mutu sebelum ekspor.
 */
export function periksaBahasa(
  blocks: ContentBlock[],
  opsi: OpsiPeriksa = {},
): LaporanBahasa {
  const profil = PROFIL_RAGAM[opsi.ragam ?? "laporan"];
  const slide = opsi.untukSlide === true;
  const maksKalimat = slide
    ? Math.min(profil.maksKataKalimat, 20)
    : profil.maksKataKalimat;
  const maksButir = slide ? Math.min(profil.maksButir, 5) : profil.maksButir;
  const maksKataButir = slide
    ? Math.min(profil.maksKataButir, 12)
    : profil.maksKataButir;

  const teks = kumpulkanTeks(blocks);
  const temuan: TemuanBahasa[] = [];
  const kunci = new Set<string>();
  let jumlahKata = 0;

  const catat = (t: TemuanBahasa) => {
    const k = `${t.kode}|${t.blokId ?? ""}|${t.cuplikan ?? ""}`;
    if (kunci.has(k)) return;
    kunci.add(k);
    temuan.push(t);
  };

  for (const t of teks) {
    jumlahKata += hitungKata(t.teks);
    const kalimat = pecahKalimat(t.teks);

    // --- kalimat terlalu panjang ---
    for (const k of kalimat) {
      const n = hitungKata(k);
      if (n > maksKalimat) {
        catat({
          kode: "kalimat-panjang",
          level: "sedang",
          pesan: `Kalimat ${n} kata (batas ${maksKalimat}). Pecah menjadi dua kalimat.`,
          blokId: t.id,
          cuplikan: cuplik(k),
          saran: "Letakkan satu gagasan utama per kalimat.",
        });
        break;
      }
    }

    // --- kata tidak baku ---
    const kataKata = t.teks.toLowerCase().match(/[a-z]+/g) ?? [];
    const tidakBaku = new Set<string>();
    for (const k of kataKata) {
      if (AMAN_DIPERBAIKI.has(k) && KATA_TIDAK_BAKU[k]) tidakBaku.add(k);
    }
    if (tidakBaku.size > 0) {
      const daftar = [...tidakBaku].slice(0, 3);
      catat({
        kode: "kata-tidak-baku",
        level: "sedang",
        pesan: `Kata tidak baku: ${daftar.join(", ")}.`,
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: daftar
          .map((k) => `${k} → ${KATA_TIDAK_BAKU[k]}`)
          .join("; "),
      });
    }

    // --- kata informal ---
    const informal = kataKata.filter((k) => KATA_INFORMAL.includes(k));
    if (informal.length > 0) {
      catat({
        kode: "kata-informal",
        level: "kritis",
        pesan: `Kata percakapan dipakai: ${[...new Set(informal)].join(", ")}.`,
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: "Ganti dengan padanan baku (tidak, bagaimana, sangat, membuat).",
      });
    }

    // --- frasa klise ---
    const rendah = t.teks.toLowerCase();
    const klise = FRASA_KLISE.find((f) => rendah.includes(f));
    if (klise) {
      catat({
        kode: "frasa-klise",
        level: "ringan",
        pesan: `Frasa klise: “${klise}”.`,
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: "Mulai langsung dengan fakta atau angka.",
      });
    }

    // --- klaim superlatif tanpa angka ---
    if (/\b(paling|terbaik|terbesar|tertinggi|sangat signifikan|sangat efektif)\b/i.test(t.teks)) {
      const adaAngka = /\d/.test(t.teks);
      if (!adaAngka) {
        catat({
          kode: "klaim-tanpa-angka",
          level: "ringan",
          pesan: "Klaim superlatif tanpa angka pendukung.",
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: "Tambahkan angka, periode, atau sumber pembanding.",
        });
      }
    }

    // --- format mata uang / persen / spasi ---
    if (/\bRp\.?\s\d/.test(t.teks)) {
      catat({
        kode: "format-mata-uang",
        level: "ringan",
        pesan: "Penulisan rupiah memakai spasi setelah Rp.",
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: "Tulis Rp1.250.000, bukan Rp 1.250.000.",
      });
    }
    if (/\d\s+%/.test(t.teks)) {
      catat({
        kode: "format-persen",
        level: "ringan",
        pesan: "Ada spasi sebelum tanda persen.",
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: "Tulis 12,5% tanpa spasi.",
      });
    }
    if (/\s[,.;:!?]/.test(t.teks)) {
      catat({
        kode: "spasi-tanda-baca",
        level: "ringan",
        pesan: "Ada spasi sebelum tanda baca.",
        blokId: t.id,
        cuplikan: cuplik(t.teks),
      });
    }
    if (/[ \t]{2,}/.test(t.teks)) {
      catat({
        kode: "spasi-ganda",
        level: "ringan",
        pesan: "Spasi ganda di dalam teks.",
        blokId: t.id,
        cuplikan: cuplik(t.teks),
      });
    }

    // --- panjang per jenis ---
    if (t.jenis === "judul") {
      const n = hitungKata(t.teks);
      if (n > (slide ? 10 : 14)) {
        catat({
          kode: "judul-panjang",
          level: "ringan",
          pesan: `Judul ${n} kata — terlalu panjang untuk dibaca sekilas.`,
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: "Ringkas menjadi frasa nomina maksimal 8 kata.",
        });
      }
    }

    if (t.jenis === "paragraf") {
      const n = hitungKata(t.teks);
      if (n > 160) {
        catat({
          kode: "paragraf-panjang",
          level: "sedang",
          pesan: `Paragraf ${n} kata.`,
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: "Pecah menjadi paragraf 3–5 kalimat dengan subjudul bila perlu.",
        });
      }
      if (kalimat.length > 6) {
        catat({
          kode: "paragraf-padat",
          level: "ringan",
          pesan: `Paragraf berisi ${kalimat.length} kalimat.`,
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: "Idealnya 3–5 kalimat per paragraf.",
        });
      }
    }

    if (t.jenis === "butir") {
      const n = hitungKata(t.teks);
      if (n > maksKataButir) {
        catat({
          kode: "butir-panjang",
          level: slide ? "sedang" : "ringan",
          pesan: `Butir ${n} kata (batas ${maksKataButir}).`,
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: slide
            ? "Pindahkan penjelasan ke catatan pembicara."
            : "Ringkas menjadi satu gagasan per butir.",
        });
      }
      if (t.jumlahSaudara && t.jumlahSaudara > maksButir) {
        catat({
          kode: "butir-berlebih",
          level: "sedang",
          pesan: `Daftar berisi ${t.jumlahSaudara} butir (batas ${maksButir}).`,
          blokId: t.id,
          cuplikan: cuplik(t.teks),
          saran: "Kelompokkan menjadi sub-daftar atau pecah ke dua slide.",
        });
      }
    }

    // --- kalimat pasif berantai ---
    const oleh = (rendah.match(/\boleh\b/g) ?? []).length;
    if (oleh >= 3) {
      catat({
        kode: "pasif-berantai",
        level: "ringan",
        pesan: `Frasa “oleh” muncul ${oleh} kali dalam satu blok.`,
        blokId: t.id,
        cuplikan: cuplik(t.teks),
        saran: "Ubah ke kalimat aktif agar pelaku jelas.",
      });
    }
  }

  // Skor.
  let potongan = 0;
  for (const t of temuan) potongan += BOBOT[t.level];
  const skor = Math.max(0, Math.min(100, 100 - potongan));

  const kritis = temuan.filter((t) => t.level === "kritis").length;
  const sedang = temuan.filter((t) => t.level === "sedang").length;
  const ringan = temuan.filter((t) => t.level === "ringan").length;

  const ringkas =
    temuan.length === 0
      ? "Mutu bahasa: bersih — tidak ada temuan."
      : `Mutu bahasa ${skor}/100 — ${[
          kritis ? `${kritis} kritis` : "",
          sedang ? `${sedang} sedang` : "",
          ringan ? `${ringan} ringan` : "",
        ]
          .filter(Boolean)
          .join(", ")}.`;

  return {
    skor,
    temuan: temuan.slice(0, opsi.maksTemuan ?? 40),
    jumlahKata,
    ringkas,
  };
}

/** Label singkat untuk ditampilkan di UI. */
export function labelMutu(skor: number): string {
  if (skor >= 90) return "Sangat baik";
  if (skor >= 75) return "Baik";
  if (skor >= 60) return "Cukup";
  if (skor >= 40) return "Perlu disunting";
  return "Belum layak";
}
