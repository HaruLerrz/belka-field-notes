@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm was not found. Install Node.js first.
  pause
  exit /b 1
)
if exist "%~dp0package-lock.json" (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 exit /b 1
call npm run build:viewer
if errorlevel 1 exit /b 1
echo.
echo Viewer bundle rebuilt successfully.
pause
