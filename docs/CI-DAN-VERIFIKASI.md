# CI & Sistem Verifikasi

Dokumen ini menjelaskan cara proyek diverifikasi secara otomatis, dan
kenapa setiap pemeriksaan ada.

---

## GitHub Actions

Workflow: `.github/workflows/ci.yml`

Terd-trigger saat push ke `main`/`master`, pull request, dan manual
(`workflow_dispatch`). Eksekusi lama dibatalkan otomatis kalau ada commit
baru di branch yang sama (`concurrency`).

### Job `check` (ubuntu-latest)

| Langkah | Perintah |
|---|---|
| Typecheck browser | `pnpm exec tsc --noEmit` |
| Typecheck server | `pnpm exec tsc --noEmit -p tsconfig.server.json` |
| Typecheck node | `pnpm exec tsc --noEmit -p tsconfig.node.json` |
| Unit test | `pnpm exec vitest run --reporter=dot` |
| Build | `pnpm exec vite build` |

Tiga typecheck terpisah karena tiga lingkungan berbeda: bundel browser
tak boleh punya kode Node, `server/` memakai API Node, dan
`src/generators/` jalan di Node tapi ditulis dalam TypeScript.

### Job `generators` (ubuntu-latest)

Menjalankan skrip yang menulis berkas sungguhan dan memeriksa isinya:

- `scripts/verifikasi-generators.mjs` — struktur + isi docx/xlsx/pdf/pptx.
- `scripts/audit-isi-generator.mjs` — isi dokumen dibaca & dicek kata kuncinya.
- `scripts/verifikasi-pdf-gambar.mjs` — gambar benar-benar tertanam di PDF.
- `scripts/verifikasi-fitur-baru.mjs` — struktur fitur (statis, tanpa browser).
- `scripts/verifikasi-fitur-deckcraft.mjs` — font kode, filmstrip, ekspor
  format, dan mirror Vercel (termasuk cek BOM).
- `scripts/audit-negative-test.mjs` — **negative test** (lihat bawah).

Job ini tak butuh binary DeckCraft, jadi aman di runner Linux.

### Job `deckcraft` (windows-latest, `continue-on-error`)

Membandingkan id perintah yang dikirim ke engine dengan engine aslinya:

1. `pnpm vendor:deckcraft` — mengunduh binary rilis resmi + verifikasi
   checksum SHA-256 dari metadata GitHub.
2. `node scripts/verifikasi-perintah.mjs` — cek id & parameter perintah.
3. `node --experimental-strip-types scripts/verify-deckcraft.mts` — uji
   end-to-end: content model → perintah → deck → PPTX → PNG per slide.
4. `node --experimental-strip-types scripts/verifikasi-kode-deckcraft.mts` —
   blok kode benar-benar ber-font monospace, dan paragraf biasa TIDAK ikut
   kena.

`continue-on-error: true` karena job ini bergantung pada ketersediaan
rilis binary di jaringan; kegagalan di sini tak harus memblokir PR.

---

## Negative test — bukti bahwa skrip verifikasi berguna

Skrip verifikasi bisa saja formalitas yang selalu hijau. `scripts/audit-negative-test.mjs`
menjawab itu secara empiris: ia **balik satu bug yang pernah ada**, menjalankan
skrip verifikasi, memastikan skrip itu **GAGAL** (exit ≠ 0), lalu mengembalikan
berkas ke keadaan semula.

