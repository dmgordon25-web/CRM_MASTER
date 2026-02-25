@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CRM Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LOGFILE=%~dp0launcher.log"
set "CRM_EXITCODE=0"
set "FATAL_MSG="
set "NODE=%ROOT%node\node.exe"
set "MAX_SPAWN_ATTEMPTS=2"
set "SPAWN_ATTEMPT=0"
set "STARTED_NODE_PID="

>"!LOGFILE!" echo [CRM] ==============================================
>>"!LOGFILE!" echo [CRM] Starting CRM launcher at %DATE% %TIME%
>>"!LOGFILE!" echo [CRM] Root: "!ROOT!"
>>"!LOGFILE!" echo [CRM] ==============================================

echo [CRM] ==============================================
echo [CRM] Starting CRM launcher at %DATE% %TIME%
echo [CRM] ==============================================

echo [CRM] Step: verify labels
call :verify_required_labels
if not "!errorlevel!"=="0" goto :fatal

call :LOG [CRM] Launcher root: "!ROOT!"
echo [CRM] Step: validate required files

if not exist "!ROOT!server.js" (
  set "FATAL_MSG=[CRM][ERROR] Missing required file: !ROOT!server.js"
  goto :fatal
)
if not exist "!ROOT!crm-app\index.html" (
  set "FATAL_MSG=[CRM][ERROR] Missing required file: !ROOT!crm-app\index.html"
  goto :fatal
)

echo [CRM] Step: resolve node runtime
call :resolve_node
if not defined NODE (
  set "FATAL_MSG=[CRM][ERROR] Node.js runtime was not found. Install Node.js LTS or ship !ROOT!node\node.exe."
  goto :fatal
)
call :LOG [CRM] Using Node executable: "!NODE!"

echo [CRM] Step: select port
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
  goto :fatal
)
call :LOG [CRM] Port selection complete: !PORT! (reuse=!REUSE_SERVER!).

echo [CRM] Step: start_or_reuse
call :start_or_reuse
if not "!errorlevel!"=="0" goto :fatal

call :LOG [CRM] Launcher complete.
exit /b 0

:start_or_reuse
if "!REUSE_SERVER!"=="1" goto :start_or_reuse_reuse_existing
goto :start_or_reuse_spawn

:start_or_reuse_reuse_existing
call :wait_health "!PORT!" "20"
if "!errorlevel!"=="0" goto :start_or_reuse_open
set "FATAL_MSG=[CRM][ERROR] Existing CRM server at port !PORT! did not respond within 20 seconds."
exit /b 2

:start_or_reuse_open
call :open_browser "!PORT!"
if "!errorlevel!"=="0" goto :start_or_reuse_reused_ok
set "FATAL_MSG=[CRM][ERROR] Failed to launch browser for http://127.0.0.1:!PORT!/#/labs."
exit /b 2

:start_or_reuse_reused_ok
call :LOG [CRM] Launcher complete (existing server reused).
exit /b 0

:start_or_reuse_spawn
echo [CRM] Step: start_or_reuse_spawn
call :LOG [CRM] Step: start_or_reuse_spawn
if not defined PORT (
  set "FATAL_MSG=[CRM][ERROR] Cannot start server because selected PORT is empty."
  exit /b 2
)
call :spawn_server
exit /b !errorlevel!

:verify_required_labels
call :require_label is_crm_alive
if not "!errorlevel!"=="0" exit /b 2
call :require_label start_or_reuse
if not "!errorlevel!"=="0" exit /b 2
call :require_label start_or_reuse_spawn
if not "!errorlevel!"=="0" exit /b 2
call :require_label spawn_server
if not "!errorlevel!"=="0" exit /b 2
call :require_label wait_health
if not "!errorlevel!"=="0" exit /b 2
call :require_label open_browser
if not "!errorlevel!"=="0" exit /b 2
call :LOG [CRM] Required labels verified.
exit /b 0

:require_label
set "REQ_LABEL=%~1"
findstr /B /C:":%REQ_LABEL%" "%~f0" >nul 2>&1
if "!errorlevel!"=="0" exit /b 0
set "FATAL_MSG=[CRM][ERROR] Launcher integrity check failed. Missing label :%REQ_LABEL% in %~nx0."
call :LOG !FATAL_MSG!
exit /b 2

:spawn_server
echo [CRM] Step: spawn_server
:spawn_retry_loop
if !SPAWN_ATTEMPT! GEQ !MAX_SPAWN_ATTEMPTS! (
  set "FATAL_MSG=[CRM][ERROR] CRM server failed health checks after !MAX_SPAWN_ATTEMPTS! launch attempts. See launcher.log."
  exit /b 2
)

set /a SPAWN_ATTEMPT+=1
call :LOG [CRM] Starting server.js (attempt !SPAWN_ATTEMPT! of !MAX_SPAWN_ATTEMPTS!) on port !PORT!... 
call :start_server "!PORT!"
if not "!errorlevel!"=="0" (
  set "FATAL_MSG=[CRM][ERROR] Failed to start CRM server process on attempt !SPAWN_ATTEMPT!."
  exit /b 2
)

