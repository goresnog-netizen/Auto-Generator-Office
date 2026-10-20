/**
 * Persona pengguna NitZ-909 (paket medium).
 * Satu tekan: filter template relevan + pola judul + bank contoh isian.
 * Semua contoh berlabel DATA UJI (sintetis) — bukan kejadian nyata.
 */
export type PersonaId =
  | "pelajar"
  | "mahasiswa"
  | "bisnis"
  | "marketing"
  | "umkm"
  | "polisi"
  | "tni"
  | "kesehatan";

export interface Persona {
  id: PersonaId;
  nama: string;
  ikon: string;
  templateIds: string[];
  polaJudul: string;
  contoh: string[];
}

const TANDA = " (DATA UJI — contoh sintetis, ganti dengan data nyata)";

export const PERSONAS: Persona[] = [
  {
    id: "pelajar",
    nama: "Pelajar",
    ikon: "🎓",
    templateIds: [
      "laporan_kegiatan",
      "timeline",
      "comparison",
      "one_page_brief",
    ],
    polaJudul: "LAPORAN KEGIATAN — [nama kegiatan, kelas]",
    contoh: [
      "Kegiatan dilaksanakan pada hari Senin di aula sekolah, diikuti 40 siswa kelas XI." +
        TANDA,
      "Rangkaian acara: pembukaan, materi inti, diskusi kelompok, dan penutupan." +
        TANDA,
      "Kendala: waktu persiapan singkat sehingga dekorasi disederhanakan." +
        TANDA,
      "Tindak lanjut: laporan diserahkan ke wali kelas beserta dokumentasi foto." +
        TANDA,
    ],
  },
  {
    id: "mahasiswa",
    nama: "Mahasiswa",
    ikon: "🎒",
    templateIds: [
      "proposal_penelitian",
      "laporan_teknis",
      "data_analysis",
      "statistical_summary",
    ],
    polaJudul: "PROPOSAL PENELITIAN — [topik]",
    contoh: [
      "Latar belakang: ketersediaan data primer masih terbatas sehingga survei awal diperlukan." +
        TANDA,
      "Metode: deskriptif kuantitatif dengan 60 responden yang dipilih acak." +
        TANDA,
      "Hasil sementara: 72 persen responden menyatakan setuju terhadap usulan." +
        TANDA,
      "Simpulan sementara akan diuji ulang pada tahap analisis lanjutan." +
        TANDA,
    ],
  },
  {
    id: "bisnis",
    nama: "Bisnis",
    ikon: "💼",
    templateIds: [
      "executive_briefing",
      "ringkasan_eksekutif",
      "project_status",
      "executive_dashboard",
    ],
    polaJudul: "RINGKASAN EKSEKUTIF — [unit] [periode]",
    contoh: [
      "Capaian triwulan: target 85 persen, realisasi 81 persen dari rencana." +
        TANDA,
      "Fokus berikutnya: efisiensi biaya operasional dan percepatan penagihan." +
        TANDA,
      "Risiko utama: keterlambatan pasokan dari dua vendor kunci." + TANDA,
      "Rekomendasi: tambah satu personel verifikasi mulai bulan depan." + TANDA,
    ],
  },
  {
    id: "marketing",
    nama: "Marketing",
    ikon: "📣",
    templateIds: [
      "formal_briefing",
      "comparison",
      "data_analysis",
      "one_page_brief",
    ],
    polaJudul: "BRIEF KAMPANYE — [nama kampanye]",
    contoh: [
      "Tujuan kampanye: menaikkan kesadaran merek pada segmen usia 18–25 tahun." +
        TANDA,
      "Pesan utama: satu kalimat janji manfaat yang mudah diingat audiens." +
        TANDA,
      "Kanal: media sosial 70 persen, luring 30 persen dari total anggaran." +
        TANDA,
      "Indikator berhasil: jangkauan, klik, dan formulir terisi selama dua pekan." +
        TANDA,
    ],
  },
  {
    id: "umkm",
    nama: "UMKM",
    ikon: "🏪",
    templateIds: [
      "laporan_evaluasi",
      "task_tracker",
      "event_log",
      "executive_dashboard",
    ],
    polaJudul: "LAPORAN USAHA — [nama usaha] [bulan]",
    contoh: [
      "Omzet bulan ini naik 12 persen dibanding bulan lalu karena pesanan daring." +
        TANDA,
      "Pengeluaran terbesar: bahan baku 45 persen dan ongkos kirim 20 persen." +
        TANDA,
      "Stok menipis: tiga varian terlaris perlu dipesan ulang pekan ini." +
        TANDA,
      "Rencana: tambah satu reseller dan ikut bazar akhir bulan." + TANDA,
    ],
  },
  {
    id: "polisi",
    nama: "Polisi",
    ikon: "🚔",
    templateIds: [
      "laporan_informasi",
      "kronologi_kejadian",
      "analisis_situasi",
      "laporan_perkembangan_situasi",
    ],
    polaJudul: "LAPORAN INFORMASI NOMOR: LI/__/2026",
    contoh: [
      "Pada hari dan tanggal tersebut diterima informasi dari masyarakat tentang kejadian." +
        TANDA,
      "Urutan kejadian: awal, perkembangan, dan kondisi terakhir di lokasi." +
        TANDA,
      "Tindakan yang telah diambil: olah tempat kejadian dan pendataan saksi." +
        TANDA,
      "Rencana tindak lanjut: gelar perkara awal dan koordinasi dengan fungsi terkait." +
        TANDA,
    ],
  },
  {
    id: "tni",
    nama: "TNI",
    ikon: "🪖",
    templateIds: [
      "laporan_pelaksanaan_tugas",
      "perkiraan_ancaman_kerawanan",
      "situation_brief",
      "risk_matrix",
    ],
    polaJudul: "LAPORAN PELAKSANAAN TUGAS — [satuan]",
    contoh: [
      "Pelaksanaan tugas berjalan sesuai rencana operasi yang telah ditetapkan." +
        TANDA,
      "Personel dan materiil dalam keadaan lengkap dan siap digerakkan." +
        TANDA,
      "Kerawanan: cuaca dan medan pada sektor timur perlu perhatian khusus." +
        TANDA,
      "Saran: patroli gabungan dilanjutkan hingga situasi dinyatakan aman." +
        TANDA,
    ],
  },
  {
    id: "kesehatan",
    nama: "Kesehatan",
    ikon: "🏥",
    templateIds: [
      "laporan_kegiatan",
      "laporan_evaluasi",
      "timeline",
      "process_flow",
    ],
    polaJudul: "LAPORAN KEGIATAN — [faskes] [periode]",
    contoh: [
      "Pelayanan berjalan setiap hari kerja pukul 08.00–14.00 dengan 3 petugas." +
        TANDA,
      "Capaian: 120 kunjungan, 95 persen pasien terlayani tanpa rujukan." +
        TANDA,
      "Kendala: stok satu jenis obat menipis dan alat ukur perlu kalibrasi." +
        TANDA,
      "Tindak lanjut: pengajuan logistik dan jadwal penyuluhan bulan depan." +
        TANDA,
    ],
  },
];

/** Bank umum bila tanpa persona. */
export const CONTOH_UMUM: string[] = [
  "Tuliskan latar belakang kegiatan di sini. Contoh: kegiatan dilaksanakan untuk memenuhi program kerja unit." +
    TANDA,
  "Tuliskan rangkaian pelaksanaan: waktu, tempat, peserta, dan susunan acara." +
    TANDA,
  "Tuliskan hasil yang dicapai beserta kendala yang dihadapi selama kegiatan." +
    TANDA,
  "Tuliskan kesimpulan dan rekomendasi tindak lanjut untuk periode berikutnya." +
    TANDA,
];

export function getPersona(id: string): Persona | undefined {
  return PERSONAS.find((p) => p.id === id);
}
