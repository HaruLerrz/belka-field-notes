@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0tools\bootstrap.ps1" (
  echo ERROR: tools\bootstrap.ps1 was not found.
  echo Please fully extract the ZIP before running this file.
  pause
  exit /b 1
)
start "" powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0tools\bootstrap.ps1"
exit /b 0
