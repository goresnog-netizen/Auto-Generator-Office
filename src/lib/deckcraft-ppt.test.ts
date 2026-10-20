/**
 * Uji konverter konten NitZ-909 → perintah DeckCraft.
 *
 * Fokus: memastikan perintah yang dihasilkan benar-benar bisa dijalankan
 * engine DeckCraft — urutan opening presentasi, pemisahan slide, dan
 * pemetaan tipe objek.
 */
import { describe, it, expect } from "vitest";
import {
  blokKePerintah,
  blokKeOutline,
  TEMA_DECKCRAFT,
} from "./deckcraft-ppt";
import type { ContentBlock } from "../types";

const blok = (b: Partial<ContentBlock> & { type: string }): ContentBlock =>
  b as ContentBlock;

const perintah = (daftar: ReturnType<typeof blokKePerintah>) =>
  daftar.filter((p) => p.command === "slide.new");

describe("blokKePerintah", () => {
  it("membuka presentasi kosong lebih dulu (file.new)", () => {
    const hasil = blokKePerintah([blok({ type: "paragraph", text: "Halo" })], {
      judul: "Uji",
      tema: "Slate",
    });
    // `file.new` wajib jadi perintah pertama: `design.theme` dan perintah lain
    // ditolak engine bila belum ada presentasi terbuka.
    expect(hasil[0].command).toBe("file.new");
    expect(hasil[0].params).toMatchObject({ theme: "Slate", blank: true });
  });

  it("tidak menghasilkan slide kosong", () => {
    // Heading tanpa isi lalu heading lain: slide pertama tidak boleh kosong.
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 1, text: "Judul" }),
        blok({ type: "heading", level: 2, text: "Bagian" }),
        blok({ type: "paragraph", text: "Isi bagian" }),
      ],
      { judul: "Uji" },
    );
    // Setiap slide.new harus punya pengisi setelahnya.
    for (let i = 0; i < hasil.length; i++) {
      if (hasil[i].command !== "slide.new") continue;
      const berikutnya = hasil.slice(i + 1).findIndex((p) => p.command === "slide.new");
      const isi = berikutnya === -1 ? hasil.slice(i + 1) : hasil.slice(i + 1, i + 1 + berikutnya);
      expect(isi.length, `slide pada indeks ${i} kosong`).toBeGreaterThan(0);
    }
  });

  it("memisahkan slide pada heading level 1 dan 2", () => {
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 1, text: "A" }),
        blok({ type: "paragraph", text: "Isi A" }),
        blok({ type: "heading", level: 2, text: "B" }),
        blok({ type: "paragraph", text: "Isi B" }),
      ],
      { judul: "Uji" },
    );
    const slides = perintah(hasil);
    expect(slides.length).toBe(2);
    expect(slides[0].params).toMatchObject({ title: "A" });
    expect(slides[1].params).toMatchObject({ title: "B" });
  });

  it("mengubah tabel menjadi insert.table dengan data header + baris", () => {
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 2, text: "Tabel" }),
        blok({
          type: "table",
          headers: ["A", "B"],
          rows: [
            ["1", "2"],
            ["3", "4"],
          ],
        }),
      ],
      { judul: "Uji" },
    );
    const tabel = hasil.find((p) => p.command === "insert.table");
    expect(tabel).toBeDefined();
    expect(tabel!.params).toMatchObject({ rows: 3, cols: 2 });
    expect(tabel!.params!.data).toEqual([
      ["A", "B"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("mengubah grafik bar menjadi tipe column DeckCraft", () => {
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 2, text: "Grafik" }),
        blok({
          type: "chart",
          chartType: "bar",
          data: { labels: ["Q1", "Q2"], datasets: [{ label: "X", data: [1, 2] }] },
        }),
      ],
      { judul: "Uji" },
    );
    const grafik = hasil.find((p) => p.command === "insert.chart");
    expect(grafik).toBeDefined();
    expect(grafik!.params).toMatchObject({
      type: "column",
      categories: ["Q1", "Q2"],
    });
  });

  it("mengubah diagram mermaid menjadi SmartArt proses", () => {
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 2, text: "Alur" }),
        blok({
          type: "diagram",
          diagramType: "mermaid",
          source: "flowchart LR\n A[Riset] --> B[Desain]\n B --> C[Rilis]",
        }),
      ],
      { judul: "Uji" },
    );
    const smart = hasil.find((p) => p.command === "insert.smartArt");
    expect(smart).toBeDefined();
    expect(smart!.params).toMatchObject({ kind: "process" });
    expect((smart!.params!.items as string[])).toEqual(["Riset", "Desain", "Rilis"]);
  });

  it("membuat list bertingkat dengan indentasi tab", () => {
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 2, text: "Poin" }),
        blok({
          type: "list",
          ordered: false,
          items: [
            { text: "Satu" },
            { text: "Dua", children: [{ text: "Dua-A" }] },
          ],
        }),
      ],
      { judul: "Uji" },
    );
    const kotak = hasil.find((p) => p.command === "insert.textBox");
    expect(kotak).toBeDefined();
    // Item top-level tanpa indent; anak diklik satu tab.
    expect(kotak!.params!.text).toBe("Satu\nDua\n\tDua-A");
  });

  it("menerjemahkan gambar data-URL menjadi insert.picture", () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 2, text: "Gambar" }),
        blok({ type: "image", src: png, alt: "Foto uji" }),
      ],
      { judul: "Uji" },
    );
    const gambar = hasil.find((p) => p.command === "insert.picture");
    expect(gambar).toBeDefined();
    expect(gambar!.params!.data).toBe(png.split(",")[1]);
  });

  it("selalu menghasilkan minimal satu slide", () => {
    const hasil = blokKePerintah([], { judul: "Kosong" });
    expect(perintah(hasil).length).toBeGreaterThanOrEqual(1);
  });

  it("menghasilkan perintah yang tidak punya id tak dikenal", () => {
    // Daftar perintah yang dipakai engine DeckCraft (lihat `deckcraft-cli commands`).
    const dikenal = new Set([
      "file.new",
      "file.properties",
      "slide.new",
      "insert.textBox",
      "insert.table",
      "insert.chart",
      "insert.picture",
      "insert.smartArt",
      "shape.insert",
      "format.bullets",
    ]);
    const hasil = blokKePerintah(
      [
        blok({ type: "heading", level: 1, text: "A" }),
        blok({ type: "paragraph", text: "Isi" }),
        blok({ type: "heading", level: 2, text: "B" }),
        blok({ type: "list", ordered: false, items: [{ text: "•" }] }),
        blok({ type: "table", headers: ["A"], rows: [["1"]] }),
        blok({
          type: "chart",
          chartType: "pie",
          data: { labels: ["x"], datasets: [{ label: "s", data: [1] }] },
        }),
        blok({ type: "divider" }),
        blok({ type: "code", language: "ts", code: "const a = 1;" }),
      ],
      { judul: "Uji" },
    );
    for (const p of hasil) {
      expect(dikenal.has(p.command), `perintah tak dikenal: ${p.command}`).toBe(true);
    }
  });
});

describe("blokKeOutline", () => {
  it("menghasilkan markdown dengan heading dan bullet", () => {
    const md = blokKeOutline([
      blok({ type: "heading", level: 1, text: "Judul" }),
      blok({ type: "heading", level: 2, text: "Bagian" }),
      blok({ type: "list", ordered: false, items: [{ text: "Poin" }] }),
    ]);
    expect(md).toContain("# Judul");
    expect(md).toContain("## Bagian");
    expect(md).toContain("- Poin");
  });
});

describe("TEMA_DECKCRAFT", () => {
  it("memuat tema yang memang ada di DeckCraft v0.8.0", () => {
    // Diverifikasi terhadap `deckcraft-cli run --cmd design.themes`.
    expect(TEMA_DECKCRAFT).toContain("Slate");
    expect(TEMA_DECKCRAFT).toContain("Nocturne");
    expect(TEMA_DECKCRAFT).toContain("Harbor");
  });
});
