# PROGRESS — Integrasi DeckCraft + Glassmorphism

Terakhir diperbarui: 2026-10-20

## Yang sudah selesai (semua terverifikasi)

### 1. Integrasi DeckCraft v0.8.0
- Repo `storytold/deckcraft` di-clone ke `deckcraft/` (bersama `.git`).
- Binary resmi Windows x64 (v0.8.0, rilis 2026-10-18) diunduh ke
  `vendors/deckcraft-bin/app/` (80 MB, tidak di-commit — ada di `.gitignore`).
- Bridge Node (`src/lib/deckcraft.ts`): klien MCP stdio JSON-RPC ke
  `deckcraft-cli mcp`. Sesi persists, antrean serial, guard 16 MiB.
- Konverter (`src/lib/deckcraft-ppt.ts`): `ContentBlock[]` → perintah engine.
- API (`server/deckcraft-api.ts`): status / build / preview / export.
- Server produksi (`server/serve.ts`): statis + API dalam satu proses.
- UI (`src/components/DeckCraftStudio.tsx`): panel di sidebar Ekspor —
  pilih tema, Bangun Deck, pratinjau PNG per slide, Unduh PPTX.
- Skrip vendoring (`scripts/vendor-deckcraft.ps1`) dengan verifikasi checksum.

### 2. Glassmorphism
- `src/styles/glass.css` — lapisan optik terpisah, dimuat setelah base/index.
- Mesh gradien 5 blob + noise `feTurbulence` sebagai "makanan" blur.
- Token `--glass-*` diturunkan dari token tema (terang/gelap/varian ikut).
- Terverifikasi empiris: 206 elemen berkaca, kontras 8,2:1 – 15,6:1.

### 3. Perbaikan bug yang ditemukan
- `src/lib/exporter.ts:456` — `tipe.toUpperCase()` membuat grafik pptxgenjs
  jadi bingkai kosong tanpa seri. Diturunkan ke huruf kecil.
- `src/lib/deckcraft-ppt.ts` — `insert.shape` → `shape.insert` (id salah).
- `src/lib/deckcraft-ppt.ts` — `insert.smartArt` tidak menerima `rect`
  (diabaikan diam-diam); dihapus.
- `src/lib/deckcraft-ppt.ts` — level heading di outline markdown hilang
  (level 2 jadi `#`); diperbaiki ke `"#".repeat(level)`.
- `server/deckcraft-api.ts` — build/preview/export raced; diberi mutex.
- `src/components/DeckCraftStudio.tsx` — `useEffect` dependensi `[tema]`
  memicu fetch ulang & menimpa pilihan tema; sekarang `[]` + `setTema(fn)`.
- `src/components/DeckCraftStudio.tsx` — klik ganda menjalankan dua build;
  diberi guard `useRef`.

### 4. Auto-Generate (niche asli project)
- `src/lib/auto-generate.ts` — parser balasan AI + prompt builder.
- `src/components/AutoGenerate.tsx` — panel UI di sidebar Ekspor.
- `src/components/ui.tsx` — komponen `Textarea` baru.
- Skema blok **lengkap**: AI boleh mengembalikan `table`, `chart`, `diagram`
  — beda dengan "Draft AI" yang hanya boleh `heading|paragraph|list`.
- Parser membuang blok cacat & menghitungnya; tabel dipadatkan; grafik
  diseragamkan panjangnya; angka format Indonesia dikonversi.
- 19 unit test (`src/lib/auto-generate.test.ts`).
- 9 pemeriksaan UI end-to-end (`scripts/verifikasi-auto-generate.mjs`),
  provider AI di-mock di level `fetch` sehingga tak ada panggilan sungguhan.
- Detail: `docs/AUTO-GENERATE.md`.

