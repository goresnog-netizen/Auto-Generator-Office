/**
 * NitZ-909 — Layar Utama
 * Platform Pembuat Dokumen: pilih template, isi blok, pilih model AI, ekspor.
 * Bahasa antarmuka: Indonesia.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "./Logo";
import { DocumentEditor } from "./DocumentEditor";
import { FormMode } from "./FormMode";
import { ThemeProvider, useTheme } from "./ThemeProvider.tsx";
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  EmptyState,
  Input,
  SectionHeader,
  StatChip,
  Select,
  useDocumentStats,
} from "./ui";
import { Ikon, IkonFormat, type NamaIkon } from "./Ikon";
import { MiniTemplatePreview } from "./MiniTemplatePreview";
import { TemplatePreview } from "./TemplatePreview";
import { DeckCraftStudio } from "./DeckCraftStudio";
import { AutoGenerate } from "./AutoGenerate";
import { PerformaBadge } from "./PerformaBadge";
import { eksporDokumen } from "../lib/exporter";
import { TEMA_PPT } from "../lib/ppt-desain";
import { labelMutu, periksaBahasa, rapikanEjaanBlok } from "../lib/bahasa";
import { renderInfografisPng } from "../lib/infografis";
import {
  generateCompletion,
  generateCompletionSumber,
  generateDraft,
  type ProviderAI,
  type SumberWeb,
} from "../lib/ai";
import { blokDariCSV, blokDariJSON } from "../lib/csv";
import { ambilTautan, seksiKeBlok, type BuktiTautan } from "../lib/bukti";
import {
  LABEL_KATEGORI,
  TEMPLATES,
  WARNA_KATEGORI,
  getTemplate,
  type KategoriTemplate,
  type TemplateGaleri,
} from "../data/templates";
import { CONTOH_UMUM, PERSONAS, getPersona } from "../data/personas";
import {
  AI_PROVIDERS,
  DEFAULT_MODEL_ID,
  DEFAULT_PROVIDER_ID,
  getModelLabel,
  getProvider,
} from "../data/aiModels";
import { BAGIAN_STANDAR } from "../data/bagian";
import type { ContentBlock, DocumentType, LaporanMetadata } from "../types";

// Warna handled oleh CSS (tokens.css + base.css), sudah mengambil token dari
// aplikasi Freebuff desktop v0.0.169 (shell-dark: bg #1c1d1c, surface #222423,
// brand sage #b5cea5).

const editor = new DocumentEditor();

/**
 * Temuan bahasa yang bisa diperbaiki tanpa mengubah makna. Temuan lain
 * (kalimat panjang, klaim tanpa angka) hanya ditandai — keputusannya
 * milik penulis, bukan mesin.
 */
const KODE_BISA_RAPIKAN = new Set([
  "kata-tidak-baku",
  "format-mata-uang",
  "format-persen",
  "spasi-ganda",
  "spasi-tanda-baca",
]);

type StatusEkspor = "idle" | "loading" | "sukses" | "gagal";
interface StatusTombol {
  state: StatusEkspor;
  pesan: string;
}
const PETA_PERSONA: Record<string, NamaIkon> = {
  pelajar: "pelajar",
  mahasiswa: "mahasiswa",
  bisnis: "bisnis",
  marketing: "marketing",
  umkm: "toko",
  polisi: "legal",
  tni: "perisai",
  kesehatan: "medis",
};
const STATUS_AWAL: StatusTombol = { state: "idle", pesan: "" };

const FORMAT_INFO: {
  format: DocumentType;
  label: string;
  ikon: string;
  ekstensi: string;
}[] = [
  { format: "pdf", label: "Ekspor PDF", ikon: "pdf", ekstensi: "pdf" },
  { format: "word", label: "Ekspor Word", ikon: "word", ekstensi: "docx" },
  { format: "pptx", label: "Ekspor PPT", ikon: "pptx", ekstensi: "pptx" },
  { format: "xlsx", label: "Ekspor Excel", ikon: "xlsx", ekstensi: "xlsx" },
  {
    format: "diagram",
    label: "Ekspor Diagram",
    ikon: "diagram",
    ekstensi: "svg",
  },
];

const THEME_VARIANTS = ["freebuff", "blue", "green", "senja", "toska"] as const;
// Label + tooltip tiap varian (ganti ternari bertingkat agar nambah warna tak merusak JSX).
const META_VARIAN: Record<
  (typeof THEME_VARIANTS)[number],
  { label: string; title: string }
> = {
  freebuff: { label: "Freebuff", title: "Aksen sage Freebuff" },
  blue: { label: "Blue", title: "Aksen biru elektrik" },
  green: { label: "Hijau", title: "Aksen hijau" },
  senja: { label: "Senja", title: "Aksen oranye senja" },
  toska: { label: "Toska", title: "Aksen toska laut" },
};

const FILTER_KATEGORI: ("semua" | KategoriTemplate)[] = [
  "semua",
  "dokumen",
  "presentasi",
  "spreadsheet",
  "infografis",
];

const FILTER_FORMAT: ("semua" | TemplateGaleri["format"])[] = [
  "semua",
  "word",
  "pptx",
  "xlsx",
  "diagram",
  "pdf",
];

const LABEL_FORMAT: Record<TemplateGaleri["format"], string> = {
  word: "Word",
  pptx: "PPT",
  xlsx: "Excel",
  diagram: "Diagram",
  pdf: "PDF",
};

const PANDUAN_INFOGRAFIS = [
  "Mulai dari angka kunci — satu judul besar, satu kalimat fakta.",
  "Tambah blok Grafik untuk visual (pie untuk komposisi, bar untuk perbandingan).",
  "Tambah blok Daftar berisi 3–5 fakta, tiap butir satu kalimat.",
  "Tambah blok Diagram untuk alur (kiri ke kanan, maks. 6 langkah).",
  "Satu warna aksen untuk fokus; sisanya netral.",
  "Ekspor ke Diagram atau PDF, lalu cek keterbacaan dari jarak jauh.",
];

const PANDUAN_PPT = [
  "Pilih template Presentasi (mis. “Briefing Formal” atau “Analisis Data”).",
  "Satu slide satu gagasan: Heading level 1 = sampul, level 2 = judul slide.",
  "Pakai Tabel untuk angka, Grafik untuk tren (jadi grafik NATIVE di PPT), Diagram untuk alur.",
  "Samakan bingkai tiap slide (judul, footer, palet) ala Slide Master.",
  "Maks. 6 baris per slide; penjelasan di mulut, bukan di slide.",
  "Ekspor ke PPT, cek urutan slide dari sampul sampai penutup.",
];

// Alur kerja diadaptasi dari PPT Master (MIT © 2025–2026 Hugo He,
// https://github.com/hugohe3/ppt-master): rencanakan narasi dulu,
// tiap slide satu gagasan, hasilkan objek NATIVE yang bisa diubah.
const ALUR_PPT_MASTER = [
  "Rencana: kumpulkan bahan & susun alur cerita sebelum membuka slide.",
  "Susun: satu slide satu gagasan; tulis judulnya sebagai kalimat pesan.",
  "Periksa: tiap slide dicek — judul jelas, maks. 6 baris, ada sumber data.",
  "Perbaiki: ulangi per slide sampai lolos cek, baru ekspor.",
  "Hasil di NitZ-909 sudah native: tabel → tabel PPT, grafik → grafik PPT (bisa diklik & diubah), bukan gambar.",
];

// Prinsip desain diadaptasi dari diagram-design
// (MIT © 2025 Cathryn Lavery, https://github.com/cathrynlavery/diagram-design).
const PRINSIP_DIAGRAM = [
  "Hapus yang tidak perlu: tiap kotak satu ide; garis yang tak membawa info dibuang.",
  "Satu warna aksen, maks. 1–2 fokus per diagram; sisanya netral.",
  "Maks. 9 kotak, 12 panah — lebih dari itu pecah jadi dua diagram.",
  "Skala jujur: sumbu grafik mulai dari 0; jarak linimasa ikut jarak waktu.",
  "Bentuk membawa makna (oval = mulai/selesai, belah ketupat = keputusan).",
];

function buatId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function klonBlocks(blocks: ContentBlock[]): ContentBlock[] {
  return JSON.parse(JSON.stringify(blocks)) as ContentBlock[];
}

// Kunci AI tersimpan lokal di browser (localStorage `nitz909-ai`):
// { kunci: { [providerId]: string }, endpoint: string }.
// Kunci hanya dikirim ke provider yang dipilih (atau endpoint uji bila diisi).
const KUNCI_AI_LS = "nitz909-ai";

interface SimpananKunciAI {
  kunci: Record<string, string>;
  endpoint: string;
}

function bacaSimpananKunci(): SimpananKunciAI {
  try {
    const mentah = localStorage.getItem(KUNCI_AI_LS);
    if (!mentah) return { kunci: {}, endpoint: "" };
    const j = JSON.parse(mentah) as Partial<SimpananKunciAI>;
    return {
      kunci:
        j.kunci && typeof j.kunci === "object"
          ? (j.kunci as Record<string, string>)
          : {},
      endpoint: typeof j.endpoint === "string" ? j.endpoint : "",
    };
  } catch {
    return { kunci: {}, endpoint: "" };
  }
}

// Metadata laporan (F1) — localStorage `nitz909-metadata`.
const KUNCI_METADATA_LS = "nitz909-metadata";
const METADATA_KOSONG: LaporanMetadata = {
  nomor: "",
  tanggal: "",
  unit: "",
  penanggungJawab: "",
  periode: "",
  lokasi: "",
};

function bacaMetadata(): LaporanMetadata {
  try {
    const mentah = localStorage.getItem(KUNCI_METADATA_LS);
    if (!mentah) return { ...METADATA_KOSONG };
    const j = JSON.parse(mentah) as Partial<LaporanMetadata>;
    const m: LaporanMetadata = { ...METADATA_KOSONG };
    for (const k of Object.keys(METADATA_KOSONG) as (keyof LaporanMetadata)[]) {
      const v = j[k];
      if (typeof v === "string") m[k] = v;
    }
    return m;
  } catch {
    return { ...METADATA_KOSONG };
  }
}

function barisIdentitas(m: LaporanMetadata): string {
  const pasang: [string, string][] = [
    ["Nomor", m.nomor],
    ["Tanggal", m.tanggal],
    ["Unit/Instansi", m.unit],
    ["Penanggung Jawab", m.penanggungJawab],
    ["Periode", m.periode],
    ["Lokasi", m.lokasi],
  ];
  return pasang
    .filter(([, v]) => v.trim() !== "")
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join("\n");
}

function adaMetadata(m: LaporanMetadata): boolean {
  return Object.values(m).some((v) => v.trim() !== "");
}

/* ===== Impor template pengguna (.json, prosedur PRD) =====
 * JSON data murni: satu objek {id, nama, kategori, format, deskripsi,
 * ikon?, judulDokumen, blocks[]}. Menolak macro/konten aktif. */

const KUNCI_TEMPLATE_PENGGUNA = "nitz909-user-templates";
const KUNCI_DOKUMEN_TERSIMPAN = "nitz909-docs";
const BATAS_IMPOR_BYTE = 256 * 1024;
const ID_BAWAAN = new Set(TEMPLATES.map((t) => t.id));

const TIPE_BLOK_IMPOR = [
  "heading",
  "paragraph",
  "list",
  "table",
  "code",
  "image",
  "chart",
  "diagram",
  "divider",
];
const KATEGORI_IMPOR = ["dokumen", "presentasi", "spreadsheet", "infografis"];
const FORMAT_IMPOR = ["word", "pptx", "xlsx", "diagram", "pdf"];
const KUNCI_TERLARANG = [
  "macro",
  "script",
  "onLoad",
  "action",
  "executable",
  "oleObject",
];
const POLA_AKTIF = ["<script", "javascript:", "onerror=", "onload="];

function teksBlokTerlarang(b: Record<string, unknown>): string | null {
  const strings: string[] = [];
  for (const v of [b.text, b.code, b.source, b.alt, b.caption]) {
    if (typeof v === "string") strings.push(v);
  }
  if (Array.isArray(b.headers))
    strings.push(...b.headers.filter((x) => typeof x === "string"));
  if (Array.isArray(b.rows)) {
    for (const r of b.rows) {
      if (Array.isArray(r))
        strings.push(...r.filter((x) => typeof x === "string"));
    }
  }
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      if (
        typeof it === "object" &&
        it !== null &&
        typeof (it as Record<string, unknown>).text === "string"
      ) {
        strings.push((it as Record<string, unknown>).text as string);
      }
    }
  }
  const gabung = strings.join("\n").toLowerCase();
  return POLA_AKTIF.find((p) => gabung.includes(p)) ?? null;
}

