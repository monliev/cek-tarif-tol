@echo off
echo.
echo ===================================================
echo   AUTOMATIC BUILD ^& INSTALL (DIRECT TO HP) 🚀
echo ===================================================
echo.

:: 1. Setup Environment
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_SDK_ROOT=C:\Users\monli\.bubblewrap\android_sdk"
set "PATH=%PATH%;%ANDROID_SDK_ROOT%\platform-tools;%JAVA_HOME%\bin"

:: 2. Check ADB Connection
echo [1/4] Checking Connected Device...
adb devices
echo.
echo NOTE: Pastikan HP tercolok USB ^& USB Debugging AKTIF.
echo Jika list di atas kosong, cek kabel data atau driver.
echo.

:: 3. Build APK
echo [2/4] Building APK...
call gradlew.bat assembleRelease
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build Gagal! Cek log di atas.
    pause
    exit /b %ERRORLEVEL%
)

:: 4. Install APK
echo.
echo [3/4] Installing to Device...
adb install -r app\build\outputs\apk\release\app-release.apk

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Install Gagal!
    echo Kemungkinan:
    echo 1. HP belum terdeteksi (Cek 'adb devices')
    echo 2. Ada Pop-up "Allow USB Debugging" di HP yang belum di-OK.
    echo 3. Uninstall dulu aplikasi lama di HP secara manual, lalu coba lagi.
    pause
    exit /b %ERRORLEVEL%
)

:: 5. Launch App
echo.
echo [4/4] Launching App...
adb shell monkey -p io.github.monliev.twa -c android.intent.category.LAUNCHER 1

echo.
echo ===================================================
echo   SUKSES! APLIKASI SUDAH TERBUKA DI HP ANDA ✅
echo ===================================================
echo.
pause
