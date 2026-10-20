# Integrasi DeckCraft → NitZ-909

NitZ-909 memakai **DeckCraft** ([storytold/deckcraft](https://github.com/storytold/deckcraft))
sebagai mesin render dan ekspor presentasi. DeckCraft adalah reimplementasi
PowerPoint open-source dalam Rust murni yang berjalan native (Windows, macOS,
Linux, FreeBSD) maupun lewat WASM di web.

Rilis yang dipakai: **v0.8.0** (dirilis 2026-10-18).

---

## Mengapa DeckCraft, bukan pptxgenjs saja

NitZ-909 sebelumnya mengekspor PPTX di browser memakai `pptxgenjs`. Itu tetap
berfungsi, tapi punya dua batas yang terasa pada presentasi berskala besar:

| Batas | pptxgenjs (browser) | DeckCraft |
|---|---|---|
| Tata letak | Koordinat inches, master slide | Slide 960×540 pt, layout, placeholder, tema lengkap |
| Grafik | Chart XML, tapi **butuh penyesuaian** | `insert.chart` native, 15+ tipe, seluruhnya terender |
| SmartArt | Tidak ada | `insert.smartArt` (process, cycle, hierarchy, matrix, …) |
| Pratinjau | Tidak ada render | `render_slide` → PNG resolution apa pun |
| Determinisme | Tergantung font browser | Font OFL tertanam, hasil sama di semua mesin |

DeckCraft bukan pengganti pptxgenjs, melainkan **jalur premium**: pptxgenjs tetap
menangani ekspor cepat di browser, DeckCraft menangani deck berskala besar
dengan tabel, grafik, SmartArt, dan pratinjau yang sama persis dengan file
PowerPoint-nya.

---

## Arsitektur

```
┌──────────────────────── Browser (bundel Vite) ────────────────────────┐
│  src/components/App.tsx                                             │
│    └─ src/components/DeckCraftStudio.tsx   ← panel di sidebar Ekspor │
│         └─ src/lib/deckcraft-client.ts     ← klien HTTP (aman)     │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ fetch /api/deckcraft/*
┌───────────────────────────────▼───────────────────────────────────────┐
│  Server Node (middleware Vite / server produksi)                    │
│  server/deckcraft-api.ts                                            │
│    ├─ src/lib/deckcraft-ppt.ts   ← ContentBlock[] → perintah engine  │
│    └─ src/lib/deckcraft.ts       ← klien MCP stdio (bridge Node)     │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ JSON-RPC 2.0 per baris (stdio)
┌───────────────────────────────▼───────────────────────────────────────┐
│  deckcraft-cli.exe mcp   (DeckCraft v0.8.0, headless)               │
│    engine: 300+ perintah (slide.*, insert.*, format.*, design.*, …)  │
└───────────────────────────────────────────────────────────────────────┘
```

### Mengapa protokol MCP, bukan `deckcraft-cli run --cmd`

CLI accepts `--cmd 'perintah={"json":…}'` per perintah. Dua masalah:

1. **Batas panjang baris perintah Windows** (~8 KB) — deck nyata dengan banyak
   slide melampaui itu.
2. **Tidak ada state antar perintah** — tiap `run` memulai presentasi baru.

MCP di stdio memberi sesi yang persists: satu proses, banyak perintah, state
presentasi bertahan, dan `render_slide` mengembalikan PNG di respons yang
sama (tanpa file sementara).

---

## Berkas yang ditambahkan

| Berkas | Peran |
|---|---|
| `src/lib/deckcraft.ts` | Bridge Node: klien MCP stdio, sesi DeckCraft, pemeriksaan binary |
| `src/lib/deckcraft-ppt.ts` | Konverter `ContentBlock[]` → perintah engine DeckCraft |
| `src/lib/deckcraft-client.ts` | Klien HTTP sisi browser (aman diimpor bundel) |
| `server/deckcraft-api.ts` | Rute API: status, build, preview, export |
| `src/components/DeckCraftStudio.tsx` | Panel UI: pilih tema, bangun deck, pratinjau, unduh |
| `src/styles/glass.css` | Lapisan Glassmorphism (terpisah agar mudah dilacak) |
| `scripts/vendor-deckcraft.ps1` | Unduh + verifikasi checksum binary resmi |
| `scripts/verify-deckcraft.mts` | Uji bridge end-to-end (Node) |
| `scripts/verify-api.mjs` | Uji API end-to-end (HTTP) |
| `scripts/verify-ui.mjs` | Uji UI end-to-end (Chrome DevTools Protocol) |
| `scripts/verifikasi-pptx.mjs` | Uji isi PPTX (tabel/grafik/seri XML) |
| `scripts/verifikasi-sidebar.mjs` | Uji penempatan panel + gaya kaca |
| `scripts/capture-tema.mjs` | Screenshot per tema (terang/gelap) |
| `server/serve.ts` | Server produksi: statis + API dalam satu proses |
| `src/lib/deckcraft-ppt.test.ts` | Unit test konverter (vitest) |

---

## Menjalankan

```powershell
# 1. Unduh binary DeckCraft (sekali saja)
pnpm vendor:deckcraft

# 2. Jalankan aplikasi
pnpm dev

# 3. Buka panel "DeckCraft Studio" di sidebar kanan → Bangun Deck
```

Binary diletakkan di `vendors/deckcraft-bin/app/`. Lokasi alternatif bisa lewat
environment `DECKCRAFT_CLI`.

### Mode produksi

`vite preview` hanya menyajikan berkas statis — middleware API tidak ikut.
Untuk menjalankan aplikasi di luar mode dev, pakai server produksi yang
menyajikan `dist/` **dan** API DeckCraft dalam satu proses:

```powershell
pnpm build
node --experimental-strip-types server/serve.ts
# → http://127.0.0.1:8080
```

Variabel: `PORT` (default 8080), `HOST` (default 127.0.0.1).

### Verifikasi

```powershell
pnpm verify:deckcraft       # bridge Node → deck + PPTX + PNG
pnpm verify:deckcraft:api   # API HTTP (butuh `pnpm dev` jalan)
pnpm verify:deckcraft:ui    # UI lewat Chrome DevTools (butuh `pnpm dev` jalan)
pnpm verify:deckcraft:pptx  # isi PPTX (tabel/grafik/seri XML)
pnpm verify:deckcraft:sidebar   # penempatan panel + gaya kaca
pnpm verify:deckcraft:concurrency # build/preview/export paralel
node scripts/verifikasi-perintah.mjs  # id perintah vs engine DeckCraft
pnpm test                   # unit test vitest
pnpm typecheck              # tsc browser + tsc server
```

---

## Pemetaan konten

| Blok NitZ-909 | Perintah DeckCraft | Catatan |
|---|---|---|
| `heading` level 1–2 | `slide.new` (layout `titleOnly`) | Pemisah slide |
| `heading` level 3+ | `insert.textBox` + `format.bullets` | Sub-poin |
| `paragraph` | `insert.textBox` | Teks polos |
| `list` | `insert.textBox` + `format.bullets` | Indentasi anak = tab |
| `table` | `insert.table` | Data = header + baris |
| `chart` | `insert.chart` | `bar`→`column`, `line`/`pie`/`area`/`scatter` apa adanya |
| `image` (data-URL) | `insert.picture` | Gambar remote perlu diunduh dulu |
| `diagram` (mermaid) | `insert.smartArt` | Label node Mermaid → tahap proses |
| `code` | `insert.textBox` | Mono belum tersedia via CLI |
| `divider` | `shape.insert` (preset `line`) | Garis pemisah |

### Catatan API DeckCraft yang tidak terdokumentasi

Tiga hal ini ditemukan lewat pembacaan source engine
(`deckcraft/crates/engine/src/cmd/`), bukan dari `describe`:

1. **`insert.table` menerima `data`** (array of array of string) untuk mengisi sel,
   meski `deckcraft-cli describe insert.table` tidak mencantumkannya.
2. **`insert.smartArt` TIDAK menerima `rect`** — parameternya diabaikan diam-diam.
   SmartArt diposisikan otomatis oleh engine (10–90% lebar slide, 28–88% tinggi).
   Mengirim `rect` tidak merusak apa pun, tapi tidak berefek.
3. **Id perintahnya `shape.insert`**, bukan `insert.shape` — yang terakhir tidak
   ada dan akan ditolak engine.

Skrip `scripts/verifikasi-perintah.mjs` membandingkan id perintah dan parameter
yang dipakai konverter dengan `deckcraft-cli commands` / `describe`, sehingga
ketidaksesuaian seperti ini tertangkap otomatis.

### Keputusan tata letak

Semua slide memakai layout `titleOnly` (hanya judul), lalu isian diletakkan
sebagai text box / tabel / grafik dengan koordinat eksplisit.

Alasannya: layout `titleAndContent` menaruh teks di placeholder yang
posisinya tidak bisa dikontrol, sehingga isian bertumpuk dengan placeholder.
Dengan `titleOnly` semua isi bisa ditempatkan tepat — ini yang membuat
pratinjau DeckCraft identik dengan hasil akhir.

---

## Rute API

| Rute | Metode | Isi |
|---|---|---|
| `/api/deckcraft/status` | GET | `{tersedia, versi, binPath, tema[], galat}` |
| `/api/deckcraft/build` | POST | `{blocks, judul, tema}` → `{deck}` |
| `/api/deckcraft/preview?slide=N&scale=S` | GET | `{png}` (base64 PNG) |
| `/api/deckcraft/export` | POST | Body PPTX (`application/vnd.openxmlformats-…`) |

---

## Batasan yang diketahui

- **Bridge berjalan di Node, bukan browser.** `child_process` dan `node:fs`
  tidak tersedia di bundel browser. Untuk preview/export di browser, server
  API harus aktif (`pnpm dev` atau server produksi).
- **Vercel tidak bisa menjalankan API DeckCraft.** Vercel menyajikan aplikasi
  statis; bridge butuh proses Node. Di Vercel, panel "DeckCraft Studio"
  menampilkan "Tidak tersedia" dan sisanya tetap jalan normal. Untuk
  DeckCraft penuh, jalankan di mesin sendiri (`pnpm serve`) atau di host yang
  mendukung Node (Railway, Render, VPS).
- **Gambar remote tidak diunduh otomatis.** `insert.picture` DeckCraft membaca
  dari berkas atau base64; `https://` harus diunduh lebih dulu oleh pemanggil.
- **Kode monospace belum.** DeckCraft CLI tidak bisa menyetel font per text box
  secara langsung.
- **DeckCraft tidak punya biner Windows ARM64 resmi** di rilis v0.8.0 —
  vendoring otomatis memakai x64.
- **`insert.smartArt` mengabaikan `rect`.** Posisi SmartArt ditentukan engine
  (lihat catatan API di atas).

### Mirror deploy

Folder `Deploy Github/` adalah mirror yang dipush ke GitHub lalu dideploy ke
Vercel. Setelah mengubah sumber, jalankan:

```powershell
pnpm sync:deploy
```

Folder `server/` sengaja tidak ikut disalin — API DeckCraft tidak bisa hidup
di Vercel.

---

## Lisensi

DeckCraft berlisensi **MIT OR Apache-2.0** (lihat `deckcraft/LICENSE-MIT` dan
`deckcraft/LICENSE-APACHE`). Font yang dibundel di dalam binernya berlisensi OFL
— daftar lengkap ada di `deckcraft/ATTRIBUTION.md`.

Kode NitZ-909 sendiri tidak berubah lisensinya.
