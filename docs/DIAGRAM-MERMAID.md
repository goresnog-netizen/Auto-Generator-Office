# Diagram Mermaid — Pemasangan & Rendering

Dokumen ini menjelaskan cara membuat diagram Mermaid di NitZ-909 benar-benar
**ter-render** (jadi SVG/gambar), bukan sekadar menampilkan kode sumbernya.

---

## TL;DR

```bash
pnpm pasang:mermaid    # pasang mermaid-cli + deteksi Chrome
pnpm verify:mermaid   # bukti render benar-benar jalan (20 pemeriksaan)
```

Kalau `pnpm pasang:mermaid` sudah pernah dijalankan, `pnpm install` cukup.

---

## Kenapa perlu installing

Generator diagram (`src/generators/diagram.ts`) memanggil
`@mermaid-js/mermaid-cli` (perintah `mmdc`), yang memakai **Puppeteer** untuk
menjalankan Chrome headless. Tanpa itu, generator mengembalikan sumber
Mermaid mentah (`.mmd`) dan pesan: *"Mermaid CLI tidak tersedia"*.

---

## Yang dipasang, dan kenapa

| Komponen | Versi | Alasan |
|---|---|---|
| `@mermaid-js/mermaid-cli` | 12.0.0 | CLI render Mermaid → SVG/PNG/PDF |
| `puppeteer` | 25.15.0 | Menjalankan Chrome headless (peer dependency mmdc) |
| Node | ≥ 22.13.0 | Syarat mmdc 12 (Node 24.15 dipakai di sini) |

Keduanya **devDependency lokal**, bukan instalasi global. Alasannya:

- versinya terkunci di `package.json` + `pnpm-lock.yaml`, jadi bisa
  direproduksi di mesin lain dan di CI;
- tak mengotori `PATH` global pengguna;
- `pnpm install` di repo lain tak terpengaruh.

### Chrome TIDAK diunduh

Instalasi lokal memakai Chrome yang **sudah terpasang** di mesin:

```
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
%PROGRAMFILES%\Chromium\Application\chrome.exe
```

Skrip menulis hasilnya ke `config/puppeteer.config.json`:

```json
{
  "headless": true,
  "args": ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  "executablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
}
```

Berkas ini **tak di-commit** (path-nya spesifik mesin) dan di-regenerate oleh
`pnpm pasang:mermaid`.

Kalau Chrome tak ditemukan di mesin itu, Puppeteer memakai Chrome for Testing
miliknya sendiri (cache `~/.cache/puppeteer`) — proses tetap jalan.

`--no-sandbox` wajib di banyak CI/container.

---

## Yang dilakukan skrip `pasang-mermaid.ps1`

1. Cek versi Node (≥ 22.13.0) — gagal cepat dengan pesan jelas.
2. Cari Chrome di lokasi standar.
3. Pasang `mermaid-cli` + `puppeteer` dengan `PUPPETEER_SKIP_DOWNLOAD=1`
   → Chromium **tidak pernah** terunduh saat instalasi lokal.
4. Tulis `config/puppeteer.config.json` (tanpa BOM — JSON ber-BOM ditolak
   Node).
5. Uji render nyata: tulis flowchart `.mmd`, jalankan `mmdc`, pastikan SVG
   hasilnya berisi node diagram.

Kalau langkah 5 gagal, skrip berhenti dengan pesan error — bukan diam-diam
"berhasil".

---

## Pemakaian di generator

`src/generators/diagram.ts` mencari `mmdc` dalam urutan:

1. `node_modules/@mermaid-js/mermaid-cli/src/cli.js` — dipanggil **langsung
   dengan Node**.
2. `mmdc` di `PATH` (Linux/macOS).
3. `npx` + `npx-cli.js` (fallback; mengunduh paket, jadi lambat).

### Kenapa bukan `mmdc.cmd`

Di Windows, `node_modules/.bin/mmdc.cmd` adalah **batch file**. Dua
masalah:

- Node menolak extension `.cmd`/`.bat` lewat `execFile` tanpa shell demi
  keamanan (CVE-2024-27980).
- Memanggilnya lewat `cmd.exe /c` **memecah path yang mengandung spasi**.
  Repo ini ada di `C:\MRP\proyek 2026\NitZ-909` — `cmd.exe` memotongnya
  jadi `C:\MRP\proyek` dan perintah gagal dengan:
  `'C:\MRP\proyek' is not recognized as an internal or external command`.

