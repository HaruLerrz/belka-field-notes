@echo off
REM SPDX-License-Identifier: MIT
REM Copyright (c) 2026 HaruLerrz
setlocal
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0ClawModeSwitcher.ps1" -DebugMode
set "EXITCODE=%ERRORLEVEL%"
echo.
echo PowerShell exit code: %EXITCODE%
if not "%EXITCODE%"=="0" pause
endlocal
exit /b %EXITCODE%
