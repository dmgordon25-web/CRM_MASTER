$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path $scriptDir -Parent
$devServer = Join-Path $repoRoot 'tools/dev_server.mjs'

if (-not (Test-Path $devServer)) {
  throw "Dev server script not found: $devServer"
}

$serverProcess = $null
$browserProcess = $null
$url = 'http://127.0.0.1:8080/'

try {
  $serverProcess = Start-Process -FilePath 'node' -ArgumentList @($devServer) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru

  $edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
  ) | Where-Object { $_ -and (Test-Path $_) }

  if ($edgeCandidates.Count -gt 0) {
    $browserProcess = Start-Process -FilePath $edgeCandidates[0] -ArgumentList @('--new-window', $url) -PassThru
  } else {
    $browserProcess = Start-Process -FilePath $url -PassThru
  }

  if ($browserProcess -and $browserProcess.Id) {
    try {
      Wait-Process -Id $browserProcess.Id
    } catch {
      # Fallback: wait on handle if process disappears quickly
      if ($browserProcess -and $browserProcess.HasExited -ne $true) {
        Wait-Process -InputObject $browserProcess
      }
    }
  } else {
    # No dedicated browser process; keep the script alive until the user closes this window
    Wait-Process -Id $serverProcess.Id
  }
} finally {
  if ($serverProcess -and ($serverProcess.HasExited -ne $true)) {
    try {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    } catch { }
  }
}

exit 0
