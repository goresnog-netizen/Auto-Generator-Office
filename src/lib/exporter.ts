/**
 * Ekspor browser-native NitZ-909.
 * Batas tegas: generator di `src/generators/` ditulis untuk Node
 * (paket `docx`/`exceljs` tak terpasang + impor builtin `fs`/`stream`),
 * sehingga UI browser TIDAK mengimpornya. Semua fungsi di sini berjalan
 * murni di browser tanpa dependensi server.
 */
import type { ContentBlock } from "../types";
import { TEMA_BAWAAN, getTemaPpt, susunDeckPpt } from "./ppt-desain";
import { renderSemuaDiagram } from "./mermaid-gambar";

export type FormatEkspor = "pdf" | "word" | "pptx" | "xlsx" | "diagram";

export interface HasilEkspor {
  pesan: string;
}

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function unduhBlob(blob: Blob, namaFile: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function teksBlok(b: ContentBlock): string {
  switch (b.type) {
    case "heading":
    case "paragraph":
      return b.text;
    case "list":
      return b.items.map((it) => `• ${it.text}`).join("\n");
    case "table":
      return [b.headers.join(" | "), ...b.rows.map((r) => r.join(" | "))].join(
        "\n",
      );
    case "code":
      return b.code;
    case "image":
      return `[Gambar: ${b.alt || "tanpa keterangan"}]`;
    case "chart": {
      const isi = b.data.datasets
        .map((d) => `${d.label}: ${d.data.join(", ")}`)
        .join(" | ");
      return `[Grafik ${b.chartType} — ${b.data.labels.join(", ")}] ${isi}`;
    }
    case "diagram":
      return b.source;
    case "divider":
      return "────────";
    default:
      return "";
  }
}

/** Teks rujukan berkas sumber untuk dicantumkan di hasil ekspor. */
function barisSumber(sumber: string[]): string {
  return sumber.length === 0 ? "" : `Sumber Dokumen: ${sumber.join("; ")}`;
}

async function eksporPdf(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
): Promise<HasilEkspor> {
  const isi = blocks
    .map((b) => {
      switch (b.type) {
        case "heading": {
          const lv = Math.min(Math.max(b.level, 1), 6);
          return `<h${lv}>${esc(b.text)}</h${lv}>`;
        }
        case "paragraph":
          return `<p>${esc(b.text)}</p>`;
        case "list": {
          const tag = b.ordered ? "ol" : "ul";
          return `<${tag}>${b.items.map((it) => `<li>${esc(it.text)}</li>`).join("")}</${tag}>`;
        }
        case "table":
          return `<table><thead><tr>${b.headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        case "code":
          return `<pre>${esc(b.code)}</pre>`;
        case "image": {
          const src = b.src?.trim();
          if (
            src &&
            (src.startsWith("http://") ||
              src.startsWith("https://") ||
              src.startsWith("data:image/"))
          ) {
            return `<figure style="text-align:center;margin:16px 0;"><img src="${esc(src)}" alt="${esc(b.alt || "gambar")}" style="max-width:100%;height:auto;" />${b.caption ? `<figcaption style="font-size:12px;color:#666;margin-top:4px;">${esc(b.caption)}</figcaption>` : ""}</figure>`;
          }
          return `<p><em>[Gambar: ${esc(b.alt || "tanpa keterangan")}]</em></p>`;
        }
        case "chart": {
          // Tabel data agar skala jujur dan bisa diverifikasi (diagram-design #11)
          const kepala = ["Label", ...b.data.datasets.map((d) => d.label)];
          const baris = b.data.labels.map((label, i) => [
            label,
            ...b.data.datasets.map((d) => String(d.data[i] ?? "")),
          ]);
          return `<p><strong>Grafik ${esc(b.chartType)}</strong></p><table><thead><tr>${kepala.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${baris.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        }
        case "diagram":
          return `<pre>${esc(b.source)}</pre>`;
        case "divider":
          return `<hr/>`;
        default:
          return "";
      }
    })
    .join("\n");

  const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>body{font-family:Georgia,serif;max-width:700px;margin:40px auto;padding:0 16px;color:#111;line-height:1.6}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #999;padding:6px 8px;text-align:left}pre{background:#f4f4f4;padding:12px;overflow:auto}hr{margin:24px 0}</style></head><body><h1>${esc(judul)}</h1>${isi}${sumber.length > 0 ? `<hr/><p><strong>Sumber Dokumen:</strong> ${sumber.map(esc).join("; ")}</p>` : ""}</body></html>`;

  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    throw new Error("Browser memblokir dialog cetak.");
  }
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  window.setTimeout(() => frame.remove(), 1000);
  return {
    pesan: "Dialog cetak dibuka — pilih “Save as PDF” untuk menyimpan PDF.",
  };
}

async function eksporWord(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
): Promise<HasilEkspor> {
  let docx: typeof import("docx");
  try {
    docx = await import("docx");
  } catch {
    throw new Error("Pustaka “docx” belum terpasang. Jalankan: pnpm add docx");
  }
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
  } = docx;
  const levelMap = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];
  const anak: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] =
    [new Paragraph({ text: judul, heading: HeadingLevel.TITLE })];
  const sel = (teks: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun(teks)] })],
    });
  for (const b of blocks) {
    if (b.type === "heading") {
      anak.push(
        new Paragraph({ text: b.text, heading: levelMap[b.level - 1] }),
      );
    } else if (b.type === "paragraph") {
      anak.push(new Paragraph({ children: [new TextRun(b.text)] }));
    } else if (b.type === "list") {
      b.items.forEach((it, i) =>
        anak.push(
          new Paragraph(
            b.ordered
              ? { text: `${i + 1}. ${it.text}` }
              : { text: it.text, bullet: { level: 0 } },
          ),
        ),
      );
    } else if (b.type === "table") {
      anak.push(
        new Table({
          rows: [
            new TableRow({ children: b.headers.map(sel) }),
            ...b.rows.map((r) => new TableRow({ children: r.map(sel) })),
          ],
        }),
      );
    } else if (b.type === "chart") {
      // Data grafik ditulis sebagai tabel agar tetap bisa diolah di Excel
      anak.push(new Paragraph({ text: `Grafik ${b.chartType}` }));
      anak.push(
        new Table({
          rows: [
            new TableRow({
              children: ["Label", ...b.data.datasets.map((d) => d.label)].map(
                sel,
              ),
            }),
            ...b.data.labels.map(
              (label, i) =>
                new TableRow({
                  children: [
                    label,
                    ...b.data.datasets.map((d) => String(d.data[i] ?? "")),
                  ].map(sel),
                }),
            ),
          ],
        }),
      );
    } else if (b.type === "code") {
      b.code.split("\n").forEach((line) =>
        anak.push(
          new Paragraph({
            children: [new TextRun({ text: line, font: "Consolas" })],
          }),
        ),
      );
    } else {
      anak.push(new Paragraph({ text: teksBlok(b) }));
    }
  }
  if (sumber.length > 0) {
    anak.push(new Paragraph({ text: barisSumber(sumber) }));
  }
  const doc = new Document({ sections: [{ children: anak }] });
  const blob = await Packer.toBlob(doc);
  unduhBlob(blob, `${judul}.docx`);
  return { pesan: "Berkas DOCX terunduh — bisa dibuka di Word." };
}

