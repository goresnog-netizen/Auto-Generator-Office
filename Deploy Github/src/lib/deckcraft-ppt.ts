/**
 * Konverter konten NitZ-909 → perintah DeckCraft.
 *
 * Isi kanvas NitZ-909 (`ContentBlock[]`) diterjemahkan menjadi urutan perintah
 * engine DeckCraft. Dua jalur tersedia:
 *
 *  1. `blokKePerintah` — build eksplisit per slide. Memberi kendali penuh:
 *     judul slide, tabel, grafik, gambar, SmartArt, catatan pembicara.
 *  2. `blokKeOutline` — markdown ringkas yang diserahkan ke `slide.fromOutline`.
 *     Cepat, dan DeckCraft yang menata hierarki bullet.
 *
 * Aturan tata letak mengikuti slide 16:9 DeckCraft: 960 × 540 pt.
 * Margin kiri 60 pt, lebar konten 840 pt.
 */
import type {
  ChartBlock,
  ContentBlock,
  DiagramBlock,
  ImageBlock,
  ListItem,
  TableBlock,
} from "../types";
import type { DeckcraftCommand } from "./deckcraft";

/** Geometri slide DeckCraft 16:9 (titik = 1/72 inci). */
export const SLIDE_W = 960;
export const SLIDE_H = 540;
const MARGIN_X = 60;
const KONTEN_W = 840;

/** Tema DeckCraft yang tersedia di v0.8.0. */
export const TEMA_DECKCRAFT = [
  "DeckCraft",
  "Harbor",
  "Ember",
  "Meadow",
  "Nocturne",
  "Paper",
  "Coral Reef",
  "Slate",
] as const;

export type TemaDeckcraft = (typeof TEMA_DECKCRAFT)[number];

/** Pemetaan tipe grafik NitZ-909 → tipe grafik DeckCraft. */
const TIPE_GRAFIK: Record<string, string> = {
  bar: "column",
  line: "line",
  pie: "pie",
  area: "area",
  scatter: "scatter",
};

