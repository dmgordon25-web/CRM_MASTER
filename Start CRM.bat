@echo off
setlocal EnableExtensions EnableDelayedExpansion
title CRM Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LOGFILE=%~dp0launcher.log"
set "SERVER_LOGFILE=%~dp0launcher-server.log"
set "SERVER_ERR_LOGFILE=%~dp0launcher-server.err.log"
set "CRM_EXITCODE=0"
set "FATAL_MSG="
set "NODE_EXE=%ROOT%node\node.exe"
set "MAX_SPAWN_ATTEMPTS=2"
set "SPAWN_ATTEMPT=0"
set "STARTED_NODE_PID="
set "PORT_PROBE_TIMEOUT_MS=250"
set "HEALTH_WAIT_MAX_ATTEMPTS=8"
set "HEALTH_PROBE_TIMEOUT_MS=700"
set "BROWSER_OPENED=0"
set "SUPPRESS_FATAL_NOTEPAD=0"

>"!LOGFILE!" echo [CRM] ==============================================
>>"!LOGFILE!" echo [CRM] Starting CRM launcher at %DATE% %TIME%
>>"!LOGFILE!" echo [CRM] Root: "!ROOT!"
>>"!LOGFILE!" echo [CRM] ==============================================

>"!SERVER_LOGFILE!" echo [CRM] Server stdout log started at %DATE% %TIME%
>"!SERVER_ERR_LOGFILE!" echo [CRM] Server stderr log started at %DATE% %TIME%

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
if defined NODE_EXE if exist "!NODE_EXE!" (
  call :LOG [CRM] Using Node executable: "!NODE_EXE!"
) else (
  set "NODE_EXE="
  call :LOG [CRM][WARN] Node.js runtime was not found during startup. Reuse checks will continue; spawn will be skipped if node.exe is unavailable.
)

