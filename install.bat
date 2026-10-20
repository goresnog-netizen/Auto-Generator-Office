@echo off
:: NitZ-909 Installer Script
:: Instal aplikasi dokument generation platform ke Windows (versi pengguna tanpa admin)

echo ============================================
echo Memulai instalasi NitZ-909
echo ============================================

:: Cek apakah file dist sudah ada
if not exist dist\index.html (
    echo ERROR: File dist/index.html tidak ditemukan!
    echo Pastikan Anda telah menjalankan "pnpm build" terlebih dahulu.
    pause
    exit /b 1
)

echo ✅ File dist/index.html ditemukan

:: Set lokasi instalasi di direktori pengguna (tidak butuh admin)
set INSTALL_DIR=%USERPROFILE%\AppData\Local\NitZ-909
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    echo ✅ Membuat direktori instalasi: %INSTALL_DIR%
) else (
    echo ⚠️ Direktori instalasi sudah ada: %INSTALL_DIR%
)

:: Salin file dari dist ke instalasi
echo 📂 Menyalin file dari dist ke instalasi...
xcopy dist\* "%INSTALL_DIR%" /E /I /Y >nul
echo ✅ Selesai menyalin file

:: Buat shortcut di Start Menu (user-level) via PowerShell
set SHORTCUT_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\NitZ-909
if not exist "%SHORTCUT_DIR%" (
    mkdir "%SHORTCUT_DIR%"
)

echo 📌 Membuat shortcut di Start Menu...
powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT_DIR%\NitZ-909.lnk'); $s.TargetPath = '%INSTALL_DIR%\index.html'; $s.WorkingDirectory = '%INSTALL_DIR%'; $s.IconLocation = '%INSTALL_DIR%\favicon.ico'; $s.Description = 'NitZ-909 Document Generator'; $s.Save()"
echo ✅ Shortcut dibuat: %SHORTCUT_DIR%\NitZ-909.lnk

:: Tulis konfigurasi
echo Menulis konfigurasi...
echo installDir=%INSTALL_DIR% > "%INSTALL_DIR%\config.json"
echo shortcut=%SHORTCUT_DIR%\NitZ-909.lnk >> "%INSTALL_DIR%\config.json"

echo.
echo ============================================
echo ✅ Instalasi NitZ-909 SELESAI
echo ============================================
echo.
echo Lokasi instalasi: %INSTALL_DIR%
echo Jalur shortcut: %SHORTCUT_DIR%\NitZ-909.lnk
echo.
echo Cara menjalankan:
echo 1. Buka Menu Start → NitZ-909
echo 2. Atau langsung buka: %INSTALL_DIR%\index.html
echo.
pause