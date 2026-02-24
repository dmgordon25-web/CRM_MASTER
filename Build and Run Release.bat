@echo off
setlocal

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo [INFO] Building release package...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%build_release.ps1"
if errorlevel 1 goto :build_fail

set "START_SCRIPT=%ROOT%release\CRM\Start CRM.bat"
if not exist "%START_SCRIPT%" goto :missing_start

echo [INFO] Launching release CRM...
start "" "%START_SCRIPT%"
exit /b 0

:build_fail
echo [FAIL] Build failed while running build_release.ps1.
if exist "%ROOT%launcher.log" start "" "%ROOT%launcher.log"
pause
exit /b 1

:missing_start
echo [FAIL] Build completed but missing required launcher:
echo        "%START_SCRIPT%"
if exist "%ROOT%launcher.log" start "" "%ROOT%launcher.log"
pause
exit /b 1
