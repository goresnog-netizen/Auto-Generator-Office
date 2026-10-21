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
- ~~Diagram butuh mermaid-cli + Chrome; tanpa itu jatuh ke fallback `.mmd`
  (sekarang pesannya menyebut butir yang kurang secara spesifik).~~ ->
  **SELESAI** (Sesi 5): `pnpm pasang:mermaid` memasang mermaid-cli + mendeteksi
  Chrome; render SVG nyata sudah terbukti.
- DeckCraft Studio belum ada di mirror `Deploy Github/` (memang disengaja -
  butuh server Node), tapi panelnya sendiri sudah di-source utama.
- **Belum ada git remote** - 11 commit lokal belum didorong ke GitHub, jadi
  workflow CI belum pernah benar-benar dijalankan di GitHub Actions. Butuh
  URL repo dari Principal:
  `git remote add origin <url> && git push -u origin master`.
  Sampai itu terjadi, `pnpm verify:ci` dipakai sebagai pengganti: seluruh
  langkah CI dijalankan lokal dan lulus (34 pemeriksaan).
- Font kode PPTX **Node** memakai `"Consolas"` (bukan Liberation Mono) - ini
  **memang** pilihan yang tepat: PPTX dibuka di PowerPoint, dan PowerPoint
  di Windows selalu punya Consolas. Kalau PPTX menyebut `"Liberation Mono"`
  (tak terpasang di Windows), PowerPoint jatuh ke Calibri yang PROPORSIONAL,
  jadi lebar baris kode jadi tak lurus. DeckCraft (mesin render sendiri)
  tetap pakai Liberation Mono karena font itu dibundel di binary-nya.
  Dua target, dua pilihan yang tepat.

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

## Sesi 5 (2026-10-21) - Mermaid + Chrome terpasang, font kode diganti

### 1. Instalasi mermaid-cli + Chrome (aman)
- `scripts/pasang-mermaid.ps1` (script npm: `pnpm pasang:mermaid`):
  1. cek Node >= 22.13.0 (syarat mermaid-cli 12) - gagal cepat dengan pesan jelas;
  2. cari Chrome di 4 lokasi standar (Program Files, x86, LOCALAPPDATA,
     Chromium);
  3. pasang `@mermaid-js/mermaid-cli@12.0.0` + `puppeteer@25.15.0` sebagai
     **devDependency lokal** dengan `PUPPETEER_SKIP_DOWNLOAD=1` -> Chromium
     (~200 MB) TIDAK pernah terunduh saat instalasi lokal;
  4. tulis `config/puppeteer.config.json` (headless, `--no-sandbox`,
     `executablePath` ke Chrome mesin ini) - **tanpa BOM**;
  5. uji render nyata (flowchart -> SVG berisi node). Kalau gagal, skrip
     berhenti dengan pesan - bukan diam-diam "berhasil".
- `config/puppeteer.config.json` **tak di-commit** (path spesifik mesin),
  di-regenerate installer.
- `pnpm-workspace.yaml`: build script `puppeteer` diizinkan, karena runner
  Linux CI tak punya Chrome dan butuh Chrome for Testing milik Puppeteer.

### 2. Generator diagram - 4 bug nyata ditemukan
- **`cmd.exe /c` memecah path berspasi.** Repo ini ada di
  `C:\MRP\proyek 2026\NitZ-909`; memanggil `mmdc.cmd` lewat `cmd.exe /c`
  memotongnya jadi `C:\MRP\proyek` dan perintah gagal. Perbaikan: `mmdc`
  hanyalah wrapper yang memanggil `src/cli.js` dengan Node - jadi modul
  memanggil `cli.js` **langsung**, tanpa `.cmd`, tanpa shell.
- **`import.meta.url` + `path.resolve` salah akar.** Akar proyek tak bisa
  dihitung dari `import.meta.url` saja, karena modul ini dimuat dari
  `src/generators/`, dari `node_modules/.cache/` (bundle esbuild), atau dari
  `dist/`. Perbaikan: `fileURLToPath` + beberapa kandidat lokasi.
- **Berkas keluaran tak divalidasi.** `readFile(outputAbs)` bisa membaca
  berkas lain (mis. sumber `.mmd`) lalu dilaporkan "sukses" padahal tak ada
  render. Perbaikan: cek berkas keluar benar-benar ada DAN diawali `<svg`.
