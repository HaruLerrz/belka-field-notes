$ErrorActionPreference = "Stop"

function Write-Utf8NoBom([string]$Path, [string]$Content) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function New-PortableZip([string]$SourceDirectory, [string]$DestinationZip) {
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem

    if (Test-Path -LiteralPath $DestinationZip) {
        Remove-Item -LiteralPath $DestinationZip -Force
    }

    $sourceFull = [System.IO.Path]::GetFullPath($SourceDirectory).TrimEnd([char[]]"\/")
    $fileStream = [System.IO.File]::Open(
        $DestinationZip,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )

    try {
        $archive = New-Object System.IO.Compression.ZipArchive(
            $fileStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false,
            [System.Text.Encoding]::UTF8
        )

        try {
            $files = Get-ChildItem -LiteralPath $sourceFull -Recurse -File
            foreach ($file in $files) {
                $relativePath = $file.FullName.Substring($sourceFull.Length).TrimStart([char[]]"\/")
                $entryName = $relativePath.Replace('\', '/')

                $entry = $archive.CreateEntry(
                    $entryName,
                    [System.IO.Compression.CompressionLevel]::Optimal
                )
                $entry.LastWriteTime = $file.LastWriteTime

                $inputStream = [System.IO.File]::OpenRead($file.FullName)
                $entryStream = $entry.Open()
                try {
                    $inputStream.CopyTo($entryStream)
                }
                finally {
                    $entryStream.Dispose()
                    $inputStream.Dispose()
                }
            }
        }
        finally {
            $archive.Dispose()
        }
    }
    finally {
        $fileStream.Dispose()
    }
}

$root = Split-Path -Parent $PSScriptRoot
$initializer = Join-Path $PSScriptRoot "initialize_workspace.ps1"
if (-not (Test-Path -LiteralPath $initializer)) {
    throw "找不到工作區初始化程式：$initializer"
}
& $initializer -SkipManagerConfig

$outputDirectory = Join-Path $root "server-packages"
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$zipPath = Join-Path $outputDirectory ("Belka_3D_Showcase_Server_" + $timestamp + ".zip")
$staging = Join-Path $env:TEMP ("belka-3d-server-" + [Guid]::NewGuid().ToString("N"))

$runtimeItems = @(
    ".htaccess",
    "index.html",
    "robots.txt",
    "works.json",
    "viewer",
    "shared",
    "works",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "LICENSES"
)

New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
New-Item -ItemType Directory -Force -Path $staging | Out-Null

try {
    foreach ($relativePath in $runtimeItems) {
        $source = Join-Path $root $relativePath
        if (-not (Test-Path -LiteralPath $source)) {
            throw "缺少伺服器必要項目：$relativePath"
        }

        $destination = Join-Path $staging $relativePath
        $parent = Split-Path -Parent $destination
        if ($parent) {
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
        }

        if (Test-Path -LiteralPath $source -PathType Container) {
            Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
        } else {
            Copy-Item -LiteralPath $source -Destination $destination -Force
        }
    }

    $placeholder = Join-Path $staging "works\PUT_NEW_WORKS_HERE.txt"
    if (Test-Path -LiteralPath $placeholder) {
        Remove-Item -LiteralPath $placeholder -Force
    }

    $instructions = @"
Belka 3D Showcase｜伺服器部署包
================================

本 ZIP 已排除本機管理工具、原始碼、設定與封存資料。

請將 ZIP 上傳到網站根目錄，例如：

/domains/example.com/public_html/

接著直接解壓縮、合併並覆蓋。

本包包含：

.htaccess
index.html
robots.txt
works.json
viewer/
shared/
works/
LICENSE
THIRD_PARTY_NOTICES.md
LICENSES/

本包不包含：

manager-config.json
tools/
src/
logs/
upload-patches/
_archive/
node_modules/
.git/

初次部署完成後，可使用本機管理器新增作品，
再將 upload-patches/ 內產生的增量 ZIP 上傳到同一網站根目錄。
"@

    Write-Utf8NoBom (Join-Path $staging "README_SERVER_DEPLOY.txt") $instructions
    New-PortableZip $staging $zipPath
}
finally {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}

Write-Host ""
Write-Host "Server package created:"
Write-Host $zipPath
Write-Host ""

Start-Process explorer.exe -ArgumentList "/select,`"$zipPath`""
