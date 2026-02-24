param(
  [switch]$DryRun
)

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
    $hasSupportedPrefix = $normalizedSpec.StartsWith('./') -or $normalizedSpec.StartsWith('../')
    if (-not $hasSupportedPrefix) {
      throw "Unsupported patch spec format in manifest: $normalizedSpec"
    }

    $absolutePatchPath = Join-Path $releaseJsRoot $normalizedSpec
    $resolvedPatchPath = $null
    try {
      $resolvedPatchPath = (Resolve-Path -LiteralPath $absolutePatchPath).ProviderPath
    }
    catch {
      $resolvedPatchPath = $null
    }

    if (-not $resolvedPatchPath -or -not (Test-Path -LiteralPath $resolvedPatchPath)) {
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
    [Parameter(Mandatory = $true)][string]$DestinationRoot,
    [Parameter(Mandatory = $false)][switch]$DryRunInstall
  )

  if (-not (Test-Path -LiteralPath $cacheNodeRoot)) {
    New-Item -ItemType Directory -Path $cacheNodeRoot -Force | Out-Null
  }

  $zipPath = Join-Path $cacheNodeRoot $portableNodeZipName
  $cacheExtractDir = Join-Path $cacheNodeRoot $portableNodeFolderName
  $releaseNodeRoot = Join-Path $DestinationRoot 'node'
  $releaseNodeExe = Join-Path $releaseNodeRoot 'node.exe'

  Write-Host "Portable Node cache extract dir: $cacheExtractDir"

  if ($DryRunInstall) {
    Write-Host 'Dry run enabled: skipping portable Node download/extract and creating placeholder runtime path.'
    if (Test-Path -LiteralPath $releaseNodeRoot) {
      Remove-Item -LiteralPath $releaseNodeRoot -Recurse -Force
    }
    New-Item -ItemType Directory -Path $releaseNodeRoot -Force | Out-Null
    Set-Content -LiteralPath $releaseNodeExe -Value '' -Encoding ASCII
    Write-Host "Portable Node resolved root: <dry-run-placeholder>"
    Write-Host "Portable Node final executable path: $releaseNodeExe"
    return
  }

  if (-not (Test-Path -LiteralPath $zipPath)) {
    Write-Host "Downloading portable Node.js from $portableNodeUrl"
    Invoke-WebRequest -Uri $portableNodeUrl -OutFile $zipPath
  }

  if (Test-Path -LiteralPath $cacheExtractDir) {
    Remove-Item -LiteralPath $cacheExtractDir -Recurse -Force
  }

  New-Item -ItemType Directory -Path $cacheExtractDir -Force | Out-Null

  Write-Host "Extracting portable Node.js archive to cache"
  Expand-Archive -LiteralPath $zipPath -DestinationPath $cacheExtractDir -Force

  $nodeRootDir = Get-ChildItem -LiteralPath $cacheExtractDir -Directory | Where-Object { $_.Name -like 'node-*-win-x64' } | Select-Object -First 1
  $nodeExe = $null
  if ($nodeRootDir) {
    $candidateExe = Join-Path $nodeRootDir.FullName 'node.exe'
    if (Test-Path -LiteralPath $candidateExe) {
      $nodeExe = Get-Item -LiteralPath $candidateExe
    }
  }

  if (-not $nodeExe) {
    $nodeExe = Get-ChildItem -LiteralPath $cacheExtractDir -Recurse -Filter node.exe | Select-Object -First 1
  }

  $nodeRoot = $null
  if ($nodeExe) {
    $nodeRoot = Split-Path -Parent $nodeExe.FullName
  }

  Write-Host "Portable Node resolved root: $nodeRoot"

  $expectedNodeExe = if ($nodeRoot) { Join-Path $nodeRoot 'node.exe' } else { '<unresolved>' }
  if (-not $nodeRoot -or -not (Test-Path -LiteralPath $expectedNodeExe)) {
    throw "Portable Node extraction failed. cacheExtractDir=$cacheExtractDir; resolvedNodeRoot=$nodeRoot; expectedNodeExe=$expectedNodeExe"
  }

  if (Test-Path -LiteralPath $releaseNodeRoot) {
    Remove-Item -LiteralPath $releaseNodeRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Path $releaseNodeRoot -Force | Out-Null
  Copy-Item -Path (Join-Path $nodeRoot '*') -Destination $releaseNodeRoot -Recurse -Force -ErrorAction Stop

  Write-Host "Portable Node final executable path: $releaseNodeExe"
  if (-not (Test-Path -LiteralPath $releaseNodeExe)) {
    $releaseNodeListing = if (Test-Path -LiteralPath $releaseNodeRoot) {
      (Get-ChildItem -LiteralPath $releaseNodeRoot -Force | Select-Object -ExpandProperty Name) -join ', '
    }
    else {
      '<release-node-root-missing>'
    }
    throw "Portable Node installation failed. cacheExtractDir=$cacheExtractDir; resolvedNodeRoot=$nodeRoot; releaseNodeExe=$releaseNodeExe; releaseNodeRootContents=$releaseNodeListing"
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

Install-PortableNode -DestinationRoot $releaseCrm -DryRunInstall:$DryRun
Assert-ReleaseNodePresent -ReleaseCrmPath $releaseCrm
if ($DryRun) {
  Write-Host 'Dry run enabled: skipping patch bundle build.'
}
else {
  Invoke-PatchBundleBuild -ReleaseCrmPath $releaseCrm
}

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
