@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "BATCH_LOG=%TEMP%\CRMTool-Install-batch.log"
set "PS_LOG=%TEMP%\CRMTool-Install-ps.log"

echo Batch log: %BATCH_LOG%
echo PS log: %PS_LOG%

del /q "%BATCH_LOG%" 2>nul
del /q "%PS_LOG%" 2>nul

if not exist "%~dp0scripts\installer\Install-CRM-Tool.ps1" (
  echo FAIL: Missing scripts\installer\Install-CRM-Tool.ps1
  echo Batch log: %BATCH_LOG%
  echo PS log: %PS_LOG%
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0scripts\installer\Install-CRM-Tool.ps1" ^
  -RepoRoot "%~dp0" ^
  -PsLogPath "%PS_LOG%" ^
  1>>"%BATCH_LOG%" 2>>&1

set "EC=%ERRORLEVEL%"

if not "%EC%"=="0" (
  echo.
  echo FAIL: Install failed with exit code %EC%
  echo Batch log: %BATCH_LOG%
  echo PS log: %PS_LOG%
  pause
  exit /b %EC%
)

echo.
echo SUCCESS: Installed CRM Tool. Use the Desktop shortcut: "CRM Tool"
exit /b 0
