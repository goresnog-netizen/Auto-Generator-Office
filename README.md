# Auto Generator Office

[![CI](https://github.com/goresnog-netizen/Auto-Generator-Office/actions/workflows/ci.yml/badge.svg)](https://github.com/goresnog-netizen/Auto-Generator-Office/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/goresnog-netizen/Auto-Generator-Office?display_name=tag)](https://github.com/goresnog-netizen/Auto-Generator-Office/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**NitZ-909** — dari bahan mentah menjadi laporan siap saji dan deck PowerPoint profesional, tanpa disunting ulang.

Satu permintaan + bahan yang dilampirkan → dokumen lengkap tersusun per bagian → ekspor Word / PDF / PPTX / Excel / Diagram.

**Demo langsung (gratis, tanpa akun):** https://goresnog-netizen.github.io/Auto-Generator-Office/
Diterbitkan otomatis lewat `.github/workflows/pages.yml`; GitHub Pages tidak berbayar untuk repo public.

**Versi lengkap dengan DeckCraft Studio (Docker, tanpa build):**

```bash
docker run -d --name nitz-909 -p 8090:8090 \
  ghcr.io/goresnog-netizen/auto-generator-office:latest
```

---

## Kenapa ini berbeda

| Lapisan | Isi |
| --- | --- |
| **Bahasa** | 7 profil ragam (laporan, ringkasan, presentasi, proposal, analisis, notulen, SOP), kaidah PUEBI, kalimat efektif, dan pemeriksa mutu deterministik berskor 0–100 |
| **Generasi** | Mode *Bertahap*: kerangka dulu, lalu satu bagian per permintaan — tidak terpotong, bagian gagal tidak membatalkan sisanya, blok masuk kanvas satu per satu |
| **Presentasi** | 9 tema modern (palet, tipografi, latar gradien), 11 layout, KPI otomatis, tabel & grafik native, infografis proses |
| **Diagram** | Mermaid dirender jadi PNG 2400 px dengan warna mengikuti tema deck |
| **Ekspor** | DOCX · PDF · PPTX · XLSX · `.mmd` · PNG infografis · DeckCraft Studio |

## Mulai cepat

**Tidak perlu pasang Node.js dulu** — tiga jalur tersedia:

| Platform | Pasang | Jalankan |
| --- | --- | --- |
| **Docker** (VPS, produksi) | `docker compose up --build` | `http://localhost:8090` — DeckCraft API aktif |
| Windows | klik dua kali `setup.bat` | klik dua kali `start.bat` |
| Linux/macOS | `./start.sh install` | `./start.sh` |

### DeckCraft Studio (opsional, tapi ini yang menghasilkan PPTX native)

DeckCraft adalah program Rust terpisah. Tanpa binary-nya, aplikasi tetap
berfungsi penuh untuk DOCX/PDF/XLSX/PPTX sisi browser, tetapi panel
**DeckCraft Studio** menampilkan "tidak tersedia".

| Jalur | Cara mengaktifkan |
| --- | --- |
| Docker | otomatis — binary sudah di dalam image |
| Windows / Linux / macOS | `npm run vendor:deckcraft` (unduh + verifikasi SHA-256) |

`vendor:deckcraft` memilih skrip yang benar sendiri: PowerShell di Windows,
bash di Linux/macOS. Hasilnya masuk ke `vendors/deckcraft-bin/app/` sesuai
jalur yang dicari aplikasi, jadi tidak perlu mengeset `DECKCRAFT_CLI` manual.

Setelah dokumen tersusun, pilih tema di panel **Ekspor** lalu tekan **Ekspor PPT**.

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
Dockerfile / docker-compose.yml  self-host dengan DeckCraft API aktif
server/serve.ts                server produksi (statis + API DeckCraft)
src/lib/bahasa.ts            spesifikasi bahasa, perbaikan ejaan, skor mutu
src/lib/auto-generate.ts     generateOtomatis() + generateBertahap()
src/lib/ppt-desain.ts        9 tema, layout slide, gradien, infografis
src/lib/mermaid-gambar.ts    Mermaid → PNG
src/lib/exporter.ts           jalur ekspor browser
src/generators/               generator Node (DOCX/PPTX/XLSX/PDF/Diagram)
Deploy Github/                mirror bersih untuk Vercel (disinkronkan via npm run sync:deploy)
docs/                         dokumentasi teknis (lihat daftar di bawah)
```

### Dokumentasi

| Berkas | Isi |
| --- | --- |
| [`docs/SPESIFIKASI-PRODUK.md`](docs/SPESIFIKASI-PRODUK.md) | prompt induk / spesifikasi awal produk |
| [`docs/AUTO-GENERATE.md`](docs/AUTO-GENERATE.md) | mode Bertahap dan Sekali jalan |
| [`docs/BAHASA-DAN-DESAIN-PPT.md`](docs/BAHASA-DAN-DESAIN-PPT.md) | profil ragam bahasa, tema, layout slide |
| [`docs/DIAGRAM-MERMAID.md`](docs/DIAGRAM-MERMAID.md) | Mermaid → PNG, warna mengikuti tema |
| [`docs/INTEGRASI-DECKCRAFT.md`](docs/INTEGRASI-DECKCRAFT.md) | jembatan DeckCraft, batasan hosting statis |
| [`docs/CI-DAN-VERIFIKASI.md`](docs/CI-DAN-VERIFIKASI.md) | workflow CI, skrip audit |
| [`docs/arsip/`](docs/arsip) | laporan build & review lama (historis, tidak diperbarui) |

## Verifikasi

- `pnpm test` — 81 tes lulus di 7 berkas
- `pnpm typecheck` — 0 error (3 konfigurasi)
- `pnpm build` — sukses
- `node scripts/audit-gap-beser.mjs` — 33/33
- `node scripts/verifikasi-siring.mjs` — 10/10 (jalankan dengan `URL=http://localhost:5180/` bila Vite hanya mendengarkan `localhost`)

Seluruh angka dan contoh bawaan berlabel **DATA UJI (sintetis)** — bukan data nyata.

Rincian sesi pengembangan ada di [`PROGRESS.md`](PROGRESS.md).
