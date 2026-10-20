/**
 * Infografis PNG — dirender dengan Canvas API murni (tanpa dependensi).
 * Ukuran 1080x1350 (rasio 4:5, pas untuk feed). Palet mengikuti tema aplikasi.
 */
import type { ContentBlock } from "../types";
import { bersihkanNamaBerkas, unduhBlob } from "./exporter";

export type TemaInfografis = "dark" | "light";

interface PaletInfografis {
  bg: string;
  surface: string;
  surfaceAtas: string;
  brand: string;
  text: string;
  muted: string;
  garis: string;
}

const PALET: Record<TemaInfografis, PaletInfografis> = {
  dark: {
    bg: "#1c1d1c",
    surface: "#222423",
    surfaceAtas: "#282a29",
    brand: "#b5cea5",
    text: "#dedfdd",
    muted: "#8f938f",
    garis: "#3a3d3a",
  },
  light: {
    bg: "#f5f5f7",
    surface: "#ffffff",
    surfaceAtas: "#eef1ea",
    brand: "#5e774e",
    text: "#1a1a1d",
    muted: "#6b6b74",
    garis: "#dcdce2",
  },
};

const LEBAR = 1080;
const TINGGI = 1350;

interface KartuStat {
  label: string;
  nilai: string;
  catatan: string;
}

function angka(n: number): string {
  return n.toLocaleString("id-ID");
}

function kotak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const jari = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + jari, y);
  ctx.arcTo(x + w, y, x + w, y + h, jari);
  ctx.arcTo(x + w, y + h, x, y + h, jari);
  ctx.arcTo(x, y + h, x, y, jari);
  ctx.arcTo(x, y, x + w, y, jari);
  ctx.closePath();
}

function bungkusTeks(
  ctx: CanvasRenderingContext2D,
  teks: string,
  maxWidth: number,
): string[] {
  const baris: string[] = [];
  let akumulasi = "";
  for (const kata of teks.split(/\s+/)) {
    const coba = akumulasi ? `${akumulasi} ${kata}` : kata;
    if (ctx.measureText(coba).width > maxWidth && akumulasi) {
      baris.push(akumulasi);
      akumulasi = kata;
    } else {
      akumulasi = coba;
    }
  }
  if (akumulasi) baris.push(akumulasi);
  return baris;
}

function hitungStat(blocks: ContentBlock[]): KartuStat[] {
  const grafikPertama = blocks.find((b) => b.type === "chart");
  const kartu: KartuStat[] = [
    {
      label: "Blok isi",
      nilai: angka(blocks.length),
      catatan: "total blok dokumen",
    },
    {
      label: "Paragraf",
      nilai: angka(blocks.filter((b) => b.type === "paragraph").length),
      catatan: "blok teks naratif",
    },
    {
      label: "Tabel & daftar",
      nilai: angka(
        blocks.filter((b) => b.type === "table" || b.type === "list").length,
      ),
      catatan: "data terstruktur",
    },
  ];

  if (grafikPertama && grafikPertama.type === "chart") {
    const seri = grafikPertama.data.datasets[0];
    const nilai = seri?.data ?? [];
    const puncak = nilai.length ? Math.max(...nilai) : 0;
    kartu.push({
      label: `Puncak ${seri?.label || "seri"}`,
      nilai: angka(puncak),
      catatan: `grafik ${grafikPertama.chartType} · ${grafikPertama.data.labels.length} label`,
    });
  } else {
    const diagram = blocks.filter((b) => b.type === "diagram").length;
    kartu.push({
      label: "Diagram",
      nilai: angka(diagram),
      catatan: "blok visual",
    });
  }
  return kartu.slice(0, 4);
}

interface DataBatang {
  labels: string[];
  nilai: number[];
  namaSeri: string;
}

