@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0tools\build_server_package.ps1" (
  echo ERROR: tools\build_server_package.ps1 was not found.
  pause
  exit /b 1
)
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\build_server_package.ps1"
if errorlevel 1 (
  echo.
  echo Server package build failed.
  pause
)
