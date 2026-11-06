@echo off
REM ============================================================
REM  JALANKAN - Auto Generator Office (Windows)
REM  Node.js akan diunduh otomatis bila belum terpasang.
REM  Buka http://localhost:5173 setelah pesan "Local" muncul.
REM ============================================================
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -Mode dev
echo.
echo  Server dihentikan.
pause
endlocal
