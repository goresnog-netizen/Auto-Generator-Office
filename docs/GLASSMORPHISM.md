# Glassmorphism — Panduan Implementasi

Lapisan kaca NitZ-909 ada di `src/styles/glass.css`, dimuat **setelah**
`base.css` dan `index.css` (lihat `index.html`). Berkas dipisah supaya
gaya optik ini bisa dilacak dan dimatikan tanpa menyentuh gaya lain.

---

## Prinsip

Kaca bukan sekadar kotak semi transparan. Efeknya butuh tiga hal sekaligus:

1. **Warna-warna bergerak di belakang.** Tanpa ada yang colourful di bawah
   panel, `backdrop-filter: blur()` tidak punya apa pun untuk diburam —
   hasilnya hanya kotak abu-abu.
2. **Garis sorot di tepi.** Catching cahaya: `inset 0 1px 0` putih transparan
   di sisi atas, plus border tipis.
3. **Bayangan dua lapis.** Bayangan ambient (lembut) + bayangan kunci (tegas),
   supaya panel terlihat terangkat dari latar, bukan ditempel.

Ketiganya sudah diimplementasikan di `glass.css` dan diverifikasi secara
empiris oleh skrip verifikasi.

---

## Arsitektur backdrop root (bagian terpenting)

MDN mendefinisikan *backdrop root*: elemen yang menjadi batas bagi efek
`backdrop-filter`. Sebuah elemen menjadi backdrop root bila ia punya:

- `filter` selain `none`
- `opacity` < 1
- `mask` / `clip-path` besides `none`
- `backdrop-filter` besides `none`
- **`mix-blend-mode` besides `normal`**
- `will-change` salah satu dari di atas

Konsekuensinya: **blur sebuah panel hanya menjangkau piksel sampai backdrop
root terdekat.** Kalau mesh gradien dan `mix-blend-mode` berada di leluhur
yang sama, blur panel anak **tidak akan menjangkau mesh** — hasilnya kabut
dari warna datar, bukan dari gradient.

Struktur yang benar (dipakai di `glass.css`):

| Lapisan | Elemen | Sifat |
|---|---|---|
| Latar mesh | `body` | gradien radial 5 blob, `background-attachment: fixed` |
| Butiran | `.nitz-latar` | `feTurbulence` + `mix-blend-mode: overlay`, `position: fixed` |
| Aurora | `.nitz-aurora` | 2 blob bergerak, `filter: blur()`, animasi `transform` |
| Konten | `.nitz-app-root` | **transparan** — tidak menutupi mesh |

`body` tidak punya `mix-blend-mode`/`filter`, jadi blur panel benar-benar
menjangkau mesh. Butiran dipisah ke elemen tersendiri (bukan `::before` dari
root) supaya `mix-blend-mode`-nya tidak menjadikan root sebagai backdrop root.

Diverifikasi oleh `scripts/verifikasi-backdrop.mjs`:
- 0 elemen leluhur yang memblokir blur,
- piksel **berbeda** dengan/tanpa `backdrop-filter` (blur benar-benar jalan).

---

## Aurora: sapuan cahaya bergerak

Dua blob besar bergerak perlahan di atas mesh. Gunanya ada dua:

1. Warna jadi "hidup", bukan foto statis.
2. Panel-panel kaca selalu punya sesuatu yang bergerak untuk diburam.

**Kenapa `transform`, bukan `background-position`?** Animasi `transform`
dijalankan compositor (GPU); animasi `background-position` memicu repaint
tiap frame. Untuk "tanpa lag", `transform` adalah pilihan yang benar.

`will-change: transform` hanya dipasang pada 1 elemen, jadi biayanya
negligible. Aurora dimatikan otomatis saat `prefers-reduced-motion: reduce`.

---

## Sheen tepi

Sapuan cahaya tipis di tepi atas panel — ciri "kaca premium" (Apple
visionOS, Fluent 2). Diterapkan lewat `background-image` **di atas** warna
tint (bukan shorthand `background`), agar tint tetap bisa diatur terpisah:

```css
.kartu-kaca {
  background-color: var(--glass-bg) !important;
  background-image: var(--glass-sheen) !important;
}
```

---

## Token

Semua nilai warna diturunkan dari token yang sudah ada (`tokens.css`) lewat
`color-mix()`, jadi tema terang/gelap dan varian warna (hutan/biru/senja/toska)
ikut otomatis.

| Token | Gelap | Terang | Guna |
|---|---|---|---|
| `--glass-bg` | surface 38% | white 52% | Isi panel |
| `--glass-bg-strong` | surface-2 62% | white 74% | Panel pekat (input, dialog) |
| `--glass-bg-subtle` | surface 26% | white 38% | Panel tipis (segmen, chip) |
| `--glass-border` | white 22% + border | white 82% + border | Tepi |
| `--glass-highlight` | inset white 30% | inset white 96% | Sorot tepi atas |
| `--glass-sheen` | gradien 115° | idem | Sapuan cahaya tepi |
| `--glass-shadow` | 2 lapis | 2 lapis | Bayangan |

Persentase sengaja rendah (26–62%) agar isi di belakang benar-benar terlihat
**through** panel. Kalau dinaikkan ke 80%+, efek kaca hilang dan panel jadi
kartu biasa.

---

## Lapisan yang memakai kaca

