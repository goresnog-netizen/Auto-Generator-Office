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
  CodeBlock,
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

/**
 * Font monospace untuk blok kode.
 *
 * PILIHAN: "Liberation Mono", bukan "Consolas".
 *
 * Alasannya (bukan selera, tapi hasil uji):
 *
 *  1. **Lisensi.** Liberation Mono adalah SIL Open Font License dan
 *     DIBUNDEL di dalam binary DeckCraft. Consolas adalah font Microsoft -
 *     dan DeckCraft sendiri melarang aset Microsoft (AGENTS.md §1.1).
 *
 *  2. **Konsistensi lintas mesin.** Liberation Mono selalu ada di binary
 *     DeckCraft, jadi hasil render sama di mesin mana pun. Consolas hanya
 *     ada di Windows dengan lisensi Microsoft; di Linux/macOS engine
 *     memetakannya ke substitusi - jadi nama "Consolas" yang tercatat di
 *     PPTX bisa bait PowerPoint di mesin lain.
 *
 *  3. **Terbukti dirender, bukan fallback.** Diuji dengan membandingkan
 *     hash PNG render untuk beberapa nama font:
 *       Liberation Mono  -> hash BEDA dari font tak dikenal (fallback)
 *       Consolas         -> hash BEDA juga (ada di mesin ini)
 *       DejaVu Sans Mono, JetBrains Mono, Fira Code -> hash SAMA dengan
 *                          font tak dikenal = FALLBACK, tak benar-benar
 *                          dirender.
 *
 * Catatan: DeckCraft memetakan "consolas" ke ["Liberation Mono",
 * "Courier New", "Menlo", "Courier"] (crates/fonts/src/fontdb.rs), jadi
 * PPTX ber-font Consolas pun berakhir digambar dengan Liberation Mono di
 * mesin tanpa Consolas - tapi blok kode di dalam deck ini memakai nama
 * yang langsung menunjuk font bebas lisensinya.
 */
export const FONT_KODE = "Liberation Mono";

/**
 * Font cadangan kalau nama utama tak ditemukan.
 *
 * Urutan mengikuti peta substitusi engine: Liberation Mono -> Courier New
 * -> Menlo -> Courier. Semua berlisensi bebas atau sudah jadi stand industri.
 */
export const FONT_KODE_CADANGAN = ["Courier New", "Menlo", "Courier"];

/**
 * Ukuran font (pt) untuk teks kode di slide.
 *
 * Slide DeckCraft 16:9 lebarnya 960 pt (= 13,3 inci), jadi ukuran comparable
 * dengan slide PowerPoint 13,3 inci. Body text presentasi biasanya 18-24 pt;
 * kode sedikit lebih kecil karena lebih rapat, tapi 13 pt terlalu kecil untuk
 * dibaca dari jauh. 16 pt adalah titik tengah yang terbaca di proyektor.
 */
export const UKURAN_FONT_KODE = 18;

/**
 * Lebar industri (dalam karakter) untuk satu baris kode.
 *
 * Font monospace punya lebar karakter tetap, jadi lebar baris bisa dihitung
 * dari jumlah karakter. 0,62 em per karakter untuk Liberation Mono pada
 * 18 pt ≈ 11,2 pt per karakter.
 */
const LEBAR_KARAKTER_PT = 11.2;

/** Lebar minimum & maksimum text box kode (pt). */
const LEBAR_KODE_MIN = 360;
const LEBAR_KODE_MAX = KONTEN_W;

/**
 * Warna teks blok kode.
 *
 * gelap di atas latar terang - kontras 15,8:1, jauh di atas ambang AA
 * (4,5:1) untuk teks biasa dan 7:1 untuk teks besar.
 */
export const WARNA_TEKST_KODE = "111827";

/**
 * Warna latar blok kode.
 *
 * Abu-abu muda, bukan putih murni:latar putih bikin blok kode "terbenam"
 * di slide yang latar putihnya sama, sedangkan abu-abu membuatnya terbaca
 * sebagai blok terpisah tanpa harus garis tebal.
 */
export const WARNA_LATAR_KODE = "EEF0F3";

/** Garis tepi blok kode. */
export const WARNA_GARIS_KODE = "C8CDD4";

/**
 * Perintah DeckCraft + slide tempat perintah itu berlaku.
 *
 * PENTING - inilah yang membuat blok kode bisa ber-font monospace.
 * Perintah `format.*` (format.font, format.size, ...) di engine berlaku pada
 * **selection saat ini**, bukan pada id yang diberi. Jadi perintah format
 * harus dijalankan tepat setelah shape-nya dibuat, pada slide yang benar.
 *
 * Bukti empiris (probe MCP v0.8.0):
 *  - `format.font {family, ids:[N]}` MENGABAIKAN `ids`; hasilnya null dan
 *    shape tak berubah;
 *  - `selection.select {ids:[N]}` lalu `format.font` -> font menempel;
 *  - `shape.inspect` hanya mencari shape di slide AKTIF -> perlu `slide.go`.
 */
