@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-ros.ps1"
exit /b %ERRORLEVEL%
