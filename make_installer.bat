@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo =======================================================
echo 1. Компиляция приложения (Perdanga VSP)...
echo =======================================================

:: Завершение процесса, если он запущен
taskkill /F /IM PerdangaVSP.exe >nul 2>&1

:: Очистка старого кэша
if exist "build\CMakeCache.txt" del /f /q "build\CMakeCache.txt" >nul 2>&1

:: Сборка без промежуточных пауз
cmake -B build -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Сбой конфигурации CMake.
    pause
    exit /b 1
)

cmake --build build --config Release
if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Сбой компиляции приложения.
    pause
    exit /b 1
)

:: Копирование библиотек DLL и папки UI в build
if exist "libmpv\mpv.dll" xcopy /Y "libmpv\mpv.dll" "build\" >nul
if exist "libmpv\lib\mpv.dll" xcopy /Y "libmpv\lib\mpv.dll" "build\" >nul
if exist "libmpv\libmpv-2.dll" xcopy /Y "libmpv\libmpv-2.dll" "build\" >nul
if exist "libmpv\lib\libmpv-2.dll" xcopy /Y "libmpv\lib\libmpv-2.dll" "build\" >nul

if not exist "build\ui" mkdir "build\ui"
xcopy /E /I /Y "ui" "build\ui" >nul

if not exist "build\PerdangaVSP.exe" (
    echo.
    echo [ОШИБКА] build\PerdangaVSP.exe не найден.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo 2. Поиск компилятора Inno Setup...
echo =======================================================
set "ISCC_PATH="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    where iscc >nul 2>&1
    if !errorlevel! equ 0 (
        set "ISCC_PATH=iscc"
    ) else (
        echo.
        echo [ВНИМАНИЕ] Inno Setup 6 не обнаружен на компьютере!
        echo Установите его командой в консоли: winget install JR.InnoSetup
        echo или скачайте с официального сайта: https://jrsoftware.org/isdl.php
        echo.
        pause
        exit /b 1
    )
)

echo Найден компилятор: "!ISCC_PATH!"
echo Создание файла установки...
"!ISCC_PATH!" "installer.iss"

if %errorlevel% neq 0 (
    echo.
    echo [ОШИБКА] Не удалось создать установочный файл.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo УСПЕШНО! Готовый инсталлятор создан:
echo dist\PerdangaVSP_Setup.exe
echo =======================================================
pause