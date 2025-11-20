@echo off
setlocal
pushd "%~dp0"

REM Kill any existing node.exe processes to prevent zombie instances
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul 2>&1

REM Standard launcher: run dev_server directly via Node (no PowerShell hop)
node tools/dev_server.mjs
set "EXIT_CODE=%ERRORLEVEL%"

popd
endlocal & exit /b %EXIT_CODE%
