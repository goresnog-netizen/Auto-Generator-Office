/**
 * Uji konkurensi: beberapa permintaan build/preview/export paralel.
 * Tujuannya memastikan serialisasi deck bekerja dan tidak ada yang rusak.
 */
const DASAR = process.env.DASAR || "http://127.0.0.1:8090";

const blok = (judul) => [
  { id: "h1", type: "heading", level: 1, text: judul },
  { id: "p1", type: "paragraph", text: `Isi ${judul}` },
  { id: "h2", type: "heading", level: 2, text: "Data" },
  {
    id: "t1",
    type: "table",
    headers: ["A", "B"],
    rows: [
      ["1", "2"],
      ["3", "4"],
    ],
  },
];

const cek = (l, ok, d = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${l}${d ? " — " + d : ""}`);
  if (!ok) process.exitCode = 1;
};

// 1. Lima build paralel dengan isi berbeda → semua harus sukses dan
//    deck terakhir harus sesuai permintaan terakhir yang selesai.
const hasil = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    fetch(`${DASAR}/api/deckcraft/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocks: blok(`Deck ${i}`),
        judul: `Deck ${i}`,
        tema: "Slate",
      }),
    })
      .then((r) => r.json())
      .then((d) => ({ i, ok: !!d.deck, n: d.deck?.slides?.length ?? 0, err: d.galat })),
  ),
);
cek("5 build paralel semuanya sukses", hasil.every((h) => h.ok && h.n > 0),
  hasil.map((h) => `${h.i}:${h.n}`).join(" "));

// 2. Preview paralel dengan build → tidak boleh error.
//    Deck contoh ini punya 2 slide, jadi hanya slide 0 dan 1 yang valid.
const campur = await Promise.all([
  fetch(`${DASAR}/api/deckcraft/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks: blok("Campur"), judul: "Campur", tema: "Slate" }),
  }).then((r) => r.json()),
  ...[0, 1].map((i) =>
    fetch(`${DASAR}/api/deckcraft/preview?slide=${i}&scale=1`)
      .then((r) => r.json())
      .then((d) => (d.png ? { ok: true, len: d.png.length } : { ok: false, err: d.galat })),
  ),
]);
const previews = campur.slice(1);
cek("preview paralel dengan build tetap aman", previews.every((p) => p.ok),
  previews.map((p) => p.len ?? p.err).join(" "));

// 2b. Preview slide di luar rentang → pesan error harus informatif,
//     bukan "tidak mengembalikan gambar" yang tidak berguna.
const diLuar = await fetch(`${DASAR}/api/deckcraft/preview?slide=99&scale=1`)
  .then((r) => r.json())
  .catch((e) => ({ galat: e.message }));
cek("preview slide di luar rentas memberi pesan jelas",
  typeof diLuar.galat === "string" && /slide/i.test(diLuar.galat),
  diLuar.galat ?? "tidak ada pesan");

// 3. Ekspor paralel → semua harus mengembalikan PPTX valid (signature PK).
const eksports = await Promise.all(
  [0, 1, 2].map((i) =>
    fetch(`${DASAR}/api/deckcraft/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks: blok(`Ekspor ${i}`), judul: `Ekspor ${i}`, tema: "Slate" }),
    })
      .then(async (r) => {
        const buf = Buffer.from(await r.arrayBuffer());
        return { status: r.status, len: buf.length, sig: buf.subarray(0, 2).toString("hex") };
      }),
  ),
);
cek("3 ekspor paralel menghasilkan PPTX valid",
  eksports.every((e) => e.status === 200 && e.len > 15000 && e.sig === "504b"),
  eksports.map((e) => `${e.status}/${e.len}`).join(" "));

// 4. Body kosong / blok kosong → harus 400, bukan 500.
const kosong = await fetch(`${DASAR}/api/deckcraft/build`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ blocks: [], judul: "Kosong" }),
});
cek("build tanpa blok → 400 (bukan 500)", kosong.status === 400, String(kosong.status));

console.log("\nSelesai.");
