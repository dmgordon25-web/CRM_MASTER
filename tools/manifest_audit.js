#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'crm-app', 'js');
const ENTRY = [
  path.join(ROOT, 'patches', 'loader.js'),
  path.join(ROOT, 'boot', 'loader.js'),
];

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
    const resolved = path.resolve(path.dirname(filePath), spec);
    const target = resolved.endsWith('.js') ? resolved : `${resolved}.js`;
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
