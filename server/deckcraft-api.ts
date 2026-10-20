/**
 * Server API DeckCraft untuk NitZ-909.
 *
 * Berjalan sebagai middleware Vite (mode dev) atau sebagai server Node
 * mandiri (mode produksi). Menyediakan:
 *
 *   GET  /api/deckcraft/status            → versi, ketersediaan, daftar tema
 *   POST /api/deckcraft/build            → build deck dari ContentBlock[]
 *   POST /api/deckcraft/export            → build + simpan PPTX, kembalikan file
 *   GET  /api/deckcraft/preview?slide=N   → PNG slide (base64 JSON)
 *
 * Sesi DeckCraft dipakai bersama antar permintaan: satu proses MCP, deck
 * dibangun ulang tiap kali `build` dipanggil.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DeckcraftSession,
  periksaDeckcraft,
  type DeckcraftDeck,
} from "../src/lib/deckcraft.ts";
import {
  blokKePerintah,
  TEMA_DECKCRAFT,
} from "../src/lib/deckcraft-ppt.ts";
import type { ContentBlock } from "../src/types/index.ts";

/** Batas ukuran body JSON (permintaan build bisa besar). */
const BATAS_BODY = 8 * 1024 * 1024;

interface PermintaanBuild {
  blocks: ContentBlock[];
  judul?: string;
  tema?: string;
}

interface SesiTerbuka {
  sesi: DeckcraftSession;
  deck: DeckcraftDeck;
}

let sesiTerbuka: SesiTerbuka | null = null;
let infoDeckcraft: Awaited<ReturnType<typeof periksaDeckcraft>> | null = null;

