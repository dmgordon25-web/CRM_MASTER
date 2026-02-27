@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "BATCH_LOG=%TEMP%\CRMTool-Install-batch.log"
set "PS_LOG=%TEMP%\CRMTool-Install-ps.log"

if exist "%BATCH_LOG%" del /f /q "%BATCH_LOG%" >nul 2>&1
if exist "%PS_LOG%" del /f /q "%PS_LOG%" >nul 2>&1

if not exist "%~dp0scripts\installer\Install-CRM-Tool.ps1" (
  echo [CRM INSTALL][FAIL] Missing installer script:
  echo   %~dp0scripts\installer\Install-CRM-Tool.ps1
  echo Logs:
  echo   %BATCH_LOG%
  echo   %PS_LOG%
  pause
  exit /b 1
)

echo [CRM INSTALL] Running installer...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installer\Install-CRM-Tool.ps1" -RepoRoot "%~dp0" 1>>"%BATCH_LOG%" 2>>&1
set "EXIT_CODE=%ERRORLEVEL%"

if not "%EXIT_CODE%"=="0" (
  echo [CRM INSTALL][FAIL] Installer failed with exit code %EXIT_CODE%.
  echo Review logs:
  echo   %BATCH_LOG%
  echo   %PS_LOG%
  pause
  exit /b 1
)

echo [CRM INSTALL][OK] Installation completed successfully.
exit /b 0