function ambilBatang(blocks: ContentBlock[]): DataBatang | null {
  const grafik = blocks.find((b) => b.type === "chart");
  if (!grafik || grafik.type !== "chart") return null;
  const seri = grafik.data.datasets[0];
  if (!seri || seri.data.length === 0) return null;
  const nilai = grafik.data.labels.map((_, i) => Number(seri.data[i] ?? 0));
  return {
    labels: grafik.data.labels,
    nilai,
    namaSeri: seri.label || "Seri 1",
  };
}

function gambarBatang(
  ctx: CanvasRenderingContext2D,
  data: DataBatang,
  x: number,
  y: number,
  w: number,
  h: number,
  p: PaletInfografis,
): void {
  const n = data.nilai.length;
  const max = Math.max(...data.nilai, 1);
  const min = Math.min(...data.nilai, 0);
  const rentang = max - min || 1;
  const dasarY = y + h;
  const sumbuX = dasarY;
  const lebarGrafik = h - 44;
  const slot = w / n;
  const lebarBatang = Math.min(72, slot * 0.56);

  // Garis bantu horizontal (skala jujur: mulai dari sumbu, bukan terpotong)
  ctx.strokeStyle = p.garis;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const gy = y + 44 + (lebarGrafik * i) / 4;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.muted;
    ctx.font = "500 20px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(angka(Math.round(max - (rentang * i) / 4)), x - 12, gy + 7);
  }

  data.nilai.forEach((nilai, i) => {
    const tinggi = ((nilai - min) / rentang) * lebarGrafik;
    const bx = x + slot * i + (slot - lebarBatang) / 2;
    const by = sumbuX - tinggi;
    ctx.fillStyle = p.brand;
    kotak(ctx, bx, by, lebarBatang, tinggi, 8);
    ctx.fill();

    ctx.fillStyle = p.text;
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(angka(nilai), bx + lebarBatang / 2, by - 12);

    ctx.fillStyle = p.muted;
    ctx.font = "500 18px system-ui, sans-serif";
    const label = data.labels[i] ?? "";
    for (const [j, baris] of bungkusTeks(ctx, label, slot - 8).entries()) {
      ctx.fillText(baris, bx + lebarBatang / 2, sumbuX + 30 + j * 22);
    }
  });

  ctx.strokeStyle = p.garis;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, sumbuX);
  ctx.lineTo(x + w, sumbuX);
  ctx.stroke();
}

/**
 * Render infografis satu halaman lalu unduh sebagai PNG.
 * `tema` menentukan palet gelap/terang.
 */
