@echo off
setlocal
pushd %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\Start-CRM.ps1"
popd
exit /b 0
