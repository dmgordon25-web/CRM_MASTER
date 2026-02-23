@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CRM Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LOG=%~dp0launcher.log"
set "CRM_EXITCODE=0"
set "FATAL_MSG="

(
  echo [CRM] ==============================================
  echo [CRM] Starting CRM launcher at %DATE% %TIME%
  echo [CRM] Root: "%ROOT%"
  echo [CRM] ==============================================
) > "%LOG%"

echo [CRM] ==============================================
echo [CRM] Starting CRM launcher at %DATE% %TIME%
echo [CRM] ==============================================

call :LOG [CRM] Launcher root: "%ROOT%"

if not exist "%ROOT%server.js" (
  set "FATAL_MSG=[CRM][ERROR] Missing required file: \"%ROOT%server.js\""
  goto :FATAL
)
if not exist "%ROOT%crm-app\index.html" (
  set "FATAL_MSG=[CRM][ERROR] Missing required file: \"%ROOT%crm-app\index.html\""
  goto :FATAL
)

call :resolve_node
if not defined NODE (
  set "FATAL_MSG=[CRM][ERROR] Node.js runtime was not found. Install Node.js LTS or ship \"%ROOT%node\node.exe\"."
  goto :FATAL
)
call :LOG [CRM] Using Node executable: "%NODE%"

call :LOG [CRM] Selecting port...
set "PORT="
set "REUSE_SERVER=0"
for /l %%P in (8080,1,8100) do (
  if not defined PORT (
    call :is_crm_alive %%P
    if "!errorlevel!"=="0" (
      set "PORT=%%P"
      set "REUSE_SERVER=1"
      call :LOG [CRM] Reusing existing CRM server at http://127.0.0.1:%%P/
    )
  )
)

if not defined PORT (
  for /l %%P in (8080,1,8100) do (
    if not defined PORT (
      call :is_port_free %%P
      if "!errorlevel!"=="0" (
        set "PORT=%%P"
        set "REUSE_SERVER=0"
        call :LOG [CRM] Selected free port %%P
      )
    )
  )
)

if not defined PORT (
  set "FATAL_MSG=[CRM][ERROR] No reusable or free port found in range 8080-8100."
  goto :FATAL
)
call :LOG [CRM] Port selection complete: %PORT% (reuse=%REUSE_SERVER%).

if "%REUSE_SERVER%"=="1" (
  call :LOG [CRM] Waiting for server readiness...
  call :wait_for_port "%PORT%"
  if not "%errorlevel%"=="0" (
    set "FATAL_MSG=[CRM][ERROR] Existing CRM server at port %PORT% did not respond within 20 seconds."
    goto :FATAL
  )
  call :LOG [CRM] Launching browser...
  call :open_browser "%PORT%"
  if not "%errorlevel%"=="0" (
    set "FATAL_MSG=[CRM][ERROR] Failed to launch browser for http://127.0.0.1:%PORT%/."
    goto :FATAL
  )
  call :LOG [CRM] Launcher complete (existing server reused).
  exit /b 0
)

call :LOG [CRM] Starting server...
call :RUN "Starting server process" start "" /B "%NODE%" "%ROOT%server.js" --port %PORT%
call :LOG [CRM] Server start command issued, PID unknown (start /B).

call :LOG [CRM] Waiting for server readiness...
call :wait_for_port "%PORT%"
if not "%errorlevel%"=="0" (
  set "FATAL_MSG=[CRM][ERROR] CRM server did not become reachable within 20 seconds on port %PORT%."
  goto :FATAL
)

call :is_crm_alive "%PORT%"
if not "%errorlevel%"=="0" (
  set "FATAL_MSG=[CRM][ERROR] Port %PORT% opened but CRM health endpoint is not responding."
  goto :FATAL
)

call :LOG [CRM] Launching browser...
call :open_browser "%PORT%"
if not "%errorlevel%"=="0" (
  set "FATAL_MSG=[CRM][ERROR] Failed to launch browser for http://127.0.0.1:%PORT%/."
  goto :FATAL
)

call :LOG [CRM] Launcher complete.
exit /b 0

:RUN
set "RUN_DESC=%~1"
shift
call :LOG [CRM] %RUN_DESC%
>>"%LOG%" echo [%DATE% %TIME%] [CRM][CMD] %*
call %* >> "%LOG%" 2>&1
set "RUN_EXIT=%errorlevel%"
if not "%RUN_EXIT%"=="0" (
  set "FATAL_MSG=[CRM][ERROR] %RUN_DESC% failed with exit code %RUN_EXIT%."
  goto :FATAL
)
exit /b 0

