# Impor Template Pengguna (NitZ-909)

Impor lewat tombol **"📥 Impor Template (.json)"** di panel galeri.
Berkas `.json` berisi SATU objek template. Template yang lolos validasi
ditambahkan ke galeri sesi ini dan disimpan di `localStorage`
kunci `nitz909-user-templates` (dimuat otomatis saat aplikasi dibuka).

## Format JSON

```json
{
  "id": "rencana_rapat_saya",
  "nama": "Rencana Rapat Saya",
  "kategori": "dokumen",
  "format": "word",
  "deskripsi": "Undangan dan susunan acara rapat unit.",
  "ikon": "📄",
  "judulDokumen": "Rencana Rapat Unit",
  "blocks": [
    { "id": "b1", "type": "heading", "level": 1, "text": "Rencana Rapat" },
    { "id": "b2", "type": "paragraph", "text": "Hari Senin, aula utama." }
  ]
}
```

| Field          | Wajib | Aturan                                                                                                      |
| -------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| `id`           | Ya    | String tak-kosong, unik (bentrok dengan template bawaan/pengguna = ditolak). Karakter disarankan `a-z0-9_`. |
| `nama`         | Ya    | String tak-kosong.                                                                                          |
| `kategori`     | Ya    | Salah satu: `dokumen` \| `presentasi` \| `spreadsheet` \| `infografis`.                                     |
| `format`       | Ya    | Salah satu: `word` \| `pptx` \| `xlsx` \| `diagram` \| `pdf`.                                               |
| `deskripsi`    | Ya    | String tak-kosong.                                                                                          |
| `ikon`         | Tidak | Emoji/karakter, default `📄`.                                                                               |
| `judulDokumen` | Ya    | String tak-kosong (judul awal kanvas saat template dipakai).                                                |
| `blocks`       | Ya    | Array tak-kosong berisi blok konten (9 tipe di bawah).                                                      |

## Tipe blok (9) + field wajib per tipe

| `type`      | Field wajib                                                                                                                             |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `heading`   | `text` (string tak-kosong), `level` (1–6)                                                                                               |
| `paragraph` | `text` (string; boleh kosong)                                                                                                           |
| `list`      | `ordered` (boolean), `items` (array tak-kosong, tiap butir punya `text` tak-kosong)                                                     |
| `table`     | `headers` (array string tak-kosong), `rows` (array baris; tiap baris array string)                                                      |
| `code`      | `language` (string tak-kosong), `code` (string)                                                                                         |
| `image`     | `src` (string; URL `http(s)://` atau `data:image/`), `alt` (string)                                                                     |
| `chart`     | `chartType` (`bar`\|`line`\|`pie`\|`area`\|`scatter`), `data.labels` (array), `data.datasets` (array tak-kosong berisi `{label, data}`) |
| `diagram`   | `diagramType` (`mermaid`\|`plantuml`), `source` (string tak-kosong)                                                                     |
| `divider`   | — (tidak ada field wajib)                                                                                                               |

Setiap blok boleh punya `id`; jika kosong/duplikat, aplikasi memberi id baru
otomatis (`import-<n>`). Field opsional lain (`caption`, `formatting`, …)
dipertahankan apa adanya.

## Larangan macro / konten aktif (prosedur PRD)

Format impor adalah **JSON data murni** — bukan dokumen biner:

- DITOLAK: berkas `.docm/.pptm/.xlsm`, field `macro`, `script`, `onLoad`,
  `action`, `executable`, `oleObject`, atau blok bertipe selain 9 tipe di atas.
- DITOLAK: `image.src` selain `http(s)://` atau `data:image/`
  (menolak `javascript:`, path lokal, dan protokol lain).
- DITOLAK: teks blok yang mengandung pola aktif seperti `<script`,
  `javascript:`, `onerror=`, `onload=` (pemeriksaan non-kasus-sensitif).
- Ukuran berkas dibatasi **256 KB**; JSON harus tepat satu objek
  (bukan array, bukan JSON ganda).

## Pesan error (maks 3 alasan per penolakan)

Aplikasi menampilkan Alert merah berisi maksimal 3 alasan pertama, contoh:

- `Berkas bukan JSON valid: Unexpected token '}'...`
- `Field wajib hilang: "judulDokumen".`
- `kategori harus salah satu: dokumen, presentasi, spreadsheet, infografis.`
- `blocks harus array tak-kosong.`
- `Blok #2 (list): items harus array tak-kosong.`
- `Blok #1: type "macro" tidak dikenal (9 tipe: heading, paragraph, list, table, code, image, chart, diagram, divider).`
- `id "laporan_kegiatan" sudah dipakai template bawaan — ganti id lain.`
- `Konten aktif dilarang: blok #3 mengandung pola "<script".`
- `image.src blok #1 harus URL http(s):// atau data:image/.`

Lihat `CONTOH-template.json` untuk contoh minimal yang lolos validasi.
