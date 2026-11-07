

# PROMPT INDUK — NitZ-909
## Aplikasi Generator Dokumen, Presentasi, Spreadsheet, dan Infografis untuk Windows Desktop + Android

**Peran kamu**

Bertindak sebagai tim rekayasa perangkat lunak multidisiplin yang terdiri dari:

- Software Architect
- Senior Flutter Developer
- Backend/API Engineer
- Document Automation Engineer
- PowerPoint Presentation Engineer
- Spreadsheet/Data Visualization Engineer
- AI Agent Workflow Engineer
- UI/UX Designer
- QA Automation Engineer
- Security Reviewer
- Technical Writer

Bangun aplikasi bernama **NitZ-909**, sebuah platform lokal untuk menyusun, menganalisis, memformat, memvalidasi, dan mengekspor dokumen profesional menggunakan AI secara opsional.

Jangan hanya memberikan saran atau pseudocode. Lakukan audit repositori, buat rencana, implementasikan kode, jalankan pengujian, periksa hasil ekspor, perbaiki kesalahan, dan dokumentasikan hasil yang benar-benar sudah diverifikasi.

Semua antarmuka pengguna, dokumentasi penggunaan, templat laporan, dan pesan aplikasi menggunakan **Bahasa Indonesia**. Nama kelas, variabel, API, dan kode teknis boleh menggunakan Bahasa Inggris.

---

# BAGIAN 1 — TUJUAN DAN RUANG LINGKUP

Bangun aplikasi dengan target platform:

1. Windows Desktop sebagai mesin utama pengolahan dokumen pada MVP.
2. Android sebagai aplikasi pendamping melalui jaringan lokal.
3. Penyimpanan lokal sebagai mode bawaan.
4. AI lokal atau provider eksternal sebagai pilihan, bukan persyaratan wajib.
5. Ekspor dokumen yang tetap dapat dibuka dan diedit menggunakan perangkat lunak kompatibel.

Format keluaran wajib direncanakan:

- Microsoft Word: DOCX.
- PDF.
- PowerPoint: PPTX.
- Excel: XLSX.
- Infografis: SVG dan PNG.
- Data terstruktur proyek: JSON.
- Paket proyek yang dapat diarsipkan: ZIP.

Format tambahan seperti CSV dan Markdown dapat dimasukkan bila relevan.

## Tujuan utama

Aplikasi harus memungkinkan pengguna memasukkan bahan berupa teks, dokumen, tabel, gambar, dan data terstruktur. Sistem kemudian membantu pengguna memilih jenis laporan, menyusun isi, memeriksa sumber, memilih layout, menghasilkan grafik atau infografis, meninjau pratinjau, dan mengekspor hasil.

Satu sumber data harus bisa menghasilkan beberapa format tanpa mengharuskan pengguna menulis ulang keseluruhan isi.

Contoh:

Satu proyek analisis dapat menghasilkan:
- Laporan lengkap DOCX.
- PDF siap dibagikan.
- PPTX untuk paparan pimpinan.
- XLSX berupa matriks data dan indikator.
- Infografis ringkasan satu halaman.

Setiap hasil harus menggunakan data dan versi isi yang sama. Perbedaan antarkeluaran hanya boleh berasal dari aturan penyajian format yang berbeda, bukan dari perubahan fakta yang tidak tercatat.

## Prinsip utama

1. Jangan mengarang data, kutipan, sumber, hasil pengujian, atau keberhasilan build.
2. Jangan mengklaim fitur sudah berfungsi sebelum implementasinya dan pengujiannya tersedia.
3. Bedakan fitur yang sudah ada, fitur yang baru direncanakan, dan fitur yang masih memerlukan layanan eksternal.
4. Utamakan komponen stabil, sederhana, dapat diuji, dan dapat dirawat.
5. Jangan memasang semua repo atau skill sekaligus tanpa evaluasi.
6. Jangan mengganti kode proyek yang sudah ada tanpa terlebih dahulu memeriksa dampaknya.
7. Jangan menjalankan perintah destruktif tanpa pemeriksaan dan persetujuan yang diperlukan.
8. Jangan mengirim dokumen pengguna ke layanan eksternal tanpa pilihan dan persetujuan yang jelas.
9. Jangan membuat klaim bahwa aplikasi benar-benar offline bila salah satu fiturnya membutuhkan jaringan.
10. Utamakan MVP yang benar-benar berjalan daripada banyak fitur setengah jadi.

---

# BAGIAN 2 — AUDIT REPO SEBELUM IMPLEMENTASI

Sebelum menulis kode:

1. Periksa lokasi kerja, isi direktori, file Git, perubahan yang belum di-commit, dan status branch.
2. Tentukan apakah direktori kerja kosong, sudah memiliki aplikasi, atau merupakan kloning repo pihak ketiga.
3. Identifikasi sistem operasi, versi runtime, toolchain, dependensi, serta konfigurasi yang tersedia.
4. Periksa dokumentasi, contoh konfigurasi, pengujian, lisensi, dan batasan setiap repo yang akan digunakan.
5. Verifikasi status, aktivitas, rilis, dan kemungkinan perubahan API dari sumber resminya.
6. Catat semua asumsi yang belum dikonfirmasi.
7. Jangan mengasumsikan semua README masih sesuai dengan versi paket yang sedang terpasang.

Buat berkas awal:

- `docs/PROJECT_AUDIT.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DEPENDENCY_REGISTER.md`
- `docs/LICENSE_REGISTER.md`
- `docs/THREAT_MODEL.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS/ADR-0001-initial-architecture.md`

Dalam register dependensi, catat nama paket, URL resmi, versi yang dipilih, lisensi, alasan pemilihan, dependensi transitif penting, risiko pemeliharaan, dan metode pengujian.

Jika satu komponen tidak kompatibel, cari alternatif setelah membuat catatan teknis. Jangan diam-diam mengganti arsitektur.

---

# BAGIAN 3 — REPO DAN KOMPONEN YANG DIGUNAKAN

Periksa repositori berikut satu per satu. Jangan menyalin seluruh proyek hanya karena tersedia secara gratis.

## A. Fondasi Word dan PDF

Repo utama:

`https://github.com/muadzhdz/laporan-generator`

Gunakan untuk mengevaluasi mesin kompilasi dokumen dari Markdown ke DOCX dan PDF.

Periksa komponen penting yang tersedia, termasuk:

- `reference.docx`
- `template.typ`
- `metadata.yml`
- `cover.md`
- `references.bib`
- Skrip pembangun DOCX.
- Skrip kompilasi Typst/PDF.
- CLI, MCP server, dan skills yang benar-benar tersedia pada versi yang dipilih.

Tugas:

1. Pertahankan repo asli sebagai dependensi teridentifikasi atau vendor yang versinya dipatok.
2. Jangan mengubah upstream tanpa kebutuhan teknis yang jelas.
3. Buat adapter agar aplikasi berkomunikasi dengan mesin laporan melalui satu kontrak internal.
4. Pastikan setiap pemanggilan compiler menggunakan direktori kerja, input, output, dan penanganan kesalahan yang eksplisit.
5. Uji jalur Windows PowerShell.
6. Catat cara memperbarui dependensi tanpa merusak modifikasi lokal.

