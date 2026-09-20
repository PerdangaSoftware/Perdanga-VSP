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

:: Сборка приложения
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
echo 2. Генерация карточки со скругленными углами (Squircle)...
echo =======================================================
if not exist "VspLogo.png" (
    echo Скачивание оригинала логотипа с GitLab...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://gitlab.com/perdanga/perdanga-vsp/-/raw/main/Screenshots/VspLogo.png?ref_type=heads', 'VspLogo.png')"
)

:: Удаляем старые BMP для чистой генерации новой формы
if exist "VspLogo.bmp" del /f /q "VspLogo.bmp" >nul
if exist "WizardImage.bmp" del /f /q "WizardImage.bmp" >nul

echo 1) Создание иконки для шапки (VspLogo.bmp)...
powershell -Command "Add-Type -AssemblyName System.Drawing; $src = [System.Drawing.Image]::FromFile('VspLogo.png'); $bmp = New-Object System.Drawing.Bitmap(110, 110); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.Clear([System.Drawing.Color]::FromArgb(26, 32, 29)); $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality; $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality; $g.DrawImage($src, 0, 0, 110, 110); $g.Dispose(); $bmp.Save('VspLogo.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); $bmp.Dispose(); $src.Dispose()"

echo 2) Создание премиум-плашки со скругленными углами (WizardImage.bmp)...
powershell -Command ^
"Add-Type -AssemblyName System.Drawing; ^
$src = [System.Drawing.Image]::FromFile('VspLogo.png'); ^
$bmp = New-Object System.Drawing.Bitmap(328, 628); ^
$g = [System.Drawing.Graphics]::FromImage($bmp); ^
$g.Clear([System.Drawing.Color]::FromArgb(18, 21, 20)); ^
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; ^
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality; ^
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality; ^
$cardSize = 280; ^
$radius = 56; ^
$d = $radius * 2; ^
$x = [int]((328 - $cardSize) / 2); ^
$y = [int]((628 - $cardSize) / 2 - 25); ^
$path = New-Object System.Drawing.Drawing2D.GraphicsPath; ^
$path.AddArc($x, $y, $d, $d, 180, 90); ^
$path.AddArc(($x + $cardSize - $d), $y, $d, $d, 270, 90); ^
$path.AddArc(($x + $cardSize - $d), ($y + $cardSize - $d), $d, $d, 0, 90); ^
$path.AddArc($x, ($y + $cardSize - $d), $d, $d, 90, 90); ^
$path.CloseFigure(); ^
$g.SetClip($path); ^
$g.DrawImage($src, $x, $y, $cardSize, $cardSize); ^
$g.ResetClip(); ^
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), 1.5); ^
$g.DrawPath($pen, $path); ^
$pen.Dispose(); ^
$path.Dispose(); ^
$g.Dispose(); ^
$bmp.Save('WizardImage.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); ^
$bmp.Dispose(); ^
$src.Dispose()"

echo.
echo =======================================================
echo 3. Поиск компилятора Inno Setup...
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