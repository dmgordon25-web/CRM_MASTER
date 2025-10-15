@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Start-CRM.ps1"
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
  echo.
  echo Launcher reported failure. Check logs under %LOCALAPPDATA%\CRM\logs or .\logs
  pause
)
endlocal & exit /b %EXIT_CODE%
