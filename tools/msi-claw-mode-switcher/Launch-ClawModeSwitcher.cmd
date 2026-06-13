@echo off
REM SPDX-License-Identifier: MIT
REM Copyright (c) 2026 HaruLerrz
setlocal
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0ClawModeSwitcher.ps1"
if errorlevel 1 (
    echo.
    echo MSI Claw Mode Switcher failed to start.
    echo Please run Debug-ClawModeSwitcher.cmd for details.
    pause
)
endlocal