| # | Bug yang dibalik |Efek | Tertangkap? |
|---|---|---|---|
| A | PDF: nomor halaman ditulis di `page.height - 50` (di bawah `maxY`) | pdfkit menambah halaman kosong; 2 halaman → 4 | ✅ 2 pemeriksaan GAGAL |
| B | XLSX: nilai sel jadi objek `{text, font}` | exceljs menulis JSON mentah; isi hilang | ✅ 1 pemeriksaan GAGAL |
| C | DOCX: entri numbering "tanpa urutan" tak terdaftar | docx menulis `numId="{list-tanpa-urutan-0}"`; .docx rusak | ✅ 1 pemeriksaan GAGAL |
| D | PDF: `muatGambar` selalu mengembalikan `null` | gambar tak pernah tertanam | ✅ 3 pemeriksaan GAGAL |
| G | Mirror Vercel: `vite.config.ts` meng-import `server/deckcraft-api.ts` statis | build Vercel gagal ("cannot find module") | ✅ 1 pemeriksaan GAGAL |
| H | Konverter: blok kode tak mengirim `format.font` | kode dirender dengan font body, bukan monospace | ✅ 1 pemeriksaan GAGAL |
| I | Mirror Vercel: `package.json` diawali BOM | PostCSS/Vite gagal parse JSON → build pecah | ✅ 1 pemeriksaan GAGAL |
| J | Generator diagram membuang `metadata` fallback | pesan "Chrome tak ada" / "sintaks salah" hilang total | ✅ 2 pemeriksaan GAGAL |
| E | Setelah semua bug dikembalikan, skrip harus lulus lagi | sanity check | ✅ exit 0 |
| F | Idem, untuk skrip gambar PDF | sanity check | ✅ exit 0 |
| K | Idem, untuk skrip fitur DeckCraft | sanity check | ✅ exit 0 |
| L | Idem, untuk skrip Mermaid | sanity check | ✅ exit 0 |

Bug A–C berasal dari sesi sebelumnya; D dari sesi 3; G–I dari sesi 4;
J dari sesi 5.

