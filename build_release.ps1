param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $repoRoot 'release'
$releaseCrm = Join-Path $releaseRoot 'CRM'
$handoffRoot = Join-Path $releaseRoot 'CRM_Client_Distribution'
$handoffPayloadRoot = Join-Path $handoffRoot '_payload'
$handoffRuntimeRoot = Join-Path $handoffPayloadRoot 'runtime'
$cacheRoot = Join-Path $repoRoot '.cache'
$cacheNodeRoot = Join-Path $cacheRoot 'node'

$launcherPaths = @(
  'Start CRM.bat',
  'Create Desktop Shortcut.bat',
  'Create Desktop Shortcut.ps1'
)

$requiredPaths = @(
  'crm-app',
  'server.js'
)

$requiredPaths += $launcherPaths

$releasePrunePaths = @(
  'crm-app/docs',
  'crm-app/reports',
  'crm-app/export_changed_records_stability.csv',
  'crm-app/seed_test_data.js',
  'crm-app/stability_verifier.js',
  'crm-app/js/render_fixed.js.bak'
)

$handoffRootKeepList = @(
  'Install CRM Tool.bat',
  '_payload'
)

$runtimeFileMap = @(
  @{ Path = 'Start CRM.bat'; Why = 'Primary launcher used by client handoff.' },
  @{ Path = 'Create Desktop Shortcut.bat'; Why = 'One-click helper to create a desktop shortcut.' },
  @{ Path = 'Create Desktop Shortcut.ps1'; Why = 'Creates the CRM Tool desktop shortcut (.lnk).' },
  @{ Path = 'server.js'; Why = 'Offline local static server and /health endpoint.' },
  @{ Path = 'crm-app/'; Why = 'SPA runtime assets (HTML/CSS/JS/data/patches).' },
  @{ Path = 'node/'; Why = 'Bundled portable Node runtime used first by launcher.' },
  @{ Path = 'README.txt'; Why = 'Client launch/troubleshooting instructions.' },
  @{ Path = 'RUNTIME_FILE_MAP.txt'; Why = 'Runtime-required file map for release audit.' }
)

$portableNodeVersion = 'v20.19.5'
$portableNodeZipName = "node-$portableNodeVersion-win-x64.zip"
$portableNodeFolderName = "node-$portableNodeVersion-win-x64"
$portableNodeUrl = "https://nodejs.org/dist/$portableNodeVersion/$portableNodeZipName"

