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
foreach ($nama in @("index.html", "vite.config.ts", "package.json", "tsconfig.json", "vercel.json")) {
  $asal = Join-Path $Akar $nama
  if (Test-Path $asal) {
    Copy-Item -Path $asal -Destination (Join-Path $target $nama) -Force
  }
}

Write-Host "Folder 'Deploy Github' disinkronkan." -ForegroundColor Green
Write-Host "Catatan: API DeckCraft butuh server Node, jadi tidak tersedia di Vercel." -ForegroundColor Yellow
