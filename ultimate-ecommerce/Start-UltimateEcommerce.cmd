@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-UltimateEcommerce.ps1"
if errorlevel 1 pause