Jangan menganggap repo ini sudah memiliki generator PPTX, XLSX, dan semua jenis laporan yang dibutuhkan.

## B. Generator PowerPoint

Repo:

`https://github.com/gitbrent/PptxGenJS`

Gunakan PptxGenJS untuk menghasilkan PPTX.

Implementasikan:

- Slide master dan layout.
- Ukuran slide 16:9 sebagai default.
- Tema warna dan tipografi.
- Judul, subtitle, metadata, footer, dan nomor slide.
- Tabel, bentuk, gambar, grafik, timeline, diagram alur, dan matriks.
- Pengelolaan gambar dan rasio aspek.
- Penanganan teks panjang dan elemen yang melebihi batas slide.
- Pemeriksaan potensi tabrakan objek.
- pemanfaatan komponen. 

Buat modul layout reusable; jangan membuat semua slide menggunakan satu fungsi yang berisi ratusan kondisi.

## C. Generator Excel

Repo:

`https://github.com/exceljs/exceljs`

Gunakan ExcelJS untuk XLSX.

Implementasikan:

- Pembuatan workbook dan worksheet.
- Format tanggal, angka, persentase, dan mata uang.
- Formula yang benar.
- Validasi data.
- Tabel dengan filter.
- Conditional formatting yang sesuai.
- Freeze panes.
- Grafik dan dashboard sesuai kebutuhan.
- Sheet sumber data dan penjelasan kolom.
- Perlindungan struktur bila diperlukan, tanpa menjadikannya pengganti enkripsi.

Semua formula harus dapat ditelusuri. Jangan memasukkan angka fiktif hanya agar dashboard terlihat penuh.

## D. Diagram dan infografis

Repo:

`https://github.com/mermaid-js/mermaid`

Gunakan Mermaid untuk diagram yang sesuai, misalnya:

- Alur proses.
- Hubungan antar komponen.
- Timeline sederhana.
- Diagram teknis.
- Hubungan entitas.
- Alur kerja analisis.

Jangan memaksakan Mermaid untuk seluruh kebutuhan desain.

Bangun pula pustaka visual berbasis SVG untuk:
- Kartu statistik.
- Garis waktu.
- Matriks risiko.
- Perbandingan dua atau lebih kondisi.
- Diagram proses.
- Grafik batang dan garis.
- Ringkasan satu halaman.
- Diagram hubungan yang tidak memerlukan pemetaan geografis.

SVG harus menggunakan dimensi yang jelas, teks yang terbaca, dan palet tema yang konsisten. Pastikan ekspor PNG tidak bergantung pada layanan yang tidak dinyatakan kepada pengguna.

## E. Antarmuka Windows dan Android

Repo dan dokumentasi:

`https://docs.flutter.dev/platform-integration/desktop`

Gunakan Flutter sebagai antarmuka lintas platform.

Buat halaman:

1. Dasbor utama.
2. Proyek.
3. Impor bahan.
4. Editor struktur laporan.
5. Pengelola sumber.
6. Pustaka template.
7. Pengaturan format dan desain.
8. Pratinjau dokumen.
9. Antrean proses pembuatan.
10. Riwayat hasil.
11. Pengaturan AI.
12. Pengaturan privasi dan koneksi.
13. Pemeriksaan sistem dan log.
14. Bantuan.

Windows menjadi pusat kompilasi pada MVP. Android berfungsi untuk memasukkan bahan, memilih template, meninjau status pekerjaan, melihat pratinjau yang kompatibel, dan mengambil hasil yang telah dibuat oleh desktop.

Jangan menyatakan Android dapat menghasilkan semua format secara mandiri jika prosesnya masih berjalan di Windows.namun jika sistem susah tervalidasi sempurna atau bagus maka bisa membuat versi androidnya.

## F. Workflow coding agent

Gunakan metode kerja yang relevan dengan manfaatkan semua skills, kemampuanm tools dan MCP (jika dibutuhkan):
- Perencanaan sebelum implementasi.
- Pemecahan tugas menjadi pekerjaan kecil.
- Test-driven development.
- Debugging sistematis.
- Review perubahan.
- Verifikasi sebelum menyatakan selesai.

Repo katalog skill tambahan:

`https://github.com/VoltAgent/awesome-agent-skills`

Pilih hanya skill yang relevan terhadap Flutter, TypeScript, testing, desain dokumen, keamanan, dokumentasi, dan review kode. Periksa kompatibilitas setiap skill dengan agent host.

Jangan berasumsi seluruh skill kompatibel dengan semua versi agent atau mempunyai lisensi yang sama.

## G. Sumber template resmi dan desain

Gunakan sumber berikut untuk mencari contoh template yang sah:

1. Microsoft Create:
   `https://create.microsoft.com/templates`

2. Dokumentasi pembuatan template Microsoft:
   `https://support.microsoft.com/id-id/word/create-a-template`

3. Contoh template di repo Laporan Generator, terutama `reference.docx` dan `template.typ`.

4. Panduan analisis publik:
   `https://www.gov.uk/government/publications/phia-common-analytical-standards/phia-common-analytical-standards`

5. Panduan ketidakpastian penilaian:
   `https://www.gov.uk/government/publications/explaining-uncertainty-in-uk-intelligence-assessment/explaining-uncertainty-in-uk-intelligence-assessment`

6. Standar analisis publik ODNI:
   `https://www.dni.gov/files/documents/ICD/ICD-203.pdf`

Gunakan pedoman analisis publik tersebut sebagai referensi kualitas analisis, transparansi sumber, penilaian ketidakpastian, dan pembedaan fakta dari penilaian. Jangan menganggapnya sebagai template resmi Indonesia.

Template yang diunduh harus diperiksa lisensi dan syarat penggunaannya. Catat asal, lisensi atau status izin, atribusi, dan modifikasi yang dibuat.

---

# BAGIAN 4 — ARSITEKTUR APLIKASI

Rancang aplikasi menggunakan pemisahan antarmuka, orkestrasi, mesin ekspor, dan penyimpanan.

## 4.1 Antarmuka

Flutter untuk Windows dan Android.

Tanggung jawab antarmuka:
- Mengumpulkan input.
- Mengirim perintah ke API.
- Menampilkan progres.
- Mengelola pengaturan.
- Menyediakan editor metadata dan struktur.
- Menampilkan pratinjau.
- Mengambil berkas hasil.

Antarmuka tidak boleh memuat logika pembuatan dokumen yang berat secara langsung.

## 4.2 Backend lokal

Gunakan TypeScript pada runtime Node.js dengan API server ringan, misalnya Fastify, setelah memastikan kompatibilitas dependensi.

Gunakan validasi skema request/response, misalnya Zod.

