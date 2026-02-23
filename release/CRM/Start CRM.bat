@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "NODE=%ROOT%\node\node.exe"
if exist "%NODE%" goto node_ok

for /f "delims=" %%I in ('where node 2^>nul') do (
  if not defined NODE set "NODE=%%~fI"
)
if defined NODE goto node_ok

echo [CRM] Fatal error: Node.js runtime not found.
echo [CRM] This release expects either:
echo [CRM]   1^) Bundled runtime at "%ROOT%\node\node.exe", or
echo [CRM]   2^) A system Node.js installation available on PATH.
echo [CRM] Please reinstall the CRM release package.
exit /b 1

:node_ok
if not exist "%ROOT%\server.js" (
  echo [CRM] Fatal error: Missing "%ROOT%\server.js".
  echo [CRM] Please reinstall the CRM release package.
  exit /b 1
)

if not exist "%ROOT%\crm-app\index.html" (
  echo [CRM] Fatal error: Missing "%ROOT%\crm-app\index.html".
  echo [CRM] Please reinstall the CRM release package.
  exit /b 1
)

set "PORT="
for /l %%P in (8080,1,8100) do (
  call :is_port_in_use %%P
  if "!errorlevel!"=="0" (
    if not defined PORT set "PORT=%%P"
  )
)

if not defined PORT (
  echo [CRM] Fatal error: No available TCP port in range 8080-8100.
  exit /b 1
)

call :is_server_responding %PORT%
if "%errorlevel%"=="0" (
  start "" "http://127.0.0.1:%PORT%/"
  exit /b 0
)

start "CRM Server" "%NODE%" "%ROOT%\server.js" --port %PORT%

set "READY="
for /l %%W in (1,1,80) do (
  call :is_server_responding %PORT%
  if "!errorlevel!"=="0" (
    set "READY=1"
    goto open_browser
  )
  >nul ping 127.0.0.1 -n 2
)

echo [CRM] Fatal error: Server failed to start on port %PORT%.
exit /b 1

:open_browser
start "" "http://127.0.0.1:%PORT%/"
exit /b 0

:is_port_in_use
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $client = New-Object System.Net.Sockets.TcpClient; try { $client.Connect('127.0.0.1', %1); exit 1 } catch { exit 0 } finally { $client.Dispose() }" >nul 2>&1
exit /b %errorlevel%

:is_server_responding
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; try { $r = Invoke-WebRequest -Uri ('http://127.0.0.1:' + %1 + '/') -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
exit /b %errorlevel%
