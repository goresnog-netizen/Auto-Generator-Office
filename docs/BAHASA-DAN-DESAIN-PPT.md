# Bahasa & Desain Presentasi

Dua lapis yang membuat hasil NitZ-909 layak diserahkan tanpa disunting ulang:

| Lapis | Modul | Mengatur |
| --- | --- | --- |
| Bahasa | `src/lib/bahasa.ts` | ragam, struktur, kalimat, tata tulis, mutu teks |
| Desain | `src/lib/ppt-desain.ts` | tema, latar, tipografi, layout, infografis slide |

Keduanya berjalan tanpa jaringan dan tanpa AI tambahan: aturan bahasa masuk
ke *prompt*, pemeriksaan mutu dijalankan deterministik setelahnya.

---

## 1. Spesifikasi bahasa (`bahasa.ts`)

### Ragam dokumen

`PROFIL_RAGAM` memuat tujuh ragam. Setiap ragam punya kerangka baku dan batas
panjang sendiri — bukan sekadar "nada" yang samar.

| Ragam | Batas kalimat | Butir/daftar | Kata/butir |
| --- | --- | --- | --- |
| `laporan` | 25 kata | 7 | 22 |
| `ringkasan` | 22 kata | 5 | 18 |
| `presentasi` | 18 kata | 5 | 12 |
| `proposal` | 25 kata | 7 | 22 |
| `analisis` | 25 kata | 7 | 20 |
| `notulen` | 22 kata | 8 | 18 |
| `sop` | 20 kata | 12 | 16 |

### Yang masuk ke prompt

`bangunPanduanBahasa({ ragam, untukSlide, audiens, ringkas })` menyusun blok
instruksi berisi:

1. **Peran** — penyunting dokumen profesional.
2. **Ragam** — tujuan + struktur baku berurutan.
3. **Aturan kalimat** — batas kata, satu gagasan, kalimat aktif, panjang
   paragraf, nada.
4. **Tata tulis PUEBI** — angka `1.250.000`, desimal `12,5`, rupiah
   `Rp1.250.000`, persen `12,5%`, satuan berspasi, tanggal `6 November 2026`,
   rentang `2024–2026`.
5. **Aturan slide** (bila `untukSlide`) — judul = pernyataan hasil, maks 5
   butir, maks 12 kata/butir, tanpa paragraf.
6. **Larangan** — frasa klise, kata tidak baku, kata percakapan, klaim
   superlatif tanpa angka.
7. **Pola tiap bagian** — klaim → bukti/angka → implikasi.

Dipakai oleh dua jalur:

- `auto-generate.ts` — `systemPrompt()` menyusun panduan lalu menambahkan
  skema JSON. Aturan bahasa dan kontrak keluaran sengaja dipisah agar bisa
  diuji sendiri-sendiri.
- `ai.ts` — `generateDraft()` (Draft AI seluruh dokumen).

### Perbaikan otomatis

`perbaikiEjaan()` hanya menyentuh hal yang tidak ambigu:

- kata tidak baku (`dimana → di mana`, `resiko → risiko`, `praktek → praktik`);
- spasi ganda, spasi sebelum tanda baca, spasi setelah koma/titik dua;
- `Rp 1.250.000 → Rp1.250.000`, `87 % → 87%`;
- `... → …`, `2024-2026 → 2024–2026`;
- **URL dilewati utuh** agar tautan tidak rusak.

`rapikanEjaanBlok()` menerapkannya ke heading, paragraf, daftar, tabel,
keterangan gambar, dan label grafik. Blok `code` dan `diagram` **tidak**
disentuh karena perubahan ejaan di sana merusak sintaks.

### Pemeriksaan mutu

`periksaBahasa(blocks, { ragam, untukSlide })` mengembalikan:

```ts
{
  skor: number,          // 0–100
  temuan: TemuanBahasa[],
  jumlahKata: number,
  ringkas: string,       // siap ditampilkan di UI
}
```

Kode temuan dan bobotnya:

| Kode | Level | Memeriksa |
| --- | --- | --- |
| `kalimat-panjang` | sedang | kalimat melewati batas ragam |
| `paragraf-panjang` / `paragraf-padat` | sedang / ringan | paragraf > 160 kata / > 6 kalimat |
| `kata-tidak-baku` | sedang | kata di luar PUEBI |
| `kata-informal` | kritis | `banget`, `gimana`, `nggak`, `bikin` |
| `frasa-klise` | ringan | pembuka klise |
| `klaim-tanpa-angka` | ringan | "paling efektif" tanpa data |
| `butir-panjang` / `butir-berlebih` | sedang | butir > batas kata / daftar > batas butir |
| `judul-panjang` | ringan | judul > 10 kata (slide) / 14 kata (dokumen) |
| `pasif-berantai` | ringan | ≥ 3 frasa "oleh" dalam satu blok |
| `format-mata-uang` / `format-persen` | ringan | `Rp 1.000`, `50 %` |
| `spasi-tanda-baca` / `spasi-ganda` | ringan | spasi salah tempat |