> **Penting:** regex transformasi pada negative test harus dibuat *longgar*
> (spasi fleksibel). Dua kasus sempat gagal karena regex-nya terlalu ketat
> dan tak cocok setelah format kode berubah - negative test yang tak bisa
> mendeteksi regresi lebih berbahaya daripada tak ada, karena ia memberi rasa
> aman yang palsu. Karena itu `ujiRegresi` gagal loudly ("transformasi tak
> mengubah berkas (test tak valid)") kalau transformasinya tak mengubah
> apa pun.

Detail penting: skrip retry **satu kali** kalau gagal, TETAPI hanya kalau
output-nya tak mengandung `[GAGAL]`. Render Mermaid butuh Chrome dan bisa
gagal sesaat; kegagalan itu bukan regresi. Sebaliknya, regresi yang sengaja
dibuat selalu mencetak `[GAGAL]`, jadi tak pernah ter-retry.

---

## Tiga lapis verifikasi generator

1. **`verifikasi-generators.mjs` (33)** — struktur berkas + validitas:
   - ZIP untuk docx/xlsx/pptx, header `%PDF` + `%%EOF` untuk PDF;
   - **ekstraksi teks PDF** (inflate Flate + decode array `TJ` hex) supaya
     isi dokumen bisa dibaca, bukan cuma header/footer;
   - konsistensi nomor halaman vs jumlah halaman nyata.

2. **`audit-isi-generator.mjs` (16)** — isi dokumen dibaca & diperiksa
   kata kuncinya ("Laporan Uji", "Poin satu", "nilai 1", "const a = 1").

3. **`audit-negative-test.mjs` (6)** — negative test seperti di atas.

---

## Skrip lain

| Skrip | Fungsi |
|---|---|
| `verifikasi-perintah.mjs` | id & parameter perintah vs engine DeckCraft asli |
| `verifikasi-pptx.mjs` | isi PPTX hasil DeckCraft: slide, tabel, grafik, SmartArt |
| `verifikasi-pdf-gambar.mjs` | gambar tertanam di PDF (XObject `/Subtype /Image`) |
| `verifikasi-fitur-baru.mjs` | struktur fitur baru (statis) |
| `verifikasi-fitur-deckcraft.mjs` | font kode, filmstrip, ekspor format, mirror Vercel |
| `verifikasi-kode-deckcraft.mts` | blok kode ber-font monospace (binary DeckCraft asli) |
| `verifikasi-api-filmstrip.mjs` | filmstrip + ekspor PDF/GIF lewat HTTP |
| erifikasi-ui-filmstrip.mjs | filmstrip di browser (thumbnail ter-render) |
| verifikasi-mermaid.mjs | render Mermaid beneran (bukan fallback .mmd) |
| pasang-mermaid.ps1 | pasang mermaid-cli + deteksi Chrome |
| `verifikasi-kaca.mjs` | efek kaca terlihat + kontras WCAG |
| `verifikasi-audit-glass.mjs` | kontras, dead CSS, fallback tanpa blur |
| `verifikasi-css.mjs` | selector mati + painting order + fallback |
| `verifikasi-noise.mjs` | noise overlay benar-benar terlihat (delta piksel) |
| `verifikasi-backdrop.mjs` | arsitektur backdrop root (MDN) |
| `verifikasi-performa.mjs` | layer blur, area tercakup, animasi aurora |
| `verifikasi-auto-generate.mjs` | Auto-Generate end-to-end (provider di-mock) |
| `verifikasi-konkurensi.mjs` | build/preview/export tak saling menimpa |
| `verifikasi-backdrop`, `audit-isi`, `verify-deckcraft.mts` | bridge DeckCraft end-to-end |

Suite gabungan: `pnpm verify:all` (= `scripts/verifikasi-semua.ps1`).

---

## Tiga jebakan teknis yang sudah ditangani

### 1. Encoding `.ps1` di Windows PowerShell 5

Windows PowerShell 5 membaca berkas `.ps1` **tanpa BOM** sebagai ANSI
(Windows-1252). Karakter em-dash (`—`, U+2014) menjadi byte `0x94`, yang
PowerShell 5 anggap sebagai smart-quote penutup string. Gejalanya:

```
The string is missing the terminator: "
```

`scripts/perbaiki-encoding.ps1` menormalkan semua `.ps1` di `scripts/` jadi
ASCII + BOM, sehingga skrip jalan di PowerShell 5 maupun 7.

### 2. `Expand-Archive` gagal di path 8.3

`os.tmpdir()` bisa mengembalikan path 8.3 (`C:\Users\BROKEN~1\...`) yang
tak bisa dibuka PowerShell. Karena itu `scripts/zip-util.mjs` —
ekstraktor ZIP Node murni (central directory + inflateRaw) — menggantikan
`Expand-Archive` di semua skrip. Sekaligus tidak bergantung pada
`powershell.exe` tersedia di PATH.

### 3. BOM di JSON yang ditulis PowerShell 5

`Set-Content -Encoding UTF8` di Windows PowerShell 5 menulis **BOM**. Kalau
berkas JSON itu dibaca Vite/PostCSS, hasilnya:

```
[Failed to load PostCSS config: SyntaxError: Unexpected token '\uFEFF']
```

Perbaikannya: `[System.IO.File]::WriteAllText($path, $json, (New-Object
System.Text.UTF8Encoding($false)))`. `scripts/verifikasi-fitur-deckcraft.mjs`
memeriksa 3 byte pertama `package.json` mirror sebagai penjaga.

---

## Catatan untuk skrip berbasis browser

Skrip UI berbasis Chrome DevTools Protocol **harus menunggu elemen muncul**,
bukan memakai jeda tetap. Versi pertama `verifikasi-ui-filmstrip.mjs`
memakai `sleep(6000)` dan gagal **semua** pemeriksaan padahal tampilannya
benar — panel React belum selesai mount.

Polanya sekarang:

```js
async function tungguPunsur(kueri, maksMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < maksMs) {
    if (await evalJs(`!!document.querySelector(${JSON.stringify(kueri)})`)) return true;
    await sleep(500);
  }
  return false;
}
```

Untuk thumbnail filmstrip, jeda tetap tak cukup: elemennya ada sebelum
gambarnya selesai di-decode. Yang diuji adalah `naturalWidth > 0`, bukan
keberadaan elemen.

---

## Menjalankan sendiri

```bash
pnpm verify:all          # suite penuh (butuh `pnpm dev` di port 5180)
pnpm verify:generators   # generator saja
pnpm audit:negative      # negative test saja
pnpm verify:pdf-image    # gambar PDF saja
pnpm verify:fitur-baru   # pemeriksaan statis fitur baru
pnpm verify:fitur-deckcraft   # font kode, filmstrip, ekspor, mirror Vercel
pnpm verify:deckcraft:kode     # blok kode monospace (butuh binary DeckCraft)
pnpm verify:deckcraft:filmstrip # filmstrip + PDF/GIF lewat HTTP
```

Untuk pemeriksaan berbasis browser, jalankan dulu server dev:

```bash
pnpm dev --port 5180
```