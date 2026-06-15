@echo off
setlocal
cd /d "%~dp0"

if not exist "%~dp0tools\initialize_workspace.ps1" (
  echo ERROR: tools\initialize_workspace.ps1 was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\initialize_workspace.ps1" -SkipManagerConfig
if errorlevel 1 (
  echo.
  echo Workspace initialization failed.
  pause
  exit /b 1
)

where py >nul 2>nul
if not errorlevel 1 (
  start "Belka 3D Showcase Preview" /D "%~dp0" py -m http.server 8000
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Python 3 was not found.
    pause
    exit /b 1
  )
  start "Belka 3D Showcase Preview" /D "%~dp0" python -m http.server 8000
)

timeout /t 1 /nobreak >nul
start "" "http://localhost:8000/"
exit /b 0
