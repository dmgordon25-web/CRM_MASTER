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

function Test-ServerHttpReady([int]$port, [int]$timeoutSeconds = 2){
  $rootUrl = "http://127.0.0.1:$port/"
  try {
    $null = Invoke-WebRequest -Uri $rootUrl -Method Get -TimeoutSec $timeoutSeconds -UseBasicParsing
    return $true
  } catch {
    return $false
  }
}

function Wait-ServerReady([int]$port, [int]$timeoutSeconds = 20){
  $deadline = [DateTime]::UtcNow.AddSeconds($timeoutSeconds)
  while([DateTime]::UtcNow -lt $deadline){
    if(Test-ServerHttpReady -port $port -timeoutSeconds 2){
      return $true
    }
    Start-Sleep -Milliseconds 250
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

function Open-Browser([int]$port){
  $appUrl = "http://127.0.0.1:$port/#/labs"
  $rootUrl = "http://127.0.0.1:$port/"

  $edgeCandidates = @(
    (Get-Command msedge.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if(@($edgeCandidates).Count -gt 0){
    Start-Process -FilePath $edgeCandidates[0] -ArgumentList "--app=$appUrl"
    return
  }

  $chromeCandidates = @(
    (Get-Command chrome.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if(@($chromeCandidates).Count -gt 0){
    Start-Process -FilePath $chromeCandidates[0] -ArgumentList "--app=$appUrl"
    return
  }

  Write-Host "[CRM] Edge/Chrome app mode not found. Opening default browser." -ForegroundColor Yellow
  Write-Host "[CRM] Install Microsoft Edge or Google Chrome for app-window mode." -ForegroundColor Yellow
  Start-Process $rootUrl
}

# Resolve node.exe robustly
$bundledCandidates = @(
  (Join-Path $PSScriptRoot 'node\node.exe'),
  (Join-Path $PSScriptRoot 'node\node')
)

$node = $null
foreach($candidate in $bundledCandidates){
  if(Test-Path $candidate){
    $node = $candidate
    break
  }
}

if (-not $node) {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
}

if (-not $node) {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'nodejs\node.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
  )
  foreach($c in $candidates){ if (Test-Path $c) { $node = $c; break } }
}
if (-not $node) {
  Write-Host "[CRM] Node.js not found. Install Node 18+ or add node.exe to PATH." -ForegroundColor Red
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

if(Test-ServerHttpReady -port $Port -timeoutSeconds 2){
  Write-Host "[CRM] Server already running on port $Port. Opening app..." -ForegroundColor Green
  Log "Existing responsive server on port $Port; launching browser only."
  Open-Browser -port $Port
  exit 0
}

$listenerPid = Get-ListeningProcessId -port $Port
if($listenerPid){
  $processName = Describe-Process -pid $listenerPid
  Write-Host "[CRM] Port $Port is in use by another app (PID $listenerPid, $processName)." -ForegroundColor Red
  Write-Host "[CRM] Fix: close that app or launch CRM with a different port (set CRM_PORT=8090)." -ForegroundColor Yellow
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
    Write-Host "[CRM] Starting local server..." -ForegroundColor Green
    if(-not (Wait-ServerReady -port $Port -timeoutSeconds 20)){
      Write-Host "[CRM] Server failed to respond at http://127.0.0.1:$Port/ within 20 seconds." -ForegroundColor Red
      Write-Host "[CRM] Fix: check launcher.log, verify Node can run tools/node_static_server.js, and free port $Port." -ForegroundColor Yellow
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
  Write-Host "[CRM] Launcher failed to start Node: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "[CRM] Fix: verify Node install and file permissions under $PSScriptRoot." -ForegroundColor Yellow
  Write-Host "Press Enter to close..." -ForegroundColor Yellow
  [void][System.Console]::ReadLine()
  exit 3
}

if(-not (Wait-ServerReady -port $Port -timeoutSeconds 20)){
  Write-Host "[CRM] Server failed to respond at http://127.0.0.1:$Port/ within 20 seconds." -ForegroundColor Red
  Write-Host "[CRM] Fix: check launcher.log, verify Node can run tools/node_static_server.js, and free port $Port." -ForegroundColor Yellow
  Log "Timeout waiting for server readiness on port $Port."
  exit 4
}

Open-Browser -port $Port
exit 0
