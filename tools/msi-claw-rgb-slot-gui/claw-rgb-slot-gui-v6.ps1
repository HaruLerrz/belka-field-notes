# SPDX-License-Identifier: MIT
# Copyright (c) 2026 HaruLerrz
#
# MSI Claw protocol information was informed by the HHD project
# and verified through device testing. HHD is licensed under LGPL-2.1.

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# MSI Claw RGB Slot GUI (v6) - One-shot apply, no animation
# Dependency lookup order:
#   1. .\vendor\hidapitester.exe
#   2. hidapitester.exe available through PATH

function Resolve-HidApiTester {
  $localExe = Join-Path $PSScriptRoot 'vendor\hidapitester.exe'
  if (Test-Path $localExe) {
    return (Resolve-Path $localExe).Path
  }

  $pathCommand = Get-Command 'hidapitester.exe' -CommandType Application -ErrorAction SilentlyContinue
  if ($null -ne $pathCommand) {
    return $pathCommand.Source
  }

  return $null
}

$ExePath = Resolve-HidApiTester
if ([string]::IsNullOrWhiteSpace($ExePath)) {
  $setupPath = Join-Path $PSScriptRoot 'setup-hidapitester.ps1'
  $message = @"
hidapitester.exe was not found.

Checked:
1. $PSScriptRoot\vendor\hidapitester.exe
2. Windows PATH

Run setup-hidapitester.ps1 first, or place hidapitester.exe in the vendor folder.

Setup script:
$setupPath
"@
  [System.Windows.Forms.MessageBox]::Show($message, 'MSI Claw RGB') | Out-Null
  exit 1
}

$VIDPID = '0DB0:1901'
$UPAGE  = '0xFFA0'
$USAGE  = '0x0001'

# Your known-good header for the 0x01FA-style RGB write path
$Header = [int[]](15,0,0,60,33,1,1,250,32,0,1,9,3)
$PresetPath = Join-Path $PSScriptRoot 'claw-rgb-preset.json'

function Invoke-HidSend([int[]]$payload64) {
  if ($payload64.Length -ne 64) { throw "payload length must be 64, got $($payload64.Length)" }
  for ($i=0; $i -lt 64; $i++) {
    $v = [int]$payload64[$i]
    if ($v -lt 0 -or $v -gt 255) { throw "payload byte out of range at index $($i): $v" }
  }
  $csv = ($payload64 | ForEach-Object { $_.ToString() }) -join ','
  $out = & $ExePath --vidpid $VIDPID --usagePage $UPAGE --usage $USAGE --open -l 64 --send-output "$csv" --read-input 2>&1
  return ($out -join [Environment]::NewLine)
}

function ColorToHex([System.Drawing.Color]$c) {
  return ('{0:X2}{1:X2}{2:X2}' -f $c.R,$c.G,$c.B)
}
function HexToColor([string]$hex) {
  $h = $hex.Trim().TrimStart('#')
  if ($h.Length -ne 6) { return $null }
  try {
    $r = [Convert]::ToInt32($h.Substring(0,2),16)
    $g = [Convert]::ToInt32($h.Substring(2,2),16)
    $b = [Convert]::ToInt32($h.Substring(4,2),16)
    return [System.Drawing.Color]::FromArgb([int]$r,[int]$g,[int]$b)
  } catch { return $null }
}

# IMPORTANT: Your device shows channel rotation:
# send RGB -> device displays (B, R, G)
# Therefore to display desired RGB, send as (G, B, R).
function AddColorBytes([System.Collections.Generic.List[int]]$pkt, [System.Drawing.Color]$c) {
  $pkt.Add([int]$c.G)
  $pkt.Add([int]$c.B)
  $pkt.Add([int]$c.R)
}

function MakePacket([int]$brightness, [System.Drawing.Color[]]$slots9) {
  $b = [Math]::Max(0, [Math]::Min(100, [int]$brightness))
  $pkt = New-Object System.Collections.Generic.List[int]
  $pkt.AddRange($Header)
  $pkt.Add([int]$b)
  $pkt.Add(0)  # reserved, matches your working command

  for ($i=0; $i -lt 9; $i++) {
    $c = $slots9[$i]
    if ($null -eq $c) { $c = [System.Drawing.Color]::FromArgb(0,0,0) }
    AddColorBytes $pkt $c
  }

  while ($pkt.Count -lt 64) { $pkt.Add(0) }
  return $pkt.ToArray()
}

# -------- UI --------
$form = New-Object System.Windows.Forms.Form
$form.Text = 'MSI Claw RGB - Slot Editor (v6, one-shot)'
$form.StartPosition = 'CenterScreen'
$form.Size = [System.Drawing.Size]::new(720, 520)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false

$colorDlg = New-Object System.Windows.Forms.ColorDialog

