@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0tools\bootstrap.ps1" (
  echo ERROR: tools\bootstrap.ps1 was not found.
  echo Please fully extract the ZIP before running this file.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0tools\bootstrap.ps1"
if errorlevel 1 (
  echo.
  echo The manager failed to start.
  echo Check: logs\manager_startup_error.log
  echo.
  pause
)
