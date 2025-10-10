#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'crm-app', 'js');
const ENTRY = [
  path.join(ROOT, 'patches', 'loader.js'),
  path.join(ROOT, 'boot', 'loader.js'),
];
const entrySet = new Set(ENTRY);

const seen = new Set();
const graph = new Map();
const outside = new Set();

function read(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return '';
  }
}

function normalizeModule(fromFile, spec) {
  const resolved = path.resolve(path.dirname(fromFile), spec);
  return resolved.endsWith('.js') ? resolved : `${resolved}.js`;
}

function addEntry(filePath) {
  if (!entrySet.has(filePath)) {
    entrySet.add(filePath);
    ENTRY.push(filePath);
  }
}

function deps(filePath) {
  const txt = read(filePath);
  const out = [];
  const re = /import\s+(?:[^'";]+?from\s+)?['"]([^'";]+)['"]/g;
  let match;
  while ((match = re.exec(txt))) {
    const spec = match[1];
    if (!spec.startsWith('.')) {
      continue;
    }
    const target = normalizeModule(filePath, spec);
    if (!target.startsWith(ROOT)) {
      if (!outside.has(target)) {
        console.warn('WARN outside root:', target);
        outside.add(target);
      }
      continue;
    }
    out.push(target);
  }
  return out;
}

function walk(filePath, stack = []) {
  if (seen.has(filePath)) {
    return;
  }
  seen.add(filePath);
  const dependencies = deps(filePath);
  graph.set(filePath, dependencies);
  for (const dep of dependencies) {
    if (stack.includes(dep)) {
      console.warn(
        'CYCLE:',
        [...stack, dep].map((p) => path.relative(ROOT, p)).join(' -> ')
      );
      continue;
    }
    walk(dep, [...stack, filePath]);
  }
}

function seedManifestEntries() {
  const manifestPath = path.join(ROOT, 'boot', 'manifest.js');
  const txt = read(manifestPath);
  if (!txt) {
    return;
  }
  const re = /['"](\.\.\/[^'";]+)['"]/g;
  let match;
  while ((match = re.exec(txt))) {
    const spec = match[1];
    const target = normalizeModule(manifestPath, spec);
    if (target.startsWith(ROOT)) {
      addEntry(target);
    }
  }
}

seedManifestEntries();
ENTRY.forEach((entry) => walk(entry));

function allJs(root) {
  const result = [];
  for (const entry of fs.readdirSync(root)) {
    const filePath = path.join(root, entry);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      result.push(...allJs(filePath));
    } else if (filePath.endsWith('.js')) {
      result.push(filePath);
    }
  }
  return result;
}

const all = new Set(allJs(ROOT));
for (const filePath of all) {
  if (!seen.has(filePath)) {
    console.warn('UNREACHABLE:', path.relative(ROOT, filePath));
  }
}

console.log('Audit complete. Reachable:', seen.size, 'of', all.size);