Skor = `100 − (8 × kritis + 4 × sedang + 1 × ringan)`, dijepit ke 0–100.
`labelMutu(skor)` memberi sebutan: *Sangat baik* (≥90), *Baik* (≥75),
*Cukup* (≥60), *Perlu disunting* (≥40), *Belum layak* (<40).

Skor ini muncul di panel Auto-Generate setelah dokumen tersusun.

---

## 2. Sistem desain presentasi (`ppt-desain.ts`)

### Sembilan tema

| id | Nama | Mode | Cocok untuk |
| --- | --- | --- | --- |
| `swiss` | Swiss Editorial | terang | laporan, analisis, akademik |
| `navy` | Navy Korporat | gelap | paparan direksi, strategi |
| `sage` | Sage Eksekutif | terang | institusi, laporan resmi |
| `graphite` | Grafik Teknologi | gelap | produk, data, teknologi |
| `azure` | Azure Data | terang | dasbor, laporan data |
| `ivory` | Gading Konsultan | terang | proposal, studi kelayakan |
| `crimson` | Krimson Berani | terang | kampanye, penjualan |
| `olive` | Olive Lapangan | gelap | laporan lapangan/operasi |
| `mono` | Monokrom Cetak | terang | dokumen cetak/fotokopi |

Setiap tema menetapkan:

- **palet** — `latar`, `latarAlt`, `permukaan`, `primer`, `aksen`, `teks`,
  `teksLembut`, `garis`, `pita`;
- **tipografi** — font judul, isi, angka, dan mono;
- **pola latar** — `grid`, `mesh`, `pita`, `blok`, `diagonal`, `polos`;
- **bentuk aksen** — penanda visual khas tema.

`getTemaPpt(id)` selalu mengembalikan tema valid (jatuh ke `swiss`), sehingga
id lama atau salah tidak pernah membuat ekspor gagal.

### Layout otomatis

`susunDeckPpt(pptx, { judul, blocks, sumber, tema, meta, gambarSampul })`
membaca `ContentBlock[]` lalu memilih layout:

| Isi | Menjadi |
| --- | --- |
| — | sampul (kicker organisasi, judul, subjudul, tanggal) |
| ≥ 2 bagian | agenda dua kolom bernomor |
| heading level 1 (bagian dengan >1 subbagian) | pemisah bagian bernomor raksasa |
| heading level 2 | slide isi |
| daftar 3–4 butir berangka | **slide KPI** — kartu angka besar |
| daftar berurut 3–5 butir pendek | **slide proses** — chevron bernomor |
| tabel | tabel berkepala gelap, baris zebra, lebar kolom proporsional (maks 9 baris/slide) |
| grafik | grafik native + data label + legenda bawah |
| gambar data-URL | gambar *contain* + keterangan |
| kode / diagram non-alur | blok monospace |
| daftar sumber | slide rujukan |
| — | penutup + tindak lanjut |

Aturan yang dijaga:

- judul dokumen tidak diulang di slide pertama setelah sampul — isinya
  digabung ke subbagian berikutnya, atau diberi judul "Ringkasan";
- kaki slide selalu berisi **judul dokumen**, bukan judul slide;
- kicker hanya muncul bila bagian punya nama sendiri;
- teks panjang dipotong ke dua kolom, bukan dikecilkan sampai tak terbaca.

### Gradien latar

pptxgenjs tidak punya API gradien: `slide.background` hanya menerima warna
solid atau gambar. Karena itu gradien dibangkitkan sebagai citra
(`gradienLatar`) lalu dipasang sebagai latar slide — hasilnya gradien nyata
di PowerPoint, bukan tumpukan bentuk yang menyerupainya.

- Definisi per tema ada di `GRADIEN_TEMA` (`dari`, `ke`, `sudut`, `jenis`).
  Tema `swiss` dan `mono` sengaja tanpa gradien karena identitasnya "putih
  bersih".
- Citra dibuat 1280×720 JPEG kualitas 0,9 (≈11 KB), di-cache per parameter
  sehingga satu deck hanya membangkitkan satu citra per tema.
- `path: "preencoded.jpeg"` ikut dikirim ke pptxgenjs. Tanpa itu, pptxgenjs
  menamai berkas `.png` padahal isinya JPEG — ekstensi tidak cocok dan
  PowerPoint bisa memunculkan peringatan "perbaiki konten".