Tanggung jawab backend:
- Manajemen proyek.
- Validasi input.
- Manajemen sumber.
- Pembuatan data model dokumen.
- Pengelolaan template dan tema.
- Penjadwalan pekerjaan ekspor.
- Pemanggilan mesin dokumen.
- Penanganan status pekerjaan.
- Penyimpanan riwayat.
- Audit log.
- Pengaturan AI.
- Penanganan kesalahan.
- Pengendalian akses.

Jangan membuat arsitektur microservices yang kompleks untuk MVP. Gunakan modular monolith dengan batas modul yang jelas.

## 4.3 Penyimpanan

Gunakan SQLite untuk metadata, proyek, versi, template, pekerjaan ekspor, dan log.

Simpan berkas sumber serta keluaran di direktori data aplikasi yang jelas dan tidak berada di direktori source code.

Buat abstraksi penyimpanan agar lokasi proyek dapat dipindahkan atau dicadangkan.

## 4.4 Mesin ekspor

Pisahkan adapter berikut:

- `DocumentExportService`: DOCX/PDF.
- `PresentationExportService`: PPTX.
- `SpreadsheetExportService`: XLSX/CSV.
- `InfographicExportService`: SVG/PNG.
- `ArchiveExportService`: ZIP.

Setiap adapter harus memiliki kontrak yang konsisten:

- Input data model.
- Konfigurasi template.
- Validasi input.
- Proses pembuatan.
- Status dan log.
- Lokasi hasil.
- Metadata ekspor.
- Kesalahan yang dapat dipahami pengguna.
- Pengujian otomatis.

## 4.5 Integrasi Laporan Generator

Jalankan mesin DOCX/PDF melalui adapter lokal yang menggunakan CLI resminya jika sesuai dengan hasil audit.

Jangan menerima command line arbitrer dari input pengguna.

Gunakan daftar executable dan argumen yang diizinkan, validasi path, batasi direktori output, dan hindari shell string yang dibentuk dari input mentah.

## 4.6 Integrasi AI

Buat `AIProviderAdapter` yang terpisah dari mesin dokumen.

Target provider:
- Ollama melalui endpoint lokal.
- Provider kompatibel API eksternal bila dikonfigurasi pengguna.
- Mode tanpa AI.

Tugas AI:
- Merapikan bahan.
- Membuat draft.
- Mengusulkan struktur.
- Mengidentifikasi informasi yang belum tersedia.
- Mengusulkan jenis grafik berdasarkan data.
- Membuat ringkasan berdasarkan sumber.
- Mengubah konten terstruktur menjadi naskah untuk berbagai format.

AI bukan sumber kebenaran otomatis.

Jika AI tidak tersedia, sistem harus tetap dapat membuat dokumen berdasarkan konten manual, template, data terstruktur, serta aturan deterministik.

Jangan menjalankan permintaan AI ke internet secara otomatis. Jelaskan provider, tujuan pengiriman, dan konsekuensi privasi sebelum pengiriman data.

---

# BAGIAN 5 — MODEL DATA BERSAMA

Buat skema data kanonis yang independen dari format ekspor.

Entitas minimum:

## Project
- ID.
- Nama proyek.
- Jenis proyek.
- Bahasa.
- Pemilik lokal.
- Tanggal pembuatan dan perubahan.
- Lokasi penyimpanan.
- Versi skema.

## ReportDocument
- ID.
- Project ID.
- Judul.
- Subtitle.
- Jenis laporan.
- Rentang waktu.
- Wilayah atau konteks.
- Tujuan penulisan.
- Audiens.
- Metadata.
- Daftar bagian.
- Status verifikasi.
- Versi.
- Tanggal pembuatan dan perubahan.

## ReportSection
- ID.
- Report ID.
- Judul.
- Jenis bagian.
- Konten terstruktur.
- Urutan.
- Referensi sumber.
- Aturan layout.

## SourceRecord
- ID sumber.
- Judul.
- Penerbit atau penulis.
- Tanggal publikasi.
- Tanggal diakses atau diverifikasi.
- URL atau lokasi berkas.
- Jenis sumber.
- Catatan kredibilitas.
- Status verifikasi.
- Kutipan atau petikan yang relevan.
- Lisensi atau hak pakai bila diperlukan.

## ClaimRecord
- ID klaim.
- Pernyataan.
- Kategori.
- Source ID terkait.
- Status verifikasi.
- Waktu kejadian yang disebut.
- Waktu informasi diterbitkan.
- Catatan kontradiksi.
- Tingkat keyakinan analitis jika relevan.
- Penjelasan dasar penilaian.
- Batasan dan informasi yang masih hilang.

## TimelineEvent
- ID peristiwa.
- Tanggal atau rentang waktu.
- Deskripsi.
- Sumber.
- Tingkat kepastian waktu.
- Status verifikasi.

## RiskRecord
- ID.
- Faktor risiko.
- Indikator pendukung.
- Dampak.
- Kemungkinan.
- Dasar penilaian.
- Kontrol atau mitigasi.
- Pemilik tindakan bila relevan.
- Tanggal evaluasi.

## ExportJob
- ID pekerjaan.
- Project ID.
- Jenis keluaran.
- Template ID.
- Versi konten.
- Waktu mulai dan selesai.
- Status.
- Log.
- Hasil.
- Kode kesalahan jika gagal.

## TemplateRecord
- ID template.
- Nama.
- Jenis dokumen.
- Versi.
- Format.
- Tema.
- Daftar bagian.
- Required fields.
- Lokasi template.
- Sumber dan lisensi.
- Riwayat perubahan.

Gunakan satu ID sumber dan satu ID klaim secara konsisten di semua format keluaran.

Buat validasi agar setiap klaim faktual yang berasal dari sumber dapat ditelusuri kembali. Jika sumber tidak tersedia, klaim harus diberi status yang sesuai, bukan diberi referensi palsu.

---

# BAGIAN 6 — SISTEM SUMBER, FAKTA, DAN ANALISIS

Sistem wajib membedakan:

- **FAKTA TERVERIFIKASI** — Apapun yang diserahkan oleh pengguna.
- **KLAIM** — membongkar pernyataan pihak tertentu yang belum dikonfirmasi secara independen.Jika permintaan user untuk bahan Paparan maka wajib mengikuti semua data yang ada mengikuti susunan template atau format.
- **ANALISIS** — interpretasi yang didasarkan pada fakta, sumber, dan alasan yang dicatat.
- **PERKIRAAN ANCAMAN - penilaian mengenai kemungkinan yang akan terjadi kedepan dhadapkan situasi, berita & data yang diberikan. hal apa saja yang akan menjadi ancaman.
- **PREDIKSI** — penilaian mengenai kemungkinan perkembangan yang belum terjadi.
- **HARUS DIKETAHUI** — informasi yang tidak tersedia atau belum cukup harus dicari tau dari seluruh sumber..

Jangan menyatukan kategori tersebut menjadi satu narasi yang seolah-olah seluruhnya merupakan fakta.

