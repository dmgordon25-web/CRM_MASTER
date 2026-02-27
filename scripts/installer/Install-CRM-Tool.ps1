param(
  [Parameter(Mandatory=$true)][string]$RepoRoot
)

$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path $RepoRoot).Path
$startBat = Join-Path $repo 'Start CRM.bat'
if (-not (Test-Path $startBat)) { throw "Missing Start CRM.bat at: $startBat" }

# Desktop path (works for most users)
$desktop = [Environment]::GetFolderPath('Desktop')
if (-not $desktop) { throw "Could not resolve Desktop folder." }

$lnkPath = Join-Path $desktop 'CRM Tool.lnk'

$wsh = New-Object -ComObject WScript.Shell
$sc = $wsh.CreateShortcut($lnkPath)

# Launch via cmd so .bat works reliably
$sc.TargetPath = "$env:WINDIR\System32\cmd.exe"
$sc.Arguments  = "/c `"$startBat`""
$sc.WorkingDirectory = $repo
$sc.WindowStyle = 1
$sc.Description = "CRM Tool"
$sc.Save()

if (-not (Test-Path $lnkPath)) { throw "Shortcut creation failed: $lnkPath" }

# Optional: launch once after creation
Start-Process -FilePath "$env:WINDIR\System32\cmd.exe" -ArgumentList "/c `"$startBat`"" -WorkingDirectory $repo

exit 0
