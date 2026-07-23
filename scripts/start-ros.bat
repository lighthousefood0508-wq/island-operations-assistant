@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-ros.ps1"
exit /b %ERRORLEVEL%
