@echo off
setlocal

set "REPO_ROOT=%~dp0"
set "INSTALLER_PS=%REPO_ROOT%scripts\installer\Install-CRM-Tool.ps1"

if not exist "%INSTALLER_PS%" (
  echo [FAIL] Missing installer script: "%INSTALLER_PS%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER_PS%" -SourceRoot "%REPO_ROOT%"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
  echo.
  echo [FAIL] CRM Tool installation failed. Check %%TEMP%%\CRM_Tool_Install.log
  exit /b %INSTALL_EXIT%
)

echo.
echo Install complete
echo Use the Desktop shortcut "CRM Tool" from now on
exit /b 0
