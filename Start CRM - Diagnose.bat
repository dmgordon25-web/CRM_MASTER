@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Start-CRM.ps1" -Verbose -KeepOpen
set EXIT_CODE=%ERRORLEVEL%
endlocal & exit /b %EXIT_CODE%
