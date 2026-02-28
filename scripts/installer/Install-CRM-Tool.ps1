param([Parameter(Mandatory=$true)][string]$RepoRoot)
$ErrorActionPreference = 'Stop'

function TryCreateShortcut([string]$desktopPath, [string]$startBat, [string]$repo) {
  if (-not $desktopPath) { return $null }
  if (-not (Test-Path $desktopPath)) { return $null }

  $lnkPath = Join-Path $desktopPath 'CRM Tool.lnk'
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($lnkPath)
  $sc.TargetPath = "$env:WINDIR\System32\cmd.exe"
  $sc.Arguments  = "/c `\"$startBat`\""
  $sc.WorkingDirectory = $repo
  $sc.WindowStyle = 1
  $sc.Description = "CRM Tool"
  $sc.Save()

  if (Test-Path $lnkPath) { return $lnkPath }
  return $null
}

try {
  $repo = (Resolve-Path $RepoRoot).Path
  $startBat = Join-Path $repo 'Start CRM.bat'
  if (-not (Test-Path $startBat)) { throw "Missing Start CRM.bat at: $startBat" }

  $classicDesktop = Join-Path $env:USERPROFILE 'Desktop'
  $oneDriveDesktop = $null
  if ($env:OneDrive) { $oneDriveDesktop = Join-Path $env:OneDrive 'Desktop' }

  Write-Host "RepoRoot: $repo"
  Write-Host "StartBat: $startBat"
  Write-Host "Trying Desktop: $classicDesktop"
  if ($oneDriveDesktop) { Write-Host "Trying OneDrive Desktop: $oneDriveDesktop" }

  $created = @()
  $p1 = TryCreateShortcut $classicDesktop $startBat $repo
  if ($p1) { $created += $p1 }

  $p2 = TryCreateShortcut $oneDriveDesktop $startBat $repo
  if ($p2) { $created += $p2 }

  if ($created.Count -eq 0) {
    throw "Shortcut creation failed. Tried: '$classicDesktop' and '$oneDriveDesktop'."
  }

  Write-Host "Shortcut created at:"
  $created | ForEach-Object { Write-Host " - $_" }

  # Optional: launch once
  Start-Process -FilePath "$env:WINDIR\System32\cmd.exe" -ArgumentList "/c `\"$startBat`\"" -WorkingDirectory $repo

  exit 0
}
catch {
  Write-Host ("ERROR: " + $_.Exception.Message)
  Write-Host $_.ScriptStackTrace
  exit 1
}