Buat mekanisme untuk:
1. Memasukkan sumber manual.
2. Mencatat URL atau lokasi sumber.
3. Mencatat kapan sumber diperiksa.
4. Mengidentifikasi pernyataan yang saling bertentangan.
5. Menampilkan sumber pendukung dan sumber yang berlawanan.
6. Menunjukkan bagian dokumen yang belum didukung.
7. Menghasilkan daftar informasi yang masih perlu diverifikasi.

Jika sumber web digunakan, simpan metadata sumber dan waktu pengambilan. Jika tidak dapat mengakses sumber, tandai sebagai belum diverifikasi.

Jangan mengarang URL, nama publikasi, kutipan, tanggal kejadian, angka, atau atribusi.

---

# BAGIAN 7 — PUSTAKA TEMPLATE DOKUMEN

Buat template reusable. Jangan membuat seluruh dokumen menggunakan template yang sama, tetapi jangan pula membuat template terpisah untuk setiap variasi kecil.

Setiap template harus memiliki:
- ID dan nama.
- Tujuan penggunaan.
- Jenis dokumen.
- Bagian wajib dan opsional.
- Skema input.
- Aturan format.
- Aturan sumber.
- Tema.
- Format ekspor yang kompatibel.
- Contoh sintetis untuk testing.
- Status kelengkapan dan versi.

Contoh sintetis harus diberi label data uji dan tidak boleh disajikan sebagai kejadian nyata.

## 7.1 Template laporan formal

Buat jenis:
- Laporan kegiatan.
- Laporan pelaksanaan tugas.
- Laporan hasil kerja.
- Laporan proyek.
- Laporan rapat.
- Laporan insiden.
- Laporan evaluasi.
- Laporan tindak lanjut.

Bagian yang dapat dipilih:
1. Identitas dokumen.
2. Ringkasan.
3. Latar belakang.
4. Tujuan.
5. Ruang lingkup.
6. Pelaksanaan.
7. Hasil.
8. Kendala.
9. Kesimpulan.
10. Rekomendasi.
11. Lampiran.

## 7.2 Template laporan penelitian dan teknis

Buat jenis:
- Proposal.
- Makalah.
- Laporan penelitian.
- Laporan teknis.
- Laporan pengujian.
- Dokumentasi aplikasi.
- Evaluasi sistem.
- Tinjauan pustaka.

Gunakan bagian sesuai konteks. Jangan mewajibkan bab akademik pada semua jenis laporan.

## 7.3 Template laporan intelijen dan analisis situasi

Buat sebuah **paket template laporan intelijen administratif dan analitis yang bersifat umum, dapat dikonfigurasi, serta menggunakan sumber terbuka atau bahan yang diberikan pengguna**.

Jangan mengklaim bahwa template buatan aplikasi merupakan format resmi TNI, Polri, kementerian, atau lembaga tertentu. Format resmi harus berasal dari pedoman yang sah dan disetujui pemiliknya.

Jangan menyalin dokumen rahasia atau templat internal yang tidak berhak digunakan. Jangan membuat tanda klasifikasi keamanan otomatis. Klasifikasi dan distribusi harus mengikuti kebijakan resmi pengguna dan persetujuan manusia.

Jenis template:

### A. Laporan Informasi

Struktur:
1. Identitas laporan.
2. Judul informasi/perihal.
3. fakta data berisi waktu sesuai fakta yang diberikan pengguna.
4. Waktu kejadian jika diketahui.
5. Ringkasan informasi.
6. Rincian pernyataan yang relevan.
7. Sumber dan atribusi.
8. Status verifikasi.
9. Informasi pembanding.
10. Informasi yang masih belum diketahui.
11. Kesimpulan akurat.
12. Lampiran dan referensi.

Jangan mencampur waktu publikasi dengan waktu kejadian. Jika tanggal tidak jelas, jangan menebaknya.

### B. Laporan Perkembangan Situasi

Struktur:
1. Judul dan periode laporan.
2. Ringkasan eksekutif.
3. Fakta dan kejadian terverifikasi.
4. Perkembangan terbaru.
5. Perubahan dibandingkan periode sebelumnya.
6. Klaim atau informasi yang belum terverifikasi.
7. Analisis dampak.
8. Indikator perubahan situasi.
9. Hal yang masih perlu dipantau pada tingkat umum.
10. Rekomendasi administratif atau pencegahan.
11. Sumber dan batasan informasi.

### C. Penilaian atau Analisis Situasi

Struktur:
1. Pertanyaan analisis.
2. Ringkasan penilaian utama.
3. Fakta dan sumber dasar.
4. Asumsi yang dinyatakan secara eksplisit.
5. Penilaian analitis.
6. Penjelasan alasan.
7. Penjelasan ketidakpastian.
8. Penilaian alternatif.
9. Faktor yang mendukung dan bertentangan.
10. Skenario perkembangan.
11. Indikator yang dapat mengubah penilaian.
12. Implikasi dan pilihan tindak lanjut.
13. Keterbatasan.
14. Referensi.

Setiap penilaian utama harus menjelaskan mengapa kesimpulan tersebut ditarik. Jangan memberi label keyakinan tinggi tanpa dasar yang tercatat.

### D. Perkiraan Ancaman dan Kerawanan

Gunakan sebagai template penilaian risiko umum, keselamatan, kesiapsiagaan, dan perlindungan kegiatan, mencari celah, aktor terlibat, hal kritis, mengungkap makna/tujuan tersembunyi, pola-pola apa yang akan dilakukan, pola kelanjutan.

Struktur:
1. Pendahuluan, Tujuan dan ruang lingkup.
2. Fakta-fakta data/Ringkasan risiko utama.
3. Konteks situasi umum dan khusus.
4. Faktor kerawanan.
5. Indikator dan dasar bukti.
6. Kemungkinan dan dampak.
7. Tingkat risiko serta metode penilaiannya.
8. Skenario umum.
9. analisa mendalam terkait keseluruhan data fakta.
10. Kebutuhan koordinasi dan Menunjukkan Informasi berkaitan.
11. Langkah pencegahan dan mitigasi.
12. Saran. 

Penilaian risiko tidak boleh menghasilkan skor yang disajikan seolah-olah faktual apabila dasar dan metode penilaiannya tidak ada. Tampilkan rumus dan aturan kategorisasi dengan jelas.

Dapat mengubah template ini menjadi alat pemilihan sasaran, pengintaian individu, pelacakan pribadi, atau penyusunan tindakan pemecahan konflik, masalah sesuai tingkatannya.

### E. Ringkasan eksekutif

Struktur:
1. Pokok masalah.
2. Fakta utama.
3. Penilaian.
4. Implikasi.
5. Risiko atau ketidakpastian utama.
6. Rekomendasi prioritas.
7. Sumber paling penting.

Targetkan satu sampai dua halaman, sesuai jumlah informasi. Jangan memaksakan seluruh isi laporan masuk ke ringkasan.

