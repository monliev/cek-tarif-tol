@echo off
echo ===================================================
echo MEMBERSIHKAN SESI LOGIN GITHUB YANG SALAH...
echo ===================================================
echo.
echo Menghapus credential lama untuk github.com...
cmdkey /delete:git:https://github.com
echo.
echo BERHASIL DIHAPUS.
echo.
echo Langkah selanjutnya:
echo 1. Jalankan kembali script: .\setup_github.bat
echo 2. Git akan meminta login lagi.
echo 3. Pastikan Anda login sebagai: MONLIEV (Bukan monlievt)
echo.
pause
