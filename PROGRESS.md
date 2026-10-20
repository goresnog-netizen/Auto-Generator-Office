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

## Yang belum dikerjakan

- Tidak ada perubahan pada `src/generators/` (sudah di-quarantine, bukan
  jalur live). `PPTXGenerator.generate` masih stub — jalur itu tidak dipakai
  UI browser.
- `src/lib/exporter.ts` (pptxgenjs) dibiarkan utuh sebagai jalur ekspor cepat
  di browser. DeckCraft adalah jalur premium, bukan penggantinya.
- Belum ada CI workflow untuk menjalankan `verify:all` di GitHub Actions.
- Auto-Generate **mengganti** isi kanvas, belum ada mode "tambahkan".
- Plugin DSH red-team belum diuji dengan workspace yang benar-benar punya
  perubahan git (NitZ-909 belum git repo) — `git status` kosong.

## Langkah berikutnya (kandidat)

1. `git init` untuk NitZ-909 + commit, supaya red-team punya diff nyata.
2. Workflow GitHub Actions yang menjalankan `verify:all`.
3. Auto-Generate mode "tambahkan" (append) dan undo.
4. Ekspor PDF/GIF lewat DeckCraft (`file.export` mendukung keduanya).
5. Dukungan font monospace untuk blok kode.
6. Render pratinjau semua slide (filmstrip) di DeckCraft Studio.