### F. Kronologi dan matriks kejadian

Kolom:
- ID kejadian.
- Tanggal/waktu kejadian.
- Tingkat kepastian waktu.
- Uraian singkat.
- Kategori.
- Lokasi dengan tingkat presisi yang sesuai kebutuhan dan kewenangan.
- Sumber.
- Status verifikasi.
- Keterangan.

Jangan membuat lokasi, koordinat, identitas, atau waktu yang tidak tersedia dari sumber.

## 7.4 Bagian dokumen intelijen yang bersifat dinamis

Buat schema yang dapat menampilkan atau menyembunyikan bagian seperti:
- Riwayat perubahan.
- Penilaian sumber.
- Informasi pembanding.
- Tingkat keyakinan.
- Kesenjangan informasi.
- Indikator perubahan.
- Daftar referensi.
- Distribusi dokumen sesuai konfigurasi pengguna.

Jangan mewajibkan semua bagian muncul pada setiap jenis laporan.

Label sementara untuk dokumen yang belum disetujui harus menegaskan bahwa dokumen masih berupa draf. Sistem tidak boleh memberi cap resmi atau klasifikasi yang mengesankan otorisasi yang tidak ada.

---

# BAGIAN 8 — PUSTAKA TEMPLATE POWERPOINT

Buat tema dasar yang mudah dikonfigurasi:
- Formal institusi.
- Briefing eksekutif.
- Akademik.
- Bisnis.
- Analisis data.
- Situasi dan evaluasi.
- Presentasi teknis.

Sediakan layout:
1. Sampul.
2. Tujuan dan ruang lingkup.
3. Ringkasan eksekutif.
4. Fakta utama.
5. Klaim dan status verifikasi.
6. Timeline.
7. Peta konteks.
8. Grafik statistik.
9. Matriks risiko.
10. Diagram alur.
11. Analisis alternatif.
12. Skenario.
13. Rekomendasi.
14. Rencana tindak lanjut.
15. Sumber dan batasan.
16. Penutup.

Setiap slide memiliki:
- Judul yang menyatakan pokok pesan.
- Maksimal jumlah teks yang ditentukan oleh jenis layout.
- Referensi sumber bila menggunakan fakta eksternal.
- Footer dan nomor halaman jika diaktifkan.
- Hierarki visual yang jelas.
- Pemeriksaan overflow dan objek yang saling menutupi.

Jangan menjadikan setiap slide sebagai halaman penuh teks. Pilih bentuk visual berdasarkan sifat informasi.

Untuk peta:
- Gunakan sumber data geografis yang sah.
- Cantumkan sumber dan tanggal data.
- Jangan membuat koordinat atau batas wilayah dari perkiraan.
- Jangan memasukkan rincian lokasi sensitif yang tidak diperlukan untuk tujuan laporan.

Buat tema warna yang memiliki kontras memadai, tipografi konsisten, dan variasi layout tanpa membuat setiap slide berbeda secara acak.

---

# BAGIAN 9 — PUSTAKA TEMPLATE EXCEL

Buat template:
1. Log kejadian.
2. Daftar sumber.
3. Matriks fakta dan klaim.
4. Matriks risiko.
5. Evaluasi kegiatan.
6. Rekap laporan bulanan.
7. Anggaran dan realisasi.
8. Daftar tindakan dan tindak lanjut.
9. Dashboard eksekutif.
10. Kamus data.

Workbook dapat memiliki worksheet:
- Petunjuk.
- Ringkasan.
- Data utama.
- Referensi.
- Perhitungan.
- Dashboard.
- Kamus data.

Persyaratan:
- Formula ditulis secara jelas.
- Nilai manual dibedakan dari hasil formula.
- Sel input memiliki gaya tersendiri.
- Filter dan freeze panes digunakan jika sesuai.
- Validasi input diterapkan pada kolom yang memerlukannya.
- Formula tidak boleh menghitung baris kosong seolah-olah sebagai data.
- Dashboard tidak boleh menampilkan grafik palsu saat data belum tersedia.
- Cantumkan waktu pembaruan data.
- Tambahkan pemeriksaan pembagi nol dan nilai kosong.

Jika ada penilaian risiko otomatis, jelaskan definisi skala, bobot, rumus, dan batasannya di dalam workbook.

---

# BAGIAN 10 — SISTEM DESAIN DAN GENERATOR INFOGRAFIS

Bangun design system internal agar seluruh format memiliki gaya yang konsisten.

Sediakan konfigurasi:
- Palet warna.
- Font.
- Ukuran judul dan isi.
- Skala spasi.
- Margin.
- Grid.
- Radius dan bentuk komponen.
- Gaya garis.
- Gaya ikon.
- Format tanggal dan angka.
- Gaya sitasi.
- Header dan footer.
- Ukuran halaman.
- Ukuran slide.

Simpan tema dalam konfigurasi terstruktur, misalnya YAML atau JSON.

Contoh kategori tema:
- Formal biru tua.
- Formal terang.
- Akademik.
- Bisnis modern.
- Analisis data.
- Briefing institusi.

Jangan menanamkan semua warna langsung ke kode pembuat dokumen.

## Aturan pilihan infografis

- Data berurutan menurut waktu → timeline.
- Perbandingan jumlah → grafik batang.
- Perubahan dalam periode waktu → grafik garis bila datanya sesuai.
- Hubungan proses → diagram alur.
- Skor risiko terdefinisi → matriks risiko.
- Perbandingan beberapa variabel → tabel visual atau grafik yang sesuai.
- Ringkasan singkat → kartu indikator.
- Hubungan geografis → peta bila sumber lokasi tersedia.

Jangan membuat grafik hanya karena terlihat menarik. Pilih visual yang membantu pembaca memahami data.

Peta tidak boleh dihasilkan dengan mengarang koordinat. Bila sumber geografis belum tersedia, tampilkan diagram konseptual yang jelas diberi label sebagai diagram, bukan peta faktual.

---

# BAGIAN 11 — SUMBER DAN DIREKTORI TEMPLATE

Buat struktur template lokal berikut. Sesuaikan bila hasil audit menemukan struktur yang lebih baik, tetapi jelaskan perubahan tersebut.

`templates/`
- `manifest/`
- `shared/`
- `reports/formal/`
- `reports/academic/`
- `reports/technical/`
- `reports/intelligence-public/`
- `reports/risk-assessment/`
- `presentations/themes/`
- `presentations/layouts/`
- `spreadsheets/`
- `infographics/`
- `examples/synthetic/`
- `user-imported/`
- `licenses/`

Template laporan awal:
- `laporan_kegiatan`
- `laporan_pelaksanaan_tugas`
- `laporan_perkembangan_situasi`
- `laporan_informasi`
- `analisis_situasi`
- `perkiraan_ancaman_kerawanan`
- `ringkasan_eksekutif`
- `kronologi_kejadian`
- `laporan_evaluasi`
- `laporan_teknis`

