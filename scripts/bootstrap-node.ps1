<#
.SYNOPSIS
  Pastikan Node.js tersedia; unduh Node LTS resmi bila belum ada.

.DESCRIPTION
  Dipanggil oleh start.ps1 / setup.bat sebelum `npm install`.

  Urutan keputusan:
    1. Node di PATH dengan versi >= 20  -> dipakai, TIDAK mengunduh apa pun.
    2. Node hasil unduhan sebelumnya di `.runtime/node/` -> dipakai lagi.
    3. Selain itu -> unduh arsip resmi dari nodejs.org, verifikasi SHA256
       terhadap SHASUMS256.txt, lalu ekstrak ke `.runtime/node/`.

  npm sudah termasuk di dalam arsip Node, jadi tidak ada alat tambahan yang
  perlu diunduh. Folder `.runtime/` tidak di-commit (lihat .gitignore).

.PARAMETER Akar
  Akar proyek. Default: folder induk dari folder scripts/.

.PARAMETER Distribusi
  Direktori rilis nodejs.org. Default `latest-v22.x` (LTS). Bisa ditimpa
  lewat environment NITZ_NODE_DIST, mis. `latest-v24.x`.

.NOTES
  Ditulis untuk Windows PowerShell 5.1 (tidak memakai `??`, ternary, atau
  cmdlet yang hanya ada di PowerShell 7).
#>
[CmdletBinding()]
param(
  [string]$Akar = "",
  [string]$Distribusi = "",
  [int]$VersiMinimum = 20
)

$ErrorActionPreference = "Stop"
# Invoke-WebRequest/Expand-Archive di PS 5.1 membanjiri konsol dengan progress
# bar saat mengunduh ~30 MB. Matikan supaya log instalasi tetap terbaca.
$ProgressPreference = "SilentlyContinue"

if ([string]::IsNullOrWhiteSpace($Akar)) {
  $Akar = Split-Path -Parent $PSScriptRoot
}
if ([string]::IsNullOrWhiteSpace($Distribusi)) {
  $Distribusi = "latest-v22.x"
  if ($env:NITZ_NODE_DIST) { $Distribusi = $env:NITZ_NODE_DIST }
}

$runtime = Join-Path $Akar ".runtime"
$folderUnduh = Join-Path $runtime "unduhan"
$folderNode = Join-Path $runtime "node"

# nodejs.org butuh TLS 1.2; Windows PowerShell 5.1 tidak selalu aktif by default.
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # PowerShell 7 sudah benar secara default; abaikan.
}

function Test-VersiCukup {
  param([string]$Berkas, [int]$Minimum)
  try {
    $keluar = & $Berkas --version 2>$null
    if ($keluar -match '^v(\d+)\.') {
      return ([int]$Matches[1] -ge $Minimum)
    }
  } catch {
    return $false
  }
  return $false
}

function Pakai-NodeLokal {
  param([string]$Folder)
  if (-not (Test-Path $Folder)) { return $false }
  $kandidat = Get-ChildItem -Path $Folder -Directory -Filter "node-v*-win-*" -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($null -eq $kandidat) { return $false }
  $exe = Join-Path $kandidat.FullName "node.exe"
  if (-not (Test-Path $exe)) { return $false }
  if (-not (Test-VersiCukup -Berkas $exe -Minimum $VersiMinimum)) { return $false }
  $env:PATH = $kandidat.FullName + ";" + $env:PATH
  Write-Host "[Node] Memakai unduhan lokal: $($kandidat.FullName)" -ForegroundColor DarkGray
  return $true
}

# 1. Node sistem yang sudah memadai.
$nodeSistem = Get-Command node -ErrorAction SilentlyContinue
if ($null -ne $nodeSistem -and (Test-VersiCukup -Berkas $nodeSistem.Source -Minimum $VersiMinimum)) {
  Write-Host "[Node] Sudah terpasang: $(node -v) - tidak perlu mengunduh." -ForegroundColor DarkGray
  return
}

# 2. Unduhan sebelumnya.
if (Pakai-NodeLokal -Folder $folderNode) { return }

# 3. Unduh rilis resmi.
$arsitektur = "x64"
if ($env:PROCESSOR_ARCHITECTURE -match "ARM64") { $arsitektur = "arm64" }

$dasar = "https://nodejs.org/dist/$Distribusi"
Write-Host "[Node] Node.js >= $VersiMinimum tidak ditemukan. Mengunduh dari $dasar ..." -ForegroundColor Cyan

$daftar = (Invoke-WebRequest -Uri "$dasar/SHASUMS256.txt" -UseBasicParsing).Content
$cocok = ($daftar -split "`n") |
  Where-Object { $_ -match "node-v[0-9.]+-win-$arsitektur\.zip" } |
  Select-Object -First 1
if (-not $cocok) {
  throw "Arsip Node untuk win-$arsitektur tidak ditemukan di $dasar. Coba set NITZ_NODE_DIST ke rilis lain."
}

$bagian = ($cocok.Trim() -split "\s+")
$hashDiharapkan = $bagian[0].ToLowerInvariant()
$namaBerkas = $bagian[1].TrimStart("*")
$url = "$dasar/$namaBerkas"

New-Item -ItemType Directory -Force -Path $folderUnduh | Out-Null
New-Item -ItemType Directory -Force -Path $folderNode | Out-Null
$arsip = Join-Path $folderUnduh $namaBerkas

if (-not (Test-Path $arsip)) {
  Write-Host "[Node] Mengunduh $namaBerkas ..." -ForegroundColor Cyan
  Invoke-WebRequest -Uri $url -OutFile $arsip -UseBasicParsing
}

$hashAktual = (Get-FileHash -Path $arsip -Algorithm SHA256).Hash.ToLowerInvariant()
if ($hashAktual -ne $hashDiharapkan) {
  Remove-Item -Path $arsip -Force
  throw "Checksum tidak cocok untuk $namaBerkas. Unduhan dibuang; jalankan lagi."
}
Write-Host "[Node] Checksum SHA256 cocok." -ForegroundColor DarkGray

$namaFolder = $namaBerkas -replace "\.zip$", ""
$tujuan = Join-Path $folderNode $namaFolder
if (-not (Test-Path (Join-Path $tujuan "node.exe"))) {
  Write-Host "[Node] Mengekstrak ke $tujuan ..." -ForegroundColor Cyan
  Expand-Archive -Path $arsip -DestinationPath $folderNode -Force
}
if (-not (Test-Path (Join-Path $tujuan "node.exe"))) {
  throw "Ekstraksi gagal: node.exe tidak ditemukan di $tujuan."
}

$env:PATH = $tujuan + ";" + $env:PATH
Write-Host "[Node] Siap: $(node -v) | npm $(npm -v)" -ForegroundColor Green
