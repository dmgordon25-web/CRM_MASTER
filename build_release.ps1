Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $repoRoot 'release'
$releaseCrm = Join-Path $releaseRoot 'CRM'

$requiredPaths = @(
  'crm-app',
  'Start CRM.bat',
  'Start CRM (Visible).bat',
  'Start CRM.ps1',
  'tools/node_static_server.js',
  'tools/static_server.js'
)

$startScriptReferences = @(
  'Start CRM.ps1',
  'tools/node_static_server.js',
  'crm-app',
  'tools/static_server.js'
)

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
- The launcher serves crm-app over http://127.0.0.1:8080/ by default.
- Start CRM.ps1 starts Node.js with: tools/node_static_server.js crm-app [port].
- Node.js is not bundled in this release folder.
- Install Node.js 18+ on Windows or ensure node.exe is available on PATH.
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding UTF8

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

if ($missing.Count -gt 0) {
  throw ("Release validation failed. Missing: {0}" -f ($missing -join ', '))
}

Write-Host 'Release validation passed.'
