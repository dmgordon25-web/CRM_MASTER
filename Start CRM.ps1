Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'CRM Launcher'
Set-Location -LiteralPath $PSScriptRoot

$LogFile = Join-Path $PSScriptRoot 'launcher.log'
function Log($msg){ try{ Add-Content -Path $LogFile -Value ("[{0}] {1}" -f (Get-Date -Format s), $msg) -Encoding UTF8 }catch{} }

# Read prior PID (int or JSON { pid, port })
$pidFile = Join-Path -Path $PSScriptRoot -ChildPath '.devserver.pid'
$pid  = $null; $port = $null
if (Test-Path -LiteralPath $pidFile) {
  try {
    $raw  = Get-Content -LiteralPath $pidFile -Raw -ErrorAction Stop
    $trim = $raw.Trim()
    if ($trim.StartsWith('{') -and $trim.EndsWith('}')) {
      $parsed = $trim | ConvertFrom-Json -ErrorAction Stop
      if ($parsed.PSObject.Properties.Name -contains 'pid')  { $pid  = [int]$parsed.pid }
      if ($parsed.PSObject.Properties.Name -contains 'port') { $port = [int]$parsed.port }
    } elseif ($trim -match '^\d+$') { $pid = [int]$trim }
  } catch { $pid = $null; $port = $null }
}

# Is an instance running?
$isRunning = $false
if ($pid -and $pid -gt 0) {
  try { if (Get-Process -Id $pid -ErrorAction Stop) { $isRunning = $true } } catch { $isRunning = $false }
}
if ($isRunning) {
  Log "Already running (PID $pid, port=$port)."
  Write-Host "CRM dev server already running (PID $pid)." -ForegroundColor Yellow
  if ($port -and $port -gt 0) { Start-Process "http://127.0.0.1:$port/" }
  exit 0
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
  # Keep window so the user sees the message
  Write-Host "Press Enter to close..." -ForegroundColor Yellow
  [void][System.Console]::ReadLine()
  exit 2
}

# Start server hidden, in repo root, and verify readiness
try{
  $child = Start-Process -FilePath $node `
    -ArgumentList "tools/dev_server.mjs" `
    -WorkingDirectory $PSScriptRoot `
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

# Wait for pid file and port up to 10s
Start-Sleep -Milliseconds 600
$deadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $deadline -and -not (Test-Path -LiteralPath $pidFile)) {
  Start-Sleep -Milliseconds 200
}
if (Test-Path -LiteralPath $pidFile) {
  try {
    $raw  = Get-Content -LiteralPath $pidFile -Raw
    $trim = $raw.Trim()
    if ($trim.StartsWith('{') -and $trim.EndsWith('}')) {
      $parsed = $trim | ConvertFrom-Json -ErrorAction Stop
      if ($parsed.PSObject.Properties.Name -contains 'port') { $port = [int]$parsed.port }
    }
  } catch { }
}

if ($port -and $port -gt 0) {
  Log "Ready on port $port."
  Start-Process "http://127.0.0.1:$port/"
  exit 0
}

# Failure-hold: no port detected → keep window open with guidance
Log "No port detected; .devserver.pid missing or malformed."
Write-Host "The dev server did not become ready." -ForegroundColor Red
Write-Host "See 'launcher.log' for details." -ForegroundColor Yellow
Write-Host "Tip: run 'Start CRM - Diagnose.bat' for a visible, verbose attempt." -ForegroundColor Yellow
Write-Host "Press Enter to close..." -ForegroundColor Yellow
[void][System.Console]::ReadLine()
exit 4
