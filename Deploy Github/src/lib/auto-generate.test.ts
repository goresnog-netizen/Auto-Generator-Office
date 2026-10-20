/**
 * Uji parser auto-generate: balasan AI harus diubah menjadi blok yang valid,
 * dan blok cacat harus dibuang (bukan membuat crash).
 */
import { describe, it, expect } from "vitest";
import { parseBalasanOtomatis } from "./auto-generate";

const parse = (teks: string, allowRich = true) =>
  parseBalasanOtomatis(teks, { allowRich });

describe("parseBalasanOtomatis", () => {
  it("menerima array blok langsung", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "heading", level: 1, text: "Judul" },
        { type: "paragraph", text: "Isi" },
        { type: "list", ordered: true, items: [{ text: "Poin" }] },
      ]),
    );
    expect(hasil.blocks).toHaveLength(3);
    expect(hasil.dibuang).toBe(0);
    expect(hasil.judul).toBe("");
  });

  it("menerima objek {title, blocks}", () => {
    const hasil = parse(
      JSON.stringify({
        title: "Laporan Tahunan",
        blocks: [
          { type: "heading", level: 1, text: "Pendahuluan" },
          { type: "paragraph", text: "Isi" },
        ],
      }),
    );
    expect(hasil.blocks).toHaveLength(2);
    expect(hasil.judul).toBe("Laporan Tahunan");
  });

  it("melepas markdown fence", () => {
    const hasil = parse(
      "```json\n[{\"type\":\"paragraph\",\"text\":\"Halo\"}]\n```",
    );
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.blocks[0]).toMatchObject({ type: "paragraph", text: "Halo" });
  });

  it("membuang balasan yang bukan JSON", () => {
    const hasil = parse("Maaf, saya tidak bisa.");
    expect(hasil.blocks).toHaveLength(0);
    expect(hasil.dibuang).toBe(1);
  });

  it("membuang blok tanpa teks", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "paragraph", text: "   " },
        { type: "paragraph" },
        { type: "paragraph", text: "Sah" },
      ]),
    );
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.dibuang).toBe(2);
  });

  it("membuang tipe blok yang tidak dikenal", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "alien", text: "?" },
        { type: "paragraph", text: "Sah" },
      ]),
    );
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.dibuang).toBe(1);
  });

  it("membatasi level heading ke 1..4", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "heading", level: 99, text: "A" },
        { type: "heading", level: 0, text: "B" },
        { type: "heading", level: 2.6, text: "C" },
      ]),
    );
    const levels = hasil.blocks.map((b) =>
      b.type === "heading" ? b.level : 0,
    );
    expect(levels).toEqual([4, 1, 3]);
  });

  it("menerima list dengan anak nested", () => {
    const hasil = parse(
      JSON.stringify([
        {
          type: "list",
          ordered: false,
          items: [
            { text: "Satu" },
            { text: "Dua", children: [{ text: "Dua-A" }] },
          ],
        },
      ]),
    );
    expect(hasil.blocks).toHaveLength(1);
    const b = hasil.blocks[0];
    expect(b.type).toBe("list");
    if (b.type === "list") {
      expect(b.items).toHaveLength(2);
      expect(b.items[1].children?.[0].text).toBe("Dua-A");
    }
  });

  it("menerima list berupa string polos", () => {
    const hasil = parse(
      JSON.stringify([{ type: "list", ordered: true, items: ["A", "B"] }]),
    );
    expect(hasil.blocks).toHaveLength(1);
    const b = hasil.blocks[0];
    if (b.type === "list") {
      expect(b.items.map((i) => i.text)).toEqual(["A", "B"]);
      expect(b.ordered).toBe(true);
    }
  });

  it("membuang table tanpa header", () => {
    const hasil = parse(
      JSON.stringify([{ type: "table", headers: [], rows: [] }]),
    );
    expect(hasil.blocks).toHaveLength(0);
    expect(hasil.dibuang).toBe(1);
  });

  it("membuang table yang tidak diizinkan saat allowRich=false", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "table", headers: ["A"], rows: [["1"]] },
        { type: "paragraph", text: "Sah" },
      ]),
      false,
    );
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.dibuang).toBe(1);
  });

  it("memadangkan baris tabel yang lebih pendek dari header", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "table", headers: ["A", "B", "C"], rows: [["1"]] },
      ]),
    );
    const b = hasil.blocks[0];
    expect(b.type).toBe("table");
    if (b.type === "table") {
      expect(b.rows[0]).toHaveLength(3);
      expect(b.rows[0][2]).toBe("—");
    }
  });

  it("menerima chart dan menormalkan panjang data", () => {
    const hasil = parse(
      JSON.stringify([
        {
          type: "chart",
          chartType: "line",
          labels: ["Q1", "Q2", "Q3"],
          series: [{ name: "X", values: [1, 2] }],
        },
      ]),
    );
    const b = hasil.blocks[0];
    expect(b.type).toBe("chart");
    if (b.type === "chart") {
      expect(b.chartType).toBe("line");
      // Label 3, data 2 → dipotong ke 2 supaya sejajar.
      expect(b.data.labels).toHaveLength(2);
      expect(b.data.datasets[0].data).toHaveLength(2);
    }
  });

  it("mengubah angka berformat Indonesia menjadi number", () => {
    const hasil = parse(
      JSON.stringify([
        {
          type: "chart",
          labels: ["A", "B"],
          series: [{ name: "X", values: ["1.250", "42%"] }],
        },
      ]),
    );
    const b = hasil.blocks[0];
    if (b.type === "chart") {
      expect(b.data.datasets[0].data).toEqual([1.25, 42]);
    }
  });

  it("membuang chart tanpa label atau tanpa series", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "chart", labels: [], series: [] },
        { type: "chart", labels: ["A"], series: [] },
        { type: "chart", labels: [], series: [{ name: "X", values: [1] }] },
      ]),
    );
    expect(hasil.blocks).toHaveLength(0);
    expect(hasil.dibuang).toBe(3);
  });

  it("membuang diagram yang bukan mermaid", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "diagram", source: "just plain text" },
        { type: "diagram", source: "flowchart LR\n A[X] --> B[Y]" },
      ]),
    );
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.dibuang).toBe(1);
  });

  it("membatasi jumlah blok agar tidak membanjir", () => {
    const banyak = Array.from({ length: 200 }, (_, i) => ({
      type: "paragraph",
      text: `Paragraf ${i}`,
    }));
    const hasil = parse(JSON.stringify(banyak));
    expect(hasil.blocks.length).toBeLessThanOrEqual(60);
  });

  it("tahu berbagai nama field dari model yang berbeda", () => {
    const hasil = parse(
      JSON.stringify([
        { type: "heading", text: "Tanpa level" },
        { type: "paragraph", body: "Body bukan text" },
        { type: "list", points: ["Poin"] },
      ]),
    );
    expect(hasil.blocks).toHaveLength(3);
  });

  it("menangani balasan berupa array berisi bukan-objek", () => {
    const hasil = parse(JSON.stringify([null, "string", 42, { type: "paragraph", text: "OK" }]));
    expect(hasil.blocks).toHaveLength(1);
    expect(hasil.dibuang).toBe(3);
  });
});
