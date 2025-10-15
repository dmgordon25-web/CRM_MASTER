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

function Get-EdgeProcessMap {
  $map = @{}
  try {
    foreach ($proc in Get-Process -Name 'msedge' -ErrorAction Stop) {
      $map[$proc.Id] = $true
    }
  } catch {
    # Edge may not be installed or accessible.
  }

  return $map
}

function Wait-ForLaunchedEdgeWindow {
  param (
    [hashtable]$ExistingEdgeProcesses,
    [int]$PollIntervalMilliseconds = 250,
    [int]$MaxInitialWaitMilliseconds = 5000
  )

  $observed = @{}
  $deadline = (Get-Date).AddMilliseconds($MaxInitialWaitMilliseconds)
  $active = @()

  while ((Get-Date) -lt $deadline) {
    try {
      $active = Get-Process -Name 'msedge' -ErrorAction Stop | Where-Object { -not $ExistingEdgeProcesses.ContainsKey($_.Id) }
    } catch {
      return
    }

    if ($active) {
      break
    }

    Start-Sleep -Milliseconds $PollIntervalMilliseconds
  }

  if (-not $active) {
    return
  }

  while ($true) {
    $pending = $active | Where-Object { -not $observed.ContainsKey($_.Id) }

    if ($pending) {
      $ids = $pending | Select-Object -ExpandProperty Id

      try {
        Wait-Process -Id $ids -ErrorAction SilentlyContinue
      } catch {
        # Ignore races where the process has already exited.
      }

      foreach ($proc in $pending) {
        $observed[$proc.Id] = $true
      }
    }

    try {
      $active = Get-Process -Name 'msedge' -ErrorAction Stop | Where-Object { -not $ExistingEdgeProcesses.ContainsKey($_.Id) }
    } catch {
      return
    }

    if (-not $active) {
      return
    }

    Start-Sleep -Milliseconds $PollIntervalMilliseconds
  }
}

try {
  $serverProcess = Start-Process -FilePath 'node' -ArgumentList @($devServer) -WorkingDirectory $repoRoot -WindowStyle Hidden -PassThru

  $existingEdgeProcesses = Get-EdgeProcessMap

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
      Wait-Process -Id $browserProcess.Id -ErrorAction SilentlyContinue
    } catch {
      # Fallback: wait on handle if process disappears quickly
      if ($browserProcess -and $browserProcess.HasExited -ne $true) {
        Wait-Process -InputObject $browserProcess -ErrorAction SilentlyContinue
      }
    }

    Wait-ForLaunchedEdgeWindow -ExistingEdgeProcesses $existingEdgeProcesses
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
