@echo off
REM ============================================================
REM  INSTALASI SEKALI KLIK - Auto Generator Office (Windows)
REM  Node.js akan diunduh otomatis bila belum terpasang.
REM  Klik dua kali berkas ini; tidak perlu buka terminal.
REM ============================================================
setlocal
cd /d "%~dp0"
echo.
echo  Menyiapkan Auto Generator Office ...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Mode install
if errorlevel 1 (
  echo.
  echo  [GAGAL] Instalasi tidak selesai. Baca pesan di atas.
) else (
  echo.
  echo  [SELESAI] Jalankan start.bat untuk membuka aplikasi.
)
echo.
pause
endlocal
