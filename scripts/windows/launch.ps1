Param(
  [string]$Entry = "./tools/dev_server.js",
  [switch]$HiddenLaunch
)

# Relaunch hidden if not already hidden
if (-not $HiddenLaunch) {
  $args = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", "$PSCommandPath",
    "-HiddenLaunch"
  )

  if ($PSBoundParameters.ContainsKey('Entry')) {
    $args += @('-Entry', $Entry)
  }

  Start-Process -FilePath "powershell.exe" -ArgumentList $args -WindowStyle Hidden
  exit 0
}

# Start Node detached/hidden
$nodeArgs = @($Entry)
$proc = Start-Process -FilePath "node.exe" -ArgumentList $nodeArgs -PassThru -WindowStyle Hidden

# Ensure child is terminated when this script exits for any reason
$script:cleanup = {
  try {
    if ($proc -and !$proc.HasExited) {
      Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}

Register-EngineEvent PowerShell.Exiting -Action $cleanup | Out-Null
try {
  Wait-Process -Id $proc.Id
} finally {
  & $script:cleanup
}
