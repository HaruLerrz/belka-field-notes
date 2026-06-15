$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

[System.Windows.Forms.Application]::EnableVisualStyles()

try {
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = "選擇需要修正路徑的增量 ZIP"
    $dialog.Filter = "ZIP 壓縮檔 (*.zip)|*.zip"
    $dialog.Multiselect = $false

    if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
        exit 0
    }

    $sourceZip = $dialog.FileName
    $directory = [System.IO.Path]::GetDirectoryName($sourceZip)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($sourceZip)
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $targetZip = Join-Path $directory ($baseName + "_portable_" + $timestamp + ".zip")

    $sourceStream = [System.IO.File]::OpenRead($sourceZip)
    $targetStream = [System.IO.File]::Open(
        $targetZip,
        [System.IO.FileMode]::CreateNew,
        [System.IO.FileAccess]::ReadWrite,
        [System.IO.FileShare]::None
    )

    try {
        $sourceArchive = New-Object System.IO.Compression.ZipArchive(
            $sourceStream,
            [System.IO.Compression.ZipArchiveMode]::Read,
            $false,
            [System.Text.Encoding]::UTF8
        )
        $targetArchive = New-Object System.IO.Compression.ZipArchive(
            $targetStream,
            [System.IO.Compression.ZipArchiveMode]::Create,
            $false,
            [System.Text.Encoding]::UTF8
        )

        try {
            foreach ($sourceEntry in $sourceArchive.Entries) {
                if ([string]::IsNullOrEmpty($sourceEntry.Name)) {
                    continue
                }

                $fixedName = $sourceEntry.FullName.Replace('\', '/').TrimStart('/')
                $targetEntry = $targetArchive.CreateEntry(
                    $fixedName,
                    [System.IO.Compression.CompressionLevel]::Optimal
                )
                $targetEntry.LastWriteTime = $sourceEntry.LastWriteTime

                $input = $sourceEntry.Open()
                $output = $targetEntry.Open()
                try {
                    $input.CopyTo($output)
                }
                finally {
                    $output.Dispose()
                    $input.Dispose()
                }
            }
        }
        finally {
            $targetArchive.Dispose()
            $sourceArchive.Dispose()
        }
    }
    finally {
        $targetStream.Dispose()
        $sourceStream.Dispose()
    }

    [System.Windows.Forms.MessageBox]::Show(
        "修正完成。`r`n`r`n新檔案：`r`n$targetZip`r`n`r`nZIP 內部路徑已全部改用正斜線 /。",
        "Belka 3D ZIP 路徑修復",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null

    Start-Process explorer.exe -ArgumentList "/select,`"$targetZip`""
}
catch {
    [System.Windows.Forms.MessageBox]::Show(
        "修復失敗：`r`n`r`n$($_.Exception.Message)",
        "Belka 3D ZIP 路徑修復",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}
