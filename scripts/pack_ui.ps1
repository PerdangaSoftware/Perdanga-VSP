$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$uiDir = Join-Path $rootDir "ui"
$outDir = Join-Path $rootDir "build\resources"
$outPak = Join-Path $outDir "ui.pak"

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$files = Get-ChildItem -Path $uiDir -Recurse -File | Where-Object {
    $_.Name -ne ".gitkeep" -and
    $_.Extension -ne ".bak" -and
    $_.Extension -ne ".tmp" -and
    $_.Extension -ne ".md"
}

$entries = @()
$contentBytes = New-Object System.IO.MemoryStream

foreach ($file in $files) {
    $relPath = $file.FullName.Substring($uiDir.Length).TrimStart("\", "/")
    $pakPath = "ui/" + ($relPath -replace "\\", "/")
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    
    $offset = [uint32]$contentBytes.Position
    $size = [uint32]$bytes.Length
    $contentBytes.Write($bytes, 0, $bytes.Length)

    $pathBytes = [System.Text.Encoding]::UTF8.GetBytes($pakPath)
    $entries += [PSCustomObject]@{
        PathBytes = $pathBytes
        Offset    = $offset
        Size      = $size
    }
}

$tableSize = 0
foreach ($e in $entries) {
    $tableSize += 2 + $e.PathBytes.Length + 4 + 4
}
$headerSize = 8 + $tableSize

$pakStream = New-Object System.IO.FileStream($outPak, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter($pakStream)

$writer.Write([uint32]0x314B4150)
$writer.Write([uint32]$entries.Count)

foreach ($e in $entries) {
    $writer.Write([uint16]$e.PathBytes.Length)
    $writer.Write($e.PathBytes)
    $writer.Write([uint32]($headerSize + $e.Offset))
    $writer.Write([uint32]$e.Size)
}

$contentBytes.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null
$contentBytes.CopyTo($pakStream)

$writer.Flush()
$writer.Close()
$pakStream.Close()
$contentBytes.Close()

$iconsOut = Join-Path $rootDir "build\icons"
if (-not (Test-Path $iconsOut)) {
    New-Item -ItemType Directory -Path $iconsOut -Force | Out-Null
}
Copy-Item (Join-Path $uiDir "ico\*.ico") $iconsOut -Force
