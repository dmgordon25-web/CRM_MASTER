@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ==========================================
echo CRM Tool - First Run Launcher
echo Folder: "%CD%"
echo ==========================================
echo.

if not exist "Start CRM.bat" (
  echo ERROR: "Start CRM.bat" not found in this folder.
  echo Make sure you unzipped the download and are running this from the CRM_MASTER folder.
  echo.
  pause
  exit /b 1
)

echo Launching CRM Tool now...
echo (If your PC blocks desktop shortcut creation, that's OK.)
echo.

call "Start CRM.bat"

echo.
echo If the CRM opened: you're done.
echo Next time you can run Start CRM.bat directly or create your own Desktop shortcut to it.
echo.
pause
exit /b 0
