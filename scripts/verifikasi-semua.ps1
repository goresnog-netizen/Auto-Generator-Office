<#
.SYNOPSIS
  Jalankan seluruh suite verifikasi integrasi DeckCraft + Glassmorphism.

.DESCRIPTION
  Menjalankan pemeriksaan berurutan dan merangkum hasilnya. Bergantung pada
  `pnpm dev` (port 5180) untuk pemeriksaan berbasis HTTP/UI.
#>
$ErrorActionPreference = "Continue"
$akar = Split-Path -Parent $PSScriptRoot
Set-Location $akar

$hasil = @()
function Jalankan($nama, $perintah, $argumen) {
  Write-Host ""
  Write-Host "=== $nama ===" -ForegroundColor Cyan
  $keluaran = & $perintah @argumen 2>&1
  $kode = $LASTEXITCODE
  $teks = ($keluaran | Out-String)
  $gagal = ([regex]::Matches($teks, '\[GAGAL\]')).Count
  $lulus = ([regex]::Matches($teks, '\[OK  \]')).Count
  $script:hasil += [pscustomobject]@{
    Nama   = $nama
    Kode   = $kode
    Lulus  = $lulus
    Gagal  = $gagal
  }
  if ($gagal -gt 0) {
    Write-Host $teks -ForegroundColor DarkYellow
  } else {
    Write-Host "  $lulus pemeriksaan lulus." -ForegroundColor Green
  }
}

Jalankan "Typecheck (browser)" "npx" @("tsc", "--noEmit")
Jalankan "Typecheck (server)" "npx" @("tsc", "--noEmit", "-p", "tsconfig.server.json")
Jalankan "Unit test" "npx" @("vitest", "run", "--reporter=dot")
Jalankan "Bridge DeckCraft (Node)" "node" @("scripts/verify-deckcraft.mts")
Jalankan "Generator Node (tulis file nyata)" "node" @("scripts/verifikasi-generators.mjs")
Jalankan "Audit isi generator (konten bermakna)" "node" @("scripts/audit-isi-generator.mjs")
Jalankan "Id perintah vs engine" "node" @("scripts/verifikasi-perintah.mjs")
Jalankan "Isi PPTX" "node" @("scripts/verifikasi-pptx.mjs")

# Pemeriksaan yang butuh server dev.
$dev = $null
try {
  $null = Invoke-WebRequest -Uri "http://127.0.0.1:5180/" -UseBasicParsing -TimeoutSec 5
  $dev = $true
} catch { $dev = $false }

if ($dev) {
  $env:DASAR = "http://127.0.0.1:5180"
  $env:URL = "http://127.0.0.1:5180/"
  Jalankan "API HTTP" "node" @("scripts/verify-api.mjs")
  Jalankan "UI (Chrome DevTools)" "node" @("scripts/verify-ui.mjs")
  Jalankan "Konkurensi" "node" @("scripts/verifikasi-konkurensi.mjs")
  Jalankan "Efek kaca + kontras" "node" @("scripts/verifikasi-kaca.mjs")
  Jalankan "Audit CSS (dead selector, fallback)" "node" @("scripts/verifikasi-css.mjs")
  Jalankan "Auto-Generate (UI end-to-end)" "node" @("scripts/verifikasi-auto-generate.mjs")
  Jalankan "Audit Glassmorphism (kontras, dead CSS)" "node" @("scripts/verifikasi-audit-glass.mjs")
  Jalankan "Noise overlay terlihat?" "node" @("scripts/verifikasi-noise.mjs")
  Jalankan "Arsitektur backdrop root" "node" @("scripts/verifikasi-backdrop.mjs")
  Jalankan "Performa modern (aurora, biaya blur)" "node" @("scripts/verifikasi-performa.mjs")
} else {
  Write-Host ""
  Write-Host "Server dev tidak berjalan — lewati pemeriksaan HTTP/UI." -ForegroundColor Yellow
  Write-Host "Jalankan `pnpm dev` lalu ulangi skrip ini." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================ RINGKASAN ================" -ForegroundColor Cyan
$hasil | Format-Table -AutoSize | Out-String -Width 120 | Write-Host

$totalGagal = ($hasil | Measure-Object -Property Gagal -Sum).Sum
if ($null -eq $totalGagal) { $totalGagal = 0 }
if ($totalGagal -gt 0) {
  Write-Host "GAGAL: $totalGagal pemeriksaan bermasalah." -ForegroundColor Red
  exit 1
}
Write-Host "Semua pemeriksaan lulus." -ForegroundColor Green
exit 0