| Selektor | Elemen | Efek |
|---|---|---|
| `.nitz-app-root` | Latar aplikasi | Mesh gradien 5 blob + noise `feTurbulence` |
| `.nitz-header` | Kepala | Kaca tebal, blur 20px, menempel saat scroll |
| `.nitz-side` | Sidebar kiri/kanan | Kaca sedang, blur 16px |
| `.nitz-isi` | Area konten tengah | Lembar kaca + pseudo-lapis dalam |
| `.kartu-kaca`, `.dc-kartu` | Kartu | Kaca sedang, hover terangkat |
| `.kartu-template` | Kartu galeri | Kaca + hover lift 2px |
| `.dash-card`, `.stat-kotak` | Kartu statistik | Kaca tipis |
| `.segmen-*` | Segmented control | Kaca cekung |
| `input/select/textarea` | Form | Kaca pekat (harus tetap terbaca) |
| `[role="dialog"]` | Dialog/tur | Kaca tebal + bayangan besar |
| `.dc-lembar` | Lembar pratinjau | "Kaca di atas kaca" |

---

## Noise overlay

Butiran halus (`feTurbulence` + `mix-blend-mode: overlay`) di
`.nitz-app-root::before` inilah yang membuat kaca terasa seperti bahan nyata.
Tanpa itu, panel hanya terlihat buram.

```css
.nitz-app-root::before {
  position: fixed;
  inset: 0;
  z-index: -1;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,...feTurbulence...");
}
```

`z-index: -1` aman karena `.nitz-app-root` punya `isolation: isolate` —
tanpa itu, noise akan slipping ke belakang root dan tidak terlihat.

---

## Catatan performa

`backdrop-filter` memaksa browser membuat layer kompositing terpisah dan
mengblur semua yang ada di belakangnya.

Awalnya ada **215 elemen** (9,4%) yang memakai `backdrop-filter` — 58 kartu
galeri + 56 tombol + input + sidebar. Audit menemukan ini terlalu mahal:
blur di permukaan kecil tidak terlihat, tapi biaya kompositingnya nyata.

Setelah perbaikan: **47 elemen (2,1%)**. Yang dibuang:

- `.nitz-app-root button` — tombol kecil (26–40 px) tak punya area cukup
  untuk blur terlihat.
- `.kartu-template` — 58 kartu sekaligus, kartu selebar ~130 px.

`backdrop-filter` tetap dipakai pada permukaan besar yang memang menjadi
titik fokus: header, sidebar, area isi, kanvas, kartu besar, dialog.

Tambahan: `contain: paint` + `content-visibility: auto` pada
`.galeri-grid`, `.galeri-baris`, `.dc-daftar-slide` supaya repaint saat
scroll tidak menyentuh seluruh halaman.

---

## Hasil audit & perbaikannya

Audit adversaris (subagen + verifikasi empiris) menemukan beberapa masalah
nyata. Setiap klaim diverifikasi ulang lewat pengukuran di browser, bukan
diterima mentah — sebagian ternyata tidak terbukti.

| Temuan | Sebelum | Sesudah | Status |
|---|---|---|---|
| Tombol segmented aktif kontras | **1,16:1** ❌ | **9,62:1** ✅ | terbukti, diperbaiki |
| Garis warna kategori di kartu template | hilang (1px) | 4px + warna ✅ | terbukti, diperbaiki |
| Card yang jadi kaca | 1 dari 12 | 10 dari 12 ✅ | terbukti, diperbaiki |
| Elemen ber-`backdrop-filter` | 215 | 47 ✅ | terbukti, diperbaiki |
| Label kecil di bawah AA | klaim 3,08:1 | **terukur 7,35:1** ✅ | tidak terbukti |
| Noise overlay tak terlihat | klaim "tak pernah render" | **terlihat (delta 11,7%)** ✅ | tidak terbukti |
| Tanpa `backdrop-filter`, teks tak terbaca | klaim 1,43:1 | **terukur 7,35:1** ✅ | tidak terbukti |
| `prefers-contrast` tak berlaku di tema terang | benar | diperbaiki (diulang untuk `:root[data-theme="light"]`) | terbukti, diperbaiki |
| Tidak ada fallback `@supports` | benar | ditambahkan | terbukti, diperbaiki |

Pelajaran: **review yang menyimpulkan dari model CSS analitik bisa meleset.**
Kontras dihitung dari piksel nyata, bukan dari rgba yang diasumsikan.

### Kontras yang tetap dijaga

| Elemen | Kontras terukur | Ambang |
|---|---|---|
| `.segmen-* button.aktif` | 9,62:1 | 4,5 |
| `.dc-item-slide` | 14,39:1 | 4,5 |
| `.dc-pesan` / `.dash-label` | 7,35:1 | 4,5 |

---

## Aksesibilitas

- **Kontras** diverifikasi empiris: 7,35:1 – 14,39:1 (WCAG AA butuh 4,5:1).
- **`prefers-reduced-motion`**: transisi kartu, daftar slide, segmented
  control, dan tombol dimatikan; hover tidak lagi menggeser elemen.
- **`prefers-contrast: more`**: panel dibuat hampir pekat, border lebih tebal,
  dan tombol aktif tetap solid (bukan film) — semua ditхани untuk tema terang
  juga, karena `:root[data-theme="light"]` meng-specify lebih tinggi.
- **Fallback tanpa `backdrop-filter`**: blok `@supports not (...)` membuat
  panel hampir pekat, jadi teks tetap aman di Firefox lama / Safari lama.
- **Kaca di atas Fallback**: `Card` memakai token `--glass-*` langsung, bukan
  warna datar, sehingga seluruh app konsisten berlapis.

---

## Cara menguji

```powershell
pnpm dev
pnpm verify:glass
```

Skrip tersebut memeriksa:
- noise overlay benar-benar ter-render (perbandingan piksel dengan/tanpa),
- `backdrop-filter` aktif pada elemen yang diharapkan,
- rasio kontras teks terhadap latar efektif.

Untuk screenshot per tema:

```powershell
$env:TEMA='light'; node scripts/capture-tema.mjs
```