### 5. Plugin DSH red-team
- `C:\Users\Brokenlink\.dsh\plugins\dsh-redteam\` — plugin native DSH
  (Cordis), ter-register di `profiles/desktop/cordis.patch.yml`.
- Menjalankan perintah verifikasi sendiri (typecheck, test), memancarkan
  `redteam:result`, dan mengubah perintah yang GAGAL jadi temuan otomatis.
- `redteam-review.md` — rubrik adversaris (bukti / tiga cara salah /
  konsistensi / keamanan).
- `smoke.test.cjs` — 7 pemeriksaan; menangkap 2 bug keamanan nyata saat
  pengembangan (shell injection via `shell:true`, dan kebocoran API key ke
  artefak prompt).

### 6. Audit Glassmorphism & perbaikannya
- Audit adversaris (subagen) melaporkan 10 temuan; **setiap klaim diverifikasi
  ulang lewat pengukuran di browser**, bukan diterima mentah.
- Terbukti & diperbaiki:
  - Tombol segmented aktif kontras **1,16:1 → 9,62:1** (film 24% diganti
    solid `--brand`).
  - Garis warna kategori di 58 kartu template hilang (shorthand `border`
    mereset `borderLeft` 4px) → diganti `border-width`/`border-style`.
  - Hanya 1 dari 12 `Card` jadi kaca → `Card` sendiri memakai token
    `--glass-*`, jadi semuanya konsisten.
  - 215 elemen (9,4%) punya `backdrop-filter` → **47 (2,1%)**; blur
    dibuang dari tombol kecil & kartu galeri, `contain: paint` +
    `content-visibility: auto` ditambahkan.
  - `prefers-contrast: more` tak berlaku di tema terang (spesifisitas) →
    diulang untuk `:root[data-theme="light"]`.
  - Tidak ada fallback tanpa `backdrop-filter` → blok `@supports not (...)`.
  - Dead CSS `.nitz-kanvas` / `.kanvas-editor` / `[style*="1.5px solid"]`
    dihapus; status "dipakai" kini lewat kelas `.terpakai`.
- **Tidak terbukti** (claims review, tapi measurement salah):
  - Label kecil di bawah AA → terukur 7,35:1 (bukan 3,08:1).
  - Noise overlay tak terlihat → **terlihat**, delta ukuran PNG 11,7%.
  - Tanpa blur teks tak terbaca → terukur 7,35:1 (bukan 1,43:1).
- Skrip: `verifikasi-audit-glass.mjs` (9 pemeriksaan), `verifikasi-noise.mjs`.

### 7. Infrastruktur pengujian
- 14 skrip verifikasi: bridge, id-perintah, isi-PPTX, API, UI, konkurensi,
  efek-kaca, audit-CSS, auto-generate, audit-glass, noise, screenshot-tema,
  suite-semua, dan bonus.
- `src/lib/deckcraft-ppt.test.ts` — 12 unit test vitest.
- `src/lib/auto-generate.test.ts` — 19 unit test vitest.
- `tsconfig.server.json` — typecheck terpisah untuk kode Node.
- `@types/node` ditambahkan sebagai devDependency.

## Status verifikasi terakhir

`pnpm verify:all` → **121 pemeriksaan lulus, 0 gagal**
- typecheck browser + server: 0 error
- 66 unit test lulus
- build produksi: sukses

## Sesi 2 (2026-10-20 sore/malam) — lanjutan sampai tuntas

### 1. Git
- `git init` + commit pertama: 145 file, `4a32d6d`. Ada titik balik.
- `.gitignore` dirapikan: `.acl-reports/`, screenshot, file scratch.

### 2. Arsitektur backdrop root (temuan dari MDN)
MDN: elemen dengan `mix-blend-mode` (dan `filter`/`opacity<1`/`mask`/`will-change`)
menjadi **backdrop root** — `backdrop-filter` hanya menjangkau piksel sampai
batas terdekat. Mesh lama diletakkan di `.nitz-app-root` yang punya
`mix-blend-mode` → blur panel **tidak menjangkau mesh**.

Diperbaiki:
- Mesh gradien dipindah ke `body`.
- `.nitz-app-root` jadi transparan.
- Noise jadi elemen terpisah `.nitz-latar` (bukan `::before`).
- Aurora jadi elemen terpisah `.nitz-aurora`.
- `base.css` yang masih set background root di-override eksplisit.

Diverifikasi `scripts/verifikasi-backdrop.mjs`: 0 blocker, piksel berbeda
dengan/tanpa blur.

### 3. Glassmorphism modern
- **Aurora**: 2 blob bergerak, animasi `transform` (GPU, bukan repaint) 24 s.
- **Sheen tepi**: sapuan cahaya 115° di tepi atas panel.
- **PerformaBadge**: chip FPS real-time di header + penanda "gerak ↓" saat
  `prefers-reduced-motion` aktif.

Terukur `scripts/verifikasi-performa.mjs`:
- 47 elemen `backdrop-filter` (2,1%) — sebelumnya 215 (9,4%).
- `will-change` hanya 1 elemen.
- **Biaya blur: 6,4 ms** (target ≤10 ms).
- Aurora terbukti hidup (transform berubah, `matrix(...)`).

### 4. PPTXGenerator Node — dari stub jadi nyata
- `src/generators/pptx.ts` menulis berkas .pptx sungguhan (sebelumnya
  mengembalikan `outputPath` fiktif tanpa menulis apa pun).
- Semua 9 jenis blok handled: heading→judul slide, list→bullet bertingkat,
  table→tabel native, chart→grafik native (tipe huruf kecil!), image→gambar
  tertanam, diagram→sumber, code→blok kode, divider→garis.
- Sampul + slide per heading + penutup; bullet >6 dilaporkan di metadata.
- `tsconfig.node.json` baru → typecheck terpisah untuk kode Node.
- `DocumentGenerator`/`ValidationResult` dipindah ke `src/types/index.ts`
  (menghindari siklus import `index.ts` ↔ `generators/`).

Diverifikasi `scripts/verifikasi-pptx-generator.mjs`: 19 pemeriksaan lulus —
8 slide, 133.553 byte, tabel native, grafik **2 seri** (`<c:ser>`), gambar
tertanam.

### 5. Auto-Generate mode append
- Toggle "Ganti kanvas / Tambahkan" di panel Auto-Generate.
- Mode "Tambahkan" menyambung hasil di akhir isi yang ada; judul tak diubah.

### 6. Typecheck — SEMUA generator bersih
- `src/generators/`: **127 → 0 error**. pptx, word, pdf, xlsx, diagram +
  `src/index.ts` + `src/types/index.ts` semuanya bersih.
- Import `../types` → `../types/index.ts` (ESM tak mendukung directory import).

Bug runtime yang tak terlihat tsc, ditemukan lewat smoke test:
- **pdf.ts**: tanpa `bufferPages: true`, `switchToPage()` melempar
  "out of bounds" → `generate()` selalu gagal, tak menulis apa pun.
  `switchToPage(pages.start + i)` juga wajib (indeks absolut).
  Nomor halaman harus ditulis DI DALAM area teks
  (`doc.page.maxY() - 20`); kalau di `page.height - 50`, pdfkit menambah
  halaman kosong otomatis (2 halaman → 4, nomor halaman salah).
- **xlsx.ts**: exceljs v4 tak kenal objek `{text, font}` sebagai nilai sel →
  jatuh ke tipe JSON, konten praktis hilang. Diganti: nilai primitif +
  gaya via `cell.font`/`cell.fill`/`cell.alignment`, warna `argb`.
- **word.ts**: numbering wajib didaftarkan di
  `Document({numbering:{config:[...]}})` — tanpa itu docx menulis
  `numId="{list-tanpa-urutan-0}"` dan .docx rusak di Word. `bullet:` dan
  `numbering:` tak boleh dipakai bersamaan (dua `<w:numPr>`).

Diverifikasi berlapis:
1. `scripts/verifikasi-generators.mjs` (33 pemeriksaan) — struktur +
   **ekstraksi teks PDF** (inflate Flate + decode array TJ) + konsistensi
   nomor halaman vs jumlah halaman.
2. `scripts/audit-isi-generator.mjs` (16 pemeriksaan) — isi dokumen dibaca
   & dicek kata kuncinya, bukan cuma valid secara struktural.
3. `scripts/audit-negative-test.mjs` (4 pemeriksaan) — **negative test**:
   balik 3 bug yang pernah ada satu per satu, pastikan skrip GAGAL
   (exit 1), lalu kembalikan. Semua 3 tertangkap. Ini bukti skrip
   verifikasinya berguna, bukan sekadar formalitas.

Hasil per generator:
- word .docx 10.133 B (memuat "Laporan Uji", "Poin satu", "nilai 1", "const a = 1")
- xlsx .xlsx 10.404 B (7 sheet, sharedStrings berisi teks asli)
- pdf .pdf 2.905 B (2 halaman, nomor halaman konsisten, teks terekstraksi)
- diagram .svg 10.468 B (ter-render, bukan sumber .mmd)
- pptx 5 slide + tabel native + teks benar

## Yang belum selesai
- ~~Auto-Generate belum punya tombol undo tersendiri.~~ -> **SELESAI** (Sesi 3).
- ~~Belum ada CI workflow untuk menjalankan `verify:all` di GitHub Actions.~~ ->
  **SELESAI** (Sesi 3).
- ~~Dukungan font monospace untuk blok kode lewat DeckCraft API.~~ ->
  **SELESAI** (Sesi 4).
- ~~Render pratinjau semua slide (filmstrip) di DeckCraft Studio.~~ ->
  **SELESAI** (Sesi 4).
- ~~Ekspor PDF/GIF lewat DeckCraft (`file.export` mendukung keduanya).~~ ->
  **SELESAI** (Sesi 4).
- Vercel tak bisa menjalankan API DeckCraft (panel menampilkan "Tidak
  tersedia" + panduan `pnpm serve`/host ber-Node). Ini batasan platform,
  bukan bug - DeckCraft adalah program native Rust.
- Diagram butuh mermaid-cli + Chrome; tanpa itu jatuh ke fallback `.mmd`
  (sekarang pesannya menyebut butir yang kurang secara spesifik).
- DeckCraft Studio belum ada di mirror `Deploy Github/` (memang disengaja -
  butuh server Node), tapi panelnya sendiri sudah di-source utama.

## Sesi 4 (2026-10-21) - 4 item tersisa diselesaikan + 3 bug nyata

### 1. Font monospace untuk blok kode
- `src/lib/deckcraft-ppt.ts`: blok `code` kini jadi text box ber-font
  monospace (16 pt) + latar + garis, bukan teks biasa.
- **Temuan kunci (empiris, DeckCraft v0.8.0 MCP)**:
  - `format.font {family, ids:[N]}` **mengabaikan `ids`** - hasilnya null,
    shape tak berubah;
  - `format.*` berlaku pada **selection slide AKTIF**, bukan pada id;
  - `shape.insert`/`insert.textBox` **otomatis menyeleksi** shape barunya,
    jadi `insert.textBox` -> `format.font` berurutan dalam satu batch
    benar-benar menempel;
  - `slide.go {index}` **menghapus selection** - jadi harus di SEBELUM
    `insert.textBox`, bukan sesudahnya;
  - `shape.inspect` hanya mencari shape di **slide aktif** - perlu `slide.go`
    dulu (ini sempat membuat font terbaca `undefined` saat inspeksi).
- Konsekuensi desain: perintah DeckCraft kini membawa field `slide` (indeks
  slide). Bridge menyisipkan `slide.go` yang sesuai sebelum perintah
  per-slide. Konverter sendiri TIDAK membuat `slide.go`.
- **Catatan lisensi font**: DeckCraft melarang aset Microsoft (§1.1 AGENTS.md
  DeckCraft). "Consolas" aman karena engine memetakannya ke substitusi
  berbobot metrik yang bebas lisensi: Liberation Mono -> Courier New ->
  Menlo -> Courier (`crates/fonts/src/fontdb.rs`). Font yang benar-benar
  dirender sudah diverifikasi lewat hash PNG berbeda per nama font.

### 2. Ekspor PDF & GIF lewat DeckCraft
- `src/lib/deckcraft.ts`: metode `ekspor(path, format, opsi)` memakai tool
  MCP `export` (format: png, jpeg, pptx, deckcraft, outline, pdf, gif).
- `server/deckcraft-api.ts`: rute `POST /api/deckcraft/export-format`
  (build + ekspor dalam satu operasi serial). Format tak didukung -> 400
  dengan pesan yang menyebut pilihan yang valid.
- `src/components/DeckCraftStudio.tsx`: tombol "Unduh PDF" & "Unduh GIF".
- Terverifikasi: PDF 182.885 B (signature `%PDF-`), GIF 28.035 B
  (signature `GIF89a`), nama berkas di `Content-Disposition`.

### 3. Filmstrip pratinjau semua slide
- `src/lib/deckcraft.ts`: `renderSemua(jumlah, skala)` render tiap slide.
- `server/deckcraft-api.ts`: `GET /api/deckcraft/filmstrip` -> array PNG
  base64 (skala 0,35 -> 336x189). Dibatasi 40 slide supaya respons tak
  membanjiri browser.
- `src/components/DeckCraftStudio.tsx`: toggle "Filmstrip semua slide" +
  grid thumbnail. Tanpa `backdrop-filter` (thumbnail kecil, blur tak pernah
  terlihat tapi tetap menambah layer kompositing).
- Filmstrip sengaja TIDAK di-refresh tiap slide berganti: render ulang
  semua slide tiap klik mahal, dan isinya sama selama deck tak berubah.

### 4. Build mirror Vercel - 3 bug nyata ditemukan

**Bug 1 (paling serius): import statis `server/deckcraft-api.ts`.**
`Deploy Github/vite.config.ts` meng-import modul API DeckCraft secara
statis, padahal folder `server/` TIDAK ikut disalin ke mirror (Vercel
melayani aplikasi statis). Build Vercel pasti gagal: "cannot find module".
- Perbaikan: impor DINAMIS + `try/catch`. Kalau modul tak ada, middleware
  dilewati; aplikasi tetap dibangun. Rute `/api/deckcraft/*` jatuh ke
  rewrite SPA -> HTML, dan klien sudah mendeteksi itu ("Server ini tidak
  menyediakan API DeckCraft").
- Diverifikasi lewat negative test: mengembalikan import statis -> build
  mirror GAGAL; dengan fix -> build LULUS.

**Bug 2: BOM di `package.json` mirror.**
`Set-Content -Encoding UTF8` di Windows PowerShell 5 menulis BOM, dan
PostCSS/Vite gagal parse JSON yang diawali BOM ("Unexpected token '\uFEFF'")
-> build mirror pecah.
- Perbaikan: `[System.IO.File]::WriteAllText` + `UTF8Encoding($false)`.

**Bug 3: skrip npm mirror menunjuk berkas yang tak ada.**
`package.json` mirror menyalin skrip `serve`, `verify:all`,
`vendor:deckcraft` dll, padahal folder `scripts/` & `server/` tak ada di
mirror. `typecheck` juga merujuk `tsconfig.node.json`/`tsconfig.server.json`
yang tak ada.
- Perbaikan: `sync-deploy.ps1` membersihkan skrip yang tak tersedia di
  mirror dan menyesuaikan `typecheck` jadi `tsc --noEmit`.
- Bug tambahan di `sync-deploy.ps1`: `$json` dihitung SEBELUM perubahan
  skrip, jadi `typecheck` yang baru tak ikut ke berkas. Urutan diperbaiki.

### 5. Skrip verifikasi baru
- `scripts/verifikasi-kode-deckcraft.mts` (10) - blok kode benar-benar
  ber-font monospace di binary DeckCraft sungguhan, dan paragraf biasa TIDAK
  ikut kena.
- `scripts/verifikasi-fitur-deckcraft.mjs` (41) - cek statis: konverter,
  bridge, server, klien, UI, CSS, dan mirror Vercel (termasuk BOM).
- `scripts/verifikasi-api-filmstrip.mjs` (17) - filmstrip + ekspor PDF/GIF
  lewat HTTP, termasuk kasus format tak didukung.
- `scripts/verifikasi-ui-filmstrip.mjs` (13) - filmstrip di browser:
  thumbnail benar-benar ter-render (naturalWidth > 0), klik thumbnail
  menggeser slide aktif.
- Negative test naik 6 -> **9** kasus: (G) import statis mirror,
  (H) blok kode tanpa font monospace, (I) BOM di package.json mirror.

### Catatan metodologi
- Skrip UI berbasis CDP harus **menunggu elemen muncul**, bukan jeda tetap.
  Versi pertama memakai `sleep(6000)` dan gagal semua padahal tampilannya
  benar - panel React belum mount. Sekarang pakai `tungguPunsur(selektor)`.
- `slide.inspect` tidak mengekspos properti run (font/size); itu harus dibaca
  dari `shape.inspect`.

## Status verifikasi terakhir (Sesi 4)

`pnpm verify:all` -> **353 pemeriksaan lulus, 0 gagal**, exit 0
- typecheck browser + server + node: 0 error
- 69 unit test lulus
- build produksi (sumber + mirror Vercel): sukses
- Negative test: 9 kasus, semuanya terbukti menangkap regresi
- Suite dijalankan 4x berturut-turut, semua exit 0

## Sesi 3 (2026-10-21) - 5 item tersisa diselesaikan

### 1. CI GitHub Actions
- `.github/workflows/ci.yml` - 3 job:
  - `check`: typecheck (browser/server/node) + vitest + vite build, di
    ubuntu-latest.
  - `generators`: verifikasi generator + audit isi + gambar PDF + fitur
    baru + negative test, di ubuntu-latest.
  - `deckcraft`: bandingkan id perintah dengan engine asli; **windows-latest**
    + `pnpm vendor:deckcraft` (binary rilis DeckCraft untuk Windows).
    `continue-on-error: true` - kegagalan job ini tak memblokir PR, karena
    bergantung pada ketersediaan rilis binary.
- Semua langkah pakai `pnpm install --frozen-lockfile`.

### 2. Generator PDF - gambar benar-benar tertanam
- `src/generators/pdf.ts`: `renderImage` jadi async; `muatGambar()` mendukung
  data URL (base64), path lokal, `file://`, dan URL http(s).
- `dimensiGambar()` membaca header PNG (IHDR) & JPEG (marker SOF) sendiri -
  `doc.image()` pdfkit langsung menggambar dan tak mengembalikan dimensi.
- SVG / file hilang / format tak didukung -> jatuh ke keterangan teks
  (`[Gambar tidak dapat ditampilkan: ...]`), bukan crash.
- Placeholder lama `[Image: ...]` dihapus total.
- **Bug yang ditemukan & diperbaiki**: variabel salah ketik `joural`
  (instead of `jalur`) -> semua gambar lokal gagal dimuat, dan exception-nya
  tertelan `catch` sehingga tak terlihat. Negative test sekarang menutup
  celah ini.

### 3. Auto-Generate - undo/redo khusus
- `src/components/AutoGenerate.tsx`: tombol "Batalkan Generate" dan
  "Ulangi Generate" (hanya tampil saat ada riwayat).
- `src/components/App.tsx`: snapshot `blocks` + `judul` tiap kali generate.
- **Riwayat ditulis lewat `useRef`**, bukan state saja: React membatching
  update, jadi `indeksAuto` di dalam callback bisa basi -> riwayat tertimpa
  dan undo kehilangan langkah.
- Batas 20 entri riwayat (snapshot penuh bisa besar).
- Undo mengembalikan dokumen ke kondisi SEBELUM generate dalam satu klik -
  beda dari "Urungkan" umum yang membatalkan satu blok per klik.

### 4. Pesan DeckCraft di hosting tanpa API
- `src/lib/deckcraft-client.ts`: `GalatDeckcraft` (kode status), deteksi
  respons non-JSON (hosting statis mengembalikan HTML, bukan JSON).
- `src/components/DeckCraftStudio.tsx`: membedakan dua sebab:
  - "API DeckCraft tidak ada" -> saran `pnpm serve` / Railway / Render / VPS;
  - "binary belum terpasang" -> saran `pnpm vendor:deckcraft`.
  Plus catatan bahwa fitur NitZ-909 lain tetap berfungsi.

### 5. Generator diagram - diagnosis & keamanan
- Pesan fallback membedakan "mermaid-cli tak ada" vs "Chrome/Chromium tak
  ditemukan"; detail teknis disimpan terpisah dari pesan user.
- **Command injection ditutup**: `exec()` (shell) -> `execFile()` (tanpa
  shell), plus sanitasi judul dokumen sebelum masuk nama berkas.
- Di Windows, `npx` adalah `.cmd` yang ditolak Node lewat `execFile`
  (CVE-2024-27980) -> jalankan `npx-cli.js` langsung dengan Node.
- Path relatif -> absolut (`path.resolve`), karena perintah dijalankan dengan
  `cwd` sendiri sehingga path relatif tak ketemu.

### 6. Perbaikan infrastruktur verifikasi
- **Encoding `.ps1`**: Windows PowerShell 5 membaca `.ps1` tanpa BOM sebagai
  ANSI; em-dash (U+2014) jadi byte 0x94 yang PowerShell anggap smart-quote
  penutup string -> "The string is missing the terminator".
  `scripts/perbaiki-encoding.ps1` menulis ulang semua `.ps1` di `scripts/`
  jadi ASCII + BOM.
- **Ekstraktor ZIP Node** (`scripts/zip-util.mjs`) menggantikan
  `Expand-Archive` PowerShell di 4 skrip. Alasannya: path sementara
  8.3 (`C:\Users\BROKEN~1\...`) tak bisa dibuka PowerShell.
- `verifikasi-semua.ps1` sekarang menampilkan output juga saat kode keluar
  != 0 - sebelumnya kegagalan tanpa `[GAGAL]` (exception di tengah skrip)
  tak terlihat sama sekali.
- Negative test retry 1x, TETAPI hanya kalau tak ada `[GAGAL]` di output
  (regresi yang disengaja tak diulang).

### 7. Performa glassmorphism - pengukuran jujur
- **Blur dibuang dari 32 elemen** yang tak butuh: field form (20: input 10,
  select 7, textarea 3), kartu statistik dashboard (8), segmented control
  (2), pita status (1), badge FPS (1).
  -> **48 -> 16 layer** (2,1% -> 0,7%).
- **Metrik waktu blur (ms) dihapus.** Alasannya jujur: di headless tanpa GPU
  tidak ada cara mengukur biaya blur secara kredibel -
  - `performance.now()` di halaman: dipengaruhi cadence rAF headless
    (~1 detik/frame);
  - `Page.captureScreenshot`: raster PNG ~5,7 detik, encoding-nya
    mendominasi selisih;
  - `Performance.getMetrics` TaskDuration: tak mencakup kompositing GPU.

  Angka yang dihasilkan berbeda-beda: 6,4 / 12,5 / 21,4 / 66,4 ms untuk
  kode yang tak berubah. Sekarang diganti metrik **deterministik**:
  jumlah layer, luas area tercakup blur, dan "tak ada blur pada elemen kecil
  (< 300x120)".
- Catatan: metrik waktu yang benar (Chrome Tracing / `long-animation-frame`)
  hanya bisa dijalankan di mesin dengan GPU sungguhan.

### 8. Skrip verifikasi baru
- `scripts/verifikasi-pdf-gambar.mjs` (14) - PNG benar-benar tertanam di PDF
  (XObject `/Subtype /Image`), SVG & file hilang tak crash, data URL jalan.
- `scripts/verifikasi-fitur-baru.mjs` (35) - CI, undo, pesan DeckCraft,
  diagnosis diagram, embed gambar PDF. Cek statis (tak perlu browser).
- `scripts/zip-util.mjs` - ekstraktor ZIP Node murni.
- `scripts/perbaiki-encoding.ps1` - normalisasi encoding `.ps1`.
- Negative test naik dari 4 -> 6 kasus (tambah: PDF gambar tak tertanam).

## Status verifikasi terakhir (Sesi 3)

`pnpm verify:all` -> **244 pemeriksaan lulus, 0 gagal**, exit 0
- typecheck browser + server + node: 0 error
- 66 unit test lulus
- build produksi: sukses
- Negative test: 6 kasus, membuktikan skrip menangkap regresi

## Catatan metodologi
Pengukuran performa di headless Chrome tanpa GPU tidak bisa menghitung FPS
(rAF idle, screencast kosong) maupun biaya blur dalam ms (lihat Sesi 3 §7).
Yang bisa diverifikasi: jumlah layer blur, luas area tercakup blur, animasi
aurora hidup (transform berubah), kontras WCAG dihitung dengan
mengomposisi leluhur background, dan - lewat negative test - bahwa
skrip verifikasi benar-benar menangkap regresi saat bug dibalik.