@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
rem Delegate to PowerShell script; it handles single-instance + PID lifecycle.
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start CRM.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
