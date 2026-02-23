#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const releaseRoot = path.join(repoRoot, 'release', 'CRM');
const launcherPath = path.join(releaseRoot, 'Start CRM.bat');
const buildScriptPath = path.join(repoRoot, 'build_release.ps1');

function fail(message) {
  process.stderr.write(`[FAIL] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(launcherPath)) {
  fail(`Missing launcher: ${launcherPath}`);
}

const launcher = fs.readFileSync(launcherPath, 'utf8');
if (/tools[\\/]/i.test(launcher)) {
  fail('Launcher references tools/ path, which is not allowed for release runtime.');
}

const requiredReleasePaths = [
  'Start CRM.bat',
  'server.js',
  path.join('crm-app', 'index.html'),
  'README.txt'
];

for (const rel of requiredReleasePaths) {
  const full = path.join(releaseRoot, rel);
  if (!fs.existsSync(full)) {
    fail(`Required release path missing: release/CRM/${rel.replace(/\\/g, '/')}`);
  }
}

const mustMention = ['server.js', 'crm-app\\index.html', 'node\\node.exe', 'launcher.log'];
for (const token of mustMention) {
  if (!launcher.includes(token)) {
    fail(`Launcher is missing expected token: ${token}`);
  }
}

if (!fs.existsSync(buildScriptPath)) {
  fail('Missing build_release.ps1');
}
const buildScript = fs.readFileSync(buildScriptPath, 'utf8');
if (!buildScript.includes('Install-PortableNode -DestinationRoot $releaseCrm')) {
  fail('build_release.ps1 does not stage portable Node into release/CRM.');
}

process.stdout.write('[OK] Launcher static checks passed.\n');
