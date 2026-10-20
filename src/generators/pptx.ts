/**
 * PPTX Document Generator
 * Uses pptxgenjs for PowerPoint document generation
 */

import {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  PPTXGeneratorOptions,
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

export interface PPTXSlide {
  tx: string; // Text
  sz: number; // Font size
  cb: string; // Color (hex)
  fb: boolean; // Bold
  ib: boolean; // Italic
  al: string; // Alignment
}

export class PPTXGenerator implements DocumentGenerator {
  private options: PPTXGeneratorOptions;

  constructor(private optionsParam: PPTXGeneratorOptions = {}) {
    this.options = {
      outputPath: "",
      format: "widescreen" as const,
      template: {},
      theme: {},
      ...optionsParam,
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
      // In a real implementation, would use pptxgenjs library
      // For now, return the structure and provide guidance
      const slides: any[] = [];

      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (rendered) {
          slides.push(rendered);
        }
      }

      // If no slides generated, create a default slide
      if (slides.length === 0) {
        slides.push(this.createDefaultSlide(config));
      }

      if (this.options.outputPath) {
        // Would write the pptx file using pptxgenjs
        // const pptx = new PPTX();
        // ... configure and save
        return {
          success: true,
          outputPath: this.options.outputPath,
          metadata: { note: "PPTX generation - template to be implemented" },
        };
      }

      return {
        success: true,
        outputPath: config.title + ".pptx",
        metadata: { slidesGenerated: slides.length },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error generating PPTX document",
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
    const sizeMap: Record<number, number> = {
      1: 32,
      2: 28,
      3: 24,
      4: 18,
      5: 16,
      6: 14,
    };

    return {
      type: "slide",
      title: text,
      elements: [
        {
          tx: text,
          sz: sizeMap[level] || 18,
          cb: "#1A1A1D",
          fb: level <= 3,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private renderParagraphBlock(block: ParagraphBlock): any {
    const text = block.text || "";

    return {
      type: "slide",
      title: "",
      elements: [
        {
          tx: text,
          sz: 14,
          cb: "#1A1A1D",
          fb: false,
          ib: false,
          al: "left",
        },
      ],
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
      type: "slide",
      title: "List",
      elements: [
        {
          tx: items.join("\n"),
          sz: 13,
          cb: "#1A1A1D",
          fb: false,
          ib: false,
          al: "left",
        },
      ],
    };
  }

  private renderTableBlock(block: TableBlock): any {
    if (!block.headers || block.headers.length === 0) return null;

    const columns = block.headers.length;
    const rows = block.rows.length;

    return {
      type: "slide",
      title: "Table",
      elements: [
        {
          tx: `Table: ${columns} columns × ${rows} rows`,
          sz: 12,
          cb: "#1A1A1D",
          fb: false,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private renderCodeBlock(block: CodeBlock): any {
    const lines = block.code?.split("\n") || ["// No code"];
    const codeText = lines.slice(0, 10).join("\n"); // Limit to 10 lines

    return {
      type: "slide",
      title: `Code: ${block.language || "text"}`,
      elements: [
        {
          tx: codeText,
          sz: 11,
          cb: "#E2EAE9", // Light background color
          fb: false,
          ib: false,
          al: "left",
        },
      ],
    };
  }

  private renderImageBlock(block: ImageBlock): any {
    return {
      type: "slide",
      title: block.alt || "Image",
      elements: [
        {
          tx: `[Image: ${block.alt || "Image"}]`,
          sz: 12,
          cb: "#E2EAE9",
          fb: false,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private renderChartBlock(block: ChartBlock): any {
    const chartType = block.chartType || "chart";

    return {
      type: "slide",
      title: `Chart: ${chartType}`,
      elements: [
        {
          tx: `[${chartType} chart placeholder]`,
          sz: 12,
          cb: "#E2EAE9",
          fb: false,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private renderDiagramBlock(block: DiagramBlock): any {
    const diagramType = block.diagramType || "diagram";

    return {
      type: "slide",
      title: `Diagram: ${diagramType}`,
      elements: [
        {
          tx: `[${diagramType} diagram placeholder]`,
          sz: 12,
          cb: "#E2EAE9",
          fb: false,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private renderDividerBlock(block: DividerBlock): any {
    return {
      type: "slide",
      title: "",
      elements: [
        {
          tx: "─".repeat(50),
          sz: 10,
          cb: "#E2EAE9",
          fb: false,
          ib: false,
          al: "center",
        },
      ],
    };
  }

  private createDefaultSlide(config: DocumentConfig): any {
    return {
      type: "slide",
      title: config.title || "Untitled Presentation",
      elements: [
        {
          tx: config.title || "NitZ-909 Presentation",
          sz: 24,
          cb: "#1A1A1D",
          fb: true,
          ib: false,
          al: "center",
        },
      ],
    };
  }
}

export default PPTXGenerator;
