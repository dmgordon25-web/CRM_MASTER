#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repoRoot, 'release');
const releaseRuntimeRoot = path.join(releaseRoot, 'CRM');
const clientToSendRoot = path.join(releaseRoot, 'CLIENT_TO_SEND');
const handoffRoot = path.join(clientToSendRoot, 'CRM Tool Client');
const handoffZipPath = path.join(clientToSendRoot, 'CRM Tool Client.zip');
const handoffPayloadRoot = path.join(handoffRoot, '_payload');
const handoffRuntimeRoot = path.join(handoffPayloadRoot, 'runtime');

const runtimePaths = [
  'crm-app',
  'server.js',
  'Start CRM.bat',
  'Create Desktop Shortcut.bat',
  'Create Desktop Shortcut.ps1'
];

const prunePaths = [
  'crm-app/docs',
  'crm-app/reports',
  'crm-app/export_changed_records_stability.csv',
  'crm-app/seed_test_data.js',
  'crm-app/stability_verifier.js',
  'crm-app/js/render_fixed.js.bak'
];

const handoffRootKeepList = new Set([
  'Install CRM Tool.bat',
  '_payload',
  'BEGIN HERE.txt',
  'README.txt'
]);

const requiredHandoffRootEntries = [
  'Install CRM Tool.bat',
  'BEGIN HERE.txt',
  '_payload'
];

const excludedCategoryNotes = [
  'tests',
  'docs',
  'CI config',
  'backup artifacts',
  'devtools',
  'legacy scripts'
];

const runtimeFileMap = [
  { path: 'Start CRM.bat', why: 'Primary launcher used by installed shortcut.' },
  { path: 'Create Desktop Shortcut.bat', why: 'Manual fallback helper to create desktop shortcut.' },
  { path: 'Create Desktop Shortcut.ps1', why: 'PowerShell shortcut creation helper used by the launcher helper.' },
  { path: 'server.js', why: 'Offline local static server and /health endpoint.' },
  { path: 'crm-app/', why: 'SPA runtime assets (HTML/CSS/JS/data/patches).' },
  { path: 'node/', why: 'Bundled portable Node runtime used first by launcher.' },
  { path: 'README.txt', why: 'Installed runtime launch/troubleshooting instructions.' },
  { path: 'RUNTIME_FILE_MAP.txt', why: 'Runtime-required file map for release audit.' }
];

const runtimeReadmeText = `CRM Tool (Installed Runtime)\n============================\n\nStart\n-----\n- Double-click Start CRM.bat to launch CRM Tool.\n\nDesktop Shortcut\n----------------\n- Desktop shortcut should already exist as "CRM Tool" after install.\n- If needed, run Create Desktop Shortcut.bat from this folder.\n\nTroubleshooting\n---------------\n- Check launcher.log in this folder for launcher failures.\n- If node folder is missing/corrupt, reinstall from the handoff package.\n`;

const handoffInstallBat = `@echo off
setlocal

set "HANDOFF_ROOT=%~dp0"
set "INSTALLER_PS=%HANDOFF_ROOT%_payload\\scripts\\Install-CRM-Tool.ps1"

if not exist "%INSTALLER_PS%" (
  echo [FAIL] Missing installer payload: "%INSTALLER_PS%"
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%INSTALLER_PS%"
set "INSTALL_EXIT=%ERRORLEVEL%"
if not "%INSTALL_EXIT%"=="0" (
echo [FAIL] CRM Tool installation failed. Check %%TEMP%%\\CRM_Tool_Install.log.
  exit /b %INSTALL_EXIT%
)

echo.
echo ✅ Install complete
echo Use the Desktop shortcut "CRM Tool" from now on.
echo You do NOT need to open the _payload folder.
exit /b 0
`;

const handoffInstallPs1 = `param(
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
  $shortcut.IconLocation = "$env:SystemRoot\\System32\\SHELL32.dll,220"
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
`;


const runtimeExcludeContains = [
  '/.github/',
  '/archive/',
  '/backups/',
  '/tests/',
  '/test/',
  '/docs/',
  '/fixtures/',
  '/__tests__/',
  '/.husky/',
  '/.vscode/',
  '/.idea/'
];

const runtimeExcludeFileNames = new Set([
  '.ds_store',
  'thumbs.db',
  '.eslintcache',
  'npm-debug.log'
]);

