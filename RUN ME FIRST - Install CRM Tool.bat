@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "BATCH_LOG=%TEMP%\CRMTool-Install-batch.log"
set "PS_LOG=%TEMP%\CRMTool-Install-ps.log"
set "LNK=%USERPROFILE%\Desktop\CRM Tool.lnk"

del /q "%BATCH_LOG%" 2>nul
del /q "%PS_LOG%" 2>nul

echo Batch log: %BATCH_LOG%
echo PS log: %PS_LOG%

if not exist "%~dp0Start CRM.bat" (
  echo FAIL: Missing Start CRM.bat in this folder.>>"%BATCH_LOG%"
  echo FAIL: Missing Start CRM.bat in this folder.
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
  -PsLogPath "%PS_LOG%" ^
  1>>"%BATCH_LOG%" 2>>&1

set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo FAIL: Installer PowerShell failed exit code %EC%
  echo See: %BATCH_LOG%
  echo See: %PS_LOG%
  pause
  exit /b %EC%
)

if not exist "%LNK%" (
  echo FAIL: Shortcut was not created: %LNK%>>"%BATCH_LOG%"
  echo FAIL: Shortcut was not created: %LNK%
  echo See: %BATCH_LOG%
  echo See: %PS_LOG%
  pause
  exit /b 2
)

echo SUCCESS: Shortcut created: %LNK%
echo Launching CRM Tool...
"%LNK%"
exit /b 0
