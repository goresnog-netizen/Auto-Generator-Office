# NitZ-909 â€” Deploy GitHub / Vercel

Folder ini berisi file produksi sumber untuk di-push ke GitHub.

## Struktur penting
- src/          -> kode aplikasi (React + TypeScript)
- 	emplates/    -> manifest & data template (dipakai skrip verifikasi)
- index.html   -> entry HTML
- ite.config.ts + 	sconfig.json -> konfigurasi build
- ercel.json   -> konfigurasi deploy Vercel (Vite, output dist, SPA rewrite)

## Cara deploy
### Vercel (otomatis via GitHub)
1. Push isi folder ini ke repo GitHub (git init -> add -> commit -> push).
2. https://vercel.com/new -> pilih repo -> framework **Vercel** auto-detect Vite.
3. Build Command: pnpm build Â· Output Directory: dist -> Deploy.

### Jalankan lokal
`ash
pnpm install
pnpm dev        # development
pnpm build      # produksi -> dist/
pnpm preview    # cek hasil build
`