export async function renderInfografisPng(
  judul: string,
  blocks: ContentBlock[],
  tema: TemaInfografis,
): Promise<void> {
  const p = PALET[tema];
  const canvas = document.createElement("canvas");
  canvas.width = LEBAR;
  canvas.height = TINGGI;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kanvas 2D tidak tersedia di browser ini.");

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, LEBAR, TINGGI);

  // ===== Talang kepala =====
  const talang = ctx.createLinearGradient(0, 0, LEBAR, 0);
  talang.addColorStop(0, p.brand);
  talang.addColorStop(1, p.surfaceAtas);
  ctx.fillStyle = talang;
  ctx.fillRect(0, 0, LEBAR, 12);

  ctx.fillStyle = p.text;
  ctx.font = "800 58px system-ui, sans-serif";
  ctx.textAlign = "left";
  const barisJudul = bungkusTeks(ctx, judul || "Dokumen NitZ-909", LEBAR - 96);
  barisJudul.slice(0, 2).forEach((baris, i) => {
    ctx.fillText(baris, 48, 120 + i * 66);
  });

  const tanggal = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  ctx.fillStyle = p.muted;
  ctx.font = "500 26px system-ui, sans-serif";
  ctx.fillText(
    `NitZ-909 · ${tanggal} · ${blocks.length} blok`,
    48,
    120 + Math.min(barisJudul.length, 2) * 66 + 24,
  );

  // ===== Kartu statistik =====
  const kartu = hitungStat(blocks);
  const kartuY = 300;
  const kartuH = 176;
  const jarak = 20;
  const lebarKartu = (LEBAR - 96 - jarak * (kartu.length - 1)) / kartu.length;
  kartu.forEach((k, i) => {
    const x = 48 + (lebarKartu + jarak) * i;
    ctx.fillStyle = p.surface;
    kotak(ctx, x, kartuY, lebarKartu, kartuH, 18);
    ctx.fill();
    ctx.strokeStyle = p.garis;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = p.brand;
    ctx.fillRect(x, kartuY + 18, 44, 5);
    ctx.fillStyle = p.text;
    ctx.font = "800 48px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(k.nilai, x + 18, kartuY + 92);
    ctx.fillStyle = p.text;
    ctx.font = "600 22px system-ui, sans-serif";
    ctx.fillText(k.label, x + 18, kartuY + 124);
    ctx.fillStyle = p.muted;
    ctx.font = "400 18px system-ui, sans-serif";
    for (const [j, baris] of bungkusTeks(ctx, k.catatan, lebarKartu - 36)
      .slice(0, 2)
      .entries()) {
      ctx.fillText(baris, x + 18, kartuY + 150 + j * 20);
    }
  });

  // ===== Panel grafik =====
  const panelY = kartuY + kartuH + 44;
  const panelH = 560;
  ctx.fillStyle = p.surface;
  kotak(ctx, 48, panelY, LEBAR - 96, panelH, 24);
  ctx.fill();
  ctx.strokeStyle = p.garis;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = p.text;
  ctx.font = "700 32px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Ringkasan Angka", 84, panelY + 60);

  const batang = ambilBatang(blocks);
  if (batang) {
    gambarBatang(ctx, batang, 148, panelY + 100, LEBAR - 96 - 164, 400, p);
    ctx.fillStyle = p.muted;
    ctx.font = "400 20px system-ui, sans-serif";
    ctx.fillText(
      `Sumber: seri "${batang.namaSeri}" dari blok grafik pertama — digambar ulang sebagai grafik batang.`,
      84,
      panelY + panelH - 34,
    );
  } else {
    ctx.fillStyle = p.muted;
    ctx.font = "400 24px system-ui, sans-serif";
    ctx.fillText(
      "Belum ada blok grafik — tambahkan grafik untuk mengisi panel ini.",
      84,
      panelY + 200,
    );
  }

  // ===== Paragraph inti =====
  const inti = blocks.find(
    (b) => b.type === "paragraph" && (b as { text?: string }).text,
  );
  const intiY = panelY + panelH + 48;
  ctx.fillStyle = p.surfaceAtas;
  kotak(ctx, 48, intiY, LEBAR - 96, 210, 24);
  ctx.fill();
  ctx.fillStyle = p.brand;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("INTI DOKUMEN", 84, intiY + 48);
  ctx.fillStyle = p.text;
  ctx.font = "400 26px system-ui, sans-serif";
  const teksInti =
    inti && inti.type === "paragraph" ? inti.text.slice(0, 320) : "";
  bungkusTeks(ctx, teksInti || "Belum ada paragraf.", LEBAR - 96 - 72)
    .slice(0, 3)
    .forEach((baris, i) => {
      ctx.fillText(baris, 84, intiY + 100 + i * 36);
    });

  // ===== Kaki =====
  const kakiY = TINGGI - 66;
  ctx.fillStyle = p.surfaceAtas;
  ctx.fillRect(0, kakiY, LEBAR, TINGGI - kakiY);
  ctx.fillStyle = p.brand;
  ctx.fillRect(48, kakiY + 22, 120, 6);
  ctx.fillStyle = p.muted;
  ctx.font = "500 22px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("NitZ-909 — Platform Pembuat Dokumen", 48, kakiY + 52);
  ctx.textAlign = "right";
  ctx.fillText(`${LEBAR}x${TINGGI}`, LEBAR - 48, kakiY + 52);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Infografis gagal dibuat (canvas kosong).");
  unduhBlob(
    blob,
    `${bersihkanNamaBerkas(judul || "Dokumen NitZ-909")}-infografis.png`,
  );
}
