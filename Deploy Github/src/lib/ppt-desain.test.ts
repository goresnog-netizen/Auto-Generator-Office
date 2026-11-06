/**
 * Uji sistem desain presentasi.
 *
 * Uji yang paling penting di sini bukan "apakah fungsinya mengembalikan
 * sesuatu", melainkan apakah deck benar-benar bisa ditulis menjadi berkas
 * PPTX yang sah — karena itu yang dipakai pengguna.
 */
import { describe, it, expect } from "vitest";
import PptxGenJS from "pptxgenjs";
import {
  TEMA_PPT,
  campur,
  dimensiDataUrl,
  getTemaPpt,
  gradienLatar,
  gradienTema,
  kontras,
  susunDeckPpt,
  uraiAngka,
} from "./ppt-desain";
import type { ContentBlock } from "../types";

const blok = (b: Record<string, unknown>): ContentBlock =>
  b as unknown as ContentBlock;

const isiContoh: ContentBlock[] = [
  blok({ id: "h1", type: "heading", level: 1, text: "Laporan Kinerja Triwulan III" }),
  blok({
    id: "p1",
    type: "paragraph",
    text: "Realisasi anggaran triwulan III mencapai 81% dari target tahunan.",
  }),
  blok({ id: "h2", type: "heading", level: 2, text: "Capaian utama" }),
  blok({
    id: "l1",
    type: "list",
    ordered: false,
    items: [
      { text: "Realisasi anggaran: 81%" },
      { text: "Kunjungan layanan: 1.240 orang" },
      { text: "Waktu proses: 6 menit" },
    ],
  }),
  blok({ id: "h3", type: "heading", level: 2, text: "Rincian anggaran" }),
  blok({
    id: "t1",
    type: "table",
    headers: ["Komponen", "Anggaran", "Realisasi"],
    rows: [
      ["Pegawai", "Rp4.200.000", "Rp3.900.000"],
      ["Barang", "Rp2.100.000", "Rp1.850.000"],
    ],
    caption: "Sumber: laporan keuangan internal, September 2026.",
  }),
  blok({ id: "h4", type: "heading", level: 2, text: "Tren realisasi" }),
  blok({
    id: "c1",
    type: "chart",
    chartType: "bar",
    data: {
      labels: ["Juli", "Agustus", "September"],
      datasets: [{ label: "Realisasi", data: [72, 78, 81] }],
    },
  }),
  blok({ id: "h5", type: "heading", level: 2, text: "Alur persetujuan" }),
  blok({
    id: "l2",
    type: "list",
    ordered: true,
    items: [
      { text: "Verifikasi berkas" },
      { text: "Persetujuan unit" },
      { text: "Pencairan dana" },
      { text: "Pelaporan" },
    ],
  }),
];

async function tulis(pptx: PptxGenJS): Promise<Buffer> {
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

describe("tema", () => {
  it("memiliki id unik dan warna heksadesimal yang sah", () => {
    const id = new Set(TEMA_PPT.map((t) => t.id));
    expect(id.size).toBe(TEMA_PPT.length);
    expect(TEMA_PPT.length).toBeGreaterThanOrEqual(8);

    for (const t of TEMA_PPT) {
      for (const [nama, warna] of Object.entries(t.warna)) {
        expect(warna, `${t.id}.${nama}`).toMatch(/^[0-9A-F]{6}$/i);
      }
      expect(t.tipografi.judul.length).toBeGreaterThan(0);
      expect(t.tipografi.isi.length).toBeGreaterThan(0);
    }
  });

  it("jatuh ke tema bawaan bila id tidak dikenal", () => {
    expect(getTemaPpt("tidak-ada").id).toBe("swiss");
    expect(getTemaPpt(null).id).toBe("swiss");
    expect(getTemaPpt("navy").id).toBe("navy");
  });

  it("mencampur warna secara proporsional", () => {
    expect(campur("000000", "FFFFFF", 0)).toBe("000000");
    expect(campur("000000", "FFFFFF", 1)).toBe("FFFFFF");
    expect(campur("000000", "FFFFFF", 0.5)).toBe("808080");
  });

  it("memilih warna teks yang kontras", () => {
    expect(kontras("FFFFFF")).toBe("121212");
    expect(kontras("0A1B33")).toBe("FFFFFF");
  });
});

describe("dimensiDataUrl", () => {
  it("membaca ukuran PNG dari header tanpa mendekode piksel", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    expect(dimensiDataUrl(png)).toEqual({ w: 1, h: 1 });
  });

  it("mengembalikan null untuk data yang bukan gambar", () => {
    expect(dimensiDataUrl("data:text/plain;base64,SGVsbG8=")).toBeNull();
    expect(dimensiDataUrl("bukan-data-url")).toBeNull();
  });
});

describe("gradien latar", () => {
  it("menyediakan gradien untuk tema yang memang memakainya", () => {
    expect(gradienTema("navy")?.sudut).toBe(135);
    expect(gradienTema("sage")?.dari).toBe("FFFFFF");
    // Tema "putih bersih" sengaja tanpa gradien.
    expect(gradienTema("swiss")).toBeUndefined();
    expect(gradienTema("mono")).toBeUndefined();
  });

  it("kembali ke null tanpa DOM, sehingga latar jatuh ke warna solid", () => {
    const g = gradienTema("navy");
    expect(g).toBeDefined();
    expect(gradienLatar(g!)).toBeNull();
  });
});

