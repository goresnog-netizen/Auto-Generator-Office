/**
 * DeckCraft Studio — panel integrasi DeckCraft di dalam NitZ-909.
 *
 * Panel ini adalah jembatan antara kanvas NitZ-909 dan engine DeckCraft:
 * pengguna memilih tema, membangun deck, melihat pratinjau slide asli
 * (dirender oleh DeckCraft, bukan perkiraan browser), lalu mengunduh PPTX.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Select } from "./ui";
import { Ikon } from "./Ikon";
import {
  ambilFilmstrip,
  ambilPratinjau,
  ambilStatusDeckcraft,
  bangunDeck,
  unduhFormatDeckcraft,
  unduhPptxDeckcraft,
  type DeckcraftDeckRingkas,
  type DeckcraftStatus,
  type FormatEksporDeckcraft,
} from "../lib/deckcraft-client";
import type { ContentBlock } from "../types";

type Fase = "idle" | "bangun" | "siap" | "ekspor" | "galat";

export interface DeckCraftStudioProps {
  blocks: ContentBlock[];
  judul: string;
  /** Tema awal; pengguna memilih tema di panel ini. */
  temaAwal?: string;
  onPesan?: (pesan: string) => void;
}

export function DeckCraftStudio({
  blocks,
  judul,
  temaAwal = "Slate",
  onPesan,
}: DeckCraftStudioProps) {
  const [status, setStatus] = useState<DeckcraftStatus | null>(null);
  const [tema, setTema] = useState(temaAwal);
  const [deck, setDeck] = useState<DeckcraftDeckRingkas | null>(null);
  const [slideAktif, setSlideAktif] = useState(0);
  const [pratinjau, setPratinjau] = useState<string | null>(null);
  /** Filmstrip: PNG kecil semua slide. */
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const [tampilFilmstrip, setTampilFilmstrip] = useState(false);
  const [fase, setFase] = useState<Fase>("idle");
  const [pesan, setPesan] = useState<string>("");
  /** Format yang sedang diekspor (untuk menandai tombol aktif). */
  const [formatEkspor, setFormatEkspor] = useState<FormatEksporDeckcraft | null>(
    null,
  );

  // Ambil status sekali saja. `tema` sengaja tidak jadi dependensi: kalau
  // ikut, setiap perubahan tema memicu fetch ulang dan potentially menimpa
  // pilihan pengguna dengan tema pertama dari server.
  useEffect(() => {
    let dibatalkan = false;
    void ambilStatusDeckcraft()
      .then((s) => {
        if (dibatalkan) return;
        setStatus(s);
        setTema((sekarang) =>
          s.tema.length > 0 && !s.tema.includes(sekarang)
            ? s.tema[0]
            : sekarang,
        );
      })
      .catch((e: unknown) => {
        if (dibatalkan) return;
        setStatus({
          tersedia: false,
          versi: "-",
          binPath: "",
          tema: [],
          galat: e instanceof Error ? e.message : "Gagal menghubungi server.",
        });
      });
    return () => {
      dibatalkan = true;
    };
  }, []);

  /** Cegah build tumpang tindih: klik ganda tidak boleh menjalankan dua deck. */
  const sedangBekerja = useRef(false);

  const bangun = useCallback(async () => {
    if (sedangBekerja.current) return;
    if (blocks.length === 0) {
      setFase("galat");
      setPesan("Kanvas masih kosong. Pilih template atau tambah blok dulu.");
      return;
    }
    sedangBekerja.current = true;
    setFase("bangun");
    setPesan("Membangun deck dengan DeckCraft...");
    try {
      const d = await bangunDeck(blocks, judul || "Presentasi NitZ-909", tema);
      setDeck(d);
      setSlideAktif(0);
      setFase("siap");
      setPesan(`${d.slides.length} slide siap.`);
      onPesan?.(`${d.slides.length} slide dibangun dengan DeckCraft.`);
    } catch (e) {
      setFase("galat");
      setPesan(e instanceof Error ? e.message : "Gagal membangun deck.");
    } finally {
      sedangBekerja.current = false;
    }
  }, [blocks, judul, tema, onPesan]);

  // Muat pratinjau slide aktif setiap kali deck atau slide berubah.
  useEffect(() => {
    if (!deck) {
      setPratinjau(null);
      return;
    }
    let dibatalkan = false;
    void ambilPratinjau(slideAktif, 1)
      .then((url) => {
        if (!dibatalkan) setPratinjau(url);
      })
      .catch(() => {
        if (!dibatalkan) setPratinjau(null);
      });
    return () => {
      dibatalkan = true;
    };
  }, [deck, slideAktif]);

  // Muat filmstrip sekali setelah deck siap. Filmstrip sengaja TIDAK di-refresh
  // tiap slide berganti: render ulang semua slide tiap klik mahal, dan
  // isinya sama saja selama deck tak berubah.
  useEffect(() => {
    if (!deck) {
      setFilmstrip([]);
      return;
    }
    let dibatalkan = false;
    void ambilFilmstrip(0.35)
      .then((gambar) => {
        if (!dibatalkan) setFilmstrip(gambar);
      })
      .catch(() => {
        if (!dibatalkan) setFilmstrip([]);
      });
    return () => {
      dibatalkan = true;
    };
  }, [deck]);

  const ekspor = async () => {
    if (sedangBekerja.current) return;
    sedangBekerja.current = true;
    setFase("ekspor");
    setPesan("Menyiapkan PPTX...");
    try {
      await unduhPptxDeckcraft(
        blocks,
        judul || "Presentasi NitZ-909",
        tema,
      );
      setFase("siap");
      setPesan("PPTX DeckCraft terunduh.");
      onPesan?.("PPTX DeckCraft terunduh.");
    } catch (e) {
      setFase("galat");
      setPesan(e instanceof Error ? e.message : "Gagal mengekspor.");
    } finally {
      sedangBekerja.current = false;
    }
  };

  /** Ekspor ke format lain (PDF / GIF) yang hanya bisa dibuat engine DeckCraft. */
  const eksporFormat = async (format: FormatEksporDeckcraft) => {
    if (sedangBekerja.current) return;
    sedangBekerja.current = true;
    setFormatEkspor(format);
    setFase("ekspor");
    setPesan(
      format === "gif"
        ? "Menyiapkan GIF animasi..."
        : "Menyiapkan PDF...",
    );
    try {
      await unduhFormatDeckcraft(
        blocks,
        judul || "Presentasi NitZ-909",
        tema,
        format,
        format === "gif" ? { secondsPerSlide: 3 } : {},
      );
      setFase("siap");
      const label = format.toUpperCase();
      setPesan(`${label} DeckCraft terunduh.`);
      onPesan?.(`${label} DeckCraft terunduh.`);
    } catch (e) {
      setFase("galat");
      setPesan(e instanceof Error ? e.message : "Gagal mengekspor.");
    } finally {
      setFormatEkspor(null);
      sedangBekerja.current = false;
    }
  };

  const tidakTersedia = status !== null && !status.tersedia;

  /**
   * Bedakan dua sebab "tidak tersedia" yang punya tindakan berbeda:
   *  - API DeckCraft tidak ada sama sekali (hosting statis) → butuh
   *    server Node;
   *  - API ada tapi binary deckcraft-cli belum terpasang → cukup
   *    jalankan skrip vendoring.
   */
  const apiTanpaServer = (status?.galat ?? "").includes(
    "tidak menyediakan API DeckCraft",
  );

  return (
    <div className="dc-studio">
      <div className="dc-kepala">
        <div className="dc-kepala-judul">
          <Ikon nama="presentasi" ukuran={15} />
          <strong>DeckCraft Studio</strong>
        </div>
        {status && (
          <span
            className={`dc-pita ${status.tersedia ? "dc-pita-ok" : "dc-pita-galat"}`}
          >
            {status.tersedia ? `DeckCraft ${status.versi}` : "Tidak tersedia"}
          </span>
        )}
      </div>

      {tidakTersedia ? (
        <div className="dc-kosong">
          {apiTanpaServer ? (
            <>
              <p>
                Server ini tidak menjalankan API DeckCraft. DeckCraft adalah
                program native (Rust), jadi butuh proses Node — hosting
                statis seperti Vercel tak bisa menjalankannya.
              </p>
              <p>
                Opsi: jalankan <code>pnpm serve</code> di komputer ini
                (server produksi di port 8090), atau deploy ke host
                ber-Node (Railway, Render, VPS, Docker).
              </p>
            </>
          ) : (
            <>
              <p>
                DeckCraft tidak dapat dijalankan di mesin ini. Jalankan skrip
                vendoring untuk mengunduh binernya, lalu muat ulang halaman.
              </p>
              <p>
                Perintah: <code>pnpm vendor:deckcraft</code>
              </p>
            </>
          )}
          {status?.galat && <code className="dc-galat-detail">{status.galat}</code>}
          <p className="dc-catatan">
            Sisa fitur NitZ-909 (template, editor, ekspor PPTX/DOCX/XLSX/PDF)
            tetap berfungsi tanpa DeckCraft.
          </p>
        </div>
      ) : (
        <>
          <div className="dc-kendali">
            <Select
              label="Tema DeckCraft"
              value={tema}
              options={(status?.tema ?? [tema]).map((t) => ({
                value: t,
                label: t,
              }))}
              onChange={setTema}
            />
            <div className="dc-tombol-baris">
              <Button
                type="primary"
                size="sm"
                loading={fase === "bangun"}
                onClick={() => void bangun()}
              >
                <Ikon nama="gambar" /> Bangun Deck
              </Button>
              <Button
                type="secondary"
                size="sm"
                loading={fase === "ekspor" && formatEkspor === null}
                disabled={!deck}
                onClick={() => void ekspor()}
              >
                <Ikon nama="unduh" /> Unduh PPTX
              </Button>
            </div>
            <div className="dc-tombol-baris">
              <Button
                type="secondary"
                size="sm"
                loading={fase === "ekspor" && formatEkspor === "pdf"}
                disabled={!deck}
                onClick={() => void eksporFormat("pdf")}
              >
                Unduh PDF
              </Button>
              <Button
                type="secondary"
                size="sm"
                loading={fase === "ekspor" && formatEkspor === "gif"}
                disabled={!deck}
                onClick={() => void eksporFormat("gif")}
              >
                Unduh GIF
              </Button>
            </div>
            {deck && (
              <button
                type="button"
                className="dc-toggle-filmstrip"
                aria-expanded={tampilFilmstrip}
                onClick={() => setTampilFilmstrip((v) => !v)}
              >
                {tampilFilmstrip ? "▾" : "▸"} Filmstrip semua slide
                {filmstrip.length > 0 && (
                  <span className="dc-filmstrip-jumlah">({filmstrip.length})</span>
                )}
              </button>
            )}
          </div>

          {pesan && (
            <p
              className={`dc-pesan ${fase === "galat" ? "dc-pesan-galat" : ""}`}
              role="status"
            >
              {pesan}
            </p>
          )}

          {deck && (
            <>
              <div className="dc-lembar">
                {pratinjau ? (
                  <img
                    className="dc-gambar"
                    src={pratinjau}
                    alt={`Pratinjau slide ${slideAktif + 1}: ${deck.slides[slideAktif]?.title ?? ""}`}
                  />
                ) : (
                  <div className="dc-gambar dc-gambar-kosong">
                    <span>Memuat pratinjau…</span>
                  </div>
                )}
              </div>

              <div className="dc-daftar-slide" role="list" aria-label="Daftar slide">
                {deck.slides.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="listitem"
                    className={`dc-item-slide ${s.index === slideAktif ? "aktif" : ""}`}
                    onClick={() => setSlideAktif(s.index)}
                    title={s.title || `Slide ${s.index + 1}`}
                  >
                    <span className="dc-item-nomor">{s.index + 1}</span>
                    <span className="dc-item-judul">
                      {s.title || "(tanpa judul)"}
                    </span>
                  </button>
                ))}
              </div>

              {tampilFilmstrip && (
                <div className="dc-filmstrip" role="list" aria-label="Pratinjau semua slide">
                  {filmstrip.length === 0 ? (
                    <p className="dc-pesan">Memuat filmstrip…</p>
                  ) : (
                    filmstrip.map((src, i) => (
                      <button
                        key={i}
                        type="button"
                        role="listitem"
                        className={`dc-filmstrip-item ${i === slideAktif ? "aktif" : ""}`}
                        onClick={() => setSlideAktif(i)}
                        title={deck.slides[i]?.title || `Slide ${i + 1}`}
                        aria-label={`Buka slide ${i + 1}`}
                      >
                        <img
                          className="dc-filmstrip-gambar"
                          src={src}
                          alt={`Slide ${i + 1}${deck.slides[i]?.title ? ": " + deck.slides[i].title : ""}`}
                          loading="lazy"
                        />
                        <span className="dc-filmstrip-nomor">{i + 1}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
