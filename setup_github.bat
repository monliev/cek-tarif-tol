@echo off
echo Menginisialisasi Git...
git init
git add .
git commit -m "Update Final: AdMob Native + AssetLinks + Fullscreen"
git branch -M main

echo.
echo ===================================================
echo LANGKAH PENTING SELANJUTNYA:
echo ===================================================
echo 1. Buka https://github.com/new di browser Anda.
echo 2. Buat repository baru, beri nama: cek-tarif-tol
echo    (JANGAN centang "Add README file", biarkan kosong)
echo 3. Copy kode "git remote add origin..." yang muncul di GitHub.
echo 4. Paste kode tersebut di sini, lalu tekan Enter.
echo.
set /p REMOTE_URL="Paste kode git remote add origin di sini: "
%REMOTE_URL%

echo.
echo Mengupload ke GitHub (Menimpa file lama)...
git push -f -u origin main

echo.
echo ===================================================
echo SELESAI!
echo Sekarang buka Settings -> Pages di GitHub And
echo Pastikan Source diset ke 'main branch'.
echo ===================================================
pause
