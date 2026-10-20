/**
 * Verifikasi claim: PPTX hasil ekspor DeckCraft benar-benar berisi
 * slide, tabel, grafik, dan SmartArt (bukan bingkai kosong).
 *
 * Membaca file .pptx sebagai ZIP (tanpa dependensi) dan memeriksa XML di dalamnya.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const PPTX = path.resolve("vendors/deckcraft-bin/verify/deck-verifikasi.pptx");
const KELUARAN = path.resolve("vendors/deckcraft-bin/verify");

const cek = (label, ok, detail = "") => {
  console.log(`[${ok ? "OK  " : "GAGAL"}] ${label}${detail ? " — " + detail : ""}`);
  if (!ok) process.exitCode = 1;
};

// Ekstrak PPTX ke folder sementara (PowerShell Expand-Archive).
const diekstrak = path.join(KELUARAN, "pptx-extract");
execFileSync(
  "powershell",
  [
    "-NoProfile",
    "-Command",
    `Remove-Item -Recurse -Force '${diekstrak}' -ErrorAction SilentlyContinue; ` +
      `Expand-Archive -Path '${PPTX}' -DestinationPath '${diekstrak}' -Force`,
  ],
  { stdio: "pipe" },
);

const { readdirSync, readFileSync: rf, existsSync } = await import("node:fs");
const slideDir = path.join(diekstrak, "ppt", "slides");
const slideFiles = existsSync(slideDir)
  ? readdirSync(slideDir).filter((f) => f.endsWith(".xml"))
  : [];

cek("PPTX berisi slide", slideFiles.length > 0, `${slideFiles.length} slide`);

const semuaXml = slideFiles
  .map((f) => rf(path.join(slideDir, f), "utf8"))
  .join("\n");

cek("slide punya tabel native", semuaXml.includes("<a:tbl>"));
cek("slide punya grafik native", semuaXml.includes("chart"));
cek("slide punya SmartArt / bentuk", /<a:graphicFrame|<p:sp>/.test(semuaXml));

// Isi chart: pastikan ada seri (grafik kosong = bug .toUpperCase()).
const chartDir = path.join(diekstrak, "ppt", "charts");
if (existsSync(chartDir)) {
  const chartFiles = readdirSync(chartDir).filter((f) => f.endsWith(".xml"));
  const chartXml = chartFiles.map((f) => rf(path.join(chartDir, f), "utf8")).join("\n");
  cek("grafik punya elemen seri data", chartXml.includes("<c:ser>"), `${chartFiles.length} chart`);
  cek("grafik punya barChart (bukan bingkai kosong)", chartXml.includes("barChart"));
} else {
  cek("chart folder ada", false, "tidak ditemukan");
}

// Teks slide harus terbaca (judul ada).
const adaTeks = /<a:t>[^<]{3,}<\/a:t>/.test(semuaXml);
cek("slide memuat teks nyata", adaTeks);

console.log("\nSelesai.");
