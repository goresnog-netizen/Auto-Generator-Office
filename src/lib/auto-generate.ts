/**
 * Auto-generate — inti niche NitZ-909.
 *
 * Berbeda dengan "Draft AI" (yang menulis ulang dokumen yang sudah ada),
 * modul ini menghasilkan **dokumen dari nol** hanya dari satu prompt.
 *
 * Yang membedakan:
 *  1. Skema blok yang lengkap — AI boleh mengembalikan tabel, grafik, dan
 *     diagram, bukan hanya heading/paragraph/list. Ini yang membuat hasil
 *     auto-generate bisa langsung jadi deck DeckCraft (tabel & grafik native).
 *  2. Validasi ketat per blok — blok cacat dibuang, bukan membuat crash.
 *  3. Normalisasi — level heading, panjang teks, angka, dan label grafik
 *     dirapikan agar deck yang dihasilkan benar-benar rapi.
 *  4. Opsi "gaya" — prompt, gaya, dan persona bisa mengubah karakter
 *     dokumen yang dihasilkan.
 */
import type {
  ChartBlock,
  ContentBlock,
  DiagramBlock,
  ListBlock,
  ListItem,
  TableBlock,
} from "../types";
import { generateCompletion, type ProviderAI } from "./ai";
import { getPersona, type PersonaId } from "../data/personas";

/**
 * `Omit` bawaan tidak berlaku untuk union: ia hanya melompat properti dari
 * union itu sendiri, bukan dari tiap anggotanya. Karena `ContentBlock` adalah
 * union, `Omit<ContentBlock, "id">` hampir tidak menghasilkan apa pun.
 * Varian ini_distribution yang benar.
 */
type BlokTanpaId = ContentBlock extends infer T
  ? T extends { id: string }
    ? Omit<T, "id">
    : T
  : never;

/** Gaya dokumen yang bisa dipilih pengguna. */
export type GayaOtomatis =
  | "laporan"
  | "ringkasan"
  | "presentasi"
  | "proposal"
  | "analisis";

/** Deskripsi gaya yang ikut ke prompt AI. */
const PETA_GAYA: Record<GayaOtomatis, string> = {
  laporan:
    "laporan formal lengkap: identitas, latar belakang, tujuan, pembahasan bertahap, hasil, kesimpulan, dan rekomendasi",
  ringkasan:
    "ringkasan eksekutif singkat: temuan utama, angka penting, dan poin rekomendasi",
  presentasi:
    " materi presentasi: judul mencolok per slide, maksimal 5 bullet per slide, satu gagasan per slide",
  proposal:
    "proposal Fountain: latar belakang, tujuan, ruang lingkup, metodologi, jadwal, anggaran, dan penutup",
  analisis:
    "analisis data: konteks, temuan per dimensi, pola, risiko, dan implikasi",
};

export interface OpsiOtomatis {
  provider: ProviderAI;
  model: string;
  apiKey: string;
  baseUrl?: string;
  /** Prompt bebas dari pengguna: topik, tujuan, constrain. */
  prompt: string;
  /** Judul dokumen; kalau kosong, AI yang menentukan. */
  judul?: string;
  /** Gaya dokumen. */
  gaya?: GayaOtomatis;
  /** Persona pengguna (memengaruhi nada & tingkat detail). */
  persona?: PersonaId;
  /** Perkiraan jumlah slide/section yang diinginkan. */
  jumlahBagian?: number;
  /** Izinkan tabel/grafik/diagram (default true). */
  allowRich?: boolean;
  timeoutMs?: number;
}

export interface HasilOtomatis {
  blocks: ContentBlock[];
  judul: string;
  /** Statistik hasil, untuk ditampilkan ke pengguna. */
  statistik: {
    totalBlok: number;
    heading: number;
    tabel: number;
    grafik: number;
    diagram: number;
    daftar: number;
    /** Blok yang dibuang karena tidak valid. */
    dibuang: number;
  };
}

/** Batas aman: model bisa membanjir; potong agar tidak menguras kuota. */
const BATAS_BLOK = 60;
const BATAS_TEKS = 4000;
const BATAS_BARIS_TABEL = 30;
const BATAS_KOLOM_TABEL = 8;

/** Buang karakter kontrol & normalkan spasi ganda. */
function bersihkanTeks(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, BATAS_TEKS);
}

/** Ambil string dari beberapa nama kunci (model AI sering vary). */
function ambilField(o: Record<string, unknown>, kunci: string[]): unknown {
  for (const k of kunci) {
    if (o[k] !== undefined && o[k] !== null) return o[k];
  }
  return undefined;
}

