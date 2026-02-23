Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $repoRoot 'release'
$releaseCrm = Join-Path $releaseRoot 'CRM'

$launcherPaths = @(
  'Start CRM.bat'
)

$requiredPaths = @(
  'crm-app',
  'server.js'
)

$requiredPaths += $launcherPaths

function Invoke-PatchBundleBuild {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath
  )

  $releaseAppRoot = Join-Path $ReleaseCrmPath 'crm-app'
  $releaseJsRoot = Join-Path $releaseAppRoot 'js'
  $releasePatchManifestPath = Join-Path $releaseAppRoot 'patches/manifest.json'
  $releaseBundlePath = Join-Path $releaseJsRoot 'patch_bundle.js'
  $releaseBundleSpec = './patch_bundle.js'

  $manifestRaw = Get-Content -LiteralPath $releasePatchManifestPath -Raw -Encoding UTF8
  $manifestObj = $manifestRaw | ConvertFrom-Json
  if (-not ($manifestObj.PSObject.Properties.Name -contains 'patches') -or -not ($manifestObj.patches -is [System.Array])) {
    throw "Invalid patch manifest format at $releasePatchManifestPath"
  }

  $orderedPatchSpecs = @($manifestObj.patches)
  $bundleEntryPath = Join-Path $releaseJsRoot '__patch_bundle_entry__.mjs'
  $bundleEntryLines = @()
  foreach ($patchSpec in $orderedPatchSpecs) {
    if (-not ($patchSpec -is [string]) -or [string]::IsNullOrWhiteSpace($patchSpec)) {
      throw "Invalid patch spec in manifest: $patchSpec"
    }

    $normalizedSpec = $patchSpec.Trim()
    if (-not $normalizedSpec.StartsWith('./')) {
      throw "Unsupported patch spec format in manifest: $normalizedSpec"
    }

    $relativeJsPath = $normalizedSpec.Substring(2)
    $absolutePatchPath = Join-Path $releaseJsRoot $relativeJsPath
    if (-not (Test-Path -LiteralPath $absolutePatchPath)) {
      throw "Patch listed in manifest was not found: $normalizedSpec"
    }

    $bundleEntryLines += "import '$normalizedSpec';"
  }

  Set-Content -LiteralPath $bundleEntryPath -Value ($bundleEntryLines -join [Environment]::NewLine) -Encoding UTF8

  try {
    $esbuildArgs = @(
      '--yes',
      'esbuild',
      $bundleEntryPath,
      '--bundle',
      '--format=esm',
      '--platform=browser',
      '--target=es2020',
      "--outfile=$releaseBundlePath"
    )
    & npx @esbuildArgs
    if ($LASTEXITCODE -ne 0) {
      throw "esbuild failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    if (Test-Path -LiteralPath $bundleEntryPath) {
      Remove-Item -LiteralPath $bundleEntryPath -Force
    }
  }

  $manifestObj.patches = @($releaseBundleSpec)
  $updatedManifest = $manifestObj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $releasePatchManifestPath -Value $updatedManifest -Encoding UTF8
}

$startScriptReferences = @(
  'Start CRM.bat',
  'crm-app',
  'server.js'
)

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

Invoke-PatchBundleBuild -ReleaseCrmPath $releaseCrm

$readmePath = Join-Path $releaseCrm 'README_RELEASE.txt'
$readmeContent = @"
CRM Release Package
===================

How to run
----------
Double click Start CRM.bat

Runtime notes
-------------
- The launcher opens http://127.0.0.1:8080/ by default.
- Double click Start CRM.bat to launch CRM.
- Start CRM.bat opens Microsoft Edge app mode first, then Chrome app mode, then default browser fallback.
- Start CRM.bat starts Node.js with: server.js --port [port].
- If the selected port already has a responsive CRM server, launcher opens the app without starting another server.
- Node.js is not bundled in this release folder.
- Install Node.js 18+ on Windows or ensure node.exe is available on PATH.
- Patches bundled for faster boot; behavior identical.
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding UTF8

$resolvedPort = 8080
$resolvedRootUrl = "http://127.0.0.1:$resolvedPort/"
$resolvedServerCommand = "node server.js --port $resolvedPort"

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
Write-Host (" [INFO] URL (fallback): {0}" -f $resolvedRootUrl)
Write-Host (" [INFO] Server command: {0}" -f $resolvedServerCommand)

$launcherReferencedFiles = @(
  'Start CRM.bat',
  'crm-app',
  'server.js'
)

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
