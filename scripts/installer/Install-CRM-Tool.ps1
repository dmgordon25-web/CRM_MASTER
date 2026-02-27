param([Parameter(Mandatory=$true)][string]$RepoRoot)
$ErrorActionPreference = 'Stop'

try {
  $repo = (Resolve-Path $RepoRoot).Path
  $startBat = Join-Path $repo 'Start CRM.bat'
  if (-not (Test-Path $startBat)) { throw "Missing Start CRM.bat at: $startBat" }

  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not $desktop) { throw "Could not resolve Desktop folder." }

  $lnkPath = Join-Path $desktop 'CRM Tool.lnk'

  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($lnkPath)
  $sc.TargetPath = "$env:WINDIR\System32\cmd.exe"
  $sc.Arguments  = "/c `"$startBat`""
  $sc.WorkingDirectory = $repo
  $sc.WindowStyle = 1
  $sc.Description = "CRM Tool"
  $sc.Save()

  if (-not (Test-Path $lnkPath)) { throw "Shortcut creation failed: $lnkPath" }

  exit 0
}
catch {
  Write-Host ("ERROR: " + $_.Exception.Message)
  Write-Host $_.ScriptStackTrace
  exit 1
}
