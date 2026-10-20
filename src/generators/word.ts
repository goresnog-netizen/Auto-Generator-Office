/**
 * Word Document Generator
 * Uses docx library for Word document generation
 *
 * Catatan API: `docx` v9 memakai kelas-kelas baru —
 * `TableRow`/`TableCell` (bukan `Row`/`Cell`), `HeadingLevel` (bukan
 * `Heading`), `AlignmentType` (bukan `Alignment`), dan `TextRun`/`Paragraph`
 * menerima objek opsi (bukan properti yang bisa di-set setelah pembuatan).
 */

import {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  WordGeneratorOptions,
  ContentBlock,
  HeadingBlock,
  ParagraphBlock,
  ListBlock,
  TableBlock,
  CodeBlock,
  ImageBlock,
  ChartBlock,
  DiagramBlock,
  DividerBlock,
} from "../types/index.ts";

import {
  Packer,
  Paragraph,
  TextRun,
  Document,
  Table as DOCXTable,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  ShadingType,
  HeadingLevel,
  LevelFormat,
  convertMillimetersToTwip,
  type FileChild,
  type IRunOptions,
} from "docx";

/** Level heading (1–6) ke enum HeadingLevel docx. */
const LEVEL_HEADING = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const;

/** Reference numbering yang didaftarkan di `Document({ numbering })`. */
const REFERENCE_BERURUTAN = "list-berurutan";
const REFERENCE_TANPA_URUTAN = "list-tanpa-urutan";

/** Peta alignment NitZ-909 → docx. */
const PETA_ALIGNMENT: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

export class WordGenerator implements DocumentGenerator {
  private options: WordGeneratorOptions;

  constructor(options: WordGeneratorOptions = { outputPath: "" }) {
    this.options = {
      template: options.template ?? "",
      ...options,
    };
  }

  validate(config: DocumentConfig, content: DocumentContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.title) {
      errors.push("Document title is required");
    }

