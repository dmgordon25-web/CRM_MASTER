@echo off
setlocal

set "ROOT=%~dp0"
set "SCRIPT=%ROOT%Create Desktop Shortcut.ps1"

if not exist "%SCRIPT%" (
  echo [FAIL] Missing shortcut script: "%SCRIPT%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
if errorlevel 1 (
  echo [FAIL] Desktop shortcut creation failed.
  exit /b 1
)

echo [OK] Desktop shortcut created.
exit /b 0