- Slide berisi gambar/diagram memakai latar **solid** (`{ solid: true }`):
  citra diagram sudah membawa latar sendiri, gradien di belakangnya justru
  terlihat sebagai sambungan.
- Di lingkungan tanpa DOM (unit test), `gradienLatar` mengembalikan `null`
  dan latar otomatis jatuh ke warna solid.

### Diagram Mermaid sebagai gambar

Sebelumnya blok diagram tidak pernah menjadi gambar. Sekarang
`src/lib/mermaid-gambar.ts` merender Mermaid di browser lalu mengubah SVG
hasilnya menjadi PNG 2400 px yang disisipkan ke slide.

Tiga hal yang menentukan berhasil/tidaknya rasterisasi:

1. **`htmlLabels: false`** — Mermaid v10 memakai `<foreignObject>` untuk label.
   Chrome menolak menggambar `<foreignObject>` saat SVG dimuat sebagai
   `Image`, dan hasilnya kotak kosong tanpa error. Dengan `<text>` biasa,
   rasterisasi berjalan.
2. **Data URL, bukan blob URL** — CSP aplikasi hanya mengizinkan
   `img-src 'self' data: https:`. Blob URL ditolak browser, dan kegagalannya
   hanya terlihat sebagai peringatan konsol.
3. **Ukuran eksplisit** — SVG Mermaid membawa `max-width` + `viewBox`, bukan
   piksel. Tanpa `width`/`height` eksplisit, `Image` bisa melaporkan 0×0.

Warna diagram mengikuti tema deck (`themeVariables`): simpul memakai tint
aksen, garis memakai `teksLembut`, latar kanvas = latar slide. Skala
pembesaran maksimum 8× karena sumbernya vektor — memperbesar kanvas tidak
mengurangi ketajaman.

Bila render gagal (diagram tidak sah), `susunDeckPpt` tetap memakai fallback
lama: rantai `A --> B --> C` menjadi slide proses, selain itu teks sumber.

### Rasio gambar

`dimensiDataUrl()` membaca ukuran PNG/JPEG/GIF langsung dari header data URL.
Bingkai gambar dihitung sendiri (bukan `sizing: contain`, yang tidak selalu
dihormati saat x/y/w/h ikut diisi) sehingga gambar tidak pernah gepeng dan
selalu berada di tengah kotak.

### Primitif infografis

Diekspor untuk dipakai ulang: `slideKpi`, `slideTabel`, `slideGrafik`,
`slideProses`, `slideKutipan`. Pembaca angka `uraiAngka("Realisasi: 81%")`
memisahkan nilai dan label — inilah yang mengubah butir biasa menjadi kartu
KPI tanpa campur tangan pengguna.

### Menambah tema baru

Tambahkan satu objek ke `TEMA_PPT` dengan palet 6 digit heksadesimal **tanpa**
tanda `#`, lalu pastikan `npx tsc --noEmit` dan
`npx vitest run src/lib/ppt-desain.test.ts` lulus. Uji otomatis memeriksa
format warna, keunikan id, dan apakah deck benar-benar bisa ditulis jadi
berkas `.pptx`.

---

## 3. Pemakaian di aplikasi

- **Panel Ekspor → Tema presentasi**: pilih tema; pilihan disimpan di
  `localStorage` (`nitz909-tema-ppt`).
- **Ekspor PPT**: `eksporDokumen(..., { temaPpt })` meneruskan tema ke
  `susunDeckPpt`.
- **Penanda lama tetap dihormati**: blok gambar ber-caption `TEMA-MILITER`
  otomatis memakai tema `olive` bila pengguna tidak memilih tema lain.

## 4. Batasan yang diketahui

- PptxGenJS tidak mendukung gradien latar; kedalaman visual dibuat dari
  lapisan bentuk dengan transparansi.
- Diagram Mermaid dirender jadi PNG saat ekspor PPT. Bila render gagal
  (diagram tidak sah, Mermaid tak termuat), rantai `A --> B --> C`
  diterjemahkan menjadi slide proses, selain itu ditampilkan sebagai teks.
- Gradien latar adalah citra JPEG, bukan gradFill vektor: satu citra
  per slide (±11 KB). Untuk deck sangat panjang, biaya ini bertambah linear.
- Gambar dari URL remote diunduh lebih dulu; bila offline, keterangan gambar
  yang ditampilkan agar ekspor tetap berhasil.
- Pemeriksaan bahasa bersifat deterministik dan konservatif: ia menandai,
  bukan menulis ulang. Keputusan akhir tetap di tangan pengguna.
