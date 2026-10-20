/**
 * PPTX Document Generator — benar-benar menulis berkas .pptx.
 *
 * Berbeda dengan `src/lib/exporter.ts` (jalur browser), modul ini berjalan
 * di Node: dipakai oleh skrip build/CLI, bukan oleh UI browser.
 *
 * Catatan penting soal pptxgenjs: tipe grafik dicocokkan secara
 * CASE-SENSITIVE. `addChart("BAR", …)` menghasilkan bingkai grafik KOSONG
 * (tanpa `<c:ser>`) dan TIDAK melempar error — bug seperti ini pernah ada di
 * `exporter.ts` dan sudah diperbaiki di sana. Di sini tipenya selalu
 * huruf kecil.
 *
 * Modul ini berada di bawah karantina `tsconfig.json` (Node-only) supaya
 * tidak ikut terbawa ke bundel browser. Typecheck terpisah ada di
 * `tsconfig.node.json`.
 */

import path from "node:path";
import PptxGenJS from "pptxgenjs";

import type { DocumentGenerator, ValidationResult } from "../index";
import type {
  ChartBlock,
  ContentBlock,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ImageBlock,
  ListBlock,
  PPTXGeneratorOptions,
  TableBlock,
} from "../types/index.ts";

/** Palet yang selaras dengan `src/lib/exporter.ts` supaya kedua jalur serasi. */
const WARNA = {
  aksen: "82966F",
  aksenGelap: "5E774E",
  teks: "1C1D1C",
  teksMuted: "6B7280",
  latar: "FFFFFF",
  garis: "D9E2D2",
  penutup: "F4F1E6",
} as const;

/** Peta tipe grafik NitZ-909 → tipe pptxgenjs (harus huruf kecil). */
const TIPE_GRAFIK: Record<string, string> = {
  bar: "bar",
  line: "line",
  pie: "pie",
  area: "area",
  scatter: "scatter",
};

/** Maksimum bullet per slide; sisanya dilaporkan, bukan dibuang diam-diam. */
const MAKS_BULLET = 6;

export class PPTXGenerator implements DocumentGenerator {
  private options: PPTXGeneratorOptions;

  constructor(optionsParam: PPTXGeneratorOptions = { outputPath: "" }) {
    this.options = {
      // `outputPath` wajib ada di tipenya; default-nya string kosong berarti
      // "tentukan dari judul dokumen".
      outputPath: optionsParam.outputPath ?? "",
      template: optionsParam.template ?? "",
      slideSize: optionsParam.slideSize ?? "widescreen",
    };
  }

  validate(config: DocumentConfig, content: DocumentContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.title) {
      errors.push("Presentation title is required");
    }
    if (!content.blocks || content.blocks.length === 0) {
      warnings.push("Presentation has no content blocks");
    }
    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Tulis berkas .pptx yang benar-benar ada di disk.
   *
   * `options.outputPath` menentukan tujuan; kalau kosong, nama file diturunkan
   * dari judul dokumen.
   */
  async generate(
    config: DocumentConfig,
    content: DocumentContent,
  ): Promise<GeneratorResult> {
    const validasi = this.validate(config, content);
    if (!validasi.valid) {
      return { success: false, error: validasi.errors.join("; ") };
    }

    try {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE";
      pptx.author = "NitZ-909";
      pptx.title = config.title;
      pptx.company = "NitZ-909";
      // `DocumentMetadata` tidak punya field `subject`; metadata yang tersedia
      // hanya author/createdAt/updatedAt/version/tags/description.
      if (config.metadata?.description) {
        pptx.subject = config.metadata.description;
      }

      const dipakai = this.susunDeck(pptx, config, content.blocks);

      // Nama berkas: judul dibersihkan dari karakter terlarang Windows.
      const nama = this.namaBerkas(config.title);
      const outputPath = this.options.outputPath
        ? path.resolve(this.options.outputPath)
        : path.resolve(process.cwd(), nama);

      await pptx.writeFile({ fileName: outputPath });

      // Pastikan benar-benar ada — jangan percaya promise tanpa cek.
      const stat = await import("node:fs/promises").then((fs) =>
        fs.stat(outputPath),
      );

      return {
        success: true,
        outputPath,
        buffer: undefined,
        metadata: {
          slideCount: dipakai.slideCount,
          blocks: content.blocks.length,
          bulletTerdrop: dipakai.bulletTerdrop,
          tabel: dipakai.tabel,
          grafik: dipakai.grafik,
          gambar: dipakai.gambar,
          diagram: dipakai.diagram,
          bytes: stat.size,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? `Gagal menulis PPTX: ${error.message}`
            : "Unknown error generating PPTX document",
      };
    }
  }

  /** Nama berkas aman dari karakter terlarang Windows. */
  private namaBerkas(judul: string): string {
    const bersih = judul
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/, "")
      .slice(0, 100)
      .trim();
    return `${bersih || "Presentasi"}.pptx`;
  }

