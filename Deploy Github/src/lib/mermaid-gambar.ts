/**
 * Mermaid → gambar (PNG) untuk ekspor PowerPoint.
 *
 * Sebelumnya blok `diagram` tidak pernah jadi gambar: rantai sederhana
 * diterjemahkan menjadi chevron, sisanya ditampilkan sebagai teks sumber.
 * Modul ini menutup celah itu dengan merender Mermaid di browser, lalu
 * mengubah SVG hasilnya menjadi PNG yang bisa disisipkan ke slide.
 *
 * Tiga keputusan yang menentukan berhasil/tidaknya rasterisasi:
 *
 *  1. **`htmlLabels: false`** — Mermaid v10 memakai `<foreignObject>` untuk
 *     label bila opsi ini aktif. Chrome MENOLAK menggambar `<foreignObject>`
 *     saat SVG dimuat sebagai `Image`, sehingga hasilnya kotak kosong tanpa
 *     error. Dengan label sebagai `<text>` biasa, rasterisasi berjalan.
 *  2. **Ukuran eksplisit** — SVG Mermaid membawa `max-width` dan `viewBox`,
 *     bukan `width`/`height` piksel. Tanpa ukuran eksplisit, `Image` bisa
 *     melaporkan 0×0 dan kanvas ikut kosong.
 *  3. **Latar ikut tema** — kanvas diisi warna latar slide lebih dulu agar
 *     teks gelap/terang tetap terbaca dan tepi gambar menyatu dengan slide.
 *
 * Semua fungsi di sini hanya berjalan di browser; di Node (unit test)
 * pemanggil harus menyiapkan fallback.
 */
import type { ContentBlock, DiagramBlock } from "../types";
import { campur, type TemaPpt } from "./ppt-desain";

/** Lebar target raster (piksel). 2400 px ≈ 200 dpi untuk area 12 inci. */
const LEBAR_TARGET = 2400;
const TINGGI_MAKS = 1600;

/** Batas waktu satu diagram (ms). Mermaid bisa menggantung pada input aneh. */
const BATAS_WAKTU = 10_000;

/**
 * Batas pembesaran.
 *
 * Diagram Mermaid kecil (flowchart 3 simpul) punya lebar alami ~310 px.
 * Dengan batas 3x hasilnya hanya ~930 px — saat dipasang selebar 11,7 inci
 * itu cuma ~80 dpi, jelas kabur di proyektor. Karena sumbernya vektor (SVG),
 * memperbesar kanvas TIDAK mengurangi ketajaman: SVG dirasterisasi ulang
 * pada ukuran tujuan. Batas 8x membuat diagram kecil tetap tajam tanpa
 * membengkakkan diagram besar.
 */
const SKALA_MAKS = 8;

export interface OpsiRenderMermaid {
  tema: TemaPpt;
  /** Latar kanvas (6 digit heksadesimal tanpa '#'). */
  latar?: string;
}

/**
 * Variabel tema Mermaid yang diturunkan dari tema deck.
 * Tujuannya bukan sekadar "berwarna", tetapi agar garis, teks, dan simpul
 * memakai palet yang sama dengan slide di sekitarnya.
 */
function variabelTema(tema: TemaPpt): Record<string, string> {
  const w = tema.warna;
  return {
    background: `#${w.latar}`,
    primaryColor: `#${campur(w.aksen, w.latar, 0.82)}`,
    primaryTextColor: `#${w.teks}`,
    primaryBorderColor: `#${w.aksen}`,
    secondaryColor: `#${campur(w.primer, w.latar, 0.86)}`,
    secondaryTextColor: `#${w.teks}`,
    secondaryBorderColor: `#${w.garis}`,
    tertiaryColor: `#${w.latarAlt}`,
    tertiaryTextColor: `#${w.teks}`,
    tertiaryBorderColor: `#${w.garis}`,
    lineColor: `#${w.teksLembut}`,
    textColor: `#${w.teks}`,
    mainBkg: `#${campur(w.aksen, w.latar, 0.82)}`,
    nodeBorder: `#${w.aksen}`,
    clusterBkg: `#${w.latarAlt}`,
    clusterBorder: `#${w.garis}`,
    edgeLabelBackground: `#${w.latar}`,
    fontFamily: tema.tipografi.isi,
    fontSize: "18px",
  };
}

