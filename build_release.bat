@echo off
echo Setting up Java Environment...
set JAVA_HOME=C:\Users\monli\.bubblewrap\jdk\jdk-17.0.11+9

echo Building Signed Release APK...
call .\gradlew.bat assembleRelease

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===================================================
    echo BUILD SUCCESS!
    echo APK Location: app\build\outputs\apk\release\app-release.apk
    echo Note: If signed config worked, it might be named app-release.apk please check the folder
    echo ===================================================
) else (
    echo.
    echo BUILD FAILED. Please check the errors above.
)
pause
