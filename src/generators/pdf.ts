/**
 * PDF Document Generator
 * Uses pdfkit for PDF generation
 */

import {
  DocumentGenerator,
  DocumentConfig,
  DocumentContent,
  GeneratorResult,
  ValidationResult,
  PDFGeneratorOptions,
  ContentBlock,
  HeadingBlock,
  ParagraphBlock,
  ListBlock,
  TableBlock,
  CodeBlock,
  ImageBlock,
  ChartBlock,
  DiagramBlock,
  DividerBlock
} from '../types';

import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

export class PDFGenerator implements DocumentGenerator {
  private defaultOptions: PDFGeneratorOptions = {
    outputPath: '',
    format: 'A4',
    orientation: 'portrait',
    margins: { top: 72, right: 72, bottom: 72, left: 72 }
  };

  constructor(private options: PDFGeneratorOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  validate(config: DocumentConfig, content: DocumentContent): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.title) {
      errors.push('Document title is required');
    }

    if (!content.blocks || content.blocks.length === 0) {
      warnings.push('Document has no content blocks');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  async generate(config: DocumentConfig, content: DocumentContent): Promise<GeneratorResult> {
    try {
      const buffers: Buffer[] = [];
      const doc = new PDFDocument({
        size: this.options.format,
        layout: this.options.orientation,
        margins: this.options.margins,
        info: {
          Title: config.title,
          Author: config.metadata?.author || 'NitZ-909',
          Subject: config.metadata?.description || '',
          Creator: 'NitZ-909',
          CreationDate: config.metadata?.createdAt ? new Date(config.metadata.createdAt) : new Date(),
          ModDate: config.metadata?.updatedAt ? new Date(config.metadata.updatedAt) : new Date()
        }
      });

      // Collect buffer
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));

      // Build PDF content
      this.buildPDF(doc, content, config);

      doc.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        doc.on('end', resolve);
        doc.on('error', reject);
      });

      const buffer = Buffer.concat(buffers);

      if (this.options.format === 'buffer') {
        return { success: true, buffer };
      }

      if (this.options.outputPath) {
        const fs = await import('fs');
        await fs.promises.writeFile(this.options.outputPath, buffer);
        return { success: true, outputPath: this.options.outputPath };
      }

      return { success: true, buffer };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error generating PDF document'
      };
    }
  }

  private buildPDF(doc: PDFKit.PDFDocument, content: DocumentContent, config: DocumentConfig): void {
    // Register fonts (would need actual font files in production)
    // doc.registerFont('Sans', 'path/to/GoogleSans-Regular.ttf');
    // doc.registerFont('Sans-Bold', 'path/to/GoogleSans-Bold.ttf');
    // doc.registerFont('Mono', 'path/to/DMMono-Regular.ttf');

    // Title page
    this.addTitlePage(doc, config);

    // Content
    for (const block of content.blocks) {
      this.renderBlock(doc, block);
    }

    // Add page numbers
    this.addPageNumbers(doc);
  }

  private addTitlePage(doc: PDFKit.PDFDocument, config: DocumentConfig): void {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const margin = this.options.margins?.left || 72;

    doc.fontSize(36)
       .font('Helvetica-Bold')
       .fillColor('#1A1A1D')
       .text(config.title, margin, pageHeight / 2 - 50, {
         width: pageWidth - 2 * margin,
         align: 'center'
       });

    if (config.metadata?.description) {
      doc.fontSize(18)
         .font('Helvetica')
         .fillColor('#5C5C66')
         .text(config.metadata.description, margin, pageHeight / 2 + 20, {
           width: pageWidth - 2 * margin,
           align: 'center'
         });
    }

    if (config.metadata?.author) {
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor('#8A8A94')
         .text(`By ${config.metadata.author}`, margin, pageHeight - 100, {
           width: pageWidth - 2 * margin,
           align: 'center'
         });
    }

    doc.addPage();
  }

  private renderBlock(doc: PDFKit.PDFDocument, block: ContentBlock): void {
    switch (block.type) {
      case 'heading':
        this.renderHeading(doc, block as HeadingBlock);
        break;
      case 'paragraph':
        this.renderParagraph(doc, block as ParagraphBlock);
        break;
      case 'list':
        this.renderList(doc, block as ListBlock);
        break;
      case 'table':
        this.renderTable(doc, block as TableBlock);
        break;
      case 'code':
        this.renderCode(doc, block as CodeBlock);
        break;
      case 'image':
        this.renderImage(doc, block as ImageBlock);
        break;
      case 'chart':
        this.renderChartPlaceholder(doc, block as ChartBlock);
        break;
      case 'diagram':
        this.renderDiagramPlaceholder(doc, block as DiagramBlock);
        break;
      case 'divider':
        this.renderDivider(doc);
        break;
    }
  }

  private renderHeading(doc: PDFKit.PDFDocument, block: HeadingBlock): void {
    const sizes = { 1: 24, 2: 20, 3: 18, 4: 16, 5: 14, 6: 12 };
    const size = sizes[block.level] || 18;
    const spacing = { 1: 24, 2: 18, 3: 14, 4: 12, 5: 10, 6: 8 };

    doc.moveDown(spacing[block.level] / 12 || 1);
    doc.fontSize(size)
       .font('Helvetica-Bold')
       .fillColor('#1A1A1D')
       .text(block.text);
    doc.moveDown(0.5);
  }

  private renderParagraph(doc: PDFKit.PDFDocument, block: ParagraphBlock): void {
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#1A1A1D')
       .text(block.text, { align: 'left', lineGap: 4 });
    doc.moveDown(0.5);
  }

  private renderList(doc: PDFKit.PDFDocument, block: ListBlock): void {
    const renderItems = (items: typeof block.items, level: number = 0) => {
      for (const item of items) {
        const indent = level * 20;
        const bullet = block.ordered ? `${items.indexOf(item) + 1}.` : '•';

        doc.fontSize(12)
           .font('Helvetica')
           .fillColor('#1A1A1D')
           .text(`${bullet} ${item.text}`, {
             indent,
             lineGap: 2,
             continued: false
           });

        if (item.children && item.children.length > 0) {
          renderItems(item.children, level + 1);
        }
      }
    };

    doc.moveDown(0.5);
    renderItems(block.items);
    doc.moveDown(0.5);
  }

  private renderTable(doc: PDFKit.PDFDocument, block: TableBlock): void {
    if (!block.headers || block.headers.length === 0) return;

    const colCount = block.headers.length;
    const pageWidth = doc.page.width - (this.options.margins?.left || 72) * 2;
    const colWidth = pageWidth / colCount;

    // Header row
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('#FFFFFF');

    let x = this.options.margins?.left || 72;
    const y = doc.y;

    block.headers.forEach((header, i) => {
      doc.rect(x, y, colWidth, 20).fill('#1A1A1D');
      doc.fillColor('#FFFFFF')
         .text(header, x + 4, y + 4, { width: colWidth - 8, align: 'center' });
      x += colWidth;
    });

    doc.y = y + 20;
    doc.moveDown(0.2);

    // Data rows
    block.rows.forEach((row, rowIndex) => {
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#1A1A1D');

      x = this.options.margins?.left || 72;

      if (rowIndex % 2 === 1) {
        doc.rect(x, doc.y, pageWidth, 18).fill('#F5F5F5');
      }

      row.forEach((cell, i) => {
        doc.fillColor('#1A1A1D')
           .text(cell, x + 4, doc.y + 2, { width: colWidth - 8, align: 'left' });
        x += colWidth;
      });

      doc.moveDown(0.5);

      // Draw horizontal line
      doc.moveTo(this.options.margins?.left || 72, doc.y)
         .lineTo(doc.page.width - (this.options.margins?.right || 72), doc.y)
         .stroke('#E3E3E8');
    });

    doc.moveDown(1);
  }

  private renderCode(doc: PDFKit.PDFDocument, block: CodeBlock): void {
    const lines = block.code.split('\n');
    const maxLines = 40; // Limit per page

    doc.moveDown(0.5);
    doc.fontSize(9)
       .font('Courier')
       .fillColor('#1A1A1D');

    // Background
    const startY = doc.y;
    const padding = 8;
    const lineHeight = 12;

    doc.rect(
      (this.options.margins?.left || 72) - padding,
      startY - padding,
      doc.page.width - (this.options.margins?.left || 72) * 2 + 2 * padding,
      Math.min(lines.length, maxLines) * lineHeight + 2 * padding
    ).fill('#F0F2EF');

    doc.y = startY;

    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      doc.text(lines[i] || ' ', (this.options.margins?.left || 72), doc.y, {
        width: doc.page.width - (this.options.margins?.left || 72) * 2 - 16,
        continued: false
      });
    }

    if (lines.length > maxLines) {
      doc.fillColor('#8A8A94')
         .fontSize(9)
         .font('Helvetica')
         .text(`... ${lines.length - maxLines} more lines ...`);
    }

    doc.moveDown(1);
  }

  private renderImage(doc: PDFKit.PDFDocument, block: ImageBlock): void {
    // Placeholder for image
    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica-Oblique')
       .fillColor('#9E9E9E')
       .text(`[Image: ${block.alt}]`, { align: 'center' });
    doc.moveDown(1);
  }

  private renderChartPlaceholder(doc: PDFKit.PDFDocument, block: ChartBlock): void {
    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica-Oblique')
       .fillColor('#9E9E9E')
       .text(`[Chart: ${block.chartType}]`, { align: 'center' });
    doc.moveDown(1);
  }

  private renderDiagramPlaceholder(doc: PDFKit.PDFDocument, block: DiagramBlock): void {
    doc.moveDown(0.5);
    doc.fontSize(12)
       .font('Helvetica-Oblique')
       .fillColor('#9E9E9E')
       .text(`[Diagram: ${block.diagramType}]`, { align: 'center' });
    doc.moveDown(1);
  }

  private renderDivider(doc: PDFKit.PDFDocument): void {
    doc.moveDown(0.5);
    doc.moveTo(this.options.margins?.left || 72, doc.y)
       .lineTo(doc.page.width - (this.options.margins?.right || 72), doc.y)
       .stroke('#E3E3E8');
    doc.moveDown(0.5);
  }

  private addPageNumbers(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    if (!pages) return;

    const pageCount = pages.count;

    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#9E9E9E')
         .text(`${i + 1} / ${pageCount}`, 0, doc.page.height - 50, {
           align: 'center'
         });
    }
  }
}

export default PDFGenerator;