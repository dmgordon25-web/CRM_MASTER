@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo =====================================
echo CRM Tool Launcher (Safe Mode)
echo =====================================
echo.

REM --- locate node ---
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found.
    echo Install Node.js from https://nodejs.org
    pause
    exit /b 1
)

for /f "delims=" %%I in ('where node') do (
    set "NODE_EXE=%%I"
    goto :node_found
)

:node_found
echo Using Node: "%NODE_EXE%"

REM --- verify server.js ---
if not exist "server.js" (
    echo ERROR: server.js not found in this folder.
    pause
    exit /b 1
)

set PORT=8080

echo Starting CRM server on port %PORT%...

start "" "%NODE_EXE%" "%CD%\server.js" --port %PORT%

echo Waiting for server to start...
timeout /t 3 >nul

echo Opening browser...
start "" http://127.0.0.1:%PORT%

echo.
echo CRM should now be opening.
echo You may close this window.
pause
exit /b 0
