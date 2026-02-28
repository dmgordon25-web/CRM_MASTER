@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "LOG=%TEMP%\CRMTool-shortcut.log"
del /q "%LOG%" 2>nul
echo Log: %LOG%
echo Repo: "%CD%">>"%LOG%"

if not exist "Start CRM.bat" (
  echo ERROR: Missing Start CRM.bat in "%CD%">>"%LOG%"
  echo ERROR: Missing Start CRM.bat in this folder.
  pause
  exit /b 1
)

set "LNKNAME=CRM Tool.lnk"
set "DESK1=%USERPROFILE%\Desktop"
set "DESK2=%OneDrive%\Desktop"

call :TRY_CREATE "%DESK1%\%LNKNAME%"
if exist "%DESK1%\%LNKNAME%" goto LAUNCH

if not "%OneDrive%"=="" (
  call :TRY_CREATE "%DESK2%\%LNKNAME%"
  if exist "%DESK2%\%LNKNAME%" goto LAUNCH
)

echo ERROR: Could not create desktop shortcut.>>"%LOG%"
echo ERROR: Could not create desktop shortcut.
echo Tried:
echo  - "%DESK1%\%LNKNAME%"
if not "%OneDrive%"=="" echo  - "%DESK2%\%LNKNAME%"
echo See log: %LOG%
pause
exit /b 2

:LAUNCH
echo SUCCESS: Shortcut created.
echo Launching CRM Tool...
call "Start CRM.bat"
exit /b 0

:TRY_CREATE
set "LNK=%~1"
echo === TRY CREATE "%LNK%" ===>>"%LOG%"

rem Method A: PowerShell one-liner (COM shortcut). No scripts. No prompts.
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$lnk='%LNK%';" ^
  "$repo='%CD%';" ^
  "$start=Join-Path $repo 'Start CRM.bat';" ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$s=$ws.CreateShortcut($lnk);" ^
  "$s.TargetPath=Join-Path $env:WINDIR 'System32\cmd.exe';" ^
  "$s.Arguments='/c ""' + $start + '""';" ^
  "$s.WorkingDirectory=$repo;" ^
  "$s.Description='CRM Tool';" ^
  "$s.Save();" ^
  "exit 0" >>"%LOG%" 2>>&1

if exist "%LNK%" (
  echo Created via PowerShell COM>>"%LOG%"
  exit /b 0
)

rem Method B: cscript temp .vbs (often allowed when mshta is blocked)
set "VBS=%TEMP%\crmtool_make_shortcut.vbs"
(
  echo On Error Resume Next
  echo Set sh = CreateObject("WScript.Shell")
  echo Set sc = sh.CreateShortcut(WScript.Arguments(0))
  echo sc.TargetPath = sh.ExpandEnvironmentStrings("%%WINDIR%%\System32\cmd.exe")
  echo sc.Arguments  = "/c """ ^& WScript.Arguments(1) ^& """"
  echo sc.WorkingDirectory = WScript.Arguments(2)
  echo sc.Description = "CRM Tool"
  echo sc.Save
  echo WScript.Quit(0)
) > "%VBS%"

cscript.exe //nologo "%VBS%" "%LNK%" "%CD%\Start CRM.bat" "%CD%" >>"%LOG%" 2>>&1
del /q "%VBS%" 2>nul

if exist "%LNK%" (
  echo Created via cscript VBS>>"%LOG%"
  exit /b 0
)

rem Method C: mshta last resort (commonly blocked)
mshta "vbscript:Execute(""Set s=CreateObject("" & Chr(34) & ""WScript.Shell"" & Chr(34) & ""):Set l=s.CreateShortcut("" & Chr(34) & ""%LNK%"" & Chr(34) & ""):l.TargetPath="" & Chr(34) & ""%SystemRoot%\System32\cmd.exe"" & Chr(34) & "":l.Arguments="" & Chr(34) & ""/c """"%CD%\Start CRM.bat"""""" & Chr(34) & "":l.WorkingDirectory="" & Chr(34) & ""%CD%"" & Chr(34) & "":l.Description="" & Chr(34) & ""CRM Tool"" & Chr(34) & "":l.Save:close"")" >>"%LOG%" 2>>&1

if exist "%LNK%" (
  echo Created via mshta>>"%LOG%"
  exit /b 0
)

echo All shortcut methods failed for "%LNK%".>>"%LOG%"
exit /b 0