async function eksporExcel(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
): Promise<HasilEkspor> {
  let ExcelJS: typeof import("exceljs");
  try {
    ExcelJS = await import("exceljs");
  } catch {
    throw new Error(
      "Pustaka “exceljs” belum terpasang. Jalankan: pnpm add exceljs",
    );
  }
  const wb = new ExcelJS.Workbook();
  wb.creator = "NitZ-909";
  const ws = wb.addWorksheet("Data");
  ws.addRow([judul]);
  ws.addRow([]);
  for (const b of blocks) {
    if (b.type === "table") {
      ws.addRow(b.headers);
      b.rows.forEach((r) => ws.addRow(r));
      ws.addRow([]);
    } else if (b.type === "list") {
      b.items.forEach((it, i) =>
        ws.addRow([b.ordered ? `${i + 1}. ${it.text}` : `• ${it.text}`]),
      );
    } else if (b.type === "chart") {
      ws.addRow([`Grafik ${b.chartType}`]);
      ws.addRow(["Label", ...b.data.datasets.map((d) => d.label)]);
      b.data.labels.forEach((label, i) =>
        ws.addRow([label, ...b.data.datasets.map((d) => d.data[i] ?? "")]),
      );
      ws.addRow([]);
    } else {
      ws.addRow([teksBlok(b)]);
    }
  }
  if (sumber.length > 0) {
    ws.addRow([]);
    ws.addRow(["Sumber Dokumen"]);
    sumber.forEach((s) => ws.addRow([s]));
  }
  const buf = await wb.xlsx.writeBuffer();
  unduhBlob(
    new Blob([buf as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${judul}.xlsx`,
  );
  return { pesan: "Berkas XLSX terunduh — bisa dibuka di Excel." };
}

/** Tanggal hari ini dalam format Indonesia: "6 November 2026". */
function tanggalIndonesia(d: Date = new Date()): string {
  const bulan = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

async function eksporPpt(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
  temaId?: string,
  onProgress?: (message: string) => void,
): Promise<HasilEkspor> {
  let PptxGenJS: typeof import("pptxgenjs").default;
  try {
    PptxGenJS = (await import("pptxgenjs")).default;
  } catch {
    throw new Error(
      "Pustaka “pptxgenjs” belum terpasang. Jalankan: pnpm add pptxgenjs",
    );
  }

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "NitZ-909";
  pptx.title = judul;
  pptx.company = "NitZ-909";

  // ===== Tema: penanda "TEMA-MILITER" pada caption/alt foto tetap dihormati,
  // supaya dokumen lama tidak berubah rupa saat diekspor ulang.
  const militer = blocks.some(
    (b) =>
      b.type === "image" &&
      /TEMA-MILITER/i.test(`${b.caption ?? ""} ${b.alt ?? ""}`),
  );
  const tema = getTemaPpt(temaId || (militer ? "olive" : TEMA_BAWAAN));

  // Ambil gambar remote jadi data-URL (bila offline → null, ekspor tetap jalan).
  const urlKeDataUrl = async (src: string): Promise<string | null> => {
    const s = (src || "").trim();
    if (s.startsWith("data:image/")) return s;
    if (!/^https?:\/\//i.test(s)) return null;
    try {
      const res = await fetch(s);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("gagal baca gambar"));
        fr.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // Gambar remote diunduh SEKALI di sini, lalu bloknya diganti versi data-URL.
  // Tanpa langkah ini, gambar `https://…` tidak bisa disisipkan pptxgenjs dan
  // hanya muncul sebagai keterangan — perilaku yang sudah ada di jalur lama.
  const blocksSiap: ContentBlock[] = [];
  for (const b of blocks) {
    if (
      b.type === "image" &&
      !/^data:image\//i.test(b.src) &&
      /^https?:\/\//i.test(b.src)
    ) {
      const data = await urlKeDataUrl(b.src);
      blocksSiap.push(data ? { ...b, src: data } : b);
    } else {
      blocksSiap.push(b);
    }
  }

  // Sampul berfoto hanya untuk tema gelap: judul putih di atas foto tetap
  // terbaca, sedangkan pada tema terang hasilnya justru berlawanan.
  let gambarSampul: string | undefined;
  const hero = blocksSiap.find((b) => b.type === "image");
  if (tema.mode === "gelap" && hero?.type === "image") {
    const data = await urlKeDataUrl(hero.src);
    if (data) gambarSampul = data;
  }

  // Diagram Mermaid dirender lebih dulu: hasilnya PNG yang disisipkan ke
  // slide. Bila gagal (diagram tidak sah / Mermaid tak termuat), peta kosong
  // dan `susunDeckPpt` memakai fallback proses/teks.
  const jumlahDiagram = blocksSiap.filter(
    (b) => b.type === "diagram" && b.diagramType === "mermaid",
  ).length;
  if (jumlahDiagram > 0) {
    onProgress?.(
      `Merender ${jumlahDiagram} diagram Mermaid… (langkah ini butuh beberapa detik)`,
    );
  }
  const gambarDiagram = await renderSemuaDiagram(blocksSiap, tema);
  if (jumlahDiagram > 0) {
    const jadi = Object.keys(gambarDiagram).length;
    onProgress?.(
      jadi === jumlahDiagram
        ? `${jadi} diagram siap — menyusun slide…`
        : `${jadi} dari ${jumlahDiagram} diagram berhasil dirender, sisanya memakai fallback…`,
    );
  }

  const stat = susunDeckPpt(pptx, {
    judul,
    blocks: blocksSiap,
    sumber,
    tema,
    ...(gambarSampul ? { gambarSampul } : {}),
    gambarDiagram,
    meta: {
      organisasi: militer ? "DATA UJI · BUKAN DOKUMEN OPERASI NYATA" : "NitZ-909",
      tanggal: tanggalIndonesia(),
    },
  });

  await pptx.writeFile({ fileName: `${judul}.pptx` });

  const rincian = [
    stat.kpi ? `${stat.kpi} slide KPI` : "",
    stat.tabel ? `${stat.tabel} tabel` : "",
    stat.grafik ? `${stat.grafik} grafik` : "",
    stat.proses ? `${stat.proses} alur proses` : "",
    stat.diagram ? `${stat.diagram} diagram` : "",
    stat.gambar ? `${stat.gambar} gambar` : "",
  ]
    .filter(Boolean)
    .join(", ");

  return {
    pesan:
      `Berkas PPTX terunduh — tema ${tema.nama}, ${stat.slideCount} slide` +
      (rincian ? ` (${rincian})` : "") +
      ". Tabel dan grafik native, bisa diubah langsung di PowerPoint.",
  };
}

async function eksporDiagram(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
): Promise<HasilEkspor> {
  const diagrams = blocks.filter((b) => b.type === "diagram");
  if (diagrams.length === 0) {
    throw new Error(
      "Tidak ada blok Diagram di dokumen. Tambah blok Diagram dulu.",
    );
  }
  const kepala =
    sumber.length > 0 ? `%% Sumber Dokumen: ${sumber.join("; ")}\n\n` : "";
  const isi =
    kepala +
    diagrams.map((b) => `%% ${b.diagramType}\n${b.source}`).join("\n\n");
  unduhBlob(
    new Blob([isi], { type: "text/plain;charset=utf-8" }),
    `${judul}.mmd`,
  );
  return {
    pesan: `${diagrams.length} diagram terunduh (.mmd) — tempel di mermaid.live untuk melihat gambarnya.`,
  };
}

/** Judul bisa berisi karakter terlarang Windows (`/ \ : * ? " < > |`). */
export function bersihkanNamaBerkas(judul: string): string {
  const bersih = judul
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/, "")
    .slice(0, 120)
    .trim();
  return bersih || "Dokumen NitZ-909";
}

/** Opsi tambahan ekspor (saat ini hanya tema presentasi). */
export interface OpsiEkspor {
  /** Id tema dari `TEMA_PPT`; kosong = tema bawaan. */
  temaPpt?: string;
}

/**
 * Ekspor dokumen dari kanvas ke berkas unduhan.
 * `modelLabel` dicatat untuk konteks; pembuatan konten AI menyusul.
 */
export async function eksporDokumen(
  format: FormatEkspor,
  judul: string,
  blocks: ContentBlock[],
  _modelLabel: string,
  sumber: string[] = [],
  onProgress?: (message: string) => void,
  opsi: OpsiEkspor = {},
): Promise<HasilEkspor> {
  const nama = bersihkanNamaBerkas(judul);
  onProgress?.("Menyiapkan berkas...");
  switch (format) {
    case "pdf":
      onProgress?.("Membuat PDF...");
      return eksporPdf(nama, blocks, sumber);
    case "word":
      onProgress?.("Membuat dokumen Word...");
      return eksporWord(nama, blocks, sumber);
    case "pptx":
      onProgress?.("Membuat presentasi PowerPoint...");
      return eksporPpt(nama, blocks, sumber, opsi.temaPpt, onProgress);
    case "xlsx":
      onProgress?.("Membuat spreadsheet Excel...");
      return eksporExcel(nama, blocks, sumber);
    case "diagram":
      onProgress?.("Membuat diagram SVG...");
      return eksporDiagram(nama, blocks, sumber);
  }
}

/**
 * Cari SVG yang sudah dirender kanvas di dalam blok `[data-block-id]`.
 * Dicari lewat `dataset` (bukan selector CSS) agar id blok apa pun aman.
 */
function cariSvgBlok(blokId: string): SVGSVGElement | null {
  const pembungkus = Array.from(
    document.querySelectorAll<HTMLElement>("[data-block-id]"),
  ).find((el) => el.dataset.blockId === blokId);
  return pembungkus ? pembungkus.querySelector("svg") : null;
}

function svgKeBlob(svg: SVGSVGElement): Blob {
  const salinan = svg.cloneNode(true) as SVGSVGElement;
  salinan.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  salinan.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  if (!salinan.getAttribute("width") || !salinan.getAttribute("height")) {
    const box = svg.getBoundingClientRect();
    salinan.setAttribute("width", String(Math.round(box.width) || 640));
    salinan.setAttribute("height", String(Math.round(box.height) || 260));
  }
  const teks = new XMLSerializer().serializeToString(salinan);
  return new Blob([teks], { type: "image/svg+xml;charset=utf-8" });
}

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("SVG gagal dimuat menjadi gambar di browser ini."));
    img.src = url;
  });
}

function kanvasKeBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Kanvas tidak bisa diubah menjadi PNG.")),
      "image/png",
    );
  });
}

function warnaPermukaan(): string {
  const nilai = getComputedStyle(document.documentElement)
    .getPropertyValue("--surface")
    .trim();
  return nilai || "#222423";
}

/** Unduh grafik blok kanvas sebagai PNG 2x (latar mengikuti tema). */
export async function eksporChartPng(
  blok: ContentBlock,
  judul: string,
): Promise<HasilEkspor> {
  if (blok.type !== "chart") throw new Error("Blok ini bukan grafik.");
  const svg = cariSvgBlok(blok.id);
  if (!svg)
    throw new Error(
      "Grafik belum dirender di kanvas — buka blok dulu lalu coba lagi.",
    );
  const url = URL.createObjectURL(svgKeBlob(svg));
  try {
    const img = await muatGambar(url);
    const skala = 2;
    const lebar = Math.max(1, Math.round((img.width || 640) * skala));
    const tinggi = Math.max(1, Math.round((img.height || 260) * skala));
    const canvas = document.createElement("canvas");
    canvas.width = lebar;
    canvas.height = tinggi;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Kanvas 2D tidak tersedia di browser ini.");
    ctx.fillStyle = warnaPermukaan();
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(img, 0, 0, lebar, tinggi);
    unduhBlob(
      await kanvasKeBlob(canvas),
      `${bersihkanNamaBerkas(judul)}-grafik.png`,
    );
    return { pesan: "Grafik terunduh sebagai PNG (2x)." };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Unduh diagram blok kanvas sebagai SVG (vektor, tajam di semua ukuran). */
export function eksporDiagramSvg(
  blok: ContentBlock,
  judul: string,
): HasilEkspor {
  if (blok.type !== "diagram") throw new Error("Blok ini bukan diagram.");
  const svg = cariSvgBlok(blok.id);
  if (!svg)
    throw new Error(
      "Diagram belum selesai dirender — tunggu gambar muncul lalu coba lagi.",
    );
  unduhBlob(svgKeBlob(svg), `${bersihkanNamaBerkas(judul)}-diagram.svg`);
  return { pesan: "Diagram terunduh sebagai SVG." };
}