function Get-RelativePathPortable {
  param(
    [Parameter(Mandatory = $true)][string]$BasePath,
    [Parameter(Mandatory = $true)][string]$TargetPath
  )

  # Windows PowerShell 5.1 does not provide [System.IO.Path]::GetRelativePath.
  $baseFullPath = [System.IO.Path]::GetFullPath($BasePath)
  $targetFullPath = [System.IO.Path]::GetFullPath($TargetPath)

  $baseSeparator = [System.IO.Path]::DirectorySeparatorChar
  if (-not $baseFullPath.EndsWith($baseSeparator)) {
    $baseFullPath += $baseSeparator
  }

  $baseUri = [System.Uri]::new($baseFullPath)
  $targetUri = [System.Uri]::new($targetFullPath)
  $relativeUri = $baseUri.MakeRelativeUri($targetUri)
  $relativePath = [System.Uri]::UnescapeDataString($relativeUri.ToString())

  return $relativePath.Replace('\\', '/').Replace('\', '/')
}

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

  $bundleSucceeded = $true

  try {
    $bundleLogPath = Join-Path $ReleaseCrmPath 'release_build_esbuild.log'
    $esbuildArgs = @(
      '--yes',
      'esbuild',
      $bundleEntryPath,
      '--bundle',
      '--format=esm',
      '--platform=browser',
      '--target=es2022',
      "--outfile=$releaseBundlePath"
    )

    $npxCmd = Get-Command 'npx.cmd' -ErrorAction SilentlyContinue
    if (-not $npxCmd) {
      $npxCmd = Get-Command 'npx' -ErrorAction Stop
    }

    $stdoutPath = Join-Path $ReleaseCrmPath '__esbuild_stdout.log'
    $stderrPath = Join-Path $ReleaseCrmPath '__esbuild_stderr.log'
    if (Test-Path -LiteralPath $stdoutPath) {
      Remove-Item -LiteralPath $stdoutPath -Force
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Remove-Item -LiteralPath $stderrPath -Force
    }

    $esbuildProc = Start-Process -FilePath $npxCmd.Source -ArgumentList $esbuildArgs -WorkingDirectory $releaseJsRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $stdoutContent = if (Test-Path -LiteralPath $stdoutPath) { Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8 } else { '' }
    $stderrContent = if (Test-Path -LiteralPath $stderrPath) { Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8 } else { '' }
    $combinedOutput = (@($stdoutContent, $stderrContent) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join [Environment]::NewLine
    $entryPreviewLines = @()
    if (Test-Path -LiteralPath $bundleEntryPath) {
      $entryPreviewLines = Get-Content -LiteralPath $bundleEntryPath -Encoding UTF8 | Select-Object -First 30
    }

    $logLines = @(
      '=== esbuild invocation ===',
      ('Command: {0} {1}' -f $npxCmd.Source, ($esbuildArgs -join ' ')),
      ('WorkingDirectory: {0}' -f $releaseJsRoot),
      ('ExitCode: {0}' -f $esbuildProc.ExitCode),
      '',
      '=== esbuild stdout/stderr ===',
      $combinedOutput,
      '',
      '=== __patch_bundle_entry__.mjs (first 30 lines) ===',
      ($entryPreviewLines -join [Environment]::NewLine)
    )
    Set-Content -LiteralPath $bundleLogPath -Value ($logLines -join [Environment]::NewLine) -Encoding UTF8

    if (Test-Path -LiteralPath $stdoutPath) {
      Remove-Item -LiteralPath $stdoutPath -Force
    }
    if (Test-Path -LiteralPath $stderrPath) {
      Remove-Item -LiteralPath $stderrPath -Force
    }

    if ($esbuildProc.ExitCode -ne 0) {
      $bundleSucceeded = $false
      $firstResolveLine = '<not identified>'
      $resolveLines = @($combinedOutput -split '\r?\n' | Where-Object { $_ -match 'Could not resolve' })
      if ($resolveLines.Count -gt 0) {
        $firstResolveLine = $resolveLines[0]
      }

      Write-Warning 'esbuild failed while bundling patches; skipping patch bundle generation.'
      Write-Warning ("first resolve error: {0}" -f $firstResolveLine)
      Write-Warning ("log saved to {0}" -f $bundleLogPath)
    }
  }
  finally {
    if (Test-Path -LiteralPath $bundleEntryPath) {
      Remove-Item -LiteralPath $bundleEntryPath -Force
    }
  }


  if (-not $bundleSucceeded) {
    return
  }

  $manifestObj.patches = @($releaseBundleSpec)
  $updatedManifest = $manifestObj | ConvertTo-Json -Depth 100
  Set-Content -LiteralPath $releasePatchManifestPath -Value $updatedManifest -Encoding UTF8
}

function Remove-ReleaseClutter {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath,
    [Parameter(Mandatory = $true)][System.Collections.Generic.HashSet[string]]$ManifestReferencedPaths
  )

  foreach ($relativePath in $releasePrunePaths) {
    $targetPath = Join-Path $ReleaseCrmPath $relativePath
    if (Test-Path -LiteralPath $targetPath) {
      $candidateFullPath = (Get-Item -LiteralPath $targetPath).FullName
      $candidateRelative = Get-RelativePathPortable -BasePath $ReleaseCrmPath -TargetPath $candidateFullPath
      if ($ManifestReferencedPaths.Contains($candidateRelative)) {
        Write-Host ("Skipped prune (manifest-referenced): {0}" -f $candidateRelative)
        continue
      }

      Remove-Item -LiteralPath $targetPath -Recurse -Force
      Write-Host ("Pruned release-only clutter: {0}" -f $relativePath)
    }
  }
}

