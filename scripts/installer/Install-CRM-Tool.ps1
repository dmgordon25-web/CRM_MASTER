param(
  [string]$RepoRoot
)

$ErrorActionPreference = 'Stop'
$psLogPath = Join-Path $env:TEMP 'CRMTool-Install-ps.log'
$transcriptStarted = $false

function Write-InstallMessage {
  param([string]$Message)

  $line = "[CRM INSTALL] $Message"
  Write-Host $line
  try {
    Add-Content -LiteralPath $psLogPath -Value $line -Encoding UTF8
  } catch {
    Write-Host '[CRM INSTALL] Warning: unable to append to PS log file.'
  }
}

try {
  try {
    if (Test-Path -LiteralPath $psLogPath) {
      Remove-Item -LiteralPath $psLogPath -Force
    }
    New-Item -ItemType File -Path $psLogPath -Force | Out-Null
  } catch {
    Write-Host "[CRM INSTALL] Warning: unable to reset PS log at $psLogPath"
  }

  try {
    Start-Transcript -LiteralPath $psLogPath -Append | Out-Null
    $transcriptStarted = $true
  } catch {
    Write-Host "[CRM INSTALL] Warning: transcript could not start at $psLogPath"
  }

  if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    throw 'RepoRoot parameter is required.'
  }

  $resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
  $appEntry = Join-Path $resolvedRepoRoot 'crm-app\index.html'
  if (-not (Test-Path -LiteralPath $appEntry)) {
    throw "Missing required runtime entry: $appEntry"
  }

  $sourceStartBat = Join-Path $resolvedRepoRoot 'Start CRM.bat'
  $sourceServerJs = Join-Path $resolvedRepoRoot 'server.js'
  $sourceCrmApp = Join-Path $resolvedRepoRoot 'crm-app'
  $sourceNodeFolder = Join-Path $resolvedRepoRoot 'node'

  foreach ($requiredPath in @($sourceStartBat, $sourceServerJs, $sourceCrmApp)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Missing required runtime item: $requiredPath"
    }
  }

  $InstallRoot = Join-Path $env:LOCALAPPDATA 'CRM Tool'
  $desktopPath = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    throw 'Desktop path could not be resolved.'
  }

  $launcherPath = Join-Path $InstallRoot 'Start CRM Tool.bat'
  $installedStartBat = Join-Path $InstallRoot 'Start CRM.bat'
  $shortcutPath = Join-Path $desktopPath 'CRM Tool.lnk'

  Write-InstallMessage "Repo root: $resolvedRepoRoot"
  Write-InstallMessage "Install root: $InstallRoot"

  if (Test-Path -LiteralPath $InstallRoot) {
    Write-InstallMessage 'Removing existing install folder.'
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null

  Write-InstallMessage 'Copying runtime files.'
  Copy-Item -LiteralPath $sourceStartBat -Destination $InstallRoot -Force
  Copy-Item -LiteralPath $sourceServerJs -Destination $InstallRoot -Force
  Copy-Item -LiteralPath $sourceCrmApp -Destination $InstallRoot -Recurse -Force

  if (Test-Path -LiteralPath $sourceNodeFolder) {
    Write-InstallMessage 'Copying bundled node runtime.'
    Copy-Item -LiteralPath $sourceNodeFolder -Destination $InstallRoot -Recurse -Force
  } else {
    Write-InstallMessage 'Bundled node runtime not found; installed launcher will use system Node.js if available.'
  }

  $launcherContent = @(
    '@echo off',
    'setlocal EnableExtensions',
    'cd /d "%~dp0"',
    'call "%~dp0Start CRM.bat"'
  )
  Set-Content -LiteralPath $launcherPath -Value $launcherContent -Encoding ASCII

  if (-not (Test-Path -LiteralPath $installedStartBat)) {
    throw "Installed runtime launcher missing: $installedStartBat"
  }

  $wshShell = New-Object -ComObject WScript.Shell
  $shortcut = $wshShell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.Description = 'Launch CRM Tool'
  $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,220"
  $shortcut.Save()

  Write-InstallMessage "Desktop shortcut created: $shortcutPath"
  Write-InstallMessage "Desktop shortcut target: $launcherPath"

  Start-Process -FilePath $launcherPath -WorkingDirectory $InstallRoot | Out-Null
  Write-InstallMessage 'Installed launcher started.'

  exit 0
}
catch {
  $message = $_.Exception.Message
  Write-InstallMessage "ERROR: $message"
  exit 1
}
finally {
  Write-InstallMessage "PowerShell log: $psLogPath"
  if ($transcriptStarted) {
    try {
      Stop-Transcript | Out-Null
    } catch {
      Write-Host '[CRM INSTALL] Warning: transcript stop failed.'
    }
  }
}
