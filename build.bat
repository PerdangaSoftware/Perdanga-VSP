@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo Building Perdanga VSP
echo =======================================================

where cmake >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] CMake is not found in your PATH.
    echo Launch this script from "x64 Native Tools Command Prompt for VS".
    pause
    exit /b 1
)

:: Завершение работающего процесса (если запущен)
taskkill /F /IM PerdangaVSP.exe >nul 2>&1

:: Создаем папку src если ее нет
if not exist "src" mkdir "src"

:: Авто-исправление расширений файлов, если они сохранились как .txt
for %%F in (main mpv_player) do (
    if exist "%%F.cpp.txt" ren "%%F.cpp.txt" "%%F.cpp"
    if exist "%%F.txt" ren "%%F.txt" "%%F.cpp"
    if exist "src\%%F.cpp.txt" ren "src\%%F.cpp.txt" "%%F.cpp"
    if exist "src\%%F.txt" ren "src\%%F.txt" "%%F.cpp"
)

for %%F in (utils mpv_player) do (
    if exist "%%F.h.txt" ren "%%F.h.txt" "%%F.h"
    if exist "%%F.txt" ren "%%F.txt" "%%F.h"
    if exist "src\%%F.h.txt" ren "src\%%F.h.txt" "%%F.h"
    if exist "src\%%F.txt" ren "src\%%F.txt" "%%F.h"
)

:: Если исходники лежат в корне, аккуратно синхронизируем их в папку src
if exist "main.cpp" copy /Y "main.cpp" "src\main.cpp" >nul
if exist "mpv_player.cpp" copy /Y "mpv_player.cpp" "src\mpv_player.cpp" >nul
if exist "mpv_player.h" copy /Y "mpv_player.h" "src\mpv_player.h" >nul
if exist "utils.h" copy /Y "utils.h" "src\utils.h" >nul

:: Проверка наличия utils.h перед вызовом CMake
if not exist "src\utils.h" (
    echo [ERROR] Critical file "src\utils.h" is missing!
    echo Please create the file "src\utils.h" and paste the code from utils.h into it.
    pause
    exit /b 1
)

:: Очистка сломанного кэша CMake от предыдущих неудачных попыток
if exist "build\CMakeCache.txt" del /f /q "build\CMakeCache.txt" >nul 2>&1

:: Конфигурация CMake
cmake -B build -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] CMake configuration failed.
    pause
    exit /b 1
)

:: Компиляция проекта
cmake --build build --config Release
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Compilation failed.
    pause
    exit /b 1
)

:: Копирование библиотек libmpv в build
if exist "libmpv\mpv.dll" xcopy /Y "libmpv\mpv.dll" "build\" >nul
if exist "libmpv\lib\mpv.dll" xcopy /Y "libmpv\lib\mpv.dll" "build\" >nul
if exist "libmpv\libmpv-2.dll" xcopy /Y "libmpv\libmpv-2.dll" "build\" >nul
if exist "libmpv\lib\libmpv-2.dll" xcopy /Y "libmpv\lib\libmpv-2.dll" "build\" >nul

:: Копирование папки UI
if not exist "build\ui" mkdir "build\ui"
xcopy /E /I /Y "ui" "build\ui" >nul

echo =======================================================
echo Build successful! Executable is at: build\PerdangaVSP.exe
echo =======================================================
pause