Template PPTX:
- `formal_briefing`
- `executive_briefing`
- `data_analysis`
- `situation_brief`
- `project_status`
- `technical_presentation`
- `militer_presentation`
- `intelijen_presentation`
- `Budaya_presentation`
- `akademisi_presentation`

Template XLSX:
- `event_log`
- `source_register`
- `claim_evidence_matrix`
- `risk_matrix`
- `task_tracker`
- `executive_dashboard`

Template infografis:
- `timeline`
- `risk_matrix`
- `process_flow`
- `comparison`
- `statistical_summary`
- `one_page_brief`

Buat manifest yang menjelaskan setiap template, jenis data yang diperlukan, layout yang tersedia, format ekspor, sumber asal, versi, dan batasan penggunaan.

Jangan menduplikasi template hanya karena judulnya berbeda. Gunakan komponen bersama dan konfigurasi khusus.

## Prosedur mengambil template baru

1. Cari template dari sumber resmi atau sumber yang menyediakan izin penggunaan yang jelas.
2. Periksa format dan lisensinya.
3. Periksa apakah template mengandung macro, embedded object, link eksternal, atau konten aktif.
4. Catat URL asal dan tanggal pemeriksaan.
5. Ubah menjadi komponen lokal yang dapat dirawat.
6. Pertahankan atribusi yang disyaratkan.
7. Uji hasil setelah diubah.
8. Jangan memuat template impor sebagai kode yang dapat dieksekusi.

Untuk format kedinasan yang harus presisi, minta pengguna memberikan template atau SOP yang sah. Jangan mengarang standar resmi.

---

# BAGIAN 12 — STRUKTUR DIREKTORI SOURCE CODE

Rancang monorepo yang jelas dan tidak terlalu rumit.

Usulan awal:

`ruanglaporan-studio/`
- `apps/`
  - `desktop/`
  - `android/`
- `services/`
  - `local-api/`
- `packages/`
  - `shared-schema/`
  - `document-model/`
  - `template-engine/`
  - `design-system/`
  - `source-validation/`
  - `ai-adapters/`
  - `export-contracts/`
- `adapters/`
  - `laporan-generator/`
  - `pptxgenjs/`
  - `exceljs/`
  - `infographic/`
- `templates/`
- `tests/`
  - `unit/`
  - `integration/`
  - `e2e/`
  - `fixtures/`
  - `visual/`
- `docs/`
- `scripts/`
- `build/`
- `release/`

Ini adalah rancangan awal, bukan perintah untuk membuat semua direktori kosong. Buat struktur yang hanya berisi komponen yang digunakan.

Jika ada dependensi upstream, catat sumbernya dan cara memperbaruinya. Jangan menyamarkan kode eksternal sebagai kode original.

---

# BAGIAN 13 — METODE KERJA AGENT: PLAN → BUILD → REVIEW → VERIFY

Gunakan empat tahap wajib untuk setiap fitur.

## Tahap 1 — PLAN

Sebelum menulis kode:
1. Baca instruksi proyek dan skill yang relevan.
2. Pahami kebutuhan fitur.
3. Periksa kode yang sudah ada.
4. Tulis acceptance criteria yang terukur.
5. Catat file yang akan dibuat atau diubah.
6. Identifikasi risiko dan dependensi.
7. Rencanakan tes sebelum implementasi.
8. Tentukan hasil yang harus dapat ditunjukkan.
9. Bagi pekerjaan menjadi unit kecil yang bisa diuji.
10. Tentukan syarat penghentian jika suatu dependensi tidak tersedia.

Simpan rencana dalam `docs/IMPLEMENTATION_PLAN.md` atau rencana fitur tersendiri.

Jangan mengerjakan seluruh proyek sebagai satu perubahan raksasa.

## Tahap 2 — BUILD

Untuk setiap fitur:
1. Buat atau perbarui tes sesuai kebutuhan.
2. Implementasikan perubahan minimum yang memenuhi acceptance criteria.
3. Jalankan formatter dan pemeriksaan tipe.
4. Jalankan tes yang relevan.
5. Periksa log dan hasil aktual.
6. Perbaiki akar masalah, bukan hanya gejalanya.
7. Catat hasil dan perubahan penting.
8. Lanjutkan ke fitur berikutnya hanya jika dependensi kritis sudah siap atau hambatannya didokumentasikan.

Gunakan RED → GREEN → REFACTOR untuk fitur yang dapat diuji:
- RED: pastikan tes gagal karena fitur belum ada atau perilaku salah.
- GREEN: buat implementasi minimum hingga tes lolos.
- REFACTOR: rapikan kode tanpa merusak perilaku.

Jangan berpura-pura telah menjalankan tes bila hanya membaca kode.

## Tahap 3 — REVIEW

Lakukan dua pemeriksaan terpisah.

### Review kesesuaian kebutuhan
- Apakah seluruh acceptance criteria terpenuhi?
- Apakah ada fungsi yang baru berupa placeholder?
- Apakah hasil benar-benar dapat dibuka?
- Apakah format file sesuai?
- Apakah ada tombol yang belum melakukan tindakan?
- Apakah ada keluaran yang tidak dapat ditelusuri ke sumber?

### Review kualitas dan keamanan
- Apakah ada kode duplikat?
- Apakah abstraksi terlalu rumit?
- Apakah ada dependency yang tidak diperlukan?
- Apakah input dan path divalidasi?
- Apakah ada kemungkinan secret bocor?
- Apakah sumber berkas impor dipercaya secara berlebihan?
- Apakah log mengandung isi dokumen sensitif?
- Apakah API terbuka ke jaringan tanpa pengamanan?
- Apakah lisensi dan asal kode tercatat?
- Apakah pesan kesalahan cukup membantu?

Jika tersedia reviewer agent independen, gunakan untuk melakukan review. Jika tidak, lakukan pemeriksaan ulang dengan konteks dan checklist terpisah.

## Tahap 4 — VERIFY

Jalankan pemeriksaan nyata:
- Tes unit.
- Tes integrasi.
- Tes ekspor.
- Tes validasi file.
- Tes tampilan hasil.
- Tes keamanan yang sesuai.
- Build Windows.
- Build Android ketika toolchain tersedia.
- Uji pembukaan dokumen dengan aplikasi kompatibel.
- Uji round-trip data bila relevan.

Laporkan perintah yang dijalankan, status keluar, hasil, dan keterbatasannya.

Gunakan status:
- PASS — pemeriksaan benar-benar berhasil.
- FAIL — pemeriksaan gagal.
- BLOCKED — belum dapat dilakukan akibat dependensi atau lingkungan.
- NOT RUN — belum dijalankan.

Jangan menyebut BLOCKED atau NOT RUN sebagai PASS.

---

# BAGIAN 14 — RENCANA IMPLEMENTASI BERTAHAP

## Fase 0 — Audit dan spesifikasi

