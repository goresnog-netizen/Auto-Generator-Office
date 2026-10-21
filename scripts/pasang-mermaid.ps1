<#
.SYNOPSIS
  Pasang mermaid-cli + Chrome untuk render diagram Mermaid.

.DESCRIPTION
  Generator diagram NitZ-909 merender Mermaid lewat `@mermaid-js/mermaid-cli`
  (mmdc), yang memakai Puppeteer untuk menjalankan Chrome headless.

  Skrip ini memasang:mmdc + puppeteer sebagai devDependency LOKAL (bukan
  global), sehingga versinya terkunci di `package.json` dan bisa direproduksi.

  Chrome TIDAK diunduh oleh Puppeteer:
   - `PUPPETEER_SKIP_DOWNLOAD=1` dipakai saat instalasi, jadi Chromium
     (~200 MB) tak pernah masuk ke cache;
   - sebagai gantinya, skrip mencari Chrome yang SUDAH terpasang di mesin
     ini dan menulis `config/puppeteer.config.json` dengan `executablePath`.

  Kalau Chrome tak ditemukan di mesin ini, Puppeteer memakai Chrome for
  Testing miliknya sendiri (cache ~/.cache/puppeteer) - proses tetap jalan.

  Keamanan:
   - `execFile` tanpa shell (tak ada interpolasi perintah);
   - `PUPPETEER_SKIP_DOWNLOAD=1` mencegah unduhan binary tak perlu;
   - config Puppeteer memakai `--no-sandbox` (wajib di banyak CI).

.PARAMETER
  -Akar   : path root proyek (default: folder di atas scripts/)
  -Chrome : path chrome.exe (default: autodeteksi)
  -CobaRender : kalau $false, lewati uji render (default $true)
#>
[CmdletBinding()]
param(
  [string]$Akar = "",
  [string]$Chrome = "",
  [bool]$CobaRender = $true
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Akar)) {
  $Akar = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Location).Path }
  if (-not (Test-Path (Join-Path $Akar "package.json"))) {
    $Akar = Split-Path -Parent (Get-Location).Path
  }
}
Set-Location $Akar

Write-Host "== NitZ-909: pemasangan mermaid-cli ==" -ForegroundColor Cyan
Write-Host "root: $Akar"

# --- 1. Prasyarat: Node cukup baru ---
$versiNode = (& node -v) -replace "^v", ""
$bagian = $versiNode -split "\."
$mayor = [int]$bagian[0]
$minor = [int]$bagian[1]
if ($mayor -lt 22 -or ($mayor -eq 22 -and $minor -lt 13)) {
  throw "Node $versiNode terlalu lama. mermaid-cli 12 butuh Node >= 22.13.0."
}
Write-Host "  Node $versiNode - OK"

# --- 2. Cari Chrome yang terpasang ---
$kandidatChrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "$env:PROGRAMFILES\Chromium\Application\chrome.exe"
)
if ([string]::IsNullOrWhiteSpace($Chrome)) {
  foreach ($k in $kandidatChrome) {
    if (Test-Path $k) { $Chrome = $k; break }
  }
}
if ([string]::IsNullOrWhiteSpace($Chrome)) {
  Write-Host "  Chrome tak ditemukan di lokasi standar." -ForegroundColor Yellow
  Write-Host "  Puppeteer akan memakai Chrome for Testing miliknya sendiri." -ForegroundColor Yellow
} else {
  Write-Host "  Chrome: $Chrome"
}

# --- 3. Pasang (devDependency lokal) ---
Write-Host ""
Write-Host "  memasang @mermaid-js/mermaid-cli + puppeteer..." -ForegroundColor Cyan
$env:PUPPETEER_SKIP_DOWNLOAD = "1"
& pnpm add -D @mermaid-js/mermaid-cli@12.0.0 puppeteer@25.15.0
if ($LASTEXITCODE -ne 0) {
  throw "pnpm add gagal (kode $LASTEXITCODE)."
}
Remove-Item Env:\PUPPETEER_SKIP_DOWNLOAD -ErrorAction SilentlyContinue

# --- 4. Tulis konfigurasi Puppeteer ---
$dirConfig = Join-Path $Akar "config"
New-Item -ItemType Directory -Path $dirConfig -Force | Out-Null
$configPath = Join-Path $dirConfig "puppeteer.config.json"

$konfig = [ordered]@{
  headless = $true
  args    = @(
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  )
}
if (-not [string]::IsNullOrWhiteSpace($Chrome)) {
  $konfig.executablePath = $Chrome
}
# Ditulis tanpa BOM: JSON dengan BOM ditolak Node ("Unexpected token").
$json = $konfig | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText(
  $configPath,
  $json,
  (New-Object System.Text.UTF8Encoding($false))
)
Write-Host ""
Write-Host "  konfigurasi ditulis: $configPath" -ForegroundColor Green

# --- 5. Uji render nyata ---
if ($CobaRender) {
  Write-Host ""
  Write-Host "  menguji render Mermaid..." -ForegroundColor Cyan
  $dirTemp = Join-Path ([System.IO.Path]::GetTempPath()) ("nitz-mmd-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
  New-Item -ItemType Directory -Path $dirTemp -Force | Out-Null
  try {
    $mmd = Join-Path $dirTemp "uji.mmd"
    $svg = Join-Path $dirTemp "uji.svg"
    # ASCII murni supaya encoding tak jadi masalah.
    [System.IO.File]::WriteAllText(
      $mmd,
      "flowchart LR`n  A[Riset] --> B[Desain]`n  B --> C[Rilis]`n",
      (New-Object System.Text.UTF8Encoding($false))
    )
    $mmdc = Join-Path $Akar "node_modules\.bin\mmdc.cmd"
    if (-not (Test-Path $mmdc)) {
      $mmdc = Join-Path $Akar "node_modules\.bin\mmdc"
    }
    & $mmdc -i $mmd -o $svg -t default -b transparent -p $configPath -q
    if ($LASTEXITCODE -ne 0) {
      throw "mmdc keluar dengan kode $LASTEXITCODE."
    }
    if (-not (Test-Path $svg)) {
      throw "mmdc selesai tapi berkas SVG tak dibuat."
    }
    $ukuran = (Get-Item $svg).Length
    $isi = Get-Content $svg -Raw
    if ($isi -notmatch "<svg" -or $isi -notmatch "Riset") {
      throw "SVG tak berisi node diagram (kemungkinan fallback)."
    }
    Write-Host "  render OK: $ukuran byte" -ForegroundColor Green
  } finally {
    Remove-Item $dirTemp -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host ""
Write-Host "Selesai. Generator diagram sekarang merender SVG sungguhan." -ForegroundColor Green
Write-Host "Detail: docs/DIAGRAM-MERMAID.md" -ForegroundColor DarkGray