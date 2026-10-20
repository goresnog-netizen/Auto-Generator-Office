/**
 * Impor data CSV/JSON NitZ-909 — parser tanpa dependensi.
 * CSV: subset RFC-4180 (kutip ganda, koma & newline di dalam kutip, "" = kutip literal).
 * JSON: array-of-objects → tabel; array-of-strings → daftar.
 */
import type { ChartBlock, ContentBlock, ListBlock, TableBlock } from "../types";

let urutan = 0;
function idBaru(prefix: string): string {
  urutan += 1;
  return `${prefix}-impor-${Date.now().toString(36)}-${urutan}`;
}

/**
 * Ubah teks CSV jadi array baris; tiap baris array sel.
 * Baris kosong (semua sel kosong) dilewati. Kutip hanya diperlakukan khusus
 * bila diawali field, sehingga teks seperti ab"cd tetap literal.
 */
export function parseCSV(text: string): string[][] {
  const baris: string[][] = [];
  let sel: string[] = [];
  let nilai = "";
  let dalamKutip = false;
  let kutipSelesai = false;
  const teks = text.replace(/^\uFEFF/, "");
  const tutupSel = () => {
    sel.push(nilai);
    nilai = "";
    kutipSelesai = false;
  };
  for (let i = 0; i < teks.length; i++) {
    const c = teks[i];
    if (dalamKutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') {
          nilai += '"';
          i += 1;
        } else {
          dalamKutip = false;
          kutipSelesai = true;
        }
      } else {
        nilai += c;
      }
      continue;
    }
    if (c === '"' && nilai === "" && !kutipSelesai) {
      dalamKutip = true;
    } else if (c === ",") {
      tutupSel();
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && teks[i + 1] === "\n") i += 1;
      tutupSel();
      if (sel.some((s) => s.trim() !== "")) baris.push(sel);
      sel = [];
    } else {
      nilai += c;
    }
  }
  tutupSel();
  if (sel.some((s) => s.trim() !== "")) baris.push(sel);
  return baris;
}

function angka(v: string): number | null {
  const t = v.trim().replace(/\s/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export interface HasilImpor {
  baris: number;
  kolom: number;
  blocks: ContentBlock[];
}

/**
 * CSV → blok tabel; bila ≥2 kolom numerik (di luar kolom label pertama),
 * tambah blok grafik batang (labels = kolom pertama, datasets = kolom numerik).
 */
export function blokDariCSV(text: string): HasilImpor {
  const rows = parseCSV(text);
  if (rows.length === 0)
    throw new Error("CSV kosong — tidak ada baris untuk diimpor.");
  const headers = rows[0].map((h, i) => h.trim() || `Kolom ${i + 1}`);
  const data = rows.slice(1).map((r) => {
    const row = r.slice(0, headers.length);
    while (row.length < headers.length) row.push("");
    return row;
  });
  if (data.length === 0)
    throw new Error("CSV hanya berisi header — tidak ada baris data.");
  const kolom = headers.length;

  const tabel: TableBlock = {
    id: idBaru("table"),
    type: "table",
    headers,
    rows: data,
    caption: "Data impor CSV",
  };
  const blocks: ContentBlock[] = [tabel];

  // shortcut: kolom pertama dianggap label; grafik hanya dari kolom numerik lain.
  const numerik: number[] = [];
  for (let c = 1; c < kolom; c++) {
    if (data.every((r) => angka(r[c]) !== null)) numerik.push(c);
  }
  if (numerik.length >= 2) {
    const grafik: ChartBlock = {
      id: idBaru("chart"),
      type: "chart",
      chartType: "bar",
      data: {
        labels: data.map((r) => r[0]),
        datasets: numerik.map((c) => ({
          label: headers[c],
          data: data.map((r) => angka(r[c]) as number),
        })),
      },
    };
    blocks.push(grafik);
  }
  return { baris: data.length, kolom, blocks };
}

/**
 * JSON → blok: array-of-objects (seragam) jadi tabel; array-of-string jadi
 * daftar. Selain itu: galat berbahasa Indonesia.
 */
export function blokDariJSON(data: unknown): HasilImpor {
  if (!Array.isArray(data) || data.length === 0)
    throw new Error(
      "JSON impor harus array tak-kosong berisi objek data atau string.",
    );
  if (data.every((x) => typeof x === "string")) {
    const items = (data as string[]).map((t) => ({ text: t }));
    const daftar: ListBlock = {
      id: idBaru("list"),
      type: "list",
      ordered: false,
      items,
    };
    return { baris: items.length, kolom: 1, blocks: [daftar] };
  }
  if (
    data.every((x) => typeof x === "object" && x !== null && !Array.isArray(x))
  ) {
    const objek = data as Record<string, unknown>[];
    const headers: string[] = [];
    for (const o of objek)
      for (const k of Object.keys(o)) if (!headers.includes(k)) headers.push(k);
    const rows = objek.map((o) =>
      headers.map((h) => {
        const v = o[h];
        if (v === null || v === undefined) return "";
        return typeof v === "object" ? JSON.stringify(v) : String(v);
      }),
    );
    const tabel: TableBlock = {
      id: idBaru("table"),
      type: "table",
      headers,
      rows,
      caption: "Data impor JSON",
    };
    return { baris: rows.length, kolom: headers.length, blocks: [tabel] };
  }
  throw new Error(
    "JSON impor tidak dikenali — harus array berisi objek atau string seragam.",
  );
}
