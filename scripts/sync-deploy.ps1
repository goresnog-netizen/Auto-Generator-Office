<#
.SYNOPSIS
  Sinkronkan folder "Deploy Github" dengan sumber utama NitZ-909.

.DESCRIPTION
  Folder `Deploy Github/` adalah mirror yang dipush ke GitHub lalu dideploy ke
  Vercel. Supaya tidak divergen, skrip ini menyalin ulang:

    src/             Deploy Github/src/
    index.html       Deploy Github/index.html
    vite.config.ts   Deploy Github/vite.config.ts
    package.json     Deploy Github/package.json
    tsconfig.json    Deploy Github/tsconfig.json
    vercel.json      Deploy Github/vercel.json

  YANG TIDAK disalin: `server/` (kode Node untuk API DeckCraft). Vercel
  melayani aplikasi statis, jadi API DeckCraft tidak bisa hidup di sana -
  panel "DeckCraft Studio" akan tampil "Tidak tersedia" di Vercel dan tetap
  berfungsi penuh di instalasi lokal (server/serve.ts).

.PARAMETER
  -Akar : path root proyek (default: folder di atas scripts/)
#>
[CmdletBinding()]
param(
  # `$PSScriptRoot` tak selalu terisi di Windows PowerShell 5, jadi
  # lokasi kerja dipakai sebagai cadangan.
  [string]$Akar = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Akar)) {
  $Akar = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
  if (-not (Test-Path (Join-Path $Akar "package.json"))) {
    $Akar = Split-Path -Parent (Get-Location).Path
  }
}

$target = Join-Path $Akar "Deploy Github"
if (-not (Test-Path $target)) {
  throw "Folder 'Deploy Github' tidak ditemukan di $Akar"
}

# --- Folder src: salin isi, lalu buang berkas yang tidak ada di sumber ---
$srcAsal = Join-Path $Akar "src"
$srcTarget = Join-Path $target "src"

Copy-Item -Path (Join-Path $srcAsal "*") -Destination $srcTarget -Recurse -Force

# Berkas yang ada di mirror tapi tidak di sumber  hapus.
$relatifAsal = Get-ChildItem -Recurse -File $srcAsal |
  ForEach-Object { $_.FullName.Substring($srcAsal.Length + 1) }
$relatifTarget = Get-ChildItem -Recurse -File $srcTarget |
  ForEach-Object { $_.FullName.Substring($srcTarget.Length + 1) }
foreach ($r in $relatifTarget) {
  if ($relatifAsal -notcontains $r) {
    Remove-Item -LiteralPath (Join-Path $srcTarget $r) -Force
    Write-Host "  dihapus: src/$r" -ForegroundColor DarkGray
  }
}

# --- Berkas tunggal ---
# Catatan `vite.config.ts`: file sumber memuat middleware API DeckCraft.
# Middleware itu diimpor secara DINAMIS + aman, jadi menyalin file ini ke
# mirror tetap benar: folder `server/` tidak ikut disalin, import dynamic
# gagal dengan try/catch, middleware dilewati, dan build Vercel tetap jalan.
#
# Kalau suatu saat file sumber diubah ke import STATIK, build mirror akan
# pecah ("cannot find module") - itu yang dicegah oleh
# `scripts/verifikasi-fitur-deckcraft.mjs`.
foreach ($nama in @("index.html", "vite.config.ts", "package.json", "tsconfig.json", "vercel.json", "README.md", "INSTALL.md", "LICENSE", "Dockerfile", "docker-compose.yml", ".dockerignore")) {
  $asal = Join-Path $Akar $nama
  if (Test-Path $asal) {
    Copy-Item -Path $asal -Destination (Join-Path $target $nama) -Force
  }
}

Write-Host "Folder 'Deploy Github' disinkronkan." -ForegroundColor Green
Write-Host "Catatan: API DeckCraft butuh server Node, jadi tidak tersedia di Vercel." -ForegroundColor Yellow

# --- Bersihkan skrip yang tak ada di mirror ---
# `package.json` ikut disalin apa adanya, tapi mirror tak punya folder
# `scripts/` maupun `server/`. Skrip npm yang menunjuk ke sana (mis.
# `verify:all`, `serve`, `vendor:deckcraft`) akan gagal kalau dipanggil di
# mirror. Skrip yang dibutuhkan Vercel saja (`build`, `dev`, `preview`)
# yang dipertahankan; sisanya dihapus supaya tak menyesatkan.
$pkgTarget = Join-Path $target "package.json"
$pkg = Get-Content $pkgTarget -Raw | ConvertFrom-Json
$boleh = @("dev", "build", "preview", "test", "lint", "typecheck", "format")
foreach ($nama in @($pkg.scripts.PSObject.Properties.Name)) {
  if ($boleh -notcontains $nama) {
    $pkg.scripts.PSObject.Properties.Remove($nama)
    Write-Host "  skrip dihapus dari mirror: $nama" -ForegroundColor DarkGray
  }
}
# `typecheck` di sumber merujuk `tsconfig.node.json` & `tsconfig.server.json`
# yang hanya ada di repo utama (kode Node). Di mirror keduanya tak ada, jadi
# perintah typecheck disesuaikan ke satu tsconfig.
$pkg.scripts.typecheck = "tsc --noEmit"

# Serialisasi SETELAH semua perubahan skrip, bukan sebelumnya - kalau
# `$json` dihitung lebih dulu, perubahan typecheck tak ikut ke berkas.
$json = $pkg | ConvertTo-Json -Depth 20

# Tulis tanpa BOM: Windows PowerShell 5 `Set-Content -Encoding UTF8` menulis
# BOM, dan PostCSS/Vite gagal parse JSON yang diawali BOM
# ("Unexpected token '\uFEFF'"). [System.IO.File]::WriteAllText dengan
# UTF8Encoding($false) menulis UTF-8 tanpa BOM.
[System.IO.File]::WriteAllText(
  $pkgTarget,
  $json,
  (New-Object System.Text.UTF8Encoding($false))
)
