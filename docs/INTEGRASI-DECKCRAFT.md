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
| `scripts/verifikasi-kode-deckcraft.mts` | Uji blok kode ber-font monospace (binary asli) |
| `scripts/verifikasi-fitur-deckcraft.mjs` | Uji statis fitur DeckCraft + mirror Vercel |
| `scripts/verifikasi-api-filmstrip.mjs` | Uji filmstrip + ekspor PDF/GIF (HTTP) |
| `scripts/verifikasi-ui-filmstrip.mjs` | Uji filmstrip di browser (CDP) |
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
pnpm verify:deckcraft:kode   # blok kode monospace (butuh binary DeckCraft)
pnpm verify:deckcraft:filmstrip # filmstrip + PDF/GIF lewat HTTP
pnpm verify:fitur-deckcraft  # pemeriksaan statis fitur DeckCraft + mirror
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
| `code` | `insert.textBox` + `format.font` + `format.size` + `shape.fill` + `shape.line` | Font monospace, 16 pt, latar & garis |
| `divider` | `shape.insert` (preset `line`) | Garis pemisah |

### Blok kode:(font monospace)

Blok `code` dirender sebagai text box ber-font monospace (16 pt) dengan
latar terang dan garis tipis, bukan teks biasa.

Ini butuh beberapa hal yang mudah salah, semua diverifikasi empiris
terhadap binary DeckCraft v0.8.0 lewat MCP:

1. **`format.font {family, ids:[N]}` MENGABAIKAN `ids`.** Hasilnya `null`
   dan shape tak berubah. Format hanya berlaku pada **selection**.
2. **`insert.textBox` otomatis menyeleksi shape barunya.** Jadi urutan
   `insert.textBox` → `format.font` → `format.size` → `shape.fill` →
   `shape.line` dalam satu batch benar-benar menempel.
3. **`slide.go {index}` menghapus selection.** Jadi `slide.go` harus
   disisipkan **sebelum** `insert.textBox`, bukan sesudahnya.
4. **`shape.inspect` hanya mencari shape di slide AKTIF.** Tanpa `slide.go`
   lebih dulu, hasilnya "no shape N" — yang sempat membuat font terbaca
   `undefined` saat inspeksi.
5. **`slide.inspect` tidak mengekspos properti run.** Font/ukuran harus
   dibaca dari `shape.inspect` (`shape.text.paragraphs[].runs[].props`).

Konsekuensi desain: perintah DeckCraft kini membawa field `slide` (indeks
slide). Bridge (`src/lib/deckcraft.ts`) menyisipkan `slide.go` yang sesuai
sebelum perintah per-slide; konverter sendiri tidak membuat `slide.go`.

#### Soal lisensi font

DeckCraft melarang aset Microsoft (§1.1 AGENTS.md-nya). `"Consolas"` aman
karena engine memetakannya ke substitusi berbobot metrik yang bebas lisensi:

```
"courier new" | "courier" | "consolas" | "menlo"
  => &["Liberation Mono", "Courier New", "Menlo", "Courier"]
```

(`deckcraft/crates/fonts/src/fontdb.rs`). Font yang benar-benar dirender
sudah diverifikasi: hash PNG berbeda untuk setiap nama font, dan nama
palsu menghasilkan render yang sama dengan fallback — jadi nama font
memang berpengaruh, bukan sekadar dicatat di dokumen.

Ukuran 16 pt dipilih karena slide DeckCraft 16:9 lebarnya 960 pt
(= 13,3 inci). Body text presentasi biasanya 18–24 pt; 13 pt (nilai
pertama yang dipakai) terbukti terlalu kecil dibaca dari jauh.

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
| `/api/deckcraft/filmstrip?scale=S` | GET | `{gambar[]}` (base64 PNG semua slide) |
| `/api/deckcraft/export` | POST | Body PPTX (`application/vnd.openxmlformats-…`) |
| `/api/deckcraft/export-format` | POST | Body PDF / GIF / PPTX sesuai `format` |

### Ekspor berformat

`/api/deckcraft/export-format` menerima `format: "pptx" | "pdf" | "gif"`.
Engine DeckCraft v0.8.0 juga mendukung `png`, `jpeg`, `deckcraft`, dan
`outline`, tapi NitZ-909 hanya membuka tiga yang paling berguna untuk
presentasi. Format lain dijawab **400** dengan pesan yang menyebutkan
pilihan yang valid.

PDF: `layout` bisa `slides`/`notes`/`handouts`, `paper` `letter`/`a4`/…,
`perPage` untuk handout. GIF: `secondsPerSlide` (0,1–600, default 5) dan
`loop`. Di NitZ-909, GIF dibuat 3 detik per slide dan mengulang.

### Filmstrip

`/api/deckcraft/filmstrip` merender **semua** slide pada skala kecil
(default 0,35 → 336×189 px) dan mengembalikan array PNG base64. Dibatasi
40 slide supaya respons tak membanjiri browser.

Filmstrip sengaja dimuat **sekali** setelah deck siap, bukan di-refresh tiap
kali slide aktif berubah: render ulang semua slide tiap klik mahal, dan
isinya sama selama deck tak berubah.

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

Karena itu `vite.config.ts` **wajib** memuat middleware API lewat impor
**dinamis + `try/catch`**, bukan impor statis. Impor statis membuat build
Vercel gagal dengan "cannot find module", karena folder `server/` tidak ada
di mirror. Kalau modul tak ada, middleware dilewati dan aplikasi tetap
dibangun.

`pnpm sync:deploy` juga:

- membuang skrip npm yang menunjuk folder tak ada di mirror (`serve`,
  `verify:all`, `vendor:deckcraft`, …);
- menyesuaikan `typecheck` jadi `tsc --noEmit` (sumbernya merujuk
  `tsconfig.node.json` & `tsconfig.server.json` yang hanya ada di repo utama);
- menulis `package.json` **tanpa BOM** — BOM bikin PostCSS/Vite gagal parse
  JSON.

Ketiganya dijaga oleh `scripts/verifikasi-fitur-deckcraft.mjs` dan
negative test (kasus G dan I).

---

## Lisensi

DeckCraft berlisensi **MIT OR Apache-2.0** (lihat `deckcraft/LICENSE-MIT` dan
`deckcraft/LICENSE-APACHE`). Font yang dibundel di dalam binernya berlisensi OFL
— daftar lengkap ada di `deckcraft/ATTRIBUTION.md`.

Kode NitZ-909 sendiri tidak berubah lisensinya.
