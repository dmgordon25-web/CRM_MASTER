#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repoRoot, 'release');
const releaseRuntimeRoot = path.join(releaseRoot, 'CRM');
const handoffRoot = path.join(releaseRoot, 'CRM_Client_Handoff');
const handoffPayloadRoot = path.join(handoffRoot, 'Package');
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
set "INSTALLER_PS=%HANDOFF_ROOT%Package\\scripts\\Install-CRM-Tool.ps1"

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

echo [OK] CRM Tool installed successfully.
echo [OK] Use desktop shortcut "CRM Tool" to launch.
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

if (-not (Test-Path -LiteralPath $runtimeSource)) {
  throw "Missing runtime payload at $runtimeSource"
}

Set-Content -LiteralPath $logPath -Value '' -Encoding UTF8
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
Write-InstallLog 'Installation completed successfully.'
`;

const clientReadmeText = `CRM Tool - Client Install & Run Guide
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
- If install fails, open: %TEMP%\\CRM_Tool_Install.log
- If launch fails later, open launcher.log in:
  %LOCALAPPDATA%\\CRM Tool
- If needed, run Install CRM Tool.bat again to reinstall cleanly.
`;

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
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
  for (const relativePath of prunePaths) {
    const targetPath = path.join(releaseRuntimeRoot, relativePath);
    if (fs.existsSync(targetPath)) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Pruned release-only clutter: ${relativePath}`);
    }
  }
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
  ensureDir(path.join(handoffPayloadRoot, 'docs'));

  fs.cpSync(releaseRuntimeRoot, handoffRuntimeRoot, { recursive: true });
  fs.writeFileSync(path.join(handoffRoot, 'Install CRM Tool.bat'), handoffInstallBat, 'ascii');
  fs.writeFileSync(path.join(handoffPayloadRoot, 'scripts', 'Install-CRM-Tool.ps1'), handoffInstallPs1, 'utf8');
  fs.writeFileSync(path.join(handoffPayloadRoot, 'docs', 'CLIENT_README.txt'), clientReadmeText, 'utf8');
}

function buildReleaseArtifact() {
  fs.rmSync(releaseRuntimeRoot, { recursive: true, force: true });
  ensureDir(releaseRuntimeRoot);

  for (const runtimePath of runtimePaths) {
    copyRelative(runtimePath);
  }

  pruneReleaseClutter();
  writeRuntimeMetadata();
  const nodeMessage = copyPortableNode();
  buildClientHandoff();

  console.log(`Release runtime created at: ${releaseRuntimeRoot}`);
  console.log(`Client handoff package created at: ${handoffRoot}`);
  console.log(nodeMessage);
}

buildReleaseArtifact();
