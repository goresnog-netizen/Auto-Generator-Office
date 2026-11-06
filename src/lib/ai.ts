/**
 * Klien AI NitZ-909 — fetch bawaan, tanpa dependensi baru.
 * Mendukung OpenAI, Anthropic, dan Google dengan pesan berbahasa Indonesia.
 * Catatan privasi: apiKey TIDAK pernah di-log atau disimpan di sini;
 * penyimpanan hanya dilakukan pemanggil (localStorage) dan kunci hanya
 * dikirim ke provider yang dipilih (atau `baseUrl` uji bila diisi).
 */

import type { ContentBlock, LaporanMetadata } from "../types";
import { bangunPanduanBahasa } from "./bahasa";

export type ProviderAI = "openai" | "anthropic" | "google" | "groq";

export interface PesanAI {
  peran: "system" | "user";
  teks: string;
}

export interface OpsiCompletion {
  provider: ProviderAI;
  model: string;
  apiKey: string;
  baseUrl?: string;
  pesan: PesanAI[];
  timeoutMs?: number;
  /**
   * Batas token keluaran.
   *
   * Dulu jalur Anthropic dipaku di 1024 token — cukup untuk satu paragraf,
   * tetapi memotong laporan panjang di tengah kalimat tanpa error. Nilai
   * bawaan sekarang 4096; pemanggil bertahap boleh menurunkannya agar satu
   * bagian tidak menghabiskan kuota.
   */
  maxTokens?: number;
  /** Pencarian web (grounding) — hanya didukung provider Google. */
  cariWeb?: boolean;
}

export interface SumberWeb {
  judul: string;
  uri: string;
}

export interface HasilSumber {
  teks: string;
  sumber: SumberWeb[];
}

const WAKTU_HENTI_DEFAULT = 60_000;

const tanpaGarisMiring = (s: string) => s.replace(/\/+$/, "");

function labelProvider(provider: ProviderAI): string {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "google") return "Google AI";
  return "Groq";
}

function galatStatus(status: number, provider: ProviderAI): Error {
  const nama = labelProvider(provider);
  if (status === 401 || status === 403)
    return new Error(
      `Kunci API ${nama} salah atau tidak valid. Periksa kembali kunci.`,
    );
  if (status === 429)
    return new Error(
      "Batas pemakaian API tercapai. Tunggu sebentar lalu coba lagi.",
    );
  return new Error(`Layanan AI gagal (kode ${status}). Coba lagi nanti.`);
}

async function kirim(
  url: string,
  init: RequestInit,
  _provider: ProviderAI,
  timeoutMs: number,
): Promise<Response> {
  const kendali = new AbortController();
  const id = window.setTimeout(() => kendali.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: kendali.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error("Waktu habis menghubungi layanan AI. Coba lagi.");
    throw new Error(
      "Tidak dapat menghubungi layanan AI. Periksa koneksi internet lalu coba lagi.",
    );
  } finally {
    window.clearTimeout(id);
  }
}

function ekstrakTeks(json: unknown, jalur: (string | number)[]): string {
  let cur: unknown = json;
  for (const k of jalur) {
    if (cur == null || typeof cur !== "object") return "";
    cur = (cur as Record<string | number, unknown>)[k];
  }
  return typeof cur === "string" ? cur.trim() : "";
}

/**
 * Minta satu draf teks dari provider AI.
 * `baseUrl` opsional menimpa host bawaan (untuk uji mock lokal).
 */