function Get-ManifestReferencedReleasePaths {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath
  )

  $referencedPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  $releaseAppRoot = Join-Path $ReleaseCrmPath 'crm-app'
  $releaseJsRoot = Join-Path $releaseAppRoot 'js'
  $releasePatchManifestPath = Join-Path $releaseAppRoot 'patches/manifest.json'

  if (-not (Test-Path -LiteralPath $releasePatchManifestPath)) {
    return $referencedPaths
  }

  $manifestRaw = Get-Content -LiteralPath $releasePatchManifestPath -Raw -Encoding UTF8
  $manifestObj = $manifestRaw | ConvertFrom-Json
  if (-not ($manifestObj.PSObject.Properties.Name -contains 'patches') -or -not ($manifestObj.patches -is [System.Array])) {
    throw "Invalid patch manifest format at $releasePatchManifestPath"
  }

  foreach ($patchSpec in @($manifestObj.patches)) {
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

    if ($resolvedPatchPath -and (Test-Path -LiteralPath $resolvedPatchPath)) {
      $resolvedRelative = Get-RelativePathPortable -BasePath $ReleaseCrmPath -TargetPath $resolvedPatchPath
      [void]$referencedPaths.Add($resolvedRelative)
    }
  }

  return $referencedPaths
}

function Write-RuntimeFileMap {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath
  )

  $mapPath = Join-Path $ReleaseCrmPath 'RUNTIME_FILE_MAP.txt'
  $lines = @(
    'CRM Runtime-Required File Map',
    '=============================',
    ''
  )

  foreach ($item in $runtimeFileMap) {
    $lines += ("- {0}: {1}" -f $item.Path, $item.Why)
  }

  Set-Content -LiteralPath $mapPath -Value ($lines -join [Environment]::NewLine) -Encoding UTF8
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

function New-ClientHandoff {
  param(
    [Parameter(Mandatory = $true)][string]$ReleaseCrmPath,
    [Parameter(Mandatory = $true)][string]$HandoffRootPath,
    [Parameter(Mandatory = $true)][string]$HandoffPayloadPath,
    [Parameter(Mandatory = $true)][string]$HandoffRuntimePath
  )

  if (Test-Path -LiteralPath $HandoffRootPath) {
    Remove-Item -LiteralPath $HandoffRootPath -Recurse -Force
  }

  New-Item -ItemType Directory -Path $HandoffRuntimePath -Force | Out-Null

  Copy-Item -LiteralPath (Join-Path $ReleaseCrmPath '*') -Destination $HandoffRuntimePath -Recurse -Force

  $installerScriptPath = Join-Path $HandoffRootPath 'Install CRM Tool.bat'
  $installerScriptContent = @"
@echo off
setlocal

set "HANDOFF_ROOT=%~dp0"
set "INSTALLER_PS=%HANDOFF_ROOT%_payload\scripts\Install-CRM-Tool.ps1"

if not exist "%INSTALLER_PS%" (
  echo [FAIL] Missing installer payload: "%INSTALLER_PS%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER_PS%"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
  echo [FAIL] CRM Tool installation failed. Check %%TEMP%%\CRM_Tool_Install.log.
  exit /b %INSTALL_EXIT%
)

echo [OK] CRM Tool installed successfully.
echo [OK] Use the CRM Tool desktop shortcut from now on.
exit /b 0
"@

  $payloadScripts = Join-Path $HandoffPayloadPath 'scripts'
  $payloadDocs = Join-Path $HandoffPayloadPath 'docs'
  New-Item -ItemType Directory -Path $payloadScripts -Force | Out-Null
  New-Item -ItemType Directory -Path $payloadDocs -Force | Out-Null

  $installerPsPath = Join-Path $payloadScripts 'Install-CRM-Tool.ps1'
  $installerPsContent = @"
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'CRM Tool')
)

$ErrorActionPreference = 'Stop'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$handoffPayloadRoot = Split-Path -Parent $scriptRoot
$runtimeSource = Join-Path $handoffPayloadRoot 'runtime'
$launcherRelativePath = 'Start CRM.bat'
$launcherPath = Join-Path $InstallRoot $launcherRelativePath
$logPath = Join-Path $env:TEMP 'CRM_Tool_Install.log'

function Write-InstallLog {
  param([string]$Message)
  $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $line = "[$timestamp] $Message"
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line
}

Set-Content -LiteralPath $logPath -Value '' -Encoding UTF8

