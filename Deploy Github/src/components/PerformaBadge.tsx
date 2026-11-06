/**
 * Indikator Performa — FPS real-time & status render.
 *
 * Glassmorphism modern memakai `backdrop-filter` + animasi aurora. Keduanya
 * punya biaya; indikator ini membuat biaya itu TERLIHAT, sehingga regresi
 * performa bisa langsung diawasi tanpa perlu membuka DevTools.
 *
 * Dirender sebagai chip kecil di header. Saat dinonaktifkan (atau saat
 * `prefers-reduced-motion` aktif), animasi aurora dimatikan oleh CSS —
 * indikator ini menunjukkannya supaya pengguna tahu kenapa.
 */
import { useEffect, useRef, useState } from "react";

type Kualitas = "baik" | "sedang" | "berat";

export interface PerformaBadgeProps {
  /** Aktifkan pengukuran FPS. */
  aktif?: boolean;
}

export function PerformaBadge({ aktif = true }: PerformaBadgeProps) {
  const [fps, setFps] = useState<number | null>(null);
  const [kualitas, setKualitas] = useState<Kualitas>("baik");
  const [reduced, setReduced] = useState(false);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!aktif) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    let frames = 0;
    let terakhir = performance.now();
    let berjalan = true;

    const loop = (waktu: number) => {
      if (!berjalan) return;
      frames++;
      // Hitung FPS setiap ~500 ms supaya tidak re-render tiap frame.
      if (waktu - terakhir >= 500) {
        const nilai = Math.round((frames * 1000) / (waktu - terakhir));
        setFps(nilai);
        setKualitas(nilai >= 50 ? "baik" : nilai >= 28 ? "sedang" : "berat");
        frames = 0;
        terakhir = waktu;
      }
      frameRef.current = requestAnimationFrame(loop);
    };
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      berjalan = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [aktif]);

  if (!aktif) return null;

  // Angka FPS bisa MENYESATKAN. Di lingkungan headless (CI, Chrome tanpa
  // GPU) `requestAnimationFrame` tak dipanggil sesering di monitor asli,
  // sehingga FPS-nya jadi 1-3 padahal aplikasi sama sekali tak lambat.
  // Browser juga menurunkan rAF saat tab tak aktif.
  //
  // Jadi kalau FPS < 10, angka tak bisa dipercaya: tampilkan "?" dengan
  // warna netral, bukan angka merah yang membuat user salahdiagnosis.
  const takTerukur = fps !== null && fps < 10;

  const warna =
    fps === null || takTerukur
      ? "var(--muted)"
      : kualitas === "baik"
        ? "var(--success-text)"
        : kualitas === "sedang"
          ? "var(--warning-text)"
          : "var(--danger-text)";

  const label = fps === null ? "…" : takTerukur ? "?" : `${fps}`;

  return (
    <span
      className="performa-badge"
      style={{ color: warna }}
      title={
        reduced
          ? "Animasi dimatikan karena pengaturan 'kurangi gerak' sistem aktif. Panel kaca tetap berfungsi."
          : takTerukur
            ? "FPS tak bisa diukur di lingkungan ini (tab tak aktif atau tanpa GPU). Nilai rendah di sini bukan tanda aplikasi lambat."
            : `FPS ${fps} - kualitas render ${kualitas}.`
      }
      aria-label={
        fps === null
          ? "Mengukur FPS"
          : takTerukur
            ? "FPS tak bisa diukur di lingkungan ini"
            : `${fps} frame per detik, kualitas ${kualitas}`
      }
    >
      <span
        className="performa-titik"
        style={{ background: warna }}
        aria-hidden="true"
      />
      {label}
      <span className="performa-satuan">fps</span>
      {reduced && <span className="performa-nbadge">· gerak ↓</span>}
    </span>
  );
}
