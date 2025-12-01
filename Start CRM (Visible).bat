@echo off
setlocal
cd /d "%~dp0"

set "PORT=%CRM_PORT%"
if not "%~1"=="" set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"

set "SERVER_CMD=node tools\node_static_server.js crm-app %PORT%"

echo [CRM] Working directory: %CD%
echo [CRM] Node version:
node -v

echo [CRM] Checking port %PORT% availability...
set "LISTEN_PID="
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  set "LISTEN_PID=%%p"
  goto :CHECK_PROCESS
)

:CHECK_PROCESS
if defined LISTEN_PID (
  for /f "delims=" %%i in ('tasklist /FI "PID eq %LISTEN_PID%" /FI "IMAGENAME eq node.exe" ^| findstr /I "node.exe"') do set "IS_NODE=1"
  if defined IS_NODE (
    echo [CRM] Node is already listening on port %PORT% (PID %LISTEN_PID%).
    echo [CRM] Opening browser to existing server...
    start "" http://127.0.0.1:%PORT%/
    endlocal & exit /b 0
  ) else (
    echo [CRM] Port %PORT% is in use by PID %LISTEN_PID% (not node.exe). Aborting launch.
    endlocal & exit /b 1
  )
)

echo [CRM] Visible fallback launcher for diagnostics; keeps console open.
echo [CRM] Launching static server: %SERVER_CMD%
start "CRM Static Server" cmd /k %SERVER_CMD%
timeout /t 1 /nobreak >nul 2>&1
start "" http://127.0.0.1:%PORT%/

endlocal & exit /b 0