/** Ubah teks AI ("TCAF: 1.2" / "42%") menjadi angka bila memungkinkan. */
function keAngka(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return null;
  // Buang mata uang, spasi, dan tanda persen/komma.
  const bersih = v.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "");
  const n = Number.parseFloat(bersih.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Normalisasi satu item list (bisa nested). Diterima beberapa bentuk:
 * `{text}` · `{text, children}` · string.
 */
function keListItem(v: unknown, level = 0): ListItem | null {
  if (typeof v === "string") {
    const t = bersihkanTeks(v);
    return t ? { text: t } : null;
  }
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const t = bersihkanTeks(ambilField(o, ["text", "item", "label", "nama"]));
  if (!t) return null;
  const item: ListItem = { text: t };
  const anak = ambilField(o, ["children", "items", "sub", "subitems", "subItems"]);
  if (Array.isArray(anak) && level < 3) {
    const listAnak: ListItem[] = [];
    for (const a of anak) {
      const it = keListItem(a, level + 1);
      if (it) listAnak.push(it);
    }
    if (listAnak.length > 0) item.children = listAnak;
  }
  return item;
}

/** Bangun ListBlock dari berbagai bentuk masukan list. */
function keListBlok(v: unknown, id: string): ListBlock | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const items: ListItem[] = [];
  for (const x of v) {
    const it = keListItem(x);
    if (it) items.push(it);
  }
  if (items.length === 0) return null;
  return { id, type: 'list', ordered: false, items };
}

/** Bangun TableBlock dari headers/rows. */
function keTableBlok(
  headers: unknown,
  rows: unknown,
  id: string,
): TableBlock | null {
  if (!Array.isArray(headers) || headers.length === 0) return null;
  const kepala = headers
    .slice(0, BATAS_KOLOM_TABEL)
    .map((h) => bersihkanTeks(h))
    .filter((h) => h.length > 0);
  if (kepala.length === 0) return null;

  const isi: string[][] = [];
  if (Array.isArray(rows)) {
    for (const r of rows.slice(0, BATAS_BARIS_TABEL)) {
      if (!Array.isArray(r)) continue;
      const baris = r
        .slice(0, BATAS_KOLOM_TABEL)
        .map((c) => bersihkanTeks(c) || "—");
      // Padarkan baris yang lebih pendek dari header.
      while (baris.length < kepala.length) baris.push("—");
      if (baris.some((c) => c.length > 0)) isi.push(baris);
    }
  }
  return { id, type: "table", headers: kepala, rows: isi };
}

/** Bangun ChartBlock dari data grafik. */
function keGrafikBlok(v: unknown, id: string): ChartBlock | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;

  // `type` di level blok berarti "chart", bukan jenis grafiknya. Karena itu
  // `chartType` diperiksa lebih dulu; `type` dipakai sebagai cadangan.
  const tipe = bersihkanTeks(
    ambilField(o, ["chartType", "jenis", "chartKind", "type"]),
  ).toLowerCase();
  const chartType: ChartBlock["chartType"] =
    tipe === "line" || tipe === "pie" || tipe === "area" || tipe === "scatter"
      ? tipe
      : "bar";

  const labelRaw = ambilField(o, ["labels", "categories", "kategori", "label"]);
  const labels = Array.isArray(labelRaw)
    ? labelRaw.map((l) => bersihkanTeks(l)).filter(Boolean).slice(0, 24)
    : [];

  const seriesRaw = ambilField(o, ["datasets", "series", "data", "dataSeries"]);
  const datasets: ChartBlock["data"]["datasets"] = [];
  if (Array.isArray(seriesRaw)) {
    for (const s of seriesRaw.slice(0, 6)) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const valuesRaw = ambilField(so, ["data", "values", "nilai"]);
      if (!Array.isArray(valuesRaw)) continue;
      const values = valuesRaw.map(keAngka).filter((n): n is number => n !== null);
      if (values.length === 0) continue;
      datasets.push({
        label: bersihkanTeks(ambilField(so, ["label", "name", "nama"])) || "Data",
        data: values,
      });
    }
  }
  if (labels.length === 0 || datasets.length === 0) return null;

  // Samakan panjang label & nilai: data seri boleh lebih pendek dari label.
  const n = Math.min(labels.length, Math.max(...datasets.map((d) => d.data.length)));
  const labelRapi = labels.slice(0, n);
  const seriRapi = datasets.map((d) => ({
    ...d,
    data: d.data.slice(0, n),
  }));
  return {
    id,
    type: "chart",
    chartType,
    data: { labels: labelRapi, datasets: seriRapi },
  };
}

/** Bangun DiagramBlock (mermaid) dari sumber. */
function keDiagramBlok(v: unknown, id: string): DiagramBlock | null {
  const sumber = bersihkanTeks(v);
  if (!sumber) return null;
  // Mermaid butuh minimal satu edge atau node.
  if (!/-->|->|---|graph|flowchart|sequenceDiagram/.test(sumber)) return null;
  return { id, type: "diagram", diagramType: "mermaid", source: sumber };
}

