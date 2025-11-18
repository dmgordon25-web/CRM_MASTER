@echo off
setlocal
pushd "%~dp0"

REM Standard launcher: run dev_server directly via Node (no PowerShell hop)
node tools/dev_server.mjs
set "EXIT_CODE=%ERRORLEVEL%"

popd
endlocal & exit /b %EXIT_CODE%
