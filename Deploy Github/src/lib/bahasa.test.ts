/**
 * Uji spesifikasi bahasa: perbaikan ejaan, pemeriksaan mutu, dan panduan prompt.
 *
 * Yang diuji bukan "apakah teksnya bagus" (itu tugas model), melainkan
 * apakah aturan yang kita klaim benar-benar berjalan deterministik.
 */
import { describe, it, expect } from "vitest";
import {
  bangunPanduanBahasa,
  perbaikiEjaan,
  periksaBahasa,
  rapikanEjaanBlok,
  type RagamDokumen,
} from "./bahasa";
import type { ContentBlock } from "../types";

const blok = (b: Record<string, unknown>): ContentBlock =>
  b as unknown as ContentBlock;

describe("perbaikiEjaan", () => {
  it("mengganti kata tidak baku menjadi bentuk baku", () => {
    expect(perbaikiEjaan("dimana lokasi kantor")).toBe("di mana lokasi kantor");
    expect(perbaikiEjaan("Resiko proyek ini kecil")).toBe(
      "Risiko proyek ini kecil",
    );
    expect(perbaikiEjaan("praktek kerja lapangan")).toBe(
      "praktik kerja lapangan",
    );
  });

  it("merapikan format rupiah, persen, dan spasi ganda", () => {
    expect(perbaikiEjaan("biaya Rp 1.250.000")).toBe("biaya Rp1.250.000");
    expect(perbaikiEjaan("capaian 87 %")).toBe("capaian 87%");
    expect(perbaikiEjaan("dua   spasi")).toBe("dua spasi");
    expect(perbaikiEjaan("titik , koma")).toBe("titik, koma");
  });

  it("mengubah rentang tahun menjadi tanda pisah en", () => {
    expect(perbaikiEjaan("periode 2024-2026")).toBe("periode 2024–2026");
  });

  it("tidak merusak URL", () => {
    const teks = "lihat https://contoh.go.id/praktek/dimana?x=1 untuk detail";
    expect(perbaikiEjaan(teks)).toBe(teks);
  });
});

describe("rapikanEjaanBlok", () => {
  it("memperbaiki teks tetapi tidak menyentuh blok kode", () => {
    const hasil = rapikanEjaanBlok([
      blok({ id: "a", type: "paragraph", text: "dimana resiko" }),
      blok({ id: "b", type: "code", language: "sql", code: "select * from resiko" }),
    ]);
    expect(hasil[0].type === "paragraph" && hasil[0].text).toBe(
      "di mana risiko",
    );
    expect(hasil[1].type === "code" && hasil[1].code).toBe(
      "select * from resiko",
    );
  });
});

describe("periksaBahasa", () => {
  const bersih: ContentBlock[] = [
    blok({ id: "h", type: "heading", level: 2, text: "Realisasi anggaran" }),
    blok({
      id: "p",
      type: "paragraph",
      text: "Realisasi anggaran mencapai 81% dari target. Sisa 19% dijadwalkan pada triwulan berikutnya.",
    }),
    blok({
      id: "l",
      type: "list",
      ordered: false,
      items: [{ text: "Belanja pegawai 42%" }, { text: "Belanja barang 33%" }],
    }),
  ];

  it("memberi skor penuh untuk teks yang bersih", () => {
    const hasil = periksaBahasa(bersih, { ragam: "laporan" });
    expect(hasil.skor).toBe(100);
    expect(hasil.temuan).toHaveLength(0);
    expect(hasil.jumlahKata).toBeGreaterThan(10);
  });

  it("menandai kalimat yang melewati batas kata", () => {
    const panjang = `${"kata ".repeat(30)}selesai.`;
    const hasil = periksaBahasa(
      [blok({ id: "p", type: "paragraph", text: panjang })],
      { ragam: "laporan" },
    );
    expect(hasil.temuan.some((t) => t.kode === "kalimat-panjang")).toBe(true);
    expect(hasil.skor).toBeLessThan(100);
  });

  it("menandai kata percakapan sebagai temuan kritis", () => {
    const hasil = periksaBahasa(
      [blok({ id: "p", type: "paragraph", text: "Program ini bagus banget." })],
      { ragam: "laporan" },
    );
    const temuan = hasil.temuan.find((t) => t.kode === "kata-informal");
    expect(temuan?.level).toBe("kritis");
  });

  it("menandai frasa klise dan klaim tanpa angka", () => {
    const hasil = periksaBahasa(
      [
        blok({
          id: "p",
          type: "paragraph",
          text: "Di era globalisasi, program ini paling efektif.",
        }),
      ],
      { ragam: "laporan" },
    );
    expect(hasil.temuan.some((t) => t.kode === "frasa-klise")).toBe(true);
    expect(hasil.temuan.some((t) => t.kode === "klaim-tanpa-angka")).toBe(true);
  });

  it("membatasi jumlah butir lebih ketat untuk slide", () => {
    const daftar = blok({
      id: "l",
      type: "list",
      ordered: false,
      items: Array.from({ length: 7 }, (_, i) => ({ text: `Butir ${i + 1}` })),
    });
    const dokumen = periksaBahasa([daftar], { ragam: "laporan" });
    const slide = periksaBahasa([daftar], {
      ragam: "presentasi",
      untukSlide: true,
    });
    expect(dokumen.temuan.some((t) => t.kode === "butir-berlebih")).toBe(false);
    expect(slide.temuan.some((t) => t.kode === "butir-berlebih")).toBe(true);
  });

  it("mengembalikan skor 0–100 dan ringkasan yang bisa ditampilkan", () => {
    const hasil = periksaBahasa(bersih);
    expect(hasil.skor).toBeGreaterThanOrEqual(0);
    expect(hasil.skor).toBeLessThanOrEqual(100);
    expect(hasil.ringkas.length).toBeGreaterThan(0);
  });
});

describe("bangunPanduanBahasa", () => {
  const ragam: RagamDokumen[] = ["laporan", "presentasi", "proposal", "notulen"];

  it("memuat struktur baku setiap ragam", () => {
    for (const r of ragam) {
      const teks = bangunPanduanBahasa({ ragam: r });
      expect(teks).toContain("RAGAM:");
      expect(teks).toContain("Struktur baku");
    }
  });

  it("menambahkan aturan slide hanya bila diminta", () => {
    expect(bangunPanduanBahasa({ ragam: "presentasi", untukSlide: true })).toContain(
      "ATURAN SLIDE",
    );
    expect(bangunPanduanBahasa({ ragam: "laporan" })).not.toContain(
      "ATURAN SLIDE",
    );
  });

  it("memuat larangan klise pada mode lengkap", () => {
    const lengkap = bangunPanduanBahasa({ ragam: "laporan" });
    const ringkas = bangunPanduanBahasa({ ragam: "laporan", ringkas: true });
    expect(lengkap).toContain("LARANGAN");
    expect(ringkas).not.toContain("LARANGAN");
    expect(ringkas.length).toBeLessThan(lengkap.length);
  });
});