try {
  if (-not (Test-Path -LiteralPath $runtimeSource)) {
    throw "Missing runtime payload at $runtimeSource"
  }

  Write-InstallLog 'Starting CRM Tool install.'
  Write-InstallLog "Runtime source: $runtimeSource"
  Write-InstallLog "Install destination: $InstallRoot"

  if (Test-Path -LiteralPath $InstallRoot) {
    Write-InstallLog 'Removing previous install folder.'
    Remove-Item -LiteralPath $InstallRoot -Recurse -Force
  }

  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $runtimeSource '*') -Destination $InstallRoot -Recurse -Force
  Write-InstallLog 'Runtime files copied.'

  if (-not (Test-Path -LiteralPath $launcherPath)) {
    throw "Expected launcher missing after copy: $launcherPath"
  }

  $desktopPath = [Environment]::GetFolderPath('Desktop')
  if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    throw 'Unable to resolve Desktop path for shortcut creation.'
  }

  $shortcutPath = Join-Path $desktopPath 'CRM Tool.lnk'
  $wshShell = New-Object -ComObject WScript.Shell
  $shortcut = $wshShell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $launcherPath
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.Description = 'Launch CRM Tool'
  $shortcut.IconLocation = "$env:SystemRoot\System32\SHELL32.dll,220"
  $shortcut.Save()

  Write-InstallLog "Desktop shortcut created: $shortcutPath"
  Write-InstallLog "Shortcut target: $launcherPath"
  Write-InstallLog 'Installation completed successfully.'
}
catch {
  $detail = $_.Exception.Message
  Write-InstallLog "Installation failed: $detail"
  throw
}
"@

  $clientReadmePath = Join-Path $payloadDocs 'CLIENT_README.txt'
  $clientReadmeContent = @"
CRM Tool - Client Install & Run Guide
=====================================

Install (one time)
------------------
1) In this handoff folder, double-click: Install CRM Tool.bat
2) Wait for the installer success message.
3) Confirm a desktop shortcut named "CRM Tool" appears.

Run CRM Tool
------------
1) Double-click the desktop shortcut: CRM Tool
2) Wait a few seconds for the local launcher to start.
3) Your browser opens CRM Tool automatically.

Troubleshooting
---------------
- If install fails, open: %TEMP%\CRM_Tool_Install.log
- If launch fails later, open launcher.log in:
  %LOCALAPPDATA%\CRM Tool
- If needed, run Install CRM Tool.bat again to reinstall cleanly.
"@

  Set-Content -LiteralPath $installerScriptPath -Value $installerScriptContent -Encoding ASCII
  Set-Content -LiteralPath $installerPsPath -Value $installerPsContent -Encoding UTF8
  Set-Content -LiteralPath $clientReadmePath -Value $clientReadmeContent -Encoding UTF8

  $handoffEntries = Get-ChildItem -LiteralPath $HandoffRootPath -Force | Select-Object -ExpandProperty Name
  foreach ($entry in $handoffEntries) {
    if ($handoffRootKeepList -notcontains $entry) {
      throw "Unexpected client-facing handoff root entry: $entry"
    }
  }
}

$startScriptReferences = @(
  'Start CRM.bat',
  'Create Desktop Shortcut.bat',
  'Create Desktop Shortcut.ps1',
  'crm-app',
  'server.js',
  'node/node.exe',
  'README.txt',
  'RUNTIME_FILE_MAP.txt'
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

$manifestReferencedPaths = Get-ManifestReferencedReleasePaths -ReleaseCrmPath $releaseCrm
Remove-ReleaseClutter -ReleaseCrmPath $releaseCrm -ManifestReferencedPaths $manifestReferencedPaths

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
CRM Tool (Client Release)
=========================

What to double-click
--------------------
1) Start CRM.bat
   - Launches the CRM Tool in your browser.
2) Create Desktop Shortcut.bat (optional, one time)
   - Adds a desktop shortcut named "CRM Tool".

Normal launch flow
------------------
1) Double-click Start CRM.bat
2) Wait for launcher status lines
3) Browser opens automatically when ready

If launch fails
---------------
- Check launcher.log in this folder (opens automatically on launcher failures).
- Re-run Start CRM.bat.
- If the bundled node folder is missing/corrupt, re-extract the full release package.
"@
Set-Content -LiteralPath $readmePath -Value $readmeContent -Encoding UTF8
Write-RuntimeFileMap -ReleaseCrmPath $releaseCrm
New-ClientHandoff -ReleaseCrmPath $releaseCrm -HandoffRootPath $handoffRoot -HandoffPayloadPath $handoffPayloadRoot -HandoffRuntimePath $handoffRuntimeRoot

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
Write-Host "Client handoff package created: $handoffRoot"
