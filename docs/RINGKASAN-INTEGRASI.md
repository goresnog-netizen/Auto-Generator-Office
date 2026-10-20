# Ringkasan Integrasi DeckCraft + Glassmorphism

**Tanggal:** 2026-10-20
**Status:** selesai & terverifikasi (94 pemeriksaan lulus, 0 gagal)

---

## Apa yang berubah

### A. Repo GitHub `storytold/deckcraft` masuk ke project 909

Repo di-clone ke `deckcraft/` (11 MB, sudah di-`.gitignore` — salinan kerja
lokal untuk baca source & dokumentasi). Binary resmi **v0.8.0** (rilis
2026-10-18) diunduh ke `vendors/deckcraft-bin/`.

DeckCraft adalah reimplementasi PowerPoint open-source dalam Rust murni —
300+ perintah engine, tabel/grafik/SmartArt native, dan renderer yang
menghasilkan PNG resolusi apa pun.

### B. DeckCraft jadi mesin presentasi NitZ-909

Panel **"DeckCraft Studio"** di sidebar Ekspor:

1. Pilih tema (8 tema: DeckCraft, Harbor, Ember, Meadow, Nocturne, Paper,
   Coral Reef, Slate)
2. **Bangun Deck** → isi kanvas dikonversi jadi deck (slide, tabel, grafik,
   SmartArt, gambar)
3. Lihat **pratinjau PNG asli** per slide — render DeckCraft, bukan perkiraan
   browser
4. **Unduh PPTX** → file PowerPoint asli

Cara kerja: browser → API HTTP → bridge Node → protokol MCP di stdio ke
`deckcraft-cli mcp` (headless). Detail lengkap di
[`docs/INTEGRASI-DECKCRAFT.md`](INTEGRASI-DECKCRAFT.md).

### C. UI Glassmorphism

`src/styles/glass.css` (lapisan terpisah, mudah dilacak):
- Mesh gradien 5 blob + noise `feTurbulence` sebagai "makanan" untuk blur
- Panel, header, sidebar, kartu, input, dialog → semua kaca berlapis
- Terverifikasi: 206 elemen berkaca, kontras teks 8,2:1 – 15,6:1 (WCAG AA
  butuh 4,5:1)
- Tema terang/gelap + varian warna ikut otomatis

Detail di [`docs/GLASSMORPHISM.md`](GLASSMORPHISM.md).

---

## Bug yang ditemukan & diperbaiki

| Lokasi | Bug | Dampak |
|---|---|---|
| `src/lib/exporter.ts:456` | `tipe.toUpperCase()` pada tipe grafik pptxgenjs | **Setiap grafik di setiap PPTX adalah bingkai kosong tanpa seri** |
| `src/lib/deckcraft-ppt.ts` | `insert.shape` (id tak ada) | Divider akan ditolak engine |
| `src/lib/deckcraft-ppt.ts` | `insert.smartArt` diberi `rect` | Param diabaikan diam-diam |
| `src/lib/deckcraft-ppt.ts` | Level heading hilang di outline markdown | Struktur deck jadi rata |
| `server/deckcraft-api.ts` | Build/preview/export tanpa lock | Request paralel saling menimpa deck |
| `src/components/DeckCraftStudio.tsx` | `useEffect` dependensi `[tema]` | Fetch ulang + menimpa pilihan tema |
| `src/components/DeckCraftStudio.tsx` | Klik ganda "Bangun Deck" | Dua deck berjalan bersamaan |

---

## Cara pakai

```powershell
# 1. Unduh binary DeckCraft (sekali saja, verifikasi checksum otomatis)
pnpm vendor:deckcraft

# 2. Jalankan
pnpm dev          # buka http://localhost:5173 → sidebar Ekspor → DeckCraft Studio
```

Mode produksi (statis + API dalam satu proses):
```powershell
pnpm build
pnpm serve        # http://127.0.0.1:8080
```

---

## Verifikasi

```powershell
pnpm verify:all   # 94 pemeriksaan: typecheck, unit test, bridge, API, UI,
                  # konkurensi, efek kaca, audit CSS
```

| Skrip | Cakupan |
|---|---|
| `verify:deckcraft` | bridge Node → deck + PPTX + PNG |
| `verify:deckcraft:commands` | id perintah vs engine DeckCraft (39 cek) |
| `verify:deckcraft:pptx` | isi PPTX: tabel/grafik/seri XML |
| `verify:deckcraft:api` | API HTTP: status/build/preview/export |
| `verify:deckcraft:ui` | UI via Chrome DevTools: klik → deck → pratinjau |
| `verify:deckcraft:concurrency` | 5 build + 3 ekspor paralel |
| `verify:glass` | noise overlay, backdrop-filter, kontras WCAG |
| `verify:css` | dead selector, painting order, fallback tanpa blur |

Unit test: 28 lulus (`src/lib/deckcraft-ppt.test.ts`).

---

## Batasan yang perlu diketahui

- **Vercel tidak bisa menjalankan API DeckCraft** — Vercel menyajikan aplikasi
  statis, sedangkan bridge butuh proses Node. Di Vercel, panel DeckCraft
  menampilkan "Tidak tersedia"; sisanya tetap normal. Untuk DeckCraft penuh:
  jalankan lokal (`pnpm serve`) atau di host ber-Node (Railway/Render/VPS).
- Folder `Deploy Github/` (mirror untuk Vercel) disinkronkan lewat
  `pnpm sync:deploy`; folder `server/` sengaja tidak ikut.
- Gambar remote (`https://`) belum diunduh otomatis sebelum `insert.picture`.
- Blok kode belum monospace (API font DeckCraft belum dipakai).
- `src/generators/pptx.ts` masih stub — jalur itu sudah di-quarantine dan
  tidak dipakai UI. Ekspor browser tetap lewat `src/lib/exporter.ts`.
