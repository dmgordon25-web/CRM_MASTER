@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
rem Diagnostic launcher keeps console visible and verbose.
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Start CRM - Diagnose.ps1"
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