const runtimeExcludeSuffixes = [
  '.bak',
  '.tmp',
  '.orig',
  '.rej',
  '.swp'
];

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function toPosix(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function shouldExcludeRuntimePath(relativePath, isDirectory) {
  const normalized = `/${toPosix(relativePath).toLowerCase()}`;

  for (const marker of runtimeExcludeContains) {
    if (normalized.includes(marker)) {
      return true;
    }
  }

  const baseName = path.basename(normalized);
  if (!isDirectory && runtimeExcludeFileNames.has(baseName)) {
    return true;
  }

  if (!isDirectory) {
    for (const suffix of runtimeExcludeSuffixes) {
      if (normalized.endsWith(suffix)) {
        return true;
      }
    }
  }

  return false;
}

function pruneRuntimeNoise(targetRoot) {
  const walk = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(targetRoot, fullPath);
      const isDirectory = entry.isDirectory();
      if (shouldExcludeRuntimePath(relativePath, isDirectory)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`Pruned runtime noise: ${toPosix(relativePath)}`);
        continue;
      }
      if (isDirectory) {
        walk(fullPath);
      }
    }
  };

  walk(targetRoot);
}

function printTree(rootPath, headerLabel, maxDepth = 2) {
  console.log(`\n${headerLabel}`);
  const relative = toPosix(path.relative(repoRoot, rootPath) || '.');
  console.log(relative);

  const treeLines = createTreeLines(rootPath, maxDepth, relative);
  for (const line of treeLines.slice(1)) {
    console.log(line);
  }
}

function createTreeLines(rootPath, maxDepth = 2, headerLabel = toPosix(path.relative(repoRoot, rootPath) || '.')) {
  const lines = [headerLabel];

  const walk = (dirPath, prefix, depth) => {
    if (depth >= maxDepth) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1;
      const branch = isLast ? '└─ ' : '├─ ';
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');
      const suffix = entry.isDirectory() ? '/' : '';
      lines.push(`${prefix}${branch}${entry.name}${suffix}`);
      if (entry.isDirectory()) {
        walk(path.join(dirPath, entry.name), nextPrefix, depth + 1);
      }
    });
  };

  walk(rootPath, '', 0);
  return lines;
}

function indentLines(lines, spaces = 2) {
  const prefix = ' '.repeat(spaces);
  return lines.map((line) => `${prefix}${line}`).join('\n');
}

function createDistributionZip() {
  if (fs.existsSync(handoffZipPath)) {
    fs.rmSync(handoffZipPath, { force: true });
  }

  const pythonScript = [
    'import os',
    'import zipfile',
    `source = r'''${handoffRoot}'''`,
    `target = r'''${handoffZipPath}'''`,
    "with zipfile.ZipFile(target, 'w', compression=zipfile.ZIP_DEFLATED) as zf:",
    '    for root, _, files in os.walk(source):',
    '        files.sort()',
    '        for filename in files:',
    '            full = os.path.join(root, filename)',
    '            arcname = os.path.relpath(full, source)',
    '            zf.write(full, arcname)',
    "print('created', target)"
  ].join('\n');

  const pythonCmd = os.platform() === 'win32' ? 'python' : 'python3';
  const zipResult = spawnSync(pythonCmd, ['-c', pythonScript], { encoding: 'utf8' });
  if (zipResult.status !== 0) {
    const stderr = (zipResult.stderr || '').trim();
    throw new Error(`Failed to create distribution zip with ${pythonCmd}: ${stderr}`);
  }
}

function copyRelative(relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const targetPath = path.join(releaseRuntimeRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required runtime path: ${relativePath}`);
  }
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function pruneReleaseClutter() {
  const manifestReferenced = getManifestReferencedReleasePaths();
  for (const relativePath of prunePaths) {
    const targetPath = path.join(releaseRuntimeRoot, relativePath);
    if (fs.existsSync(targetPath)) {
      const candidateRelative = path.relative(releaseRuntimeRoot, targetPath).replace(/\\/g, '/');
      if (manifestReferenced.has(candidateRelative)) {
        console.log(`Skipped prune (manifest-referenced): ${candidateRelative}`);
        continue;
      }
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Pruned release-only clutter: ${relativePath}`);
    }
  }
}