export async function generateCompletion(
  opsi: OpsiCompletion,
): Promise<string> {
  const timeoutMs = opsi.timeoutMs ?? WAKTU_HENTI_DEFAULT;
  const pesan = opsi.pesan.filter((p) => p.teks.trim() !== "");
  if (pesan.length === 0) throw new Error("Tidak ada pesan untuk dikirim.");

  // Groq memakai format OpenAI-compatible (chat/completions + Bearer).
  if (opsi.provider === "openai" || opsi.provider === "groq") {
    const host = opsi.baseUrl
      ? tanpaGarisMiring(opsi.baseUrl)
      : opsi.provider === "groq"
        ? "https://api.groq.com/openai"
        : "https://api.openai.com";
    const url = `${host}/v1/chat/completions`;
    const res = await kirim(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opsi.apiKey}`,
        },
        body: JSON.stringify({
          model: opsi.model,
          messages: pesan.map((p) => ({
            role: p.peran === "system" ? "system" : "user",
            content: p.teks,
          })),
        }),
      },
      opsi.provider,
      timeoutMs,
    );
    if (!res.ok) throw galatStatus(res.status, opsi.provider);
    const json: unknown = await res.json().catch(() => null);
    const teks = ekstrakTeks(json, ["choices", 0, "message", "content"]);
    if (!teks)
      throw new Error("Layanan AI mengembalikan jawaban kosong. Coba lagi.");
    return teks;
  }

  if (opsi.provider === "anthropic") {
    const host = opsi.baseUrl
      ? tanpaGarisMiring(opsi.baseUrl)
      : "https://api.anthropic.com";
    const url = `${host}/v1/messages`;
    const sistem = pesan
      .filter((p) => p.peran === "system")
      .map((p) => p.teks)
      .join("\n");
    const messages = pesan
      .filter((p) => p.peran === "user")
      .map((p) => ({ role: "user", content: p.teks }));
    if (messages.length === 0)
      throw new Error("Tidak ada pesan pengguna untuk dikirim.");
    const res = await kirim(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": opsi.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opsi.model,
          max_tokens: opsi.maxTokens ?? 4096,
          ...(sistem ? { system: sistem } : {}),
          messages,
        }),
      },
      opsi.provider,
      timeoutMs,
    );
    if (!res.ok) throw galatStatus(res.status, opsi.provider);
    const json: unknown = await res.json().catch(() => null);
    const teks = ekstrakTeks(json, ["content", 0, "text"]);
    if (!teks)
      throw new Error("Layanan AI mengembalikan jawaban kosong. Coba lagi.");
    return teks;
  }

  // google
  if (opsi.cariWeb && opsi.provider !== "google") {
    throw new Error("Pencarian web hanya didukung provider Google.");
  }
  const host = opsi.baseUrl
    ? tanpaGarisMiring(opsi.baseUrl)
    : "https://generativelanguage.googleapis.com";
  const url = `${host}/v1beta/models/${encodeURIComponent(opsi.model)}:generateContent`;
  const sistem = pesan
    .filter((p) => p.peran === "system")
    .map((p) => p.teks)
    .join("\n");
  const contents = pesan
    .filter((p) => p.peran === "user")
    .map((p) => ({ role: "user", parts: [{ text: p.teks }] }));
  if (contents.length === 0)
    throw new Error("Tidak ada pesan pengguna untuk dikirim.");
  const res = await kirim(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": opsi.apiKey,
      },
      body: JSON.stringify({
        ...(sistem ? { systemInstruction: { parts: [{ text: sistem }] } } : {}),
        ...(opsi.cariWeb ? { tools: [{ google_search: {} }] } : {}),
        contents,
      }),
    },
    opsi.provider,
    timeoutMs,
  );
  if (!res.ok) throw galatStatus(res.status, opsi.provider);
  const json: unknown = await res.json().catch(() => null);
  const teks = ekstrakTeks(json, [
    "candidates",
    0,
    "content",
    "parts",
    0,
    "text",
  ]);
  if (!teks)
    throw new Error("Layanan AI mengembalikan jawaban kosong. Coba lagi.");
  return teks;
}

/* ===== Chat AI: completion + sumber web (grounding Google) ===== */

export async function generateCompletionSumber(
  opsi: OpsiCompletion,
): Promise<HasilSumber> {
  if (opsi.provider !== "google") {
    throw new Error("Pencarian web hanya didukung provider Google.");
  }
  const pesan = opsi.pesan.filter((p) => p.teks.trim() !== "");
  if (pesan.length === 0) throw new Error("Tidak ada pesan untuk dikirim.");
  const host = opsi.baseUrl
    ? tanpaGarisMiring(opsi.baseUrl)
    : "https://generativelanguage.googleapis.com";
  const url = `${host}/v1beta/models/${encodeURIComponent(opsi.model)}:generateContent`;
  const sistem = pesan
    .filter((p) => p.peran === "system")
    .map((p) => p.teks)
    .join("\n");
  const contents = pesan
    .filter((p) => p.peran === "user")
    .map((p) => ({ role: "user", parts: [{ text: p.teks }] }));
  const res = await kirim(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": opsi.apiKey,
      },
      body: JSON.stringify({
        ...(sistem ? { systemInstruction: { parts: [{ text: sistem }] } } : {}),
        tools: [{ google_search: {} }],
        contents,
      }),
    },
    opsi.provider,
    opsi.timeoutMs ?? WAKTU_HENTI_DEFAULT,
  );
  if (!res.ok) throw galatStatus(res.status, opsi.provider);
  const json: unknown = await res.json().catch(() => null);
  const teks = ekstrakTeks(json, [
    "candidates",
    0,
    "content",
    "parts",
    0,
    "text",
  ]);
  if (!teks)
    throw new Error("Layanan AI mengembalikan jawaban kosong. Coba lagi.");
  const sumber: SumberWeb[] = [];
  try {
    const akar = json as {
      candidates?: { groundingMetadata?: { groundingChunks?: unknown[] } }[];
    };
    const potong =
      akar.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
    for (const c of potong) {
      const web = (c as { web?: { uri?: unknown; title?: unknown } }).web;
      if (web && typeof web.uri === "string") {
        sumber.push({
          judul: typeof web.title === "string" ? web.title : web.uri,
          uri: web.uri,
        });
      }
    }
  } catch {
    /* tanpa grounding — teks tetap dipakai */
  }
  return { teks, sumber };
}

/* ===== Draf AI: seluruh dokumen jadi array blok terstruktur ===== */

const TIPE_DRAF = new Set(["heading", "paragraph", "list"]);

let urutanDraf = 0;
function idDraf(prefix: string): string {
  urutanDraf += 1;
  return `${prefix}-draf-${Date.now().toString(36)}-${urutanDraf}`;
}

function ringkasBlok(b: ContentBlock): string | null {
  switch (b.type) {
    case "heading":
      return `${"#".repeat(Math.min(3, b.level))} ${b.text}`;
    case "paragraph": {
      const t = b.text.trim();
      return t ? t.slice(0, 400) : null;
    }
    case "table": {
      const kepala = b.headers.join(" | ");
      const baris = b.rows.slice(0, 8).map((r) => r.join(" | "));
      return `[Tabel] ${kepala}${baris.length ? `\n${baris.join("\n")}` : ""}`;
    }
    default:
      return null;
  }
}

function barisMetadata(m: LaporanMetadata): string {
  const pasang: [string, string][] = [
    ["Nomor", m.nomor],
    ["Tanggal", m.tanggal],
    ["Unit/Instansi", m.unit],
    ["Penanggung Jawab", m.penanggungJawab],
    ["Periode", m.periode],
    ["Lokasi", m.lokasi],
  ];
  return pasang
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n");
}

/**
 * Bersihkan pagar kode JSON, parse, validasi tipe blok yang diizinkan
 * (heading/paragraph/list), buang entri tidak valid.
 * Melempar pesan Indonesia bila balasan bukan array blok yang bisa dipakai.
 */
export function parseBalasanDraf(teks: string): ContentBlock[] {
  const bersih = teks
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  let data: unknown;
  try {
    data = JSON.parse(bersih);
  } catch {
    throw new Error("Balasan AI bukan JSON valid — coba lagi.");
  }
  if (!Array.isArray(data))
    throw new Error("Balasan AI bukan JSON valid — coba lagi.");
  const hasil: ContentBlock[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const b = item as Record<string, unknown>;
    if (typeof b.type !== "string" || !TIPE_DRAF.has(b.type)) continue;
    if (b.type === "heading") {
      const text = typeof b.text === "string" ? b.text.trim() : "";
      const level =
        typeof b.level === "number"
          ? b.level
          : typeof b.level === "string" && /^[1-6]$/.test(b.level.trim())
            ? Number(b.level.trim())
            : null;
      if (!text || level === null) continue;
      hasil.push({
        id: idDraf("heading"),
        type: "heading",
        level: Math.min(3, Math.max(1, Math.round(level))) as 1 | 2 | 3,
        text,
      });
      continue;
    }
    if (b.type === "paragraph") {
      const text = typeof b.text === "string" ? b.text.trim() : "";
      if (!text) continue;
      hasil.push({ id: idDraf("paragraph"), type: "paragraph", text });
      continue;
    }
    const items = (Array.isArray(b.items) ? b.items : [])
      .map((it) =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as Record<string, unknown>).text === "string"
          ? ((it as Record<string, unknown>).text as string).trim()
          : typeof it === "string"
            ? it.trim()
            : "",
      )
      .filter((t) => t !== "")
      .map((t) => ({ text: t }));
    if (items.length === 0) continue;
    hasil.push({
      id: idDraf("list"),
      type: "list",
      ordered: b.ordered === true,
      items,
    });
  }
  if (hasil.length === 0)
    throw new Error("Balasan AI bukan JSON valid — coba lagi.");
  return hasil;
}

export interface OpsiDraf {
  provider: ProviderAI;
  model: string;
  apiKey: string;
  baseUrl?: string;
  judul: string;
  blocks: ContentBlock[];
  metadata?: LaporanMetadata;
  timeoutMs?: number;
}

/**
 * Minta draf SELURUH dokumen: kirim judul + ringkasan kanvas + metadata,
 * minta balasan HANYA JSON array blok, lalu parse jadi ContentBlock[].
 */
export async function generateDraft(opsi: OpsiDraf): Promise<ContentBlock[]> {
  const ringkasan = opsi.blocks
    .map(ringkasBlok)
    .filter((r): r is string => r !== null)
    .join("\n\n");
  if (!ringkasan.trim())
    throw new Error("Kanvas masih kosong — tidak ada bahan untuk draf.");
  const meta = opsi.metadata ? barisMetadata(opsi.metadata) : "";
  const teks = await generateCompletion({
    provider: opsi.provider,
    model: opsi.model,
    apiKey: opsi.apiKey,
    ...(opsi.baseUrl ? { baseUrl: opsi.baseUrl } : {}),
    ...(opsi.timeoutMs ? { timeoutMs: opsi.timeoutMs } : {}),
    pesan: [
      {
        peran: "system",
        teks:
          `${bangunPanduanBahasa({ ragam: "laporan" })}\n\n` +
          "Balas HANYA dengan JSON array (tanpa teks lain, tanpa penjelasan). " +
          'Setiap elemen array adalah objek blok dengan field "type" salah satu: ' +
          '"heading" (butuh "level" 1–3 dan "text"), ' +
          '"paragraph" (butuh "text"), ' +
          '"list" (butuh "ordered" boolean dan "items" array berisi objek {"text": "…"}). ' +
          "Susun draf laporan lengkap: pendahuluan, isi bertahap, penutup. " +
          "Pertahankan seluruh angka dan nama yang sudah ada di kanvas; " +
          "jangan menambah angka yang tidak ada di sana.",
      },
      {
        peran: "user",
        teks:
          `Judul dokumen: ${opsi.judul || "Tanpa judul"}.\n` +
          (meta ? `Identitas:\n${meta}\n` : "") +
          `Ringkasan kanvas saat ini:\n${ringkasan}\n\n` +
          "Buat draf ulang menjadi laporan lengkap dan terstruktur.",
      },
    ],
  });
  return parseBalasanDraf(teks);
}