export function validasiTemplateImpor(
  data: unknown,
  idTerpakai: Set<string>,
): { template: TemplateGaleri | null; alasan: string[] } {
  const tolak = (alasan: string[]) => ({
    template: null as null,
    alasan: alasan.slice(0, 3),
  });
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return tolak([
      "Berkas harus berisi satu objek template (bukan array/teks).",
    ]);
  }
  const d = data as Record<string, unknown>;
  const alasan: string[] = [];
  for (const k of KUNCI_TERLARANG) {
    if (k in d)
      alasan.push(`Konten aktif dilarang: field "${k}" tidak boleh ada.`);
  }
  for (const f of ["id", "nama", "deskripsi", "judulDokumen"]) {
    if (typeof d[f] !== "string" || !(d[f] as string).trim()) {
      alasan.push(`Field wajib hilang: "${f}".`);
    }
  }
  if (typeof d.kategori !== "string" || !KATEGORI_IMPOR.includes(d.kategori)) {
    alasan.push(`kategori harus salah satu: ${KATEGORI_IMPOR.join(", ")}.`);
  }
  if (typeof d.format !== "string" || !FORMAT_IMPOR.includes(d.format)) {
    alasan.push(`format harus salah satu: ${FORMAT_IMPOR.join(", ")}.`);
  }
  const id = typeof d.id === "string" ? d.id.trim() : "";
  if (id && idTerpakai.has(id)) {
    alasan.push(`id "${id}" sudah dipakai — ganti id lain.`);
  }
  const blocks = d.blocks;
  if (!Array.isArray(blocks) || blocks.length === 0) {
    alasan.push("blocks harus array tak-kosong.");
  } else {
    blocks.forEach((bl, i) => {
      const n = i + 1;
      if (typeof bl !== "object" || bl === null || Array.isArray(bl)) {
        alasan.push(`Blok #${n}: harus berupa objek.`);
        return;
      }
      const b = bl as Record<string, unknown>;
      for (const k of KUNCI_TERLARANG) {
        if (k in b) {
          alasan.push(
            `Konten aktif dilarang: blok #${n} mengandung field "${k}".`,
          );
          return;
        }
      }
      if (typeof b.type !== "string" || !TIPE_BLOK_IMPOR.includes(b.type)) {
        alasan.push(
          `Blok #${n}: type "${String(b.type)}" tidak dikenal (9 tipe: ${TIPE_BLOK_IMPOR.join(", ")}).`,
        );
        return;
      }
      switch (b.type) {
        case "heading":
          if (typeof b.text !== "string" || !b.text.trim())
            alasan.push(`Blok #${n} (heading): text wajib tak-kosong.`);
          if (
            typeof b.level !== "number" ||
            ![1, 2, 3, 4, 5, 6].includes(b.level)
          ) {
            alasan.push(`Blok #${n} (heading): level harus 1–6.`);
          }
          break;
        case "paragraph":
          if (typeof b.text !== "string")
            alasan.push(`Blok #${n} (paragraph): text harus string.`);
          break;
        case "list":
          if (typeof b.ordered !== "boolean")
            alasan.push(`Blok #${n} (list): ordered harus boolean.`);
          if (!Array.isArray(b.items) || b.items.length === 0) {
            alasan.push(`Blok #${n} (list): items harus array tak-kosong.`);
          } else if (
            b.items.some(
              (it) =>
                typeof it !== "object" ||
                it === null ||
                typeof (it as Record<string, unknown>).text !== "string" ||
                !((it as Record<string, unknown>).text as string).trim(),
            )
          ) {
            alasan.push(
              `Blok #${n} (list): tiap butir wajib punya text tak-kosong.`,
            );
          }
          break;
        case "table":
          if (
            !Array.isArray(b.headers) ||
            b.headers.length === 0 ||
            b.headers.some((h) => typeof h !== "string")
          ) {
            alasan.push(
              `Blok #${n} (table): headers harus array string tak-kosong.`,
            );
          }
          if (
            !Array.isArray(b.rows) ||
            b.rows.some(
              (r) => !Array.isArray(r) || r.some((c) => typeof c !== "string"),
            )
          ) {
            alasan.push(
              `Blok #${n} (table): rows harus array baris berisi string.`,
            );
          }
          break;
        case "code":
          if (typeof b.language !== "string" || !b.language.trim()) {
            alasan.push(`Blok #${n} (code): language wajib tak-kosong.`);
          }
          if (typeof b.code !== "string")
            alasan.push(`Blok #${n} (code): code harus string.`);
          break;
        case "image":
          if (
            typeof b.src !== "string" ||
            !(
              b.src.startsWith("http://") ||
              b.src.startsWith("https://") ||
              b.src.startsWith("data:image/")
            )
          ) {
            alasan.push(
              `Blok #${n} (image): src harus URL http(s):// atau data:image/.`,
            );
          }
          if (typeof b.alt !== "string")
            alasan.push(`Blok #${n} (image): alt harus string.`);
          break;
        case "chart":
          if (
            !["bar", "line", "pie", "area", "scatter"].includes(
              b.chartType as string,
            )
          ) {
            alasan.push(
              `Blok #${n} (chart): chartType harus bar/line/pie/area/scatter.`,
            );
          }
          {
            const dd = b.data as Record<string, unknown> | undefined;
            const ds = dd?.datasets as unknown;
            if (
              typeof dd !== "object" ||
              dd === null ||
              !Array.isArray(dd.labels) ||
              !Array.isArray(ds) ||
              ds.length === 0 ||
              ds.some(
                (s) =>
                  typeof s !== "object" ||
                  s === null ||
                  typeof (s as Record<string, unknown>).label !== "string" ||
                  !Array.isArray((s as Record<string, unknown>).data),
              )
            ) {
              alasan.push(
                `Blok #${n} (chart): data wajib {labels[], datasets[{label, data}]}.`,
              );
            }
          }
          break;
        case "diagram":
          if (!["mermaid", "plantuml"].includes(b.diagramType as string)) {
            alasan.push(
              `Blok #${n} (diagram): diagramType harus mermaid/plantuml.`,
            );
          }
          if (typeof b.source !== "string" || !b.source.trim()) {
            alasan.push(`Blok #${n} (diagram): source wajib tak-kosong.`);
          }
          break;
        case "divider":
          break;
      }
      const pola = teksBlokTerlarang(b);
      if (pola)
        alasan.push(
          `Konten aktif dilarang: blok #${n} mengandung pola "${pola}".`,
        );
    });
  }
  if (alasan.length > 0 || !id)
    return tolak(alasan.length > 0 ? alasan : ['Field wajib hilang: "id".']);
  const idBlok = new Set<string>();
  const blokBersih = (blocks as Record<string, unknown>[]).map((bl, i) => {
    const b = { ...(bl as Record<string, unknown>) } as Record<
      string,
      unknown
    > & { id: string };
    if (typeof b.id !== "string" || !b.id.trim() || idBlok.has(b.id)) {
      b.id = `impor-${id}-${i + 1}`;
    }
    idBlok.add(b.id);
    return b;
  });
  return {
    template: {
      id,
      nama: (d.nama as string).trim(),
      kategori: d.kategori as TemplateGaleri["kategori"],
      format: d.format as TemplateGaleri["format"],
      deskripsi: (d.deskripsi as string).trim(),
      ikon: typeof d.ikon === "string" && d.ikon ? d.ikon : "dokumen",
      judulDokumen: (d.judulDokumen as string).trim(),
      blocks: klonBlocks(blokBersih as unknown as ContentBlock[]),
      versi: typeof d.versi === "string" && d.versi ? d.versi : "1.0",
    },
    alasan: [],
  };
}

function EditorCanvas({ version }: { version: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    editor.getBlocks().forEach((block) => {
      const el = document.createElement("div");
      try {
        editor.renderBlockHtml(block, el);
      } catch {
        el.textContent = "Blok tidak dapat ditampilkan.";
      }
      ref.current!.appendChild(el);
    });
  }, [version]);
  return <div ref={ref} className="editor-canvas" />;
}

