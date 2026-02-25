#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repoRoot, 'release', 'CRM');

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
  { path: 'Start CRM.bat', why: 'Primary launcher used by client handoff.' },
  { path: 'Create Desktop Shortcut.bat', why: 'One-click helper to create a desktop shortcut.' },
  { path: 'Create Desktop Shortcut.ps1', why: 'Creates the CRM Tool desktop shortcut (.lnk).' },
  { path: 'server.js', why: 'Offline local static server and /health endpoint.' },
  { path: 'crm-app/', why: 'SPA runtime assets (HTML/CSS/JS/data/patches).' },
  { path: 'node/', why: 'Bundled portable Node runtime used first by launcher.' },
  { path: 'README.txt', why: 'Client launch/troubleshooting instructions.' },
  { path: 'RUNTIME_FILE_MAP.txt', why: 'Runtime-required file map for release audit.' }
];

const readmeText = `CRM Tool (Client Release)
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
`;

function ensureDir(targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyRelative(relativePath) {
  const sourcePath = path.join(repoRoot, relativePath);
  const targetPath = path.join(releaseRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing required runtime path: ${relativePath}`);
  }
  ensureDir(path.dirname(targetPath));
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function pruneReleaseClutter() {
  for (const relativePath of prunePaths) {
    const targetPath = path.join(releaseRoot, relativePath);
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
    fs.cpSync(sourceRuntimeDir, path.join(releaseRoot, 'node'), { recursive: true });
    return `Bundled node runtime directory from ${sourceRuntimeDir}`;
  }

  const nodeExe = process.env.CRM_NODE_EXE;
  if (nodeExe) {
    const sourceNodeExe = path.resolve(nodeExe);
    if (!fs.existsSync(sourceNodeExe)) {
      throw new Error(`CRM_NODE_EXE does not exist: ${sourceNodeExe}`);
    }
    const targetNodeDir = path.join(releaseRoot, 'node');
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

function writeReleaseReadme() {
  fs.writeFileSync(path.join(releaseRoot, 'README.txt'), readmeText, 'utf8');
}

function writeRuntimeFileMap() {
  const lines = [
    'CRM Runtime-Required File Map',
    '=============================',
    ''
  ];

  for (const item of runtimeFileMap) {
    lines.push(`- ${item.path}: ${item.why}`);
  }

  fs.writeFileSync(path.join(releaseRoot, 'RUNTIME_FILE_MAP.txt'), `${lines.join('\n')}\n`, 'utf8');
}

function buildReleaseArtifact() {
  fs.rmSync(releaseRoot, { recursive: true, force: true });
  ensureDir(releaseRoot);

  for (const runtimePath of runtimePaths) {
    copyRelative(runtimePath);
  }

  pruneReleaseClutter();
  writeReleaseReadme();
  writeRuntimeFileMap();
  const nodeMessage = copyPortableNode();

  console.log(`Release artifact created at: ${releaseRoot}`);
  console.log(nodeMessage);
}

buildReleaseArtifact();
