@echo off
rem Double-click to install Czech QWERTY International (asks for administrator rights).
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause
