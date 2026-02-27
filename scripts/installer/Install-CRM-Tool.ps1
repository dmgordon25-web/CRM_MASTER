param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'CRM Tool')
)

$ErrorActionPreference = 'Stop'

$logPath = Join-Path $env:TEMP 'CRM_Tool_Install.log'
Set-Content -LiteralPath $logPath -Value '' -Encoding UTF8

function Write-InstallLog {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line
}

$sourceRootResolved = (Resolve-Path -LiteralPath $SourceRoot).Path
$requiredEntries = @(
  'Start CRM.bat',
  'server.js',
  'crm-app'
)

foreach ($entry in $requiredEntries) {
  $entryPath = Join-Path $sourceRootResolved $entry
  if (-not (Test-Path -LiteralPath $entryPath)) {
    throw "Missing required source item: $entryPath"
  }
}

$launcherPath = Join-Path $InstallRoot 'Start CRM.bat'
$nodeSource = Join-Path $sourceRootResolved 'node'
$desktopPath = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktopPath)) {
  throw 'Unable to resolve Desktop path.'
}
$shortcutPath = Join-Path $desktopPath 'CRM Tool.lnk'

try {
  Write-InstallLog "Source root: $sourceRootResolved"
  Write-InstallLog "Install root: $InstallRoot"

  if (Test-Path -LiteralPath $InstallRoot) {
    Write-InstallLog 'Removing previous install folder.'
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null

  Copy-Item -LiteralPath (Join-Path $sourceRootResolved 'Start CRM.bat') -Destination $InstallRoot -Force
  Copy-Item -LiteralPath (Join-Path $sourceRootResolved 'server.js') -Destination $InstallRoot -Force
  Copy-Item -LiteralPath (Join-Path $sourceRootResolved 'crm-app') -Destination $InstallRoot -Recurse -Force

  if (Test-Path -LiteralPath $nodeSource) {
    Write-InstallLog 'Bundled node runtime detected; copying node folder.'
    Copy-Item -LiteralPath $nodeSource -Destination $InstallRoot -Recurse -Force
  } else {
    Write-InstallLog 'Bundled node runtime not found; launcher will use system Node.js.'
  }

  if (-not (Test-Path -LiteralPath $launcherPath)) {
    throw "Launcher missing after copy: $launcherPath"
  }

  $wshShell = New-Object -ComObject WScript.Shell
  $shortcut = $wshShell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.Description = 'Launch CRM Tool'
  $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,220"
  $shortcut.Save()

  Write-InstallLog "Desktop shortcut created: $shortcutPath"
  Write-InstallLog "Shortcut target: $launcherPath"

  Start-Process -FilePath $launcherPath | Out-Null
  Write-InstallLog 'CRM Tool launched from installer.'
}
catch {
  $detail = $_.Exception.Message
  Write-InstallLog "Installation failed: $detail"
  throw
}
