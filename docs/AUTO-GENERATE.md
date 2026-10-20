# Auto-Generate — Dari Satu Prompt ke Dokumen Lengkap

**Status:** selesai & terverifikasi (9 pemeriksaan UI + 19 unit test)

---

## Apa ini

Niche asli NitZ-909: **buat dokumen dari nol hanya dari satu prompt**.

"Draft AI" yang sudah ada hanya menulis ulang dokumen yang sudah ada di
kanvas. Auto-Generate berbeda:

| | Draft AI | Auto-Generate |
|---|---|---|
| Masukan | Kanvas yang sudah terisi | Satu prompt |
| Keluaran | Blok `heading`/`paragraph`/`list` saja | Blok lengkap + tabel + grafik + diagram |
| Wujud | Mengganti isi kanvas | Dokumen baru dari nol |
| Tujuan | Merapikan | Membuat |

Karena Auto-Generate boleh menghasilkan tabel dan grafik, hasilnya bisa
langsung diekspor jadi **deck DeckCraft** yang kaya — bukan teks polos.

---

## Pakai

Sidebar kanan → panel **Auto-Generate**:

1. Tulis prompt (mis. *"Buat proposal proyek transformasi digital untuk
   instansi pemerintah, fokus pada metodologi, anggaran, dan risiko."*)
2. Pilih **Gaya**: Laporan lengkap / Ringkasan eksekutif / Materi presentasi /
   Proposal / Analisis data
3. Pilih **Audiens** (opsional) —elnama memengaruhi nada & tingkat detail
4. Atur **Jumlah bagian** (3–8)
5. Centang **Sertakan tabel, grafik & diagram** (matikan untuk teks saja)
6. **Susun Dokumen**

Hasil langsung mengisi kanvas dan mengganti judul dokumen.

---

## Yang membedakan dari "cukup pakai AI"

### 1. Skema blok lengkap

Model boleh mengembalikan `table`, `chart`, dan `diagram` (mermaid) — bukan
cuma teks. Ini yang membuat hasil auto-generate bisa jadi deck DeckCraft
dengan tabel native dan grafik yang bisa diklik di PowerPoint.

### 2. Parser yang tidak pernah crash

`src/lib/auto-generate.ts` membersihkan setiap balasan:

- Balasan bukan JSON → ditolak dengan pesan jelas, bukan crash.
- Blok tanpa teks → dibuang, dihitung, dan dilaporkan ke pengguna.
- Tipe blok tidak dikenal → dibuang.
- Tabel tanpa header → dibuang.
- Grafik tanpa label atau tanpa seri → dibuang.
- Baris tabel lebih pendek dari header → dipadatkan dengan `—`.
- Seri data lebih pendek dari label → dipotong supaya sejajar.
- Jumlah blok dibatasi 60 (anti kuota meledak).

### 3. Normalisasi

- **Level heading** dibatasi 1–4 (level 3–4 jadi sub-poin, bukan section).
- **Angka** berformat Indonesia ("1.250", "42%") dikonversi ke number.
- **Sisipan list** bisa nested; indentasi memakai tab (konvensi DeckCraft).
- **Nama field** dari model yang berbeda diterima semua: `text`/`body`/`isi`,
  `items`/`bullets`/`poin`, `headers`/`kolom`, `labels`/`categories`, dan
  lain-lain.

### 4. Prompt yang terkendali

- Gaya menentukan struktur dokumen (laporan = identitas→latar→tujuan→
  pembahasan→hasil→kesimpulan→rekomendasi).
- Persona menyuntik contoh nada bicara.
- Jumlah bagian membatasi panjang (3–8).
- Instruksi eksplisit: jangan mengarang fakta, nama orang, atau angka.

---

## Berkas

| Berkas | Peran |
|---|---|
| `src/lib/auto-generate.ts` | Parser + prompt builder + orchestrator |
| `src/lib/auto-generate.test.ts` | 19 unit test parser |
| `src/components/AutoGenerate.tsx` | Panel UI |
| `scripts/verifikasi-auto-generate.mjs` | Uji UI end-to-end (mock provider AI) |

---

## Verifikasi

```powershell
pnpm verify:auto-generate   # 9 pemeriksaan UI end-to-end
pnpm test                    # 19 unit test parser ikut di sini
```

Uji UI mem-*mock* `fetch` di level browser sehingga provider AI tidak pernah
dipanggil sungguhan — alur lengkap (prompt → parse → kanvas terisi) tetap
diuji nyata.

Hasil yang diverifikasi:

- Panel ada di DOM, prompt bisa diisi, tombol "Susun Dokumen" bisa diklik.
- Provider AI benar-benar dipanggil (1 panggilan).
- Pesan sukses tampil: *"Selesai: 10 blok (5 heading, 1 daftar, 1 tabel,
  1 grafik, 1 diagram) — 1 blok cacat dibuang."*
- Kanvas terisi blok hasil generate.
- Blok cacat (tipe asing) dibuang dan **dihitung** di pesan.

---

## Batasan

- Butuh API key provider yang dipilih (OpenAI / Anthropic / Google / Groq).
- Tanpa kunci → panel menampilkan pesan jelas, tidak diam-diam gagal.
- Kualitas isi sepenuhnya bergantung pada model yang dipilih.
- Diagram yang dihasilkan adalah Mermaid; DeckCraft mengubahnya jadi SmartArt
  proses (label node Mermaid → tahap).
- Auto-generate **mengganti** isi kanvas (bukan menambah). Simpan dokumen dulu
  kalau masih perlu.