call :wait_health "!PORT!" "20"
if not "!errorlevel!"=="0" (
  call :LOG [CRM][WARN] Health endpoint did not respond on attempt !SPAWN_ATTEMPT! for port !PORT!.
  call :stop_spawned_server
  if !SPAWN_ATTEMPT! GEQ !MAX_SPAWN_ATTEMPTS! (
    set "FATAL_MSG=[CRM][ERROR] CRM server did not become healthy after !MAX_SPAWN_ATTEMPTS! launch attempts."
    exit /b 2
  )
  call :select_next_free_port "!PORT!"
  if not "!errorlevel!"=="0" (
    set "FATAL_MSG=[CRM][ERROR] Unable to find an alternate free port in range 8080-8100 after failed launch."
    exit /b 2
  )
  goto :spawn_retry_loop
)

call :open_browser "!PORT!"
if not "!errorlevel!"=="0" (
  set "FATAL_MSG=[CRM][ERROR] Failed to launch browser for http://127.0.0.1:!PORT!/#/labs."
  exit /b 2
)

exit /b 0

:resolve_node
if exist "!ROOT!node\node.exe" (
  echo [CRM] Step: resolve_node bundled check
  call :LOG [CRM] Found bundled Node runtime.
  exit /b 0
)
echo [CRM] Step: resolve_node PATH lookup
call :LOG [CRM] Bundled Node runtime not found. Checking PATH for node.exe.
set "NODE="
for /f "delims=" %%I in ('where node.exe 2^>^&1') do (
  if not defined NODE if exist "%%~fI" set "NODE=%%~fI"
)
if defined NODE (
  call :LOG [CRM] Found node.exe on PATH.
) else (
  call :LOG [CRM] Node runtime discovery failed.
)
exit /b 0

:wait_health
echo [CRM] Step: wait_health
call :wait_for_health "%~1" "%~2"
exit /b !errorlevel!

:wait_for_health
set "WAIT_PORT=%~1"
set "WAIT_MAX=%~2"
if not defined WAIT_PORT exit /b 2
if not defined WAIT_MAX set "WAIT_MAX=20"
set /a WAIT_COUNT=0
:wait_health_loop
set /a WAIT_COUNT+=1
call :LOG [CRM] Health probe attempt !WAIT_COUNT! of !WAIT_MAX! on http://127.0.0.1:!WAIT_PORT!/health
call :is_crm_alive "!WAIT_PORT!"
if "!errorlevel!"=="0" (
  call :LOG [CRM] Health readiness confirmed for port !WAIT_PORT! on attempt !WAIT_COUNT!.
  exit /b 0
)
if !WAIT_COUNT! GEQ !WAIT_MAX! (
  call :LOG [CRM] Health readiness timeout reached for port !WAIT_PORT! after !WAIT_COUNT! attempts.
  exit /b 2
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 1" >> "!LOGFILE!" 2>&1
goto :wait_health_loop

:start_server
set "TARGET_PORT=%~1"
set "STARTED_NODE_PID="
set "NODE_EXE=!NODE!"
set "SERVER_SCRIPT=!ROOT!server.js"
set "SERVER_ROOT=!ROOT!"
if not defined TARGET_PORT (
  call :LOG [CRM][ERROR] Spawn preflight failed: PORT is empty.
  exit /b 2
)
if not defined NODE_EXE (
  call :LOG [CRM][ERROR] Spawn preflight failed: NODE_EXE is empty.
  exit /b 2
)
if not exist "!NODE_EXE!" (
  call :LOG [CRM][ERROR] Spawn preflight failed: NODE_EXE not found at "!NODE_EXE!".
  exit /b 2
)
if not defined SERVER_SCRIPT (
  call :LOG [CRM][ERROR] Spawn preflight failed: SERVER_SCRIPT is empty.
  exit /b 2
)
if not exist "!SERVER_SCRIPT!" (
  call :LOG [CRM][ERROR] Spawn preflight failed: SERVER_SCRIPT not found at "!SERVER_SCRIPT!".
  exit /b 2
)
set "SPAWN_PORT=!TARGET_PORT!"
call :LOG [CRM] Spawn preflight NODE_EXE="!NODE_EXE!"
call :LOG [CRM] Spawn preflight SERVER_SCRIPT="!SERVER_SCRIPT!"
call :LOG [CRM] Spawn preflight PORT="!SPAWN_PORT!"
call :LOG [CRM] Spawn command: "!NODE_EXE!" "!SERVER_SCRIPT!" --port !SPAWN_PORT!
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; if ([string]::IsNullOrWhiteSpace($env:NODE_EXE)) { throw 'NODE_EXE empty' }; if ([string]::IsNullOrWhiteSpace($env:SERVER_SCRIPT)) { throw 'SERVER_SCRIPT empty' }; if ([string]::IsNullOrWhiteSpace($env:SPAWN_PORT)) { throw 'PORT empty' }; $args = @($env:SERVER_SCRIPT, '--port', $env:SPAWN_PORT); if ($args.Count -ne 3) { throw 'ArgumentList length invalid' }; $p = Start-Process -FilePath $env:NODE_EXE -ArgumentList $args -WorkingDirectory $env:SERVER_ROOT -PassThru -WindowStyle Hidden; if ($null -eq $p -or $null -eq $p.Id) { throw 'Failed to capture process id' }; Write-Output $p.Id" 2^>^> "!LOGFILE!"`) do (
  if not defined STARTED_NODE_PID set "STARTED_NODE_PID=%%I"
)
if not defined STARTED_NODE_PID (
  call :LOG [CRM][ERROR] Failed to capture Node PID after start attempt.
  exit /b 2
)
call :LOG [CRM] Server process started with PID !STARTED_NODE_PID!.
exit /b 0

