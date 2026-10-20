<#
.SYNOPSIS
  Perbaiki encoding berkas .ps1 agar aman di Windows PowerShell 5.

.DESCRIPTION
  Windows PowerShell 5 (powershell.exe) membaca berkas .ps1 tanpa BOM
  sebagai ANSI (Windows-1252), bukan UTF-8. Karakter non-ASCII seperti
  em-dash (-, U+2014) menjadi byte 0x94, yang PowerShell 5 anggap sebagai
  smart-quote penutup string. Akibatnya berkas gagal diparse dengan pesan
  yang tak menjelaskan: "The string is missing the terminator".

  PowerShell 7 (pwsh) selalu memakai UTF-8, jadi berkasnya_ok di sana -
  tetapi ANYA skrip harus bisa jalan di kedua versi.

  Perbaikan: ganti karakter non-ASCII dengan padanan ASCII, lalu tulis
  ulang dengan BOM UTF-8 supaya kedua versi membacanya sama.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/perbaiki-encoding.ps1
#>
[CmdletBinding()]
param(
  # Default: direktori induk folder scripts. `$PSScriptRoot` tak selalu
  # terisi di Windows PowerShell 5, jadi pakai lokasi file ini sebagai
  # cadangan.
  [string]$Akar = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($Akar)) {
  # `$PSScriptRoot`/`$PSCommandPath` tak selalu terisi di Windows
  # PowerShell 5. Fallback: folder tempat skrip ini dijalankan.
  $Akar = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
  if (-not (Test-Path (Join-Path $Akar "scripts"))) {
    $Akar = Split-Path -Parent $Akar
  }
}

# Padanan ASCII untuk karakter non-ASCII yang sering dipakai di skrip ini.
$peta = @{
  [char]0x2014 = "-"   # em dash
  [char]0x2013 = "-"   # en dash
  [char]0x2018 = "'"   # left single quote
  [char]0x2019 = "'"   # right single quote
  [char]0x201C = '"'   # left double quote
  [char]0x201D = '"'   # right double quote
  [char]0x2026 = "..."  # ellipsis
  [char]0x00D7 = "x"   # multiplication sign
}

$diubah = 0
# Hanya folder scripts/ milik repo ini. `node_modules` sengaja dikecualikan
# (dikendalikan paket, bukan kode kita).
$daftar = Get-ChildItem -Path (Join-Path $Akar "scripts") -Recurse -Filter *.ps1 -File -ErrorAction SilentlyContinue
if (-not $daftar) {
  Write-Host "Tidak ada .ps1 di folder scripts." -ForegroundColor Yellow
  exit 0
}
$daftar | ForEach-Object {
  $path = $_.FullName
  $teks = [System.IO.File]::ReadAllText($path)
  $asli = $teks

  foreach ($k in $peta.Keys) {
    $teks = $teks.Replace([string]$k, $peta[$k])
  }

  # Sisa karakter non-ASCII (mis. CJK) dibuang agar aman di ANSI.
  $bersih = -join ($teks.ToCharArray() | ForEach-Object {
    if ([int]$_ -le 127) { $_ } else { "" }
  })

  if ($bersih -ne $asli) {
    # Tulis dengan BOM UTF-8: kedua versi PowerShell membacanya sama.
    $enc = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($path, $bersih, $enc)
    Write-Host "  Diperbaiki: $($_.Name)" -ForegroundColor Yellow
    $diubah++
  } else {
    # Tetap pastikan ada BOM.
    $b = [System.IO.File]::ReadAllBytes($path)
    $punyaBom = ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
    if (-not $punyaBom) {
      $enc = New-Object System.Text.UTF8Encoding($true)
      [System.IO.File]::WriteAllText($path, $teks, $enc)
      Write-Host "  Ditambah BOM: $($_.Name)" -ForegroundColor Yellow
      $diubah++
    }
  }
}

Write-Host ""
if ($diubah -eq 0) {
  Write-Host "Semua .ps1 sudah aman (ASCII + BOM)." -ForegroundColor Green
} else {
  Write-Host "$diubah berkas diperbaiki." -ForegroundColor Green
}
