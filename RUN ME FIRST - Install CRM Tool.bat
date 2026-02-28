@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "LOG=%TEMP%\CRMTool-shortcut.log"
del /q "%LOG%" 2>nul

echo Creating CRM Tool desktop shortcut...
echo Log: %LOG%

if not exist "Start CRM.bat" (
  echo ERROR: Start CRM.bat missing>>"%LOG%"
  echo ERROR: Start CRM.bat not found in this folder.
  pause
  exit /b 1
)

set "DESKTOP1=%USERPROFILE%\Desktop"
set "DESKTOP2=%OneDrive%\Desktop"
set "LNKNAME=CRM Tool.lnk"

call :CREATE "%DESKTOP1%\%LNKNAME%"
if exist "%DESKTOP1%\%LNKNAME%" goto SUCCESS

if not "%OneDrive%"=="" (
  call :CREATE "%DESKTOP2%\%LNKNAME%"
  if exist "%DESKTOP2%\%LNKNAME%" goto SUCCESS
)

echo ERROR: Could not create desktop shortcut>>"%LOG%"
echo ERROR: Could not create desktop shortcut.
echo See log: %LOG%
pause
exit /b 2

:SUCCESS
echo Shortcut created successfully.
echo Launching CRM Tool...
call "Start CRM.bat"
exit /b 0

:CREATE
set "TARGET=%~1"
echo Creating shortcut at "%TARGET%">>"%LOG%"

mshta "vbscript:Execute(""Set s=CreateObject("" & Chr(34) & ""WScript.Shell"" & Chr(34) & ""):Set l=s.CreateShortcut("" & Chr(34) & ""%TARGET%"" & Chr(34) & ""):l.TargetPath="" & Chr(34) & ""%SystemRoot%\System32\cmd.exe"" & Chr(34) & "":l.Arguments="" & Chr(34) & ""/c """"%CD%\Start CRM.bat"""""" & Chr(34) & "":l.WorkingDirectory="" & Chr(34) & ""%CD%"" & Chr(34) & "":l.Description="" & Chr(34) & ""CRM Tool"" & Chr(34) & "":l.Save:close"")" >>"%LOG%" 2>>&1

exit /b 0
