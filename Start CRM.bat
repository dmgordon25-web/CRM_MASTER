@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CRM Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "SERVER_SCRIPT=%ROOT%server.js"
if not exist "%SERVER_SCRIPT%" (
  echo [CRM][ERROR] Missing required file: "%SERVER_SCRIPT%"
  pause
  exit /b 1
)

if not exist "%ROOT%crm-app\index.html" (
  echo [CRM][ERROR] Missing required file: "%ROOT%crm-app\index.html"
  pause
  exit /b 1
)

set "STAMP="
for /f %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
if not defined STAMP set "STAMP=%RANDOM%_%RANDOM%"

set "LOGFILE=%ROOT%launcher-%STAMP%.log"
set "SERVER_LOGFILE=%ROOT%launcher-server-%STAMP%.out.log"
set "SERVER_ERR_LOGFILE=%ROOT%launcher-server-%STAMP%.err.log"

>"%LOGFILE%" echo [CRM] ==============================================
>>"%LOGFILE%" echo [CRM] Starting CRM launcher at %DATE% %TIME%
>>"%LOGFILE%" echo [CRM] Root: "%ROOT%"
>>"%LOGFILE%" echo [CRM] Server script: "%SERVER_SCRIPT%"
>>"%LOGFILE%" echo [CRM] ==============================================

>"%SERVER_LOGFILE%" echo [CRM] Server stdout log started at %DATE% %TIME%
>"%SERVER_ERR_LOGFILE%" echo [CRM] Server stderr log started at %DATE% %TIME%

echo [CRM] ==============================================
echo [CRM] Starting CRM launcher at %DATE% %TIME%
echo [CRM] ==============================================

set "BUNDLED_NODE=%ROOT%node\node.exe"
set "NODE_EXE="
if exist "%BUNDLED_NODE%" set "NODE_EXE=%BUNDLED_NODE%"
if not defined NODE_EXE for %%N in (node.exe) do set "NODE_EXE=%%~$PATH:N"

if not defined NODE_EXE (
  echo [CRM][ERROR] Node runtime was not found.>>"%LOGFILE%"
  echo [CRM][ERROR] Node runtime was not found.
  echo [CRM][ERROR] Install Node.js or place node.exe at "%BUNDLED_NODE%".
  pause
  exit /b 1
)

if not exist "%NODE_EXE%" (
  echo [CRM][ERROR] Resolved node executable does not exist: "%NODE_EXE%".>>"%LOGFILE%"
  echo [CRM][ERROR] Resolved node executable does not exist: "%NODE_EXE%".
  pause
  exit /b 1
)

echo [CRM] Using Node executable: "%NODE_EXE%"
>>"%LOGFILE%" echo [CRM] Using Node executable: "%NODE_EXE%"

set "PORT="
for /l %%P in (8080,1,8100) do (
  if not defined PORT (
    call :is_crm_alive %%P
    if !errorlevel! EQU 0 set "PORT=%%P"
  )
)

if defined PORT (
  echo [CRM] Reusing existing CRM server on port %PORT%. 
  >>"%LOGFILE%" echo [CRM] Reusing existing CRM server on port %PORT%.
) else (
  for /l %%P in (8080,1,8100) do (
    if not defined PORT (
      call :is_port_free %%P
      if !errorlevel! EQU 0 set "PORT=%%P"
    )
  )
)

if not defined PORT (
  echo [CRM][ERROR] No reusable or free port found in range 8080-8100.>>"%LOGFILE%"
  echo [CRM][ERROR] No reusable or free port found in range 8080-8100.
  pause
  exit /b 1
)

if not defined SERVER_SCRIPT (
  echo [CRM][ERROR] Internal error: SERVER_SCRIPT is empty before spawn.>>"%LOGFILE%"
  echo [CRM][ERROR] Internal error: SERVER_SCRIPT is empty before spawn.
  pause
  exit /b 1
)

if not exist "%SERVER_SCRIPT%" (
  echo [CRM][ERROR] Internal error: SERVER_SCRIPT missing before spawn: "%SERVER_SCRIPT%".>>"%LOGFILE%"
  echo [CRM][ERROR] Internal error: SERVER_SCRIPT missing before spawn: "%SERVER_SCRIPT%".
  pause
  exit /b 1
)

call :is_crm_alive %PORT%
if %errorlevel% NEQ 0 (
  echo [CRM] Starting server.js on port %PORT%...
  >>"%LOGFILE%" echo [CRM] Starting server.js on port %PORT%...
  start "" /b "%NODE_EXE%" "%SERVER_SCRIPT%" --port %PORT% 1>>"%SERVER_LOGFILE%" 2>>"%SERVER_ERR_LOGFILE%"
  if errorlevel 1 (
    echo [CRM][ERROR] Failed to spawn node process.>>"%LOGFILE%"
    echo [CRM][ERROR] Failed to spawn node process.
    pause
    exit /b 1
  )
)

set "HEALTH_OK=0"
for /l %%A in (1,1,20) do (
  call :is_crm_alive %PORT%
  if !errorlevel! EQU 0 set "HEALTH_OK=1"
  if !HEALTH_OK! EQU 0 powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 250" >nul
)

if not "%HEALTH_OK%"=="1" (
  echo [CRM][ERROR] CRM server did not become healthy on port %PORT%.>>"%LOGFILE%"
  echo [CRM][ERROR] CRM server did not become healthy on port %PORT%.
  echo [CRM][ERROR] See logs:
  echo [CRM][ERROR]   "%LOGFILE%"
  echo [CRM][ERROR]   "%SERVER_LOGFILE%"
  echo [CRM][ERROR]   "%SERVER_ERR_LOGFILE%"
  pause
  exit /b 1
)

set "URL=http://127.0.0.1:%PORT%/#/labs"
echo [CRM] Opening %URL%
>>"%LOGFILE%" echo [CRM] Opening %URL%
start "" "%URL%"

if errorlevel 1 (
  echo [CRM][ERROR] Failed to launch browser for %URL%.>>"%LOGFILE%"
  echo [CRM][ERROR] Failed to launch browser for %URL%.
  pause
  exit /b 1
)

>>"%LOGFILE%" echo [CRM] Launcher complete.
exit /b 0

:is_crm_alive
set "HEALTH_PORT=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $req=[System.Net.HttpWebRequest]::Create('http://127.0.0.1:%HEALTH_PORT%/health'); $req.Method='GET'; $req.Timeout=700; $res=$req.GetResponse(); if([int]$res.StatusCode -eq 200){ $res.Close(); exit 0 }; $res.Close(); exit 1 } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%

:is_port_free
REM Checks whether %1 port is free
REM returns ERRORLEVEL 0 = free, 1 = in use

setlocal
set "CHECK_PORT=%~1"

netstat -ano | findstr /r /c:":%CHECK_PORT% " >nul
if %errorlevel%==0 (
endlocal & exit /b 1
) else (
endlocal & exit /b 0
)