`mmdc.cmd` hanyalah wrapper yang memanggil `src/cli.js` dengan Node. Jadi
modul memanggil `cli.js` itu langsung — **tanpa `.cmd`, tanpa shell**. Semua
argumen tetap array, jadi isi dokumen tak bisa menyuntik perintah.

### Validasi hasil

Setelah `mmdc` selesai, generator **memeriksa** bahwa:

- berkas keluaran benar-benar ada;
- isinya diawali `<svg`.

Tanpa cek ini, `readFile` bisa membaca berkas lain (mis. sumber `.mmd`) dan
hasilnya dilaporkan "sukses" padahal tak ada render sama sekali. Bug ini
pernah terjadi dan sekarang ditutup.

### Pesan fallback

Tiga sebab dibedakan, dan **metadata-nya diteruskan** ke hasil akhir:

| Keadaan | `metadata.fallback` | Pesan |
|---|---|---|
| mermaid-cli tak terpasang | `true` | "Jalankan `pnpm pasang:mermaid`" |
| Chrome tak ditemukan | `true` + `butuhChrome: true` | "Mermaid CLI berjalan tetapi Chrome tidak ditemukan" |
| Sintaks Mermaid salah | `true` + `salahSintaks: true` | "Mermaid CLI berjalan, tapi diagramnya gagal di-parse" |

> **Bug yang sudah diperbaiki:** `generate()` pernah membuang `metadata`
> saat menggabungkan hasil per-blok. Akibatnya semua pesan di atas hilang
> total — user cuma melihat diagram gagal tanpa tahu apa yang kurang.
> Negative test kasus J menjaga hal ini tak terjadi lagi.

---

## Verifikasi

```bash
pnpm verify:mermaid
```

20 pemeriksaan:

- mermaid-cli & puppeteer terpasang lokal + tercatat di `package.json`;
- `config/puppeteer.config.json` ada, headless, memakai `--no-sandbox`,
  `executablePath` benar-benar ada di disk;
- **flowchart, sequenceDiagram, dan pie benar-benar ter-render** jadi SVG
  berisi node;
- generator NitZ-909 mengembalikan SVG ter-render (bukan sumber `.mmd`);
- sintaks salah → jatuh ke fallback dengan pesan yang tepat (bukan
  "butuh Chrome").

Generator di-bundle dengan esbuild untuk pemanggilan ini (pola yang sama
seperti `scripts/verifikasi-generators.mjs`): `diagram.ts` mengimpor TIPE
dari `../types/index.ts`, dan Node ESM tak bisa menangani import itu saat
berkas TypeScript dimuat langsung.

---

## Di CI

`.github/workflows/ci.yml` job `generators` (ubuntu-latest) menjalankan
`pnpm install --frozen-lockfile`. Karena `pnpm-workspace.yaml` mengizinkan
build script `puppeteer`, Chromium terunduh di runner Linux (~200 MB,
di-cache runner). Runner Linux tak punya Chrome terpasang, jadi Puppeteer
memakai Chrome for Testing miliknya sendiri.

Di mesin lokal, `PUPPETEER_SKIP_DOWNLOAD=1` dipakai installer sehingga
Chromium tidak pernah masuk ke cache.

---

## Pemecahan masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| `'C:\MRP\proyek' is not recognized` | `cmd.exe /c` memecah path berspasi | Sudah diperbaiki: `cli.js` dipanggil langsung |
| `Could not find Chrome` | Tak ada Chrome & tak ada cache Puppeteer | `pnpm pasang:mermaid` |
| `Unexpected token '\uFEFF'` | `package.json`/`config` ber-BOM | Tulis tanpa BOM (`UTF8Encoding($false)`) |
| `No diagram type detected` | Sintaks Mermaid salah | Pesan fallback sudah menyebut ini |
| Render sangat lambat | Chrome unduh saat `pnpm install` | Set `PUPPETEER_SKIP_DOWNLOAD=1` |

---

## Related

- `docs/INTEGRASI-DECKCRAFT.md` — integrasi engine DeckCraft
- `docs/CI-DAN-VERIFIKASI.md` — sistem verifikasi & negative test
