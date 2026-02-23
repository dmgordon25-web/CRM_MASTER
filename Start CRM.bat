@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo Starting CRM launcher...
set "ROOT=%~dp0"
cd /d "%ROOT%"

set "LOG=%ROOT%launcher.log"
>"%LOG%" echo [%DATE% %TIME%] Starting root launcher...
call :log [CRM] Building release package...

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%build_release.ps1" >> "%LOG%" 2>&1
if not "%errorlevel%"=="0" call :fail [CRM] Release build failed. See launcher.log.

if not exist "%ROOT%release\CRM\Start CRM.bat" call :fail [CRM] Missing canonical launcher at release\CRM\Start CRM.bat.

call :log [CRM] Launching canonical entrypoint: release\CRM\Start CRM.bat
start "" "%ROOT%release\CRM\Start CRM.bat"
call :log [CRM] Root launcher complete.
exit /b 0

:log
echo %~1
>>"%LOG%" echo [%DATE% %TIME%] %~1
exit /b 0

:fail
call :log %~1
start "" notepad.exe "%LOG%"
echo.
echo Launcher failed. See launcher.log for details.
pause
exit /b 1
