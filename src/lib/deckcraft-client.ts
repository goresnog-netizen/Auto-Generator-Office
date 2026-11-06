/**
 * Klien sisi browser untuk API DeckCraft.
 *
 * Berbeda dengan `src/lib/deckcraft.ts` (bridge Node), modul ini aman
 * diimpor oleh bundel browser: ia hanya berbicara HTTP.
 */
import type { ContentBlock } from "../types";

export interface DeckcraftStatus {
  tersedia: boolean;
  versi: string;
  binPath: string;
  tema: string[];
  galat: string | null;
}

export interface DeckcraftSlideRingkas {
  index: number;
  id: number;
  title: string;
  layout: string;
  shapes: number;
  hidden: boolean;
}

export interface DeckcraftDeckRingkas {
  title: string;
  theme: string;
  slideSize: [number, number];
  slides: DeckcraftSlideRingkas[];
}

const DASAR = "/api/deckcraft";

/**
 * Galat API DeckCraft dengan kode status, supaya UI bisa membedakan
 * "server tidak punya API ini" (mis. hosting statis seperti Vercel) dari
 * "API ada tapi binary DeckCraft belum terpasang".
 */
export class GalatDeckcraft extends Error {
  readonly status: number;
  constructor(pesan: string, status: number) {
    super(pesan);
    this.name = "GalatDeckcraft";
    this.status = status;
  }
}

async function json<T>(resp: Response): Promise<T> {
  const tipe = resp.headers.get("content-type") ?? "";
  if (!resp.ok) {
    // GitHub Pages mengembalikan 404 + HTML untuk rute yang tak dikenal.
    // Itu berarti API-nya MEMANG tidak ada, bukan "API ada tapi binary
    // DeckCraft belum terpasang". Tanpa pemeriksaan ini, panel menampilkan
    // saran `pnpm vendor:deckcraft` yang mustahil dilakukan di hosting web.
    if (
      !tipe.includes("application/json") &&
      (resp.status === 404 || resp.status === 405)
    ) {
      throw new GalatDeckcraft(
        "Server ini tidak menyediakan API DeckCraft (dapat halaman HTML, bukan JSON).",
        404,
      );
    }
    let pesan = `Permintaan gagal (${resp.status}).`;
    try {
      const data = (await resp.json()) as { galat?: string };
      if (data.galat) pesan = data.galat;
    } catch {
      /* badan bukan JSON */
    }
    throw new GalatDeckcraft(pesan, resp.status);
  }
  // Hosting statis (mis. Vercel) bisa mengembalikan HTTP 200 + halaman HTML
  // untuk rute yang tak dikenal. Itu bukan API — laporkan sebagai galat 404
  // supaya UI bisa menjelaskan penyebabnya, bukan "Unexpected token '<'".
  if (!tipe.includes("application/json")) {
    throw new GalatDeckcraft(
      "Server ini tidak menyediakan API DeckCraft (dapat halaman HTML, bukan JSON).",
      404,
    );
  }
  return (await resp.json()) as T;
}

/**
 * Status DeckCraft di server: tersedia? versi? tema apa saja?
 *
 * Bila server tidak menyediakan API sama sekali (mis. hosting statis
 * seperti Vercel), fungsi ini TIDAK melempar galat — ia mengembalikan
 * status "tidak tersedia" dengan alasan yang bisa ditampilkan ke user.
 */
export async function ambilStatusDeckcraft(): Promise<DeckcraftStatus> {
  try {
    return await json<DeckcraftStatus>(await fetch(`${DASAR}/status`));
  } catch (e) {
    if (e instanceof GalatDeckcraft) {
      return {
        tersedia: false,
        versi: "-",
        binPath: "",
        tema: [],
        galat: e.message,
      };
    }
    throw e;
  }
}

/** Bangun deck dari blok konten; mengembalikan ringkasan deck. */
export async function bangunDeck(
  blocks: ContentBlock[],
  judul: string,
  tema: string,
): Promise<DeckcraftDeckRingkas> {
  const resp = await fetch(`${DASAR}/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, judul, tema }),
  });
  const data = await json<{ deck: DeckcraftDeckRingkas }>(resp);
  return data.deck;
}

/** Pratinjau satu slide sebagai data-URL PNG. */
export async function ambilPratinjau(
  slide: number,
  skala = 1,
): Promise<string> {
  const resp = await fetch(
    `${DASAR}/preview?slide=${encodeURIComponent(slide)}&scale=${encodeURIComponent(skala)}`,
  );
  const data = await json<{ png: string }>(resp);
  return `data:image/png;base64,${data.png}`;
}

/**
 * Filmstrip: PNG semua slide, sebagai data-URL.
 *
 * Server merender tiap slide pada skala kecil (default 0,35 -> 336x189),
 * jadi filmstrip ringan dipindah lewat JSON.
 */
export async function ambilFilmstrip(skala = 0.35): Promise<string[]> {
  const resp = await fetch(
    `${DASAR}/filmstrip?scale=${encodeURIComponent(skala)}`,
  );
  const data = await json<{ gambar: string[] }>(resp);
  return (data.gambar ?? []).map((png) => `data:image/png;base64,${png}`);
}

/**
 * Unduh PPTX hasil build DeckCraft.
 *
 * Memakai rute `/export` (bukan `/export-format`): rute ini sudah terverifikasi
 * oleh `scripts/verifikasi-api.mjs` dan tidak berubah perilakunya.
 */
export async function unduhPptxDeckcraft(
  blocks: ContentBlock[],
  judul: string,
  tema: string,
): Promise<void> {
  const resp = await fetch(`${DASAR}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, judul, tema }),
  });
  if (!resp.ok) {
    let pesan = `Ekspor gagal (${resp.status}).`;
    try {
      const data = (await resp.json()) as { galat?: string };
      if (data.galat) pesan = data.galat;
    } catch {
      /* badan bukan JSON */
    }
    throw new GalatDeckcraft(pesan, resp.status);
  }
  const blob = await resp.blob();
  const nama = `${judul.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "Presentasi"}.pptx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Format yang bisa diekspor DeckCraft lewat API. */
export type FormatEksporDeckcraft = "pptx" | "pdf" | "gif";

/**
 * Unduh deck dalam format tertentu (PPTX, PDF, GIF).
 *
 * Format PDF dan GIF hanya bisa dihasilkan engine DeckCraft; generator
 * NitZ-909 sendiri punya jalurnya sendiri untuk keduanya.
 */
export async function unduhFormatDeckcraft(
  blocks: ContentBlock[],
  judul: string,
  tema: string,
  format: FormatEksporDeckcraft,
  opsi: { secondsPerSlide?: number } = {},
): Promise<void> {
  const resp = await fetch(`${DASAR}/export-format`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, judul, tema, format, ...opsi }),
  });
  if (!resp.ok) {
    let pesan = `Ekspor gagal (${resp.status}).`;
    try {
      const data = (await resp.json()) as { galat?: string };
      if (data.galat) pesan = data.galat;
    } catch {
      /* badan bukan JSON */
    }
    throw new GalatDeckcraft(pesan, resp.status);
  }
  const blob = await resp.blob();
  const nama =
    `${judul.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "Presentasi"}.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
