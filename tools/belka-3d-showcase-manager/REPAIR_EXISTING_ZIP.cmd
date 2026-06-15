@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0tools\repair_zip.ps1"
if errorlevel 1 (
  echo.
  echo ZIP repair failed.
  pause
)
