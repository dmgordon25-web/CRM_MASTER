Param(
  [string]$Entry = "./tools/dev_server.js"
)

# Relaunch hidden if not already hidden
if ($Host.UI.RawUI.WindowTitle -notlike "*HIDDEN*") {
  $args = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", "$PSCommandPath"
  )
  Start-Process -FilePath "powershell.exe" -ArgumentList $args -WindowStyle Hidden
  exit 0
}

# Mark window as hidden (for sanity), then start Node detached/hidden
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