# State: store colors as Color objects (NOT arrays) to avoid FromArgb overload issues
$slots = New-Object 'System.Drawing.Color[]' 9
for ($i=0;$i -lt 9;$i++){ $slots[$i] = [System.Drawing.Color]::FromArgb(0,0,0) }

# Top controls
$lblB = New-Object System.Windows.Forms.Label
$lblB.Text = 'Brightness'
$lblB.Location = [System.Drawing.Point]::new(20, 18)
$lblB.Size = [System.Drawing.Size]::new(70, 20)

$trackB = New-Object System.Windows.Forms.TrackBar
$trackB.Location = [System.Drawing.Point]::new(95, 10)
$trackB.Size = [System.Drawing.Size]::new(220, 45)
$trackB.Minimum = 0
$trackB.Maximum = 100
$trackB.Value = 80
$trackB.TickFrequency = 10

$btnApply = New-Object System.Windows.Forms.Button
$btnApply.Text = 'Apply'
$btnApply.Location = [System.Drawing.Point]::new(340, 14)
$btnApply.Size = [System.Drawing.Size]::new(80, 30)

$btnOff = New-Object System.Windows.Forms.Button
$btnOff.Text = 'Off'
$btnOff.Location = [System.Drawing.Point]::new(430, 14)
$btnOff.Size = [System.Drawing.Size]::new(80, 30)

$btnSave = New-Object System.Windows.Forms.Button
$btnSave.Text = 'Save'
$btnSave.Location = [System.Drawing.Point]::new(520, 14)
$btnSave.Size = [System.Drawing.Size]::new(80, 30)

$btnLoad = New-Object System.Windows.Forms.Button
$btnLoad.Text = 'Load'
$btnLoad.Location = [System.Drawing.Point]::new(610, 14)
$btnLoad.Size = [System.Drawing.Size]::new(80, 30)

# Quick Fill (optional helpers)
$lblFill = New-Object System.Windows.Forms.Label
$lblFill.Text = 'Quick Fill:'
$lblFill.Location = [System.Drawing.Point]::new(20, 65)
$lblFill.Size = [System.Drawing.Size]::new(70, 20)

$panelPick = New-Object System.Windows.Forms.Panel
$panelPick.Location = [System.Drawing.Point]::new(95, 63)
$panelPick.Size = [System.Drawing.Size]::new(50, 22)
$panelPick.BackColor = [System.Drawing.Color]::FromArgb(255,0,0)

$txtPick = New-Object System.Windows.Forms.TextBox
$txtPick.Location = [System.Drawing.Point]::new(150, 61)
$txtPick.Size = [System.Drawing.Size]::new(80, 24)
$txtPick.Text = 'FF0000'

$btnPick = New-Object System.Windows.Forms.Button
$btnPick.Text = 'Pick'
$btnPick.Location = [System.Drawing.Point]::new(240, 60)
$btnPick.Size = [System.Drawing.Size]::new(60, 26)

$btnFillRight = New-Object System.Windows.Forms.Button
$btnFillRight.Text = 'Fill slots 0-3'
$btnFillRight.Location = [System.Drawing.Point]::new(310, 58)
$btnFillRight.Size = [System.Drawing.Size]::new(110, 30)

$btnFillLeft = New-Object System.Windows.Forms.Button
$btnFillLeft.Text = 'Fill slots 4-6'
$btnFillLeft.Location = [System.Drawing.Point]::new(430, 58)
$btnFillLeft.Size = [System.Drawing.Size]::new(110, 30)

$btnFillButtons = New-Object System.Windows.Forms.Button
$btnFillButtons.Text = 'Fill slot 7 (btn)'
$btnFillButtons.Location = [System.Drawing.Point]::new(550, 58)
$btnFillButtons.Size = [System.Drawing.Size]::new(120, 30)

# Slot grid controls
$slotPanels = New-Object 'System.Windows.Forms.Panel[]' 9
$slotTexts  = New-Object 'System.Windows.Forms.TextBox[]' 9

$startX = 20
$startY = 105
$cellW  = 220
$cellH  = 60
$gapX   = 10
$gapY   = 8

