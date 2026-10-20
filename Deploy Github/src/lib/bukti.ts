import type { ContentBlock } from "../types";

// NitZ-909 — Pengambil & pengurai tautan bukti (sumber berita online).
// Alur: user menempel fakta mentah + tautan berita -> isi artikel diambil
// (langsung bila situs mengizinkan CORS, kalau tidak lewat proksi teks),
// dibersihkan jadi teks murni, lalu dipakai sebagai BUKTI bernomor [S1..]
// untuk penyusunan laporan intelijen (fakta, analisis, peta pola, prediksi,
// saran, kesimpulan, penutup).

export interface BuktiTautan {
  url: string;
  judul: string;
  penerbit: string;
  teks: string;
  status: "ok" | "gagal";
  pesan?: string;
}

const BATAS_TEKS = 6000;

function proksiDaftar(url: string): string[] {
  const e = encodeURIComponent(url);
  return [
    `https://api.cors.lol/?url=${e}`,
    `https://api.allorigins.win/raw?url=${e}`,
    `https://api.codetabs.com/v1/proxy?quest=${e}`,
  ];
}

async function ambilHtml(url: string, timeoutMs = 25000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Coba langsung dulu (situs yang membuka CORS seperti Wikipedia),
    // lalu rantai proksi teks gratis bila situs memblokir lintas-origin.
    try {
      const langsung = await fetch(url, { signal: ctrl.signal });
      if (langsung.ok) {
        const tipe = langsung.headers.get("content-type") ?? "";
        if (/text|json|xml/i.test(tipe)) return await langsung.text();
      }
    } catch {
      /* lanjut ke proksi */
    }
    let galatTerakhir = "Semua proksi gagal.";
    for (const p of proksiDaftar(url)) {
      try {
        const res = await fetch(p, { signal: ctrl.signal });
        if (!res.ok) {
          galatTerakhir = `Proksi HTTP ${res.status}`;
          continue;
        }
        return await res.text();
      } catch (e) {
        galatTerakhir = e instanceof Error ? e.message : "Proksi gagal.";
      }
    }
    throw new Error(galatTerakhir);
  } finally {
    clearTimeout(t);
  }
}

function rapikan(teks: string): string {
  return teks.replace(/\s+/g, " ").trim().slice(0, BATAS_TEKS);
}

export function ekstrakArtikel(
  html: string,
  url: string,
): { judul: string; penerbit: string; teks: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll(
      "script, style, nav, header, footer, aside, form, iframe, noscript",
    )
    .forEach((el) => el.remove());
  const meta = (n: string): string =>
    doc
      .querySelector(`meta[property="${n}"], meta[name="${n}"]`)
      ?.getAttribute("content") ?? "";
  const judul =
    (doc.querySelector("h1")?.textContent ?? doc.title ?? url)
      .trim()
      .slice(0, 200) || url;
  let penerbit = meta("og:site_name") || meta("twitter:site");
  if (!penerbit) {
    try {
      penerbit = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      penerbit = url;
    }
  }
  const wadah =
    doc.querySelector("article") ?? doc.querySelector("main") ?? doc.body;
  return { judul, penerbit, teks: rapikan(wadah?.textContent ?? "") };
}

export async function ambilTautan(url: string): Promise<BuktiTautan> {
  const bersih = url.trim();
  try {
    const html = await ambilHtml(bersih);
    if (!/<[a-z][\s>/]/i.test(html)) {
      // Respons teks polos (bukan HTML) — pakai langsung.
      const teks = rapikan(html);
      if (!teks) throw new Error("Respons kosong.");
      return {
        url: bersih,
        judul: bersih.slice(0, 120),
        penerbit: "",
        teks,
        status: "ok",
      };
    }
    const { judul, penerbit, teks } = ekstrakArtikel(html, bersih);
    if (!teks) throw new Error("Isi artikel kosong setelah dibersihkan.");
    return { url: bersih, judul, penerbit, teks, status: "ok" };
  } catch (e) {
    return {
      url: bersih,
      judul: bersih.slice(0, 120),
      penerbit: "",
      teks: "",
      status: "gagal",
      pesan: e instanceof Error ? e.message : "Gagal mengambil.",
    };
  }
}

// Pecah respons AI per seksi "## Judul" menjadi blok siap kanvas.
// Baris "- " berurutan digabung jadi satu blok daftar.
export function seksiKeBlok(
  respons: string,
  buatId: (prefix: string) => string,
): ContentBlock[] {
  const keluar: ContentBlock[] = [];
  const potong = respons.split(/^##\s+(.+)$/m);
  for (let i = 1; i < potong.length; i += 2) {
    const judul = (potong[i] ?? "").trim();
    const isi = (potong[i + 1] ?? "").trim();
    if (!judul || !isi) continue;
    keluar.push({
      id: buatId("heading"),
      type: "heading",
      level: 2,
      text: judul,
    });
    const siramDaftar = (daftar: string[]): void => {
      if (daftar.length) {
        keluar.push({
          id: buatId("list"),
          type: "list",
          ordered: false,
          items: daftar.map((text) => ({ text })),
        });
      }
    };
    let daftar: string[] = [];
    let para: string[] = [];
    const siramPara = (): void => {
      const t = para.join(" ").trim();
      if (t)
        keluar.push({ id: buatId("paragraph"), type: "paragraph", text: t });
      para = [];
    };
    for (const baris of isi.split("\n")) {
      const t = baris.trim();
      if (/^[-*]\s+/.test(t)) {
        siramPara();
        daftar.push(t.replace(/^[-*]\s+/, ""));
      } else if (!t) {
        siramPara();
        siramDaftar(daftar);
        daftar = [];
      } else {
        siramDaftar(daftar);
        daftar = [];
        para.push(t.replace(/^>\s*/, ""));
      }
    }
    siramPara();
    siramDaftar(daftar);
  }
  return keluar;
}
