@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "BATCH_LOG=%TEMP%\CRMTool-Install-batch.log"
set "PS_LOG=%TEMP%\CRMTool-Install-ps.log"

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

echo Using installer script: "%~dp0scripts\installer\Install-CRM-Tool.ps1"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer\Install-CRM-Tool.ps1" -RepoRoot "%~dp0" 1>>"%BATCH_LOG%" 2>>&1

set "EC=%ERRORLEVEL%"
if not "%EC%"=="0" (
  echo FAIL: Installer PowerShell failed exit code %EC%
  echo See: %BATCH_LOG%
  echo See: %PS_LOG%
  pause
  exit /b %EC%
)

set "LNK1=%USERPROFILE%\Desktop\CRM Tool.lnk"
set "LNK2="
if not "%OneDrive%"=="" set "LNK2=%OneDrive%\Desktop\CRM Tool.lnk"

if exist "%LNK1%" goto OK
if not "%LNK2%"=="" if exist "%LNK2%" goto OK

echo FAIL: Shortcut was not created on Desktop.
echo Checked: %LNK1%
if not "%LNK2%"=="" echo Checked: %LNK2%
echo See: %BATCH_LOG%
pause
exit /b 2

:OK
echo SUCCESS: Shortcut created. Launching...
if exist "%LNK1%" "%LNK1%" else "%LNK2%"
exit /b 0
