// src/generators/xlsx.ts
import ExcelJS from "exceljs";
var WARNA_AKSEN = "FF5E774E";
var WARNA_HEADER = "FF1A1A1D";
var WARNA_BARIS_ALTERNATIF = "FFF3F6F1";
var XLSXGenerator = class {
  constructor(options = { outputPath: "", sheets: [] }) {
    this.options = { ...options };
  }
  validate(config, content) {
    const errors = [];
    const warnings = [];
    if (!config.title) {
      errors.push("Spreadsheet title is required");
    }
    if (!content.blocks || content.blocks.length === 0) {
      warnings.push("Spreadsheet has no content blocks");
    }
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  async generate(config, content) {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.title = config.title || "NitZ-909 Spreadsheet";
      workbook.creator = "NitZ-909";
      const lembar = [];
      for (const cfg of this.options.sheets ?? []) {
        lembar.push(this.sheetFromConfig(cfg));
      }
      for (const block of content.blocks) {
        const rendered = this.renderBlock(block);
        if (rendered) lembar.push(rendered);
      }
      if (lembar.length === 0) {
        lembar.push(this.createDefaultSheet(config));
      }
      for (const spec of lembar) {
        this.tulisLembar(workbook, spec);
      }
      if (this.options.theme) {
        this.applyThemeColors(workbook, this.options.theme);
      }
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
        error: error instanceof Error ? error.message : "Unknown error generating XLSX document"
      };
    }
  }
  /** Tulis satu lembar ke workbook: nilai sel lalu gaya sel. */
  tulisLembar(workbook, spec) {
    const worksheet = workbook.addWorksheet(spec.name);
    if (spec.tabColor) {
      worksheet.properties.tabColor = { argb: spec.tabColor };
    }
    for (const row of spec.rows) {
      const excelRow = worksheet.addRow(row.map((sel) => sel.nilai));
      row.forEach((sel, index) => {
        if (!sel.gaya) return;
        const cell = excelRow.getCell(index + 1);
        if (sel.gaya.bold !== void 0 || sel.gaya.size !== void 0 || sel.gaya.warna) {
          cell.font = {
            ...sel.gaya.bold !== void 0 ? { bold: sel.gaya.bold } : {},
            ...sel.gaya.size !== void 0 ? { size: sel.gaya.size } : {},
            ...sel.gaya.warna ? { color: { argb: sel.gaya.warna } } : {}
          };
        }
        if (sel.gaya.isian) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: sel.gaya.isian }
          };
        }
        if (sel.gaya.rata) {
          cell.alignment = { horizontal: sel.gaya.rata };
        }
      });
    }
  }
  renderBlock(block) {
    switch (block.type) {
      case "heading":
        return this.renderHeadingBlock(block);
      case "paragraph":
        return this.renderParagraphBlock(block);
      case "list":
        return this.renderListBlock(block);
      case "table":
        return this.renderTableBlock(block);
      case "code":
        return this.renderCodeBlock(block);
      case "image":
        return this.renderImageBlock(block);
      case "chart":
        return this.renderChartBlock(block);
      case "diagram":
        return this.renderDiagramBlock(block);
      case "divider":
        return this.renderDividerBlock(block);
      default:
        return null;
    }
  }
  renderHeadingBlock(block) {
    const level = block.level || 1;
    const text = block.text || "Heading";
    return {
      name: `Heading ${level}`,
      tabColor: WARNA_AKSEN,
      rows: [
        [
          {
            nilai: text,
            gaya: { bold: true, size: Math.max(11, 14 - level * 2), warna: "FFFFFFFF" }
          }
        ]
      ]
    };
  }
  renderParagraphBlock(block) {
    const text = block.text || "";
    return {
      name: "Data",
      rows: [[{ nilai: text }]]
    };
  }
  renderListBlock(block) {
    const items = [];
    block.items.forEach((item) => {
      const text = item.text || "";
      const bullet = block.ordered ? `${items.length + 1}. ` : "\u2022 ";
      items.push(bullet + text);
    });
    return {
      name: "List",
      rows: items.map((text) => [{ nilai: text }])
    };
  }
  renderTableBlock(block) {
    if (!block.headers || block.headers.length === 0) {
      return { name: "Table", rows: [] };
    }
    const rows = [];
    rows.push(
      block.headers.map((h) => ({
        nilai: h,
        gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER, rata: "center" }
      }))
    );
    block.rows.forEach((row, rowIndex) => {
      rows.push(
        row.map((cell) => ({
          nilai: cell || "",
          gaya: rowIndex % 2 === 0 ? { isian: WARNA_BARIS_ALTERNATIF } : void 0
        }))
      );
    });
    return {
      name: "Table",
      tabColor: WARNA_AKSEN,
      rows
    };
  }
  renderCodeBlock(block) {
    const lines = block.code?.split("\n") || ["// No code"];
    return {
      name: "Code",
      rows: lines.map((line) => [
        { nilai: line, gaya: { isian: "FFF2F4F1" } }
      ])
    };
  }
  renderImageBlock(block) {
    return {
      name: "Image",
      rows: [[{ nilai: `[Image: ${block.alt || "Image"}]` }]]
    };
  }
  renderChartBlock(block) {
    const chartType = block.chartType || "chart";
    return {
      name: "Chart",
      rows: [[{ nilai: `[${chartType} chart]` }]]
    };
  }
  renderDiagramBlock(block) {
    const diagramType = block.diagramType || "diagram";
    return {
      name: "Diagram",
      rows: [[{ nilai: `[${diagramType} diagram]` }]]
    };
  }
  renderDividerBlock(block) {
    return {
      name: "Divider",
      rows: [[{ nilai: "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500" }]]
    };
  }
  /** Bangun lembar dari `SheetConfig` yang diberikan lewat opsi generator. */
  sheetFromConfig(cfg) {
    const rows = [];
    if (cfg.headers?.length) {
      rows.push(
        cfg.headers.map((h) => ({
          nilai: h,
          gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER }
        }))
      );
    }
    for (const row of cfg.data ?? []) {
      rows.push(
        row.map((value) => ({
          nilai: value === null || value === void 0 ? "" : value
        }))
      );
    }
    return { name: cfg.name, tabColor: WARNA_AKSEN, rows };
  }
  createDefaultSheet(config) {
    return {
      name: config.title || "Sheet1",
      tabColor: WARNA_AKSEN,
      rows: [
        [
          {
            nilai: "NitZ-909 Data",
            gaya: { bold: true, warna: "FFFFFFFF", isian: WARNA_HEADER }
          }
        ]
      ]
    };
  }
  applyThemeColors(workbook, theme) {
    const tema = theme;
    if (tema?.primaryColor) {
      workbook.theme = { primaryColor: tema.primaryColor };
    }
  }
};

// .dsh-verify/e.ts
var g = new XLSXGenerator({ outputPath: "C:\\MRP\\proyek 2026\\NitZ-909\\.dsh-verify\\x.xlsx", sheets: [] });
var r = await g.generate({ type: "xlsx", title: "Uji", metadata: { author: "Uji" } }, { blocks: [
  { id: "h", type: "heading", level: 1, text: "Judul Sheet" },
  { id: "p", type: "paragraph", text: "Teks paragraf." },
  { id: "t", type: "table", headers: ["A", "B"], rows: [["1", "2"]] }
] });
console.log("__R__" + JSON.stringify({ success: r.success, error: r.error }));
