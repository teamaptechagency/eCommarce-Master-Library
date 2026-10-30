@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-MasterLibrary.ps1"
if errorlevel 1 pause