function getManifestReferencedReleasePaths() {
  const referenced = new Set();
  const manifestPath = path.join(releaseRuntimeRoot, 'crm-app', 'patches', 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return referenced;
  }

  const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const patches = Array.isArray(parsed) ? parsed : parsed.patches;
  if (!Array.isArray(patches)) {
    throw new Error(`Invalid patch manifest format at ${manifestPath}`);
  }

  const releaseJsRoot = path.join(releaseRuntimeRoot, 'crm-app', 'js');
  for (const patchSpec of patches) {
    if (typeof patchSpec !== 'string' || patchSpec.trim().length === 0) {
      throw new Error(`Invalid patch spec in manifest: ${patchSpec}`);
    }
    const normalized = patchSpec.trim();
    if (!normalized.startsWith('./') && !normalized.startsWith('../')) {
      throw new Error(`Unsupported patch spec format in manifest: ${normalized}`);
    }
    const resolved = path.resolve(releaseJsRoot, normalized);
    if (fs.existsSync(resolved)) {
      referenced.add(path.relative(releaseRuntimeRoot, resolved).replace(/\\/g, '/'));
    }
  }

  return referenced;
}

function copyPortableNode() {
  const runtimeDir = process.env.CRM_NODE_RUNTIME_DIR;
  if (runtimeDir) {
    const sourceRuntimeDir = path.resolve(runtimeDir);
    if (!fs.existsSync(sourceRuntimeDir)) {
      throw new Error(`CRM_NODE_RUNTIME_DIR does not exist: ${sourceRuntimeDir}`);
    }
    fs.cpSync(sourceRuntimeDir, path.join(releaseRuntimeRoot, 'node'), { recursive: true });
    return `Bundled node runtime directory from ${sourceRuntimeDir}`;
  }

  const nodeExe = process.env.CRM_NODE_EXE;
  if (nodeExe) {
    const sourceNodeExe = path.resolve(nodeExe);
    if (!fs.existsSync(sourceNodeExe)) {
      throw new Error(`CRM_NODE_EXE does not exist: ${sourceNodeExe}`);
    }
    const targetNodeDir = path.join(releaseRuntimeRoot, 'node');
    ensureDir(targetNodeDir);
    const targetName = path.basename(sourceNodeExe);
    fs.cpSync(sourceNodeExe, path.join(targetNodeDir, targetName));
    if (targetName !== 'node.exe') {
      fs.cpSync(sourceNodeExe, path.join(targetNodeDir, 'node.exe'));
    }
    return `Bundled node executable from ${sourceNodeExe}`;
  }

  return 'No portable node runtime bundled (launcher will use system PATH).';
}

function writeRuntimeMetadata() {
  fs.writeFileSync(path.join(releaseRuntimeRoot, 'README.txt'), runtimeReadmeText, 'utf8');
  const lines = ['CRM Runtime-Required File Map', '=============================', ''];
  for (const item of runtimeFileMap) {
    lines.push(`- ${item.path}: ${item.why}`);
  }
  fs.writeFileSync(path.join(releaseRuntimeRoot, 'RUNTIME_FILE_MAP.txt'), `${lines.join('\n')}\n`, 'utf8');
}