function AppInner() {
  const { mode, toggle } = useTheme();
  const [version, setVersion] = useState(0);
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [judul, setJudul] = useState("Laporan Kegiatan");
  const [kategori, setKategori] = useState<"semua" | KategoriTemplate>("semua");
  const [formatFilter, setFormatFilter] = useState<
    "semua" | TemplateGaleri["format"]
  >("semua");
  const [cariTemplate, setCariTemplate] = useState("");
  // Akordeon galeri: tiap kategori bisa dibuka/tutup, default semua terbuka.
  const [grupTerbuka, setGrupTerbuka] = useState<
    Record<KategoriTemplate, boolean>
  >({
    dokumen: true,
    presentasi: true,
    spreadsheet: true,
    infografis: true,
  });
  // Mode tampilan galeri: grid (default, 2 kolom) atau daftar (vertikal).
  // Disimpan di localStorage `nitz909-galeri`.
  const [tampilanGaleri, setTampilanGaleri] = useState<"grid" | "daftar">(
    () => {
      try {
        return localStorage.getItem("nitz909-galeri") === "daftar"
          ? "daftar"
          : "grid";
      } catch {
        return "grid";
      }
    },
  );
  useEffect(() => {
    try {
      localStorage.setItem("nitz909-galeri", tampilanGaleri);
    } catch {
      /* abaikan kuota penuh */
    }
  }, [tampilanGaleri]);
  const [templateAktif, setTemplateAktif] = useState("laporan_kegiatan");
  const [modeLanjutan, setModeLanjutan] = useState(false);
  const [personaAktif, setPersonaAktif] = useState("semua");
  const [drafDipulihkan, setDrafDipulihkan] = useState(false);
  const siapSimpan = useRef(false);

  // F-sumber: berkas yang mau dibuatkan laporan (memory-only, hilang saat reload).
  const [dokumenSumber, setDokumenSumber] = useState<File[]>([]);
  const [seretAktif, setSeretAktif] = useState(false);
  const [pesanSumber, setPesanSumber] = useState<string | null>(null);
  const refPilihSumber = useRef<HTMLInputElement | null>(null);
  const [providerId, setProviderId] = useState(DEFAULT_PROVIDER_ID);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);
  const [kunciInput, setKunciInput] = useState("");
  const [endpointInput, setEndpointInput] = useState("");
  const [pesanSimpan, setPesanSimpan] = useState("");
  const [statusDraf, setStatusDraf] = useState<StatusTombol>(STATUS_AWAL);
  /** Auto-Generate: ganti seluruh kanvas, atau tambahkan di akhir. */
  const [modeAutoGenerate, setModeAutoGenerate] = useState<"ganti" | "tambah">(
    "ganti",
  );
  /**
   * Riwayat undo khusus Auto-Generate.
   *
   * Undo umum (editor.undo()) membatalkan perubahan blok satu per satu —
   * untuk hasil auto-generate yang terdiri dari puluhan blok, user harus
   * menekan Undo puluhan kali. Di sini simpan snapshot lengkap
   * (blocks + judul) tiap kali auto-generate berjalan, sehingga satu klik
   * Undo mengembalikan keadaan sebelum generate.
   */
  const [riwayatAuto, setRiwayatAuto] = useState<
    { blocks: ContentBlock[]; judul: string }[]
  >([]);
  const [indeksAuto, setIndeksAuto] = useState(-1);
  /**
   * Mirror riwayat dalam ref.
   *
   * Penulisan riwayat harus membaca nilai SEBELUM generate (kondisi kanvas
   * saat ini) dan menggabungkannya dengan riwayat lama. Kalau dilakukan lewat
   * state saja, nilai `indeksAuto` di dalam callback bisa basi (React
   * membatching update), sehingga history bisa tertimpa. Ref selalu
   * menyimpan nilai terkini.
   */
  const riwayatAutoRef = useRef<{ blocks: ContentBlock[]; judul: string }[]>([]);
  const indeksAutoRef = useRef(-1);
  /** Menandai snapshot undo sudah diambil pada proses generate berjalan. */
  const snapshotAutoRef = useRef(false);

  /** Simpan keadaan kanvas saat ini sebagai titik undo auto-generate. */
  const catatRiwayatAuto = () => {
    const baru = [
      ...riwayatAutoRef.current.slice(0, indeksAutoRef.current + 1),
      { blocks: klonBlocks(editor.getBlocks()), judul },
    ].slice(-20);
    riwayatAutoRef.current = baru;
    indeksAutoRef.current = baru.length - 1;
    setRiwayatAuto(baru);
    setIndeksAuto(baru.length - 1);
  };
  const [statusEkspor, setStatusEkspor] = useState<
    Record<DocumentType, StatusTombol>
  >({
    pdf: STATUS_AWAL,
    word: STATUS_AWAL,
    pptx: STATUS_AWAL,
    xlsx: STATUS_AWAL,
    diagram: STATUS_AWAL,
  });
  const [statusInfografis, setStatusInfografis] =
    useState<StatusTombol>(STATUS_AWAL);
  // Mutu bahasa kanvas — dihitung ulang setiap isi berubah, tanpa AI.
  const mutuBahasa = useMemo(() => periksaBahasa(blocks), [blocks]);
  const bisaRapikan = mutuBahasa.temuan.some((t) => KODE_BISA_RAPIKAN.has(t.kode));

  // Tema desain presentasi untuk ekspor PPTX (lihat src/lib/ppt-desain.ts).
  const [temaPpt, setTemaPpt] = useState<string>(() => {
    const tersimpan = localStorage.getItem("nitz909-tema-ppt");
    return tersimpan && TEMA_PPT.some((t) => t.id === tersimpan)
      ? tersimpan
      : "swiss";
  });
  const [tabPanduan, setTabPanduan] = useState<"infografis" | "ppt">("ppt");
  // Varian aksen warna (dasar Freebuff tetap): freebuff | blue | green | senja | toska
  const [varianWarna, setVarianWarna] = useState<
    (typeof THEME_VARIANTS)[number]
  >(
    () =>
      (localStorage.getItem(
        "nitz909-variant",
      ) as (typeof THEME_VARIANTS)[number]) || "freebuff",
  );
  // Panel agen AI: toggle + antrean masukan perbaikan per blok
  const [agenAktif, setAgenAktif] = useState(false);

  // F-chat: tinjau + eksekusi presisi per blok yang ditandai user.
  const [chatAktif, setChatAktif] = useState(false);
  // Mode dashboard: ringkas (stat cards) atau lengkap (stat + distribusi format).
  const [dashboardMode, setDashboardMode] = useState<"ringkas" | "lengkap">(() => {
    try {
      return localStorage.getItem("nitz909-dashboard") === "ringkas"
        ? "ringkas"
        : "lengkap";
    } catch {
      return "lengkap";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("nitz909-dashboard", dashboardMode);
    } catch {
      /* abaikan kuota penuh */
    }
  }, [dashboardMode]);
  // Tur 3 langkah: muncul otomatis di kunjungan pertama, dibuka via tombol Tur.
  const [turLangkah, setTurLangkah] = useState<number>(() => {
    try {
      return localStorage.getItem("nitz909-tur") ? 0 : 1;
    } catch {
      return 1;
    }
  });
  const selesaiTur = () => {
    setTurLangkah(0);
    try {
      localStorage.setItem("nitz909-tur", "1");
    } catch {
      /* abaikan */
    }
  };
  const LANGKAH_TUR = [
    "Langkah 1 dari 3 — Pilih template di galeri kiri, atau tekan Muat contoh jadi untuk langsung melihat hasil.",
    "Langkah 2 dari 3 — Isi kanvas: klik teks untuk mengedit, tambah elemen, atau pakai Draf AI dan Fakta & Bukti.",
    "Langkah 3 dari 3 — Selesai: Simpan ke Dokumen Tersimpan, lalu Ekspor ke Word, PPT, Excel, atau Diagram.",
  ];
  const [blokDitandai, setBlokDitandai] = useState<string[]>([]);
  const [pesanChat, setPesanChat] = useState<
    { dari: "user" | "ai"; teks: string; sumber?: SumberWeb[] }[]
  >([]);
  const [inputChat, setInputChat] = useState("");
  const [cariWebAktif, setCariWebAktif] = useState(false);
  const [statusChat, setStatusChat] = useState<StatusTombol>(STATUS_AWAL);
  const [masukanAgen, setMasukanAgen] = useState("");
  const [antreanPerbaikan, setAntreanPerbaikan] = useState<
    {
      blokId: string;
      jenis: "perbaikan" | "analisis" | "prediksi" | "bukti";
      teks: string;
    }[]
  >([]);

  useEffect(() => {
    // Matikan transisi sesaat agar warna baru langsung jadi (anti macet).
    const root = document.documentElement;
    root.classList.add("tanpa-transisi");
    root.setAttribute("data-variant", varianWarna);
    try {
      localStorage.setItem("nitz909-variant", varianWarna);
    } catch {
      /* abaikan */
    }
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("tanpa-transisi")),
    );
    return () => cancelAnimationFrame(raf);
  }, [varianWarna]);
  // Ulir sinematik header: toggle tampil/sembunyi, ingat pilihan user.
  const [ulirAktif, setUlirAktif] = useState<boolean>(() => {
    try {
      return localStorage.getItem("nitz909-ulir") !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("nitz909-ulir", ulirAktif ? "1" : "0");
    } catch {
      /* abaikan */
    }
  }, [ulirAktif]);
  const [userTemplates, setUserTemplates] = useState<TemplateGaleri[]>(() => {
    try {
      const mentah = localStorage.getItem(KUNCI_TEMPLATE_PENGGUNA);
      if (!mentah) return [];
      const parsed: unknown = JSON.parse(mentah);
      if (!Array.isArray(parsed)) return [];
      const ids = new Set(ID_BAWAAN);
      const lolos: TemplateGaleri[] = [];
      for (const item of parsed) {
        const { template } = validasiTemplateImpor(item, ids);
        if (template) {
          lolos.push(template);
          ids.add(template.id);
        }
      }
      return lolos;
    } catch {
      return [];
    }
  });
  const [imporPesan, setImporPesan] = useState<{
    variant: "success" | "error";
    teks: string;
  } | null>(null);
  const fileImporRef = useRef<HTMLInputElement>(null);
  const [metadata, setMetadata] = useState<LaporanMetadata>(bacaMetadata);
  const [statusImpor, setStatusImpor] = useState<{
    variant: "success" | "error";
    teks: string;
  } | null>(null);
  const fileDataRef = useRef<HTMLInputElement>(null);
  const stats = useDocumentStats(blocks);

  // Jumlah karakter & kata dari seluruh teks blok.
  const hitungKata = useMemo(() => {
    const teks: string[] = [];
    const kunci = new Set([
      "judul",
      "text",
      "code",
      "source",
      "caption",
      "alt",
    ]);
    const jalan = (nilai: unknown): void => {
      if (typeof nilai === "string") teks.push(nilai);
      else if (Array.isArray(nilai)) nilai.forEach(jalan);
      else if (nilai && typeof nilai === "object")
        Object.entries(nilai).forEach(([k, v]) => {
          if (kunci.has(k)) jalan(v);
        });
    };
    blocks.forEach(jalan);
    const gabung = teks.join(" ").replace(/\s+/g, " ").trim();
    return {
      karakter: gabung.length,
      kata: gabung ? gabung.split(" ").length : 0,
    };
  }, [blocks]);

  const sinkron = () => {
    setBlocks([...editor.getBlocks()]);
    setVersion((v) => v + 1);
  };

  useEffect(() => {
    let pulih = false;
    try {
      const mentah = localStorage.getItem("nitz909-draft");
      if (mentah) {
        const d = JSON.parse(mentah);
        if (d && Array.isArray(d.blocks) && d.blocks.length > 0) {
          editor.setBlocks(klonBlocks(d.blocks));
          if (typeof d.judul === "string" && d.judul) setJudul(d.judul);
          setTemplateAktif(
            typeof d.templateAktif === "string" ? d.templateAktif : "",
          );
          pulih = true;
        }
      }
    } catch {
      /* draf rusak — pakai template bawaan */
    }
    if (!pulih) {
      const awal = getTemplate("laporan_kegiatan");
      if (awal) {
        editor.setBlocks(klonBlocks(awal.blocks));
        setJudul(awal.judulDokumen);
      }
    }
    setDrafDipulihkan(pulih);
    siapSimpan.current = true;
    sinkron();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave draf tiap ada perubahan (pulih otomatis saat dibuka lagi).
  // Lewati sampai mount selesai + jangan timpa draf berisi dengan kanvas kosong.
  useEffect(() => {
    if (!siapSimpan.current) return;
    if (blocks.length === 0) return;
    try {
      localStorage.setItem(
        "nitz909-draft",
        JSON.stringify({ judul, blocks, templateAktif, saat: Date.now() }),
      );
    } catch {
      /* penyimpanan penuh/diblokir — sesi tetap jalan */
    }
  }, [judul, blocks, templateAktif]);

  // Sesi ketikan di kanvas tidak lewat `ubah()`, jadi state React harus
  // disinkronkan sendiri lewat `onEdit` — tanpa itu ekspor memakai teks lama.
  useEffect(() => {
    editor.setOnEdit(() => setBlocks([...editor.getBlocks()]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Kontrol di dalam blok (tipe grafik, ±baris data) butuh render ulang.
  useEffect(() => {
    editor.setOnRedraw(() => sinkron());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Toolbar tiap blok (naik/turun/ganda/hapus).
  useEffect(() => {
    editor.setOnBlockAction((aksi, id) => {
      ubah(() => {
        if (aksi === "naik") editor.moveBlock(id, "up");
        else if (aksi === "turun") editor.moveBlock(id, "down");
        else if (aksi === "ganda") editor.duplicateBlock(id);
        else editor.removeBlock(id);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const ubah = (fn: () => void) => {
    fn();
    sinkron();
  };

  // F-sumber: tambah berkas sumber (klik / drag-drop); tolak yang kebesaran/duplikat.
  const tambahBerkasSumber = (daftar: FileList | File[]) => {
    const semua = Array.from(daftar);
    const baru = semua.filter(
      (f) =>
        f.size <= 10 * 1024 * 1024 &&
        !dokumenSumber.some((d) => d.name === f.name && d.size === f.size),
    );
    if (baru.length > 0) setDokumenSumber((d) => [...d, ...baru]);
    setPesanSumber(
      baru.length < semua.length
        ? `${semua.length - baru.length} berkas ditolak (melebihi 10 MB / duplikat).`
        : null,
    );
  };

  const hapusSumber = (idx: number) =>
    setDokumenSumber((d) => d.filter((_, i) => i !== idx));

  const formatUkuran = (byte: number) =>
    byte >= 1024 * 1024
      ? `${(byte / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(byte / 1024))} KB`;

  // F-sumber: konteks untuk prompt AI — nama berkas + cuplikan isi teks.
  const konteksSumber = async (): Promise<string> => {
    if (dokumenSumber.length === 0) return "";
    const bagian: string[] = [];
    for (const f of dokumenSumber) {
      let cuplik = "";
      if (/\.(txt|md|csv|json|log)$/i.test(f.name) && f.size < 200 * 1024) {
        try {
          cuplik = (await f.text()).slice(0, 2000);
        } catch {
          /* baca gagal — nama saja cukup */
        }
      }
      bagian.push(
        `- ${f.name} (${formatUkuran(f.size)}${cuplik ? `): ${cuplik}` : ")"}`,
      );
    }
    return `\nDokumen sumber yang dilampirkan user:\n${bagian.join("\n")}`;
  };

  const pakaiTemplate = (t: TemplateGaleri) => {
    ubah(() => editor.setBlocks(klonBlocks(t.blocks)));
    setJudul(t.judulDokumen);
    setTemplateAktif(t.id);
  };

  // Persona: satu tekan -> filter galeri + muat template pertama + pola judul.
  const pakaiPersona = (id: string) => {
    setPersonaAktif(id);
    setKategori("semua");
    const p = getPersona(id);
    if (!p) return;
    const pertama = p.templateIds
      .map((tid) => getTemplate(tid))
      .find((t): t is TemplateGaleri => !!t);
    if (pertama) {
      pakaiTemplate(pertama);
      setJudul(p.polaJudul);
    }
  };

  // Isi contoh offline: semua placeholder [Tulis…] diisi bank contoh persona.
  const isiContoh = () => {
    const persona = getPersona(personaAktif);
    const bank = persona ? persona.contoh : CONTOH_UMUM;
    let i = 0;
    ubah(() => {
      editor.getBlocks().forEach((b) => {
        if (
          (b.type === "paragraph" || b.type === "heading") &&
          b.text.includes("[Tulis")
        ) {
          editor.updateBlock(b.id, {
            text: bank[i % bank.length],
          } as Partial<ContentBlock>);
          i += 1;
        }
      });
    });
  };

  // Dokumen tersimpan: banyak dokumen bernama di localStorage + ganti nama.
  type DokumenTersimpan = {
    id: string;
    nama: string;
    judul: string;
    blocks: ContentBlock[];
    templateAktif: string;
    saat: number;
  };
  const bacaDokumenTersimpan = (): DokumenTersimpan[] => {
    try {
      const mentah = localStorage.getItem(KUNCI_DOKUMEN_TERSIMPAN);
      const d = mentah ? JSON.parse(mentah) : [];
      return Array.isArray(d) ? d : [];
    } catch {
      return [];
    }
  };
  const [daftarDokumen, setDaftarDokumen] =
    useState<DokumenTersimpan[]>(bacaDokumenTersimpan);
  const [namaDokumenBaru, setNamaDokumenBaru] = useState("");
  const [idGantiNama, setIdGantiNama] = useState("");
  const [namaSementara, setNamaSementara] = useState("");
  const [pesanDokumen, setPesanDokumen] = useState("");
  const tulisDaftarDokumen = (daftar: DokumenTersimpan[]) => {
    setDaftarDokumen(daftar);
    try {
      localStorage.setItem(KUNCI_DOKUMEN_TERSIMPAN, JSON.stringify(daftar));
    } catch {
      /* penyimpanan penuh — daftar sesi tetap jalan */
    }
  };
  const simpanDokumen = () => {
    if (blocks.length === 0) {
      setPesanDokumen("Kanvas kosong — tidak ada yang disimpan.");
      return;
    }
    const nama = namaDokumenBaru.trim() || judul.trim() || "Tanpa nama";
    const baru: DokumenTersimpan = {
      id: buatId("dok"),
      nama,
      judul,
      blocks: klonBlocks(editor.getBlocks()),
      templateAktif,
      saat: Date.now(),
    };
    tulisDaftarDokumen([baru, ...daftarDokumen].slice(0, 20));
    setNamaDokumenBaru("");
    setPesanDokumen('Dokumen "' + nama + '" tersimpan.');
  };
  const bukaDokumen = (id: string) => {
    const d = daftarDokumen.find((x) => x.id === id);
    if (!d) return;
    ubah(() => editor.setBlocks(klonBlocks(d.blocks)));
    setJudul(d.judul);
    setTemplateAktif(d.templateAktif);
    setPesanDokumen('Dokumen "' + d.nama + '" dibuka di kanvas.');
  };
  const hapusDokumen = (id: string) => {
    tulisDaftarDokumen(daftarDokumen.filter((x) => x.id !== id));
  };
  const simpanGantiNama = (id: string) => {
    const nama = namaSementara.trim();
    if (!nama) return;
    tulisDaftarDokumen(
      daftarDokumen.map((x) => (x.id === id ? { ...x, nama } : x)),
    );
    setIdGantiNama("");
  };

  // Contoh sekali-klik: template + judul demo + semua placeholder terisi.
  const muatContohJadi = () => {
    const t = getTemplate("laporan_kegiatan");
    if (!t) return;
    pakaiTemplate(t);
    setJudul("Contoh Laporan Kegiatan (DATA UJI)");
    isiContoh();
  };

  // Ekspor semua format unduhan (PDF butuh dialog cetak — tetap manual).
  const eksporSemua = async () => {
    for (const f of FORMAT_INFO) {
      if (f.format === "pdf") continue;
      await handleEkspor(f.format, f.ekstensi);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem(
        KUNCI_TEMPLATE_PENGGUNA,
        JSON.stringify(userTemplates),
      );
    } catch {
      /* penyimpanan penuh/diblokir — galeri sesi tetap jalan */
    }
  }, [userTemplates]);

  const imporBerkas = async (file: File) => {
    if (file.size > BATAS_IMPOR_BYTE) {
      setImporPesan({
        variant: "error",
        teks: `Impor ditolak: berkas "${file.name}" melebihi 256 KB.`,
      });
      return;
    }
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch (e) {
      setImporPesan({
        variant: "error",
        teks: `Impor ditolak: berkas bukan JSON valid (${e instanceof Error ? e.message : "gagal dibaca"}).`,
      });
      return;
    }
    const idTerpakai = new Set([
      ...ID_BAWAAN,
      ...userTemplates.map((t) => t.id),
    ]);
    const { template, alasan } = validasiTemplateImpor(data, idTerpakai);
    if (!template) {
      setImporPesan({
        variant: "error",
        teks: `Impor ditolak: ${alasan.join(" ")}`,
      });
      return;
    }
    setUserTemplates((prev) => [...prev, template]);
    setImporPesan({
      variant: "success",
      teks: `Template "${template.nama}" berhasil diimpor.`,
    });
    pakaiTemplate(template);
  };

  // ===== F1: metadata laporan (localStorage `nitz909-metadata`) =====
  const ubahMetadata = (patch: Partial<LaporanMetadata>) => {
    setMetadata((prev) => {
      const baru = { ...prev, ...patch };
      try {
        localStorage.setItem(KUNCI_METADATA_LS, JSON.stringify(baru));
      } catch {
        /* penyimpanan penuh/diblokir — nilai tetap dipakai di memori */
      }
      return baru;
    });
  };

  const terapkanMetadata = () => {
    const isi = barisIdentitas(metadata);
    if (!isi) {
      setStatusImpor({
        variant: "error",
        teks: "Isi metadata dulu (minimal satu kolom).",
      });
      return;
    }
    const sekarang = editor.getBlocks();
    const iJudul = sekarang.findIndex(
      (b) =>
        b.type === "heading" &&
        b.text.trim().toLowerCase() === "identitas dokumen",
    );
    let baru: ContentBlock[];
    if (iJudul >= 0) {
      baru = klonBlocks(sekarang);
      const blokIsi: ContentBlock = {
        id: buatId("paragraph"),
        type: "paragraph",
        text: isi,
      };
      const sesudah = baru[iJudul + 1];
      if (sesudah && sesudah.type === "paragraph") baru[iJudul + 1] = blokIsi;
      else
        baru = [
          ...baru.slice(0, iJudul + 1),
          blokIsi,
          ...baru.slice(iJudul + 1),
        ];
    } else {
      baru = [
        {
          id: buatId("heading"),
          type: "heading",
          level: 2,
          text: "Identitas Dokumen",
        },
        { id: buatId("paragraph"), type: "paragraph", text: isi },
        ...klonBlocks(sekarang),
      ];
    }
    ubah(() => editor.setBlocks(baru));
    setStatusImpor({
      variant: "success",
      teks: "Metadata diterapkan ke dokumen.",
    });
  };

  // ===== F3: impor data CSV/JSON jadi blok tabel/grafik/daftar =====
  const imporDataBerkas = async (file: File) => {
    if (file.size > BATAS_IMPOR_BYTE) {
      setStatusImpor({
        variant: "error",
        teks: `Impor ditolak: berkas "${file.name}" melebihi ${BATAS_IMPOR_BYTE / 1024} KB.`,
      });
      return;
    }
    let kandungan = "";
    try {
      kandungan = await file.text();
    } catch {
      setStatusImpor({ variant: "error", teks: "Gagal membaca berkas." });
      return;
    }
    const isJson = /\.json$/i.test(file.name);
    try {
      let dataJson: unknown = null;
      if (isJson) {
        try {
          dataJson = JSON.parse(kandungan);
        } catch {
          throw new Error(`Impor ditolak: "${file.name}" bukan JSON valid.`);
        }
      }
      const hasil = isJson ? blokDariJSON(dataJson) : blokDariCSV(kandungan);
      ubah(() => hasil.blocks.forEach((b) => editor.addBlock(b)));
      const tambahan = hasil.blocks.some((b) => b.type === "chart")
        ? "tabel + grafik dibuat"
        : hasil.blocks.some((b) => b.type === "list")
          ? "daftar dibuat"
          : "tabel dibuat";
      setStatusImpor({
        variant: "success",
        teks: `Impor: ${hasil.baris} baris, ${hasil.kolom} kolom → ${tambahan}`,
      });
    } catch (e) {
      setStatusImpor({
        variant: "error",
        teks: e instanceof Error ? e.message : "Gagal mengimpor berkas data.",
      });
    }
  };

  type DistributiveOmit<T, K extends keyof T> = T extends unknown
    ? Omit<T, K>
    : never;
  const tambahBlok = (blok: DistributiveOmit<ContentBlock, "id">) =>
    ubah(() =>
      editor.addBlock({ ...blok, id: buatId(blok.type) } as ContentBlock),
    );

  // Susun manual (m02614): sisipkan satu bagian standar PRD ke kanvas.
  // ID dibuat baru tiap sisipan agar boleh dipakai berulang kali.
  const tambahBagian = (bagianId: string) => {
    const bagian = BAGIAN_STANDAR.find((x) => x.id === bagianId);
    if (!bagian) return;
    ubah(() => {
      klonBlocks(bagian.blocks).forEach((blok) => {
        editor.addBlock({ ...blok, id: buatId(blok.type) } as ContentBlock);
      });
    });
    setTemplateAktif("");
  };

  const tombolTambah: { label: string; ikon: string; aksi: () => void }[] = [
    {
      label: "Judul",
      ikon: "H",
      aksi: () => tambahBlok({ type: "heading", level: 2, text: "Judul Baru" }),
    },
    {
      label: "Paragraf",
      ikon: "¶",
      aksi: () =>
        tambahBlok({ type: "paragraph", text: "Tulis isi dokumen di sini..." }),
    },
    {
      label: "Daftar",
      ikon: "☰",
      aksi: () =>
        tambahBlok({
          type: "list",
          ordered: false,
          items: [{ text: "Butir pertama" }, { text: "Butir kedua" }],
        }),
    },
    {
      label: "Tabel",
      ikon: "▦",
      aksi: () =>
        tambahBlok({
          type: "table",
          headers: ["Kolom 1", "Kolom 2", "Kolom 3"],
          rows: [["Isi", "Isi", "Isi"]],
        }),
    },
    {
      label: "Kode",
      ikon: "</>",
      aksi: () =>
        tambahBlok({
          type: "code",
          language: "text",
          code: "Tulis data/kode di sini",
        }),
    },
    {
      label: "Gambar",
      ikon: "gambar",
      aksi: () =>
        tambahBlok({ type: "image", src: "", alt: "Keterangan gambar" }),
    },
    {
      label: "Grafik",
      ikon: "statistik",
      aksi: () =>
        tambahBlok({
          type: "chart",
          chartType: "bar",
          data: {
            labels: ["A", "B", "C"],
            datasets: [{ label: "Nilai", data: [3, 5, 4] }],
          },
        }),
    },
    {
      label: "Diagram",
      ikon: "alur",
      aksi: () =>
        tambahBlok({
          type: "diagram",
          diagramType: "mermaid",
          source: "graph LR; A[Mulai] --> B[Proses]; B --> C[Selesai];",
        }),
    },
    {
      label: "Pembatas",
      ikon: "―",
      aksi: () => tambahBlok({ type: "divider" }),
    },
  ];

  const handleEkspor = async (format: DocumentType, _ekstensi: string) => {
    if (blocks.length === 0) {
      setStatusEkspor((s) => ({
        ...s,
        [format]: {
          state: "gagal",
          pesan: "Belum ada isi. Pilih template atau tambah blok dulu.",
        },
      }));
      return;
    }
    setStatusEkspor((s) => ({
      ...s,
      [format]: {
        state: "loading",
        pesan: "Menyiapkan berkas...",
      },
    }));
    try {
      const hasil = await eksporDokumen(
        format,
        judul || "Dokumen NitZ-909",
        adaMetadata(metadata)
          ? [
              {
                id: buatId("paragraph"),
                type: "paragraph",
                text: barisIdentitas(metadata),
              } as ContentBlock,
              ...blocks,
            ]
          : blocks,
        getModelLabel(providerId, modelId),
        [...dokumenSumber.map((f) => f.name), ...daftarTautan],
        (msg) =>
          setStatusEkspor((s) => ({
            ...s,
            [format]: { state: "loading", pesan: msg },
          })),
        { temaPpt },
      );
      setStatusEkspor((s) => ({
        ...s,
        [format]: { state: "sukses", pesan: hasil.pesan },
      }));
    } catch (e) {
      setStatusEkspor((s) => ({
        ...s,
        [format]: {
          state: "gagal",
          pesan:
            e instanceof Error ? e.message : "Terjadi kesalahan saat ekspor.",
        },
      }));
    }
  };

  // ===== Pusat Fakta & Bukti: fakta mentah + tautan berita -> laporan intelijen =====
  const [faktaMentah, setFaktaMentah] = useState("");
  const [tautanBaru, setTautanBaru] = useState("");
  const [daftarTautan, setDaftarTautan] = useState<string[]>([]);
  const [hasilBukti, setHasilBukti] = useState<BuktiTautan[]>([]);
  const [isiArtikel, setIsiArtikel] = useState("");
  // Tempel-isi-artikel: jalur utama yang selalu jalan (tanpa internet pun bisa).
  const jadikanBukti = () => {
    const teks = isiArtikel.trim();
    if (teks.length < 50) {
      setStatusBukti({
        state: "gagal",
        pesan:
          "Tempelan terlalu pendek (min. 50 karakter) — salin isi beritanya lalu tempel di sini.",
      });
      return;
    }
    const baris = teks
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean);
    const judulArtikel = (baris[0] ?? "Artikel tempelan").slice(0, 120);
    setHasilBukti((prev) => [
      ...prev,
      {
        url: "tempelan-manual-" + (prev.length + 1),
        judul: judulArtikel,
        penerbit: "Tempelan manual",
        teks,
        status: "ok",
      } as BuktiTautan,
    ]);
    setIsiArtikel("");
    setStatusBukti({
      state: "sukses",
      pesan:
        "Artikel tempelan jadi bukti (" +
        teks.length +
        " karakter). Lanjut Susun.",
    });
  };
  const [statusBukti, setStatusBukti] = useState<StatusTombol>(STATUS_AWAL);

  const tambahTautan = () => {
    const u = tautanBaru.trim();
    if (!/^https?:\/\/.+\..+/.test(u)) {
      setStatusBukti({
        state: "gagal",
        pesan:
          "Tautan harus diawali http(s):// — tempel alamat berita lengkap.",
      });
      return;
    }
    if (daftarTautan.includes(u)) {
      setStatusBukti({
        state: "gagal",
        pesan: "Tautan itu sudah ada di daftar.",
      });
      return;
    }
    if (daftarTautan.length >= 10) {
      setStatusBukti({
        state: "gagal",
        pesan: "Maksimal 10 tautan per laporan.",
      });
      return;
    }
    setDaftarTautan((d) => [...d, u]);
    setTautanBaru("");
    setStatusBukti({
      state: "sukses",
      pesan:
        "Tautan ditambahkan. Klik Ambil Isi Tautan untuk mengunduh isinya.",
    });
  };

  const ambilIsiTautan = async () => {
    if (!daftarTautan.length) {
      setStatusBukti({
        state: "gagal",
        pesan: "Belum ada tautan. Tempel dulu alamat beritanya.",
      });
      return;
    }
    const hasil: BuktiTautan[] = [];
    for (let i = 0; i < daftarTautan.length; i++) {
      setStatusBukti({
        state: "loading",
        pesan: `Mengambil tautan ${i + 1}/${daftarTautan.length}…`,
      });
      hasil.push(await ambilTautan(daftarTautan[i]));
    }
    setHasilBukti(hasil);
    const ok = hasil.filter((h) => h.status === "ok");
    const totalKarakter = ok.reduce((a, h) => a + h.teks.length, 0);
    setStatusBukti(
      ok.length
        ? {
            state: "sukses",
            pesan: `${ok.length}/${hasil.length} tautan terurai — ${totalKarakter} karakter bukti siap dianalisis.`,
          }
        : {
            state: "gagal",
            pesan:
              "Semua tautan gagal diambil. Situs berita sering memblokir pengambilan langsung — salin isi beritanya sebagai Fakta, atau pakai Chat AI + Cari Web (Google).",
          },
    );
  };

  const susunLaporanIntelijen = async () => {
    const fakta = faktaMentah
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const buktiOk = hasilBukti.filter((h) => h.status === "ok");
    if (!fakta.length && !buktiOk.length) {
      setStatusBukti({
        state: "gagal",
        pesan: "Isi dulu fakta mentah atau ambil isi tautan berita.",
      });
      return;
    }
    const blokBaru: ContentBlock[] = [];
    const sim = bacaSimpananKunci();
    const kunci = (sim.kunci[providerId] ?? "").trim();
    const labelModel = getModelLabel(providerId, modelId);
    if (!kunci) {
      // Mode offline: kerangka 6 seksi terisi fakta — AI memperkaya bila kunci tersedia.
      setStatusBukti({
        state: "loading",
        pesan: "Menyusun kerangka offline dari fakta dan bukti…",
      });
      const seksi: [string, string][] = [
        [
          "Fakta Terverifikasi",
          fakta.length
            ? fakta.map((f) => `- ${f}`).join("\n")
            : "- [Tulis fakta utama di sini]",
        ],
        [
          "Analisis Mendalam",
          "- Aktor yang muncul: [Tulis dari fakta dan bukti]\n- Kepentingan yang bertentangan: [Tulis]\n- Celah informasi: [Tulis]",
        ],
        [
          "Peta Pola",
          "- Pola berulang 1: [modus — frekuensi — contoh bukti]\n- Pola berulang 2: [modus — frekuensi — contoh bukti]",
        ],
        [
          "Prediksi Ancaman dan Kerawanan",
          "- Ancaman paling mungkin: [Tulis + indikatornya]\n- Kerawanan yang harus ditutup: [Tulis]",
        ],
        ["Saran", "- [Tulis langkah mitigasi 1]\n- [Tulis langkah mitigasi 2]"],
        [
          "Kesimpulan dan Penutup",
          "[Tulis kesimpulan satu paragraf, lalu kalimat penutup formal.]",
        ],
      ];
      seksiKeBlok(
        seksi.map(([j, i]) => `## ${j}\n${i}`).join("\n\n"),
        buatId,
      ).forEach((x) => blokBaru.push(x));
    } else {
      try {
        setStatusBukti({
          state: "loading",
          pesan: `Menganalisis ${fakta.length} fakta + ${buktiOk.length} bukti dengan ${labelModel}…`,
        });
        const basis = (sim.endpoint || "").trim();
        if (
          basis &&
          !/^(https?:\/\/)?(localhost|127\.0\.0\.1|api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com)/i.test(
            basis,
          )
        ) {
          setStatusBukti({
            state: "gagal",
            pesan: `Endpoint khusus "${basis}" tidak dikenal. API key akan dikirim ke host tersebut. Gunakan hanya host yang Anda percayai.`,
          });
          return;
        }
        const buktiTeks = buktiOk
          .map(
            (h, i) =>
              `[S${i + 1}] ${h.penerbit ? `${h.penerbit} — ` : ""}${h.judul}\n${h.teks}`,
          )
          .join("\n\n");
        const dasar = {
          provider: providerId as ProviderAI,
          model: modelId,
          apiKey: kunci,
          ...(basis ? { baseUrl: basis } : {}),
          pesan: [
            {
              peran: "system" as const,
              teks: "Kamu analis intelijen berbahasa Indonesia formal. Jawab HANYA dengan 6 seksi persis berformat '## Fakta Terverifikasi', '## Analisis Mendalam', '## Peta Pola', '## Prediksi Ancaman dan Kerawanan', '## Saran', '## Kesimpulan dan Penutup'. Tiap klaim penting beri rujukan [S1]/[S2] sesuai bukti. Bedakan FAKTA (dari input) dan PENILAIAN (analisismu). Jangan menulis label DATA UJI.",
            },
            {
              peran: "user" as const,
              teks: `Judul: ${judul || "Tanpa judul"}\n\nFAKTA MENTAH:\n${fakta.map((f, i) => `${i + 1}. ${f}`).join("\n") || "(tidak ada)"}\n\nBUKTI DARI SUMBER:\n${buktiTeks || "(tidak ada)"}\n\nSusun laporan intelijen lengkap 6 seksi.`,
            },
          ],
        };
        let respons: string;
        if (cariWebAktif && providerId === "google") {
          try {
            respons = (await generateCompletionSumber(dasar)).teks;
          } catch {
            respons = await generateCompletion(dasar);
          }
        } else {
          respons = await generateCompletion(dasar);
        }
        const pecah = seksiKeBlok(respons, buatId);
        if (!pecah.length)
          throw new Error(
            "Respons AI tidak mengikuti format 6 seksi — coba lagi.",
          );
        pecah.forEach((x) => blokBaru.push(x));
      } catch (e) {
        setStatusBukti({
          state: "gagal",
          pesan: e instanceof Error ? e.message : "Penyusunan AI gagal.",
        });
        return;
      }
    }
    if (buktiOk.length) {
      blokBaru.push({
        id: buatId("heading"),
        type: "heading",
        level: 2,
        text: "Daftar Bukti",
      });
      blokBaru.push({
        id: buatId("list"),
        type: "list",
        ordered: false,
        items: buktiOk.map((h, i) => ({
          text: `[S${i + 1}] ${h.penerbit ? `${h.penerbit} — ` : ""}${h.judul}: ${h.url}`,
        })),
      });
    }
    blokBaru.forEach((b) =>
      editor.addBlock({ ...b, id: buatId(b.type) } as ContentBlock),
    );
    sinkron();
    setStatusBukti({
      state: "sukses",
      pesan: `Laporan tersusun: ${blokBaru.length} blok di kanvas${buktiOk.length ? " + Daftar Bukti" : ""}. Lanjut Simpan/Ekspor.`,
    });
  };

  // ===== Agen AI: saran perbaikan / analisis / prediksi / penguatan bukti =====
  const [statusAgen, setStatusAgen] = useState<StatusTombol>(STATUS_AWAL);
  const [targetBlokId, setTargetBlokId] = useState("");
  const [jenisMasukan, setJenisMasukan] = useState<
    "perbaikan" | "analisis" | "prediksi" | "bukti"
  >("perbaikan");

  const teksIsiBlok = (b: ContentBlock): string => {
    if (b.type === "paragraph" || b.type === "heading") return b.text;
    if (b.type === "list") return b.items.map((i) => i.text).join("; ");
    return JSON.stringify(b).slice(0, 300);
  };

  // F-chat: label pendek blok untuk daftar tanda.
  const labelBlok = (b: ContentBlock): string => {
    const t =
      b.type === "heading" || b.type === "paragraph"
        ? b.text
        : b.type === "list"
          ? b.items.map((i) => i.text).join("; ")
          : b.type;
    return t.length > 60 ? `${t.slice(0, 60)}…` : t;
  };

  const toggleTanda = (id: string) =>
    setBlokDitandai((d) =>
      d.includes(id) ? d.filter((x) => x !== id) : [...d, id],
    );

  // F-chat: perintah user dieksekusi HANYA pada blok bertanda (presisi per blok).
  const kirimChat = async () => {
    const perintah = inputChat.trim();
    if (!perintah || statusChat.state === "loading") return;
    const s = bacaSimpananKunci();
    const kunci = (s.kunci[providerId] ?? "").trim();
    if (!kunci) {
      setStatusChat({
        state: "gagal",
        pesan: `Isi kunci ${provider.label} dulu.`,
      });
      return;
    }
    const target = editor
      .getBlocks()
      .filter(
        (b) =>
          (b.type === "heading" || b.type === "paragraph") &&
          blokDitandai.includes(b.id),
      );
    if (target.length === 0) {
      setStatusChat({
        state: "gagal",
        pesan: "Tandai dulu blok Judul / Paragraf yang mau dieksekusi.",
      });
      return;
    }
    if (cariWebAktif && providerId !== "google") {
      setStatusChat({
        state: "gagal",
        pesan: "Pencarian web hanya didukung provider Google.",
      });
      return;
    }
    const basis = (s.endpoint || "").trim();
    setPesanChat((p) => [...p, { dari: "user", teks: perintah }]);
    setInputChat("");
    setStatusChat({
      state: "loading",
      pesan: `Mengeksekusi ${target.length} blok…`,
    });
    try {
      const konteks = await konteksSumber();
      let ok = 0;
      for (const blok of target) {
        const dasar = {
          provider: providerId as ProviderAI,
          model: modelId,
          apiKey: kunci,
          ...(basis ? { baseUrl: basis } : {}),
          pesan: [
            {
              peran: "system" as const,
              teks: "Kamu penyunting laporan berbahasa Indonesia formal. Tulis ULANG isi blok sesuai perintah user, siap pakai, tanpa penjelasan tambahan. Jangan menulis label DATA UJI.",
            },
            {
              peran: "user" as const,
              teks: `Judul dokumen: ${judul || "Tanpa judul"}. Isi blok saat ini: ${teksIsiBlok(blok)}. Perintah user: ${perintah}${konteks}`,
            },
          ],
        };
        const hasil = cariWebAktif
          ? await generateCompletionSumber(dasar)
          : {
              teks: await generateCompletion(dasar),
              sumber: [] as SumberWeb[],
            };
        editor.updateBlock(blok.id, {
          text: hasil.teks,
        } as Partial<ContentBlock>);
        ok++;
        setPesanChat((p) => [
          ...p,
          {
            dari: "ai",
            teks: `Blok "${labelBlok(blok)}" diperbarui.`,
            sumber: hasil.sumber,
          },
        ]);
      }
      sinkron();
      setBlokDitandai([]);
      setStatusChat({ state: "sukses", pesan: `${ok} blok dieksekusi.` });
    } catch (e) {
      setStatusChat({
        state: "gagal",
        pesan: e instanceof Error ? e.message : "Chat AI gagal.",
      });
    }
  };

  const mintaSaranAgen = async () => {
    const target = editor.getBlocks().find((b) => b.id === targetBlokId);
    if (!target) {
      setStatusAgen({
        state: "gagal",
        pesan: "Pilih dulu blok target di daftar.",
      });
      return;
    }
    if (!masukanAgen.trim()) {
      setStatusAgen({
        state: "gagal",
        pesan: "Tulis dulu masukan perbaikan untuk AI.",
      });
      return;
    }
    const s = bacaSimpananKunci();
    const kunci = (s.kunci[providerId] ?? "").trim();
    const basis = (s.endpoint || "").trim();
    if (!kunci) {
      setStatusAgen({
        state: "gagal",
        pesan: `Isi kunci ${provider.label} dulu.`,
      });
      return;
    }
    setStatusAgen({ state: "loading", pesan: "Agen AI menyusun saran..." });
    try {
      const konteks = await konteksSumber();
      const teks = await generateCompletion({
        provider: providerId as ProviderAI,
        model: modelId,
        apiKey: kunci,
        ...(basis ? { baseUrl: basis } : {}),
        pesan: [
          {
            peran: "system",
            teks: "Kamu penyunting laporan berbahasa Indonesia formal. Beri teks pengganti siap pakai, 2-5 kalimat. Jangan menulis label DATA UJI.",
          },
          {
            peran: "user",
            teks: `Jenis: ${jenisMasukan}. Judul dokumen: ${judul || "Tanpa judul"}. Isi blok target: ${teksIsiBlok(target)}. Masukan user: ${masukanAgen.trim()}${konteks}`,
          },
        ],
      });
      setAntreanPerbaikan((prev) => [
        ...prev,
        { blokId: target.id, jenis: jenisMasukan, teks },
      ]);
      setStatusAgen({
        state: "sukses",
        pesan: "Saran AI masuk antrean — cek lalu Terapkan.",
      });
      setMasukanAgen("");
    } catch (e) {
      setStatusAgen({
        state: "gagal",
        pesan: e instanceof Error ? e.message : "Gagal meminta saran AI.",
      });
    }
  };

  const terapkanSaran = (index: number) => {
    const item = antreanPerbaikan[index];
    if (!item) return;
    const target = editor.getBlocks().find((b) => b.id === item.blokId);
    if (!target || (target.type !== "paragraph" && target.type !== "heading")) {
      setStatusAgen({
        state: "gagal",
        pesan: "Blok target tak ada / bukan teks — salin manual dari antrean.",
      });
      return;
    }
    ubah(() =>
      editor.updateBlock(target.id, {
        text: item.teks,
      } as Partial<ContentBlock>),
    );
    setAntreanPerbaikan((prev) => prev.filter((_, i) => i !== index));
    setStatusAgen({
      state: "sukses",
      pesan: "Saran diterapkan — edit manual bila perlu, lalu Simpan/Ekspor.",
    });
  };

  const handleEksporInfografis = async () => {
    if (blocks.length === 0) {
      setStatusInfografis({
        state: "gagal",
        pesan: "Belum ada isi. Pilih template atau tambah blok dulu.",
      });
      return;
    }
    setStatusInfografis({
      state: "loading",
      pesan: "Menyiapkan infografis...",
    });
    try {
      await renderInfografisPng(judul || "Dokumen NitZ-909", blocks, mode);
      setStatusInfografis({
        state: "sukses",
        pesan: "Infografis PNG terunduh (1080x1350).",
      });
    } catch (e) {
      setStatusInfografis({
        state: "gagal",
        pesan:
          e instanceof Error ? e.message : "Terjadi kesalahan saat ekspor.",
      });
    }
  };

  const semuaTemplate = [...TEMPLATES, ...userTemplates];
  const cari = cariTemplate.trim().toLowerCase();
  const persona = PERSONAS.find((p) => p.id === personaAktif);
  const daftarTemplate = semuaTemplate.filter((t) => {
    if (persona && !persona.templateIds.includes(t.id)) return false;
    if (kategori !== "semua" && t.kategori !== kategori) return false;
    if (formatFilter !== "semua" && t.format !== formatFilter) return false;
    if (!cari) return true;
    return (
      t.nama.toLowerCase().includes(cari) ||
      t.deskripsi.toLowerCase().includes(cari) ||
      t.bagianPRD?.toLowerCase().includes(cari) === true
    );
  });

  // Galeri dikelompokkan per kategori untuk akordeon buka/tutup.
  const GRUP_KATEGORI: KategoriTemplate[] = [
    "dokumen",
    "presentasi",
    "spreadsheet",
    "infografis",
  ];
  const grupTemplate = GRUP_KATEGORI.map((kat) => ({
    kat,
    daftar: daftarTemplate.filter((t) => t.kategori === kat),
  })).filter((g) => g.daftar.length > 0);

  const provider = getProvider(providerId);

  // Muat kunci + endpoint tersimpan tiap ganti provider.
  useEffect(() => {
    const s = bacaSimpananKunci();
    setKunciInput(s.kunci[providerId] ?? "");
    setEndpointInput(s.endpoint);
    setPesanSimpan("");
  }, [providerId]);

  const simpanKunci = () => {
    const s = bacaSimpananKunci();
    s.kunci[providerId] = kunciInput.trim();
    s.endpoint = endpointInput.trim();
    try {
      localStorage.setItem(KUNCI_AI_LS, JSON.stringify(s));
      setPesanSimpan("Kunci tersimpan di browser ini.");
    } catch {
      setPesanSimpan("Gagal menyimpan. Browser memblokir penyimpanan lokal.");
    }
  };

  // Draf AI: isi tiap paragraf placeholder "[Tulis …]" lewat provider aktif.
  const isiDrafAI = async () => {
    const s = bacaSimpananKunci();
    const kunci = (s.kunci[providerId] ?? "").trim();
    const basis = (s.endpoint || "").trim();
    if (!kunci) {
      setStatusDraf({
        state: "gagal",
        pesan: `Isi kunci ${provider.label} dulu.`,
      });
      return;
    }
    const target = editor
      .getBlocks()
      .filter((b) => b.type === "paragraph" && b.text.includes("[Tulis"));
    if (target.length === 0) {
      setStatusDraf({
        state: "gagal",
        pesan:
          "Tidak ada placeholder “[Tulis …]” di kanvas. Tambah bagian lewat Tambah Paket Jadi dulu.",
      });
      return;
    }
    const labelModel = getModelLabel(providerId, modelId);
    setStatusDraf({
      state: "loading",
      pesan: `Mengisi ${target.length} bagian dengan ${labelModel}…`,
    });
    try {
      let terisi = 0;
      const konteks = await konteksSumber();
      for (const blok of target) {
        if (blok.type !== "paragraph") continue;
        const daftar = editor.getBlocks();
        const pos = daftar.findIndex((x) => x.id === blok.id);
        let tajuk = "";
        for (let i = pos - 1; i >= 0; i--) {
          const atas = daftar[i];
          if (atas.type === "heading") {
            tajuk = atas.text;
            break;
          }
        }
        const teks = await generateCompletion({
          provider: providerId as ProviderAI,
          model: modelId,
          apiKey: kunci,
          ...(basis ? { baseUrl: basis } : {}),
          pesan: [
            {
              peran: "system",
              teks: "Tulis dalam bahasa Indonesia formal. Jawab 2–4 kalimat. Jangan menulis label DATA UJI.",
            },
            {
              peran: "user",
              teks: `Judul dokumen: ${judul || "Tanpa judul"}.${tajuk ? ` Bagian: ${tajuk}.` : ""} Isi placeholder berikut: ${blok.text}${konteks}`,
            },
          ],
        });
        editor.updateBlock(blok.id, { text: teks } as Partial<ContentBlock>);
        terisi++;
      }
      sinkron();
      setStatusDraf({
        state: "sukses",
        pesan: `${terisi} bagian terisi oleh ${labelModel}`,
      });
    } catch (e) {
      setStatusDraf({
        state: "gagal",
        pesan:
          e instanceof Error
            ? e.message
            : "Terjadi kesalahan saat meminta draf AI.",
      });
    }
  };

  // F2: draf SELURUH dokumen sekali panggil, minta JSON blok dari AI.
  const drafSeluruhDokumen = async () => {
    const s = bacaSimpananKunci();
    const kunci = (s.kunci[providerId] ?? "").trim();
    const basis = (s.endpoint || "").trim();
    if (!kunci) {
      setStatusDraf({
        state: "gagal",
        pesan: `Isi kunci ${provider.label} dulu.`,
      });
      return;
    }
    if (editor.getBlocks().length === 0) {
      setStatusDraf({
        state: "gagal",
        pesan: "Kanvas masih kosong — tidak ada bahan untuk draf.",
      });
      return;
    }
    setStatusDraf({
      state: "loading",
      pesan: "Menyusun draf AI untuk seluruh dokumen…",
    });
    try {
      const hasil = await generateDraft({
        provider: providerId as ProviderAI,
        model: modelId,
        apiKey: kunci,
        ...(basis ? { baseUrl: basis } : {}),
        judul,
        blocks: editor.getBlocks(),
        metadata,
      });
      ubah(() => editor.setBlocks(hasil));
      setStatusDraf({
        state: "sukses",
        pesan: `Draf AI: ${hasil.length} blok dibuat.`,
      });
    } catch (e) {
      setStatusDraf({
        state: "gagal",
        pesan:
          e instanceof Error
            ? e.message
            : "Terjadi kesalahan saat meminta draf AI.",
      });
    }
  };

  return (
    <div
      className="nitz-app-root"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "var(--text)",
      }}
    >
      <style>{`@media (max-width: 1100px) { .nitz-body { flex-wrap: wrap; } .nitz-side { width: 100% !important; border: none !important; border-top: 1px solid var(--border) !important; } }`}</style>

      {/* ===== Lapisan butiran (noise) =====
          Elemen terpisah, bukan `::before` dari root: `mix-blend-mode`
          membuat elemen itu menjadi backdrop root, yang akan memblokir
          `backdrop-filter` panel-panel di bawahnya agar tidak menjangkau
          latar mesh. */}
      <div className="nitz-latar" aria-hidden="true" />
      <div className="nitz-aurora" aria-hidden="true" />

      {/* ===== Kepala ===== */}
      <header
        className="nitz-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          padding: "var(--space-4) var(--space-6)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {ulirAktif && (
          <svg
            className="nitz-ulir"
            viewBox="0 0 1440 140"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M -20 95 C 240 40, 420 130, 720 85 S 1200 30, 1460 90"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
            <path
              d="M -20 45 C 300 90, 560 10, 860 55 S 1240 100, 1460 45"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="1"
              strokeLinecap="round"
              strokeOpacity="0.3"
            />
            <path
              d="M 1180 112 c 60 -55, 150 -50, 190 -10 c 25 25, 10 55, -15 55 c -20 0, -25 -25, -10 -38"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeOpacity="0.45"
            />
          </svg>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <Logo size={32} />
          <div>
            <div
              style={{ fontWeight: 700, fontSize: "var(--font-size-title)" }}
            >
              NitZ-909
            </div>
            <div
              style={{ fontSize: "var(--font-size-ui)", color: "var(--muted)" }}
            >
              Platform Pembuat Dokumen
            </div>
          </div>
          <Badge variant="success">Indonesia</Badge>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <Select
            label="Penyedia AI"
            value={providerId}
            options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
            onChange={(v) => {
              setProviderId(v);
              setModelId(getProvider(v).models[0].id);
            }}
          />
          <Select
            label="Model"
            value={modelId}
            options={provider.models.map((m) => ({
              value: m.id,
              label: m.label,
            }))}
            onChange={setModelId}
          />
          <Button type="quiet" size="sm" onClick={toggle}>
            {mode === "dark" ? "☾ Gelap" : "☀ Terang"}
          </Button>
          <div
            style={{
              display: "flex",
              gap: "var(--space-1)",
              alignItems: "center",
            }}
          >
            {THEME_VARIANTS.map((v) => (
              <Button
                key={v}
                type={varianWarna === v ? "primary" : "quiet"}
                size="sm"
                onClick={() => setVarianWarna(v)}
                title={META_VARIAN[v].title}
              >
                {META_VARIAN[v].label}
              </Button>
            ))}
            <Button
              type={ulirAktif ? "primary" : "outline"}
              size="sm"
              onClick={() => setUlirAktif((s) => !s)}
              title="Tampilkan / sembunyikan garis ulir di header"
            >
              {ulirAktif ? "Ulir: Aktif" : "Ulir"}
            </Button>
            <Button
              type={agenAktif ? "primary" : "outline"}
              size="sm"
              onClick={() => setAgenAktif((s) => !s)}
            >
              {agenAktif ? "Agen AI: Aktif" : "Agen AI"}
            </Button>
            <Button
              type={chatAktif ? "primary" : "outline"}
              size="sm"
              onClick={() => setChatAktif((s) => !s)}
            >
              {chatAktif ? "Chat AI: Aktif" : "Chat AI"}
            </Button>
            <Button
              type="outline"
              size="sm"
              onClick={() => setTurLangkah(1)}
              title="Tampilkan tur 3 langkah"
            >
              Tur
            </Button>
            <PerformaBadge />
          </div>
        </div>
      </header>

      {turLangkah > 0 && (
        <div
          role="dialog"
          aria-label="Tur penggunaan"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "var(--space-6)",
            transform: "translateX(-50%)",
            zIndex: 60,
            width: "min(480px, calc(100vw - 32px))",
          }}
        >
          <Card elevated>
            <strong style={{ fontSize: "var(--font-size-ui)" }}>
              Tur NitZ-909 ({turLangkah} dari 3)
            </strong>
            <p
              style={{
                margin: "var(--space-2) 0 0",
                fontSize: "var(--font-size-ui)",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              {LANGKAH_TUR[turLangkah - 1]}
            </p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                marginTop: "var(--space-3)",
              }}
            >
              {turLangkah < 3 ? (
                <Button
                  type="primary"
                  size="sm"
                  onClick={() => setTurLangkah((l) => l + 1)}
                >
                  Lanjut
                </Button>
              ) : (
                <Button type="primary" size="sm" onClick={selesaiTur}>
                  Mengerti, mulai
                </Button>
              )}
              <Button size="sm" onClick={selesaiTur}>
                Lewati
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== Dashboard stat strip ===== */}
      <div className="dashboard-strip">
        <div className="segmen-dashboard" role="group" aria-label="Mode dashboard">
          <button type="button" className={dashboardMode === "ringkas" ? "aktif" : ""} aria-pressed={dashboardMode === "ringkas"} title="Tampilan ringkas" onClick={() => setDashboardMode("ringkas")}>
            <span className="seg-emoji">📊</span> Ringkas
          </button>
          <button type="button" className={dashboardMode === "lengkap" ? "aktif" : ""} aria-pressed={dashboardMode === "lengkap"} title="Tampilan lengkap" onClick={() => setDashboardMode("lengkap")}>
            <span className="seg-emoji">📈</span> Lengkap
          </button>
        </div>

        <div className="stat-grid dashboard-grid" aria-label="Statistik dashboard">
          <div className="dash-card"><span className="dash-angka">{semuaTemplate.length}</span><span className="dash-label">Template siap pakai</span></div>
          <div className="dash-card"><span className="dash-angka">{blocks.length}</span><span className="dash-label">Blok di kanvas</span></div>
          <div className="dash-card"><span className="dash-angka">{daftarDokumen.length}</span><span className="dash-label">Dokumen tersimpan</span></div>
          <div className="dash-card"><span className="dash-angka">{daftarTemplate.length}</span><span className="dash-label">Kategori template</span></div>
        </div>

        {dashboardMode === "lengkap" && (
          <div className="format-cards">
            {(["dokumen", "presentasi", "spreadsheet", "infografis"] as const).map((k) => {
              const n = semuaTemplate.filter((t) => t.kategori === k).length;
              const total = semuaTemplate.length;
              const pct = total > 0 ? Math.round((n / total) * 100) : 0;
              return (
                <div className="fmt-kotak" key={k}>
                  <div className="fmt-ringkasan">
                    <span className="fmt-angka">{n}</span>
                    <span className="fmt-label">{k}</span>
                  </div>
                  <div className="fmt-bar">
                    <div className="fmt-fill" style={{ width: pct + "%" }} />
                  </div>
                    <span className="fmt-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div
        className="nitz-body"
        style={{ display: "flex", flex: 1, alignItems: "stretch" }}
      >
        {/* ===== Galeri template ===== */}
        <aside
          className="nitz-side"
          style={{
            width: "300px",
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <SectionHeader
            ikon={<Ikon nama="galeri" ukuran={15} />}
            judul="Galeri Template"
            deskripsi="Klik kartu untuk memuat ke kanvas."
            aksi={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <StatChip angka={semuaTemplate.length} label="template" />
                <div
                  className="segmen-tampilan"
                  role="group"
                  aria-label="Mode tampilan galeri"
                >
                  <button
                    type="button"
                    className={tampilanGaleri === "grid" ? "aktif" : ""}
                    aria-pressed={tampilanGaleri === "grid"}
                    title="Tampilan grid"
                    onClick={() => setTampilanGaleri("grid")}
                  >
                    ▦
                  </button>
                  <button
                    type="button"
                    className={tampilanGaleri === "daftar" ? "aktif" : ""}
                    aria-pressed={tampilanGaleri === "daftar"}
                    title="Tampilan daftar"
                    onClick={() => setTampilanGaleri("daftar")}
                  >
                    ☰
                  </button>
                </div>
              </div>
            }
          />
          <div
            className="stat-grid"
            aria-label="Jumlah template per format"
          >
            {(["docx", "pptx", "xlsx", "diagram"] as const).map((f) => (
              <div key={f} className="stat-kotak" title={`${f.toUpperCase()}`}>
                <span className="stat-angka">
                  {semuaTemplate.filter((t) => t.format === f).length}
                </span>
                <span className="stat-label">{f}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
          >
            <Button
              type="outline"
              size="sm"
              block
              onClick={() => fileImporRef.current?.click()}
            >
              <Ikon nama="impor" /> Impor Template (.json)
            </Button>
            <input
              ref={fileImporRef}
              type="file"
              accept=".json,application/json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void imporBerkas(f);
              }}
            />
            {imporPesan && (
              <Alert variant={imporPesan.variant}>{imporPesan.teks}</Alert>
            )}
          </div>
          <div
            style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
          >
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
                alignItems: "center",
              }}
              aria-label="Persona pengguna"
            >
              <Button
                type={personaAktif === "semua" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPersonaAktif("semua")}
              >
                Semua
              </Button>
              {PERSONAS.map((p) => (
                <Button
                  key={p.id}
                  type={personaAktif === p.id ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => pakaiPersona(p.id)}
                  title={`${p.nama}: ${p.templateIds.length} template + pola judul + contoh isian`}
                >
                  {<Ikon nama={PETA_PERSONA[p.id] ?? "umum"} />} {p.nama}
                </Button>
              ))}
            </div>
            {FILTER_KATEGORI.map((k) => (
              <Button
                key={k}
                type={kategori === k ? "primary" : "secondary"}
                size="sm"
                onClick={() => setKategori(k)}
              >
                {k === "semua" ? "Semua" : LABEL_KATEGORI[k]}
              </Button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <input
              type="search"
              value={cariTemplate}
              onChange={(e) => setCariTemplate(e.target.value)}
              placeholder="Cari template…"
              aria-label="Cari template"
              style={{
                flex: "1 1 140px",
                minWidth: 0,
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: "var(--font-size-ui)",
              }}
            />
            <select
              value={formatFilter}
              onChange={(e) =>
                setFormatFilter(e.target.value as typeof formatFilter)
              }
              aria-label="Filter format"
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
                fontSize: "var(--font-size-ui)",
              }}
            >
              {FILTER_FORMAT.map((f) => (
                <option key={f} value={f}>
                  {f === "semua" ? "Semua format" : LABEL_FORMAT[f]}
                </option>
              ))}
            </select>
            <Button
              type={modeLanjutan ? "primary" : "secondary"}
              size="sm"
              onClick={() => setModeLanjutan((v) => !v)}
              aria-pressed={modeLanjutan}
              title="Tampilkan badge PRD internal di kartu template"
            >
              Lanjutan: {modeLanjutan ? "Nyala" : "Mati"}
            </Button>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: "var(--font-size-caption)",
              color: "var(--faint)",
            }}
          >
            {daftarTemplate.length} template
            {cariTemplate.trim() ? ` cocok “${cariTemplate.trim()}”` : ""}
          </p>
          <div className={`galeri-${tampilanGaleri}`}>
            {grupTemplate.map((g) => {
              const terbuka = grupTerbuka[g.kat];
              return (
                <div
                  key={g.kat}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  <button
                    onClick={() =>
                      setGrupTerbuka((s) => ({ ...s, [g.kat]: !s[g.kat] }))
                    }
                    aria-expanded={terbuka}
                    aria-label={`Toggle grup ${LABEL_KATEGORI[g.kat]}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-2)",
                      cursor: "pointer",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-3) var(--space-4)",
                      color: "var(--text)",
                      fontSize: "var(--font-size-ui)",
                      textAlign: "left",
                    }}
                  >
                    <span aria-hidden="true">{terbuka ? "▾" : "▸"}</span>
                    <span
                      aria-hidden="true"
                      style={{
                        width: "9px",
                        height: "11px",
                        borderRadius: "50%",
                        background: WARNA_KATEGORI[g.kat],
                        flexShrink: 0,
                      }}
                    />
                    <strong>{LABEL_KATEGORI[g.kat]}</strong>
                    <span style={{ color: "var(--muted)" }}>
                      ({g.daftar.length})
                    </span>
                  </button>
                  {terbuka &&
                    g.daftar.map((t) => {
                      const aktif = templateAktif === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => pakaiTemplate(t)}
                          className={
                            aktif ? "kartu-template terpakai" : "kartu-template"
                          }
                          style={{
                            textAlign: "left",
                            cursor: "pointer",
                            // Tanpa shorthand border supaya tidak bertabrakan
                            // dengan borderLeft (warning React "Updating
                            // border borderLeft" saat kartu diaktifkan).
                            borderTop: "1px solid var(--border)",
                            borderRight: "1px solid var(--border)",
                            borderBottom: "1px solid var(--border)",
                            borderLeft: `4px solid ${WARNA_KATEGORI[t.kategori]}`,
                            borderRadius: "var(--radius-lg)",
                            padding: 0,
                            overflow: "hidden",
                            color: "var(--text)",
                            display: "flex",
                            flexDirection: "column",
                          }}
                        >
                          <div
                            aria-hidden="true"
                            className="area-preview"
                            style={{
                              background: `color-mix(in srgb, ${WARNA_KATEGORI[t.kategori]} 20%, var(--surface))`,
                              padding: "var(--space-3) var(--space-4)",
                              minHeight: "78px",
                              display: "flex",
                              alignItems: "center",
                              position: "relative",
                              overflow: "hidden",
                              borderBottom: "1px solid var(--border)",
                            }}
                          >
                            <MiniTemplatePreview
                              template={t}
                              lebar={tampilanGaleri === "grid" ? 124 : undefined}
                            />
                          </div>
                          <div
                            style={{
                              padding: "var(--space-4)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "var(--space-2)",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "var(--space-2)",
                              }}
                            >
                              <span style={{ fontSize: "20px" }}>
                                <IkonFormat format={t.format} ukuran={22} />
                              </span>
                              <strong
                                style={{ fontSize: "var(--font-size-ui)" }}
                              >
                                {t.nama}
                              </strong>
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "var(--space-2)",
                                flexWrap: "wrap",
                              }}
                            >
                              <Badge variant="secondary">
                                {LABEL_KATEGORI[t.kategori]} →{" "}
                                {t.format.toUpperCase()}
                              </Badge>
                              {modeLanjutan && t.bagianPRD && (
                                <Badge variant="primary">
                                  PRD {t.bagianPRD}
                                </Badge>
                              )}
                              {t.versi && (
                                <Badge variant="secondary">v{t.versi}</Badge>
                              )}
                              {!ID_BAWAAN.has(t.id) && (
                                <Badge variant="success">Impor</Badge>
                              )}
                            </div>
                            <span
                              className="deskripsi-kartu"
                              style={{
                                fontSize: "var(--font-size-ui)",
                                color: "var(--muted)",
                                lineHeight: 1.5,
                              }}
                            >
                              {t.deskripsi}
                            </span>
                            {aktif && (
                              <Badge variant="success">✓ Sedang dipakai</Badge>
                            )}
                          </div>
                        </button>
                      );
                    })}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ===== Preview Template (WYSIWYG) ===== */}
        <TemplatePreview
          template={
            semuaTemplate.find((x) => x.id === templateAktif) ??
            getTemplate(templateAktif)
          }
        />

        {/* ===== Kanvas ===== */}
        <main
          className="nitz-isi"
          style={{ flex: 1, minWidth: 0, padding: "var(--space-6)" }}
        >
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            <div
              role="note"
              style={{
                fontSize: "var(--font-size-ui)",
                color: "var(--muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "var(--space-3) var(--space-4)",
                lineHeight: 1.6,
              }}
            >
              Klik teks di kanvas untuk mengedit langsung — tanpa kunci AI pun
              bisa lanjut ke Ekspor.
              {drafDipulihkan ? " Draf terakhir dipulihkan otomatis." : ""}
            </div>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                flexWrap: "wrap",
              }}
            >
              <Button type="secondary" size="sm" onClick={isiContoh}>
                Isi contoh
              </Button>
              {persona && (
                <Button
                  type="outline"
                  size="sm"
                  onClick={() => setJudul(persona.polaJudul)}
                >
                  Pakai pola judul {persona.nama}
                </Button>
              )}
            </div>
            <div>
              <label
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                }}
              >
                Judul dokumen
              </label>
              <Input
                value={judul}
                onChange={setJudul}
                placeholder="Tulis judul dokumen..."
              />
            </div>

            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                Dokumen Sumber
              </strong>
              <p
                style={{
                  fontSize: "var(--font-size-small)",
                  color: "var(--muted)",
                  margin: "var(--space-2) 0 0",
                }}
              >
                Pilih contoh laporan di galeri, lalu taruh dokumen yang mau
                dibuatkan laporan di sini — AI memakai konteksnya, namanya
                tercantum di hasil ekspor.
              </p>
              <div
                role="button"
                tabIndex={0}
                aria-label="Pilih dokumen sumber"
                onClick={() => refPilihSumber.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") refPilihSumber.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSeretAktif(true);
                }}
                onDragLeave={() => setSeretAktif(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSeretAktif(false);
                  tambahBerkasSumber(e.dataTransfer.files);
                }}
                style={{
                  border: "1px dashed var(--control-border)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  marginTop: "var(--space-3)",
                  textAlign: "center",
                  cursor: "pointer",
                  background: seretAktif
                    ? "var(--control-bg-hover)"
                    : "transparent",
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                }}
              >
                {dokumenSumber.length === 0
                  ? "Taruh berkas di sini / klik untuk memilih (PDF, DOCX, XLSX, gambar, teks — maks 10 MB per berkas)"
                  : `${dokumenSumber.length} berkas terpasang — klik / taruh lagi untuk menambah`}
              </div>
              <input
                ref={refPilihSumber}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files) tambahBerkasSumber(e.target.files);
                  e.target.value = "";
                }}
              />
              {dokumenSumber.map((f, i) => (
                <div
                  key={`${f.name}-${f.size}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-2)",
                    fontSize: "var(--font-size-ui)",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.name} ({formatUkuran(f.size)})
                  </span>
                  <Button
                    type="outline"
                    size="sm"
                    onClick={() => hapusSumber(i)}
                    aria-label={`Hapus ${f.name}`}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {pesanSumber && (
                <p
                  style={{
                    fontSize: "var(--font-size-small)",
                    color: "var(--warn)",
                    margin: "var(--space-2) 0 0",
                  }}
                >
                  {pesanSumber}
                </p>
              )}
              <p
                style={{
                  fontSize: "var(--font-size-small)",
                  color: "var(--faint)",
                  margin: "var(--space-2) 0 0",
                }}
              >
                Berkas hanya dipakai sesi ini (tidak tersimpan). Laporan jadi
                diunduh ke folder Download browser.
              </p>
            </Card>

            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                <Ikon nama="cari" /> Fakta & Bukti
              </strong>
              <div
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                  marginTop: "var(--space-2)",
                  lineHeight: 1.6,
                }}
              >
                Tempel fakta + isi artikel — lalu susun 6 seksi laporan
                intelijen ke kanvas. Tautan otomatis hanya bila situsnya
                mengizinkan diambil.
              </div>
              <div style={{ marginTop: "var(--space-3)" }}>
                <label
                  style={{
                    fontSize: "var(--font-size-small)",
                    color: "var(--muted)",
                  }}
                >
                  Fakta mentah (satu fakta per baris)
                </label>
                <textarea
                  value={faktaMentah}
                  onChange={(e) => setFaktaMentah(e.target.value)}
                  placeholder={
                    "cth:\nApel kesiapan 06.00 di lapangan utama.\n2 unit terlambat 20 menit karena apel gabungan.\nLogistik tenda kurang 4 unit."
                  }
                  rows={4}
                  style={{
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text)",
                    font: "inherit",
                    fontSize: "var(--font-size-ui)",
                    resize: "vertical",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-2)",
                }}
              >
                <Input
                  value={tautanBaru}
                  onChange={setTautanBaru}
                  placeholder="Tempel tautan berita https://…"
                />
                <Button type="secondary" size="sm" onClick={tambahTautan}>
                  Tambah
                </Button>
              </div>
              <div style={{ marginTop: "var(--space-2)" }}>
                <label
                  style={{
                    fontSize: "var(--font-size-small)",
                    color: "var(--muted)",
                  }}
                >
                  Isi artikel (cara paling pasti — salin dari situs berita)
                </label>
                <textarea
                  value={isiArtikel}
                  onChange={(e) => setIsiArtikel(e.target.value)}
                  placeholder="Salin seluruh isi berita lalu tempel di sini…"
                  rows={4}
                  style={{
                    width: "100%",
                    marginTop: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--text)",
                    font: "inherit",
                    fontSize: "var(--font-size-ui)",
                    resize: "vertical",
                  }}
                />
                <div style={{ marginTop: "var(--space-2)" }}>
                  <Button type="secondary" size="sm" onClick={jadikanBukti}>
                    <Ikon nama="dokumen" /> Jadikan Bukti
                  </Button>
                </div>
              </div>
              {daftarTautan.map((u) => (
                <div
                  key={u}
                  style={{
                    display: "flex",
                    gap: "var(--space-2)",
                    alignItems: "center",
                    marginTop: "var(--space-2)",
                    fontSize: "var(--font-size-small)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      color: "var(--muted)",
                    }}
                    title={u}
                  >
                    {u}
                  </span>
                  <Button
                    type="quiet"
                    size="sm"
                    onClick={() => {
                      setDaftarTautan((d) => d.filter((x) => x !== u));
                      setHasilBukti((h) => h.filter((x) => x.url !== u));
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              {hasilBukti.map((h) => (
                <div
                  key={h.url}
                  style={{
                    marginTop: "var(--space-2)",
                    fontSize: "var(--font-size-small)",
                    lineHeight: 1.5,
                  }}
                >
                  <Badge variant={h.status === "ok" ? "success" : "error"}>
                    {h.status === "ok" ? "✓ Bukti" : "✕ Gagal"}
                  </Badge>{" "}
                  <span style={{ color: "var(--text)" }}>{h.judul}</span>
                  <div style={{ color: "var(--faint)" }}>
                    {h.penerbit}
                    {h.status === "ok"
                      ? ` · ${h.teks.length} karakter`
                      : ` · ${h.pesan ?? ""}`}
                  </div>
                </div>
              ))}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                }}
              >
                <Button
                  type="secondary"
                  size="sm"
                  loading={statusBukti.state === "loading"}
                  onClick={ambilIsiTautan}
                >
                  <Ikon nama="unduh" /> Ambil Isi Tautan
                </Button>
                <Button
                  type="primary"
                  size="sm"
                  loading={statusBukti.state === "loading"}
                  onClick={susunLaporanIntelijen}
                >
                  <Ikon nama="ai" /> Susun Laporan Intelijen
                </Button>
              </div>
              {statusBukti.state !== "idle" && (
                <div style={{ marginTop: "var(--space-2)" }}>
                  <Alert
                    variant={
                      statusBukti.state === "gagal" ? "error" : "success"
                    }
                  >
                    {statusBukti.pesan}
                  </Alert>
                </div>
              )}
            </Card>

            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                ＋ Tambah Satu Elemen
              </strong>
              <div
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                  marginTop: "var(--space-2)",
                  lineHeight: 1.6,
                }}
              >
                Satuan kecil: judul, paragraf, daftar, tabel, gambar…
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                }}
              >
                {tombolTambah.map((b) => (
                  <Button
                    key={b.label}
                    type="secondary"
                    size="sm"
                    onClick={b.aksi}
                  >
                    {b.ikon.length === 1 ? (
                      b.ikon
                    ) : (
                      <Ikon nama={b.ikon as NamaIkon} />
                    )}{" "}
                    {b.label}
                  </Button>
                ))}
              </div>
              <Divider />
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  type="outline"
                  size="sm"
                  onClick={() => ubah(() => editor.setBlocks([]))}
                >
                  <Ikon nama="hapus" /> Dokumen Baru
                </Button>
                <Button
                  type="outline"
                  size="sm"
                  onClick={() => ubah(() => editor.undo())}
                >
                  ↶ Urungkan
                </Button>
                <Button
                  type="outline"
                  size="sm"
                  onClick={() => ubah(() => editor.redo())}
                >
                  ↷ Ulangi
                </Button>
                <Button
                  type="outline"
                  size="sm"
                  onClick={() =>
                    ubah(() => {
                      const semua = editor.getBlocks();
                      const terakhir = semua[semua.length - 1];
                      if (terakhir) editor.removeBlock(terakhir.id);
                    })
                  }
                >
                  ✕ Hapus Blok Terakhir
                </Button>
              </div>
            </Card>

            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                <Ikon nama="paket" /> Tambah Paket Jadi — rangkaian bagian
                sekaligus
              </strong>
              <div
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                  marginTop: "var(--space-2)",
                  lineHeight: 1.6,
                }}
              >
                Klik bagian untuk menyisipkannya ke kanvas. Susun urutan
                sesukamu, lalu pilih output di panel Ekspor.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  flexWrap: "wrap",
                  marginTop: "var(--space-3)",
                }}
              >
                {BAGIAN_STANDAR.map((s) => (
                  <Button
                    key={s.id}
                    type="outline"
                    size="sm"
                    onClick={() => tambahBagian(s.id)}
                  >
                    ＋ {s.nama}
                  </Button>
                ))}
              </div>
            </Card>

            <Card elevated>
              {blocks.length === 0 ? (
                <EmptyState
                  icon={<Ikon nama="catatan" ukuran={40} />}
                  title="Dokumen masih kosong"
                  description="Satu klik langsung jadi: template terisi contoh dan siap diekspor. Atau pilih template dari galeri kiri."
                  action={
                    <Button type="primary" size="sm" onClick={muatContohJadi}>
                      <Ikon nama="dokumen" /> Muat contoh jadi
                    </Button>
                  }
                />
              ) : (
                <EditorCanvas version={version} />
              )}
            </Card>
          </div>
        </main>

        {/* ===== Panel ekspor & panduan ===== */}
        <aside
          className="nitz-side"
          style={{
            width: "300px",
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="unduh" /> Ekspor
          </h3>
          <div
            style={{ fontSize: "var(--font-size-ui)", color: "var(--muted)" }}
          >
            Model AI: <strong>{getModelLabel(providerId, modelId)}</strong>{" "}
            (untuk pembuatan konten)
          </div>

          {/* ===== DeckCraft Studio: mesin presentasi mutakhir ===== */}
          <Card className="dc-kartu">
            <DeckCraftStudio
              blocks={blocks}
              judul={judul}
              onPesan={(p) =>
                setStatusEkspor((s) => ({
                  ...s,
                  pptx: { state: "sukses", pesan: p },
                }))
              }
            />
          </Card>

          {/* ===== Auto-Generate: dari satu prompt ke dokumen lengkap ===== */}
          <Card className="ag-kartu">
            <AutoGenerate
              providerId={providerId as ProviderAI}
              providerLabel={provider.label}
              modelId={modelId}
              apiKey={kunciInput}
              baseUrl={endpointInput.trim() || undefined}
              judul={judul}
              mode={modeAutoGenerate}
              onMode={setModeAutoGenerate}
              // Bahan dari berkas/tautan terlampir — dibaca saat tombol ditekan.
              ambilBahan={konteksSumber}
              onBagian={(blokBagian, info) => {
                // Bagian PERTAMA YANG BERHASIL (bukan selalu indeks 0) yang
                // mengganti kanvas: kalau bagian 0 gagal, bagian 1 tidak boleh
                // menempel di atas dokumen lama.
                const pertama = !snapshotAutoRef.current;
                if (pertama) {
                  catatRiwayatAuto();
                  snapshotAutoRef.current = true;
                }
                if (pertama && modeAutoGenerate === "ganti") {
                  ubah(() => editor.setBlocks(blokBagian));
                } else {
                  ubah(() =>
                    editor.setBlocks([...editor.getBlocks(), ...blokBagian]),
                  );
                }
                setStatusDraf({
                  state: "loading",
                  pesan: `Bagian ${info.indeks + 1}/${info.total} masuk kanvas: ${info.judul}`,
                });
              }}
              onHasil={(hasil, opsiHasil) => {
                if (opsiHasil?.sudahDiKanvas) {
                  // Mode bertahap: blok sudah ditempatkan per bagian.
                  setJudul(hasil.judul);
                } else {
                  // Sekali jalan: snapshot diambil di sini.
                  if (!snapshotAutoRef.current) catatRiwayatAuto();
                  if (modeAutoGenerate === "tambah") {
                    // Tambahkan di akhir isi yang ada; judul tidak diubah.
                    ubah(() =>
                      editor.setBlocks([
                        ...editor.getBlocks(),
                        ...hasil.blocks,
                      ]),
                    );
                  } else {
                    ubah(() => editor.setBlocks(hasil.blocks));
                    setJudul(hasil.judul);
                  }
                }
                snapshotAutoRef.current = false;
                setStatusDraf({
                  state: "sukses",
                  pesan:
                    `Auto-generate: ${hasil.statistik.totalBlok} blok ` +
                    `${modeAutoGenerate === "tambah" ? "ditambahkan" : "dibuat"} dari prompt · ` +
                    `mutu bahasa ${hasil.kualitas.skor}/100.`,
                });
              }}
              bisaUndoAuto={indeksAuto >= 0}
              bisaRedoAuto={indeksAuto < riwayatAuto.length - 1}
              onUndoAuto={() => {
                const i = indeksAutoRef.current;
                if (i < 0) return;
                const s = riwayatAutoRef.current[i];
                ubah(() => editor.setBlocks(klonBlocks(s.blocks)));
                setJudul(s.judul);
                indeksAutoRef.current = i - 1;
                setIndeksAuto(i - 1);
                setStatusDraf({
                  state: "sukses",
                  pesan: "Auto-generate dibatalkan — dokumen dikembalikan.",
                });
              }}
              onRedoAuto={() => {
                const i = indeksAutoRef.current;
                if (i >= riwayatAutoRef.current.length - 1) return;
                const s = riwayatAutoRef.current[i + 1];
                ubah(() => editor.setBlocks(klonBlocks(s.blocks)));
                setJudul(s.judul);
                indeksAutoRef.current = i + 1;
                setIndeksAuto(i + 1);
                setStatusDraf({
                  state: "sukses",
                  pesan: "Auto-generate dipulihkan.",
                });
              }}
            />
          </Card>

          <Card>
            <strong style={{ fontSize: "var(--font-size-ui)" }}>
              <Ikon nama="kunci" /> Kunci AI
            </strong>
            <div
              style={{
                fontSize: "var(--font-size-ui)",
                color: "var(--muted)",
                marginTop: "var(--space-2)",
                lineHeight: 1.6,
              }}
            >
              Kunci tersimpan lokal di browser ini dan hanya dikirim ke provider
              yang dipilih.
            </div>
            {(provider.gratis || provider.urlKunci) && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-2)",
                }}
              >
                {provider.gratis && (
                  <Badge variant="success" size="sm">
                    GRATIS
                  </Badge>
                )}
                {provider.urlKunci && (
                  <a
                    href={provider.urlKunci}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: "var(--font-size-ui)",
                      color: "var(--brand)",
                    }}
                  >
                    Ambil API key →
                  </a>
                )}
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                marginTop: "var(--space-3)",
              }}
            >
              <label
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                }}
              >
                {provider.labelKunci ?? `Kunci ${provider.label}`}
              </label>
              <Input
                type="password"
                value={kunciInput}
                onChange={setKunciInput}
                placeholder={`Tempel ${provider.labelKunci ?? `kunci ${provider.label}`}…`}
              />
              <Input
                value={endpointInput}
                onChange={setEndpointInput}
                placeholder="Host khusus (opsional, cth: http://localhost:5999)"
              />
              <Button type="secondary" block onClick={simpanKunci}>
                <Ikon nama="simpan" /> Simpan
              </Button>
              {pesanSimpan && (
                <div
                  style={{
                    fontSize: "var(--font-size-ui)",
                    color: "var(--muted)",
                  }}
                >
                  {pesanSimpan}
                </div>
              )}
              <Button
                type="primary"
                block
                loading={statusDraf.state === "loading"}
                onClick={() => void isiDrafAI()}
              >
                <Ikon nama="ai" /> Draf AI: isi placeholder
              </Button>
              {statusDraf.state === "sukses" && (
                <Alert variant="success">{statusDraf.pesan}</Alert>
              )}
              {statusDraf.state === "gagal" && (
                <Alert variant="error">{statusDraf.pesan}</Alert>
              )}
              {statusDraf.state === "loading" && (
                <Alert variant="info">{statusDraf.pesan}</Alert>
              )}
            </div>
          </Card>
          <Card>
            <FormMode
              metadata={metadata}
              ubahMetadata={ubahMetadata}
              onTerapkan={() => terapkanMetadata()}
            />
            {statusImpor && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <Alert variant={statusImpor.variant}>{statusImpor.teks}</Alert>
              </div>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                marginTop: "var(--space-3)",
              }}
            >
              <Button
                type="primary"
                block
                loading={statusDraf.state === "loading"}
                onClick={() => void drafSeluruhDokumen()}
              >
                <Ikon nama="ai" /> Draft AI (seluruh dokumen)
              </Button>
              <Button
                type="secondary"
                block
                onClick={() => fileDataRef.current?.click()}
              >
                <Ikon nama="impor" /> Impor Data (CSV/JSON)
              </Button>
              <input
                ref={fileDataRef}
                type="file"
                accept=".csv,.json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void imporDataBerkas(file);
                }}
              />
            </div>
          </Card>

          {/* ===== Mutu bahasa: skor + perbaikan cepat ===== */}
          <Card>
            <SectionHeader
              judul="Mutu bahasa"
              deskripsi="Diperiksa otomatis: ejaan baku, panjang kalimat, dan kejelasan butir."
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <strong style={{ fontSize: 30, lineHeight: 1 }}>
                {mutuBahasa.skor}
              </strong>
              <div
                style={{
                  fontSize: "var(--font-size-caption)",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                <div style={{ color: "var(--text)" }}>
                  {labelMutu(mutuBahasa.skor)}
                </div>
                <div>
                  {mutuBahasa.temuan.length} temuan ·{" "}
                  {mutuBahasa.jumlahKata} kata
                </div>
              </div>
            </div>
            {mutuBahasa.temuan.slice(0, 3).map((t, i) => (
              <div
                key={`${t.kode}-${i}`}
                style={{
                  marginTop: "var(--space-2)",
                  fontSize: "var(--font-size-caption)",
                  color: "var(--muted)",
                  lineHeight: 1.5,
                }}
              >
                • {t.pesan}
                {t.cuplikan ? (
                  <em style={{ opacity: 0.75 }}> — “{t.cuplikan}”</em>
                ) : null}
              </div>
            ))}
            {bisaRapikan && (
              <div style={{ marginTop: "var(--space-3)" }}>
                <Button
                  type="secondary"
                  block
                  size="sm"
                  onClick={() => {
                    ubah(() =>
                      editor.setBlocks(rapikanEjaanBlok(editor.getBlocks())),
                    );
                    setStatusDraf({
                      state: "sukses",
                      pesan:
                        "Ejaan dirapikan: kata tidak baku, spasi, dan format angka diperbaiki.",
                    });
                  }}
                >
                  Rapikan ejaan otomatis
                </Button>
              </div>
            )}
          </Card>

          {/* ===== Tema presentasi: mengatur desain deck hasil ekspor PPTX ===== */}
          <Card>
            <SectionHeader
              judul="Tema presentasi"
              deskripsi="Palet, tipografi, latar, dan tata letak slide untuk ekspor PPTX."
            />
            <Select
              label="Desain deck"
              value={temaPpt}
              options={TEMA_PPT.map((t) => ({
                value: t.id,
                label: `${t.nama} · ${t.mode === "gelap" ? "gelap" : "terang"}`,
              }))}
              onChange={(v) => {
                setTemaPpt(v);
                localStorage.setItem("nitz909-tema-ppt", v);
              }}
            />
            {(() => {
              const tema = TEMA_PPT.find((t) => t.id === temaPpt) ?? TEMA_PPT[0];
              return (
                <>
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      marginTop: "var(--space-2)",
                    }}
                    aria-hidden="true"
                  >
                    {[
                      tema.warna.latar,
                      tema.warna.latarAlt,
                      tema.warna.primer,
                      tema.warna.aksen,
                      tema.warna.teksLembut,
                    ].map((warna) => (
                      <span
                        key={warna}
                        title={`#${warna}`}
                        style={{
                          flex: 1,
                          height: 18,
                          borderRadius: "var(--radius-sm)",
                          background: `#${warna}`,
                          border: "1px solid var(--border)",
                        }}
                      />
                    ))}
                  </div>
                  <p
                    style={{
                      margin: "var(--space-2) 0 0",
                      fontSize: "var(--font-size-caption)",
                      color: "var(--muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    {tema.deskripsi}
                  </p>
                </>
              );
            })()}
          </Card>

          {FORMAT_INFO.map((f) => {
            const st = statusEkspor[f.format];
            return (
              <div
                key={f.format}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                }}
              >
                <Button
                  type="secondary"
                  block
                  loading={st.state === "loading"}
                  onClick={() => handleEkspor(f.format, f.ekstensi)}
                >
                  {<Ikon nama={f.ikon as NamaIkon} />} {f.label}
                </Button>
                {st.state === "sukses" && (
                  <Alert variant="success">{st.pesan}</Alert>
                )}
                {st.state === "gagal" && (
                  <Alert variant="error">{st.pesan}</Alert>
                )}
                {st.state === "loading" && (
                  <Alert variant="info">{st.pesan}</Alert>
                )}
              </div>
            );
          })}

          <Button
            type="primary"
            block
            onClick={() => void eksporSemua()}
            title="Unduh Word + PPTX + Excel + Diagram sekaligus (PDF butuh dialog cetak)"
          >
            Ekspor Semua (tanpa PDF)
          </Button>
          <Button
            type="secondary"
            block
            loading={statusInfografis.state === "loading"}
            onClick={() => void handleEksporInfografis()}
          >
            <Ikon nama="gambar" /> Ekspor Infografis PNG
          </Button>
          {statusInfografis.state === "sukses" && (
            <Alert variant="success">{statusInfografis.pesan}</Alert>
          )}
          {statusInfografis.state === "gagal" && (
            <Alert variant="error">{statusInfografis.pesan}</Alert>
          )}
          {statusInfografis.state === "loading" && (
            <Alert variant="info">{statusInfografis.pesan}</Alert>
          )}

          {agenAktif && (
            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                Agen AI — Perbaikan Laporan
              </strong>
              <div
                style={{
                  fontSize: "var(--font-size-ui)",
                  color: "var(--muted)",
                  marginTop: "var(--space-2)",
                  lineHeight: 1.6,
                }}
              >
                Tandai blok, tulis maunya perbaikan seperti apa, minta saran AI,
                lalu Terapkan. Tetap bisa edit manual di kanvas — alur akhir
                Simpan lalu Ekspor.
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-3)",
                }}
              >
                <select
                  value={targetBlokId}
                  onChange={(e) => setTargetBlokId(e.target.value)}
                  aria-label="Blok target perbaikan"
                  style={{
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "var(--font-size-ui)",
                  }}
                >
                  <option value="">— Pilih blok target —</option>
                  {blocks
                    .filter(
                      (b) => b.type === "heading" || b.type === "paragraph",
                    )
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {(b.type === "heading" ? "Judul: " : "Paragraf: ") +
                          teksIsiBlok(b).slice(0, 45)}
                      </option>
                    ))}
                </select>
                <Select
                  label="Jenis masukan"
                  value={jenisMasukan}
                  options={[
                    { value: "perbaikan", label: "Perbaikan tulisan" },
                    { value: "analisis", label: "Analisis" },
                    { value: "prediksi", label: "Prediksi" },
                    { value: "bukti", label: "Penguatan bukti" },
                  ]}
                  onChange={(v) => setJenisMasukan(v as typeof jenisMasukan)}
                />
                <textarea
                  value={masukanAgen}
                  onChange={(e) => setMasukanAgen(e.target.value)}
                  placeholder="Contoh: kuatkan bukti dengan 2 data pendukung, bahasa lebih formal"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "var(--space-2) var(--space-3)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "var(--font-size-ui)",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />
                <Button
                  type="primary"
                  block
                  loading={statusAgen.state === "loading"}
                  onClick={() => void mintaSaranAgen()}
                >
                  Minta saran AI
                </Button>
                {statusAgen.state === "sukses" && (
                  <Alert variant="success">{statusAgen.pesan}</Alert>
                )}
                {statusAgen.state === "gagal" && (
                  <Alert variant="error">{statusAgen.pesan}</Alert>
                )}
                {statusAgen.state === "loading" && (
                  <Alert variant="info">{statusAgen.pesan}</Alert>
                )}
              </div>
              {antreanPerbaikan.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                    marginTop: "var(--space-3)",
                  }}
                >
                  <strong style={{ fontSize: "var(--font-size-ui)" }}>
                    Antrean saran ({antreanPerbaikan.length})
                  </strong>
                  {antreanPerbaikan.map((item, i) => (
                    <div
                      key={`${item.blokId}-${i}`}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-3)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-2)",
                      }}
                    >
                      <Badge variant="primary">{item.jenis}</Badge>
                      <span
                        style={{
                          fontSize: "var(--font-size-ui)",
                          lineHeight: 1.6,
                        }}
                      >
                        {item.teks}
                      </span>
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <Button
                          type="primary"
                          size="sm"
                          onClick={() => terapkanSaran(i)}
                        >
                          Terapkan ke blok
                        </Button>
                        <Button
                          type="quiet"
                          size="sm"
                          onClick={() =>
                            setAntreanPerbaikan((prev) =>
                              prev.filter((_, j) => j !== i),
                            )
                          }
                        >
                          Buang
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {chatAktif && (
            <Card>
              <strong style={{ fontSize: "var(--font-size-ui)" }}>
                Chat AI — Eksekusi Blok Bertanda
              </strong>
              <p
                style={{
                  fontSize: "var(--font-size-small)",
                  color: "var(--muted)",
                  margin: "var(--space-2) 0 0",
                }}
              >
                1. Tandai blok di bawah · 2. Tulis perintah · 3. Kirim — hanya
                blok bertanda yang diubah AI. Tinjau/ketik manual tetap bisa
                langsung di kanvas.
              </p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-1)",
                  marginTop: "var(--space-3)",
                  maxHeight: "220px",
                  overflowY: "auto",
                }}
              >
                {blocks
                  .filter((b) => b.type === "heading" || b.type === "paragraph")
                  .map((b) => (
                    <label
                      key={b.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        fontSize: "var(--font-size-ui)",
                        cursor: "pointer",
                        border: blokDitandai.includes(b.id)
                          ? "1px solid var(--primary-action)"
                          : "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "var(--space-2) var(--space-3)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={blokDitandai.includes(b.id)}
                        onChange={() => toggleTanda(b.id)}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {b.type === "heading" ? "H · " : "P · "}
                        {labelBlok(b)}
                      </span>
                    </label>
                  ))}
                {blocks.filter(
                  (b) => b.type === "heading" || b.type === "paragraph",
                ).length === 0 && (
                  <span
                    style={{
                      fontSize: "var(--font-size-ui)",
                      color: "var(--muted)",
                    }}
                  >
                    Kanvas belum ada blok Judul / Paragraf.
                  </span>
                )}
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-3)",
                  fontSize: "var(--font-size-ui)",
                }}
              >
                <input
                  type="checkbox"
                  checked={cariWebAktif}
                  disabled={providerId !== "google"}
                  onChange={(e) => setCariWebAktif(e.target.checked)}
                />
                Cari referensi web dulu (khusus provider Google)
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-3)",
                }}
              >
                {pesanChat.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.dari === "user" ? "flex-end" : "flex-start",
                      background:
                        m.dari === "user"
                          ? "var(--primary-action)"
                          : "var(--bubble)",
                      color:
                        m.dari === "user"
                          ? "var(--primary-action-text)"
                          : "var(--text)",
                      borderRadius: "var(--radius-lg)",
                      padding: "var(--space-2) var(--space-3)",
                      maxWidth: "90%",
                      fontSize: "var(--font-size-ui)",
                      lineHeight: 1.6,
                    }}
                  >
                    {m.teks}
                    {m.sumber && m.sumber.length > 0 && (
                      <div style={{ marginTop: "var(--space-1)" }}>
                        {m.sumber.map((s) => (
                          <div key={s.uri}>
                            <a
                              href={s.uri}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                fontSize: "var(--font-size-small)",
                                color: "inherit",
                              }}
                            >
                              {s.judul}
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {statusChat.state === "sukses" && (
                <Alert variant="success">{statusChat.pesan}</Alert>
              )}
              {statusChat.state === "gagal" && (
                <Alert variant="error">{statusChat.pesan}</Alert>
              )}
              {statusChat.state === "loading" && (
                <Alert variant="info">{statusChat.pesan}</Alert>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-2)",
                  marginTop: "var(--space-3)",
                }}
              >
                <Input
                  value={inputChat}
                  onChange={setInputChat}
                  placeholder="cth: ganti dengan bahasa lebih spesifik terkait tujuan…"
                />
                <Button
                  type="primary"
                  size="sm"
                  onClick={kirimChat}
                  loading={statusChat.state === "loading"}
                >
                  Kirim
                </Button>
              </div>
            </Card>
          )}

          <Divider />
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="statistik" /> Statistik
          </h3>
          <div
            style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}
          >
            <Badge variant="secondary">Total {stats.total}</Badge>
            <Badge variant="primary">Judul {stats.headings}</Badge>
            <Badge variant="primary">Paragraf {stats.paragraphs}</Badge>
            <Badge variant="primary">Daftar {stats.lists}</Badge>
            <Badge variant="secondary">Kata {hitungKata.kata}</Badge>
            <Badge variant="secondary">Karakter {hitungKata.karakter}</Badge>
          </div>

          <Divider />
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="dokumen" /> Dokumen Tersimpan
          </h3>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Input
              placeholder="Nama dokumen..."
              value={namaDokumenBaru}
              onChange={setNamaDokumenBaru}
            />
            <Button
              type="primary"
              size="sm"
              onClick={simpanDokumen}
              disabled={blocks.length === 0}
            >
              <Ikon nama="simpan" /> Simpan
            </Button>
          </div>
          {pesanDokumen ? (
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-ui)",
                color: "var(--muted)",
              }}
            >
              {pesanDokumen}
            </p>
          ) : null}
          {daftarDokumen.length === 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-ui)",
                color: "var(--muted)",
              }}
            >
              Belum ada dokumen tersimpan. Beri nama lalu tekan Simpan.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              {daftarDokumen.map((d) => (
                <li
                  key={d.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                  }}
                >
                  {idGantiNama === d.id ? (
                    <>
                      <Input
                        value={namaSementara}
                        onChange={setNamaSementara}
                      />
                      <Button
                        size="sm"
                        type="primary"
                        onClick={() => simpanGantiNama(d.id)}
                      >
                        OK
                      </Button>
                      <Button size="sm" onClick={() => setIdGantiNama("")}>
                        Batal
                      </Button>
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: "var(--font-size-ui)",
                        }}
                        title={d.nama}
                      >
                        {d.nama}{" "}
                        <span style={{ color: "var(--muted)" }}>
                          {new Date(d.saat).toLocaleString("id-ID", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                      <Button size="sm" onClick={() => bukaDokumen(d.id)}>
                        Buka
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setIdGantiNama(d.id);
                          setNamaSementara(d.nama);
                        }}
                      >
                        Ganti nama
                      </Button>
                      <Button size="sm" onClick={() => hapusDokumen(d.id)}>
                        <Ikon nama="hapus" /> Hapus
                      </Button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Divider />
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="panduan" /> Panduan
          </h3>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button
              type={tabPanduan === "ppt" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTabPanduan("ppt")}
            >
              Buat PPT
            </Button>
            <Button
              type={tabPanduan === "infografis" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTabPanduan("infografis")}
            >
              Buat Infografis
            </Button>
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: "var(--space-6)",
              fontSize: "var(--font-size-ui)",
              color: "var(--muted)",
              lineHeight: 1.7,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
            }}
          >
            {(tabPanduan === "ppt" ? PANDUAN_PPT : PANDUAN_INFOGRAFIS).map(
              (s) => (
                <li key={s}>{s}</li>
              ),
            )}
          </ol>

          <Divider />
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="presentasi" /> Alur PPT Master
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--space-6)",
              fontSize: "var(--font-size-ui)",
              color: "var(--muted)",
              lineHeight: 1.7,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
            }}
          >
            {ALUR_PPT_MASTER.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Button
            type="outline"
            size="sm"
            block
            onClick={() => {
              const t = getTemplate("data_analysis");
              if (t) pakaiTemplate(t);
            }}
          >
            <Ikon nama="statistik" /> Muat Analisis Data (grafik native)
          </Button>

          <Divider />
          <h3 style={{ margin: 0, fontSize: "var(--font-size-title)" }}>
            <Ikon nama="prinsip" /> Prinsip Diagram
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: "var(--space-6)",
              fontSize: "var(--font-size-ui)",
              color: "var(--muted)",
              lineHeight: 1.7,
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-1)",
            }}
          >
            {PRINSIP_DIAGRAM.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <Button
            type="outline"
            size="sm"
            block
            onClick={() => {
              const t = getTemplate("process_flow");
              if (t) pakaiTemplate(t);
            }}
          >
            <Ikon nama="alur" /> Muat Alur Proses
          </Button>
        </aside>
      </div>

      <footer
        style={{
          padding: "var(--space-4) var(--space-6)",
          borderTop: "1px solid var(--border)",
          fontSize: "var(--font-size-ui)",
          color: "var(--muted)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-2)",
        }}
      >
        <span>
          NitZ-909 · {semuaTemplate.length} template (docx · pptx · xlsx ·
          infografis) · contoh berlabel DATA UJI
        </span>
        <span>
          {blocks.length} blok · {judul || "Tanpa judul"}
        </span>
      </footer>
      <div
        style={{
          padding: "0 var(--space-6) var(--space-4)",
          fontSize: "var(--font-size-caption, 10px)",
          color: "var(--faint)",
        }}
      >
        Alur presentasi diadaptasi dari PPT Master (MIT © 2025–2026 Hugo He) ·
        Prinsip diagram dari diagram-design (MIT © 2025 Cathryn Lavery)
      </div>
    </div>
  );
}

export const App = () => (
  <ThemeProvider>
    <AppInner />
  </ThemeProvider>
);
