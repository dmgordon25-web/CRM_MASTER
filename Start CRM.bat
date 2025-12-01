@echo off
setlocal
cd /d "%~dp0"

REM Kill any existing node.exe processes to prevent zombie instances
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul 2>&1

set "SERVER_CMD=node tools\node_static_server.js crm-app"
echo [CRM] Working directory: %CD%
echo [CRM] Launching static server: %SERVER_CMD%

%SERVER_CMD%
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%
