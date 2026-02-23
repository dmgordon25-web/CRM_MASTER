@echo off
setlocal EnableExtensions EnableDelayedExpansion

echo Starting CRM launcher...
set "ROOT=%~dp0"
cd /d "%ROOT%"

set "LOG=%ROOT%launcher.log"
>"%LOG%" echo [%DATE% %TIME%] Starting CRM launcher...
call :log [CRM] Working directory: %ROOT%

if not exist "%ROOT%server.js" call :fail [CRM] Fatal error: Missing "%ROOT%server.js".
if not exist "%ROOT%crm-app\index.html" call :fail [CRM] Fatal error: Missing "%ROOT%crm-app\index.html".

set "NODE="
if exist "%ROOT%node\node.exe" (
  set "NODE=%ROOT%node\node.exe"
  call :log [CRM] Using bundled Node runtime: "%NODE%"
) else (
  call :log [CRM] Bundled Node runtime not found. Searching PATH...
  for /f "delims=" %%I in ('where node') do (
    if not defined NODE set "NODE=%%~fI"
  )
)

if not defined NODE (
  call :fail [CRM] Fatal error: Node.js runtime not found. Install Node.js or include "%ROOT%node\node.exe".
)

call :log [CRM] Node executable: "%NODE%"
set "PORT="
for /l %%P in (8080,1,8100) do (
  call :is_port_free %%P
  if "!errorlevel!"=="0" if not defined PORT set "PORT=%%P"
)

if not defined PORT call :fail [CRM] Fatal error: No available TCP port in range 8080-8100.
call :log [CRM] Selected port: %PORT%

call :is_server_responding %PORT%
if "%errorlevel%"=="0" (
  call :log [CRM] Existing server responds on port %PORT%. Opening browser.
  call :open_browser %PORT%
  call :log [CRM] Launcher complete.
  exit /b 0
)

call :log [CRM] Starting server process...
set "SERVER_PID="
for /f %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $p = Start-Process -FilePath '%NODE%' -ArgumentList '""%ROOT%server.js"" --port %PORT%' -WorkingDirectory '%ROOT%' -WindowStyle Hidden -PassThru; $p.Id"') do (
  if not defined SERVER_PID set "SERVER_PID=%%I"
)

if not defined SERVER_PID call :fail [CRM] Fatal error: Failed to start the CRM server process.
call :log [CRM] Server started with PID %SERVER_PID%.

call :log [CRM] Waiting for readiness: http://127.0.0.1:%PORT%/index.html (20s timeout)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $deadline=(Get-Date).AddSeconds(20); while((Get-Date)-lt $deadline){ try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:%PORT%/index.html' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } } catch {} Start-Sleep -Milliseconds 250 }; exit 1"
if not "%errorlevel%"=="0" call :fail [CRM] Fatal error: Server did not become ready within 20 seconds.

call :log [CRM] Server ready. Opening browser.
call :open_browser %PORT%
call :log [CRM] Launcher complete.
exit /b 0

:open_browser
set "URL=http://127.0.0.1:%~1/"
where msedge.exe
if "%errorlevel%"=="0" (
  call :log [CRM] Launching Microsoft Edge app-mode.
  start "" msedge.exe --app="%URL%"
  exit /b 0
)

where chrome.exe
if "%errorlevel%"=="0" (
  call :log [CRM] Launching Google Chrome app-mode.
  start "" chrome.exe --app="%URL%"
  exit /b 0
)

call :log [CRM] Launching default browser fallback.
start "" "%URL%"
exit /b 0

:is_port_free
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $l=New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Parse('127.0.0.1'), %1); $l.Start(); $l.Stop(); exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:is_server_responding
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $r=Invoke-WebRequest -Uri 'http://127.0.0.1:%1/index.html' -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -ge 200 -and $r.StatusCode -lt 500){ exit 0 } else { exit 1 } } catch { exit 1 }"
exit /b %errorlevel%

:log
echo %~1
>>"%LOG%" echo [%DATE% %TIME%] %~1
exit /b 0

:fail
call :log %~1
call :log [CRM] Opening launcher log: %LOG%
start "" notepad.exe "%LOG%"
echo.
echo Launcher failed. See launcher.log for details.
pause
exit /b 1
