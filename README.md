# Auto Generator Office

**NitZ-909** — dari bahan mentah menjadi laporan siap saji dan deck PowerPoint profesional, tanpa disunting ulang.

Satu permintaan + bahan yang dilampirkan → dokumen lengkap tersusun per bagian → ekspor Word / PDF / PPTX / Excel / Diagram.

**Demo langsung (gratis, tanpa akun):** https://goresnog-netizen.github.io/Auto-Generator-Office/
Diterbitkan otomatis lewat `.github/workflows/pages.yml`; GitHub Pages tidak berbayar untuk repo public.

---

## Kenapa ini berbeda

| Lapisan | Isi |
| --- | --- |
| **Bahasa** | 7 profil ragam (laporan, ringkasan, presentasi, proposal, analisis, notulen, SOP), kaidah PUEBI, kalimat efektif, dan pemeriksa mutu deterministik berskor 0–100 |
| **Generasi** | Mode *Bertahap*: kerangka dulu, lalu satu bagian per permintaan — tidak terpotong, bagian gagal tidak membatalkan sisanya, blok masuk kanvas satu per satu |
| **Presentasi** | 9 tema modern (palet, tipografi, latar gradien), 11 layout, KPI otomatis, tabel & grafik native, infografis proses |
| **Diagram** | Mermaid dirender jadi PNG 2400 px dengan warna mengikuti tema deck |
| **Ekspor** | DOCX · PDF · PPTX · XLSX · `.mmd` · PNG infografis · DeckCraft Studio |

## Mulai cepat — Node.js terunduh otomatis

**Tidak perlu pasang Node.js dulu.** Installer memeriksa Node dan mengunduh
Node LTS resmi (dengan verifikasi SHA256) bila belum ada. `npm` sudah termasuk
di dalamnya. Rincian ada di [`INSTALL.md`](INSTALL.md).

| Platform | Pasang | Jalankan |
| --- | --- | --- |
| Windows | klik dua kali `setup.bat` | klik dua kali `start.bat` |
| Linux/macOS | `./start.sh install` | `./start.sh` |

Aplikasi terbuka di `http://localhost:5173`.

Kalau Node sudah terpasang dan Anda ingin memakai pnpm seperti pengembangan
utama:

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

Panel **Sumber** (`.txt`, `.md`, `.csv`, `.json`) isinya dibaca sebagai konteks.
Untuk bahan dari PDF/Word, tempel teksnya di kolom **Permintaan** pada panel
Auto-Generate.

Setelah dokumen tersusun, pilih tema di panel **Ekspor** lalu tekan **Ekspor PPT**.

## Struktur penting

```
src/lib/bahasa.ts            spesifikasi bahasa, perbaikan ejaan, skor mutu
src/lib/auto-generate.ts     generateOtomatis() + generateBertahap()
src/lib/ppt-desain.ts        9 tema, layout slide, gradien, infografis
src/lib/mermaid-gambar.ts    Mermaid → PNG
src/lib/exporter.ts          jalur ekspor browser
src/generators/              generator Node (DOCX/PPTX/XLSX/PDF/Diagram)
Deploy Github/               mirror bersih untuk Vercel (disinkronkan via npm run sync:deploy)
docs/                        AUTO-GENERATE.md, BAHASA-DAN-DESAIN-PPT.md, INTEGRASI-DECKCRAFT.md
```

## Verifikasi

- `pnpm test` — 148 tes lulus
- `pnpm typecheck` — 0 error (3 konfigurasi)
- `pnpm build` — sukses
- `node scripts/audit-gap-beser.mjs` — 33/33
- `node scripts/verifikasi-siring.mjs` — 10/10 (jalankan dengan `URL=http://localhost:5180/` bila Vite hanya mendengarkan `localhost`)

Seluruh angka dan contoh bawaan berlabel **DATA UJI (sintetis)** — bukan data nyata.

Rincian sesi pengembangan ada di [`PROGRESS.md`](PROGRESS.md).
