param(
  [Parameter(Mandatory=$true)][string]$RepoRoot,
  [Parameter(Mandatory=$true)][string]$PsLogPath
)

$ErrorActionPreference = 'Stop'
$transcriptStarted = $false

function Write-InstallLog {
  param([string]$Message)

  $line = "[CRM INSTALL] $Message"
  Write-Host $line
  try {
    Add-Content -LiteralPath $PsLogPath -Value $line -Encoding UTF8
  } catch {
    Write-Host '[CRM INSTALL] Warning: unable to write to PS log path.'
  }
}

function Resolve-NeededRuntimePaths {
  param(
    [string]$StartBatPath,
    [string]$ResolvedRepoRoot
  )

  $needed = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($must in @('Start CRM.bat', 'server.js', 'crm-app')) {
    [void]$needed.Add($must)
  }

  $content = Get-Content -LiteralPath $StartBatPath -Raw
  $matches = [regex]::Matches($content, '(?i)(?:!ROOT!|%ROOT%)([^"\r\n\s]+)')
  foreach ($match in $matches) {
    $candidate = $match.Groups[1].Value.Trim()
    if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
    $candidate = $candidate -replace '/', '\\'
    if ($candidate.StartsWith('\\')) { $candidate = $candidate.Substring(1) }
    if ($candidate.Contains('..')) { continue }

    $candidatePath = Join-Path $ResolvedRepoRoot $candidate
    if (Test-Path -LiteralPath $candidatePath) {
      [void]$needed.Add($candidate)
    }
  }

  return @($needed)
}

try {
  Write-Host "PS log: $PsLogPath"
  try {
    if (Test-Path -LiteralPath $PsLogPath) {
      Remove-Item -LiteralPath $PsLogPath -Force
    }
    New-Item -ItemType File -Path $PsLogPath -Force | Out-Null
  } catch {
    Write-Host "[CRM INSTALL] Warning: unable to initialize PS log at $PsLogPath"
  }

  try {
    Start-Transcript -Path $PsLogPath -Append | Out-Null
    $transcriptStarted = $true
  } catch {
    Write-InstallLog "Warning: Start-Transcript failed for $PsLogPath"
  }

  Write-InstallLog "PS log: $PsLogPath"

  $resolvedRepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
  $requiredIndex = Join-Path $resolvedRepoRoot 'crm-app\index.html'
  $requiredStart = Join-Path $resolvedRepoRoot 'Start CRM.bat'

  if (-not (Test-Path -LiteralPath $requiredIndex)) {
    throw "Missing required file: $requiredIndex"
  }
  if (-not (Test-Path -LiteralPath $requiredStart)) {
    throw "Missing required file: $requiredStart"
  }

  $InstallRoot = Join-Path $env:LOCALAPPDATA 'CRM Tool'
  $desktopPath = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    throw 'Desktop path could not be resolved.'
  }

  Write-InstallLog "Repo root: $resolvedRepoRoot"
  Write-InstallLog "Install root: $InstallRoot"

  if (Test-Path -LiteralPath $InstallRoot) {
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null

  $pathsToCopy = Resolve-NeededRuntimePaths -StartBatPath $requiredStart -ResolvedRepoRoot $resolvedRepoRoot
  Write-InstallLog ('Copy set: ' + ($pathsToCopy -join ', '))

  foreach ($relativePath in $pathsToCopy) {
    $sourcePath = Join-Path $resolvedRepoRoot $relativePath
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Referenced runtime path missing: $sourcePath"
    }

    $destinationPath = Join-Path $InstallRoot $relativePath
    $destinationParent = Split-Path -Path $destinationPath -Parent
    if (-not [string]::IsNullOrWhiteSpace($destinationParent)) {
      New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
    }

    if ((Get-Item -LiteralPath $sourcePath).PSIsContainer) {
      Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
    } else {
      Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }
  }

  $installedStartBat = Join-Path $InstallRoot 'Start CRM.bat'
  if (-not (Test-Path -LiteralPath $installedStartBat)) {
    throw "Installed launcher missing: $installedStartBat"
  }

  $shortcutPath = Join-Path $desktopPath 'CRM Tool.lnk'
  $wshShell = New-Object -ComObject WScript.Shell
  $shortcut = $wshShell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = 'cmd.exe'
  $shortcut.Arguments = "/c ""$installedStartBat"""
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.Description = 'Launch CRM Tool'
  $shortcut.Save()

  Write-InstallLog "Desktop shortcut created: $shortcutPath"
  Write-InstallLog "Desktop shortcut target: cmd.exe $($shortcut.Arguments)"

  Start-Process -FilePath $installedStartBat -WorkingDirectory $InstallRoot
  Write-InstallLog 'Installed launcher started.'

  exit 0
}
catch {
  Write-InstallLog "ERROR: $($_.Exception.Message)"
  Write-InstallLog "STACK: $($_.ScriptStackTrace)"
  Write-Host "PS log: $PsLogPath"
  exit 1
}
finally {
  Write-Host "PS log: $PsLogPath"
  if ($transcriptStarted) {
    try {
      Stop-Transcript | Out-Null
    } catch {
      Write-Host '[CRM INSTALL] Warning: Stop-Transcript failed.'
    }
  }
}
