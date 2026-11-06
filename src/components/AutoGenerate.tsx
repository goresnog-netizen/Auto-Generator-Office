/**
 * Auto-Generate — buat dokumen lengkap dari satu prompt.
 *
 * Ini niche asli NitZ-909: dari satu kalimat, AI menyusun dokumen berstruktur
 * (heading, paragraf, daftar, tabel, grafik, diagram) yang langsung bisa
 * diekspor jadi PPTX lewat DeckCraft.
 */
import { useState } from "react";
import { Button, Select, Textarea } from "./ui";
import { Ikon } from "./Ikon";
import { PERSONAS, type PersonaId } from "../data/personas";
import {
  generateBertahap,
  generateOtomatis,
  type GayaOtomatis,
  type HasilOtomatis,
} from "../lib/auto-generate";
import type { ContentBlock } from "../types";
import type { ProviderAI } from "../lib/ai";

const GAYA: { value: GayaOtomatis; label: string }[] = [
  { value: "laporan", label: "Laporan lengkap" },
  { value: "ringkasan", label: "Ringkasan eksekutif" },
  { value: "presentasi", label: "Materi presentasi" },
  { value: "proposal", label: "Proposal" },
  { value: "analisis", label: "Analisis data" },
];

export interface AutoGenerateProps {
  providerId: ProviderAI;
  providerLabel: string;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  /** Judul dokumen saat ini (dipakai sebagai konteks). */
  judul: string;
  /** Dipanggil dengan hasil generate; biasanya mengisi kanvas. */
  onHasil: (
    hasil: HasilOtomatis,
    opsi?: { sudahDiKanvas?: boolean },
  ) => void;
  /**
   * Teks bahan (berkas/tautan terlampir) yang dipakai sebagai konteks.
   * Dibaca saat tombol ditekan, bukan saat render.
   */
  ambilBahan?: () => Promise<string>;
  /**
   * Mode bertahap: dipanggil setiap satu bagian selesai, supaya slide bisa
   * muncul di kanvas satu per satu tanpa menunggu seluruh dokumen.
   */
  onBagian?: (
    blocks: ContentBlock[],
    info: { indeks: number; total: number; judul: string },
  ) => void;
  onPesan?: (pesan: string) => void;
  /** Mode placement hasil: ganti seluruh kanvas, atau tambahkan di akhir. */
  mode?: "ganti" | "tambah";
  /** Callback saat pengguna mengubah mode placement. */
  onMode?: (mode: "ganti" | "tambah") => void;
  /** Bisa membatalkan auto-generate terakhir? */
  bisaUndoAuto?: boolean;
  /** Bisa mengulang auto-generate yang dibatalkan? */
  bisaRedoAuto?: boolean;
  onUndoAuto?: () => void;
  onRedoAuto?: () => void;
}