- **`generate()` membuang `metadata`.** Efeknya: pesan fallback ("Chrome
  tidak ditemukan" / "sintaks Mermaid salah") hilang total - user cuma
  melihat diagram gagal tanpa tahu apa yang kurang. Perbaikan: metadata
  digabung & diteruskan. Negative test kasus J menjaga hal ini.
- Fallback kini membedakan 3 sebab: mermaid-cli tak ada / Chrome tak ada /
  sintaks Mermaid salah.

### 3. Font kode: "Consolas" -> "Liberation Mono"
Alasan (hasil uji, bukan selera):
- **Lisensi**: Liberation Mono = SIL OFL dan DIBUNDEL di binary DeckCraft.
  Consolas = font Microsoft, dan DeckCraft sendiri melarang aset Microsoft.
- **Konsistensi**: Liberation Mono selalu ada -> hasil render sama di
  semua mesin. Consolas cuma di Windows.
- **Terbukti dirender, bukan fallback**: dibuktikan dengan membandingkan
  hash PNG render. Hasil:
  - Liberation Mono -> hash **beda** dari font tak_unknown (fallback)
  - Consolas -> hash beda juga (ada di mesin ini)
  - DejaVu Sans Mono, JetBrains Mono, Fira Code, Source Code Pro ->
    hash **SAMA** dengan font tak dikenal = FALLBACK, tak benar-benar
    dirender.
  - "Liberation Mono" ternyata **tidak** ada di daftar font Windows tapi
    tetap dirender - karena dibundel di dalam binary DeckCraft.
- Verifikasi ini kini jadi bagian `scripts/verifikasi-kode-deckcraft.mts`:
  render `FONT_KODE` dibandingkan dengan render font tak dikenal; hashnya
  harus beda.

### 4. Skrip & negative test
- `scripts/verifikasi-mermaid.mjs` (20 pemeriksaan) - instalasi, konfigurasi
  Puppeteer, flowchart/sequence/pie ter-render, generator mengembalikan SVG
  nyata, sintaks salah -> pesan yang tepat.
- Negative test naik 9 -> **10** kasus (tambah: J = metadata fallback Mermaid
  dibuang).
- Negative test H (blok kode tanpa font) diperbaiki: regex-nya terlalu
  ketat dan gagal saat format kode berubah. Sekarang longgar (spasi
  fleksibel).

## Status verifikasi terakhir (Sesi 5)

`pnpm verify:all` -> **329 pemeriksaan lulus, 0 gagal**, exit 0
- typecheck browser + server + node: 0 error
- 69 unit test lulus
- Mermaid: 20 pemeriksaan (3 jenis diagram ter-render beneran)
- Negative test: 10 kasus, semuanya terbukti menangkap regresi
- Detail: `docs/DIAGRAM-MERMAID.md`
## Sesi 6 (2026-10-21) - TEST RUN visual + 4 bug nyata di area yang belum pernah diuji

### Test run (lihat hasilnya)
Sesi ini dimulai dengan TEST RUN, bukan asumsi. Yang dilakukan:
- 4 screenshot UI (tema terang, tema gelap, DeckCraft Studio + filmstrip,
  pratinjau slide kode) -> `testrun/`.
- Render deck nyata (4 slide) + ekspor PPTX/PDF/GIF + diagram Mermaid.
- Pemeriksaan ISI dokumen hasil ekspor (bukan cuma ukurannya).

Hasil visual:
- Tema gelap & terang: bagus, kontras & hierarki rapi, glassmorphism Subtiel.
- DeckCraft Studio: tombol Bangun Deck, Unduh PPTX/PDF/GIF, toggle filmstrip
  semua bekerja; thumbnail benar-benar ter-render.
- Blok kode: Liberation Mono, kontras bagus, indentasi terjaga.
- Mermaid: flowchart benar-benar ter-render jadi SVG.

### 4 bug nyata yang ditemukan (semua di area yang belum pernah diuji)
1. **Generator PPTX Node menulis file liar ke folder kerja.** `generate()` calls
   `pptx.writeFile({fileName})` dan mengembalikan `buffer: undefined` -
   jadi pemanggil yang tak punya `outputPath` tak dapat buffer sama sekali,
   DAN file `.pptx` muncul di root proyek tanpa diminta. Perbaikan: tulis ke
   buffer dulu (`write({outputType:"nodebuffer"})`), simpan ke disk HANYA
   kalau `outputPath` diberikan. Sekarang konsisten dengan word/xlsx/pdf.
2. **Blok `code` di PPTX Node dirender sebagai bullet biasa.** Kode masuk ke
   `bulletTertunda`, jadi ia dapat font body + bullet - tak pernah terlihat
   sebagai kode di PowerPoint. Perbaikan: text box monospace (Consolas)
   dengan latar & garis.
3. **Import tak bisa di-resolve di Node ESM.** `src/generators/index.ts`
   import `'./word'` (tanpa ekstensi) dan `'../index'`; `src/index.ts`
   import `'./types'` (directory import). Semuanya gagal di Node ESM:
   "Cannot find module" / "does not provide an export named 'ChartBlock'".
   Perbaikan: ekstensi `.ts` eksplisit + `import type` untuk yang cuma
   tipe. Semua generator di `src/generators/` sekarang bisa diimpor di Node.
4. **Badge FPS menampilkan angka menyesatkan.** Di headless (CI, tanpa GPU)
   `requestAnimationFrame` jarang dipanggil -> FPS terbaca 1-3 dan chip
   tampil MERAH seolah app lambat. Perbaikan: di bawah 10 fps, angka tak
   bisa dipercaya -> chip menampilkan "?" dengan warna netral + tooltip
   yang menjelaskan. Tooltip lama juga masih menyebut "Layer blur: 47"
   (angka usang, sekarang 16) - dihapus.

### Peningkatan visual blok kode (dari hasil test run)
- Font 16 pt -> **18 pt** (di slide 960 pt = 13,3 inci, 16 pt masih kecil
  dibaca dari jauh).
- Latar `F4F5F7` -> `EEF0F3` (abu-abu, bukan putih - blok jadi terlihat
  terpisah tanpa garis tebal).
- Garis `D7DBE0` -> `C8CDD4` (lebih tegas).
- **Warna teks kini eksplisit** (`format.color` = `111827`). Sebelumnya
  `WARNA_TEKST_KODE` didefinisikan tapi TAK PERNAH DIPAKAI - teks kode
  memakai warna teks tema, yang di slide terang bisa jadi kurang kontras
  di atas latar abu-abu. Perbaikan: `format.color` dikirim (terbukti jalan:
  `ok: true` di batch engine).
- Lebar dihitung dari baris terpanjang (11,2 pt per karakter untuk
  Liberation Mono pada 18 pt).

### Skrip verifikasi baru
- `scripts/audit-isi-generator-node.mjs` (25) - ISI dokumen hasil ekspor
  generator Node: buffer dikembalikan, tak ada file liar, blok kode
  monospace, grafik punya `<c:ser>` (bukan bingkai kosong), tabel & isi
  teks di docx/xlsx/pdf.
- Negative test 10 -> **12** kasus: (M) PPTX Node tak kembalikan buffer,
  (N) blok kode PPTX Node tanpa monospace.

### Bug pada skrip verifikasi sendiri
- `verifikasi-semua.ps1` sempat berisi typo `Jalarkan` (bukan `Jalankan`).
  Akibatnya baris itu dieksekusi sebagai perintah yang tak dikenal, dan
  karena `$ErrorActionPreference = "Continue"`, suite tetap exit 0 - skrip
  AUDAUDIT BARU tak pernah jalan padahal terlihat "lulus". Ini bugs yang
  kelas paling berbahaya: pemeriksaan yang tak dijalankan tapi dilaporkan
  hijau. Diperbaiki & dicek lewat `Select-String "Jalarkan"`.

## Status verifikasi terakhir (Sesi 6)

`pnpm verify:all` -> **351 pemeriksaan lulus, 0 gagal**, exit 0
- typecheck browser + server + node: 0 error
- 72 unit test lulus
- Audit isi generator Node: 25 pemeriksaan
- Negative test: 13 kasus, semuanya terbukti menangkap regresi
- 30 langkah suite terdaftar (dicek penjaga salah ketik)
## Sesi 7 (2026-10-21) - audit gap: koreksi klaim, CI terbukti jalan

### KOREKSI: 4 dari 5 "gap" Sesi 6 ternyata BUKAN gap
Sesi 6 menutup dengan 5 "gap yang tersisa". Sesi 7 mengujinya dengan
bukti, bukan asumsi - dan 4 dari 5 ternyata SALAH:

| Klaim Sesi 6 | Status setelah audit | Bukti |
|---|---|---|
| Thumbnail template = placeholder | **BUKAN GAP** | `MiniTemplatePreview` sudah merender; terukur 8-12 warna per kartu, ada SVG, tak ada gambar rusak |
| Auto-Generate belum diuji e2e | **BUKAN GAP** | `verifikasi-auto-generate.mjs` sudah menguji dengan mock berisi tabel, grafik, diagram, dan blok asing yang dibuang |
| Gambar remote tak terunduh | **BUKAN GAP** | `exporter.ts` sudah punya `urlKeDataUrl()` (fetch + data-URL) dengan fallback `null` saat gagal; dipakai di 2 jalur ekspor |
| Workflow CI belum pernah jalan | **BUKAN GAP** | YAML valid, 3 job, semua skrip yang dirujuk ADA di repo |
| Ukuran font kode masih kecil | **BUKAN GAP** | 18 pt terukur 27 px pada render 1440 px (ambang nyaman 24 px) - NYAMAN |

Pelajaran: daftar "yang tersisa" harus diuji sebelum dilaporkan. Empat
dari lima klaim itu keliru, dan kalau dilaporkan apa adanya, user akan
membuang waktu mengerjakan sesuatu yang sudah beres.

### Yang benar-benar tersisa: 1 hal (butuh keputusan Principal)
**Belum ada git remote** - 11 commit lokal belum didorong ke GitHub, jadi
workflow CI mustahil dijalankan. Ini butuh URL repo dari Principal:

```bash
git remote add origin <url-github>
git push -u origin master
```

Sambil menunggu, gap ini ditutup sebagian: `scripts/simulasi-ci.mjs`
(`pnpm verify:ci`) menjalankan SELURUH langkah CI secara lokal.

### Bukti CI jalan: simulasi lokal
`scripts/simulasi-ci.mjs` - 34 pemeriksaan, semua lulus:
- 0. Workflow: YAML valid, 3 job punya run & runs-on, semua skrip yang
  dirujuk ADA, semua skrip npm terdaftar.
- 1. job `check`: 3 typecheck + vitest + vite build (4,7 / 1,7 / 2,1 /
  2,9 / 58,0 dtk).
- 2. job `generators`: 8 skrip (6,6 / 2,5 / 1,8 / 2,5 / 0,1 / 0,1 /
  14,9 / 72,3 dtk).
- 3. job `deckcraft`: 3 skrip (0,4 / 0,5 / 0,4 dtk).
- 4. git remote: dilaporkan (bukan kegagalan build).

**Bug yang ditemukan saat membuat simulasi:** `cmd.exe /c` memecah path
berspasi - repo ini di `C:\MRP\proyek 2026\...`, jadi `cmd.exe` memotongnya
jadi `C:\MRP\proyek` dan perintah gagal. Ini bug yang SAMA seperti yang
ditemukan di generator Mermaid. Perbaikan: jalankan entry point
JavaScript-nya langsung dengan Node (`typescript/lib/tsc.js`,
`vitest/vitest.mjs`, `vite/bin/vite.js`), tanpa `.cmd` dan tanpa shell.

### CI diperbaiki: skrip baru ikut jalan
Ternyata `verifikasi-mermaid.mjs` & `audit-isi-generator-node.mjs` TIDAK
pernah dijalankan di CI - skripnya ada tapi tak dirujuk workflow. Sekarang
keduanya dijalankan, plus langkah "Workflow memeriksa dirinya sendiri"
(`simulasi-ci.mjs --hanya-validasi`) supaya runner juga memverifikasi bahwa
workflow-nya valid dan skrip yang dirujuk ada.

### Audit font kode (bukti, bukan perasaan)
`scripts/audit-font-kode.mjs` merender blok kode pada 5 ukuran lalu
mengukur tinggi glyph dari PNG hasil render (decode PNG sendiri, tanpa
dependensi):

| Ukuran | Tinggi glyph @1440px | Height baris terukur | Penilaian |
|---|---|---|---|
| 14 pt | 21,0 px | 23 px | kurang |
| 16 pt | 24,0 px | 27 px | nyaman |
| **18 pt** | **27,0 px** | **24 px** | **nyaman** |
| 20 pt | 30,0 px | 26 px | nyaman |
| 22 pt | 33,0 px | 29 px | nyaman |

18 pt (ukuran sekarang) lolos ambang 24 px. Render ada di
`testrun-font/` untuk dilihat.

### Skrip verifikasi baru
- `scripts/simulasi-ci.mjs` (34) - menjalankan seluruh langkah CI secara
  lokal. Mode `--hanya-validasi` untuk runner CI.
- `scripts/audit-gap-beser.mjs` (33) - mengunci kenyataan di atas: workflow
  CI valid, skrip yang dirujuk ada, ekspor gambar remote ada fallback
  offline, generator Node mengembalikan buffer & tak menulis file liar.
  Masukkan ke suite supaya klaim yang keliru tak terulang.
- `scripts/audit-font-kode.mjs` -ukur keterbacaan font kode dari render
  nyata.

## Status verifikasi terakhir (Sesi 7)

`pnpm verify:all` -> **387 pemeriksaan lulus, 0 gagal**, exit 0
- typecheck browser + server + node: 0 error
- 72 unit test lulus
- Audit gap: 33 pemeriksaan
- Negative test: 13 kasus, semuanya terbukti menangkap regresi
- 30 langkah suite terdaftar (dicek penjaga salah ketik)
- `pnpm verify:ci` -> 34 pemeriksaan, semua lulus (workflow CI terbukti
  akan jalan begitu repo di-push)