/**
 * Parse balasan AI menjadi blok yang valid.
 * Mengembalikan blok + jumlah blok yang dibuang.
 */
export function parseBalasanOtomatis(
  mentah: string,
  opsi: { allowRich: boolean },
): { blocks: BlokTanpaId[]; dibuang: number; judul: string } {
  const bersih = mentah
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let data: unknown;
  try {
    data = JSON.parse(bersih);
  } catch {
    return { blocks: [], dibuang: 1, judul: "" };
  }

  // Boleh berupa array blok, atau objek {blocks: [...], title: "..."}.
  let arrayBlok: unknown[] = [];
  let judulDariAI = "";
  if (Array.isArray(data)) {
    arrayBlok = data;
  } else if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    const arr = ambilField(o, ["blocks", "sections", "slides", "content", "isi"]);
    if (Array.isArray(arr)) arrayBlok = arr;
    judulDariAI = bersihkanTeks(ambilField(o, ["title", "judul", "name"]));
  }

  const blocks: BlokTanpaId[] = [];
  let dibuang = 0;

  for (const b of arrayBlok.slice(0, BATAS_BLOK)) {
    if (!b || typeof b !== "object") {
      dibuang++;
      continue;
    }
    const o = b as Record<string, unknown>;
    const tipe = bersihkanTeks(ambilField(o, ["type", "jenis", "kind"])).toLowerCase();

    switch (tipe) {
      case "heading":
      case "judul":
      case "section":
      case "slide": {
        const t = bersihkanTeks(ambilField(o, ["text", "title", "judul", "name"]));
        if (!t) {
          dibuang++;
          break;
        }
        const levelRaw = ambilField(o, ["level", "depth"]);
        // Level heading dibatasi 1–4 (sub-heading jadi bullet, bukan section).
        const level = (
          typeof levelRaw === "number"
            ? Math.min(Math.max(Math.round(levelRaw), 1), 4)
            : 2
        ) as 1 | 2 | 3 | 4;
        blocks.push({ type: "heading", level, text: t });
        break;
      }

      case "paragraph":
      case "paragraf":
      case "text":
      case "isi": {
        const t = bersihkanTeks(ambilField(o, ["text", "body", "isi", "content"]));
        if (!t) {
          dibuang++;
          break;
        }
        blocks.push({ type: "paragraph", text: t });
        break;
      }

      case "list":
      case "bullet":
      case "bullets":
      case "poin": {
        const l = keListBlok(
          ambilField(o, ["items", "bullets", "points", "poin"]),
          "",
        );
        if (!l) {
          dibuang++;
          break;
        }
        const orderedRaw = ambilField(o, ["ordered", "numbered", "berurutan"]);
        blocks.push({
          type: "list",
          ordered: orderedRaw === true || orderedRaw === "true",
          items: l.items,
        });
        break;
      }

      case "table":
      case "tabel": {
        if (!opsi.allowRich) {
          dibuang++;
          break;
        }
        const headers = ambilField(o, ["headers", "header", "columns", "kolom"]);
        const rows = ambilField(o, ["rows", "data", "isi"]);
        const t = keTableBlok(headers, rows, "");
        if (!t) {
          dibuang++;
          break;
        }
        blocks.push({ type: "table", headers: t.headers, rows: t.rows });
        break;
      }

      case "chart":
      case "grafik": {
        if (!opsi.allowRich) {
          dibuang++;
          break;
        }
        const c = keGrafikBlok(o, "");
        if (!c) {
          dibuang++;
          break;
        }
        blocks.push({ type: "chart", chartType: c.chartType, data: c.data });
        break;
      }

      case "diagram":
      case "mermaid":
      case "alur": {
        if (!opsi.allowRich) {
          dibuang++;
          break;
        }
        const sumber =
          typeof o === "string"
            ? o
            : bersihkanTeks(ambilField(o, ["source", "src", "kode", "code", "text"]));
        const d = keDiagramBlok(sumber, "");
        if (!d) {
          dibuang++;
          break;
        }
        blocks.push({ type: "diagram", diagramType: "mermaid", source: d.source });
        break;
      }

      case "divider":
      case "pemisah": {
        blocks.push({ type: "divider" });
        break;
      }

      case "code":
      case "kode": {
        const kode = bersihkanTeks(ambilField(o, ["code", "source", "kode"]));
        if (!kode) {
          dibuang++;
          break;
        }
        blocks.push({
          type: "code",
          language: bersihkanTeks(ambilField(o, ["language", "lang", "bahasa"])) || "text",
          code: kode,
        });
        break;
      }

      default:
        dibuang++;
        break;
    }
  }

  return { blocks, dibuang, judul: judulDariAI };
}

