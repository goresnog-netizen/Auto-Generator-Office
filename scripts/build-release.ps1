# ============================================================
# build-release.ps1 — NitZ-909 installer & deploy-package builder
# Jalankan:  powershell -ExecutionPolicy Bypass -File scripts/build-release.ps1
# Hasil:
#   1. dist/                     -> build produksi (siap host statis)
#   2. "Deploy Github\"          -> folder siap push ke GitHub + Vercel
#   3. release\NitZ-909-v0.1.0.zip -> paket installer (dist + README + vercel.json)
# ============================================================
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "== 1/4  Build produksi ==" -ForegroundColor Cyan
& pnpm build
if ($LASTEXITCODE -ne 0) { throw "Build gagal (exit $LASTEXITCODE)" }

Write-Host "== 2/4  Siapin folder 'Deploy Github' ==" -ForegroundColor Cyan
$deploy = Join-Path $root "Deploy Github"
if (Test-Path $deploy) { Remove-Item $deploy -Recurse -Force }

$items = @("src", "templates", "index.html", "package.json", "pnpm-lock.yaml",
           "vite.config.ts", "tsconfig.json", "vercel.json", ".gitignore")
New-Item -ItemType Directory -Path $deploy -Force | Out-Null
foreach ($i in $items) {
  $src = Join-Path $root $i
  if (Test-Path $src) { Copy-Item $src -Destination $deploy -Recurse -Force }
}
# README deploy khusus
$readme = @"
# NitZ-909 — Deploy GitHub / Vercel

Folder ini berisi file produksi sumber untuk di-push ke GitHub.

## Struktur penting
- `src/`          -> kode aplikasi (React + TypeScript)
- `templates/`    -> manifest & data template (dipakai skrip verifikasi)
- `index.html`   -> entry HTML
- `vite.config.ts` + `tsconfig.json` -> konfigurasi build
- `vercel.json`   -> konfigurasi deploy Vercel (Vite, output `dist`, SPA rewrite)

## Cara deploy
### Vercel (otomatis via GitHub)
1. Push isi folder ini ke repo GitHub (git init -> add -> commit -> push).
2. https://vercel.com/new -> pilih repo -> framework **Vercel** auto-detect Vite.
3. Build Command: `pnpm build` · Output Directory: `dist` -> Deploy.

### Jalankan lokal
```bash
pnpm install
pnpm dev        # development
pnpm build      # produksi -> dist/
pnpm preview    # cek hasil build
```
"@
Set-Content -Path (Join-Path $deploy "README.md") -Value $readme -Encoding UTF8

Write-Host "== 3/4  Kemas installer ZIP ==" -ForegroundColor Cyan
$release = Join-Path $root "release"
if (Test-Path $release) { Remove-Item $release -Recurse -Force }
New-Item -ItemType Directory -Path $release -Force | Out-Null

$stage = Join-Path $release "NitZ-909-v0.1.0"
New-Item -ItemType Directory -Path $stage -Force | Out-Null
Copy-Item (Join-Path $root "dist") -Destination $stage -Recurse -Force
Copy-Item (Join-Path $root "vercel.json") -Destination $stage -Force
$installerReadme = @"
NitZ-909 v0.1.0 — Paket Installer (statis)
==========================================
Isi:
  /dist            -> aplikasi web siap host (buka lewat web server statis)
  /vercel.json      -> konfigurasi Vercel (opsional)

Hosting statis (mis. Netlify / GitHub Pages / VPS):
  1. Upload isi folder `dist` ke web server / hosting statis.
  2. Pastikan semua route mengarah ke index.html (SPA).
  3. Untuk HTTPS + CDN, gunakan Cloudflare di depan host.

Vercel:
  Taruh isi `dist` di root repo (atau biarkan Vercel build dari sumber),
  atau cukup push folder "Deploy Github" dan biarkan Vercel build.
"@
Set-Content -Path (Join-Path $stage "README.txt") -Value $installerReadme -Encoding UTF8

Compress-Archive -Path $stage -DestinationPath (Join-Path $release "NitZ-909-v0.1.0.zip") -Force

Write-Host "== 4/4  Selesai ==" -ForegroundColor Green
Write-Host "  dist/                  -> build produksi"
Write-Host "  Deploy Github\         -> siap push ke GitHub/Vercel"
Write-Host "  release\NitZ-909-v0.1.0.zip -> paket installer"
