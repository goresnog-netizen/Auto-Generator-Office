/**
 * Uji integrasi: apakah `blokKePerintah` + bridge DeckcraftSession benar-benar
 * menghasilkan blok kode ber-font monospace di slide yang benar?
 *
 * Ini uji end-to-end ke binary DeckCraft sungguhan.
 */
import { createHash } from "node:crypto";
import { DeckcraftSession, periksaDeckcraft } from "../src/lib/deckcraft.ts";
import { blokKePerintah, FONT_KODE } from "../src/lib/deckcraft-ppt.ts";

const cek = (label: string, ok: boolean, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan" },
  { id: "p1", type: "paragraph", text: "Paragraf pengantar biasa." },
  { id: "h2", type: "heading", level: 2, text: "Kode" },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;\nconst b = 2;" },
  { id: "h3", type: "heading", level: 2, text: "Penutup" },
  { id: "p2", type: "paragraph", text: "Paragraf penutup." },
];

async function main() {
  const info = await periksaDeckcraft();
  console.log("DeckCraft:", info.versi, info.tersedia ? "tersedia" : "TIDAK TERSEDIA");
  if (!info.tersedia) {
    console.log(info.galat);
    return;
  }

  const perintah = blokKePerintah(BLOK as never, { judul: "Uji Kode", tema: "Slate" });
  console.log("\n== perintah yang dihasilkan ==");
  for (const p of perintah) {
    console.log(`  [slide ${p.slide ?? "-"}] ${p.command} ${JSON.stringify(p.params ?? {}).slice(0, 80)}`);
  }

  cek("ada perintah format.font", perintah.some((p) => p.command === "format.font"));
  cek("ada perintah format.size", perintah.some((p) => p.command === "format.size"));
  cek("ada perintah shape.fill", perintah.some((p) => p.command === "shape.fill"));
  cek("ada perintah shape.line", perintah.some((p) => p.command === "shape.line"));
  cek("perintah slide.go tak dibuat konverter (bridge yang Menyisipkannya)", !perintah.some((p) => p.command === "slide.go"));

  const sesi = new DeckcraftSession(info.binPath);
  try {
    await sesi.mulai();
    const hasil = await sesi.jalankan(perintah);
    console.log("\n== balasan batch ==");
    console.log(hasil.replace(/\s+/g, " ").slice(0, 1500));

    const deck = await sesi.periksa();
    console.log("\n== deck ==");
    for (const s of deck.slides) console.log(`  slide ${s.index}: "${s.title}" shapes=${s.shapes}`);

    // Slide kode = slide 1 (index 1): heading "Kode".
    const idxKode = deck.slides.findIndex((s) => s.title === "Kode");
    cek("slide kode ditemukan", idxKode >= 0, `index ${idxKode}`);

    // Pindah ke slide kode, lalu periksa shape.
    //
    // CATATAN: `slide.inspect` hanya memberi teks polos (tanpa properti run),
    // jadi font HARUS dibaca dari `shape.inspect`. Itu yang dilakukan di sini.
    await sesi.jalankanEngine("slide.go", { index: idxKode });
    const ins = await sesi.jalankanEngine("slide.inspect", {});
    const data = JSON.parse(ins) as {
      shapes: { id: number; kind: string; text?: string }[];
    };
    console.log("\n== shape di slide kode ==");
    for (const sh of data.shapes) {
      console.log(`  id=${sh.id} kind=${sh.kind} text=${JSON.stringify((sh.text ?? "").slice(0, 40))}`);
    }

    const boxKode = data.shapes.find((s) => s.kind === "textBox");
    cek("ada text box di slide kode", !!boxKode);

    // `shape.inspect` -> `shape.text.paragraphs[].runs[].props.font`
    const detail = JSON.parse(
      await sesi.jalankanEngine("shape.inspect", { id: boxKode!.id }),
    ) as {
      shape: {
        text: {
          paragraphs?: {
            runs?: { props?: { font?: string; size?: number } }[];
          }[];
        };
      };
    };
    const run = detail.shape.text.paragraphs?.[0]?.runs?.[0];
    const font = run?.props?.font;
    const size = run?.props?.size;
    console.log(
      `  font=${font ?? "-"} size=${size ?? "-"} (shape ${boxKode!.id})`,
    );
    cek("text box kode ber-font monospace", font === "Liberation Mono", `font=${font}`);
    cek("ukuran font kode 16pt", size === 16, `size=${size}`);

    // Kontrol: slide paragraf harus TIDAK ber-font Consolas.
    const idxPar = deck.slides.findIndex((s) => s.title === "Laporan");
    await sesi.jalankanEngine("slide.go", { index: idxPar });
    const ins2 = JSON.parse(await sesi.jalankanEngine("slide.inspect", {})) as {
      shapes: { id: number; kind: string }[];
    };
    const boxPar = ins2.shapes.find((s) => s.kind === "textBox");
    const detail2 = JSON.parse(
      await sesi.jalankanEngine("shape.inspect", { id: boxPar!.id }),
    ) as {
      shape: {
        text: {
          paragraphs?: {
            runs?: { props?: { font?: string } }[];
          }[];
        };
      };
    };
    const fontPar = detail2.shape.text.paragraphs?.[0]?.runs?.[0]?.props?.font;
    cek(
      "paragraf biasa TIDAK ikut ber-font kode",
      fontPar !== "Liberation Mono",
      `font paragraf=${fontPar ?? "-"}`,
    );

    // ---- Font benar-benar DIRENDER, bukan fallback ----
    //
    // `font.used` hanya mencatat nama yang diminta; engine tetap bisa
    // menggambar dengan fallback kalau font itu tak terpasang. Buktinya
    // dengan membandingkan hash PNG: render "Liberation Mono" harus
    // BERBEDA dari render font tak dikenal (fallback).
    const TEKS = "iiiiiiiiii\nMMMMMMMMMM\nWWWWWWWWWW\n0000000000";
    const hashRender = async (family: string | null): Promise<string> => {
      await sesi.jalankan([
        { command: "file.new", params: { theme: "DeckCraft", blank: true } },
        { command: "slide.new", params: { layout: "titleOnly", title: "Font" } },
        {
          command: "insert.textBox",
          params: { rect: [60, 150, 700, 180], text: TEKS },
        },
        ...(family
          ? [{ command: "format.font", params: { family } }]
          : []),
        { command: "format.size", params: { size: 24 } },
      ]);
      // ile.new dengan lank: true TIDAK membuat slide, jadi slide
      // yang kita buat tadi berindeks 0.
      const png = await sesi.renderSlide(0, 1);
      const buf = Buffer.from(png, "base64");
      return createHash("sha256").update(buf).digest("hex").slice(0, 12);
    };

    const hashKode = await hashRender(FONT_KODE);
    const hashFallback = await hashRender("FontYangPastiTidakAda999");
    console.log(
      `  render ${FONT_KODE}: ${hashKode} | render font tak dikenal: ${hashFallback}`,
    );
    cek(
      "font kode benar-benar dirender (bukan fallback)",
      hashKode !== hashFallback,
      "kalau sama, engine memakai fallback - nama font tak berpengaruh",
    );
  } finally {
    await sesi.berhenti();
  }
  console.log("\nSelesai.");
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exitCode = 1;
});
