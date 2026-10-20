/**
 * Ekspor browser-native NitZ-909.
 * Batas tegas: generator di `src/generators/` ditulis untuk Node
 * (paket `docx`/`exceljs` tak terpasang + impor builtin `fs`/`stream`),
 * sehingga UI browser TIDAK mengimpornya. Semua fungsi di sini berjalan
 * murni di browser tanpa dependensi server.
 */
import type { ContentBlock } from "../types";

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

async function eksporPpt(
  judul: string,
  blocks: ContentBlock[],
  sumber: string[],
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
  // ===== TEMA: deteksi otomatis dari penanda "TEMA-MILITER" pada caption/alt foto.
  // Palet militer: latar hijau olive gelap + aksen emas (bukan merek instansi mana pun).
  const militer = blocks.some(
    (b) =>
      b.type === "image" &&
      /TEMA-MILITER/i.test(`${b.caption ?? ""} ${b.alt ?? ""}`),
  );
  const WARNA_UTAMA = militer ? "C9A227" : "82966F";
  const WARNA_TEKS = militer ? "F1EEE4" : "1C1D1C";
  const WARNA_ABU = militer ? "A7B08F" : "6B7280";
  const BG_SLIDE = militer ? "232B1E" : "FFFFFF";
  try {
    pptx.defineSlideMaster({
      title: "NITZ_COVER",
      background: { color: BG_SLIDE },
      objects: [
        { rect: { x: 0, y: 0, w: "100%", h: 0.28, fill: { color: WARNA_UTAMA } } },
        { text: { text: militer ? "DATA UJI · KLASIFIKASI: CONTOH (BUKAN DOKUMEN OPERASI NYATA)" : "NitZ-909 · DATA UJI (sintetis)", options: { x: 0.5, y: 6.85, w: 12.33, h: 0.4, fontSize: 9, color: WARNA_ABU } } },
      ],
      slideNumber: { x: 12.4, y: 6.85, w: 0.5, h: 0.4, fontSize: 9, color: WARNA_ABU },
    });
    pptx.defineSlideMaster({
      title: "NITZ_ISI",
      background: { color: BG_SLIDE },
      objects: [
        { rect: { x: 0, y: 0, w: "100%", h: 0.12, fill: { color: WARNA_UTAMA } } },
        { text: { text: judul, options: { x: 0.5, y: 6.9, w: 10, h: 0.35, fontSize: 9, color: WARNA_ABU } } },
      ],
      slideNumber: { x: 12.4, y: 6.9, w: 0.5, h: 0.35, fontSize: 9, color: WARNA_ABU },
    });
  } catch {
    /* master opsional */
  }
  const masterCover = "NITZ_COVER";
  const masterIsi = "NITZ_ISI";
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
  const sampul = pptx.addSlide({ masterName: masterCover });
  const hero = blocks.find((b) => b.type === "image");
  if (militer && hero?.type === "image") {
    // Latar sampul full-bleed + overlay gelap agar judul spektakuler tapi tetap terbaca.
    const data = await urlKeDataUrl(hero.src);
    if (data) {
      sampul.background = { data };
      sampul.addShape("rect", { x: 0, y: 0, w: "100%", h: "100%", fill: { color: "0F140B", transparency: 42 } });
      sampul.addShape("rect", { x: 0, y: 5.4, w: "100%", h: 2.1, fill: { color: "0F140B", transparency: 25 } });
    }
  }
  const subSampul = blocks.find((b) => b.type === "paragraph");
  sampul.addText(judul, { x: 0.7, y: militer ? 4.6 : 1.6, w: 11.9, h: 1.4, fontSize: 40, bold: true, color: militer ? "FFFFFF" : WARNA_TEKS, align: "left" });
  sampul.addShape("line", { x: 0.7, y: militer ? 5.85 : 3.15, w: 2.4, h: 0, line: { color: WARNA_UTAMA, width: 4 } });
  if (subSampul?.type === "paragraph") {
    sampul.addText(subSampul.text, { x: 0.7, y: militer ? 6.0 : 3.35, w: 11.5, h: 0.8, fontSize: militer ? 12 : 14, color: militer ? "E6E1CF" : WARNA_ABU });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let slide: any = null;
  let poin: string[] = [];
  const commit = () => {
    if (slide && poin.length > 0) {
      slide.addText(
        poin.slice(0, 6).map((t) => ({
          text: t,
          options: { fontSize: 14, bullet: { code: "2022" }, color: WARNA_TEKS },
        })),
        { x: 0.6, y: 1.5, w: 12.13, h: 4.6 },
      );
      poin = [];
    }
  };
  const judulSlide = (teks: string) => {
    slide.addText(teks, { x: 0.6, y: 0.35, w: 12.13, h: 0.8, fontSize: 28, bold: true, color: WARNA_TEKS });
    slide.addShape("line", { x: 0.6, y: 1.15, w: 1.4, h: 0, line: { color: WARNA_UTAMA, width: 3 } });
  };
  const barisTabel = (kepala: string[], isi: string[][]) => {
    if (!militer) return [kepala, ...isi];
    const head = kepala.map((h) => ({ text: h, options: { bold: true, color: "232B1E", fill: { color: WARNA_UTAMA }, fontSize: 12 } }));
    const body = isi.map((r, i) => r.map((c) => ({ text: c, options: { fontSize: 11, color: WARNA_TEKS, fill: { color: i % 2 === 0 ? "2A3322" : "232B1E" } } })));
    return [head, ...body];
  };
  const opsiChart = militer
    ? {
        x: 0.6, y: 1.5, w: 12.13, h: 4.4,
        chartColors: ["C9A227", "8A9A5B", "E8E2D0", "5C6B3C", "F4F1E6"],
        showLegend: true, legendPos: "b", legendColor: "F1EEE4",
        catAxisLabelColor: "D8D3C0", valAxisLabelColor: "D8D3C0",
        catAxisLineColor: "5C6B3C", valAxisLineColor: "5C6B3C",
        valGridLine: { color: "3A452F", style: "solid" as const, size: 0.5 },
      }
    : { x: 0.6, y: 1.5, w: 12.13, h: 4.4 };
  for (const b of blocks) {
    if (b.type === "heading" && b.level <= 2) {
      if (b.level === 1 && b.text.trim() === judul.trim() && !slide) continue;
      commit();
      slide = pptx.addSlide({ masterName: masterIsi });
      judulSlide(b.text);
    } else if (!slide) {
      slide = pptx.addSlide({ masterName: masterIsi });
      judulSlide(judul);
      poin.push(teksBlok(b));
    } else if (b.type === "table") {
      commit();
      try {
        slide.addTable(barisTabel(b.headers, b.rows), { x: 0.6, y: 1.5, w: 12.13, border: militer ? { pt: 0.5, color: "5C6B3C" } : { pt: 0.5, color: "D9E2D2" } });
      } catch {
        slide.addTable([b.headers, ...b.rows], { x: 0.6, y: 1.5, w: 12.13 });
      }
    } else if (b.type === "chart") {
      // Grafik NATIVE (bukan gambar) ala PPT Master: bisa diklik & diubah di PowerPoint
      commit();
      // Tipe grafik harus huruf kecil: pptxgenjs mencocokkan `CHART_TYPE`
      // secara case-sensitive, dan tipe huruf besar menghasilkan bingkai
      // grafik kosong tanpa seri (tidak melempar error, jadi try/catch di
      // bawah tidak pernah menangkapnya).
      const tipe =
        b.chartType === "bar" ||
        b.chartType === "line" ||
        b.chartType === "pie" ||
        b.chartType === "area" ||
        b.chartType === "scatter"
          ? b.chartType
          : "bar";
      try {
        slide.addChart(
          tipe,
          b.data.datasets.map((d) => ({
            name: d.label,
            labels: b.data.labels,
            values: d.data,
          })),
          opsiChart,
        );
      } catch {
        slide.addText(teksBlok(b), { x: 0.6, y: 1.5, w: 12.13, h: 1 });
      }
    } else if (b.type === "image") {
      // Foto tengah slide: tampil penuh + keterangan sumber/lisensi.
      commit();
      slide = pptx.addSlide({ masterName: masterIsi });
      const data = await urlKeDataUrl(b.src);
      if (data) {
        slide.addImage({ data, x: 0.6, y: 1.35, w: 12.13, h: 4.5, sizing: { type: "contain", w: 12.13, h: 4.5 } });
        slide.addText(b.caption || b.alt || "", { x: 0.6, y: 5.95, w: 12.13, h: 0.5, fontSize: 10, italic: true, color: WARNA_ABU, align: "center" });
      } else {
        poin.push(teksBlok(b));
      }
    } else {
      poin.push(teksBlok(b));
    }
  }
  commit();
  if (sumber.length > 0) {
    const sSlide = pptx.addSlide({ masterName: masterIsi });
    sSlide.addText("Sumber Dokumen", { x: 0.6, y: 0.35, w: 12.13, h: 0.8, fontSize: 28, bold: true, color: WARNA_TEKS });
    sSlide.addText(sumber.join("\n"), { x: 0.6, y: 1.5, w: 12.13, h: 4.5, fontSize: 12, color: WARNA_TEKS });
  }
  const tutup = pptx.addSlide({ masterName: masterCover });
  tutup.addText("Terima kasih", { x: 0.7, y: 2.2, w: 12.13, h: 1, fontSize: 40, bold: true, color: militer ? "FFFFFF" : WARNA_TEKS });
  tutup.addShape("line", { x: 0.7, y: 3.35, w: 2.4, h: 0, line: { color: WARNA_UTAMA, width: 4 } });
  tutup.addText(
    militer
      ? "Tindak lanjut: laksanakan rekomendasi sesuai tenggat — laporan DATA UJI, bukan dokumen operasi nyata."
      : "Tindak lanjut: setujui tenggat susulan + tunjuk petugas pengganti.",
    { x: 0.7, y: 3.6, w: 11.5, h: 0.8, fontSize: 13, color: militer ? "E6E1CF" : WARNA_ABU },
  );
  await pptx.writeFile({ fileName: `${judul}.pptx` });
  return { pesan: militer ? "Berkas PPTX militer terunduh — tema olive-emas, sampul foto full-bleed, tabel & grafik native." : "Berkas PPTX terunduh — master & layout wide bisa dibuka di PowerPoint." };
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
      return eksporPpt(nama, blocks, sumber);
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
