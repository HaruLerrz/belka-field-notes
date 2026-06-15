$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "logs"
$logPath = Join-Path $logDir "manager_startup_error.log"
Set-Location -LiteralPath $root
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $initializer = Join-Path $PSScriptRoot "initialize_workspace.ps1"
    if (-not (Test-Path -LiteralPath $initializer)) {
        throw "找不到工作區初始化程式：$initializer"
    }
    & $initializer

    $mainScript = Join-Path $PSScriptRoot "manager.ps1"
    if (-not (Test-Path -LiteralPath $mainScript)) {
        throw "找不到管理工具主程式：$mainScript"
    }

    & $mainScript
}
catch {
    $details = @()
    $details += "發生時間：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $details += "PowerShell：$($PSVersionTable.PSVersion)"
    $details += "錯誤：$($_.Exception.Message)"
    $details += ""
    $details += ($_ | Out-String)
    $detailsText = $details -join "`r`n"

    $encoding = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($logPath, $detailsText, $encoding)

    $message = "作品管理工具啟動失敗。`r`n`r`n$($_.Exception.Message)`r`n`r`n錯誤紀錄：`r`n$logPath"
    try {
        [System.Windows.Forms.MessageBox]::Show(
            $message,
            "Belka 3D 作品管理工具",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    catch {
        Write-Host $message
    }

    exit 1
}
