@echo off
setlocal

REM Kill any existing node.exe processes to prevent zombie instances
taskkill /F /IM node.exe /T 2>nul
timeout /t 1 /nobreak >nul 2>&1

REM Visible fallback launcher for diagnostics; keeps console open.
pushd "%~dp0"
cmd /k node tools/dev_server.mjs
popd
