/**
 * Document Editor Component
 * Main editor for creating and editing document content
 */

import {
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
import { ThemeTokens } from "../types";
import {
  eksporChartPng,
  eksporDiagramSvg,
  type HasilEkspor,
} from "../lib/exporter";

export interface EditorState {
  blocks: ContentBlock[];
  selectedBlockId: string | null;
  cursorPosition: { blockId: string; offset: number } | null;
  undoStack: ContentBlock[][];
  redoStack: ContentBlock[][];
  zoom: number;
  isFocused: boolean;
}

export class DocumentEditor {
  private state: EditorState;
  private onBlockChange: ((blocks: ContentBlock[]) => void) | null;
  private theme: ThemeTokens;
  /** Snapshot sebelum satu sesi ketikan, untuk coalescing undo. */
  private snapshot: ContentBlock[] | null = null;
  private onEdit: (() => void) | null = null;
  private onRedraw: (() => void) | null = null;
  /**
   * Mode tampilan: matikan editing teks dan toolbar blok. Dipakai panel
   * preview template supaya hasilnya identik dengan kanvas tanpa bisa diedit.
   */
  private readOnly: boolean;

  constructor(
    initialBlocks: ContentBlock[] = [],
    onBlockChange?: (blocks: ContentBlock[]) => void,
    theme?: ThemeTokens,
    readOnly = false,
  ) {
    this.state = {
      blocks: initialBlocks,
      selectedBlockId: null,
      cursorPosition: null,
      undoStack: [],
      redoStack: [],
      zoom: 1,
      isFocused: false,
    };
    this.onBlockChange = onBlockChange ?? null;
    this.theme = theme || this.getDefaultTheme();
    this.readOnly = readOnly;
  }

  private getDefaultTheme(): ThemeTokens {
    return {
      colors: {
        bg: "#0a0a0a",
        surface: "#171717",
        surface2: "#1f1f1f",
        raised: "#222222",
        border: "#333333",
        chrome: "#1a1a1a",
        text: "#ebebeb",
        muted: "#9e9e9e",
        faint: "#666666",
        brand: "#b5cea5",
        brandDim: "#8a9a7a",
        primaryAction: "#b5cea5",
        primaryActionText: "#0a0a0a",
        bubble: "#222222",
        accent: "#b5cea5",
        accentDim: "#8a9a7a",
        premium: "#c4a77d",
        green: "#7bc47f",
        danger: "#e06c75",
        ok: "#7bc47f",
        warn: "#e5c07b",
        info: "#61afef",
        successText: "#7bc47f",
        dangerText: "#e06c75",
        warningText: "#e5c07b",
        shadow: "rgba(0,0,0,0.3)",
        controlBg: "#1f1f1f",
        controlBgHover: "#2a2a2a",
        controlBgPressed: "#333333",
        controlBorder: "#444444",
        controlBorderHover: "#555555",
        focusHalo: "rgba(181,206,165,0.3)",
      },
      typography: {
        fontSizes: {
          caption: "10px",
          label: "11px",
          ui: "12px",
          body: "13px",
          message: "14px",
          title: "15px",
          heading: "20px",
          display: "24px",
        },
        fontWeights: {
          light: 300,
          regular: 400,
          medium: 450,
          semibold: 500,
          bold: 600,
        },
        fontMono: "Consolas, monospace",
        fontSans: "Segoe UI, system-ui, sans-serif",
      },
      spacing: {
        space: {
          0: "0px",
          1: "2px",
          2: "4px",
          3: "6px",
          4: "8px",
          5: "12px",
          6: "16px",
          7: "24px",
          8: "32px",
        },
      },
      borderRadius: {
        radius: {
          xs: "4px",
          sm: "6px",
          md: "8px",
          lg: "12px",
          xl: "16px",
          round: "999px",
        },
      },
      motion: {
        ease: "cubic-bezier(.32, .72, 0, 1)",
        durationIn: ".32s",
        durationOut: ".24s",
      },
      layout: {
        tabbarHeight: "60px",
        tabHeight: "30px",
        chatContentMaxWidth: "720px",
        explorerWidth: "440px",
      },
    };
  }

  getState(): EditorState {
    return { ...this.state };
  }

  getBlocks(): ContentBlock[] {
    return [...this.state.blocks];
  }

  setBlocks(blocks: ContentBlock[]): void {
    this.saveUndoState();
    this.state.blocks = blocks as ContentBlock[];
    this.onBlockChange?.(this.state.blocks);
  }

  addBlock(block: ContentBlock): void {
    this.saveUndoState();
    const newBlock = { ...block, id: block.id || `block-${Date.now()}` };
    this.state.blocks = [...this.state.blocks, newBlock];
    this.onBlockChange?.(this.state.blocks);
  }

  updateBlock(id: string, updates: Partial<ContentBlock>): void {
    this.saveUndoState();
    this.applyUpdate(id, updates);
  }

  /** Dipakai saat mengetik: tidak menambah entri undo sendiri. */
  updateBlockSilent(id: string, updates: Partial<ContentBlock>): void {
    this.applyUpdate(id, updates);
  }

  private applyUpdate(id: string, updates: Partial<ContentBlock>): void {
    const index = this.state.blocks.findIndex((b) => b.id === id);
    if (index === -1) return;

    const existing = this.state.blocks[index];
    const updated = { ...existing, ...updates } as ContentBlock;
    this.state.blocks = [
      ...this.state.blocks.slice(0, index),
      updated,
      ...this.state.blocks.slice(index + 1),
    ];
    this.onBlockChange?.(this.state.blocks);
    // Beritahu React state ikut berubah. Tidak menaikkan `version`, jadi
    // kanvas tidak dirender ulang dan caret tidak hilang saat mengetik.
    this.onEdit?.();
  }

  /** Satu sesi ketikan = satu entri undo (bukan satu per ketikan). */
  beginEdit(): void {
    if (!this.snapshot) {
      this.snapshot = JSON.parse(JSON.stringify(this.state.blocks));
    }
  }

  endEdit(): void {
    const sebelum = this.snapshot;
    this.snapshot = null;
    if (!sebelum) return;
    if (JSON.stringify(sebelum) === JSON.stringify(this.state.blocks)) return;
    this.pushUndo(sebelum);
  }

  setOnEdit(fn: (() => void) | null): void {
    this.onEdit = fn;
  }

  setOnRedraw(fn: (() => void) | null): void {
    this.onRedraw = fn;
  }

  /**
   * Perubahan dari kontrol di dalam blok (tipe grafik, +/− baris, ganti
   * tabel): state berubah DAN kanvas perlu dirender ulang.
   */
  updateFromControl(id: string, updates: Partial<ContentBlock>): void {
    this.saveUndoState();
    this.applyUpdate(id, updates);
    this.onRedraw?.();
  }

  removeBlock(id: string): ContentBlock | undefined {
    const index = this.state.blocks.findIndex((b) => b.id === id);
    if (index === -1) return;

    this.saveUndoState();
    const removed = this.state.blocks[index];
    this.state.blocks = this.state.blocks.filter((b) => b.id !== id);
    this.onBlockChange?.(this.state.blocks);
    return removed;
  }

  selectBlock(id: string | null): void {
    this.state.selectedBlockId = id;
    // Move cursor to start of block
    if (id) {
      const block = this.state.blocks.find((b) => b.id === id);
      if (block) {
        this.state.cursorPosition = { blockId: id, offset: 0 };
      }
    } else {
      this.state.cursorPosition = null;
    }
    this.onBlockChange?.(this.state.blocks);
  }

  undo(): boolean {
    if (this.state.undoStack.length === 0) return false;

    const lastState = this.state.undoStack[
      this.state.undoStack.length - 1
    ] as ContentBlock[];
    this.state.redoStack.push(
      JSON.parse(JSON.stringify(this.state.blocks)) as ContentBlock[],
    );
    this.state.blocks = lastState;
    this.state.undoStack.pop();
    this.onBlockChange?.(this.state.blocks);
    return true;
  }

  redo(): boolean {
    if (this.state.redoStack.length === 0) return false;

    const nextState = this.state.redoStack[
      this.state.redoStack.length - 1
    ] as ContentBlock[];
    this.state.undoStack.push(
      JSON.parse(JSON.stringify(this.state.blocks)) as ContentBlock[],
    );
    this.state.blocks = nextState;
    this.state.redoStack.pop();
    this.onBlockChange?.(this.state.blocks);
    return true;
  }

  /** Dipanggil SEBELUM mutasi: snapshot kondisi sekarang jadi target undo. */
  private saveUndoState(): void {
    this.pushUndo(
      JSON.parse(JSON.stringify(this.state.blocks)) as ContentBlock[],
    );
  }

  private pushUndo(snapshot: ContentBlock[]): void {
    if (this.state.undoStack.length >= 50) {
      this.state.undoStack.shift();
    }
    this.state.undoStack.push(snapshot);
    this.state.redoStack.length = 0;
  }

  getTheme(): ThemeTokens {
    return this.theme;
  }

  setTheme(theme: ThemeTokens): void {
    this.theme = theme;
    this.onBlockChange?.(this.state.blocks);
  }

  private getFontSize(level: number): string {
    // Map heading level to font size from theme
    const sizeMap: Record<number, string> = {
      1: this.theme.typography.fontSizes.display || "32px",
      2: this.theme.typography.fontSizes.title || "24px",
      3: this.theme.typography.fontSizes.title || "20px",
      4: this.theme.typography.fontSizes.h4 || "16px",
      5: this.theme.typography.fontSizes.h5 || "14px",
      6: this.theme.typography.fontSizes.h6 || "12px",
    };
    return sizeMap[level] || "16px";
  }

  private aksiBlok:
    ((aksi: "naik" | "turun" | "ganda" | "hapus", id: string) => void) | null =
    null;

  setOnBlockAction(
    fn:
      ((aksi: "naik" | "turun" | "ganda" | "hapus", id: string) => void) | null,
  ): void {
    this.aksiBlok = fn;
  }

  private renderToolbarBlok(id: string, wrapper: HTMLElement): void {
    const bar = document.createElement("div");
    bar.className = "toolbar-blok";
    bar.setAttribute("role", "toolbar");
    bar.setAttribute("aria-label", "Atur blok");
    const defs: Array<[string, string, string]> = [
      ["naik", "\u25B2", "Pindah ke atas"],
      ["turun", "\u25BC", "Pindah ke bawah"],
      ["ganda", "\u29C9", "Gandakan blok"],
      ["hapus", "\u2715", "Hapus blok"],
    ];
    defs.forEach(([aksi, simbol, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = simbol;
      b.title = label;
      b.setAttribute("aria-label", label);
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.aksiBlok?.(aksi as "naik" | "turun" | "ganda" | "hapus", id);
      });
      bar.appendChild(b);
    });
    wrapper.appendChild(bar);
  }

  // Block rendering methods
  renderBlockHtml(block: ContentBlock, container: HTMLElement): void {
    container.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "editor-block";
    wrapper.dataset.blockId = block.id;

    switch (block.type) {
      case "heading":
        this.renderHeading(block as HeadingBlock, wrapper);
        break;
      case "paragraph":
        this.renderParagraph(block as ParagraphBlock, wrapper);
        break;
      case "list":
        this.renderList(block as ListBlock, wrapper);
        break;
      case "table":
        this.renderTable(block as TableBlock, wrapper);
        break;
      case "code":
        this.renderCode(block as CodeBlock, wrapper);
        break;
      case "image":
        this.renderImage(block as ImageBlock, wrapper);
        break;
      case "chart":
        this.renderChart(block as ChartBlock, wrapper);
        break;
      case "diagram":
        this.renderDiagram(block as DiagramBlock, wrapper);
        break;
      case "divider":
        this.renderDivider(block as DividerBlock, wrapper);
        break;
    }

    if (!this.readOnly) this.renderToolbarBlok(block.id, wrapper);
    container.appendChild(wrapper);
  }

  /**
   * Jadikan elemen bisa diketik. Satu sesi fokus = satu entri undo.
   * `satuBaris` dipakai judul/list/sel tabel: Enter blur, Shift+Enter baris baru.
   */
  private editable(
    el: HTMLElement,
    apply: (teks: string) => void,
    satuBaris = false,
  ): void {
    if (this.readOnly) return;
    el.contentEditable = "true";
    el.spellcheck = false;
    el.dataset.editable = "true";
    if (satuBaris) el.dataset.satuBaris = "true";
    el.style.outline = "none";
    el.style.borderRadius = "var(--radius-xs)";
    el.addEventListener("focus", () => {
      el.dataset.fokus = "true";
      this.beginEdit();
    });
    el.addEventListener("blur", () => {
      delete el.dataset.fokus;
      this.endEdit();
    });
    el.addEventListener("input", () => apply(el.textContent ?? ""));
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        el.blur();
        return;
      }
      if (e.key === "Enter" && satuBaris && !e.shiftKey) {
        e.preventDefault();
        el.blur();
      }
    });
  }

  private renderHeading(block: HeadingBlock, container: HTMLElement): void {
    const h = document.createElement(`h${block.level}`);
    h.textContent = block.text;
    h.style.fontSize = this.getFontSize(block.level);
    h.style.fontWeight = block.level <= 3 ? "600" : "500";
    h.style.color = "var(--text)";
    h.style.margin = `0 0 ${this.theme.spacing.space[2]}`;
    h.style.lineHeight = "1.2";
    this.editable(
      h,
      (teks) =>
        this.updateBlockSilent(block.id, {
          text: teks,
        } as Partial<ContentBlock>),
      true,
    );
    container.appendChild(h);
  }

  private renderParagraph(block: ParagraphBlock, container: HTMLElement): void {
    const p = document.createElement("p");
    p.textContent = block.text;
    p.style.color = "var(--text)";
    p.style.lineHeight = "1.75";
    p.style.margin = `0 0 ${this.theme.spacing.space[4]}`;
    p.style.whiteSpace = "pre-wrap";
    this.editable(p, (teks) =>
      this.updateBlockSilent(block.id, { text: teks } as Partial<ContentBlock>),
    );
    container.appendChild(p);
  }

  private renderList(block: ListBlock, container: HTMLElement): void {
    const ul = document.createElement("ul");
    ul.style.margin = `0 ${this.theme.spacing.space[4]}`;
    ul.style.paddingLeft = `${this.theme.spacing.space[5]}`;

    const renderItems = (items: typeof block.items, level: number = 0) => {
      items.forEach((item, index) => {
        const li = document.createElement("li");
        li.style.marginBottom = `${this.theme.spacing.space[2]}`;
        li.style.color = "var(--text)";

        const indent = level * 20;
        li.style.paddingLeft = `${indent}px`;

        const bullet = document.createElement("span");
        bullet.textContent = block.ordered ? `${index + 1}.` : "•";
        bullet.style.color = "var(--muted)";
        bullet.style.marginRight = `${this.theme.spacing.space[1]}`;
        bullet.style.fontSize = this.theme.typography.fontSizes.ui;

        li.appendChild(bullet);
        const span = document.createElement("span");
        span.textContent = item.text;
        this.editable(
          span,
          (teks) => {
            const baru = items.map((it, i) =>
              i === index ? { ...it, text: teks } : it,
            );
            this.updateBlockSilent(block.id, {
              items: baru,
            } as Partial<ContentBlock>);
          },
          true,
        );
        li.appendChild(span);

        if (item.children && item.children.length > 0) {
          const nestedUl = document.createElement("ul");
          nestedUl.style.marginTop = `${this.theme.spacing.space[1]}`;
          nestedUl.style.paddingLeft = `${this.theme.spacing.space[5] + indent + 16}px`;
          renderItems(item.children, level + 1);
          li.appendChild(nestedUl);
        }

        ul.appendChild(li);
      });
    };

    renderItems(block.items);
    container.appendChild(ul);
  }

  private renderTable(block: TableBlock, container: HTMLElement): void {
    const table = document.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";
    table.style.margin = `${this.theme.spacing.space[4]} 0`;

    // Header row
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.style.background = "var(--surface)";
    headerRow.style.color = "var(--text)";

    block.headers.forEach((header, col) => {
      const th = document.createElement("th");
      th.textContent = header;
      th.style.border = "1px solid var(--border)";
      th.style.padding = this.theme.spacing.space[2];
      th.style.fontSize = this.theme.typography.fontSizes.caption;
      th.style.fontWeight = "500";
      th.style.textAlign = "left";
      this.editable(
        th,
        (teks) => {
          const baru = block.headers.map((h, i) => (i === col ? teks : h));
          this.updateBlockSilent(block.id, {
            headers: baru,
          } as Partial<ContentBlock>);
        },
        true,
      );
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
    const tbody = document.createElement("tbody");
    block.rows.forEach((row, rowIndex) => {
      const dataRow = document.createElement("tr");
      dataRow.style.background =
        rowIndex % 2 === 0 ? "var(--surface)" : "var(--raised)";
      dataRow.style.color = "var(--text)";

      row.forEach((cell, col) => {
        const td = document.createElement("td");
        td.textContent = cell;
        td.style.border = "1px solid var(--border)";
        td.style.padding = this.theme.spacing.space[2];
        td.style.fontSize = this.theme.typography.fontSizes.ui;
        td.style.lineHeight = "1.4";
        td.style.textAlign = "left";
        this.editable(
          td,
          (teks) => {
            const baru = block.rows.map((r, i) =>
              i === rowIndex ? r.map((c, j) => (j === col ? teks : c)) : r,
            );
            this.updateBlockSilent(block.id, {
              rows: baru,
            } as Partial<ContentBlock>);
          },
          true,
        );
        dataRow.appendChild(td);
      });

      tbody.appendChild(dataRow);
    });
    table.appendChild(tbody);

    container.appendChild(table);
  }

  private renderCode(block: CodeBlock, container: HTMLElement): void {
    const pre = document.createElement("pre");
    pre.style.background = "var(--surface)";
    pre.style.color = "var(--text)";
    pre.style.padding = `${this.theme.spacing.space[3]}`;
    pre.style.borderRadius = this.theme.borderRadius.radius.md;
    pre.style.overflowX = "auto";
    pre.style.fontFamily = this.theme.typography.fontMono;
    pre.style.fontSize = this.theme.typography.fontSizes.ui;

    const code = document.createElement("code");
    code.textContent = block.code;
    code.style.color = "var(--text)";
    this.editable(code, (teks) =>
      this.updateBlockSilent(block.id, { code: teks } as Partial<ContentBlock>),
    );

    pre.appendChild(code);
    container.appendChild(pre);
  }

  /** Input satu baris di dalam blok (dipakai gambar). */
  private textInput(
    value: string,
    placeholder: string,
    apply: (teks: string) => void,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "text";
    input.value = value;
    input.placeholder = placeholder;
    input.style.width = "100%";
    input.style.padding = `${this.theme.spacing.space[1]} ${this.theme.spacing.space[2]}`;
    input.style.fontSize = this.theme.typography.fontSizes.caption;
    input.style.fontFamily = this.theme.typography.fontSans;
    input.style.color = "var(--text)";
    input.style.background = "var(--bg)";
    input.style.border = "1px solid var(--border)";
    input.style.borderRadius = this.theme.borderRadius.radius.sm;
    // Kolom url/alt adalah alat editor, bukan isi dokumen — jangan muncul di preview.
    if (this.readOnly) input.style.display = "none";
    input.addEventListener("focus", () => this.beginEdit());
    input.addEventListener("blur", () => this.endEdit());
    input.addEventListener("input", () => apply(input.value));
    return input;
  }

  private renderImage(block: ImageBlock, container: HTMLElement): void {
    const fig = document.createElement("figure");
    fig.style.margin = `${this.theme.spacing.space[4]} 0`;

    const placeholder = (pesan: string): HTMLElement => {
      const box = document.createElement("div");
      box.textContent = pesan;
      box.style.border = "1px dashed var(--border)";
      box.style.borderRadius = this.theme.borderRadius.radius.md;
      box.style.padding = `${this.theme.spacing.space[6]} ${this.theme.spacing.space[4]}`;
      box.style.textAlign = "center";
      box.style.color = "var(--muted)";
      box.style.fontSize = this.theme.typography.fontSizes.caption;
      return box;
    };

    const src = (block.src ?? "").trim();
    if (src) {
      const img = document.createElement("img");
      img.src = src;
      img.alt = block.alt || "";
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.borderRadius = this.theme.borderRadius.radius.md;
      img.addEventListener("error", () =>
        img.replaceWith(
          placeholder("Gambar gagal dimuat — periksa URL di bawah."),
        ),
      );
      fig.appendChild(img);
    } else {
      fig.appendChild(
        placeholder("Blok gambar belum punya sumber — isi URL di bawah."),
      );
    }

    // Caption
    if (block.caption) {
      const figcaption = document.createElement("figcaption");
      figcaption.textContent = block.caption;
      figcaption.style.fontSize = this.theme.typography.fontSizes.caption;
      figcaption.style.color = "var(--muted)";
      figcaption.style.textAlign = "center";
      figcaption.style.marginTop = this.theme.spacing.space[1];
      this.editable(figcaption, (teks) =>
        this.updateBlockSilent(block.id, {
          caption: teks,
        } as Partial<ContentBlock>),
      );
      fig.appendChild(figcaption);
    }

    const kolom = document.createElement("div");
    kolom.style.display = "grid";
    kolom.style.gap = this.theme.spacing.space[1];
    kolom.style.marginTop = this.theme.spacing.space[2];
    kolom.appendChild(
      this.textInput(block.src ?? "", "https://… atau data:image/…", (teks) =>
        this.updateBlockSilent(block.id, {
          src: teks,
        } as Partial<ContentBlock>),
      ),
    );
    kolom.appendChild(
      this.textInput(block.alt ?? "", "Teks alternatif gambar", (teks) =>
        this.updateBlockSilent(block.id, {
          alt: teks,
        } as Partial<ContentBlock>),
      ),
    );
    fig.appendChild(kolom);

    container.appendChild(fig);
  }

  /** Palet brand Freebuff, dipakai untuk seri & irisan diagram. */
  private palette(i: number): string {
    const warna = [
      "var(--brand)",
      "var(--premium)",
      "var(--alam-laut)",
      "var(--warn)",
      "var(--merged)",
      "var(--brand-1)",
    ];
    return warna[i % warna.length];
  }

  /**
   * Tombol unduh gambar untuk blok kanvas (grafik PNG / diagram SVG).
   * Pesan kegagalan muncul di baris tombol, bukan dialog.
   */
  private tombolUnduhGambar(
    label: string,
    unduh: () => Promise<HasilEkspor> | HasilEkspor,
  ): { btn: HTMLButtonElement; pesan: HTMLSpanElement } {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.title = "Unduh blok ini sebagai berkas gambar";
    btn.style.font = "inherit";
    btn.style.fontSize = this.theme.typography.fontSizes.caption;
    btn.style.padding = `${this.theme.spacing.space[1]} ${this.theme.spacing.space[3]}`;
    btn.style.borderRadius = this.theme.borderRadius.radius.sm;
    btn.style.cursor = "pointer";
    btn.style.background = "transparent";
    btn.style.color = "var(--muted)";
    btn.style.border = "1px solid var(--border)";
    btn.style.marginLeft = "auto";

    const pesan = document.createElement("span");
    pesan.style.fontSize = this.theme.typography.fontSizes.caption;
    pesan.style.color = "var(--muted)";
    pesan.style.alignSelf = "center";

    btn.addEventListener("click", () => {
      pesan.textContent = "Menyiapkan berkas…";
      void (async () => {
        try {
          const hasil = await unduh();
          pesan.textContent = hasil.pesan;
        } catch (e) {
          pesan.textContent =
            e instanceof Error ? e.message : "Gagal mengunduh gambar.";
        }
      })();
    });

    return { btn, pesan };
  }

  private renderChart(block: ChartBlock, container: HTMLElement): void {
    const labels = block.data?.labels ?? [];
    const datasets = block.data?.datasets ?? [];

    const div = document.createElement("div");
    div.style.background = "var(--surface)";
    div.style.border = "1px solid var(--border)";
    div.style.borderRadius = this.theme.borderRadius.radius.md;
    div.style.padding = this.theme.spacing.space[4];
    div.style.margin = `${this.theme.spacing.space[4]} 0`;

    // Kontrol: ganti tipe grafik
    const baris = document.createElement("div");
    baris.style.display = "flex";
    baris.style.flexWrap = "wrap";
    baris.style.gap = this.theme.spacing.space[2];
    baris.style.marginBottom = this.theme.spacing.space[3];

    const tipe = ["bar", "line", "pie", "area", "scatter"];
    tipe.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = t;
      btn.style.font = "inherit";
      btn.style.fontSize = this.theme.typography.fontSizes.caption;
      btn.style.padding = `${this.theme.spacing.space[1]} ${this.theme.spacing.space[3]}`;
      btn.style.borderRadius = this.theme.borderRadius.radius.sm;
      btn.style.cursor = "pointer";
      const aktif = block.chartType === t;
      btn.style.background = aktif ? "var(--primary-action)" : "transparent";
      btn.style.color = aktif ? "var(--primary-action-text)" : "var(--muted)";
      btn.style.border = `1px solid ${aktif ? "transparent" : "var(--border)"}`;
      btn.addEventListener("click", () => {
        this.updateFromControl(block.id, {
          chartType: t,
        } as Partial<ContentBlock>);
      });
      baris.appendChild(btn);
    });
    const unduh = this.tombolUnduhGambar("⬇ PNG", () =>
      eksporChartPng(block, `Grafik ${block.chartType}`),
    );
    baris.appendChild(unduh.btn);
    baris.appendChild(unduh.pesan);
    div.appendChild(baris);

    const svgNS = "http://www.w3.org/2000/svg";
    const W = 640;
    const H = 260;
    const pad = { top: 12, right: 12, bottom: 34, left: 40 };
    const lebar = W - pad.left - pad.right;
    const tinggi = H - pad.top - pad.bottom;

    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("role", "img");
    svg.setAttribute(
      "aria-label",
      `Grafik ${block.chartType}: ${labels.join(", ")}`,
    );

    const el = <T extends SVGElement>(tag: string): T =>
      document.createElementNS(svgNS, tag) as T;

    const teks = (
      x: number,
      y: number,
      isi: string,
      anchor = "middle",
    ): SVGTextElement => {
      const t = el<SVGTextElement>("text");
      t.setAttribute("x", String(x));
      t.setAttribute("y", String(y));
      t.setAttribute("text-anchor", anchor);
      t.setAttribute("font-size", "11");
      t.style.fill = "var(--muted)";
      t.textContent = isi;
      return t;
    };

    const kosong =
      labels.length === 0 || datasets.every((d) => (d.data ?? []).length === 0);

    if (kosong) {
      svg.appendChild(
        teks(W / 2, H / 2, "Belum ada data — isi label & nilai di bawah."),
      );
    } else if (block.chartType === "pie") {
      const nilai = datasets[0]?.data ?? [];
      const total = nilai.reduce((a, b) => a + Math.abs(b), 0) || 1;
      const cx = pad.left + lebar / 2;
      const cy = pad.top + tinggi / 2;
      const r = Math.min(lebar, tinggi) / 2 - 8;
      let sudut = -Math.PI / 2;
      nilai.forEach((v, i) => {
        const frac = Math.abs(v) / total;
        const akhir = sudut + frac * Math.PI * 2;
        const besar = frac >= 0.9999 ? 1 : frac;
        const path = el<SVGPathElement>("path");
        const x1 = cx + r * Math.cos(sudut);
        const y1 = cy + r * Math.sin(sudut);
        const x2 = cx + r * Math.cos(akhir);
        const y2 = cy + r * Math.sin(akhir);
        const large = besar > 0.5 ? 1 : 0;
        path.setAttribute(
          "d",
          `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`,
        );
        path.style.fill = this.palette(i);
        path.style.stroke = "var(--surface)";
        svg.appendChild(path);

        const mid = sudut + (akhir - sudut) / 2;
        const lx = cx + r * 0.68 * Math.cos(mid);
        const ly = cy + r * 0.68 * Math.sin(mid);
        const t = teks(
          lx,
          ly + 4,
          `${labels[i] ?? "?"} ${Math.round(frac * 100)}%`,
        );
        t.style.fill = "var(--primary-action-text)";
        t.style.fontWeight = "600";
        svg.appendChild(t);
        sudut = akhir;
      });
    } else {
      const semua = datasets.flatMap((d) => d.data ?? []);
      const maks = Math.max(...semua, 1);
      const min = Math.min(...semua, 0);
      const rentang = maks - min || 1;
      const y = (v: number) =>
        pad.top + tinggi - ((v - min) / rentang) * tinggi;

      // sumbu + grid
      for (let i = 0; i <= 4; i++) {
        const nilai = min + (rentang * i) / 4;
        const yy = y(nilai);
        const garis = el<SVGLineElement>("line");
        garis.setAttribute("x1", String(pad.left));
        garis.setAttribute("x2", String(W - pad.right));
        garis.setAttribute("y1", String(yy));
        garis.setAttribute("y2", String(yy));
        garis.style.stroke = "var(--border)";
        svg.appendChild(garis);
        svg.appendChild(
          teks(pad.left - 6, yy + 4, String(Math.round(nilai)), "end"),
        );
      }
      // sumbu x di garis dasar
      const dasar = el<SVGLineElement>("line");
      dasar.setAttribute("x1", String(pad.left));
      dasar.setAttribute("x2", String(W - pad.right));
      dasar.setAttribute("y1", String(pad.top + tinggi));
      dasar.setAttribute("y2", String(pad.top + tinggi));
      dasar.style.stroke = "var(--border)";
      svg.appendChild(dasar);

      const lebarSlot = lebar / labels.length;

      datasets.forEach((ds, di) => {
        const warna = ds.backgroundColor as string | undefined;
        const titik = (ds.data ?? []).map((v, i) => {
          const x = pad.left + lebarSlot * (i + 0.5);
          return { x, y: y(v), v };
        });
        if (!titik.length) return;

        if (block.chartType === "line" || block.chartType === "area") {
          if (block.chartType === "area") {
            const area = el<SVGPathElement>("path");
            area.setAttribute(
              "d",
              `M ${titik[0].x} ${pad.top + tinggi} ` +
                titik.map((p) => `L ${p.x} ${p.y}`).join(" ") +
                ` L ${titik[titik.length - 1].x} ${pad.top + tinggi} Z`,
            );
            area.style.fill = warna ?? this.palette(di);
            area.style.opacity = "0.18";
            svg.appendChild(area);
          }
          const poly = el<SVGPolylineElement>("polyline");
          poly.setAttribute(
            "points",
            titik.map((p) => `${p.x},${p.y}`).join(" "),
          );
          poly.style.fill = "none";
          poly.style.stroke = warna ?? this.palette(di);
          poly.style.strokeWidth = "2";
          svg.appendChild(poly);
          titik.forEach((p) => {
            const dot = el<SVGCircleElement>("circle");
            dot.setAttribute("cx", String(p.x));
            dot.setAttribute("cy", String(p.y));
            dot.setAttribute("r", "3");
            dot.style.fill = warna ?? this.palette(di);
            svg.appendChild(dot);
          });
        } else {
          // bar / scatter
          const lebarBar = Math.max(
            6,
            (lebarSlot * 0.7) / Math.max(datasets.length, 1),
          );
          titik.forEach((p) => {
            const rect = el<SVGRectElement>("rect");
            const tinggiBar = Math.max(1, pad.top + tinggi - p.y);
            rect.setAttribute("x", String(p.x - lebarBar / 2));
            rect.setAttribute("y", String(p.y));
            rect.setAttribute("width", String(lebarBar));
            rect.setAttribute("height", String(tinggiBar));
            rect.setAttribute("rx", "2");
            rect.style.fill = warna ?? this.palette(di);
            svg.appendChild(rect);
          });
        }
      });

      labels.forEach((label, i) => {
        svg.appendChild(teks(pad.left + lebarSlot * (i + 0.5), H - 12, label));
      });
    }

    div.appendChild(svg);

    // Legenda
    if (datasets.length > 1) {
      const leg = document.createElement("div");
      leg.style.display = "flex";
      leg.style.gap = this.theme.spacing.space[4];
      leg.style.flexWrap = "wrap";
      leg.style.marginTop = this.theme.spacing.space[2];
      datasets.forEach((ds, i) => {
        const item = document.createElement("span");
        item.style.display = "inline-flex";
        item.style.alignItems = "center";
        item.style.gap = this.theme.spacing.space[1];
        item.style.fontSize = this.theme.typography.fontSizes.caption;
        item.style.color = "var(--muted)";
        const swatch = document.createElement("span");
        swatch.style.width = "10px";
        swatch.style.height = "10px";
        swatch.style.borderRadius = "3px";
        swatch.style.background =
          (ds.backgroundColor as string) ?? this.palette(i);
        item.appendChild(swatch);
        item.appendChild(document.createTextNode(ds.label || `Seri ${i + 1}`));
        leg.appendChild(item);
      });
      div.appendChild(leg);
    }

    // Editor data: label + nilai per seri
    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `minmax(80px,1fr) repeat(${Math.max(
      datasets.length,
      1,
    )}, minmax(60px,1fr))`;
    grid.style.gap = this.theme.spacing.space[1];
    grid.style.marginTop = this.theme.spacing.space[3];
    grid.style.fontSize = this.theme.typography.fontSizes.caption;

    // `redraw` dipakai tombol ± baris; input ketikan biarkan senyap supaya
    // caret tidak hilang saat kanvas dirender ulang.
    const tulis = (
      data: {
        labels: string[];
        datasets: { label: string; data: number[] }[];
      },
      redraw = false,
    ) =>
      redraw
        ? this.updateFromControl(block.id, { data } as Partial<ContentBlock>)
        : this.updateBlockSilent(block.id, { data } as Partial<ContentBlock>);

    const head = document.createElement("div");
    head.style.color = "var(--faint)";
    head.textContent = "Label";
    head.style.gridColumn = "1";
    grid.appendChild(head);
    datasets.forEach((ds, di) => {
      const h = document.createElement("div");
      h.style.color = "var(--faint)";
      h.textContent = ds.label || `Seri ${di + 1}`;
      grid.appendChild(h);
    });

    labels.forEach((label, li) => {
      grid.appendChild(
        this.textInput(label, "label", (teks) => {
          const baru = [...labels];
          baru[li] = teks;
          tulis({ labels: baru, datasets: datasets.map((d) => ({ ...d })) });
        }),
      );
      datasets.forEach((ds, di) => {
        grid.appendChild(
          this.textInput(String(ds.data?.[li] ?? 0), "0", (nilai) => {
            const baru = datasets.map((d, i) => {
              if (i !== di) return { ...d };
              const arr = [...(d.data ?? [])];
              const n = Number(nilai.replace(",", "."));
              arr[li] = Number.isFinite(n) ? n : 0;
              return { ...d, data: arr };
            });
            tulis({ labels: [...labels], datasets: baru });
          }),
        );
      });
    });

    div.appendChild(grid);

    // Tambah / hapus baris data
    const kontrol = document.createElement("div");
    kontrol.style.display = "flex";
    kontrol.style.gap = this.theme.spacing.space[2];
    kontrol.style.marginTop = this.theme.spacing.space[2];
    const tambah = document.createElement("button");
    tambah.type = "button";
    tambah.textContent = "+ Baris";
    const hapus = document.createElement("button");
    hapus.type = "button";
    hapus.textContent = "− Baris";
    [tambah, hapus].forEach((b) => {
      b.style.font = "inherit";
      b.style.fontSize = this.theme.typography.fontSizes.caption;
      b.style.padding = `${this.theme.spacing.space[1]} ${this.theme.spacing.space[3]}`;
      b.style.background = "transparent";
      b.style.color = "var(--muted)";
      b.style.border = "1px solid var(--border)";
      b.style.borderRadius = this.theme.borderRadius.radius.sm;
      b.style.cursor = "pointer";
      kontrol.appendChild(b);
    });
    tambah.addEventListener("click", () =>
      tulis(
        {
          labels: [...labels, `Kategori ${labels.length + 1}`],
          datasets: datasets.map((d) => ({
            ...d,
            data: [...(d.data ?? []), 0],
          })),
        },
        true,
      ),
    );
    hapus.addEventListener("click", () =>
      tulis(
        {
          labels: labels.slice(0, -1),
          datasets: datasets.map((d) => ({
            ...d,
            data: (d.data ?? []).slice(0, -1),
          })),
        },
        true,
      ),
    );
    div.appendChild(kontrol);

    container.appendChild(div);
  }

  private renderDiagram(block: DiagramBlock, container: HTMLElement): void {
    const div = document.createElement("div");
    div.style.background = "var(--surface)";
    div.style.border = "1px solid var(--border)";
    div.style.borderRadius = this.theme.borderRadius.radius.md;
    div.style.padding = this.theme.spacing.space[4];
    div.style.margin = `${this.theme.spacing.space[4]} 0`;

    // Kontrol: unduh hasil render mermaid sebagai SVG
    const baris = document.createElement("div");
    baris.style.display = "flex";
    baris.style.flexWrap = "wrap";
    baris.style.alignItems = "center";
    baris.style.gap = this.theme.spacing.space[2];
    baris.style.marginBottom = this.theme.spacing.space[3];

    const unduh = this.tombolUnduhGambar("⬇ SVG", () =>
      eksporDiagramSvg(block, `Diagram ${block.diagramType ?? "mermaid"}`),
    );
    baris.appendChild(unduh.btn);
    baris.appendChild(unduh.pesan);
    div.appendChild(baris);

    const sumber = document.createElement("textarea");
    sumber.value = block.source ?? "";
    sumber.rows = 4;
    sumber.spellcheck = false;
    sumber.style.width = "100%";
    sumber.style.resize = "vertical";
    sumber.style.fontFamily = this.theme.typography.fontMono;
    sumber.style.fontSize = this.theme.typography.fontSizes.caption;
    sumber.style.color = "var(--text)";
    sumber.style.background = "var(--bg)";
    sumber.style.border = "1px solid var(--border)";
    sumber.style.borderRadius = this.theme.borderRadius.radius.sm;
    sumber.style.padding = this.theme.spacing.space[3];
    sumber.addEventListener("focus", () => this.beginEdit());
    sumber.addEventListener("blur", () => this.endEdit());
    sumber.addEventListener("input", () =>
      this.updateBlockSilent(block.id, {
        source: sumber.value,
      } as Partial<ContentBlock>),
    );
    div.appendChild(sumber);

    const hasil = document.createElement("div");
    hasil.style.marginTop = this.theme.spacing.space[3];
    hasil.style.overflowX = "auto";
    hasil.textContent = "Merender diagram…";
    hasil.style.color = "var(--muted)";
    hasil.style.fontSize = this.theme.typography.fontSizes.caption;
    div.appendChild(hasil);

    container.appendChild(div);

    if (block.diagramType !== "mermaid") {
      hasil.textContent = `Tipe ${block.diagramType} belum dirender di kanvas — ekspor .mmd tetap tersedia.`;
      return;
    }

    // Mermaid dimuat malas: tidak masuk bundle utama.
    const kode = block.source ?? "";
    const id = `mmd-${block.id}-${Math.random().toString(36).slice(2, 7)}`;
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme:
            document.documentElement.getAttribute("data-theme") === "light"
              ? "default"
              : "dark",
        });
        const { svg } = await mermaid.render(id, kode);
        hasil.innerHTML = svg;
        const gambar = hasil.querySelector("svg");
        if (gambar) {
          gambar.style.maxWidth = "100%";
          gambar.style.height = "auto";
        }
      })
      .catch((err: unknown) => {
        hasil.textContent = `Gagal merender: ${
          err instanceof Error ? err.message : String(err)
        }`;
      });
  }

  private renderDivider(_block: DividerBlock, container: HTMLElement): void {
    const div = document.createElement("div");
    div.style.height = "1px";
    div.style.background = "var(--border)";
    div.style.border = "none";
    div.style.margin = `${this.theme.spacing.space[5]} 0`;
    container.appendChild(div);
  }

  // Text formatting helpers
  applyFormatting(text: string, formatting: TextFormatting): string {
    let result = text;

    if (formatting.bold) result = `**${result}**`;
    if (formatting.italic) result = `*${result}*`;
    if (formatting.underline) result = `<u>${result}</u>`;
    if (formatting.strikethrough) result = `~~${result}~~`;
    if (formatting.code) result = `\`${result}\``;
    if (formatting.link) result = `[${result}](${formatting.link})`;

    return result;
  }

  // Block operations
  duplicateBlock(id: string): ContentBlock | null {
    const block = this.state.blocks.find((b) => b.id === id);
    if (!block) return null;

    const duplicated = { ...block, id: `${block.id}-copy-${Date.now()}` };
    this.addBlock(duplicated);
    return duplicated;
  }

  moveBlock(id: string, direction: "up" | "down"): boolean {
    const index = this.state.blocks.findIndex((b) => b.id === id);
    if (
      index === -1 ||
      (direction === "up" && index === 0) ||
      (direction === "down" && index >= this.state.blocks.length - 1)
    ) {
      return false;
    }

    this.saveUndoState();
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const movedBlock = this.state.blocks[index];
    const targetBlock = this.state.blocks[newIndex];

    this.state.blocks[index] = targetBlock;
    this.state.blocks[newIndex] = movedBlock;

    this.onBlockChange?.(this.state.blocks);
    return true;
  }

  // Clipboard operations
  copyBlocks(ids: string[]): ContentBlock[] {
    return ids
      .map((id) => this.state.blocks.find((b) => b.id === id) || null)
      .filter(Boolean) as ContentBlock[];
  }

  pasteBlocks(atIndex: number, blocks: ContentBlock[]): void {
    this.saveUndoState();
    const newBlocks = blocks.map((block) => ({
      ...block,
      id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }));
    this.state.blocks.splice(atIndex, 0, ...newBlocks);
    this.onBlockChange?.(this.state.blocks);
  }

  exportContent(): ContentBlock[] {
    return this.state.blocks.map((block) => ({
      ...block,
      id: block.id || `block-${Date.now()}`,
    }));
  }
}

// Export default instance
export const editor = new DocumentEditor();

export default DocumentEditor;
