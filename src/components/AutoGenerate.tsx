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
  generateOtomatis,
  type GayaOtomatis,
  type HasilOtomatis,
} from "../lib/auto-generate";
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
  onHasil: (hasil: HasilOtomatis) => void;
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
    setPesan("Menyusun dokumen dari prompt...");
    try {
      const hasil = await generateOtomatis({
        provider: providerId,
        model: modelId,
        apiKey: apiKey.trim(),
        ...(baseUrl ? { baseUrl } : {}),
        prompt: prompt.trim(),
        judul: judul.trim() || undefined,
        gaya,
        ...(persona ? { persona } : {}),
        jumlahBagian,
        allowRich,
      });
      onHasil(hasil);
      const s = hasil.statistik;
      setPesan(
        `Selesai: ${s.totalBlok} blok (${s.heading} heading, ${s.daftar} daftar` +
          `${s.tabel ? `, ${s.tabel} tabel` : ""}` +
          `${s.grafik ? `, ${s.grafik} grafik` : ""}` +
          `${s.diagram ? `, ${s.diagram} diagram` : ""})` +
          `${s.dibuang ? ` — ${s.dibuang} blok cacat dibuang.` : "."}`,
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
