/**
 * Uji generasi bertahap: kerangka → per bagian.
 *
 * Yang diuji bukan kualitas tulisan model (itu di luar kendali kita),
 * melainkan janji-janji mesinnya: setiap bagian jadi satu judul, bagian yang
 * gagal tidak membatalkan sisanya, dan bahan pengguna benar-benar terkirim.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { antrean } = vi.hoisted(() => ({ antrean: [] as string[] }));

vi.mock("./ai", () => ({
  generateCompletion: vi.fn(async () => antrean.shift() ?? "[]"),
}));

import { generateBertahap, parseKerangka } from "./auto-generate";
import { generateCompletion } from "./ai";

const dasar = {
  provider: "openai" as const,
  model: "uji",
  apiKey: "kunci-uji",
  prompt: "Buat laporan triwulan",
  jumlahBagian: 2,
};

beforeEach(() => {
  antrean.length = 0;
  vi.mocked(generateCompletion).mockClear();
});

describe("parseKerangka", () => {
  it("membaca objek {judul, bagian:[{judul, poin}]}", () => {
    const k = parseKerangka(
      JSON.stringify({
        judul: "Laporan Triwulan",
        bagian: [
          { judul: "Pendahuluan", poin: ["latar belakang", "tujuan"] },
          { judul: "Hasil", poin: ["capaian"] },
        ],
      }),
      6,
    );
    expect(k.judul).toBe("Laporan Triwulan");
    expect(k.bagian).toHaveLength(2);
    expect(k.bagian[0].poin).toEqual(["latar belakang", "tujuan"]);
  });

  it("menerima array string dan membuang judul duplikat", () => {
    const k = parseKerangka(
      JSON.stringify(["Pendahuluan", "Hasil", "pendahuluan", ""]),
      6,
    );
    expect(k.bagian.map((b) => b.judul)).toEqual(["Pendahuluan", "Hasil"]);
  });

  it("membatasi jumlah bagian dan mengabaikan JSON rusak", () => {
    const banyak = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => `Bagian ${i + 1}`),
    );
    expect(parseKerangka(banyak, 4).bagian).toHaveLength(4);
    expect(parseKerangka("bukan json", 4).bagian).toHaveLength(0);
  });
});

describe("generateBertahap", () => {
  it("menghasilkan satu judul level 2 per bagian dan memanggil onBagian", async () => {
    antrean.push(
      JSON.stringify({
        judul: "Laporan Triwulan III",
        bagian: [{ judul: "Pendahuluan" }, { judul: "Hasil" }],
      }),
      JSON.stringify([
        { type: "paragraph", text: "Latar belakang pekerjaan." },
        { type: "list", ordered: false, items: [{ text: "Tujuan" }] },
      ]),
      JSON.stringify([
        { type: "paragraph", text: "Capaian utama 81%." },
        { type: "table", headers: ["Uraian", "Nilai"], rows: [["Capaian", "81%"]] },
      ]),
    );

    const diterima: { indeks: number; judul: string }[] = [];
    const hasil = await generateBertahap({
      ...dasar,
      onBagian: (_blok, info) => diterima.push({ indeks: info.indeks, judul: info.judul }),
    });

    const judul = hasil.blocks.filter(
      (b) => b.type === "heading" && b.level === 2,
    );
    expect(judul).toHaveLength(2);
    expect(diterima).toEqual([
      { indeks: 0, judul: "Pendahuluan" },
      { indeks: 1, judul: "Hasil" },
    ]);
    expect(hasil.bagianGagal).toEqual([]);
    expect(hasil.judul).toBe("Laporan Triwulan III");
    expect(hasil.statistik.tabel).toBe(1);
    expect(hasil.kualitas.skor).toBeGreaterThan(0);
    // 1 panggilan kerangka + 2 panggilan bagian.
    expect(generateCompletion).toHaveBeenCalledTimes(3);
  });

  it("melewati bagian yang gagal tanpa membatalkan sisanya", async () => {
    antrean.push(
      JSON.stringify({ bagian: [{ judul: "Satu" }, { judul: "Dua" }] }),
      JSON.stringify([{ type: "paragraph", text: "Isi bagian satu." }]),
      "bukan json",
    );

    const hasil = await generateBertahap(dasar);
    expect(hasil.bagianGagal).toEqual([1]);
    expect(hasil.blocks).toHaveLength(2); // heading + paragraf
    expect(hasil.blocks[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("mengirim bahan pengguna ke permintaan kerangka", async () => {
    antrean.push(
      JSON.stringify({ bagian: [{ judul: "Satu" }] }),
      JSON.stringify([{ type: "paragraph", text: "Isi." }]),
    );
    await generateBertahap({ ...dasar, bahan: "BAHAN-RAHASIA-123" });

    const panggilan = vi.mocked(generateCompletion).mock.calls;
    const pesanKerangka = panggilan[0][0].pesan.map((p) => p.teks).join("\n");
    expect(pesanKerangka).toContain("BAHAN-RAHASIA-123");
  });

  it("melempar galat bila tidak ada satu pun bagian yang berhasil", async () => {
    antrean.push(JSON.stringify({ bagian: [{ judul: "Satu" }] }), "bukan json");
    await expect(generateBertahap(dasar)).rejects.toThrow(/tidak ada bagian/i);
  });
});