/** Baca body HTTP sebagai teks (dengan batas ukuran). */
function bacaBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    let ukuran = 0;
    req.on("data", (potongan: Buffer) => {
      ukuran += potongan.length;
      if (ukuran > BATAS_BODY) {
        reject(new Error("Badan permintaan terlalu besar."));
        req.destroy();
        return;
      }
      data += potongan.toString("utf8");
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function kirimJson(res: ServerResponse, kode: number, data: unknown) {
  const badan = JSON.stringify(data);
  res.writeHead(kode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(badan),
    "Cache-Control": "no-store",
  });
  res.end(badan);
}

/**
 * Bangun deck dari blok konten; mengembalikan deck yang aktif.
 *
 * Sesi DeckCraft dipakai bersama, jadi build harus diserialkan: dua permintaan
 * bersamaan (mis. build + export) akan saling menimpa presentasi kalau tidak.
 * Antrean ini membuat setiap operasi DeckCraft berjalan satu per satu.
 */
let antreanDeck: Promise<unknown> = Promise.resolve();

function serialkan<T>(kerja: () => Promise<T>): Promise<T> {
  const jalan = antreanDeck.then(kerja, kerja);
  // Antrean tetap hidup meski satu operasi gagal.
  antreanDeck = jalan.then(
    () => undefined,
    () => undefined,
  );
  return jalan;
}

async function bangunDeck(
  blocks: ContentBlock[],
  judul: string,
  tema: string,
): Promise<DeckcraftDeck> {
  return serialkan(async () => {
    if (!sesiTerbuka) {
      sesiTerbuka = { sesi: new DeckcraftSession(), deck: null as never };
    }
    const perintah = blokKePerintah(blocks, { judul, tema });
    await sesiTerbuka.sesi.jalankan(perintah);
    const deck = await sesiTerbuka.sesi.periksa();
    sesiTerbuka.deck = deck;
    return deck;
  });
}

/** Rute API. Mengembalikan true bila permintaan sudah ditangani. */
export async function tanganiApi(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (!url.pathname.startsWith("/api/deckcraft")) return false;

  try {
    if (url.pathname === "/api/deckcraft/status" && req.method === "GET") {
      if (!infoDeckcraft) {
        infoDeckcraft = await periksaDeckcraft();
      }
      kirimJson(res, 200, {
        tersedia: infoDeckcraft.tersedia,
        versi: infoDeckcraft.versi,
        binPath: infoDeckcraft.binPath,
        tema: infoDeckcraft.tema.length > 0 ? infoDeckcraft.tema : [...TEMA_DECKCRAFT],
        galat: infoDeckcraft.galat ?? null,
      });
      return true;
    }

    if (url.pathname === "/api/deckcraft/build" && req.method === "POST") {
      const body = JSON.parse((await bacaBody(req)) || "{}") as PermintaanBuild;
      if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
        kirimJson(res, 400, { galat: "Tidak ada blok konten." });
        return true;
      }
      if (!infoDeckcraft) infoDeckcraft = await periksaDeckcraft();
      if (!infoDeckcraft.tersedia) {
        kirimJson(res, 503, {
          galat: infoDeckcraft.galat ?? "DeckCraft tidak tersedia.",
        });
        return true;
      }
      const deck = await bangunDeck(
        body.blocks,
        body.judul || "Presentasi NitZ-909",
        body.tema || "Slate",
      );
      kirimJson(res, 200, { deck });
      return true;
    }

    if (url.pathname === "/api/deckcraft/preview" && req.method === "GET") {
      if (!sesiTerbuka) {
        kirimJson(res, 409, { galat: "Bangun deck dulu sebelum meminta pratinjau." });
        return true;
      }
      const slide = Number(url.searchParams.get("slide") ?? "0");
      const skala = Number(url.searchParams.get("scale") ?? "1");
      // Serialkan dengan build: pratinjau deck yang sedang dibangun akan
      // menampilkan slide setengah jadi.
      const png = await serialkan(() =>
        sesiTerbuka!.sesi.renderSlide(
          Number.isFinite(slide) ? slide : 0,
          Number.isFinite(skala) ? skala : 1,
        ),
      );
      kirimJson(res, 200, { png, slide });
      return true;
    }

    if (url.pathname === "/api/deckcraft/export" && req.method === "POST") {
      const body = JSON.parse((await bacaBody(req)) || "{}") as PermintaanBuild;
      if (!Array.isArray(body.blocks) || body.blocks.length === 0) {
        kirimJson(res, 400, { galat: "Tidak ada blok konten." });
        return true;
      }
      if (!infoDeckcraft) infoDeckcraft = await periksaDeckcraft();
      if (!infoDeckcraft.tersedia) {
        kirimJson(res, 503, {
          galat: infoDeckcraft.galat ?? "DeckCraft tidak tersedia.",
        });
        return true;
      }
      const judul = body.judul || "Presentasi NitZ-909";
      const tema = body.tema || "Slate";

      // Build + simpan dalam satu operasi serial: tidak boleh disela
      // permintaan lain yang mengubah deck di tengah jalan.
      const hasil = await serialkan(async () => {
        if (!sesiTerbuka) {
          sesiTerbuka = { sesi: new DeckcraftSession(), deck: null as never };
        }
        const perintah = blokKePerintah(body.blocks, { judul, tema });
        await sesiTerbuka.sesi.jalankan(perintah);
        const deck = await sesiTerbuka.sesi.periksa();
        sesiTerbuka.deck = deck;

        const dir = mkdtempSync(path.join(tmpdir(), "nitz-deckcraft-"));
        try {
          const nama = `${judul.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 100) || "Presentasi"}.pptx`;
          const target = path.join(dir, nama);
          await sesiTerbuka.sesi.simpan(target);
          return { data: readFileSync(target), nama };
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      });

      res.writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Length": hasil.data.length,
        "Content-Disposition": `attachment; filename="${hasil.nama}"`,
        "Cache-Control": "no-store",
      });
      res.end(hasil.data);
      return true;
    }

    kirimJson(res, 404, { galat: "Rute tidak dikenal." });
    return true;
  } catch (e) {
    kirimJson(res, 500, {
      galat: e instanceof Error ? e.message : "Kesalahan tak diketahui.",
    });
    return true;
  }
}

/** Tutup sesi DeckCraft saat server berhenti. */
export async function tutupDeckcraft() {
  if (sesiTerbuka) {
    await sesiTerbuka.sesi.berhenti();
    sesiTerbuka = null;
  }
}
