<#
.SYNOPSIS
  Unduh binary DeckCraft (storytold/deckcraft) untuk dipakai NitZ-909.

.DESCRIPTION
  DeckCraft adalah reimplementasi PowerPoint open-source dalam Rust murni.
  Binary resminya dipakai NitZ-909 sebagai mesin render & ekspor presentasi:
  deckcraft-cli menjalankan DeckCraft tanpa jendela (MCP di stdio), sehingga
  integrasi berjalan headless di server lokal.

  Skrip ini mengunduh rilis resmi (v0.8.0), memverifikasi checksum SHA-256
  yang dipublikasikan GitHub, lalu mengekstraknya ke
  vendors/deckcraft-bin/app/.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/vendor-deckcraft.ps1
#>
[CmdletBinding()]
param(
  [string]$Versi = "0.8.0",
  [string]$Akar = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$folderBin = Join-Path $Akar "vendors\deckcraft-bin"
$folderApp = Join-Path $folderBin "app"
$arsip = Join-Path $folderBin "deckcraft-win-x64.zip"
$target = Join-Path $folderApp "deckcraft-$Versi-windows-x64-portable"

Write-Host "== Vendoring DeckCraft v$Versi ==" -ForegroundColor Cyan
Write-Host "  Akar   : $Akar"
Write-Host "  Target : $target"

New-Item -ItemType Directory -Force -Path $folderBin | Out-Null

# ---- Unduh bila belum ada ----
if (Test-Path $arsip) {
  Write-Host "  Arsip sudah ada, melewati unduhan." -ForegroundColor DarkGray
} else {
  $url = "https://github.com/storytold/deckcraft/releases/download/v$Versi/deckcraft-$Versi-windows-x64-portable.zip"
  Write-Host "  Mengunduh: $url"
  Invoke-WebRequest -Uri $url -OutFile $arsip -UseBasicParsing
}

# ---- Verifikasi checksum (dari metadata rilis GitHub) ----
Write-Host "  Memverifikasi checksum SHA-256..." -ForegroundColor DarkGray
try {
  $rilis = Invoke-RestMethod -Uri "https://api.github.com/repos/storytold/deckcraft/releases/tags/v$Versi" -UseBasicParsing
  $aset = $rilis.assets | Where-Object { $_.name -eq "deckcraft-$Versi-windows-x64-portable.zip" } | Select-Object -First 1
  if ($aset -and $aset.digest) {
    $harapan = ($aset.digest -replace "^sha256:", "").ToLower()
    $aktual = (Get-FileHash -Path $arsip -Algorithm SHA256).Hash.ToLower()
    if ($aktual -ne $harapan) {
      throw "Checksum tidak cocok. diharapkan $harapan, ditemukan $aktual"
    }
    Write-Host "  Checksum OK: $aktual" -ForegroundColor Green
  } else {
    Write-Host "  Rilis tidak mencantumkan digest; lewati verifikasi." -ForegroundColor Yellow
  }
} catch {
  Write-Host "  Gagal memverifikasi checksum: $($_.Exception.Message)" -ForegroundColor Yellow
  Write-Host "  Lanjutkan? Bergantung pada sumber unduhan." -ForegroundColor Yellow
}

# ---- Ekstrak ----
if (Test-Path $target) {
  Write-Host "  Binary sudah terekstrak, melewati ekstraksi." -ForegroundColor DarkGray
} else {
  Write-Host "  Mengekstrak..."
  New-Item -ItemType Directory -Force -Path $folderApp | Out-Null
  Expand-Archive -Path $arsip -DestinationPath $folderApp -Force
}

# ---- Uji jalankan ----
$cli = Join-Path $target "deckcraft-cli.exe"
if (-not (Test-Path $cli)) {
  throw "deckcraft-cli.exe tidak ditemukan di $target"
}
$versiTerReported = (& $cli --version) 2>&1
Write-Host "  deckcraft-cli melaporkan: $versiTerReported" -ForegroundColor Green

Write-Host ""
Write-Host "== Selesai ==" -ForegroundColor Green
Write-Host "Binary : $cli"
Write-Host "Jalankan app dengan API aktif:"
Write-Host "  pnpm dev"
Write-Host "Lalu buka panel 'DeckCraft Studio' di sidebar Ekspor."
