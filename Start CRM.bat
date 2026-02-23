@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "LOG=%ROOT%launcher.log"

call :banner
call :log [CRM] Launcher root: "%ROOT%"

if not exist "%ROOT%server.js" call :fail [CRM][ERROR] Missing required file: "%ROOT%server.js"
if not exist "%ROOT%crm-app\index.html" call :fail [CRM][ERROR] Missing required file: "%ROOT%crm-app\index.html"

call :resolve_node
if not defined NODE call :fail [CRM][ERROR] Node.js runtime was not found. Install Node.js LTS or ship "%ROOT%node\node.exe".
call :log [CRM] Using Node executable: "%NODE%"

set "PORT="
for /l %%P in (8080,1,8100) do (
  if not defined PORT (
    call :is_crm_alive %%P
    if "!errorlevel!"=="0" (
      set "PORT=%%P"
      set "REUSE_SERVER=1"
      call :log [CRM] Reusing existing CRM server at http://127.0.0.1:%%P/
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
        call :log [CRM] Selected free port %%P
      )
    )
  )
)

if not defined PORT call :fail [CRM][ERROR] No reusable or free port found in range 8080-8100.

if "%REUSE_SERVER%"=="1" (
  call :open_browser "%PORT%"
  if not "%errorlevel%"=="0" call :fail [CRM][ERROR] Failed to launch browser for http://127.0.0.1:%PORT%/
  call :log [CRM] Launcher complete (existing server reused).
  exit /b 0
)

call :start_server "%PORT%"
if not "%errorlevel%"=="0" call :fail [CRM][ERROR] Failed to start CRM server process.

call :wait_for_port "%PORT%"
if not "%errorlevel%"=="0" call :fail [CRM][ERROR] CRM server did not become reachable within 20 seconds.

call :is_crm_alive "%PORT%"
if not "%errorlevel%"=="0" call :fail [CRM][ERROR] Port %PORT% opened but CRM health endpoint is not responding.

call :open_browser "%PORT%"
if not "%errorlevel%"=="0" call :fail [CRM][ERROR] Failed to launch browser for http://127.0.0.1:%PORT%/

call :log [CRM] Launcher complete.
exit /b 0

:banner
set "STAMP=%DATE% %TIME%"
echo [CRM] ==============================================
echo [CRM] Starting CRM launcher at %STAMP%
echo [CRM] ==============================================
>"%LOG%" echo [CRM] ==============================================
>>"%LOG%" echo [CRM] Starting CRM launcher at %STAMP%
>>"%LOG%" echo [CRM] ==============================================
exit /b 0

:resolve_node
set "NODE="
if exist "%ROOT%node\node.exe" (
  set "NODE=%ROOT%node\node.exe"
  call :log [CRM] Found bundled Node runtime.
  exit /b 0
)
call :log [CRM] Bundled Node runtime not found. Checking PATH for node.exe.
for /f "delims=" %%I in ('where node.exe 2^>^&1') do (
  if not defined NODE if exist "%%~fI" set "NODE=%%~fI"
)
if defined NODE (
  call :log [CRM] Found node.exe on PATH.
) else (
  call :log [CRM] Node runtime discovery failed.
)
exit /b 0

:start_server
set "PORT=%~1"
call :log [CRM] Starting CRM server on port %PORT%.
set "SERVER_PID="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $argsList=@('""%ROOT%server.js""','--port','%PORT%'); $p=Start-Process -FilePath '%NODE%' -ArgumentList $argsList -WorkingDirectory '%ROOT%' -WindowStyle Hidden -RedirectStandardOutput '%LOG%' -RedirectStandardError '%LOG%' -PassThru; Write-Output $p.Id" 2^>^&1`) do (
  if not defined SERVER_PID set "SERVER_PID=%%I"
)
if defined SERVER_PID (
  call :log [CRM] CRM server process started with PID %SERVER_PID%.
  exit /b 0
)
call :log [CRM] CRM server start did not return a PID.
exit /b 1

:wait_for_port
set "PORT=%~1"
call :log [CRM] Waiting for TCP readiness on 127.0.0.1:%PORT% (max 20 seconds).
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $deadline=(Get-Date).AddSeconds(20); while((Get-Date) -lt $deadline){ $client=New-Object System.Net.Sockets.TcpClient; try { $iar=$client.BeginConnect('127.0.0.1', %PORT%, $null, $null); if($iar.AsyncWaitHandle.WaitOne(500)){ $null=$client.EndConnect($iar); $client.Close(); exit 0 } } catch {} finally { $client.Close() }; Start-Sleep -Milliseconds 250 }; exit 1" >> "%LOG%" 2>&1
if "%errorlevel%"=="0" (
  call :log [CRM] TCP readiness confirmed for port %PORT%.
  exit /b 0
)
call :log [CRM] TCP readiness timeout reached for port %PORT%.
exit /b 1

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
  call :log [CRM] Launching Microsoft Edge app mode: "%EDGE%"
  start "" "%EDGE%" --app="%URL%" >> "%LOG%" 2>&1
  if "%errorlevel%"=="0" exit /b 0
  call :log [CRM] Edge launch command returned error %errorlevel%.
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME for /f "delims=" %%I in ('where chrome.exe 2^>^&1') do if not defined CHROME set "CHROME=%%~fI"

if defined CHROME (
  call :log [CRM] Launching Google Chrome app mode: "%CHROME%"
  start "" "%CHROME%" --app="%URL%" >> "%LOG%" 2>&1
  if "%errorlevel%"=="0" exit /b 0
  call :log [CRM] Chrome launch command returned error %errorlevel%.
)

call :log [CRM] Launching default browser fallback: %URL%
start "" "%URL%" >> "%LOG%" 2>&1
if "%errorlevel%"=="0" exit /b 0
call :log [CRM] Default browser launch returned error %errorlevel%.
exit /b 1

:log
echo %*
>>"%LOG%" echo [%DATE% %TIME%] %*
exit /b 0

:fail
call :log %*
call :log [CRM][ERROR] Opening launcher log: %LOG%
start "" notepad.exe "%LOG%"
echo [CRM][ERROR] Launcher failed. Review launcher.log for details.
pause
exit /b 1
