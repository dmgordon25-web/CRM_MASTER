#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', 'crm-app');
const jsRoot = path.join(root, 'js');
const patchManifestPath = path.join(root, 'patches', 'manifest.json');

function fail(message) {
  console.error(`[manifest-audit] ${message}`);
  process.exit(1);
}

function loadPatchManifest() {
  if (!fs.existsSync(patchManifestPath)) {
    fail(`Patch manifest missing at ${patchManifestPath}`);
  }
  try {
    const raw = fs.readFileSync(patchManifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.patches)) return parsed.patches;
    fail('Patch manifest must be an array or { patches: [] }');
  } catch (err) {
    fail(`Unable to parse patch manifest: ${err.message || err}`);
  }
}

function assertFilesExist(paths) {
  const missing = [];
  for (const spec of paths) {
    const normalized = spec.replace(/^\.\//, '');
    const abs = path.join(jsRoot, normalized);
    if (!fs.existsSync(abs)) {
      missing.push(spec);
    }
  }
  if (missing.length) {
    fail(`Missing patch modules: ${missing.join(', ')}`);
  }
}

async function main() {
  const patches = loadPatchManifest();
  assertFilesExist(patches);

  // Ensure manifest.js loads without throwing so boot can proceed.
  const manifestPath = path.join(jsRoot, 'boot', 'manifest.js');
  if (!fs.existsSync(manifestPath)) {
    fail(`Missing loader manifest at ${manifestPath}`);
  }
  try {
    const url = new URL(`file://${manifestPath}`);
    await import(url.href);
  } catch (err) {
    fail(`Failed to import manifest.js: ${err.message || err}`);
  }

  console.log('[manifest-audit] OK');
}

main().catch((err) => fail(err?.message || err));
