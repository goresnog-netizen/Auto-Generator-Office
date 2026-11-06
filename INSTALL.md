# Instalasi — Node.js ikut terunduh otomatis

**Anda tidak perlu memasang Node.js, pnpm, atau alat lain terlebih dahulu.**
Skrip installer memeriksa Node, dan bila belum ada (atau versinya di bawah 20),
mengunduh Node LTS resmi dari `nodejs.org` ke folder proyek.

> Catatan: bila Anda hanya mau **memakai aplikasinya**, buka
> https://goresnog-netizen.github.io/Auto-Generator-Office/ — tidak perlu
> menginstal apa pun. Panduan ini untuk menjalankan/mengembangkan secara lokal.

---

## Windows — paling mudah

| Berkas | Fungsi |
| --- | --- |
| **`setup.bat`** | Klik dua kali: unduh Node (bila perlu) + pasang dependensi + build |
| **`start.bat`** | Klik dua kali: jalankan server di `http://localhost:5173` |

Atau lewat PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1 -Mode install
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

## Linux / macOS

```bash
chmod +x start.sh scripts/bootstrap-node.sh
./start.sh install   # pasang + build
./start.sh           # jalankan server
```

---

## Yang terjadi di balik layar

1. **Cek Node.** `node --version` ≥ 20 → langsung dipakai, tidak mengunduh apa-apa.
   Node hasil unduhan sebelumnya di `.runtime/node/` juga dipakai ulang.
2. **Unduh bila perlu.** Ambil `SHASUMS256.txt` dari direktori rilis
   `https://nodejs.org/dist/latest-v22.x/`, cari arsip sesuai OS/arsitektur
   (`win-x64.zip`, `linux-x64.tar.xz`, `darwin-arm64.tar.xz`, dst), unduh,
   lalu **verifikasi SHA256**. Kalau checksum tidak cocok, arsip dibuang dan
   proses berhenti — tidak ada berkas rusak yang dipakai.
3. **Pasang & jalankan.** `npm` sudah ada di dalam arsip Node, jadi
   `npm install --legacy-peer-deps` langsung bekerja tanpa mengunduh
   package manager tambahan.

Semua hasil unduhan tersimpan di `.runtime/` (tidak di-commit, tidak mengubah
instalasi sistem, tidak butuh hak administrator). Hapus folder itu kapan saja
untuk mengunduh ulang.

## Pengaturan

| Variabel | Default | Kegunaan |
| --- | --- | --- |
| `NITZ_NODE_DIST` | `latest-v22.x` | Pilih rilis lain, mis. `latest-v24.x` |
| `NITZ_NODE_MIN` | `20` | Versi minimum yang masih dianggap cukup (khusus `.sh`) |

Contoh Windows:

```powershell
$env:NITZ_NODE_DIST = "latest-v24.x"
.\start.ps1
```

## Koneksi internet

Dibutuhkan **hanya pada kali pertama** (unduh Node + `npm install`). Setelah
itu `.runtime/` dan `node_modules/` membuat instalasi bisa dipakai ulang
tanpa unduhan baru.

## Docker - VPS atau hosting dengan Docker

Mulai semua layanan (frontend statis + DeckCraft API) dalam satu container:

```bash
docker compose up --build   # build + jalan
docker compose up           # jalan ulang (tanpa rebuild)
docker compose down         # hentikan
```

Buka **http://localhost:8090**

Docker build otomatis:
- Mengunduh DeckCraft CLI untuk Linux x64 ke dalam image
- Tidak butuh Node.js atau pnpm di host (semuanya di dalam container)
- Port default: **8090** (DeckCraft API aktif)

Untuk pakai port lain, edit `docker-compose.yml` atau set `PORT`:

```bash
PORT=8080 docker compose up
```

---

## Gangguan umum

| Gejala | Penyebab / solusi |
| --- | --- |
| `Checksum tidak cocok` | Unduhan terpotong; arsip sudah dibuang otomatis, jalankan lagi |
| `Arsip ... tidak ditemukan` | Kombinasi OS/arsitektur tidak tersedia di rilis itu; set `NITZ_NODE_DIST` ke rilis lain |
| `curl diperlukan` (Linux) | Pasang `curl`, atau unduh Node LTS secara manual |
| `npm install` gagal | Cek koneksi; hapus `node_modules/` lalu jalankan ulang |
| Port 5173 dipakai | Hentikan proses lain, atau jalankan `npm run dev -- --port 5174` |

## Keamanan

- Sumber unduhan **hanya** `nodejs.org` (HTTPS) dengan TLS 1.2+.
- Setiap arsip diverifikasi terhadap `SHASUMS256.txt` dari direktori rilis
  yang sama.
- Skrip tidak menulis ke registry, tidak mengubah PATH permanen, dan tidak
  meminta hak administrator. PATH dimodifikasi hanya untuk proses berjalan.
