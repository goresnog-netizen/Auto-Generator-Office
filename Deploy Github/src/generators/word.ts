/**
 * Word Document Generator
 * Uses docx library for Word document generation
 */

import {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  WordGeneratorOptions,
  WordStyles,
  WordStyle,
  WordTableStyle,
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
} from "../types";

import {
  Packer,
  XmlText,
  Paragraph,
  TextRun,
  Document,
  Section,
  PageBreak,
  Table as DOCXTable,
  Row,
  Cell,
  Heading as DOCXHeading,
  Alignment,
  VerticalAlign,
  Width,
  Color,
  DocumentLevel,
} from "docx";

export class WordGenerator implements DocumentGenerator {
  private options: WordGeneratorOptions;

  constructor(private optionsParam: WordGeneratorOptions = {}) {
    this.options = {
      outputPath: "",
      format: "buffer" as const,
      theme: {},
      ...optionsParam,
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
      const body: any[] = [];

      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (Array.isArray(rendered)) {
          body.push(...rendered);
        } else {
          body.push(rendered);
        }
      }

      // Add title page if configured
      if (config.metadata?.author) {
        const titlePage = this.createTitlePage(config);
        if (titlePage) body.unshift(titlePage);
      }

      const doc = new Document({
        title: config.title,
        sections: [
          {
            properties: {},
            body,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);

      if (this.options.format === "buffer") {
        return { success: true, buffer };
      }

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
            : "Unknown error generating Word document",
      };
    }
  }

  private renderBlock(block: ContentBlock): any {
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
        return this.renderParagraph({
          type: "paragraph",
          text: JSON.stringify(block),
        });
    }
  }

  private renderHeading(block: HeadingBlock): any {
    const textRun: TextRun = { text: block.text };

    if (block.formatting?.bold) {
      textRun.bold = true;
    }
    if (block.formatting?.italic) {
      textRun.italic = true;
    }
    if (block.formatting?.underline) {
      textRun.underline = true;
    }
    if (block.formatting?.strikethrough) {
      textRun.strike = true;
    }
    if (block.formatting?.code) {
      textRun.code = true;
    }

    const style: WordStyle = {
      fontSize: this.getFontSize(block.level),
      bold: block.level <= 3,
      color: "#1A1A1D",
    };

    if (block.formatting?.link) {
      style.fontFamily = "Calibri";
      // Note: hyperlink would need separate handling
    }

    const heading = new DOCXHeading(block.level, textRun, style);
    return heading;
  }

  private renderParagraph(block: ParagraphBlock): any {
    const text = block.text || "";
    const textRun: TextRun = { text };

    if (block.formatting?.bold) {
      textRun.bold = true;
    }
    if (block.formatting?.italic) {
      textRun.italic = true;
    }
    if (block.formatting?.underline) {
      textRun.underline = true;
    }
    if (block.formatting?.strikethrough) {
      textRun.strike = true;
    }
    if (block.formatting?.code) {
      textRun.code = true;
    }
    if (block.formatting?.link) {
      // Would need hyperlink element
    }

    // Apply color if specified
    if (block.formatting?.color) {
      // Color handling
    }

    const paragraph = new Paragraph([textRun]);
    return paragraph;
  }

  private renderList(block: ListBlock): any {
    const items: any[] = [];

    block.items.forEach((item, index) => {
      const text = item.text || "";
      const textRun: TextRun = { text };

      if (item.formatting?.bold) {
        textRun.bold = true;
      }
      if (item.formatting?.italic) {
        textRun.italic = true;
      }

      const bullet = block.ordered
        ? new TextRun(`${index + 1}. `)
        : new TextRun("• ");

      const paragraph = new Paragraph([bullet, textRun]);
      items.push(paragraph);
    });

    return items;
  }

  private renderTable(block: TableBlock): any {
    if (!block.headers || block.headers.length === 0) return [];

    const rows: any[] = [];

    // Header row
    const headerCells: any[] = [];
    block.headers.forEach((header) => {
      const textRun: TextRun = { text: header };
      const cell = new Cell({
        children: [textRun],
        shading: {
          fill: "1A1A1D",
        },
        color: new Color("#FFFFFF"),
        width: {
          size: 50,
          type: "pct",
        },
      });
      headerCells.push(cell);
    });

    const headerRow = new Row({ children: headerCells });
    rows.push(headerRow);

    // Data rows
    block.rows.forEach((row, rowIndex) => {
      const dataCells: any[] = [];
      row.forEach((cellText, i) => {
        const textRun: TextRun = { text: cellText || "" };
        const cell = new Cell({
          children: [textRun],
          shading: {
            fill: rowIndex % 2 === 0 ? "F5F5F5" : "FFFFFF",
          },
        });
        dataCells.push(cell);
      });

      const dataRow = new Row({ children: dataCells });
      rows.push(dataRow);
    });

    // Create table
    const table = new DOCXTable({
      rows,
      columnWidths: ["33.33%", "33.33%", "33.34%"],
    });

    return table;
  }

  private renderCode(block: CodeBlock): any {
    const lines = block.code.split("\n");
    const linesElements: any[] = [];

    // Add background
    lines.forEach((line, i) => {
      const textRun: TextRun = { text: line || "" };
      const paragraph = new Paragraph([textRun]);
      linesElements.push(paragraph);
    });

    return linesElements;
  }

  private renderImage(block: ImageBlock): any {
    // Placeholder - in production would embed actual image
    const textRun: TextRun = { text: `[Image: ${block.alt || "Image"}` };
    const paragraph = new Paragraph([textRun]);
    return paragraph;
  }

  private renderChartPlaceholder(block: ChartBlock): any {
    const textRun: TextRun = { text: `[Chart: ${block.chartType}` };
    const paragraph = new Paragraph([textRun]);
    return paragraph;
  }

  private renderDiagramPlaceholder(block: DiagramBlock): any {
    const textRun: TextRun = { text: `[Diagram: ${block.diagramType}` };
    const paragraph = new Paragraph([textRun]);
    return paragraph;
  }

  private renderDivider(block: DividerBlock): any {
    const textRun: TextRun = { text: "────────────────────────────────" };
    const paragraph = new Paragraph([textRun]);
    paragraph.props = { alignment: Alignment.CENTER };
    return paragraph;
  }

  private getFontSize(level: number): number {
    const sizes: Record<number, number> = {
      1: 24,
      2: 20,
      3: 18,
      4: 16,
      5: 14,
      6: 12,
    };
    return sizes[level] || 16;
  }

  private createTitlePage(config: DocumentConfig): any {
    try {
      const { title } = config;
      if (!title) return null;

      const titleRun: TextRun = { text: title, bold: true, size: 36 };
      const subtitleRun: TextRun = {
        text: config.metadata?.description || "",
        size: 16,
      };

      const titleHeading = new DOCXHeading(0, titleRun, {
        fontSize: 36,
        bold: true,
        color: "#1A1A1D",
        alignment: Alignment.CENTER,
      });

      const subtitleParagraph = new Paragraph([subtitleRun]);
      subtitleParagraph.props = { alignment: Alignment.CENTER };

      const authorParagraph = new Paragraph([
        new TextRun(`By ${config.metadata?.author || ""}`),
      ]);
      authorParagraph.props = { alignment: Alignment.CENTER };

      // Add page break before content
      return new PageBreak();
    } catch {
      return null;
    }
  }
}

export default WordGenerator;