    if (!content.blocks || content.blocks.length === 0) {
      warnings.push("Document has no content blocks");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async generate(
    config: DocumentConfig,
    content: DocumentContent,
  ): Promise<GeneratorResult> {
    try {
      const body: FileChild[] = [];

      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (Array.isArray(rendered)) {
          body.push(...rendered);
        } else if (rendered) {
          body.push(rendered);
        }
      }

      // Halaman judul bila ada metadata author.
      if (config.metadata?.author) {
        const titlePage = this.createTitlePage(config);
        if (titlePage) body.unshift(titlePage);
      }

      const doc = new Document({
        title: config.title,
        creator: config.metadata?.author,
        description: config.metadata?.description,
        // Reference numbering WAJIB didaftarkan di sini; kalau tidak,
        // docx menulis numId literal ("{list-tanpa-urutan-0}") dan dokumen
        // tidak bisa dibuka Word.
        numbering: {
          config: [
            {
              reference: REFERENCE_BERURUTAN,
              levels: [
                {
                  level: 0,
                  format: LevelFormat.DECIMAL,
                  text: "%1.",
                  alignment: AlignmentType.START,
                },
                {
                  level: 1,
                  format: LevelFormat.LOWER_LETTER,
                  text: "%2)",
                  alignment: AlignmentType.START,
                },
              ],
            },
            {
              reference: "tidak-terdaftar",
              levels: [
                {
                  level: 0,
                  format: LevelFormat.BULLET,
                  text: "•",
                  alignment: AlignmentType.START,
                },
                {
                  level: 1,
                  format: LevelFormat.BULLET,
                  text: "◦",
                  alignment: AlignmentType.START,
                },
              ],
            },
          ],
        },
        sections: [
          {
            properties: {},
            children: body,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      if (this.options.outputPath) {
        const fs = await import("fs");
        const outputPath = this.options.outputPath;
        await fs.promises.writeFile(outputPath, buffer);
        return { success: true, outputPath, buffer };
      }

      return { success: true, buffer };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error generating Word document",
      };
    }
  }

  private renderBlock(block: ContentBlock): FileChild | FileChild[] | null {
    switch (block.type) {
      case "heading":
        return this.renderHeading(block as HeadingBlock);
      case "paragraph":
        return this.renderParagraph(block as ParagraphBlock);
      case "list":
        return this.renderList(block as ListBlock);
      case "table":
        return this.renderTable(block as TableBlock);
      case "code":
        return this.renderCode(block as CodeBlock);
      case "image":
        return this.renderImage(block as ImageBlock);
      case "chart":
        return this.renderChartPlaceholder(block as ChartBlock);
      case "diagram":
        return this.renderDiagramPlaceholder(block as DiagramBlock);
      case "divider":
        return this.renderDivider(block as DividerBlock);
      default:
        return null;
    }
  }

  /** Opsi run teks dari `TextFormatting` (bila ada). */
  private opsiRun(formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
  }): IRunOptions {
    // Properti IRunOptions bersifat read-only, jadi bangun objek baru.
    return {
      ...(formatting?.bold ? { bold: true } : {}),
      ...(formatting?.italic ? { italics: true } : {}),
      ...(formatting?.underline ? { underline: {} } : {}),
      ...(formatting?.strikethrough ? { strike: true } : {}),
      ...(formatting?.code ? { font: "Courier New", size: 20 } : {}),
    };
  }

  private renderHeading(block: HeadingBlock): FileChild {
    const level = Math.min(Math.max(block.level, 1), 6);
    return new Paragraph({
      text: block.text,
      heading: LEVEL_HEADING[level - 1],
      spacing: { before: 240, after: 120 },
    });
  }

  private renderParagraph(block: ParagraphBlock): FileChild {
    return new Paragraph({
      children: [new TextRun({ text: block.text || "", ...this.opsiRun(block.formatting) })],
      alignment: PETA_ALIGNMENT[block.formatting?.link ? "left" : "left"],
    });
  }

  private renderList(block: ListBlock): FileChild[] {
    const keluar: FileChild[] = [];
    const tulis = (items: ListBlock["items"], level: number) => {
      for (const item of items) {
        keluar.push(
          new Paragraph({
            children: [new TextRun({ text: item.text })],
            // Hanya `numbering` — memakai `bullet` bersamaan akan menulis
            // <w:numPr> dua kali dan merusak dokumen.
            numbering: {
              reference: block.ordered
                ? REFERENCE_BERURUTAN
                : REFERENCE_TANPA_URUTAN,
              level,
            },
          }),
        );
        if (item.children?.length) tulis(item.children, level + 1);
      }
    };
    tulis(block.items, 0);
    return keluar;
  }

  private renderTable(block: TableBlock): FileChild[] {
    const lebar = convertMillimetersToTwip(170);
    const baris = new TableRow({
      children: block.headers.map(
        (h) =>
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: h, bold: true, color: "FFFFFF" })],
              }),
            ],
            width: { size: lebar / block.headers.length, type: WidthType.DXA },
            shading: { fill: "5E774E", type: ShadingType.CLEAR },
          }),
      ),
    });
    const isi = block.rows.map(
      (r, i) =>
        new TableRow({
          children: r.map(
            (sel) =>
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: sel })] })],
                width: { size: lebar / block.headers.length, type: WidthType.DXA },
                shading:
                  i % 2 === 0
                    ? { fill: "F3F6F1", type: ShadingType.CLEAR }
                    : undefined,
              }),
          ),
        }),
    );
    return [
      new DOCXTable({
        rows: [baris, ...isi],
        width: { size: lebar, type: WidthType.DXA },
      }) as unknown as FileChild,
      new Paragraph({ text: "" }),
    ];
  }

  private renderCode(block: CodeBlock): FileChild {
    return new Paragraph({
      children: [
        new TextRun({
          text: block.code,
          font: "Courier New",
          size: 18,
        }),
      ],
      shading: { fill: "F2F4F1", type: ShadingType.CLEAR },
    });
  }

  private renderImage(block: ImageBlock): FileChild {
    // Gambar butuh unduhan & embedding; tampilkan keterangan + sumber.
    return new Paragraph({
      children: [
        new TextRun({
          text: `[Gambar: ${block.alt || block.caption || "tanpa keterangan"}]`,
          italics: true,
          color: "6B7280",
        }),
      ],
    });
  }

  private renderChartPlaceholder(block: ChartBlock): FileChild {
    const seri = block.data.datasets
      .map((d) => `${d.label}: ${d.data.join(", ")}`)
      .join(" | ");
    return new Paragraph({
      children: [
        new TextRun({
          text: `[Grafik ${block.chartType} — ${block.data.labels.join(", ")}] ${seri}`,
          italics: true,
          color: "6B7280",
        }),
      ],
    });
  }

  private renderDiagramPlaceholder(block: DiagramBlock): FileChild {
    return new Paragraph({
      children: [
        new TextRun({
          text: `[Diagram ${block.diagramType}]\n${block.source}`,
          font: "Courier New",
          size: 18,
        }),
      ],
    });
  }

  private renderDivider(block: DividerBlock): FileChild {
    void block;
    return new Paragraph({
      children: [new TextRun({ text: "─".repeat(50), color: "D9E2D2" })],
    });
  }

  private createTitlePage(config: DocumentConfig): FileChild | null {
    if (!config.title) return null;
    return new Paragraph({
      children: [new TextRun({ text: config.title, bold: true, size: 48 })],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      pageBreakBefore: false,
    });
  }
}

export default WordGenerator;
