// src/generators/pdf.ts
import PDFDocument from "pdfkit";
var PDFGenerator = class {
  constructor(options = { outputPath: "" }) {
    this.defaultOptions = {
      outputPath: "",
      format: "A4",
      orientation: "portrait",
      margins: { top: 72, right: 72, bottom: 72, left: 72 }
    };
    this.options = { ...this.defaultOptions, ...options };
  }
  validate(config, content) {
    const errors = [];
    const warnings = [];
    if (!config.title) {
      errors.push("Document title is required");
    }
    if (!content.blocks || content.blocks.length === 0) {
      warnings.push("Document has no content blocks");
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  async generate(config, content) {
    try {
      const buffers = [];
      const doc = new PDFDocument({
        size: this.options.format,
        layout: this.options.orientation,
        margins: this.options.margins,
        // Tanpa ini pdfkit langsung membuang halaman yang sudah ditulis,
        // sehingga `switchToPage()` untuk nomor halaman melempar
        // "out of bounds".
        bufferPages: true,
        info: {
          Title: config.title,
          Author: config.metadata?.author || "NitZ-909",
          Subject: config.metadata?.description || "",
          Creator: "NitZ-909",
          CreationDate: config.metadata?.createdAt ? new Date(config.metadata.createdAt) : /* @__PURE__ */ new Date(),
          ModDate: config.metadata?.updatedAt ? new Date(config.metadata.updatedAt) : /* @__PURE__ */ new Date()
        }
      });
      doc.on("data", (chunk) => buffers.push(chunk));
      this.buildPDF(doc, content, config);
      doc.end();
      await new Promise((resolve, reject) => {
        doc.on("end", resolve);
        doc.on("error", reject);
      });
      const buffer = Buffer.concat(buffers);
      if (this.options.outputPath) {
        const fs = await import("fs");
        await fs.promises.writeFile(this.options.outputPath, buffer);
        return { success: true, outputPath: this.options.outputPath };
      }
      return { success: true, buffer };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error generating PDF document"
      };
    }
  }
  buildPDF(doc, content, config) {
    this.addTitlePage(doc, config);
    for (const block of content.blocks) {
      this.renderBlock(doc, block);
    }
    this.addPageNumbers(doc);
  }
  addTitlePage(doc, config) {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const margin = this.options.margins?.left || 72;
    doc.fontSize(36).font("Helvetica-Bold").fillColor("#1A1A1D").text(config.title, margin, pageHeight / 2 - 50, {
      width: pageWidth - 2 * margin,
      align: "center"
    });
    if (config.metadata?.description) {
      doc.fontSize(18).font("Helvetica").fillColor("#5C5C66").text(config.metadata.description, margin, pageHeight / 2 + 20, {
        width: pageWidth - 2 * margin,
        align: "center"
      });
    }
    if (config.metadata?.author) {
      doc.fontSize(12).font("Helvetica").fillColor("#8A8A94").text(`By ${config.metadata.author}`, margin, pageHeight - 100, {
        width: pageWidth - 2 * margin,
        align: "center"
      });
    }
    doc.addPage();
  }
  renderBlock(doc, block) {
    switch (block.type) {
      case "heading":
        this.renderHeading(doc, block);
        break;
      case "paragraph":
        this.renderParagraph(doc, block);
        break;
      case "list":
        this.renderList(doc, block);
        break;
      case "table":
        this.renderTable(doc, block);
        break;
      case "code":
        this.renderCode(doc, block);
        break;
      case "image":
        this.renderImage(doc, block);
        break;
      case "chart":
        this.renderChartPlaceholder(doc, block);
        break;
      case "diagram":
        this.renderDiagramPlaceholder(doc, block);
        break;
      case "divider":
        this.renderDivider(doc);
        break;
    }
  }
  renderHeading(doc, block) {
    const sizes = { 1: 24, 2: 20, 3: 18, 4: 16, 5: 14, 6: 12 };
    const size = sizes[block.level] || 18;
    const spacing = { 1: 24, 2: 18, 3: 14, 4: 12, 5: 10, 6: 8 };
    doc.moveDown(spacing[block.level] / 12 || 1);
    doc.fontSize(size).font("Helvetica-Bold").fillColor("#1A1A1D").text(block.text);
    doc.moveDown(0.5);
  }
  renderParagraph(doc, block) {
    doc.fontSize(12).font("Helvetica").fillColor("#1A1A1D").text(block.text, { align: "left", lineGap: 4 });
    doc.moveDown(0.5);
  }
  renderList(doc, block) {
    const renderItems = (items, level = 0) => {
      for (const item of items) {
        const indent = level * 20;
        const bullet = block.ordered ? `${items.indexOf(item) + 1}.` : "\u2022";
        doc.fontSize(12).font("Helvetica").fillColor("#1A1A1D").text(`${bullet} ${item.text}`, {
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
  renderTable(doc, block) {
    if (!block.headers || block.headers.length === 0) return;
    const colCount = block.headers.length;
    const pageWidth = doc.page.width - (this.options.margins?.left || 72) * 2;
    const colWidth = pageWidth / colCount;
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#FFFFFF");
    let x = this.options.margins?.left || 72;
    const y = doc.y;
    block.headers.forEach((header) => {
      doc.rect(x, y, colWidth, 20).fill("#1A1A1D");
      doc.fillColor("#FFFFFF").text(header, x + 4, y + 4, { width: colWidth - 8, align: "center" });
      x += colWidth;
    });
    doc.y = y + 20;
    doc.moveDown(0.2);
    block.rows.forEach((row, rowIndex) => {
      doc.fontSize(10).font("Helvetica").fillColor("#1A1A1D");
      x = this.options.margins?.left || 72;
      if (rowIndex % 2 === 1) {
        doc.rect(x, doc.y, pageWidth, 18).fill("#F5F5F5");
      }
      row.forEach((cell) => {
        doc.fillColor("#1A1A1D").text(cell, x + 4, doc.y + 2, { width: colWidth - 8, align: "left" });
        x += colWidth;
      });
      doc.moveDown(0.5);
      doc.moveTo(this.options.margins?.left || 72, doc.y).lineTo(doc.page.width - (this.options.margins?.right || 72), doc.y).stroke("#E3E3E8");
    });
    doc.moveDown(1);
  }
  renderCode(doc, block) {
    const lines = block.code.split("\n");
    const maxLines = 40;
    doc.moveDown(0.5);
    doc.fontSize(9).font("Courier").fillColor("#1A1A1D");
    const startY = doc.y;
    const padding = 8;
    const lineHeight = 12;
    doc.rect(
      (this.options.margins?.left || 72) - padding,
      startY - padding,
      doc.page.width - (this.options.margins?.left || 72) * 2 + 2 * padding,
      Math.min(lines.length, maxLines) * lineHeight + 2 * padding
    ).fill("#F0F2EF");
    doc.y = startY;
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      doc.text(lines[i] || " ", this.options.margins?.left || 72, doc.y, {
        width: doc.page.width - (this.options.margins?.left || 72) * 2 - 16,
        continued: false
      });
    }
    if (lines.length > maxLines) {
      doc.fillColor("#8A8A94").fontSize(9).font("Helvetica").text(`... ${lines.length - maxLines} more lines ...`);
    }
    doc.moveDown(1);
  }
  renderImage(doc, block) {
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Oblique").fillColor("#9E9E9E").text(`[Image: ${block.alt}]`, { align: "center" });
    doc.moveDown(1);
  }
  renderChartPlaceholder(doc, block) {
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Oblique").fillColor("#9E9E9E").text(`[Chart: ${block.chartType}]`, { align: "center" });
    doc.moveDown(1);
  }
  renderDiagramPlaceholder(doc, block) {
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica-Oblique").fillColor("#9E9E9E").text(`[Diagram: ${block.diagramType}]`, { align: "center" });
    doc.moveDown(1);
  }
  renderDivider(doc) {
    doc.moveDown(0.5);
    doc.moveTo(this.options.margins?.left || 72, doc.y).lineTo(doc.page.width - (this.options.margins?.right || 72), doc.y).stroke("#E3E3E8");
    doc.moveDown(0.5);
  }
  addPageNumbers(doc) {
    const pages = doc.bufferedPageRange();
    if (!pages || pages.count === 0) return;
    const pageCount = pages.count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(pages.start + i);
      doc.fontSize(9).font("Helvetica").fillColor("#9E9E9E").text(`${i + 1} / ${pageCount}`, 0, doc.page.height - 50, {
        align: "center"
      });
    }
  }
};

// .dsh-verify/pe2.ts
var g = new PDFGenerator({ outputPath: "C:\\MRP\\proyek 2026\\NitZ-909\\.dsh-verify\\p2.pdf" });
var r = await g.generate({ type: "pdf", title: "Laporan Uji", metadata: { author: "Uji" } }, { blocks: [
  { id: "p1", type: "paragraph", text: "Paragraf pengujian." },
  { id: "p2", type: "paragraph", text: "Paragraf kedua." }
] });
console.log("__R__" + JSON.stringify({ success: r.success, error: r.error }));
