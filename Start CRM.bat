@echo off
setlocal
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -WindowStyle Hidden node -ArgumentList 'tools/dev_server.mjs'"
popd
exit /b 0