describe("uraiAngka", () => {
  it("memisahkan nilai dan label", () => {
    const k = uraiAngka("Realisasi anggaran: 81%");
    expect(k?.nilai).toBe("81%");
    expect(k?.label).toBe("Realisasi anggaran");
  });

  it("mengenali rupiah dan satuan", () => {
    expect(uraiAngka("Total belanja Rp1.250.000")?.nilai).toBe("Rp1.250.000");
    expect(uraiAngka("Kunjungan 1.240 orang")?.nilai).toBe("1.240 orang");
  });

  it("mengembalikan null bila tidak ada angka", () => {
    expect(uraiAngka("Tidak ada angka di sini")).toBeNull();
  });
});

describe("susunDeckPpt", () => {
  it("menulis berkas PPTX yang sah dari konten campuran", async () => {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";

    const stat = susunDeckPpt(pptx, {
      judul: "Laporan Kinerja Triwulan III",
      blocks: isiContoh,
      tema: "navy",
      sumber: ["laporan-keuangan.xlsx"],
      meta: { organisasi: "Unit Perencanaan", tanggal: "6 November 2026" },
    });

    // Sampul + agenda + isi + KPI + tabel + grafik + proses + sumber + penutup.
    expect(stat.slideCount).toBeGreaterThanOrEqual(8);
    expect(stat.kpi).toBe(1);
    expect(stat.tabel).toBe(1);
    expect(stat.grafik).toBe(1);
    expect(stat.proses).toBe(1);

    const buf = await tulis(pptx);
    expect(buf.length).toBeGreaterThan(15_000);
    // Berkas OOXML selalu diawali arsip ZIP "PK".
    expect(buf.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("tetap menghasilkan deck walau kanvas kosong", async () => {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const stat = susunDeckPpt(pptx, { judul: "Kosong", blocks: [] });
    expect(stat.slideCount).toBeGreaterThanOrEqual(1);
    const buf = await tulis(pptx);
    expect(buf.length).toBeGreaterThan(5_000);
  });

  it("menerima tema sebagai objek maupun id", async () => {
    for (const tema of [getTemaPpt("sage"), "graphite", "tidak-ada"]) {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      const stat = susunDeckPpt(pptx, {
        judul: "Uji Tema",
        blocks: isiContoh.slice(0, 4),
        tema,
      });
      expect(stat.slideCount).toBeGreaterThan(0);
      const buf = await tulis(pptx);
      expect(buf.length).toBeGreaterThan(5_000);
    }
  });

  it("menyisipkan diagram Mermaid sebagai gambar bila sudah dirender", async () => {
    // PNG 1×1 piksel — cukup untuk membuktikan jalur gambar dipakai.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const blocks: ContentBlock[] = [
      blok({ id: "h", type: "heading", level: 1, text: "Alur" }),
      blok({ id: "h2", type: "heading", level: 2, text: "Alur kerja" }),
      blok({
        id: "d1",
        type: "diagram",
        diagramType: "mermaid",
        source: "flowchart LR\n A[Verifikasi] --> B[Persetujuan] --> C[Pencairan]",
      }),
    ];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const stat = susunDeckPpt(pptx, {
      judul: "Alur",
      blocks,
      tema: "navy",
      gambarDiagram: { d1: png },
    });
    expect(stat.diagram).toBe(1);
    expect(stat.proses).toBe(0);
    const buf = await tulis(pptx);
    expect(buf.length).toBeGreaterThan(8_000);
  });

  it("memakai fallback proses bila diagram belum dirender", async () => {
    const blocks: ContentBlock[] = [
      blok({ id: "h", type: "heading", level: 1, text: "Alur" }),
      blok({ id: "h2", type: "heading", level: 2, text: "Alur kerja" }),
      blok({
        id: "d1",
        type: "diagram",
        diagramType: "mermaid",
        source: "flowchart LR\n A[Verifikasi] --> B[Persetujuan] --> C[Pencairan]",
      }),
    ];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const stat = susunDeckPpt(pptx, { judul: "Alur", blocks, tema: "navy" });
    expect(stat.diagram).toBe(0);
    expect(stat.proses).toBe(1);
  });

  it("memecah tabel panjang menjadi beberapa slide", async () => {
    const baris = Array.from({ length: 20 }, (_, i) => [
      `Baris ${i + 1}`,
      String(i * 10),
    ]);
    const blocks: ContentBlock[] = [
      blok({ id: "h", type: "heading", level: 1, text: "Data" }),
      blok({ id: "h2", type: "heading", level: 2, text: "Rekap" }),
      blok({
        id: "t",
        type: "table",
        headers: ["Uraian", "Nilai"],
        rows: baris,
      }),
    ];
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    const stat = susunDeckPpt(pptx, { judul: "Data", blocks });
    expect(stat.tabel).toBe(3);
  });
});