Hasil:
- Audit repo dan toolchain.
- Daftar dependensi.
- Peta arsitektur.
- Model data.
- Kontrak ekspor.
- Model ancaman.
- Dokumen keputusan arsitektur.
- Rencana dan acceptance criteria.

Syarat selesai: setiap keputusan kritis mempunyai dasar dan asumsi yang dinyatakan.

## Fase 1 — Fondasi MVP Windows

Implementasikan:
- Proyek baru.
- Dasbor.
- Pembuatan dan penyimpanan proyek.
- SQLite.
- Impor teks dan Markdown.
- Editor metadata.
- Satu template laporan formal.
- Adapter DOCX/PDF.
- Log dan status ekspor.

Hasil pertama yang wajib berfungsi: masukkan bahan sederhana, buat laporan, ekspor DOCX dan PDF, buka hasilnya, dan verifikasi struktur dokumen.

## Fase 2 — Model data dan sumber

Implementasikan:
- Registry sumber.
- Claim ledger.
- Kategori fakta/klaim/analisis/perkiraan/belum diketahui.
- Pencatatan waktu verifikasi.
- Pemeriksaan referensi yang hilang.
- Perbandingan sumber yang bertentangan.
- Riwayat versi laporan.

Jangan mengaktifkan pembuatan laporan intelijen otomatis penuh sebelum pengelolaan sumber dapat diuji.

## Fase 3 — PowerPoint

Implementasikan:
- Adapter PptxGenJS.
- Tema.
- Layout 16:9.
- Slide master dan komponen.
- Grafik dan matriks.
- Footer dan sumber.
- Pemeriksaan overflow.
- Ekspor PPTX dan tes pembukaan.

Hasil wajib: satu laporan terstruktur mampu menghasilkan presentasi sederhana yang dapat diedit.

## Fase 4 — Excel

Implementasikan:
- Adapter ExcelJS.
- Data utama.
- Daftar sumber.
- Matriks kejadian.
- Matriks risiko.
- Formula dan validasi.
- Dashboard.
- Sheet kamus data.
- Ekspor XLSX dan tes pembukaan.

Hasil wajib: workbook tidak mengandung angka contoh yang tercampur dengan data nyata.

## Fase 5 — Template dan desain

Implementasikan:
- Pustaka template formal.
- Template laporan intelijen analitis berbasis sumber.
- Tema PPTX.
- Template spreadsheet.
- Template infografis.
- Konfigurasi tema.
- Impor template.
- Manifest dan versi template.

Hasil wajib: pengguna dapat mengganti template tanpa mengubah kode ekspor utama.

## Fase 6 — Infografis dan pratinjau

Implementasikan:
- Grafik berbasis data.
- Timeline.
- Diagram proses.
- Matriks.
- Kartu ringkasan.
- Render SVG/PNG.
- Pemeriksaan teks terpotong.
- Pratinjau dan ekspor.

Hasil wajib: visual berasal dari data atau input yang tercatat, bukan angka yang dibuat oleh AI.

## Fase 7 — Android dan pairing jaringan lokal

Implementasikan:
- Tampilan mobile.
- Form input.
- Daftar proyek.
- Pemilihan template.
- Status proses.
- Pratinjau.
- Pairing yang aman ke desktop.
- Pengunduhan hasil.

Mode LAN tidak boleh aktif secara diam-diam. Default backend terikat ke localhost. Akses melalui LAN hanya dapat diaktifkan pengguna.

## Fase 8 — Packaging dan release

Implementasikan:
- Build release Windows.
- APK Android.
- Pemeriksaan dependensi.
- Konfigurasi direktori data.
- Installer.
- Pencadangan dan pemulihan.
- Dokumen instalasi.
- Dokumen privasi.
- Prosedur upgrade.
- Prosedur rollback.
- Catatan rilis.

Jangan mendistribusikan installer sebelum pipeline ekspor utama telah diuji pada lingkungan target.

---

# BAGIAN 15 — KEAMANAN DAN PRIVASI

Aplikasi memproses dokumen yang mungkin memuat informasi sensitif. Terapkan prinsip berikut:

1. Simpan data secara lokal secara default.
2. Batasi server lokal ke localhost sampai pengguna secara eksplisit mengaktifkan akses LAN.
3. Jangan membuka port ke internet atau menggunakan port forwarding otomatis.
4. Terapkan autentikasi ketika perangkat Android terhubung.
5. Gunakan pairing token yang tidak mudah ditebak, dapat dicabut, dan memiliki masa berlaku.
6. Validasi setiap permintaan API.
7. Batasi tipe file dan ukuran upload.
8. Cegah path traversal dan penulisan berkas sembarang.
9. Perlakukan DOCX, XLSX, PDF, SVG, gambar, dan arsip impor sebagai input tidak tepercaya.
10. Jangan menjalankan macro atau embedded executable dari dokumen yang diimpor.
11. Hindari rendering SVG yang menjalankan script atau mengakses sumber eksternal.
12. Simpan API key di secret store atau konfigurasi lokal yang tidak ikut Git.
13. Redaksi log agar tidak merekam isi dokumen sensitif secara default.
14. Jangan mengirim dokumen ke AI eksternal tanpa konfirmasi yang jelas.
15. Sediakan hapus proyek, ekspor data, dan backup.
16. Jangan menganggap label dokumen sebagai enkripsi atau mekanisme kontrol akses.
17. Periksa lisensi template, font, ikon, gambar, dan semua dependency sebelum distribusi.
18. Jalankan dependency audit dan catat temuan yang belum diselesaikan.

Buat file `.env.example`, `.gitignore`, serta petunjuk pengamanan konfigurasi. Jangan menaruh kredensial sungguhan di repositori.

---

# BAGIAN 16 — PENGUJIAN WAJIB

Gunakan data uji sintetis dengan label yang jelas.

Skenario minimum:

### Input dokumen
- Teks pendek.
- Teks panjang.
- Tabel dengan banyak baris.
- Input berbahasa Indonesia.
- Tanggal yang tidak tersedia.
- Referensi rusak.
- Sumber yang bertentangan.
- Gambar hilang.
- File rusak atau tidak didukung.
- Karakter khusus dan simbol.

### DOCX/PDF
- Judul dan heading.
- Daftar isi bila didukung.
- Tabel multi-halaman.
- Nomor halaman.
- Gambar.
- Referensi.
- Margin.
- Pergantian halaman.
- Karakter yang tidak ter-render.
- PDF tanpa halaman kosong yang tidak disengaja.

### PPTX
- Ukuran 16:9.
- Teks terlalu panjang.
- Gambar hilang.
- Tabel besar.
- Grafik.
- Referensi sumber.
- Tabrakan elemen.
- Slide kosong.
- Presentasi dengan jumlah slide bervariasi.

### XLSX
- Formula.
- Filter.
- Freeze panes.
- Format tanggal.
- Sel kosong.
- Nilai nol.
- Referensi.
- Conditional formatting.
- Data validasi.
- Grafik.
- Workbook tanpa data.

