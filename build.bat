@echo off
setlocal enabledelayedexpansion

taskkill /F /IM PerdangaVSP.exe >nul 2>&1
taskkill /F /IM PerdangaVSP_Ultralight.exe >nul 2>&1

if exist "build\assets" rmdir /s /q "build\assets" >nul 2>&1
if exist "build\PerdangaVSP_Ultralight.exe" del /f /q "build\PerdangaVSP_Ultralight.exe" >nul 2>&1
if exist "build\cacert.pem" del /f /q "build\cacert.pem" >nul 2>&1
if exist "build\icudt67l.dat" del /f /q "build\icudt67l.dat" >nul 2>&1

where cl.exe >nul 2>&1
if %errorlevel% neq 0 (
    if exist "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" (
        call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
    )
)

cmake -B build -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo [ERROR] CMake configuration failed.
    exit /b 1
)

cmake --build build --config Release
if %errorlevel% neq 0 (
    echo [ERROR] Compilation failed.
    exit /b 1
)

robocopy "ultralight\resources" "build\resources" /E /NFL /NDL /NJH /NJS >nul
powershell -ExecutionPolicy Bypass -File "scripts\pack_ui.ps1"
copy /Y "ultralight\bin\*.dll" "build\" >nul
copy /Y "libmpv\mpv.dll" "build\" >nul

if exist "build\ui" rmdir /s /q "build\ui" >nul 2>&1
if exist "build\assets" rmdir /s /q "build\assets" >nul 2>&1
if exist "build\cacert.pem" del /f /q "build\cacert.pem" >nul 2>&1
if exist "build\icudt67l.dat" del /f /q "build\icudt67l.dat" >nul 2>&1

echo [SUCCESS] PerdangaVSP compiled successfully in build\PerdangaVSP.exe

set "ISCC_PATH="
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"
if not defined ISCC_PATH if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not defined ISCC_PATH if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"

if defined ISCC_PATH (
    if not exist "dist" mkdir "dist"
    echo [BUILD] Building installer with Inno Setup...
    "!ISCC_PATH!" "installer.iss"
    if !errorlevel! equ 0 (
        echo [SUCCESS] Installer successfully created in dist\PerdangaVSP_Setup.exe
    ) else (
        echo [WARNING] Installer compilation failed.
    )
) else (
    echo [WARNING] Inno Setup compiler not found. Skipping installer generation.
)