export function AutoGenerate({
  providerId,
  providerLabel,
  modelId,
  apiKey,
  baseUrl,
  judul,
  mode = "ganti",
  onMode,
  onHasil,
  ambilBahan,
  onBagian,
  onPesan,
  bisaUndoAuto = false,
  bisaRedoAuto = false,
  onUndoAuto,
  onRedoAuto,
}: AutoGenerateProps) {
  const [prompt, setPrompt] = useState("");
  const [gaya, setGaya] = useState<GayaOtomatis>("laporan");
  const [persona, setPersona] = useState<PersonaId | "">("");
  const [jumlahBagian, setJumlahBagian] = useState(5);
  const [allowRich, setAllowRich] = useState(true);
  const [sedang, setSedang] = useState(false);
  const [pesan, setPesan] = useState("");
  const [galat, setGalat] = useState("");
  /** true = kerangka lalu per bagian (tidak terpotong); false = satu permintaan. */
  const [bertahap, setBertahap] = useState(true);

  const jalankan = async () => {
    if (!prompt.trim()) {
      setGalat("Tulis dulu permintaanmu.");
      return;
    }
    if (!apiKey.trim()) {
      setGalat(`Isi kunci ${providerLabel} dulu.`);
      return;
    }
    setSedang(true);
    setGalat("");
    setPesan(bertahap ? "Menyusun kerangka dokumen..." : "Menyusun dokumen dari prompt...");
    try {
      const dasar = {
        provider: providerId,
        model: modelId,
        apiKey: apiKey.trim(),
        ...(baseUrl ? { baseUrl } : {}),
        prompt: prompt.trim(),
        // "Ganti kanvas" = dokumen baru, jadi judul lama tidak boleh menang
        // (dulu judul template ikut terbawa ke laporan baru). Pada mode
        // "Tambahkan", judul yang ada justru dipertahankan.
        judul: mode === "tambah" ? judul.trim() || undefined : undefined,
        gaya,
        ...(persona ? { persona } : {}),
        jumlahBagian,
        allowRich,
      };

      // Bahan dari berkas terlampir ikut dikirim — tanpa ini, berkas yang
      // dilampirkan pengguna hanya muncul sebagai nama di halaman sumber.
      const bahan = ambilBahan ? await ambilBahan().catch(() => "") : "";

      const hasil = bertahap
        ? await generateBertahap({
            ...dasar,
            bahan,
            onKemajuan: (p) => setPesan(p),
            ...(onBagian ? { onBagian } : {}),
          })
        : await generateOtomatis(dasar);

      // Pada mode bertahap, blok sudah ditempatkan per bagian; jangan
      // menimpa kanvas sekali lagi.
      onHasil(hasil, { sudahDiKanvas: bertahap && Boolean(onBagian) });

      const s = hasil.statistik;
      const bagianGagal =
        (hasil as { bagianGagal?: number[] }).bagianGagal ?? [];
      const gagal =
        bagianGagal.length > 0
          ? ` — ${bagianGagal.length} bagian gagal, sisanya tetap dibuat`
          : "";
      setPesan(
        `Selesai: ${s.totalBlok} blok (${s.heading} heading, ${s.daftar} daftar` +
          `${s.tabel ? `, ${s.tabel} tabel` : ""}` +
          `${s.grafik ? `, ${s.grafik} grafik` : ""}` +
          `${s.diagram ? `, ${s.diagram} diagram` : ""})` +
          `${s.dibuang ? ` — ${s.dibuang} blok cacat dibuang` : ""}` +
          `${gagal} · mutu bahasa ${hasil.kualitas.skor}/100.`,
      );
      onPesan?.(`Auto-generate selesai: ${s.totalBlok} blok.`);
    } catch (e) {
      const pesanGalat =
        e instanceof Error ? e.message : "Gagal menyusun dokumen.";
      setGalat(pesanGalat);
      setPesan("");
    } finally {
      setSedang(false);
    }
  };

  return (
    <div className="ag-panel">
      <div className="ag-kepala">
        <Ikon nama="ai" ukuran={15} />
        <strong>Auto-Generate</strong>
        <span className="ag-pita">1 prompt → dokumen lengkap</span>
      </div>

      <p className="ag-deskripsi">
        Tulis satu prompt. AI menyusun dokumen berstruktur — termasuk tabel,
        grafik, dan diagram bila datanya mendukung — yang langsung bisa
        diekspor jadi PPTX.
      </p>

      <Textarea
        label="Permintaan"
        value={prompt}
        rows={4}
        placeholder="Contoh: Buat proposal proyek transformasi digital untuk instansi pemerintah. Fokus pada metodologi, anggaran, dan risiko utama."
        onChange={(v) => setPrompt(v)}
      />

      <div className="ag-kendali">
        <Select
          label="Gaya"
          value={gaya}
          options={GAYA.map((g) => ({ value: g.value, label: g.label }))}
          onChange={(v) => setGaya(v as GayaOtomatis)}
        />
        <Select
          label="Audiens"
          value={persona}
          options={[
            { value: "", label: "Umum" },
            ...PERSONAS.map((p) => ({ value: p.id, label: p.nama })),
          ]}
          onChange={(v) => setPersona(v as PersonaId | "")}
        />        <Select
          label="Jumlah bagian"
          value={String(jumlahBagian)}
          options={[3, 4, 5, 6, 7, 8].map((n) => ({
            value: String(n),
            label: `${n} bagian`,
          }))}
          onChange={(v) => setJumlahBagian(Number(v))}
        />
      </div>

      <div
        className="ag-segmen"
        role="radiogroup"
        aria-label="Cara menyusun dokumen"
      >
        <button
          type="button"
          role="radio"
          aria-checked={bertahap}
          className={bertahap ? "aktif" : ""}
          onClick={() => setBertahap(true)}
          title="Kerangka dulu, lalu tiap bagian ditulis terpisah — tidak terpotong"
        >
          Bertahap (lengkap)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={!bertahap}
          className={!bertahap ? "aktif" : ""}
          onClick={() => setBertahap(false)}
          title="Satu permintaan untuk seluruh dokumen — lebih cepat, bisa terpotong"
        >
          Sekali jalan
        </button>
      </div>
      <p className="ag-deskripsi">
        {bertahap
          ? "Dokumen disusun per bagian sampai selesai; tiap bagian langsung masuk kanvas."
          : "Seluruh dokumen dalam satu permintaan — cepat, tetapi bisa terpotong pada dokumen panjang."}
      </p>

      <label className="ag-centang">
        <input
          type="checkbox"
          checked={allowRich}
          onChange={(e) => setAllowRich(e.target.checked)}
        />
        <span>
          Sertakan tabel, grafik &amp; diagram
          <small>Bukan hanya teks — agar bisa jadi deck yang kaya.</small>
        </span>
      </label>

      <div
        className="ag-segmen"
        role="radiogroup"
        aria-label="Cara hasil Placement ke kanvas"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "ganti"}
          className={mode === "ganti" ? "aktif" : ""}
          onClick={() => onMode?.("ganti")}
        >
          Ganti kanvas
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "tambah"}
          className={mode === "tambah" ? "aktif" : ""}
          onClick={() => onMode?.("tambah")}
        >
          Tambahkan
        </button>
      </div>
      <p className="ag-deskripsi">
        {mode === "ganti"
          ? "Hasil akan menggantikan seluruh isi kanvas."
          : "Hasil akan ditambahkan di akhir isi kanvas yang ada."}
      </p>

      <Button
        type="primary"
        block
        loading={sedang}
        onClick={() => void jalankan()}
      >
        <Ikon nama="ai" /> Susun Dokumen
      </Button>

      {/*
        Undo khusus auto-generate. Berbeda dari "Urungkan" umum yang
        membatalkan satu blok per klik, tombol ini mengembalikan dokumen
        ke keadaan sebelum auto-generate terakhir dalam satu klik.
      */}
      {(bisaUndoAuto || bisaRedoAuto) && (
        <div className="ag-undo">
          <Button
            type="outline"
            size="sm"
            disabled={!bisaUndoAuto}
            onClick={() => onUndoAuto?.()}
            title="Kembalikan dokumen ke kondisi sebelum auto-generate terakhir"
          >
            ↶ Batalkan Generate
          </Button>
          <Button
            type="outline"
            size="sm"
            disabled={!bisaRedoAuto}
            onClick={() => onRedoAuto?.()}
            title="Pulihkan auto-generate yang dibatalkan"
          >
            ↷ Ulangi Generate
          </Button>
        </div>
      )}

      {pesan && (
        <p className="ag-pesan" role="status">
          {pesan}
        </p>
      )}
      {galat && (
        <p className="ag-galat" role="alert">
          {galat}
        </p>
      )}
    </div>
  );
}
