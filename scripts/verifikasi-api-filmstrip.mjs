/**
 * Uji API DeckCraft untuk fitur baru: filmstrip semua slide + ekspor
 * berformat (PDF, GIF).
 *
 * Butuh server dev yang sudah jalan (DASAR, default http://127.0.0.1:5180).
 */
const DASAR = process.env.DASAR || "http://127.0.0.1:5180";

const BLOK = [
  { id: "h1", type: "heading", level: 1, text: "Laporan Kinerja 2026" },
  { id: "p1", type: "paragraph", text: "Ringkasan eksekutif dan temuan utama." },
  { id: "h2", type: "heading", level: 2, text: "Cuplikan Kode" },
  { id: "c1", type: "code", language: "ts", code: "const a = 1;\nconst b = 2;" },
  { id: "h3", type: "heading", level: 2, text: "Segmen Pasar" },
  { id: "t1", type: "table", headers: ["Segmen", "Porsi"], rows: [
    ["Enterprise", "48%"], ["SMB", "34%"],
  ]},
];

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

/** Signature berkas: Bytes pertama sebagai string heksadesimal. */
const signature = (buf) => buf.subarray(0, 4).toString("hex");

console.log("== status ==");
const s = await (await fetch(`${DASAR}/api/deckcraft/status`)).json();
cek("DeckCraft tersedia", s.tersedia, s.versi);
if (!s.tersedia) {
  console.log("   galat:", s.galat);
  process.exit(0);
}

console.log("\n== build ==");
const build = await (await fetch(`${DASAR}/api/deckcraft/build`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: BLOK, judul: "Laporan Kinerja 2026", tema: "Slate" }),
})).json();
const jumlahSlide = build.deck?.slides?.length ?? 0;
cek("deck terbentuk", jumlahSlide > 0, `${jumlahSlide} slide`);
for (const sl of build.deck?.slides ?? []) {
  console.log(`      slide ${sl.index}: "${sl.title}" (${sl.shapes} shape)`);
}

console.log("\n== filmstrip ==");
const fsResp = await fetch(`${DASAR}/api/deckcraft/filmstrip?scale=0.35`);
cek("filmstrip: status 200", fsResp.ok, String(fsResp.status));
const fsData = await fsResp.json();
const gambar = fsData.gambar ?? [];
cek(
  "filmstrip: satu gambar per slide",
  gambar.length === jumlahSlide,
  `${gambar.length} gambar / ${jumlahSlide} slide`,
);
cek(
  "filmstrip: semua gambar berisi base64 PNG",
  gambar.length > 0 && gambar.every((g) => typeof g === "string" && g.length > 500),
  gambar.length > 0 ? `panjang min ${Math.min(...gambar.map((g) => g.length))}` : "-",
);
cek(
  "filmstrip: base64 diawali signature PNG",
  gambar.length > 0 && gambar.every((g) => g.startsWith("iVBORw0KGgo")),
);
cek(
  "filmstrip: tiap gambar unik (slide berbeda tak identik)",
  gambar.length > 1 && new Set(gambar).size === gambar.length,
  `${new Set(gambar).size} unik dari ${gambar.length}`,
);

console.log("\n== export-format ==");
for (const [format, expectHex, label] of [
  ["pdf", "25504446", "PDF"],
  ["gif", "47494638", "GIF"],
]) {
  const resp = await fetch(`${DASAR}/api/deckcraft/export-format`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blocks: BLOK,
      judul: "Laporan Kinerja 2026",
      tema: "Slate",
      format,
      ...(format === "gif" ? { secondsPerSlide: 1 } : {}),
    }),
  });
  cek(`export ${label}: status 200`, resp.ok, String(resp.status));
  if (!resp.ok) {
    const err = await resp.text();
    console.log("   galat:", err.slice(0, 300));
    continue;
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  cek(`export ${label}: berkas terisi`, buf.length > 2000, `${buf.length} byte`);
  cek(
    `export ${label}: signature benar`,
    signature(buf).startsWith(expectHex),
    signature(buf),
  );
  const cd = resp.headers.get("content-disposition") ?? "";
  cek(
    `export ${label}: nama berkas di Content-Disposition`,
    cd.includes(`.${format}`),
    cd,
  );
}

console.log("\n== format tak didukung ==");
const bad = await fetch(`${DASAR}/api/deckcraft/export-format`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: BLOK, judul: "X", tema: "Slate", format: "docx" }),
});
cek("format tak didukung: status 400", bad.status === 400, String(bad.status));
const badData = await bad.json();
cek(
  "format tak didukung: pesan menyebutkan pilihan yang valid",
  typeof badData.galat === "string" && badData.galat.includes("pdf"),
  badData.galat,
);

console.log("\nSelesai.");
