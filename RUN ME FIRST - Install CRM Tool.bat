@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "BATCH_LOG=%TEMP%\CRMTool-Install-batch.log"
del /q "%BATCH_LOG%" 2>nul

echo Batch log: %BATCH_LOG%

if not exist "%~dp0Start CRM.bat" (
  echo FAIL: Missing "Start CRM.bat" in this folder.>>"%BATCH_LOG%"
  echo FAIL: Missing "Start CRM.bat" in this folder.
  pause
  exit /b 1
)

if not exist "%~dp0scripts\installer\Install-CRM-Tool.ps1" (
  echo FAIL: Missing scripts\installer\Install-CRM-Tool.ps1>>"%BATCH_LOG%"
  echo FAIL: Missing scripts\installer\Install-CRM-Tool.ps1
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass ^
  -File "%~dp0scripts\installer\Install-CRM-Tool.ps1" ^
  -RepoRoot "%~dp0" ^
  1>>"%BATCH_LOG%" 2>>&1

set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo FAIL: Installer failed exit code %EC%
  echo See log: %BATCH_LOG%
  pause
  exit /b %EC%
)

echo SUCCESS: Desktop shortcut created. Use "CRM Tool" on your Desktop.
exit /b 0