function buildClientHandoff() {
  fs.rmSync(handoffRoot, { recursive: true, force: true });
  ensureDir(path.join(handoffPayloadRoot, 'runtime'));
  ensureDir(path.join(handoffPayloadRoot, 'scripts'));

  fs.cpSync(releaseRuntimeRoot, handoffRuntimeRoot, { recursive: true });
  fs.writeFileSync(path.join(handoffRoot, 'Install CRM Tool.bat'), handoffInstallBat, 'ascii');
  fs.writeFileSync(path.join(handoffPayloadRoot, 'scripts', 'Install-CRM-Tool.ps1'), handoffInstallPs1, 'utf8');

  const payloadMap = createTreeLines(handoffPayloadRoot, 2, '_payload');
  const afterInstallMap = [
    '%LOCALAPPDATA%/CRM Tool/',
    '├─ Start CRM.bat',
    '├─ Create Desktop Shortcut.bat',
    '├─ Create Desktop Shortcut.ps1',
    '├─ server.js',
    '├─ crm-app/',
    '├─ node/ (if bundled)',
    '├─ README.txt',
    '└─ RUNTIME_FILE_MAP.txt',
    '',
    'Desktop shortcut:',
    '└─ %USERPROFILE%/Desktop/CRM Tool.lnk -> %LOCALAPPDATA%/CRM Tool/Start CRM.bat'
  ];

  const beforeInstallPlaceholder = '__BEFORE_INSTALL_MAP__';
  const beginHereTemplate = `BEGIN HERE - CRM Tool
=====================

WHAT TO CLICK
-------------
Run this file now: Install CRM Tool.bat

WHAT THE OTHER FOLDER IS (_payload)
------------------------------------
_payload contains installer support files and the app runtime files.
You do NOT need to open or run anything in _payload.

WHAT HAPPENS WHEN YOU RUN INSTALLER
-----------------------------------
1) The installer copies CRM Tool into: %LOCALAPPDATA%/CRM Tool
2) It creates a Desktop shortcut named: CRM Tool
3) It shows a success message when complete

HOW TO OPEN CRM AFTER INSTALL
------------------------------
Use the Desktop shortcut: CRM Tool
(You do not need to run Install CRM Tool.bat again unless reinstalling.)

TROUBLESHOOTING
---------------
- If install fails, open: %TEMP%/CRM_Tool_Install.log
- If CRM does not launch later, reinstall by running Install CRM Tool.bat again

BEFORE INSTALL FOLDER MAP
-------------------------
${beforeInstallPlaceholder}

PAYLOAD FOLDER (ONE-LEVEL SUMMARY)
----------------------------------
${indentLines(payloadMap)}

AFTER INSTALL FOLDER MAP
------------------------
${indentLines(afterInstallMap)}
`;

  fs.writeFileSync(path.join(handoffRoot, 'BEGIN HERE.txt'), beginHereTemplate, 'utf8');
  const beforeInstallMap = createTreeLines(handoffRoot, 2, 'CRM Tool Client (unzipped root)');
  const beginHereText = beginHereTemplate.replace(beforeInstallPlaceholder, indentLines(beforeInstallMap));
  fs.writeFileSync(path.join(handoffRoot, 'BEGIN HERE.txt'), beginHereText, 'utf8');

  assertHandoffRootClean();

  return {
    beforeInstallMap,
    payloadMap,
    afterInstallMap
  };
}

function assertHandoffRootClean() {
  const entries = fs.readdirSync(handoffRoot).sort((a, b) => a.localeCompare(b));
  const missingRequired = requiredHandoffRootEntries.filter((entry) => !entries.includes(entry));
  const unexpectedEntries = entries.filter((entry) => !handoffRootKeepList.has(entry));
  if (missingRequired.length > 0) {
    throw new Error(`Client distribution root is missing required entries: ${missingRequired.join(', ')}`);
  }
  if (unexpectedEntries.length > 0) {
    throw new Error(`Client distribution root contains unexpected entries: ${unexpectedEntries.join(', ')}`);
  }
  console.log(`Handoff root assertion passed. Entries: ${entries.join(', ')}`);
}

function buildReleaseArtifact() {
  fs.rmSync(clientToSendRoot, { recursive: true, force: true });
  ensureDir(clientToSendRoot);
  fs.rmSync(releaseRuntimeRoot, { recursive: true, force: true });
  ensureDir(releaseRuntimeRoot);

  for (const runtimePath of runtimePaths) {
    copyRelative(runtimePath);
  }

  pruneReleaseClutter();
  pruneRuntimeNoise(releaseRuntimeRoot);
  writeRuntimeMetadata();
  const nodeMessage = copyPortableNode();
  const maps = buildClientHandoff();
  createDistributionZip();

  console.log(`Release runtime created at: ${releaseRuntimeRoot}`);
  console.log(`Client distribution staging folder created at: ${handoffRoot}`);
  console.log(`Client distribution zip created at: ${handoffZipPath}`);
  console.log(`FINAL ROOT ENTRIES: ${fs.readdirSync(handoffRoot).sort((a, b) => a.localeCompare(b)).join(', ')}`);
  console.log('DO NOT SEND THE REPO ZIP. SEND ONLY THE CLIENT HANDOFF ARTIFACT ABOVE.');
  console.log(`CLIENT HANDOFF ARTIFACT: ${handoffZipPath}`);
  console.log(nodeMessage);
  console.log(`Excluded categories from client payload/runtime: ${excludedCategoryNotes.join(', ')}`);
  console.log('\nBefore-install folder map (for handoff):');
  for (const line of maps.beforeInstallMap) {
    console.log(line);
  }
  console.log('\nPayload folder map (for handoff):');
  for (const line of maps.payloadMap) {
    console.log(line);
  }
  console.log('\nAfter-install expected folder map (for handoff):');
  for (const line of maps.afterInstallMap) {
    console.log(line);
  }
  printTree(handoffRoot, 'Client distribution staging root tree (max depth 2):', 2);
  printTree(handoffPayloadRoot, 'Client distribution _payload tree (max depth 2):', 2);
}

buildReleaseArtifact();
