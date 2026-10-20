@echo off
:: NitZ-909 Uninstaller Script
:: Menghapus instalasi NitZ-909 dari Windows (versi pengguna)

echo ============================================
echo Memulai penghapusan NitZ-909
echo ============================================

:: Set lokasi instalasi
set INSTALL_DIR=%USERPROFILE%\AppData\Local\NitZ-909
set SHORTCUT_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\NitZ-909

:: Konfirmasi penghapusan
echo Akan menghapus:
echo - %INSTALL_DIR% (semua isi aplikasi)
echo - %SHORTCUT_DIR%\NitZ-909.lnk (shortcut Start Menu)
echo.
echo Yakin ingin melanjutkan? (Tekan Y untuk ya, tombol lain untuk batal)
choice /c YN /m "Apakah Anda yakin ingin menghapus NitZ-909?"
if errorlevel 2 (
    echo Penghapusan dibatalkan.
    pause
    exit /b 0
)

:: Hapus shortcut di Start Menu
if exist "%SHORTCUT_DIR%\NitZ-909.lnk" (
    del "%SHORTCUT_DIR%\NitZ-909.lnk"
    echo ✅ Menghapus shortcut: %SHORTCUT_DIR%\NitZ-909.lnk
) else (
    echo ⚠️ Shortcut tidak ditemukan: %SHORTCUT_DIR%\NitZ-909.lnk
)

:: Hapus direktori instalasi
if exist "%INSTALL_DIR%" (
    rmdir /S /Q "%INSTALL_DIR%"
    echo ✅ Menghapus direktori instalasi: %INSTALL_DIR%
) else (
    echo ⚠️ Direktori instalasi tidak ditemukan: %INSTALL_DIR%
)

:: Hapus file konfigurasi
if exist "%INSTALL_DIR%\config.json" (
    del "%INSTALL_DIR%\config.json"
    echo ✅ Menghapus file konfigurasi
)

echo.
echo ============================================
echo ✅ Penghapusan NitZ-909 SELESAI
echo ============================================
echo.
echo Lokasi yang telah dihapus: %INSTALL_DIR%
echo Shortcut yang telah dihapus: %SHORTCUT_DIR%\NitZ-909.lnk
echo.
pause