param(
  [switch]$Visible,
  [switch]$Diagnose
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'CRM Launcher'
Set-Location -LiteralPath $PSScriptRoot

$LogFile = Join-Path $PSScriptRoot 'launcher.log'
function Log($msg){
  try{ Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format s), $msg) -Encoding UTF8 }catch{}
}

# Kill any existing node.exe processes to prevent zombie instances
Log "Killing any existing node.exe processes..."
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

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
$commandLine = "$node $($serverArgs -join ' ')"
$workingDir = $PSScriptRoot
$port = 8080

if($Visible -or $Diagnose){
  Write-Host "[CRM] Working directory: $workingDir"
  Write-Host "[CRM] Node executable: $node"
  Write-Host "[CRM] Node version: $nodeVersion"
  Write-Host "[CRM] Launching: $commandLine" -ForegroundColor Cyan
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
    Start-Sleep -Seconds 1
    Start-Process "http://127.0.0.1:$port/"
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

# Give the server a moment to bind before opening the browser
Start-Sleep -Seconds 1
Start-Process "http://127.0.0.1:$port/"
exit 0
