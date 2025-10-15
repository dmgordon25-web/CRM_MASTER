@echo off
setlocal
pushd %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'node' -ArgumentList 'tools/dev_server.mjs' -WorkingDirectory '%CD%' -WindowStyle Hidden"
popd
exit /b 0