:resolve_node
set "NODE="
if exist "%ROOT%node\node.exe" (
  set "NODE=%ROOT%node\node.exe"
  call :LOG [CRM] Found bundled Node runtime.
  exit /b 0
)
call :LOG [CRM] Bundled Node runtime not found. Checking PATH for node.exe.
for /f "delims=" %%I in ('where node.exe 2^>^&1') do (
  if not defined NODE if exist "%%~fI" set "NODE=%%~fI"
)
if defined NODE (
  call :LOG [CRM] Found node.exe on PATH.
) else (
  call :LOG [CRM] Node runtime discovery failed.
)
exit /b 0

:wait_for_port
set "PORT=%~1"
set /a WAIT_COUNT=0
set /a WAIT_MAX=20
:wait_loop
set /a WAIT_COUNT+=1
>>"%LOG%" echo [%DATE% %TIME%] [CRM] Readiness probe attempt !WAIT_COUNT! of !WAIT_MAX! on 127.0.0.1:%PORT%.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $client=New-Object System.Net.Sockets.TcpClient; try { $iar=$client.BeginConnect('127.0.0.1', %PORT%, $null, $null); if($iar.AsyncWaitHandle.WaitOne(800)){ $null=$client.EndConnect($iar); exit 0 } else { exit 1 } } catch { exit 1 } finally { $client.Close() }" >> "%LOG%" 2>&1
if "%errorlevel%"=="0" (
  call :LOG [CRM] TCP readiness confirmed for port %PORT% on attempt !WAIT_COUNT!.
  exit /b 0
)
if !WAIT_COUNT! GEQ !WAIT_MAX! (
  call :LOG [CRM] TCP readiness timeout reached for port %PORT% after !WAIT_COUNT! attempts.
  exit /b 2
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1" >> "%LOG%" 2>&1
goto :wait_loop

:is_port_free
set "PORT=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $listener=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), %PORT%); $listener.Start(); $listener.Stop(); exit 0 } catch { exit 1 }" >> "%LOG%" 2>&1
exit /b %errorlevel%

:is_crm_alive
set "PORT=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $req=[System.Net.HttpWebRequest]::Create('http://127.0.0.1:%PORT%/health'); $req.Method='GET'; $req.Timeout=1500; $res=$req.GetResponse(); if([int]$res.StatusCode -eq 200){ $res.Close(); exit 0 }; $res.Close(); exit 1 } catch { exit 1 }" >> "%LOG%" 2>&1
exit /b %errorlevel%

:open_browser
set "PORT=%~1"
set "URL=http://127.0.0.1:%PORT%/"
set "EDGE="
set "CHROME="
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE for /f "delims=" %%I in ('where msedge.exe 2^>^&1') do if not defined EDGE set "EDGE=%%~fI"

if defined EDGE (
  call :LOG [CRM] Browser launch URL: %URL%
  call :LOG [CRM] Browser path selected: "%EDGE%"
  start "" "%EDGE%" --app="%URL%" >> "%LOG%" 2>&1
  if "%errorlevel%"=="0" exit /b 0
  call :LOG [CRM] Edge launch command returned error %errorlevel%.
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME for /f "delims=" %%I in ('where chrome.exe 2^>^&1') do if not defined CHROME set "CHROME=%%~fI"

if defined CHROME (
  call :LOG [CRM] Browser launch URL: %URL%
  call :LOG [CRM] Browser path selected: "%CHROME%"
  start "" "%CHROME%" --app="%URL%" >> "%LOG%" 2>&1
  if "%errorlevel%"=="0" exit /b 0
  call :LOG [CRM] Chrome launch command returned error %errorlevel%.
)

call :LOG [CRM] Browser launch URL: %URL%
call :LOG [CRM] Browser path selected: shell-default
start "" "%URL%" >> "%LOG%" 2>&1
if "%errorlevel%"=="0" exit /b 0
call :LOG [CRM] Default browser launch returned error %errorlevel%.
exit /b 2

:LOG
echo %*
>>"%LOG%" echo [%DATE% %TIME%] %*
exit /b 0

:FATAL
set "CRM_EXITCODE=1"
if not defined FATAL_MSG set "FATAL_MSG=[CRM][ERROR] Launcher failed with an unknown error."
echo %FATAL_MSG%
>>"%LOG%" echo [%DATE% %TIME%] %FATAL_MSG%
>>"%LOG%" echo [%DATE% %TIME%] [CRM][ERROR] Opening launcher log: %LOG%
start "" notepad "%LOG%"
echo [CRM][ERROR] Launcher failed. Review launcher.log for details.
pause
exit /b 1
