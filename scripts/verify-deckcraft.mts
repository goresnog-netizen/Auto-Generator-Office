/**
 * Uji end-to-end bridge DeckCraft: content model → perintah → deck → PPTX → PNG.
 * Dijalankan: node --experimental-strip-types scripts/verify-deckcraft.mts
 * (atau lewat `pnpm verify:deckcraft`).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { DeckcraftSession, periksaDeckcraft } from "../src/lib/deckcraft.ts";
import { blokKePerintah, blokKeOutline } from "../src/lib/deckcraft-ppt.ts";

const KELUARAN = path.resolve("vendors/deckcraft-bin/verify");
mkdirSync(KELUARAN, { recursive: true });

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif资源和“不要”" },
  { id: "l1", type: "list", ordered: false, items: [
    { text: "Pendapatan tumbuh 42% YoY" },
    { text: "Biaya operasional turun 11%", children: [{ text: "Infrastruktur" }] },
  ]},
  { id: "h2", type: "heading", level: 2, text: "Segmen Pasar" },
  { id: "t1", type: "table", headers: ["Segmen", "Porsi", "YoY"], rows: [
    ["Enterprise", "48%", "+18%"],
    ["SMB", "34%", "+9%"],
    ["Individu", "18%", "+3%"],
  ]},
  { id: "c1", type: "chart", chartType: "bar", data: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [{ label: "Pendapatan", data: [120, 180, 240, 310] }],
  }},
  { id: "d1", type: "diagram", diagramType: "mermaid",
    source: "flowchart LR\n  A[Riset] --> B[Desain]\n  B --> C[Rilis]" },
  { id: "h3", type: "heading", level: 2, text: "Langkah Selanjutnya" },
  { id: "l2", type: "list", ordered: true, items: [
    { text: "Setujui tenggat" }, { text: "Tunjuk petugas" },
  ]},
];

const cek = (label: string, kondisi: boolean, detail = "") => {
  const tanda = kondisi ? "OK  " : "GAGAL";
  console.log(`[${tanda}] ${label}${detail ? " — " + detail : ""}`);
  if (!kondisi) process.exitCode = 1;
};

async function main() {
  const info = await periksaDeckcraft();
  console.log("DeckCraft:", info.versi, info.tersedia ? "tersedia" : "TIDAK TERSEDIA", info.galat ?? "");
  cek("binary deckcraft-cli tersedia", info.tersedia, info.binPath);
  if (!info.tersedia) return;

  const perintah = blokKePerintah(BLOK as never, {
    judul: "Laporan Kinerja 2026",
    tema: "Slate",
  });
  console.log(`\nPerintah yang dihasilkan: ${perintah.length}`);
  for (const p of perintah) {
    console.log(`  ${p.command} ${JSON.stringify(p.params ?? {}).slice(0, 90)}`);
  }
  cek("menghasilkan perintah slide.new", perintah.some((p) => p.command === "slide.new"));
  cek("memuat perintah insert.table", perintah.some((p) => p.command === "insert.table"));
  cek("memuat perintah insert.chart", perintah.some((p) => p.command === "insert.chart"));
  cek("memuat perintah insert.smartArt", perintah.some((p) => p.command === "insert.smartArt"));

  const outline = blokKeOutline(BLOK as never);
  cek("outline markdown tidak kosong", outline.length > 50, `${outline.length} karakter`);

  const sesi = new DeckcraftSession(info.binPath);
  try {
    await sesi.mulai();
    console.log("\nSesi MCP aktif.");

    const hasilBatch = await sesi.jalankan(perintah);
    console.log("batch:", hasilBatch.slice(0, 400));

    const deck = await sesi.periksa();
    console.log(`\nDeck: "${deck.title}" tema=${deck.theme} size=${deck.slideSize.join("x")}`);
    for (const s of deck.slides) {
      console.log(`  slide ${s.index}: "${s.title}" layout=${s.layout} shapes=${s.shapes}`);
    }
    cek("deck punya slide", deck.slides.length > 0, `${deck.slides.length} slide`);
    cek("judul slide terbaca", deck.slides.some((s) => s.title.includes("Kinerja")));

    const pptxPath = path.join(KELUARAN, "deck-verifikasi.pptx");
    await sesi.simpan(pptxPath);
    cek("PPTX tersimpan", true, pptxPath);

    for (let i = 0; i < Math.min(deck.slides.length, 4); i++) {
      const png = await sesi.renderSlide(i, 1);
      const file = path.join(KELUARAN, `slide-${i + 1}.png`);
      writeFileSync(file, Buffer.from(png, "base64"));
      cek(`slide ${i + 1} dirender ke PNG`, png.length > 1000, `${file}`);
    }
  } finally {
    await sesi.berhenti();
  }
  console.log("\nSelesai.");
}

main().catch((e) => {
  console.error("GAGAL:", e);
  process.exitCode = 1;
});
