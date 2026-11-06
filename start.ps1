<#
.SYNOPSIS
  Satu perintah untuk menjalankan Auto Generator Office di Windows.

.DESCRIPTION
  Node.js TIDAK perlu dipasang dulu. Skrip ini:
    1. memeriksa Node >= 20; kalau tidak ada, mengunduh Node LTS resmi ke
       `.runtime/node/` (verifikasi SHA256);
    2. memasang dependensi dengan npm (npm sudah termasuk dalam Node);
    3. menjalankan build atau server pengembangan.

.PARAMETER Mode
  `dev` (default) = jalankan server pengembangan di http://localhost:5173
  `install`       = pasang dependensi + build produksi, lalu selesai.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\start.ps1
  powershell -ExecutionPolicy Bypass -File .\start.ps1 -Mode install
#>
[CmdletBinding()]
param(
  [ValidateSet("dev", "install")]
  [string]$Mode = "dev"
)

$ErrorActionPreference = "Stop"
$akar = $PSScriptRoot

function Invoke-Npm {
  param([string[]]$Argumen)

  # PowerShell 5.1 menganggap tulisan ke stderr dari proses native (mis.
  # peringatan "chunk larger than 500 kB" dari Vite) sebagai error fatal
  # saat $ErrorActionPreference = "Stop". Karena itu preferensi diturunkan
  # sementara, lalu hasilnya dinilai dari $LASTEXITCODE yang sebenarnya.
  $prefLama = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & npm @Argumen 2>&1 | ForEach-Object { Write-Host $_ }
  }
  finally {
    $ErrorActionPreference = $prefLama
  }
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Argumen -join ' ') gagal (kode $LASTEXITCODE)."
  }
}

# Dot-source supaya perubahan $env:PATH dari bootstrap bertahan di sini.
. (Join-Path $akar "scripts\bootstrap-node.ps1") -Akar $akar

Write-Host ""
Write-Host "== Auto Generator Office ==" -ForegroundColor Cyan
Write-Host "   Node $(node -v) | npm $(npm -v)" -ForegroundColor DarkGray

Push-Location $akar
try {
  $modul = Join-Path $akar "node_modules"
  if (-not (Test-Path $modul)) {
    Write-Host "[1/2] Memasang dependensi (npm bawaan Node) ..." -ForegroundColor Cyan
    Invoke-Npm -Argumen @("install", "--no-audit", "--no-fund", "--legacy-peer-deps")
  }
  else {
    Write-Host "[1/2] Dependensi sudah ada, dilewati." -ForegroundColor DarkGray
  }

  if ($Mode -eq "install") {
    Write-Host "[2/2] Build produksi ..." -ForegroundColor Cyan
    Invoke-Npm -Argumen @("run", "build")
    Write-Host "" 
    Write-Host "Selesai. Jalankan aplikasi dengan: .\start.bat" -ForegroundColor Green
  }
  else {
    Write-Host "[2/2] Menjalankan server: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "      Tekan Ctrl+C untuk berhenti." -ForegroundColor DarkGray
    Invoke-Npm -Argumen @("run", "dev")
  }
}
finally {
  Pop-Location
}