for ($i=0;$i -lt 9;$i++){
  $row = [int]([Math]::Floor($i / 3))
  $col = [int]($i % 3)
  $x = [int]($startX + $col * ($cellW + $gapX))
  $y = [int]($startY + $row * ($cellH + $gapY))

  $lbl = New-Object System.Windows.Forms.Label
  $lbl.Text = "Slot $i"
  $lbl.Location = [System.Drawing.Point]::new($x, ($y + 6))
  $lbl.Size = [System.Drawing.Size]::new(50, 20)

  $p = New-Object System.Windows.Forms.Panel
  $p.Location = [System.Drawing.Point]::new(($x + 55), ($y + 6))
  $p.Size = [System.Drawing.Size]::new(40, 20)
  $p.BackColor = $slots[$i]

  $t = New-Object System.Windows.Forms.TextBox
  $t.Location = [System.Drawing.Point]::new(($x + 100), ($y + 4))
  $t.Size = [System.Drawing.Size]::new(70, 24)
  $t.Text = ColorToHex $slots[$i]

  $b = New-Object System.Windows.Forms.Button
  $b.Text = 'Pick'
  $b.Location = [System.Drawing.Point]::new(($x + 175), ($y + 2))
  $b.Size = [System.Drawing.Size]::new(40, 28)

  $slotPanels[$i] = $p
  $slotTexts[$i]  = $t

  # Fix: capture $i correctly (avoid the "always slot8" closure bug)
  $idx = $i

  $b.Add_Click( ({ 
    if ($colorDlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
      $c = $colorDlg.Color
      $slotPanels[$idx].BackColor = $c
      $slotTexts[$idx].Text = ColorToHex $c
      $slots[$idx] = $c
    }
  }.GetNewClosure()) )

  $t.Add_Leave( ({
    $c2 = HexToColor $slotTexts[$idx].Text
    if ($null -ne $c2) {
      $slotPanels[$idx].BackColor = $c2
      $slots[$idx] = $c2
      $slotTexts[$idx].Text = ColorToHex $c2
    } else {
      $slotTexts[$idx].Text = ColorToHex $slots[$idx]
    }
  }.GetNewClosure()) )

  $form.Controls.AddRange(@($lbl,$p,$t,$b))
}

$txtLog = New-Object System.Windows.Forms.TextBox
$txtLog.Location = [System.Drawing.Point]::new(20, 335)
$txtLog.Size = [System.Drawing.Size]::new(690, 140)
$txtLog.Multiline = $true
$txtLog.ReadOnly = $true
$txtLog.ScrollBars = 'Vertical'

function ApplyNow() {
  try {
    $pkt = MakePacket $trackB.Value $slots
    $txtLog.Text = Invoke-HidSend $pkt
  } catch {
    $txtLog.Text = $_.Exception.Message
  }
}

function OffNow() {
  for ($i=0;$i -lt 9;$i++){
    $slots[$i] = [System.Drawing.Color]::FromArgb(0,0,0)
    $slotPanels[$i].BackColor = $slots[$i]
    $slotTexts[$i].Text = ColorToHex $slots[$i]
  }
  ApplyNow
}

function GetQuickColor() {
  $c = HexToColor $txtPick.Text
  if ($null -eq $c) { return $panelPick.BackColor }
  return $c
}

$btnPick.Add_Click({
  if ($colorDlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
    $c = $colorDlg.Color
    $panelPick.BackColor = $c
    $txtPick.Text = ColorToHex $c
  }
})

$btnFillRight.Add_Click({
  $c = GetQuickColor
  foreach($j in 0,1,2,3){
    $slots[$j] = $c
    $slotPanels[$j].BackColor = $c
    $slotTexts[$j].Text = ColorToHex $c
  }
})

$btnFillLeft.Add_Click({
  $c = GetQuickColor
  foreach($j in 4,5,6){
    $slots[$j] = $c
    $slotPanels[$j].BackColor = $c
    $slotTexts[$j].Text = ColorToHex $c
  }
})

$btnFillButtons.Add_Click({
  # Based on your test: slot7 controls the buttons
  $c = GetQuickColor
  $j = 7
  $slots[$j] = $c
  $slotPanels[$j].BackColor = $c
  $slotTexts[$j].Text = ColorToHex $c
})

$btnApply.Add_Click({ ApplyNow })
$btnOff.Add_Click({ OffNow })

$btnSave.Add_Click({
  try {
    $data = @{
      brightness = $trackB.Value
      slots = @()
    }
    for ($i=0;$i -lt 9;$i++){ $data.slots += (ColorToHex $slots[$i]) }
    ($data | ConvertTo-Json -Depth 3) | Set-Content -Encoding UTF8 $PresetPath
    $txtLog.Text = "Saved: $PresetPath"
  } catch { $txtLog.Text = $_.Exception.Message }
})

$btnLoad.Add_Click({
  try {
    if (!(Test-Path $PresetPath)) { $txtLog.Text = "No preset: $PresetPath"; return }
    $j = Get-Content $PresetPath -Raw | ConvertFrom-Json
    $trackB.Value = [int]$j.brightness
    for ($i=0;$i -lt 9;$i++){
      $c = HexToColor $j.slots[$i]
      if ($null -ne $c){
        $slots[$i] = $c
        $slotPanels[$i].BackColor = $c
        $slotTexts[$i].Text = ColorToHex $c
      }
    }
    $txtLog.Text = "Loaded: $PresetPath"
  } catch { $txtLog.Text = $_.Exception.Message }
})

$form.Controls.AddRange(@(
  $lblB,$trackB,$btnApply,$btnOff,$btnSave,$btnLoad,
  $lblFill,$panelPick,$txtPick,$btnPick,$btnFillRight,$btnFillLeft,$btnFillButtons,
  $txtLog
))

[void]$form.ShowDialog()
