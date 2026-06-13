# SPDX-License-Identifier: MIT
# Copyright (c) 2026 HaruLerrz
# MSI Claw Mode Switcher v0.1.2
# Switches the Windows ConvertibilityEnabled override used in:
# HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl

param(
    [switch]$DebugMode
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Improve scaling on high-DPI handheld displays.
try {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class DpiHelper {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
}
"@
    [void][DpiHelper]::SetProcessDPIAware()
} catch {
    # The UI still works if DPI initialization is unavailable.
}

$RegistryPath = "HKLM:\SYSTEM\CurrentControlSet\Control\PriorityControl"
$ValueName = "ConvertibilityEnabled"
$SlateValueName = "ConvertibleSlateMode"

function Test-IsAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Start-ElevatedSelf {
    $scriptPath = $PSCommandPath
    if ([string]::IsNullOrWhiteSpace($scriptPath)) {
        throw "無法取得程式路徑。"
    }

    $arguments = @(
        "-NoProfile"
        "-STA"
        "-ExecutionPolicy"
        "Bypass"
    )

    if ($DebugMode) {
        # Keep the elevated PowerShell window available for diagnostics.
        $arguments += "-NoExit"
    } else {
        $arguments += @("-WindowStyle", "Hidden")
    }

    $arguments += @("-File", "`"$scriptPath`"")

    if ($DebugMode) {
        $arguments += "-DebugMode"
    }

    Start-Process -FilePath "powershell.exe" -ArgumentList $arguments -Verb RunAs
}

if (-not (Test-IsAdministrator)) {
    try {
        Start-ElevatedSelf
    } catch {
        if ($DebugMode) {
            Write-Error $_
        }
        [System.Windows.Forms.MessageBox]::Show(
            "需要系統管理員權限才能切換模式。`r`n`r`n$($_.Exception.Message)",
            "MSI Claw 模式切換器",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    }
    exit
}

function Get-ModeInfo {
    if (Test-Path -Path $RegistryPath) {
        $properties = Get-ItemProperty -Path $RegistryPath -ErrorAction Stop
    } else {
        $properties = [pscustomobject]@{}
    }

    $hasConvertibilityValue = $null -ne $properties.PSObject.Properties[$ValueName]
    $hasSlateValue = $null -ne $properties.PSObject.Properties[$SlateValueName]

    $convertibilityValue = if ($hasConvertibilityValue) {
        [int]$properties.$ValueName
    } else {
        $null
    }

    $slateValue = if ($hasSlateValue) {
        [int]$properties.$SlateValueName
    } else {
        $null
    }

    if (-not $hasConvertibilityValue) {
        return [pscustomobject]@{
            Name = "掌機觸控模式（自動判定）"
            Description = "ConvertibilityEnabled 未設定，交由 Windows 與 MSI 的裝置姿態資訊自動判定。"
            Detail = "ConvertibilityEnabled：未設定`r`nConvertibleSlateMode：$(if ($null -eq $slateValue) { '未設定' } else { '0x{0:X}' -f $slateValue })"
            Kind = "Automatic"
        }
    }

    if ($convertibilityValue -eq 0) {
        return [pscustomobject]@{
            Name = "桌面視窗模式"
            Description = "ConvertibilityEnabled = 0，可避免傳統小視窗被平板介面強制撐滿。"
            Detail = "ConvertibilityEnabled：0x0`r`nConvertibleSlateMode：$(if ($null -eq $slateValue) { '未設定' } else { '0x{0:X}' -f $slateValue })"
            Kind = "Desktop"
        }
    }

    return [pscustomobject]@{
        Name = "未知自訂狀態"
        Description = "偵測到 ConvertibilityEnabled = $convertibilityValue。本工具不會自動覆寫，請選擇需要的模式。"
        Detail = "ConvertibilityEnabled：0x{0:X}`r`nConvertibleSlateMode：{1}" -f $convertibilityValue, $(if ($null -eq $slateValue) { '未設定' } else { '0x{0:X}' -f $slateValue })
        Kind = "Unknown"
    }
}

function Restart-WindowsExplorer {
    Get-Process -Name explorer -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Milliseconds 700
    Start-Process "$env:WINDIR\explorer.exe"
}

function Show-OperationError {
    param(
        [string]$Operation,
        [System.Management.Automation.ErrorRecord]$ErrorRecord
    )

    $message = "$Operation 失敗。`r`n`r`n$($ErrorRecord.Exception.Message)"

    if ($DebugMode) {
        Write-Error $ErrorRecord
    }

    [System.Windows.Forms.MessageBox]::Show(
        $message,
        "MSI Claw 模式切換器",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Confirm-Switch([string]$targetName) {
    $message = "即將切換為「$targetName」。"
    if ($restartExplorerCheckBox.Checked) {
        $message += "`r`n`r`n檔案總管將重新啟動，所有已開啟的檔案總管視窗會關閉。"
    } else {
        $message += "`r`n`r`n設定寫入後，需登出、重新啟動檔案總管或重新開機才會完整生效。"
    }
    $message += "`r`n`r`n是否繼續？"

    $result = [System.Windows.Forms.MessageBox]::Show(
        $message,
        "確認切換",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )
    return $result -eq [System.Windows.Forms.DialogResult]::Yes
}

function Apply-DesktopMode {
    if (-not (Confirm-Switch "桌面視窗模式")) {
        return
    }

    try {
        New-Item -Path $RegistryPath -Force | Out-Null
        New-ItemProperty -Path $RegistryPath -Name $ValueName -PropertyType DWord -Value 0 -Force | Out-Null

        if ($restartExplorerCheckBox.Checked) {
            Restart-WindowsExplorer
        }

        Update-Status
        [System.Windows.Forms.MessageBox]::Show(
            "已切換為桌面視窗模式。`r`n`r`n傳統小視窗應會以正常尺寸開啟。部分觸控最佳化行為可能因此停用。",
            "切換完成",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    } catch {
        Show-OperationError -Operation "切換為桌面視窗模式" -ErrorRecord $_
        Update-Status
    }
}

function Apply-TouchMode {
    if (-not (Confirm-Switch "掌機觸控模式（自動判定）")) {
        return
    }

    try {
        if (Test-Path -Path $RegistryPath) {
            $properties = Get-ItemProperty -Path $RegistryPath -ErrorAction Stop
            if ($null -ne $properties.PSObject.Properties[$ValueName]) {
                Remove-ItemProperty -Path $RegistryPath -Name $ValueName -Force -ErrorAction Stop
            }
        }

        if ($restartExplorerCheckBox.Checked) {
            Restart-WindowsExplorer
        }

        Update-Status
        [System.Windows.Forms.MessageBox]::Show(
            "已恢復掌機觸控模式（自動判定）。`r`n`r`nWindows 將重新使用裝置原本的姿態資訊；視窗強制滿版問題可能再次出現。",
            "切換完成",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    } catch {
        Show-OperationError -Operation "恢復掌機觸控模式" -ErrorRecord $_
        Update-Status
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "MSI Claw 模式切換器 v0.1.2"
$form.StartPosition = "CenterScreen"
$form.ClientSize = New-Object System.Drawing.Size(560, 350)
$form.MinimumSize = New-Object System.Drawing.Size(576, 389)
$form.MaximizeBox = $false
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.Font = New-Object System.Drawing.Font("Microsoft JhengHei UI", 10)

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "MSI Claw 模式切換器"
$titleLabel.Font = New-Object System.Drawing.Font("Microsoft JhengHei UI", 16, [System.Drawing.FontStyle]::Bold)
$titleLabel.Location = New-Object System.Drawing.Point(24, 20)
$titleLabel.AutoSize = $true
$form.Controls.Add($titleLabel)

$introLabel = New-Object System.Windows.Forms.Label
$introLabel.Text = "在正常桌面視窗與原廠裝置姿態自動判定之間切換。"
$introLabel.Location = New-Object System.Drawing.Point(27, 58)
$introLabel.Size = New-Object System.Drawing.Size(500, 25)
$form.Controls.Add($introLabel)

$statusGroup = New-Object System.Windows.Forms.GroupBox
$statusGroup.Text = "目前狀態"
$statusGroup.Location = New-Object System.Drawing.Point(24, 92)
$statusGroup.Size = New-Object System.Drawing.Size(512, 120)
$form.Controls.Add($statusGroup)

$statusNameLabel = New-Object System.Windows.Forms.Label
$statusNameLabel.Font = New-Object System.Drawing.Font("Microsoft JhengHei UI", 12, [System.Drawing.FontStyle]::Bold)
$statusNameLabel.Location = New-Object System.Drawing.Point(18, 27)
$statusNameLabel.Size = New-Object System.Drawing.Size(470, 28)
$statusGroup.Controls.Add($statusNameLabel)

$statusDescriptionLabel = New-Object System.Windows.Forms.Label
$statusDescriptionLabel.Location = New-Object System.Drawing.Point(18, 57)
$statusDescriptionLabel.Size = New-Object System.Drawing.Size(470, 42)
$statusDescriptionLabel.AutoEllipsis = $true
$statusGroup.Controls.Add($statusDescriptionLabel)

$desktopButton = New-Object System.Windows.Forms.Button
$desktopButton.Text = "切換為桌面視窗模式"
$desktopButton.Location = New-Object System.Drawing.Point(24, 230)
$desktopButton.Size = New-Object System.Drawing.Size(245, 42)
$desktopButton.Add_Click({ Apply-DesktopMode })
$form.Controls.Add($desktopButton)

$touchButton = New-Object System.Windows.Forms.Button
$touchButton.Text = "恢復掌機觸控模式（自動）"
$touchButton.Location = New-Object System.Drawing.Point(291, 230)
$touchButton.Size = New-Object System.Drawing.Size(245, 42)
$touchButton.Add_Click({ Apply-TouchMode })
$form.Controls.Add($touchButton)

$restartExplorerCheckBox = New-Object System.Windows.Forms.CheckBox
$restartExplorerCheckBox.Text = "切換後重新啟動 Windows 檔案總管"
$restartExplorerCheckBox.Checked = $true
$restartExplorerCheckBox.Location = New-Object System.Drawing.Point(28, 287)
$restartExplorerCheckBox.Size = New-Object System.Drawing.Size(330, 25)
$form.Controls.Add($restartExplorerCheckBox)

$detailsButton = New-Object System.Windows.Forms.Button
$detailsButton.Text = "詳細資料"
$detailsButton.Location = New-Object System.Drawing.Point(366, 283)
$detailsButton.Size = New-Object System.Drawing.Size(82, 31)
$form.Controls.Add($detailsButton)

$refreshButton = New-Object System.Windows.Forms.Button
$refreshButton.Text = "重新讀取"
$refreshButton.Location = New-Object System.Drawing.Point(454, 283)
$refreshButton.Size = New-Object System.Drawing.Size(82, 31)
$refreshButton.Add_Click({ Update-Status })
$form.Controls.Add($refreshButton)

$script:CurrentModeInfo = $null

function Update-Status {
    try {
        $script:CurrentModeInfo = Get-ModeInfo
        $statusNameLabel.Text = $script:CurrentModeInfo.Name
        $statusDescriptionLabel.Text = $script:CurrentModeInfo.Description

        switch ($script:CurrentModeInfo.Kind) {
            "Desktop" {
                $desktopButton.Enabled = $false
                $touchButton.Enabled = $true
            }
            "Automatic" {
                $desktopButton.Enabled = $true
                $touchButton.Enabled = $false
            }
            default {
                $desktopButton.Enabled = $true
                $touchButton.Enabled = $true
            }
        }
    } catch {
        $statusNameLabel.Text = "讀取失敗"
        $statusDescriptionLabel.Text = $_.Exception.Message
        $desktopButton.Enabled = $true
        $touchButton.Enabled = $true
    }
}

$detailsButton.Add_Click({
    if ($null -eq $script:CurrentModeInfo) {
        Update-Status
    }

    if ($null -eq $script:CurrentModeInfo) {
        [System.Windows.Forms.MessageBox]::Show(
            "目前無法取得登錄值詳細資料。",
            "登錄值詳細資料",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        ) | Out-Null
        return
    }

    [System.Windows.Forms.MessageBox]::Show(
        $script:CurrentModeInfo.Detail,
        "登錄值詳細資料",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
})

try {
    Update-Status
    [void]$form.ShowDialog()
} catch {
    Show-OperationError -Operation "啟動程式" -ErrorRecord $_
    exit 1
}
