@echo off
REM SPDX-License-Identifier: MIT
REM Copyright (c) 2026 HaruLerrz

setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\claw-rgb-slot-gui-v6.ps1"
pause
