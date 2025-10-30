@echo off
setlocal
REM Back-to-Boot: classic, reliable launcher — no PS JSON/PID logic.
REM Starts the dev server detached and exits. Working directory is repo root.
pushd "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath node -ArgumentList 'tools/dev_server.mjs' -WorkingDirectory '.' -WindowStyle Hidden"
popd
exit /b 0