/** Ambil ukuran dari `viewBox` bila `width`/`height` tidak ada. */
function ukuranSvg(svg: string): { w: number; h: number } {
  const vb = /viewBox="([\d.\-\s]+)"/.exec(svg);
  if (vb) {
    const bagian = vb[1].trim().split(/[\s,]+/).map(Number);
    if (bagian.length === 4 && bagian[2] > 0 && bagian[3] > 0) {
      return { w: bagian[2], h: bagian[3] };
    }
  }
  const w = /width="([\d.]+)(?:px)?"/.exec(svg);
  const h = /height="([\d.]+)(?:px)?"/.exec(svg);
  if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
  return { w: 960, h: 540 };
}

/**
 * Pastikan SVG punya width/height eksplisit agar bisa dimuat sebagai Image.
 *
 * Memakai DOMParser, bukan regex: keluaran Mermaid sudah membawa `xmlns`,
 * `style`, dan kadang `width="100%"`. Menambal dengan regex berisiko
 * menghasilkan atribut ganda — XML-nya jadi tidak sah dan `Image` gagal
 * dimuat tanpa pesan yang jelas.
 */
function siapkanSvg(svg: string, w: number, h: number): string {
  try {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    if (doc.querySelector("parsererror")) return svg;
    const akar = doc.documentElement;
    akar.setAttribute("width", String(Math.round(w)));
    akar.setAttribute("height", String(Math.round(h)));
    akar.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    akar.removeAttribute("style");
    return new XMLSerializer().serializeToString(doc);
  } catch {
    return svg;
  }
}

/** Muat SVG sebagai elemen gambar. */
function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG gagal dimuat sebagai gambar."));
    img.src = url;
  });
}

/**
 * Render satu sumber Mermaid menjadi data URL PNG.
 * Mengembalikan `null` bila Mermaid tidak tersedia atau diagram tidak sah —
 * pemanggil wajib punya fallback.
 */
export async function renderMermaidPng(
  sumber: string,
  opsi: OpsiRenderMermaid,
): Promise<string | null> {
  const kode = (sumber || "").trim();
  if (!kode || typeof document === "undefined") return null;

  try {
    const { default: mermaid } = await import("mermaid");
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      themeVariables: variabelTema(opsi.tema),
      fontFamily: opsi.tema.tipografi.isi,
      flowchart: { htmlLabels: false, curve: "basis", padding: 12 },
      sequence: { useMaxWidth: false },
      gantt: { useMaxWidth: false },
    });

    const id = `mmd-ppt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    // Mermaid tidak punya timeout internal. Tanpa pengaman ini, satu diagram
    // yang membuat parser berputar akan menggantung seluruh proses ekspor.
    const { svg } = await Promise.race([
      mermaid.render(id, kode),
      new Promise<never>((_, tolak) =>
        setTimeout(() => tolak(new Error("Batas waktu render diagram")), BATAS_WAKTU),
      ),
    ]);
    const { w, h } = ukuranSvg(svg);

    const skala = Math.min(LEBAR_TARGET / w, SKALA_MAKS);
    const lebar = Math.max(320, Math.round(w * skala));
    const tinggi = Math.max(120, Math.round(Math.min(h * skala, TINGGI_MAKS)));

    // Data URL, BUKAN blob URL: CSP aplikasi hanya mengizinkan
    // `img-src 'self' data: https:`, sehingga `blob:` ditolak browser dan
    // diagram gagal dimuat tanpa error yang terlihat.
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      siapkanSvg(svg, w, h),
    )}`;

    const img = await muatGambar(url);
    const kanvas = document.createElement("canvas");
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext("2d");
    if (!ctx) return null;

    // Latar solid agar teks tetap kontras dan tepi gambar menyatu.
    ctx.fillStyle = `#${opsi.latar ?? opsi.tema.warna.latar}`;
    ctx.fillRect(0, 0, lebar, tinggi);
    ctx.drawImage(img, 0, 0, lebar, tinggi);

    return kanvas.toDataURL("image/png");
  } catch {
    // Diagram tidak sah, font hilang, atau Mermaid gagal dimuat.
    return null;
  }
}

/**
 * Render seluruh blok diagram pada satu dokumen.
 *
 * Dijalankan berurutan (bukan paralel): Mermaid menyimpan status global
 * (`initialize`) dan memakai DOM sementara, sehingga render bersamaan bisa
 * saling menimpa.
 */
export async function renderSemuaDiagram(
  blocks: ContentBlock[],
  tema: TemaPpt,
): Promise<Record<string, string>> {
  const hasil: Record<string, string> = {};
  const daftar = blocks.filter(
    (b): b is DiagramBlock => b.type === "diagram" && b.diagramType === "mermaid",
  );
  if (daftar.length === 0) return hasil;

  for (const blok of daftar) {
    const png = await renderMermaidPng(blok.source, {
      tema,
      latar: tema.warna.latar,
    });
    if (png) hasil[blok.id] = png;
  }
  return hasil;
}
