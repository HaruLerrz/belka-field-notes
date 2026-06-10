@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\claw-rgb-slot-gui-v6.ps1"
pause
