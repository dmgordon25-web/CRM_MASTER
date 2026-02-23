#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repoRoot, 'release', 'CRM');

const runtimePaths = [
  'crm-app',
  'Start CRM.bat',
  'Start CRM.ps1',
  'tools/node_static_server.js',
  'tools/static_server.js'
];

const readmeText = `CRM Release Package
===================

Contents
--------
- crm-app/ (the SPA runtime assets)
- Start CRM.bat
- Start CRM.ps1
- tools/node_static_server.js
- tools/static_server.js
- node/ (portable Node runtime, if bundled by the release builder)

How to run
----------
1) Open this folder in Windows Explorer.
2) Double-click \"Start CRM.bat\".
3) Your browser opens to http://127.0.0.1:8080/.

Port override
-------------
- PowerShell: .\\Start CRM.ps1 -Port 8090
- Env var: set CRM_PORT=8090

Node runtime behavior
---------------------
- The launcher first checks for a bundled runtime at node\\node.exe.
- If no bundled runtime is present, it falls back to Node installed on PATH.

Bundling portable Node
----------------------
The release builder can bundle Node by setting either:
- CRM_NODE_RUNTIME_DIR=<directory containing node.exe or node>
- CRM_NODE_EXE=<full path to node.exe or node>

Examples:
- PowerShell:
  $env:CRM_NODE_RUNTIME_DIR='C:\\portable-node'; node tools\\build_release.js
- PowerShell:
  $env:CRM_NODE_EXE='C:\\Program Files\\nodejs\\node.exe'; node tools\\build_release.js
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
  fs.writeFileSync(path.join(releaseRoot, 'README_RELEASE.txt'), readmeText, 'utf8');
}

function buildReleaseArtifact() {
  fs.rmSync(releaseRoot, { recursive: true, force: true });
  ensureDir(releaseRoot);

  for (const runtimePath of runtimePaths) {
    copyRelative(runtimePath);
  }

  writeReleaseReadme();
  const nodeMessage = copyPortableNode();

  console.log(`Release artifact created at: ${releaseRoot}`);
  console.log(nodeMessage);
}

buildReleaseArtifact();
