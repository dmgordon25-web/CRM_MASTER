Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $repoRoot 'release'
$releaseCrm = Join-Path $releaseRoot 'CRM'

$launcherPaths = @(
  'Start CRM.bat',
  'Start CRM.ps1'
)

$optionalLauncherPaths = @(
  'Start CRM (Visible).bat'
)

$requiredPaths = @(
  'crm-app',
  'tools/node_static_server.js',
  'tools/static_server.js'
)

$requiredPaths += $launcherPaths

foreach ($optionalLauncherPath in $optionalLauncherPaths) {
  $optionalSourcePath = Join-Path $repoRoot $optionalLauncherPath
  if (Test-Path -LiteralPath $optionalSourcePath) {
    $requiredPaths += $optionalLauncherPath
  }
}

$startScriptReferences = @(
  'Start CRM.ps1',
  'Start CRM.bat',
  'crm-app',
  'tools/node_static_server.js',
  'tools/static_server.js'
)

foreach ($optionalLauncherPath in $optionalLauncherPaths) {
  if ($requiredPaths -contains $optionalLauncherPath) {
    $startScriptReferences += $optionalLauncherPath
  }
}

if (-not (Test-Path -LiteralPath $releaseRoot)) {
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
}

if (Test-Path -LiteralPath $releaseCrm) {
  Remove-Item -LiteralPath $releaseCrm -Recurse -Force
}

New-Item -ItemType Directory -Path $releaseCrm -Force | Out-Null

foreach ($relativePath in $requiredPaths) {
  $sourcePath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Missing required path: $relativePath"
  }

  $destinationPath = Join-Path $releaseCrm $relativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if (-not (Test-Path -LiteralPath $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Recurse -Force
}

$readmePath = Join-Path $releaseCrm 'README_RELEASE.txt'
$readmeContent = @"
CRM Release Package
===================

How to run
----------
Double click Start CRM.bat

Runtime notes
-------------
- The launcher opens http://127.0.0.1:8080/ by default (or CRM_PORT / -Port override).
- Double click Start CRM.bat to launch CRM.
- Start CRM.bat runs Start CRM.ps1.
- Start CRM.ps1 opens Microsoft Edge app mode first (--app=http://127.0.0.1:[port]/#/labs), then Chrome app mode, then default browser fallback.
- Start CRM.ps1 starts Node.js with: tools/node_static_server.js crm-app [port].
- node_static_server.js requires tools/static_server.js.
- If the port already has a responsive CRM server, launcher opens the app without starting another server.
- If the port is busy by another process, launcher exits with a port-in-use error.
- Node.js is not bundled in this release folder.
- Install Node.js 18+ on Windows or ensure node.exe is available on PATH.
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding UTF8

$resolvedPort = 8080
if (-not [string]::IsNullOrWhiteSpace($env:CRM_PORT)) {
  $resolvedPort = [int]$env:CRM_PORT
}
$resolvedRootUrl = "http://127.0.0.1:$resolvedPort/"
$resolvedAppUrl = "http://127.0.0.1:$resolvedPort/#/labs"
$resolvedServerCommand = "node tools/node_static_server.js crm-app $resolvedPort"

Write-Host "Release artifact created: $releaseCrm"
Write-Host 'Top-level files/folders copied:'
Get-ChildItem -LiteralPath $releaseCrm | Sort-Object Name | ForEach-Object {
  if ($_.PSIsContainer) {
    Write-Host (" - {0}/" -f $_.Name)
  }
  else {
    Write-Host (" - {0}" -f $_.Name)
  }
}

Write-Host 'Start script dependency checks:'
$missing = @()
foreach ($relativePath in $startScriptReferences) {
  $checkPath = Join-Path $releaseCrm $relativePath
  if (Test-Path -LiteralPath $checkPath) {
    Write-Host (" [OK] {0}" -f $relativePath)
  }
  else {
    Write-Host (" [MISSING] {0}" -f $relativePath)
    $missing += $relativePath
  }
}

Write-Host 'Launcher verification:'
Write-Host (" [INFO] PORT: {0}" -f $resolvedPort)
Write-Host (" [INFO] URL (app mode): {0}" -f $resolvedAppUrl)
Write-Host (" [INFO] URL (fallback): {0}" -f $resolvedRootUrl)
Write-Host (" [INFO] Server command: {0}" -f $resolvedServerCommand)

$launcherReferencedFiles = @(
  'Start CRM.bat',
  'Start CRM.ps1',
  'crm-app',
  'tools/node_static_server.js',
  'tools/static_server.js'
)

foreach ($optionalLauncherPath in $optionalLauncherPaths) {
  if ($requiredPaths -contains $optionalLauncherPath) {
    $launcherReferencedFiles += $optionalLauncherPath
  }
}

foreach ($relativePath in $launcherReferencedFiles) {
  $releasePath = Join-Path $releaseCrm $relativePath
  if (Test-Path -LiteralPath $releasePath) {
    Write-Host (" [OK] release/CRM/{0}" -f $relativePath)
  }
  else {
    Write-Host (" [MISSING] release/CRM/{0}" -f $relativePath)
    $missing += $relativePath
  }
}

if ($missing.Count -gt 0) {
  throw ("Release validation failed. Missing: {0}" -f ($missing -join ', '))
}

Write-Host 'Release validation passed.'
