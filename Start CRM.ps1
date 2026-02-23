param(
  [switch]$Visible,
  [switch]$Diagnose,
  [int]$Port
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'CRM Launcher'
Set-Location -LiteralPath $PSScriptRoot

$LogFile = Join-Path $PSScriptRoot 'launcher.log'
function Log($msg){
  try{ Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format s), $msg) -Encoding UTF8 }catch{}
}

if(-not $Port){
  if([string]::IsNullOrWhiteSpace($env:CRM_PORT)){
    $Port = 8080
  } else {
    $Port = [int]$env:CRM_PORT
  }
}

function Get-ListeningProcessId([int]$port){
  try {
    $conn = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction Stop | Select-Object -First 1
    if($conn){ return $conn.OwningProcess }
  } catch {
    $null = $_
  }

  $netstat = netstat -ano | Select-String ":$port" | Where-Object { $_ -match 'LISTENING' } | Select-Object -First 1
  if($netstat){
    $parts = $netstat.ToString().Split() | Where-Object { $_ }
    if($parts.Length -ge 5){ return [int]$parts[-1] }
  }
  return $null
}

function Open-Browser([int]$port){
  $url = "http://127.0.0.1:$port/"

  $edgeCandidates = @(
    (Get-Command msedge.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if($edgeCandidates.Count -gt 0){
    Start-Process -FilePath $edgeCandidates[0] -ArgumentList "--app=$url"
    return
  }

  $chromeCandidates = @(
    (Get-Command chrome.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if($chromeCandidates.Count -gt 0){
    Start-Process -FilePath $chromeCandidates[0] -ArgumentList "--app=$url"
    return
  }

  Start-Process $url
}

function Wait-ServerReady([int]$port, [int]$timeoutSeconds = 20){
  $deadline = [DateTime]::UtcNow.AddSeconds($timeoutSeconds)
  while([DateTime]::UtcNow -lt $deadline){
    try {
      $tcpClient = [System.Net.Sockets.TcpClient]::new()
      $async = $tcpClient.ConnectAsync('127.0.0.1', $port)
      if($async.Wait(500) -and $tcpClient.Connected){
        $tcpClient.Dispose()
        return $true
      }
      $tcpClient.Dispose()
    } catch {
      $null = $_
    }
    Start-Sleep -Milliseconds 200
  }

  return $false
}

function Describe-Process([int]$pid){
  try {
    $proc = Get-Process -Id $pid -ErrorAction Stop
    return $proc.ProcessName
  } catch {
    return 'unknown'
  }
}

# Resolve node.exe robustly
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
  )
  foreach($c in $candidates){ if (Test-Path $c) { $node = $c; break } }
}
if (-not $node) {
  Write-Host "Node.js not found on PATH. Install Node 18+ or add node.exe to PATH." -ForegroundColor Red
  Log "FATAL: node.exe not found."
  Write-Host "Press Enter to close..." -ForegroundColor Yellow
  [void][System.Console]::ReadLine()
  exit 2
}

$nodeVersion = try { & $node -v } catch { 'unknown' }
$serverArgs = @('tools/node_static_server.js','crm-app')
if($Port){ $serverArgs += $Port }
$commandLine = "$node $($serverArgs -join ' ')"
$workingDir = $PSScriptRoot

if($Visible -or $Diagnose){
  Write-Host "[CRM] Working directory: $workingDir"
  Write-Host "[CRM] Node executable: $node"
  Write-Host "[CRM] Node version: $nodeVersion"
  Write-Host "[CRM] Launch command: $commandLine" -ForegroundColor Cyan
}

Write-Host "[CRM] Checking port $Port availability..."
$listenerPid = Get-ListeningProcessId -port $Port
if($listenerPid){
  $processName = Describe-Process -pid $listenerPid
  if($processName -ieq 'node'){
    Write-Host "[CRM] Node is already listening on port $Port (PID $listenerPid). Opening browser..." -ForegroundColor Green
    Log "Existing node on port $Port (PID $listenerPid); launching browser only."
    if(-not (Wait-ServerReady -port $Port)){
      Write-Host "[CRM] Server did not become ready on port $Port within timeout." -ForegroundColor Red
      Log "Timeout waiting for existing server readiness on port $Port."
      exit 4
    }
    Open-Browser -port $Port
    exit 0
  }
  Write-Host "[CRM] Port $Port is already in use by PID $listenerPid ($processName)." -ForegroundColor Red
  Log "Port $Port busy by PID $listenerPid ($processName)."
  exit 1
}

try{
  if($Visible -or $Diagnose){
    Log "Spawning node in visible mode..."
    $child = Start-Process -FilePath $node `
      -ArgumentList $serverArgs `
      -WorkingDirectory $workingDir `
      -NoNewWindow `
      -PassThru
    Write-Host "[CRM] Server PID: $($child.Id)" -ForegroundColor Green
    if(-not (Wait-ServerReady -port $Port)){
      Write-Host "[CRM] Server did not become ready on port $Port within timeout." -ForegroundColor Red
      Log "Timeout waiting for server readiness on port $Port (visible mode)."
      exit 4
    }
    Open-Browser -port $Port
    Wait-Process $child.Id
    exit $LASTEXITCODE
  }

  $child = Start-Process -FilePath $node `
    -ArgumentList $serverArgs `
    -WorkingDirectory $workingDir `
    -WindowStyle Hidden `
    -PassThru
  Log "Spawned node (PID $($child.Id))."
} catch {
  Log ("FATAL: Start-Process failed: {0}" -f $_)
  Write-Host "Launcher failed to start Node: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Press Enter to close..." -ForegroundColor Yellow
  [void][System.Console]::ReadLine()
  exit 3
}

if(-not (Wait-ServerReady -port $Port)){
  Write-Host "[CRM] Server did not become ready on port $Port within timeout." -ForegroundColor Red
  Log "Timeout waiting for server readiness on port $Port."
  exit 4
}
Open-Browser -port $Port
exit 0
