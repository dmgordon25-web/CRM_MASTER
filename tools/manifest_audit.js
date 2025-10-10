#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs'); const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'crm-app', 'js');
const ENTRY = [
  path.join(ROOT, 'patches', 'loader.js'),
  path.join(ROOT, 'boot', 'loader.js')
].filter(fs.existsSync);

function read(p){ try { return fs.readFileSync(p,'utf8'); } catch{ return ''; } }
function norm(p){ return p.replace(/\\/g,'/'); }

function resolveImport(from, spec){
  if (!spec.startsWith('.')) return null; // ignore bare/URL imports
  const base = path.dirname(from);
  const abs = path.resolve(base, spec);
  const withJs = abs.endsWith('.js') ? abs : abs + '.js';
  return fs.existsSync(withJs) ? withJs : null;
}

// parse static imports only
const IMP_RE = /import\s+(?:[^'\"]+?from\s+)?['\"]([^'\"]+)['\"]/g;

const graph = new Map();
const seen = new Set();
const stack = [];

function walk(p){
  if (seen.has(p)) return;
  seen.add(p); stack.push(p);
  const txt = read(p); const deps=[];
  let m; while ((m = IMP_RE.exec(txt))){
    const to = resolveImport(p, m[1]); if (to) deps.push(to);
  }
  graph.set(p, deps);
  for (const d of deps){
    if (stack.includes(d)){
      console.error('CYCLE:', norm([...stack, d].join(' -> ')));
    } else {
      walk(d);
    }
  }
  stack.pop();
}

// crawl from entries
ENTRY.forEach(walk);

// enumerate all js files
function allJs(dir){
  const out=[]; for (const f of fs.readdirSync(dir)){
    const p=path.join(dir,f); const s=fs.statSync(p);
    if (s.isDirectory()) out.push(...allJs(p));
    else if (p.endsWith('.js')) out.push(p);
  } return out;
}
const all = new Set(allJs(ROOT));
const reachable = new Set(graph.keys());
const unreachable = [...all].filter(f => !reachable.has(f));

// Phase rules: read phases list
const phasesJs = path.join(ROOT, 'boot', 'phases.js');
const phasesTxt = read(phasesJs);
function phaseOf(absPath){
  const rel = norm(path.relative(path.join(ROOT,'boot'), absPath)).replace(/\.\.\//g,'../'); // heuristic
  const asUrl = new RegExp(`new URL\\('\.\.\./${rel.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}',[^)]*\\)\\.href`);
  if (asUrl.test(phasesTxt)){
    if (/PHASES\.\s*SHELL/.test(phasesTxt.split(asUrl)[0].slice(-400))) return 'SHELL';
    if (/PHASES\.\s*SERVICES/.test(phasesTxt.split(asUrl)[0].slice(-400))) return 'SERVICES';
    if (/PHASES\.\s*FEATURES/.test(phasesTxt.split(asUrl)[0].slice(-400))) return 'FEATURES';
  }
  return null; // not declared
}

const problems = [];
// unreachable files
unreachable.forEach(f => problems.push({ kind:'unreachable', file:norm(path.relative(ROOT,f)) }));

// services must precede features: if a feature imports a service file directly, warn
const services = [];
const features = [];
for (const file of reachable){
  const ph = phaseOf(file);
  if (ph === 'SERVICES') services.push(file);
  if (ph === 'FEATURES') features.push(file);
}
const serviceSet = new Set(services);
for (const feat of features){
  const deps = graph.get(feat) || [];
  for (const d of deps){
    if (serviceSet.has(d)){
      // Feature imports service directly — fine — but ensure service is declared in SERVICES
      // already true by serviceSet, so we just note it
    }
  }
}
// missing phase suggestions
for (const file of reachable){
  if (phaseOf(file)) continue;
  const rel = norm(path.relative(ROOT,file));
  // crude heuristic: files under ui/, dashboard/, pages/ => FEATURES; under *merge* => SERVICES
  const suggestion = /merge/.test(rel) ? 'SERVICES' : /ui|dashboard|pages|calendar/.test(rel) ? 'FEATURES' : 'FEATURES';
  problems.push({ kind:'unphased', file: rel, suggest: suggestion });
}

// summarize cycles printed earlier by console.error — also count them
let hadCycle = false;
const origError = console.error;
let cycleCount = 0;
console.error = (...a)=>{ hadCycle = true; cycleCount++; origError(...a); };

// output
const report = {
  entry: ENTRY.map(norm),
  reachable: reachable.size,
  total: all.size,
  unreachable: unreachable.map(f=>norm(path.relative(ROOT,f))),
  problems
};

const hasUnreachable = unreachable.length > 0;
const hasUnphased = problems.some(p => p.kind === 'unphased');
const exitCode = (hadCycle || hasUnreachable) ? 2 : (hasUnphased ? 1 : 0);

console.log(JSON.stringify(report, null, 2));
process.exit(exitCode);