/** Sitasi Diagram (Mermaid) sebagai SmartArt proses — padanan visual terdekat. */
function smartArtDariDiagram(b: DiagramBlock): DeckcraftCommand | null {
  const sumber = b.source || "";
  if (!/-->/.test(sumber)) return null;
  // Kumpulkan seluruh label node berurutan: A[Riset] --> B[Desain] --> C[Rilis].
  const label = [...sumber.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const tahap = label.length > 0 ? label : [];
  if (tahap.length === 0) return null;
  return {
    command: "insert.smartArt",
    params: {
      kind: "process",
      items: tahap,
      // Tidak ada `rect`: `insert.smartArt` tidak menerimanya dan mengabaikannya.
      // SmartArt diposisikan otomatis oleh engine (10%–90% lebar slide,
      // 28%–88% tinggi) — lihat crates/engine/src/cmd/smartart.rs.
    },
  };
}

/** Ratakan item list (bernested) menjadi baris bertingkat (indent = tab). */
function listKeBaris(
  items: ListItem[],
  level = 0,
  keluar: string[] = [],
): string[] {
  for (const it of items) {
    keluar.push(`${"\t".repeat(level)}${it.text}`);
    if (it.children?.length) listKeBaris(it.children, level + 1, keluar);
  }
  return keluar;
}

/**
 * Terjemahkan seluruh kanvas menjadi perintah DeckCraft.
 *
 * Strategi: blok `heading` dengan level ≤ 2 menjadi pemisah slide; blok lain
 * dikelompokkan per slide. Tabel, grafik, gambar, dan diagram mendapat slide
 * sendiri karena masing-masing butuh area gambar penuh.
 */
export function blokKePerintah(
  blocks: ContentBlock[],
  options: {
    judul?: string;
    tema?: string;
    /** Sisipkan slide sampul di depan. */
    sampul?: boolean;
  } = {},
): DeckcraftCommand[] {
  const perintah: DeckcraftCommand[] = [];
  const tema = options.tema || "Slate";

  if (options.sampul && options.judul) {
    perintah.push({
      command: "file.new",
      params: { theme: tema, blank: true },
    });
    perintah.push({
      command: "slide.new",
      params: {
        layout: "titleOnly",
        title: options.judul,
      },
    });
  } else {
    // `file.new` membuka presentasi kosong; `design.theme` baru sah setelah itu.
    perintah.push({
      command: "file.new",
      params: { theme: tema, blank: true },
    });
  }

  // Judul presentasi sebagai properti berkas.
  if (options.judul) {
    perintah.push({
      command: "file.properties",
      params: { title: options.judul, author: "NitZ-909" },
    });
  }
  // Model tata letak: setiap slide memakai layout `titleOnly` (hanya judul),
  // lalu isian ditambahkan sebagai text box / tabel / grafik dengan koordinat
  // eksplisit. Alasannya: layout `titleAndContent` menaruh teks di placeholder
  // yang posisinya tidak bisa dikontrol, sehingga isian bertumpuk dengan
  // placeholder. Dengan `titleOnly` semua isi bisa ditempatkan tepat.
  let slideBaru: DeckcraftCommand[] = [];
  /** Judul heading yang menunggu isi (belum jadi slide). */
  let judulMenunggu = options.judul || "Materi";
  /** Isi slide berjalan sudah terisi atau belum. */
  let slideTerisi = false;
  /** Kursor vertikal: posisi text box berikutnya, dalam pt. */
  let kursorY = 140;

  const flushSlide = () => {
    if (slideBaru.length > 0) {
      perintah.push(...slideBaru);
    }
    slideBaru = [];
    slideTerisi = false;
    kursorY = 140;
  };

  /** Mulai slide baru dengan layout `titleOnly`. */
  const mulaiSlide = (judul: string) => {
    flushSlide();
    slideBaru = [
      { command: "slide.new", params: { layout: "titleOnly", title: judul } },
    ];
    slideTerisi = false;
    kursorY = 140;
  };

  /**
   * Tambahkan blok teks. Teks berbaris banyak (paragraf panjang, bullet)
   * diletakkan dalam satu text box agar rapi.
   */
  const tambahTeks = (teks: string, opsi: { bullet?: boolean } = {}) => {
    if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
    const baris = teks.split("\n");
    const tinggi = Math.min(Math.max(baris.length * 26, 34), 300);
    slideBaru.push({
      command: "insert.textBox",
      params: { rect: [MARGIN_X, kursorY, KONTEN_W, tinggi], text: teks },
    });
    if (opsi.bullet) {
      slideBaru.push({
        command: "format.bullets",
        params: { on: true, char: "•" },
      });
    }
    kursorY += tinggi + 16;
    slideTerisi = true;
  };

  /**
   * Slide untuk objek besar (tabel/grafik/gambar/diagram): layout `titleOnly`
   * supaya area objek memakai lebar penuh. Kalau slide berjalan masih kosong,
   * objek masuk ke slide itu; kalau sudah terisi, slide baru dibuat.
   */
  const mulaiSlideObjek = (judul: string) => {
    if (slideBaru.length === 0 || slideTerisi) {
      flushSlide();
      slideBaru = [
        { command: "slide.new", params: { layout: "titleOnly", title: judul } },
      ];
    } else {
      // Slide berjalan masih kosong: ganti layout-nya jadi titleOnly.
      slideBaru = [
        {
          command: "slide.new",
          params: { layout: "titleOnly", title: judul },
        },
      ];
    }
    slideTerisi = true;
  };

  for (const b of blocks) {
    switch (b.type) {
      case "heading": {
        if (b.level <= 2) {
          // Heading menjadi pemisah slide: flush isi sebelumnya, simpan judul.
          flushSlide();
          judulMenunggu = b.text;
        } else {
          tambahTeks(b.text);
        }
        break;
      }

      case "paragraph": {
        tambahTeks(b.text);
        break;
      }

      case "list": {
        const isi = listKeBaris(b.items);
        if (isi.length === 0) break;
        if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
        const tinggi = Math.min(isi.length * 26, 300);
        slideBaru.push({
          command: "insert.textBox",
          params: {
            rect: [MARGIN_X, kursorY, KONTEN_W, tinggi],
            text: isi.join("\n"),
          },
        });
        slideBaru.push({
          command: "format.bullets",
          params: { on: true, char: "•" },
        });
        kursorY += tinggi + 16;
        slideTerisi = true;
        break;
      }

      case "table": {
        const t = b as TableBlock;
        // Tabel mendapat slide penuh: layout titleOnly supaya tabel punya
        // area widest possible, dan judul slide memakai heading terakhir.
        mulaiSlideObjek(judulMenunggu || options.judul || "Tabel");
        slideBaru.push({
          command: "insert.table",
          params: {
            rows: t.rows.length + 1,
            cols: t.headers.length,
            data: [t.headers, ...t.rows],
            rect: [MARGIN_X, 150, KONTEN_W, 300],
          },
        });
        break;
      }

      case "chart": {
        const c = b as ChartBlock;
        mulaiSlideObjek(judulMenunggu || options.judul || "Grafik");
        slideBaru.push({
          command: "insert.chart",
          params: {
            type: TIPE_GRAFIK[c.chartType] ?? "column",
            categories: c.data.labels,
            series: c.data.datasets.map((d) => ({
              name: d.label,
              values: d.data,
            })),
            rect: [MARGIN_X, 140, KONTEN_W, 330],
          },
        });
        break;
      }

      case "image": {
        const g = b as ImageBlock;
        mulaiSlideObjek(judulMenunggu || options.judul || "Gambar");
        if (/^data:image\//i.test(g.src)) {
          const data = g.src.split(",")[1] ?? "";
          slideBaru.push({
            command: "insert.picture",
            params: {
              data,
              name: g.alt || "gambar",
              rect: [MARGIN_X, 140, KONTEN_W, 300],
            },
          });
        } else {
          // URL remote tidak bisa disalin DeckCraft tanpa unduhan; pakai keterangan.
          slideBaru.push({
            command: "insert.textBox",
            params: {
              rect: [MARGIN_X, 200, KONTEN_W, 120],
              text: g.caption || g.alt || "Gambar",
            },
          });
        }
        break;
      }

      case "diagram": {
        const smart = smartArtDariDiagram(b as DiagramBlock);
        mulaiSlideObjek(judulMenunggu || options.judul || "Diagram");
        if (smart) {
          slideBaru.push(smart);
        } else {
          slideBaru.push({
            command: "insert.textBox",
            params: {
              rect: [MARGIN_X, 150, KONTEN_W, 300],
              text: (b as DiagramBlock).source,
            },
          });
        }
        break;
      }

      case "code": {
        tambahTeks(b.code);
        break;
      }

      case "divider": {
        // Perintahnya `shape.insert` (bukan `insert.shape`) — lihat
        // `deckcraft-cli commands`.
        slideBaru.push({
          command: "shape.insert",
          params: {
            preset: "line",
            rect: [MARGIN_X, 300, KONTEN_W, 2],
          },
        });
        break;
      }

      default:
        break;
    }
  }
  flushSlide();

  // Kelompokkan perintah per slide: sebuah `slide.new` membuka slide, dan
  // perintah sesudahnya mengisinya. Slide tanpa pengisi dibuang karena hanya
  // menghasilkan halaman kosong.
  const preamble: DeckcraftCommand[] = [];
  const groups: { slide: DeckcraftCommand; isi: DeckcraftCommand[] }[] = [];
  let sekarang: (typeof groups)[number] | null = null;

  for (const p of perintah) {
    if (p.command === "slide.new") {
      sekarang = { slide: p, isi: [] };
      groups.push(sekarang);
      continue;
    }
    if (!sekarang) {
      preamble.push(p);
      continue;
    }
    sekarang.isi.push(p);
  }

  const perintahBersih: DeckcraftCommand[] = [...preamble];
  for (const g of groups) {
    if (g.isi.length === 0) continue;
    perintahBersih.push(g.slide, ...g.isi);
  }

  // Kalau tidak ada slide sama sekali, buat satu slide ringkas.
  const adaSlide = perintahBersih.some((p) => p.command === "slide.new");
  if (!adaSlide) {
    perintahBersih.push({
      command: "slide.new",
      params: {
        layout: "titleOnly",
        title: options.judul || "Presentasi NitZ-909",
      },
    });
  }

  return perintahBersih;
}

/**
 * Versi markdown ringkas untuk `slide.fromOutline`. Dipakai sebagai jalur
 * cepat saat pengguna hanya butuh deck bertitel + bullet.
 */
export function blokKeOutline(blocks: ContentBlock[]): string {
  const baris: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        // Level heading dipertahankan agar hierarki markdown tetap utuh:
        // DeckCraft memakai `#` untuk slide dan `##` untuk sub-bagian.
        if (b.level <= 3) baris.push(`${"#".repeat(b.level)} ${b.text}`);
        else baris.push(`- ${b.text}`);
        break;
      case "paragraph":
        baris.push(b.text);
        break;
      case "list":
        for (const it of b.items) baris.push(`- ${it.text}`);
        break;
      case "table":
        baris.push(`- ${b.headers.join(" | ")}`);
        break;
      case "chart":
        baris.push(`- Grafik ${b.chartType}: ${b.data.labels.join(", ")}`);
        break;
      case "image":
        baris.push(`- ${b.caption || b.alt || "Gambar"}`);
        break;
      case "diagram":
        baris.push(`- Diagram`);
        break;
      case "code":
        baris.push("- Kode");
        break;
      case "divider":
        break;
      default:
        break;
    }
  }
  return baris.join("\n");
}
