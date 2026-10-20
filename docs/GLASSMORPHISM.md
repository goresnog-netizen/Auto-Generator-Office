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
empiris oleh `scripts/verifikasi-kaca.mjs`.

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