:stop_spawned_server
if not defined STARTED_NODE_PID (
  call :LOG [CRM] No spawned server PID recorded; skip cleanup.
  exit /b 0
)
call :LOG [CRM] Stopping spawned Node process PID !STARTED_NODE_PID!.
taskkill /PID !STARTED_NODE_PID! /T /F >> "!LOGFILE!" 2>&1
if "!errorlevel!"=="0" (
  call :LOG [CRM] Cleanup succeeded for PID !STARTED_NODE_PID!.
) else (
  call :LOG [CRM][WARN] Cleanup taskkill returned !errorlevel! for PID !STARTED_NODE_PID!.
)
set "STARTED_NODE_PID="
exit /b 0

:select_next_free_port
set "PREVIOUS_PORT=%~1"
for /l %%P in (8080,1,8100) do (
  if not "%%P"=="!PREVIOUS_PORT!" (
    call :is_port_free %%P
    if "!errorlevel!"=="0" (
      set "PORT=%%P"
      call :LOG [CRM] Retrying launch on alternate free port %%P.
      exit /b 0
    )
  )
)
exit /b 2

:is_port_free
set "TEST_PORT=%~1"
if not defined TEST_PORT exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $listener=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), !TEST_PORT!); $listener.Start(); $listener.Stop(); exit 0 } catch { exit 1 }" >> "!LOGFILE!" 2>&1
exit /b %errorlevel%

:is_crm_alive
set "HEALTH_PORT=%~1"
if not defined HEALTH_PORT exit /b 1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $req=[System.Net.HttpWebRequest]::Create('http://127.0.0.1:!HEALTH_PORT!/health'); $req.Method='GET'; $req.Timeout=1500; $res=$req.GetResponse(); if([int]$res.StatusCode -eq 200){ $res.Close(); exit 0 }; $res.Close(); exit 1 } catch { exit 1 }" >> "!LOGFILE!" 2>&1
exit /b %errorlevel%

:open_browser
echo [CRM] Step: open_browser
set "PORT=%~1"
set "URL=http://127.0.0.1:!PORT!/#/labs"
set "EDGE="
set "CHROME="
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined EDGE for /f "delims=" %%I in ('where msedge.exe 2^>^&1') do if not defined EDGE set "EDGE=%%~fI"

if defined EDGE (
  call :LOG [CRM] Browser launch URL: !URL!
  call :LOG [CRM] Browser path selected: "!EDGE!"
  start "" "!EDGE!" --app="!URL!" >> "!LOGFILE!" 2>&1
  if "!errorlevel!"=="0" exit /b 0
  call :LOG [CRM] Edge launch command returned error !errorlevel!.
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME for /f "delims=" %%I in ('where chrome.exe 2^>^&1') do if not defined CHROME set "CHROME=%%~fI"

if defined CHROME (
  call :LOG [CRM] Browser launch URL: !URL!
  call :LOG [CRM] Browser path selected: "!CHROME!"
  start "" "!CHROME!" --app="!URL!" >> "!LOGFILE!" 2>&1
  if "!errorlevel!"=="0" exit /b 0
  call :LOG [CRM] Chrome launch command returned error !errorlevel!.
)

call :LOG [CRM] Browser launch URL: !URL!
call :LOG [CRM] Browser path selected: shell-default
start "" "!URL!" >> "!LOGFILE!" 2>&1
if "!errorlevel!"=="0" exit /b 0
call :LOG [CRM] Default browser launch returned error !errorlevel!.
exit /b 2

:LOG
echo %*
>>"!LOGFILE!" echo [%DATE% %TIME%] %*
exit /b 0

:fatal
set "CRM_EXITCODE=1"
if not defined FATAL_MSG set "FATAL_MSG=[CRM][ERROR] Launcher failed with an unknown error."
echo !FATAL_MSG!
>>"!LOGFILE!" echo [%DATE% %TIME%] !FATAL_MSG!
>>"!LOGFILE!" echo [%DATE% %TIME%] [CRM][ERROR] Action: Review launcher.log for diagnostics and rerun Start CRM.bat.
start "" notepad "!LOGFILE!"
exit /b 1
