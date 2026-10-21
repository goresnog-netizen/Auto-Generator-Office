/**
 * TEST RUN: render deck nyata (termasuk blok kode) dan ekspor PDF + GIF.
 *
 * Menghasilkan berkas yang bisa langsung dibuka:
 *  - testrun/deck-kode.png     (slide kode, bukti font monospace)
 *  - testrun/deck.pdf         (ekspor PDF dari DeckCraft)
 *  - testrun/deck.gif         (ekspor GIF dari DeckCraft)
 *  - testrun/deck.pptx        (ekspor PPTX dari DeckCraft)
 *  - testrun/diagram.svg      (diagram Mermaid ter-render)
 */
import { writeFileSync, mkdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const DASAR = process.env.DASAR || "http://127.0.0.1:5180";
const OUT = path.resolve("testrun");
mkdirSync(OUT, { recursive: true });

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif: pendapatan tumbuh 42% YoY." },
  { id: "h2", type: "heading", level: 2, text: "Cuplikan Kode" },
  {
    id: "c1",
    type: "code",
    language: "ts",
    code: "const tahun = 2026;\nconst pertumbuhan = 42;\n\nfunction ringkas() {\n  return { tahun, pertumbuhan };\n}",
  },
  { id: "h3", type: "heading", level: 2, text: "Segmen Pasar" },
  {
    id: "t1",
    type: "table",
    headers: ["Segmen", "Porsi", "YoY"],
    rows: [
      ["Enterprise", "48%", "+18%"],
      ["SMB", "34%", "+9%"],
      ["Individu", "18%", "+3%"],
    ],
  },
  { id: "h4", type: "heading", level: 2, text: "Tren Pendapatan" },
  {
    id: "c2",
    type: "chart",
    chartType: "bar",
    data: {
      labels: ["Q1", "Q2", "Q3", "Q4"],
      datasets: [{ label: "Pendapatan", data: [120, 180, 240, 310] }],
    },
  },
];

console.log("== build deck ==");
const build = await (
  await fetch(`${DASAR}/api/deckcraft/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: BLOK, judul: "Laporan Kinerja 2026", tema: "Slate" }),
  })
).json();
const deck = build.deck;
if (!deck?.slides?.length) {
  console.log("GAGAL build:", JSON.stringify(build).slice(0, 300));
  process.exit(1);
}
for (const s of deck.slides) {
  console.log(`  slide ${s.index}: "${s.title}" (${s.shapes} shape)`);
}

// --- Pratinjau slide kode (index 1) ---
console.log("\n== pratinjau slide kode ==");
const prev = await (
  await fetch(`${DASAR}/api/deckcraft/preview?slide=1&scale=1.6`)
).json();
if (prev.png) {
  const f = path.join(OUT, "deck-kode.png");
  writeFileSync(f, Buffer.from(prev.png, "base64"));
  console.log(`  -> ${f} (${statSync(f).size} byte)`);
} else {
  console.log("  GAGAL: tak ada PNG");
}

// --- Filmstrip semua slide ---
console.log("\n== filmstrip ==");
const fsr = await (await fetch(`${DASAR}/api/deckcraft/filmstrip?scale=1`)).json();
if (fsr.gambar?.length) {
  const f = path.join(OUT, "filmstrip.png");
  // Gabung jadi satu gambar vertikal? Lebih mudah: simpan slide pertama.
  writeFileSync(f, Buffer.from(fsr.gambar[0], "base64"));
  console.log(`  ${fsr.gambar.length} thumbnail; contoh -> ${f}`);
}

// --- Ekspor format ---
for (const format of ["pptx", "pdf", "gif"]) {
  console.log(`\n== ekspor ${format.toUpperCase()} ==`);
  const resp = await fetch(`${DASAR}/api/deckcraft/export-format`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: BLOK,
      judul: "Laporan Kinerja 2026",
      tema: "Slate",
      format,
      ...(format === "gif" ? { secondsPerSlide: 2 } : {}),
    }),
  });
  if (!resp.ok) {
    console.log("  GAGAL:", resp.status, (await resp.text()).slice(0, 200));
    continue;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  const f = path.join(OUT, `deck.${format}`);
  writeFileSync(f, buf);
  const magic = buf.subarray(0, 5).toString("latin1");
  console.log(`  -> ${f} (${buf.length} byte, magic ${JSON.stringify(magic)})`);
}

// --- Diagram Mermaid ---
console.log("\n== diagram Mermaid ==");
const { DiagramGenerator } = await import("../src/generators/diagram.ts");
const gen = new DiagramGenerator({
  outputPath: path.join(OUT, "diagram.svg"),
});
const hasil = await gen.generate(
  { type: "diagram", title: "Alur", metadata: { author: "Uji" } },
  {
    blocks: [
      {
        id: "d1",
        type: "diagram",
        diagramType: "mermaid",
        source:
          "flowchart LR\n  A[Riset] --> B[Desain]\n  B --> C[Rilis]\n  C --> D[Evaluasi]",
      },
    ],
  },
);
console.log("  sukses:", hasil.success, "| fallback:", hasil.metadata?.fallback ?? false);
if (hasil.metadata?.message) console.log("  pesan:", hasil.metadata.message);
const svgPath = path.join(OUT, "diagram.svg");
if (existsSyncSafe(svgPath)) {
  console.log(`  -> ${svgPath} (${statSync(svgPath).size} byte)`);
}

function existsSyncSafe(p) {
  try {
    return statSync(p).size > 0;
  } catch {
    return false;
  }
}

console.log("\nSelesai.");