echo [CRM] Step: select port
call :LOG [CRM] Selecting port...
set "PORT="
set "REUSE_SERVER=0"
for /l %%P in (8080,1,8100) do (
  if not defined PORT (
    call :is_crm_alive %%P "!PORT_PROBE_TIMEOUT_MS!"
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
call :wait_health "!PORT!" "!HEALTH_WAIT_MAX_ATTEMPTS!"
if "!errorlevel!"=="0" goto :start_or_reuse_health_ok
set "FATAL_MSG=[CRM][ERROR] Existing CRM server at port !PORT! did not respond within startup timeout."
exit /b 2

:start_or_reuse_spawn
echo [CRM] Step: start_or_reuse_spawn
call :LOG [CRM] Step: start_or_reuse_spawn
if not defined PORT (
  set "FATAL_MSG=[CRM][ERROR] Cannot start server because selected PORT is empty."
  exit /b 2
)
if not defined NODE_EXE goto :start_or_reuse_spawn_node_missing
if not exist "!NODE_EXE!" goto :start_or_reuse_spawn_node_missing
call :spawn_server
if "!errorlevel!"=="0" goto :start_or_reuse_health_ok
exit /b !errorlevel!

:start_or_reuse_spawn_node_missing
call :LOG [CRM][WARN] node.exe not found; skipping spawn; attempting reuse.
echo [CRM][WARN] node.exe not found; skipping spawn; attempting reuse.
call :try_reuse_existing_server
if "!errorlevel!"=="0" goto :start_or_reuse_reuse_existing
set "SUPPRESS_FATAL_NOTEPAD=1"
set "FATAL_MSG=[CRM][ERROR] node.exe is missing and no running CRM server was found. Install Node.js LTS or add !ROOT!node\node.exe, then relaunch."
echo !FATAL_MSG!
pause
exit /b 2

:start_or_reuse_health_ok
call :LOG [CRM] Health success event confirmed for port !PORT!.
call :open_browser "!PORT!"
if "!errorlevel!"=="0" goto :start_or_reuse_done
set "FATAL_MSG=[CRM][ERROR] Failed to launch browser for http://127.0.0.1:!PORT!/#/labs."
exit /b 2

:start_or_reuse_done
if "!REUSE_SERVER!"=="1" (
  call :LOG [CRM] Launcher complete (existing server reused).
) else (
  call :LOG [CRM] Launcher complete (server spawned).
)
exit /b 0

:verify_required_labels
for %%L in (LOG require_label verify_required_labels resolve_node is_port_free is_crm_alive wait_health wait_for_health start_or_reuse start_or_reuse_spawn try_reuse_existing_server start_server spawn_server probe_spawned_server stop_spawned_server select_next_free_port is_pid_alive log_server_tail open_browser) do (
  call :require_label %%L
  if not "!errorlevel!"=="0" exit /b 2
)
call :LOG [CRM] Required labels verified.
exit /b 0

:require_label
set "REQUIRED_LABEL=%~1"
if not defined REQUIRED_LABEL (
  set "FATAL_MSG=[CRM][ERROR] Launcher integrity check failed. Empty label name passed to :require_label."
  call :LOG !FATAL_MSG!
  exit /b 2
)
findstr /B /C:":!REQUIRED_LABEL!" "%~f0" >nul 2>&1
if "!errorlevel!"=="0" exit /b 0
set "FATAL_MSG=[CRM][ERROR] Launcher integrity check failed. Missing label :!REQUIRED_LABEL! in %~nx0."
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

call :probe_spawned_server
if not "!errorlevel!"=="0" (
  call :stop_spawned_server
  if !SPAWN_ATTEMPT! GEQ !MAX_SPAWN_ATTEMPTS! (
    set "FATAL_MSG=[CRM][ERROR] CRM server exited before health checks after !MAX_SPAWN_ATTEMPTS! launch attempts. See launcher.log and launcher-server logs."
    exit /b 2
  )
  call :select_next_free_port "!PORT!"
  if not "!errorlevel!"=="0" (
    set "FATAL_MSG=[CRM][ERROR] Unable to find an alternate free port in range 8080-8100 after early server exit."
    exit /b 2
  )
  goto :spawn_retry_loop
)

call :wait_health "!PORT!" "!HEALTH_WAIT_MAX_ATTEMPTS!"
if not "!errorlevel!"=="0" (
  call :LOG [CRM][WARN] Health endpoint did not respond on attempt !SPAWN_ATTEMPT! for port !PORT!.
  call :log_server_tail
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

exit /b 0


:probe_spawned_server
if not defined STARTED_NODE_PID (
  call :LOG [CRM] Spawned server PID capture disabled; continuing with health checks as source of truth.
  exit /b 0
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Milliseconds 700" >> "!LOGFILE!" 2>&1
call :is_pid_alive "!STARTED_NODE_PID!"
if "!errorlevel!"=="0" exit /b 0
call :LOG [CRM][WARN] Spawned Node process PID !STARTED_NODE_PID! exited before health checks.
call :log_server_tail
exit /b 2

:resolve_node
if exist "!ROOT!node\node.exe" (
  echo [CRM] Step: resolve_node bundled check
  call :LOG [CRM] Found bundled Node runtime.
  exit /b 0
)
echo [CRM] Step: resolve_node PATH lookup
call :LOG [CRM] Bundled Node runtime not found. Checking PATH for node.exe.
set "NODE_EXE="
for /f "delims=" %%I in ('where node.exe 2^>^&1') do (
  if not defined NODE_EXE if exist "%%~fI" set "NODE_EXE=%%~fI"
)
if defined NODE_EXE (
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

:try_reuse_existing_server
for /l %%P in (8080,1,8100) do (
  call :is_crm_alive %%P "!PORT_PROBE_TIMEOUT_MS!"
  if "!errorlevel!"=="0" (
    set "PORT=%%P"
    set "REUSE_SERVER=1"
    call :LOG [CRM] Reuse fallback found existing CRM server at http://127.0.0.1:%%P/
    exit /b 0
  )
)
exit /b 1

:start_server
set "TARGET_PORT=%~1"
set "STARTED_NODE_PID="
set "SERVER_SCRIPT=!ROOT!server.js"
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
set "LAUNCH_PORT=!TARGET_PORT!"
set "ROOT_DIR=!ROOT!"
if not defined ROOT_DIR (
  call :LOG [CRM][ERROR] Spawn preflight failed: ROOT is empty.
  exit /b 2
)
if not exist "!ROOT_DIR!" (
  call :LOG [CRM][ERROR] Spawn preflight failed: ROOT path not found at "!ROOT_DIR!".
  exit /b 2
)
call :LOG [CRM] Child working directory: "!ROOT_DIR!"
call :LOG [CRM] Child output log path: "!SERVER_LOGFILE!"
call :LOG [CRM] Child error log path: "!SERVER_ERR_LOGFILE!"
call :LOG [CRM] Spawn preflight NODE_EXE="!NODE_EXE!"
call :LOG [CRM] Spawn preflight SERVER_SCRIPT="!SERVER_SCRIPT!"
call :LOG [CRM] Spawn preflight PORT="!LAUNCH_PORT!"
call :LOG [CRM] Spawn preflight ROOT="!ROOT_DIR!"
call :LOG [CRM] Spawn command: "!NODE_EXE!" "!SERVER_SCRIPT!" --port !LAUNCH_PORT!
pushd "!ROOT_DIR!" >> "!LOGFILE!" 2>&1
if not "!errorlevel!"=="0" (
  call :LOG [CRM][ERROR] Failed to enter launch root "!ROOT_DIR!".
  exit /b 2
)
start "" /b "!NODE_EXE!" "!ROOT!server.js" --port !LAUNCH_PORT! 1>>"!SERVER_LOGFILE!" 2>>"!SERVER_ERR_LOGFILE!"
set "START_EXIT=!errorlevel!"
popd >> "!LOGFILE!" 2>&1
if not "!START_EXIT!"=="0" (
  call :LOG [CRM][ERROR] start command returned !START_EXIT!.
  exit /b 2
)
set "STARTED_NODE_PID="
call :LOG [CRM] Server process spawned via start /b (no PID capture mode).
exit /b 0

:stop_spawned_server
if not defined STARTED_NODE_PID (
  call :LOG [CRM] No spawned server PID recorded; skip cleanup.
  exit /b 0
)
echo(!STARTED_NODE_PID!| findstr /R "^[0-9][0-9]*$" >nul
if not "!errorlevel!"=="0" (
  call :LOG [CRM][WARN] Spawned server PID value is invalid ('!STARTED_NODE_PID!'); skip cleanup.
  set "STARTED_NODE_PID="
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
set "HEALTH_TIMEOUT_MS=%~2"
if not defined HEALTH_PORT exit /b 1
if not defined HEALTH_TIMEOUT_MS set "HEALTH_TIMEOUT_MS=!HEALTH_PROBE_TIMEOUT_MS!"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $req=[System.Net.HttpWebRequest]::Create('http://127.0.0.1:!HEALTH_PORT!/health'); $req.Method='GET'; $req.Timeout=[int]!HEALTH_TIMEOUT_MS!; $res=$req.GetResponse(); if([int]$res.StatusCode -eq 200){ $res.Close(); exit 0 }; $res.Close(); exit 1 } catch { exit 1 }" >> "!LOGFILE!" 2>&1
exit /b %errorlevel%


:is_pid_alive
set "CHECK_PID=%~1"
if not defined CHECK_PID exit /b 1
tasklist /FI "PID eq !CHECK_PID!" /FO CSV /NH | findstr /I /C:""!CHECK_PID!"" >nul 2>&1
exit /b %errorlevel%

:log_server_tail
if exist "!SERVER_LOGFILE!" for /f "usebackq delims=" %%L in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; if(Test-Path -LiteralPath $env:SERVER_LOGFILE){ Get-Content -LiteralPath $env:SERVER_LOGFILE -Tail 40 }"`) do (
  echo [CRM][SERVER][OUT] %%L
  >>"!LOGFILE!" echo [CRM][SERVER][OUT] %%L
)
if exist "!SERVER_ERR_LOGFILE!" for /f "usebackq delims=" %%L in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; if(Test-Path -LiteralPath $env:SERVER_ERR_LOGFILE){ Get-Content -LiteralPath $env:SERVER_ERR_LOGFILE -Tail 40 }"`) do (
  echo [CRM][SERVER][ERR] %%L
  >>"!LOGFILE!" echo [CRM][SERVER][ERR] %%L
)
exit /b 0

:open_browser
echo [CRM] Step: open_browser
if "!BROWSER_OPENED!"=="1" (
  call :LOG [CRM] Browser launch skipped because BROWSER_OPENED=1.
  exit /b 0
)
set "TARGET_BROWSER_PORT=%~1"
if not defined TARGET_BROWSER_PORT (
  call :LOG [CRM][ERROR] Browser launch skipped because requested port is empty.
  exit /b 2
)
set "URL=http://127.0.0.1:!TARGET_BROWSER_PORT!/#/labs"
set "CHROME="
set "BROWSER_MODE=shell-default"
set "BROWSER_TARGET="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined CHROME (
  set "BROWSER_MODE=chrome"
  set "BROWSER_TARGET=!CHROME!"
)

call :LOG [CRM] Browser launch attempt (BROWSER_OPENED=!BROWSER_OPENED!).
call :LOG [CRM] Browser launch URL: !URL!
if "!BROWSER_MODE!"=="chrome" (
  call :LOG [CRM] Browser launch selected mode=!BROWSER_MODE! path="!BROWSER_TARGET!"
  start "" "!BROWSER_TARGET!" "!URL!" >> "!LOGFILE!" 2>&1
) else (
  call :LOG [CRM] Browser launch selected mode=!BROWSER_MODE! path=shell-default
  start "" "!URL!" >> "!LOGFILE!" 2>&1
)

if "!errorlevel!"=="0" (
  set "BROWSER_OPENED=1"
  call :LOG [CRM] Browser launch completed; BROWSER_OPENED set to 1.
  exit /b 0
)
call :LOG [CRM][ERROR] Browser launch command returned error !errorlevel! (mode=!BROWSER_MODE!, url=!URL!).
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
if not "!SUPPRESS_FATAL_NOTEPAD!"=="1" start "" notepad "!LOGFILE!"
exit /b 1
