/**
 * XLSX Document Generator
 * Uses exceljs for Excel document generation
 *
 * Catatan API exceljs v4:
 *  - Properti dokumen (`title`, `creator`) ada di `workbook`, bukan di
 *    `workbook.properties` (yang di tipe hanya berisi `date1904`).
 *  - Nilai sel harus berupa primitive / `richText` / `hyperlink` / `formula`.
 *    Objek `{ text, font }` TIDAK dikenali exceljs dan akan ditulis sebagai
 *    JSON mentah, jadi gaya sel diterapkan terpisah lewat `cell.font`,
 *    `cell.fill`, dan `cell.alignment`.
 *  - Warna memakai `argb` (ARGB 8 digit), bukan `rgb`.
 */

import type {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  XLSXGeneratorOptions,
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

import ExcelJS from "exceljs";

/** Warna aksen NitZ-909 (ARGB). */
const WARNA_AKSEN = "FF5E774E";
const WARNA_HEADER = "FF1A1A1D";
const WARNA_BARIS_ALTERNATIF = "FFF3F6F1";

/** Gaya sel yang bisa diterapkan. */
interface GayaSel {
  bold?: boolean;
  size?: number;
  warna?: string;
  isian?: string;
  rata?: "left" | "center" | "right";
}

/** Satu sel spreadsheet: nilai primitif + gaya opsional. */
interface Sel {
  nilai: string | number | boolean | null;
  gaya?: GayaSel;
}

/** Spesifikasi satu lembar kerja sebelum ditulis ke workbook. */
interface Lembar {
  name: string;
  tabColor?: string;
  rows: Sel[][];
}

export class XLSXGenerator implements DocumentGenerator {
  private options: XLSXGeneratorOptions;

  constructor(options: XLSXGeneratorOptions = { outputPath: '', sheets: [] }) {
    this.options = { ...options };
  }

  validate(config: DocumentConfig, content: DocumentContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.title) {
      errors.push("Spreadsheet title is required");
    }

    if (!content.blocks || content.blocks.length === 0) {
      warnings.push("Spreadsheet has no content blocks");
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
      const workbook = new ExcelJS.Workbook();

      // Properti dokumen pada exceljs v4 ada di workbook, bukan di
      // `.properties` (yang di tipe hanya berisi date1904 & friends).
      workbook.title = config.title || "NitZ-909 Spreadsheet";
      workbook.creator = "NitZ-909";

      const lembar: Lembar[] = [];

      // Lembar yang diminta lewat opsi (SheetConfig) didahulukan.
      for (const cfg of this.options.sheets ?? []) {
        lembar.push(this.sheetFromConfig(cfg));
      }

      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (rendered) lembar.push(rendered);
      }

      // If no sheets generated, create a default data sheet
      if (lembar.length === 0) {
        lembar.push(this.createDefaultSheet(config));
      }

      for (const spec of lembar) {
        this.tulisLembar(workbook, spec);
      }

      // Apply styles if provided
      if (this.options.theme) {
        this.applyThemeColors(workbook, this.options.theme);
      }

      // exceljs v4 `writeBuffer()` mengembalikan ArrayBuffer; Buffer.from
      // membuatnya kompatibel dengan tipe GeneratorResult.
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      if (this.options.outputPath) {
        const fs = await import("fs");
        await fs.promises.writeFile(this.options.outputPath, buffer);
        return { success: true, outputPath: this.options.outputPath };
      }

      return { success: true, buffer };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error generating XLSX document",
      };
    }
  }

  /** Tulis satu lembar ke workbook: nilai sel lalu gaya sel. */
  private tulisLembar(workbook: ExcelJS.Workbook, spec: Lembar): void {
    const worksheet = workbook.addWorksheet(spec.name);
    if (spec.tabColor) {
      worksheet.properties.tabColor = { argb: spec.tabColor };
    }

    for (const row of spec.rows) {
      const excelRow = worksheet.addRow(row.map((sel) => sel.nilai));
      row.forEach((sel, index) => {
        if (!sel.gaya) return;
        const cell = excelRow.getCell(index + 1);
        if (sel.gaya.bold !== undefined || sel.gaya.size !== undefined || sel.gaya.warna) {
          cell.font = {
            ...(sel.gaya.bold !== undefined ? { bold: sel.gaya.bold } : {}),
            ...(sel.gaya.size !== undefined ? { size: sel.gaya.size } : {}),
            ...(sel.gaya.warna ? { color: { argb: sel.gaya.warna } } : {}),
          };
        }
        if (sel.gaya.isian) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: sel.gaya.isian },
          };
        }
        if (sel.gaya.rata) {
          cell.alignment = { horizontal: sel.gaya.rata };
        }
      });
    }
  }

  private renderBlock(block: ContentBlock): Lembar | null {
    switch (block.type) {
      case "heading":
        return this.renderHeadingBlock(block as HeadingBlock);
      case "paragraph":
        return this.renderParagraphBlock(block as ParagraphBlock);
      case "list":
        return this.renderListBlock(block as ListBlock);
      case "table":
        return this.renderTableBlock(block as TableBlock);
      case "code":
        return this.renderCodeBlock(block as CodeBlock);
      case "image":
        return this.renderImageBlock(block as ImageBlock);
      case "chart":
        return this.renderChartBlock(block as ChartBlock);
      case "diagram":
        return this.renderDiagramBlock(block as DiagramBlock);
      case "divider":
        return this.renderDividerBlock(block as DividerBlock);
      default:
        return null;
    }
  }

  private renderHeadingBlock(block: HeadingBlock): Lembar {
    const level = block.level || 1;
    const text = block.text || "Heading";

    return {
      name: `Heading ${level}`,
      tabColor: WARNA_AKSEN,
      rows: [
        [
          {
            nilai: text,
            gaya: { bold: true, size: Math.max(11, 14 - level * 2), warna: "FFFFFFFF" },
          },
        ],
      ],
    };
  }

  private renderParagraphBlock(block: ParagraphBlock): Lembar {
    const text = block.text || "";

    return {
      name: "Data",
      rows: [[{ nilai: text }]],
    };
  }

  private renderListBlock(block: ListBlock): Lembar {
    const items: string[] = [];

    block.items.forEach((item) => {
      const text = item.text || "";
      const bullet = block.ordered ? `${items.length + 1}. ` : "• ";
      items.push(bullet + text);
    });

    return {
      name: "List",
      rows: items.map((text) => [{ nilai: text }]),
    };
  }

  private renderTableBlock(block: TableBlock): Lembar {
    if (!block.headers || block.headers.length === 0) {
      return { name: "Table", rows: [] };
    }

    const rows: Sel[][] = [];

    // Header row
    rows.push(
      block.headers.map((h) => ({
        nilai: h,
        gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER, rata: "center" as const },
      })),
    );

    // Data rows
    block.rows.forEach((row, rowIndex) => {
      rows.push(
        row.map((cell) => ({
          nilai: cell || "",
          gaya:
            rowIndex % 2 === 0
              ? { isian: WARNA_BARIS_ALTERNATIF }
              : undefined,
        })),
      );
    });

    return {
      name: "Table",
      tabColor: WARNA_AKSEN,
      rows,
    };
  }

  private renderCodeBlock(block: CodeBlock): Lembar {
    const lines = block.code?.split("\n") || ["// No code"];

    return {
      name: "Code",
      rows: lines.map((line) => [
        { nilai: line, gaya: { isian: "FFF2F4F1" } },
      ]),
    };
  }

  private renderImageBlock(block: ImageBlock): Lembar {
    return {
      name: "Image",
      rows: [[{ nilai: `[Image: ${block.alt || "Image"}]` }]],
    };
  }

  private renderChartBlock(block: ChartBlock): Lembar {
    const chartType = block.chartType || "chart";

    return {
      name: "Chart",
      rows: [[{ nilai: `[${chartType} chart]` }]],
    };
  }

  private renderDiagramBlock(block: DiagramBlock): Lembar {
    const diagramType = block.diagramType || "diagram";

    return {
      name: "Diagram",
      rows: [[{ nilai: `[${diagramType} diagram]` }]],
    };
  }

  private renderDividerBlock(block: DividerBlock): Lembar {
    void block;
    return {
      name: "Divider",
      rows: [[{ nilai: "────────────────────────────────" }]],
    };
  }

  /** Bangun lembar dari `SheetConfig` yang diberikan lewat opsi generator. */
  private sheetFromConfig(cfg: {
    name: string;
    data: unknown[][];
    headers?: string[];
  }): Lembar {
    const rows: Sel[][] = [];

    if (cfg.headers?.length) {
      rows.push(
        cfg.headers.map((h) => ({
          nilai: h,
          gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER },
        })),
      );
    }

    for (const row of cfg.data ?? []) {
      rows.push(
        (row as unknown[]).map((value) => ({
          nilai: value === null || value === undefined ? "" : (value as string | number | boolean),
        })),
      );
    }

    return { name: cfg.name, tabColor: WARNA_AKSEN, rows };
  }

  private createDefaultSheet(config: DocumentConfig): Lembar {
    return {
      name: config.title || "Sheet1",
      tabColor: WARNA_AKSEN,
      rows: [
        [
          {
            nilai: "NitZ-909 Data",
            gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER },
          },
        ],
      ],
    };
  }

  private applyThemeColors(workbook: ExcelJS.Workbook, theme: unknown): void {
    // `workbook.properties` pada exceljs v4 hanya berisi `date1904`; tema
    // dokumen lebih tepat dicatat lewat `workbook.theme`.
    const tema = theme as { primaryColor?: string } | undefined;
    if (tema?.primaryColor) {
      (workbook as unknown as { theme?: unknown }).theme = { primaryColor: tema.primaryColor };
    }
  }
}

export default XLSXGenerator;