/** Susun system prompt untuk auto-generate. */
function systemPrompt(opsi: OpsiOtomatis): string {
  const gaya = PETA_GAYA[opsi.gaya ?? "laporan"];
  const persona = opsi.persona ? getPersona(opsi.persona) : null;
  const jumlah = Math.min(Math.max(opsi.jumlahBagian ?? 5, 2), 12);
  const rich = opsi.allowRich !== false;

  const skema =
    'Setiap elemen array adalah objek blok dengan field "type" salah satu:\n' +
    '- "heading": butuh "level" (1–4) dan "text"\n' +
    '- "paragraph": butuh "text"\n' +
    '- "list": butuh "ordered" (boolean) dan "items" (array objek {"text": "…"}, boleh nested lewat "children")\n' +
    (rich
      ? '- "table": butuh "headers" (array string) dan "rows" (array of array string)\n' +
        '- "chart": butuh "type" ("bar"|"line"|"pie"|"area"|"scatter"), "labels" (array string), "series" (array objek {"name","values"})\n' +
        '- "diagram": butuh "source" (kode mermaid, contoh: "flowchart LR\\n A[Riset] --> B[Rilis]")\n'
      : "") +
    '- "divider": tanpa field tambahan';

  const gayaOrang =
    persona
      ? ` Audiens: ${persona.nama}. ${persona.contoh[0] ?? ""}`.trim()
      : "";

  return (
    `Kamu penulis dokumen profesional berbahasa Indonesia yang terampil. ` +
    `Balas HANYA dengan JSON (tanpa teks lain, tanpa penjelasan, tanpa markdown fence). ` +
    `Boleh berupa array blok langsung, atau objek {"title": "…", "blocks": [...]}. ${skema}. ` +
    `Gunakan gaya: ${gaya}. ${gayaOrang} ` +
    `Buat ${jumlah} bagian/bagian utama. ` +
    (rich
      ? `Sisipkan minimal satu tabel atau grafik bila data mendukung — jangan mengarang angka tanpa menyebut bahwa itu ilustrasi. `
      : "") +
    `Jangan mengarang fakta, nama orang, atau angka yang tidak ada di prompt. ` +
    `Bila data kurang, tuliskan kalimat yang menjelaskan data apa yang dibutuhkan.`
  );
}

/**
 * Hasilkan dokumen lengkap dari satu prompt.
 */
export async function generateOtomatis(
  opsi: OpsiOtomatis,
): Promise<HasilOtomatis> {
  const allowRich = opsi.allowRich !== false;

  const pesan = [
    {
      peran: "system" as const,
      teks: systemPrompt(opsi),
    },
    {
      peran: "user" as const,
      teks:
        `Judul dokumen: ${opsi.judul || "Tentukan sendiri judul yang tepat"}.\n\n` +
        `Permintaan: ${opsi.prompt}\n\n` +
        `Tulis dokumen lengkap sekarang.`,
    },
  ];

  const mentah = await generateCompletion({
    provider: opsi.provider,
    model: opsi.model,
    apiKey: opsi.apiKey,
    ...(opsi.baseUrl ? { baseUrl: opsi.baseUrl } : {}),
    ...(opsi.timeoutMs ? { timeoutMs: opsi.timeoutMs } : {}),
    pesan,
  });

  const { blocks, dibuang, judul: judulAI } = parseBalasanOtomatis(mentah, {
    allowRich,
  });

  if (blocks.length === 0) {
    throw new Error(
      "Balasan AI tidak menghasilkan blok yang valid. Coba prompt yang lebih spesifik.",
    );
  }

  // Beri id unik pada setiap blok.
  const denganId = blocks.map((blok, i) => ({
    ...blok,
    id: `auto-${Date.now()}-${i}`,
  })) as ContentBlock[];

  // Judul: pakai yang diminta, atau judul dari AI, atau heading level 1
  // pertama, atau default.
  const headingPertama = denganId.find(
    (b) => b.type === "heading" && b.level === 1,
  );
  const judul =
    opsi.judul?.trim() ||
    judulAI.trim() ||
    (headingPertama && headingPertama.type === "heading"
      ? headingPertama.text
      : "Dokumen NitZ-909");

  const statistik = {
    totalBlok: denganId.length,
    heading: denganId.filter((b) => b.type === "heading").length,
    tabel: denganId.filter((b) => b.type === "table").length,
    grafik: denganId.filter((b) => b.type === "chart").length,
    diagram: denganId.filter((b) => b.type === "diagram").length,
    daftar: denganId.filter((b) => b.type === "list").length,
    dibuang,
  };

  return { blocks: denganId, judul, statistik };
}
