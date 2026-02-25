param(
  [string]$ShortcutName = 'CRM Tool'
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetPath = Join-Path $root 'Start CRM.bat'
if (-not (Test-Path -LiteralPath $targetPath)) {
  throw "Missing launcher: $targetPath"
}

$desktopPath = [Environment]::GetFolderPath('Desktop')
if ([string]::IsNullOrWhiteSpace($desktopPath)) {
  throw 'Unable to resolve Desktop path.'
}

$shortcutPath = Join-Path $desktopPath ("$ShortcutName.lnk")
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $targetPath
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Launch CRM Tool'
$shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,220"
$shortcut.Save()

Write-Host "Desktop shortcut created: $shortcutPath"
