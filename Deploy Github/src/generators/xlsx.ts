/**
 * XLSX Document Generator
 * Uses exceljs for Excel document generation
 */

import {
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
  TextFormatting,
  SheetConfig,
  SheetStyles,
  CellStyle,
  BorderStyle,
  BorderEdge,
  TableConfig,
  TableStyle,
  ChartConfig,
} from "../types";

import ExcelJS from "exceljs";

export class XLSXGenerator implements DocumentGenerator {
  private options: XLSXGeneratorOptions;

  constructor(private optionsParam: XLSXGeneratorOptions = {}) {
    this.options = {
      outputPath: "",
      format: "sheet" as const,
      template: {},
      theme: {},
      ...optionsParam,
    };
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

      // Set default theme colors
      workbook.properties.title = config.title || "NitZ-909 Spreadsheet";
      workbook.properties.creator = "NitZ-909";

      const sheets: any[] = [];

      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (rendered && rendered.sheet) {
          sheets.push(rendered.sheet);
        }
      }

      // If no sheets generated, create a default data sheet
      if (sheets.length === 0) {
        sheets.push(this.createDefaultSheet(config));
      }

      for (const sheet of sheets) {
        workbook.addWorksheet(sheet.name, sheet.properties);
        sheet.rows.forEach((row) => {
          worksheet.addRow(row);
        });
      }

      // Apply styles if provided
      if (this.options.theme) {
        this.applyThemeColors(workbook, this.options.theme);
      }

      const buffer = await workbook.xlsx.writeBuffer();

      if (this.options.format === "buffer") {
        return { success: true, buffer };
      }

      if (this.options.outputPath) {
        const fs = await import("fs");
        await fs.promises.writeFile(this.options.outputPath, buffer);
        return { success: true, outputPath: this.options.outputPath };
      }

      return { success: true, outputPath: config.title + ".xlsx" };
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

  private renderBlock(block: ContentBlock): any {
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

  private renderHeadingBlock(block: HeadingBlock): any {
    const level = block.level || 1;
    const text = block.text || "Heading";

    return {
      name: `Section ${level}`,
      properties: { tabColor: { rgb: "1A1A1D" } },
      name: `Heading ${level}`,
      rows: [[{ text, font: { bold: level <= 2, size: 14 - level * 2 } }]],
    };
  }

  private renderParagraphBlock(block: ParagraphBlock): any {
    const text = block.text || "";

    return {
      name: "Data",
      rows: [[{ text }]],
    };
  }

  private renderListBlock(block: ListBlock): any {
    const items: string[] = [];

    block.items.forEach((item) => {
      const text = item.text || "";
      const bullet = block.ordered ? `${items.length + 1}. ` : "• ";
      items.push(bullet + text);
    });

    return {
      name: "List",
      rows: items.map((text) => [{ text }]),
    };
  }

  private renderTableBlock(block: TableBlock): any {
    if (!block.headers || block.headers.length === 0)
      return { name: "Table", rows: [] };

    const columns = block.headers.length;
    const data: any[] = [];

    // Header row
    data.push([
      ...block.headers.map((h) => ({
        text: h,
        font: { bold: true, color: { rgb: "FFFFFF" } },
      })),
    ]);

    // Data rows
    block.rows.forEach((row) => {
      data.push(row.map((cell) => ({ text: cell || "" })));
    });

    return {
      name: "Table",
      properties: { tabColor: { rgb: "1A1A1D" } },
      rows: data,
    };
  }

  private renderCodeBlock(block: CodeBlock): any {
    const lines = block.code?.split("\n") || ["// No code"];

    return {
      name: "Code",
      rows: lines.map((line) => [{ text: line }]),
    };
  }

  private renderImageBlock(block: ImageBlock): any {
    return {
      name: "Image",
      rows: [[{ text: `[Image: ${block.alt || "Image"}]` }]],
    };
  }

  private renderChartBlock(block: ChartBlock): any {
    const chartType = block.chartType || "chart";

    return {
      name: "Chart",
      rows: [[{ text: `[${chartType} chart]` }]],
    };
  }

  private renderDiagramBlock(block: DiagramBlock): any {
    const diagramType = block.diagramType || "diagram";

    return {
      name: "Diagram",
      rows: [[{ text: `[${diagramType} diagram]` }]],
    };
  }

  private renderDividerBlock(block: DividerBlock): any {
    return {
      name: "Divider",
      rows: [[{ text: "────────────────────────────────" }]],
    };
  }

  private createDefaultSheet(config: DocumentConfig): any {
    return {
      name: config.title || "Sheet1",
      properties: { tabColor: { rgb: "1A1A1D" } },
      rows: [
        [
          {
            text: "NitZ-909 Data",
            font: { bold: true, color: { rgb: "FFFFFF" } },
          },
        ],
      ],
      tables: [],
    };
  }

  private applyThemeColors(workbook: any, theme: any): void {
    // Apply theme colors to workbook properties
    if (workbook.properties) {
      workbook.properties.theme = theme;
    }
  }
}

export default XLSXGenerator;
