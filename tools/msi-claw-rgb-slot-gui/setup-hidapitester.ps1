[CmdletBinding()]
param(
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Pin the dependency to a known release instead of following "latest".
$Repository = 'todbot/hidapitester'
$ReleaseTag = 'v0.6'
$ApiUrl = "https://api.github.com/repos/$Repository/releases/tags/$ReleaseTag"
$VendorDir = Join-Path $PSScriptRoot 'vendor'
$TargetExe = Join-Path $VendorDir 'hidapitester.exe'
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("hidapitester-setup-" + [Guid]::NewGuid().ToString('N'))

function Write-Step([string]$Message) {
  Write-Host "[hidapitester setup] $Message"
}

try {
  if ((Test-Path $TargetExe) -and -not $Force) {
    Write-Step "Already installed: $TargetExe"
    Write-Step 'Use -Force to download and replace it.'
    exit 0
  }

  New-Item -ItemType Directory -Path $VendorDir -Force | Out-Null
  New-Item -ItemType Directory -Path $TempRoot -Force | Out-Null

  # Windows PowerShell 5.1 may otherwise negotiate an older TLS version.
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  $headers = @{
    'User-Agent' = 'Belka-MSI-Claw-RGB-Slot-GUI'
    'Accept' = 'application/vnd.github+json'
  }

  Write-Step "Reading official GitHub release metadata for $Repository $ReleaseTag..."
  $release = Invoke-RestMethod -Uri $ApiUrl -Headers $headers

  $candidateAssets = @($release.assets | Where-Object {
    $_.name -match '(?i)(windows|win)' -and
    $_.name -match '(?i)(x86_64|x64|amd64)' -and
    $_.name -match '(?i)\.(zip|exe)$'
  })

  if ($candidateAssets.Count -eq 0) {
    $available = @($release.assets | ForEach-Object { $_.name }) -join ', '
    throw "No Windows x86_64 ZIP or EXE asset was found in release $ReleaseTag. Available assets: $available"
  }

  $asset = $candidateAssets | Select-Object -First 1
  $downloadPath = Join-Path $TempRoot $asset.name

  Write-Step "Downloading official release asset: $($asset.name)"
  Invoke-WebRequest -Uri $asset.browser_download_url -Headers $headers -OutFile $downloadPath -UseBasicParsing

  if ($asset.name -match '(?i)\.zip$') {
    $extractDir = Join-Path $TempRoot 'extracted'
    Expand-Archive -Path $downloadPath -DestinationPath $extractDir -Force

    $downloadedExe = Get-ChildItem -Path $extractDir -Filter 'hidapitester.exe' -File -Recurse |
      Select-Object -First 1

    if ($null -eq $downloadedExe) {
      throw 'The downloaded archive did not contain hidapitester.exe.'
    }

    Copy-Item -Path $downloadedExe.FullName -Destination $TargetExe -Force
  }
  elseif ($asset.name -match '(?i)\.exe$') {
    Copy-Item -Path $downloadPath -Destination $TargetExe -Force
  }
  else {
    throw "Unsupported asset format: $($asset.name)"
  }

  if (!(Test-Path $TargetExe)) {
    throw "Installation failed: $TargetExe was not created."
  }

  Write-Step 'Checking the installed executable...'
  $versionOutput = & $TargetExe --version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "hidapitester.exe was installed, but --version returned exit code $LASTEXITCODE.`n$($versionOutput -join [Environment]::NewLine)"
  }

  Write-Step "Installed successfully: $TargetExe"
  if ($versionOutput) {
    Write-Host ($versionOutput -join [Environment]::NewLine)
  }
}
catch {
  Write-Error $_.Exception.Message
  exit 1
}
finally {
  if (Test-Path $TempRoot) {
    Remove-Item -Path $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
  }
}
