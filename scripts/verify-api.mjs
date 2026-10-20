/** Uji API DeckCraft lewat HTTP: status → build → preview → export. */
const DASAR = process.env.DASAR || "http://127.0.0.1:5180";

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif dan temuan utama." },
  { id: "l1", type: "list", ordered: false, items: [
    { text: "Pendapatan tumbuh 42% YoY" },
    { text: "Biaya operasional turun 11%", children: [{ text: "Infrastruktur" }] },
  ]},
  { id: "h2", type: "heading", level: 2, text: "Segmen Pasar" },
  { id: "t1", type: "table", headers: ["Segmen", "Porsi", "YoY"], rows: [
    ["Enterprise", "48%", "+18%"], ["SMB", "34%", "+9%"], ["Individu", "18%", "+3%"],
  ]},
  { id: "h3", type: "heading", level: 2, text: "Tren Pendapatan" },
  { id: "c1", type: "chart", chartType: "bar", data: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [{ label: "Pendapatan", data: [120, 180, 240, 310] }],
  }},
];

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

const s = await (await fetch(`${DASAR}/api/deckcraft/status`)).json();
cek("status: DeckCraft tersedia", s.tersedia, s.versi);
cek("status: daftar tema ada", s.tema.length > 0, s.tema.join(", "));

const build = await (await fetch(`${DASAR}/api/deckcraft/build`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: BLOK, judul: "Laporan Kinerja 2026", tema: "Slate" }),
})).json();
cek("build: deck terbentuk", Array.isArray(build.deck?.slides), `${build.deck?.slides?.length} slide`);
for (const sl of build.deck?.slides ?? []) {
  console.log(`      slide ${sl.index}: "${sl.title}" (${sl.layout}, ${sl.shapes} shape)`);
}

const prev = await (await fetch(`${DASAR}/api/deckcraft/preview?slide=0&scale=1`)).json();
cek("preview: PNG/base64 tersedia", typeof prev.png === "string" && prev.png.length > 2000, `${prev.png?.length} char`);

const exp = await fetch(`${DASAR}/api/deckcraft/export`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: BLOK, judul: "Laporan Kinerja 2026", tema: "Slate" }),
});
cek("export: status 200", exp.ok, String(exp.status));
const buf = Buffer.from(await exp.arrayBuffer());
cek("export: berkas PPTX terisi", buf.length > 15000, `${buf.length} byte`);
// Signature PPTX = "PK\x03\x04"
cek("export: signature ZIP/PPTX benar", buf[0] === 0x50 && buf[1] === 0x4b, buf.subarray(0, 2).toString("hex"));

console.log("\nSelesai.");