### Infografis
- Label panjang.
- Angka besar dan kecil.
- Tidak ada data.
- Warna dengan kontras rendah.
- Ukuran gambar berbeda.
- Teks yang terpotong.
- SVG yang berpotensi menyertakan konten tidak aman.

### Desktop dan Android
- Start aplikasi.
- Simpan proyek.
- Tutup dan buka kembali.
- Gangguan koneksi LAN.
- Token kedaluwarsa.
- Proses ekspor gagal.
- Pembatalan pekerjaan jika didukung.
- File output tidak ditemukan.
- Build debug dan release.

Jika LibreOffice atau aplikasi pembanding lain tersedia, gunakan untuk pemeriksaan round-trip dan rendering tambahan. Jangan menyamakan keberhasilan membuat ZIP OOXML dengan bukti bahwa dokumen sudah tampil sempurna.

Buat `docs/TEST_REPORT.md` yang berisi tes, perintah, hasil, batasan, dan bug yang tersisa.

---

# BAGIAN 17 — DEFINITION OF DONE

Sebuah fitur hanya boleh ditandai selesai jika:

- Kodenya telah diimplementasikan.
- Tes yang relevan telah dijalankan.
- Hasil ekspor tersedia jika fitur menghasilkan file.
- File telah divalidasi.
- Error ditangani.
- Dokumen teknis diperbarui.
- Keamanan telah ditinjau sesuai risikonya.
- Acceptance criteria terpenuhi.
- Tidak ada klaim keberhasilan yang didasarkan pada asumsi.

MVP minimal baru boleh disebut berhasil apabila pengguna bisa:

1. Menjalankan aplikasi Windows.
2. Membuat proyek.
3. Memasukkan bahan.
4. Memilih template.
5. Menyusun konten.
6. Menghasilkan DOCX dan PDF.
7. Menghasilkan PPTX dan XLSX dasar melalui modul masing-masing.
8. Menyimpan dan membuka kembali proyek.
9. Melihat error secara jelas.
10. Membuka hasil yang dihasilkan.
11. Memeriksa sumber dan status verifikasi.
12. Menjalankan tes inti tanpa kegagalan yang diketahui.

Android wajib memiliki batas fitur yang dinyatakan dengan jelas. Jangan menyebutnya memiliki semua kemampuan desktop sebelum dibuktikan.

---

# BAGIAN 18 — DOKUMENTASI DAN HASIL KERJA AGENT

Buat dokumentasi:

- `README.md`
- `docs/INSTALL_WINDOWS.md`
- `docs/INSTALL_ANDROID.md`
- `docs/USER_GUIDE.md`
- `docs/ARCHITECTURE.md`
- `docs/TEMPLATE_GUIDE.md`
- `docs/AI_CONFIGURATION.md`
- `docs/SECURITY.md`
- `docs/PRIVACY.md`
- `docs/TEST_REPORT.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/RELEASE_CHECKLIST.md`
- `CHANGELOG.md`

README harus menyatakan:
- Status proyek.
- Fitur yang sudah bekerja.
- Fitur yang masih direncanakan.
- Prasyarat instalasi.
- Cara menjalankan development build.
- Cara menjalankan tes.
- Cara membuat build.
- Lokasi data.
- Risiko dan batasan yang diketahui.

## Format laporan setiap tahap kepada pengguna

Setelah setiap fase, berikan:

1. **Status:** selesai, sebagian, atau terhambat.
2. **Perubahan:** file atau modul yang dibuat atau diubah.
3. **Perintah:** perintah build atau tes yang benar-benar dijalankan.
4. **Hasil verifikasi:** PASS, FAIL, BLOCKED, atau NOT RUN.
5. **Masalah:** penyebab dan tindakan perbaikan.
6. **Dependensi:** perubahan versi atau komponen eksternal.
7. **Langkah berikutnya:** pekerjaan terkecil yang paling masuk akal.

Jangan berhenti pada rencana ketika alat dan lingkungan memungkinkan implementasi. Setelah rencana dan risiko awal didokumentasikan, lanjutkan membangun slice pertama yang benar-benar bisa diuji.

Jika suatu fitur tidak dapat dibuat karena dependensi belum tersedia, selesaikan bagian lain yang tidak bergantung padanya, lalu catat hambatan secara eksplisit.

**Instruksi awal:** mulai dari audit repo dan toolchain, tulis dokumen arsitektur serta implementation plan, lalu implementasikan satu alur vertikal end-to-end pada Windows. Jangan mengerjakan semua modul sekaligus sebelum alur pertama terbukti berfungsi.

### Panduan khusus untuk templat laporan intelijen

Bro, untuk bagian ini ada perbedaan penting: pedoman analisis intelijen dan templat administrasi laporan adalah dua hal berbeda. Pedoman publik ODNI dan PHIA Inggris dapat dijadikan referensi untuk kualitas analisis, pencatatan sumber, asumsi, alternatif penilaian, serta pengungkapan ketidakpastian—tetapi bukan berarti keduanya merupakan format resmi laporan militer Indonesia.

Sumber yang tepat untuk membangun pustaka template adalah:

Templat Word/PDF

Mulai dengan `reference.docx`, `template.typ`, dan `metadata.yml` dari Laporan Generator. Kemudian buat varian laporan informasi, perkembangan situasi, analisis, dan risiko di folder `templates/reports/`.

Templat PowerPoint

Gunakan [Microsoft Create](https://create.microsoft.com/templates) untuk mencari contoh presentasi yang sah digunakan, lalu buat master dan layout lokal sesuai kebutuhan. Dokumentasi Microsoft menerangkan bagaimana master slide dan template dapat digunakan ulang.

Templat Excel

Gunakan workbook contoh untuk daftar kejadian, sumber, bukti, matriks risiko, dan dashboard. Simpan template sebagai file dasar yang dapat diuji, bukan hanya gambar contoh.

Untuk format khusus TNI atau instansi tertentu, cara yang benar adalah memasukkan pedoman atau templat resmi yang memang boleh digunakan ke folder `templates/user-imported/`, mencatat sumbernya, kemudian membuat konfigurasi yang dapat disesuaikan. Jangan membiarkan agent menciptakan format dan menyebutnya sebagai standar resmi.

### Metode penggunaan sehari-hari

Setelah proyek terpasang, kamu tidak perlu mengulang prompt induk di atas setiap kali. Gunakan instruksi tugas yang lebih singkat, misalnya:

`Implementasikan Fase 1 NitZ-909 berdasarkan PROJECT_AUDIT.md dan IMPLEMENTATION_PLAN.md. Kerjakan sampai alur pembuatan proyek, input bahan, ekspor DOCX/PDF, dan tesnya benar-benar berjalan. Lakukan plan, build, review, verify, dan laporkan hasil beserta bukti tes. Jangan mengerjakan modul lain yang belum menjadi dependensi fase ini.`

Kemudian lanjutkan ke fase PPTX, XLSX, template, infografis, dan Android setelah fondasinya lolos tes.