export interface DeckcraftPerintah extends DeckcraftCommand {
  /** Indeks slide tempat perintah ini berlaku (0-based). */
  slide?: number;
}

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
 *
 * Setiap perintah membawa `slide` = indeks slide tempat ia berlaku, karena
 * perintah `format.*` di engine bekerja pada selection slide AKTIF. Tanpa
 * informasi itu, blok kode tak bisa diberi font monospace.
 */
export function blokKePerintah(
  blocks: ContentBlock[],
  options: {
    judul?: string;
    tema?: string;
    /** Sisipkan slide sampul di front. */
    sampul?: boolean;
  } = {},
): DeckcraftPerintah[] {
  const perintah: DeckcraftPerintah[] = [];
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
  let slideBaru: DeckcraftPerintah[] = [];
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

  /**
   * Tambahkan blok kode: text box dengan font monospace, latar, dan garis.
   *
   * Perintahnya harus berurutan: `insert.textBox` -> `format.font` ->
   * `format.size` -> `shape.fill` -> `shape.line`. Semuanya berlaku pada
   * selection, dan shape baru otomatis jadi selection.
   */
  const tambahKode = (b: CodeBlock) => {
    if (slideBaru.length === 0) mulaiSlide(judulMenunggu);
    const baris = b.code.split("\n");
    // Tinggi mengikuti jumlah baris, dengan ruang extra supaya blok tak
    // terlihat "penuh" di slide. Batas atas 340 pt (63% tinggi slide).
    const tinggi = Math.min(Math.max(baris.length * 26 + 28, 72), 340);
    // Lebar mengikuti baris terpanjang: text box selebar slide untuk kode
    // 3 baris pendek terlihat rapi kosong. Karakter monospace punya lebar
    // tetap, jadi ini bisa dihitung.
    const karakterTerpanjang = baris.reduce(
      (maks, b2) => Math.max(maks, b2.length),
      0,
    );
    const lebarIdeal = karakterTerpanjang * LEBAR_KARAKTER_PT + 36;
    const lebar = Math.min(Math.max(lebarIdeal, LEBAR_KODE_MIN), LEBAR_KODE_MAX);
    slideBaru.push({
      command: "insert.textBox",
      params: {
        rect: [MARGIN_X, kursorY, lebar, tinggi],
        text: b.code,
      },
    });
    slideBaru.push({
      command: "format.font",
      params: { family: FONT_KODE },
    });
    slideBaru.push({
      command: "format.size",
      params: { size: UKURAN_FONT_KODE },
    });
    // Warna teks eksplisit: tanpa ini, teks kode memakai warna teks tema,
    // yang di slide terang bisa jadi terlalu terang di atas latar abu-abu.
    slideBaru.push({
      command: "format.color",
      params: { color: WARNA_TEKST_KODE },
    });
    slideBaru.push({
      command: "shape.fill",
      params: { color: WARNA_LATAR_KODE },
    });
    slideBaru.push({
      command: "shape.line",
      params: { color: WARNA_GARIS_KODE, width: 1 },
    });
    kursorY += tinggi + 16;
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
        tambahKode(b as CodeBlock);
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
  //
  // Setiap perintah juga diberi nomor slide (`slide`), karena perintah
  // `format.*` berlaku pada selection slide AKTIF. Tanpa nomor ini, blok kode
  // yang admire-font harus dijalankan di slide yang benar - kalau tidak, font
  // tempelan ke slide lain dan blok kode tampil dengan font biasa.
  const preamble: DeckcraftPerintah[] = [];
  const groups: {
    slide: DeckcraftPerintah;
    isi: DeckcraftPerintah[];
  }[] = [];
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

  // Nomor slide dihitung setelah slide kosong dibuang, supaya nomornya sama
  // dengan indeks slide sungguhan di deck hasil build.
  const perintahBersih: DeckcraftPerintah[] = [...preamble];
  let nomorSlide = 0;
  for (const g of groups) {
    if (g.isi.length === 0) continue;
    perintahBersih.push({ ...g.slide, slide: nomorSlide });
    for (const isi of g.isi) {
      perintahBersih.push({ ...isi, slide: nomorSlide });
    }
    nomorSlide += 1;
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
      slide: 0,
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