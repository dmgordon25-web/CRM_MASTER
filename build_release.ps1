$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $repoRoot 'release'
$releaseCrm = Join-Path $releaseRoot 'CRM'
$cacheRoot = Join-Path $repoRoot '.cache'
$cacheNodeRoot = Join-Path $cacheRoot 'node'

$launcherPaths = @(
  'Start CRM.bat'
)

$requiredPaths = @(
  'crm-app',
  'server.js'
)

$requiredPaths += $launcherPaths

$portableNodeVersion = 'v20.19.5'
$portableNodeZipName = "node-$portableNodeVersion-win-x64.zip"
$portableNodeFolderName = "node-$portableNodeVersion-win-x64"
$portableNodeUrl = "https://nodejs.org/dist/$portableNodeVersion/$portableNodeZipName"

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

function Install-PortableNode {
  param(
    [Parameter(Mandatory = $true)][string]$DestinationRoot
  )

  if (-not (Test-Path -LiteralPath $cacheNodeRoot)) {
    New-Item -ItemType Directory -Path $cacheNodeRoot -Force | Out-Null
  }

  $zipPath = Join-Path $cacheNodeRoot $portableNodeZipName
  $extractRoot = Join-Path $cacheNodeRoot $portableNodeFolderName

  if (-not (Test-Path -LiteralPath $zipPath)) {
    Write-Host "Downloading portable Node.js from $portableNodeUrl"
    Invoke-WebRequest -Uri $portableNodeUrl -OutFile $zipPath
  }

  if (-not (Test-Path -LiteralPath $extractRoot)) {
    Write-Host "Extracting portable Node.js archive to cache"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $cacheNodeRoot -Force
  }

  $sourceNodeExe = Join-Path $extractRoot 'node.exe'
  if (-not (Test-Path -LiteralPath $sourceNodeExe)) {
    throw "Portable Node extraction failed: missing $sourceNodeExe"
  }

  $releaseNodeRoot = Join-Path $DestinationRoot 'node'
  if (Test-Path -LiteralPath $releaseNodeRoot) {
    Remove-Item -LiteralPath $releaseNodeRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Path $releaseNodeRoot -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $extractRoot '*') -Destination $releaseNodeRoot -Recurse -Force

  $releaseNodeExe = Join-Path $releaseNodeRoot 'node.exe'
  if (-not (Test-Path -LiteralPath $releaseNodeExe)) {
    throw "Portable Node installation failed: missing $releaseNodeExe"
  }

  Write-Host "Portable Node.js staged at $releaseNodeRoot"
}

function Assert-ReleaseNodePresent {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath
  )

  $releaseNodeExe = Join-Path $ReleaseCrmPath 'node/node.exe'
  if (-not (Test-Path -LiteralPath $releaseNodeExe)) {
    throw "Release validation failed. Missing bundled Node runtime: $releaseNodeExe"
  }

  Write-Host "Verified bundled Node runtime: $releaseNodeExe"
}

$startScriptReferences = @(
  'Start CRM.bat',
  'crm-app',
  'server.js',
  'node/node.exe',
  'README.txt'
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

Install-PortableNode -DestinationRoot $releaseCrm
Assert-ReleaseNodePresent -ReleaseCrmPath $releaseCrm
Invoke-PatchBundleBuild -ReleaseCrmPath $releaseCrm

$readmePath = Join-Path $releaseCrm 'README.txt'
$readmeContent = @"
CRM Release Package
===================

How to run
----------
1) Double-click Start CRM.bat
2) Wait for status lines in the launcher window
3) Browser opens automatically when ready

What the launcher guarantees
----------------------------
- Visible progress output for every step.
- Creates launcher.log in this folder.
- Reuses an existing CRM server on 8080-8100 when /health responds.
- Starts server.js on a free port from 8080-8100 when needed.
- Waits up to 20 seconds for readiness, then shows a clear error.
- Opens launcher.log automatically on failure.
- Uses bundled node\\node.exe first, then PATH node.exe fallback.

If launch fails
---------------
- Read launcher.log (opens automatically).
- Install Node.js LTS only if bundled node folder is missing/corrupt.
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
