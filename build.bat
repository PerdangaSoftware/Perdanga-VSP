@echo off
setlocal enabledelayedexpansion

taskkill /F /IM PerdangaVSP.exe >nul 2>&1

if exist "build\CMakeCache.txt" del /f /q "build\CMakeCache.txt" >nul 2>&1

if not exist "packages\Microsoft.Web.WebView2\build\native\include\WebView2.h" (
    if not exist "packages\Microsoft.Web.WebView2" mkdir "packages\Microsoft.Web.WebView2"
    where curl.exe >nul 2>&1
    if !errorlevel! equ 0 (
        curl.exe -fSL --retry 3 -A "Mozilla/5.0" "https://globalcdn.nuget.org/packages/microsoft.web.webview2.1.0.2903.40.nupkg" -o "packages\webview2.zip"
        where tar.exe >nul 2>&1
        if !errorlevel! equ 0 (
            tar.exe -xf "packages\webview2.zip" -C "packages\Microsoft.Web.WebView2"
        ) else (
            powershell -NoProfile -Command "Expand-Archive -Path 'packages\webview2.zip' -DestinationPath 'packages\Microsoft.Web.WebView2' -Force"
        )
        if exist "packages\webview2.zip" del /f /q "packages\webview2.zip"
    ) else (
        powershell -NoProfile -Command "[Net.ServicePointManager]::SecurityProtocol = 3072 -bor 12288; (New-Object Net.WebClient).DownloadFile('https://globalcdn.nuget.org/packages/microsoft.web.webview2.1.0.2903.40.nupkg', 'packages\webview2.zip'); Expand-Archive -Path 'packages\webview2.zip' -DestinationPath 'packages\Microsoft.Web.WebView2' -Force; Remove-Item -Path 'packages\webview2.zip' -Force"
    )
)

del /f /q "build\*.dll" >nul 2>&1
del /f /q "build\*.pdb" >nul 2>&1
del /f /q "build\*.ilk" >nul 2>&1
del /f /q "build\*.exp" >nul 2>&1
del /f /q "build\*.lib" >nul 2>&1

cmake -B build -G "NMake Makefiles" -DCMAKE_BUILD_TYPE=Release
if %errorlevel% neq 0 (
    echo [ERROR] CMake configuration failed.
    pause
    exit /b 1
)

cmake --build build --config Release
if %errorlevel% neq 0 (
    echo [ERROR] Application compilation failed.
    pause
    exit /b 1
)

del /f /q "build\*.pdb" >nul 2>&1
del /f /q "build\*.ilk" >nul 2>&1
del /f /q "build\*.exp" >nul 2>&1
del /f /q "build\*.lib" >nul 2>&1
del /f /q "build\*.dll" >nul 2>&1

if exist "libmpv\mpv.dll" (
    copy /Y "libmpv\mpv.dll" "build\mpv.dll" >nul
) else if exist "libmpv\lib\mpv.dll" (
    copy /Y "libmpv\lib\mpv.dll" "build\mpv.dll" >nul
) else if exist "libmpv\libmpv-2.dll" (
    copy /Y "libmpv\libmpv-2.dll" "build\mpv.dll" >nul
) else if exist "libmpv\lib\libmpv-2.dll" (
    copy /Y "libmpv\lib\libmpv-2.dll" "build\mpv.dll" >nul
)

if not exist "build\ui" mkdir "build\ui"
xcopy /E /I /Y "ui" "build\ui" >nul

del /f /q /s "build\ui\*.txt" >nul 2>&1
del /f /q /s "build\ui\*.map" >nul 2>&1
del /f /q /s "build\ui\*.bak" >nul 2>&1
del /f /q /s "build\ui\*.md" >nul 2>&1

if not exist "build\PerdangaVSP.exe" (
    echo [ERROR] build\PerdangaVSP.exe not found.
    pause
    exit /b 1
)

if not exist "WizardImage200.bmp" (
    powershell -NoProfile -Command ^
    "Add-Type -AssemblyName System.Drawing; ^
    $src = if (Test-Path 'VspLogo.png') { [System.Drawing.Image]::FromFile((Resolve-Path 'VspLogo.png').Path) } elseif (Test-Path 'ui\ico\GreenOrange.ico') { (New-Object System.Drawing.Icon((Resolve-Path 'ui\ico\GreenOrange.ico').Path, 256, 256)).ToBitmap() } else { $null }; ^
    if ($src) { ^
        $b = New-Object System.Drawing.Bitmap(328, 628); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(18, 21, 20)); $g.InterpolationMode = 7; $g.SmoothingMode = 2; $g.PixelOffsetMode = 2; ^
        $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $p.AddArc(24, 149, 112, 112, 180, 90); $p.AddArc(192, 149, 112, 112, 270, 90); $p.AddArc(192, 317, 112, 112, 0, 90); $p.AddArc(24, 317, 112, 112, 90, 90); $p.CloseFigure(); ^
        $g.SetClip($p); $g.DrawImage($src, 24, 149, 280, 280); $g.ResetClip(); ^
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), 1.5); $g.DrawPath($pen, $p); $pen.Dispose(); $p.Dispose(); $g.Dispose(); ^
        $b.Save('WizardImage200.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose(); ^
        $b = New-Object System.Drawing.Bitmap(164, 314); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(18, 21, 20)); $g.InterpolationMode = 7; $g.SmoothingMode = 2; $g.PixelOffsetMode = 2; ^
        $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $p.AddArc(12, 75, 56, 56, 180, 90); $p.AddArc(96, 75, 56, 56, 270, 90); $p.AddArc(96, 159, 56, 56, 0, 90); $p.AddArc(12, 159, 56, 56, 90, 90); $p.CloseFigure(); ^
        $g.SetClip($p); $g.DrawImage($src, 12, 75, 140, 140); $g.ResetClip(); ^
        $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 255, 255, 255), 1.0); $g.DrawPath($pen, $p); $pen.Dispose(); $p.Dispose(); $g.Dispose(); ^
        $b.Save('WizardImage.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose(); ^
        $b = New-Object System.Drawing.Bitmap(110, 110); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(26, 32, 29)); $g.InterpolationMode = 7; $g.SmoothingMode = 2; $g.PixelOffsetMode = 2; ^
        $g.DrawImage($src, 0, 0, 110, 110); $g.Dispose(); $b.Save('VspLogo200.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose(); ^
        $b = New-Object System.Drawing.Bitmap(55, 55); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::FromArgb(26, 32, 29)); $g.InterpolationMode = 7; $g.SmoothingMode = 2; $g.PixelOffsetMode = 2; ^
        $g.DrawImage($src, 0, 0, 55, 55); $g.Dispose(); $b.Save('VspLogo.bmp', [System.Drawing.Imaging.ImageFormat]::Bmp); $b.Dispose(); ^
        $src.Dispose(); ^
    }"
)

set "ISCC_PATH="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe" set "ISCC_PATH=%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"

if "!ISCC_PATH!"=="" (
    where iscc >nul 2>&1
    if !errorlevel! equ 0 (
        set "ISCC_PATH=iscc"
    ) else (
        echo [ERROR] Inno Setup 6 compiler not found.
        pause
        exit /b 1
    )
)

"!ISCC_PATH!" "installer.iss"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to compile installer.
    pause
    exit /b 1
)

echo Installer successfully created in dist\PerdangaVSP_Setup.exe
pause