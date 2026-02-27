param(
  [Parameter(Mandatory=$true)][string]$RepoRoot,
  [Parameter(Mandatory=$true)][string]$PsLogPath
)

$ErrorActionPreference = 'Stop'

function Log([string]$msg) {
  $line = ("[{0}] {1}" -f (Get-Date).ToString("s"), $msg)
  try { Add-Content -Path $PsLogPath -Value $line -Encoding UTF8 } catch {}
  Write-Host $msg
}

try {
  Log "Starting installer. RepoRoot=$RepoRoot"
  Log "PS log path=$PsLogPath"

  $repo = (Resolve-Path $RepoRoot).Path
  $startBat = Join-Path $repo 'Start CRM.bat'
  if (-not (Test-Path $startBat)) { throw "Missing Start CRM.bat at: $startBat" }

  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not $desktop) { throw "Could not resolve Desktop folder." }

  $lnkPath = Join-Path $desktop 'CRM Tool.lnk'
  Log "Creating shortcut: $lnkPath"

  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($lnkPath)
  $sc.TargetPath = "$env:WINDIR\System32\cmd.exe"
  $sc.Arguments  = "/c `"$startBat`""
  $sc.WorkingDirectory = $repo
  $sc.WindowStyle = 1
  $sc.Description = "CRM Tool"
  $sc.Save()

  if (-not (Test-Path $lnkPath)) { throw "Shortcut creation failed: $lnkPath" }

  Log "Shortcut created successfully."
  exit 0
}
catch {
  Log ("ERROR: " + $_.Exception.Message)
  Log ($_.ScriptStackTrace)
  exit 1
}
