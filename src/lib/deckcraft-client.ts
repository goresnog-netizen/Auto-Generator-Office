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
  if (!resp.ok) {
    let pesan = `Permintaan gagal (${resp.status}).`;
    try {
      const data = (await resp.json()) as { galat?: string };
      if (data.galat) pesan = data.galat;
    } catch {
      /* badan bukan JSON */
    }
    throw new GalatDeckcraft(pesan, resp.status);
  }
  // Hosting statis (mis. Vercel) bisa mengembalikan halaman HTML untuk
  // rute yang tak dikenal. Itu bukan API — laporkan sebagai galat 404
  // supaya UI bisa menjelaskan penyebabnya, bukan "Unexpected token '<'".
  const tipe = resp.headers.get("content-type") ?? "";
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

/** Unduh PPTX hasil build DeckCraft. */
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
    throw new Error(pesan);
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