  /**
   * Susun deck: sampul → satu slide per heading (level 1–2) → penutup.
   * Mengembalikan statistik yang bisa dilaporkan.
   */
  private susunDeck(
    pptx: PptxGenJS,
    config: DocumentConfig,
    blocks: ContentBlock[],
  ): {
    slideCount: number;
    bulletTerdrop: number;
    tabel: number;
    grafik: number;
    gambar: number;
    diagram: number;
  } {
    const stat = {
      slideCount: 0,
      bulletTerdrop: 0,
      tabel: 0,
      grafik: 0,
      gambar: 0,
      diagram: 0,
    };

    // Sub-judul untuk sampul: paragraf pertama.
    const subJudul = blocks.find((b) => b.type === "paragraph");
    const sampul = pptx.addSlide();
    sampul.background = { color: WARNA.latar };
    sampul.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.28,
      fill: { color: WARNA.aksen },
    });
    sampul.addText(config.title, {
      x: 0.7,
      y: 1.6,
      w: 11.9,
      h: 1.4,
      fontSize: 40,
      bold: true,
      color: WARNA.teks,
      align: "left",
    });
    sampul.addShape("line", {
      x: 0.7,
      y: 3.15,
      w: 2.4,
      h: 0,
      line: { color: WARNA.aksen, width: 4 },
    });
    if (subJudul && subJudul.type === "paragraph") {
      sampul.addText(subJudul.text, {
        x: 0.7,
        y: 3.35,
        w: 11.5,
        h: 0.8,
        fontSize: 14,
        color: WARNA.teksMuted,
      });
    }
    stat.slideCount++;

    // Slide isi: satu per heading level 1–2.
    let slide = pptx.addSlide();
    let adaIsi = false;
    let judulSlide = config.title;

    const JudulDanIsi = (judul: string) => {
      slide.addText(judul, {
        x: 0.6,
        y: 0.35,
        w: 12.13,
        h: 0.8,
        fontSize: 28,
        bold: true,
        color: WARNA.teks,
      });
      slide.addShape("line", {
        x: 0.6,
        y: 1.15,
        w: 1.4,
        h: 0,
        line: { color: WARNA.aksen, width: 3 },
      });
    };


    // Kumpulkan bullet per slide, lalu gambar saat slide selesai.
    let bulletTertunda: string[] = [];

    const gambarBullet = () => {
      if (bulletTertunda.length === 0) return;
      const diambil = bulletTertunda.slice(0, MAKS_BULLET);
      stat.bulletTerdrop += Math.max(0, bulletTertunda.length - MAKS_BULLET);
      slide.addText(
        diambil.map((t) => ({
          text: t,
          options: {
            fontSize: 14,
            bullet: { code: "2022" },
            color: WARNA.teks,
            breakLine: true,
          },
        })),
        { x: 0.6, y: 1.5, w: 12.13, h: 4.6 },
      );
      bulletTertunda = [];
    };

    JudulDanIsi(judulSlide);
    adaIsi = true;

    for (const blok of blocks) {
      switch (blok.type) {
        case "heading": {
          if (blok.level <= 2) {
            // Heading baru → slide baru.
            if (adaIsi) {
              gambarBullet();
              stat.slideCount++;
            }
            slide = pptx.addSlide();
            slide.background = { color: WARNA.latar };
            slide.addShape("rect", {
              x: 0,
              y: 0,
              w: "100%",
              h: 0.12,
              fill: { color: WARNA.aksen },
            });
            JudulDanIsi(blok.text);
            judulSlide = blok.text;
            adaIsi = true;
            break;
          }
          // Heading level 3+ → bullet.
          bulletTertunda.push(blok.text);
          break;
        }

        case "paragraph": {
          bulletTertunda.push(blok.text);
          break;
        }

        case "list": {
          for (const item of this.ravelList((blok as ListBlock).items)) {
            bulletTertunda.push(item);
          }
          break;
        }

        case "code": {
          bulletTertunda.push(blok.code);
          break;
        }

        case "divider": {
          bulletTertunda.push("────────");
          break;
        }

        case "table": {
          const t = blok as TableBlock;
          gambarBullet();
          slide.addTable(
            [t.headers, ...t.rows].map((baris, i) =>
              baris.map((sel) => ({
                text: sel,
                options: {
                  fontSize: i === 0 ? 12 : 11,
                  bold: i === 0,
                  color: i === 0 ? WARNA.penutup : WARNA.teks,
                  fill: { color: i === 0 ? WARNA.aksen : WARNA.latar },
                },
              })),
            ),
            {
              x: 0.6,
              y: 1.5,
              w: 12.13,
              border: { pt: 0.5, color: WARNA.garis },
            },
          );
          stat.tabel++;
          break;
        }

        case "chart": {
          const c = blok as ChartBlock;
          gambarBullet();
          const tipe = TIPE_GRAFIK[c.chartType] ?? "bar";
          try {
            slide.addChart(
              tipe as "bar" | "line" | "pie" | "area" | "scatter",
              c.data.datasets.map((d) => ({
                name: d.label,
                labels: c.data.labels,
                values: d.data,
              })),
              {
                x: 0.6,
                y: 1.5,
                w: 12.13,
                h: 4.4,
                chartColors: [WARNA.aksen, WARNA.aksenGelap, "C9A227"],
                showLegend: true,
                legendPos: "b",
              },
            );
            stat.grafik++;
          } catch {
            // Tipe grafik tak didukung pptxgenjs → teks biasa.
            slide.addText(
              `[Grafik ${c.chartType}: ${c.data.labels.join(", ")}]`,
              { x: 0.6, y: 1.5, w: 12.13, h: 1, color: WARNA.teksMuted },
            );
          }
          break;
        }

        case "image": {
          const g = blok as ImageBlock;
          gambarBullet();
          const data = this.dataUrlGambar(g.src);
          if (data) {
            slide.addImage({
              data,
              x: 0.6,
              y: 1.35,
              w: 12.13,
              h: 4.5,
              sizing: { type: "contain", w: 12.13, h: 4.5 },
            });
            stat.gambar++;
            if (g.caption || g.alt) {
              slide.addText(g.caption || g.alt, {
                x: 0.6,
                y: 5.95,
                w: 12.13,
                h: 0.5,
                fontSize: 10,
                italic: true,
                color: WARNA.teksMuted,
                align: "center",
              });
            }
          } else {
            // URL remote tidak bisa di-embed tanpa unduhan; tampilkan keterangan.
            slide.addText(g.caption || g.alt || "Gambar", {
              x: 0.6,
              y: 1.5,
              w: 12.13,
              h: 1,
              color: WARNA.teksMuted,
            });
          }
          break;
        }

        case "diagram": {
          gambarBullet();
          // Mermaid tidak bisa dirender pptxgenjs; tampilkan sumbernya.
          slide.addText(blok.source, {
            x: 0.6,
            y: 1.5,
            w: 12.13,
            h: 4.4,
            fontSize: 11,
            color: WARNA.teks,
          });
          stat.diagram++;
          break;
        }

        default:
          break;
      }
    }

    gambarBullet();
    if (adaIsi) stat.slideCount++;

    // Slide penutup.
    const tutup = pptx.addSlide();
    tutup.background = { color: WARNA.latar };
    tutup.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: 0.28,
      fill: { color: WARNA.aksen },
    });
    tutup.addText("Terima kasih", {
      x: 0.7,
      y: 2.2,
      w: 12.13,
      h: 1,
      fontSize: 40,
      bold: true,
      color: WARNA.teks,
    });
    tutup.addShape("line", {
      x: 0.7,
      y: 3.35,
      w: 2.4,
      h: 0,
      line: { color: WARNA.aksen, width: 4 },
    });
    tutup.addText("NitZ-909 · DATA UJI (sintetis)", {
      x: 0.7,
      y: 6.85,
      w: 12.33,
      h: 0.4,
      fontSize: 9,
      color: WARNA.teksMuted,
    });
    stat.slideCount++;

    return stat;
  }

  /** Ratakan list (nested) menjadi baris bertingkat. */
  private ravelList(
    items: { text: string; children?: { text: string }[] }[],
    level = 0,
    keluar: string[] = [],
  ): string[] {
    for (const item of items) {
      keluar.push(`${"  ".repeat(level)}${item.text}`);
      if (item.children?.length) {
        this.ravelList(item.children, level + 1, keluar);
      }
    }
    return keluar;
  }

  /**
   * Ubah sumber gambar jadi data-URL base64 yang bisa di-embed.
   * Hanya `data:image/*` yang bisa langsung dipakai; URL http perlu unduhan
   * (tidak dilakukan di sini — pemanggil harus mengunduh lebih dulu).
   */
  private dataUrlGambar(src: string): string | null {
    const s = (src || "").trim();
    if (!/^data:image\//i.test(s)) return null;
    return s;
  }
}

export default PPTXGenerator;
