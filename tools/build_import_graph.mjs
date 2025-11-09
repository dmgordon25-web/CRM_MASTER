#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const appRoot = path.join(repoRoot, 'crm-app');
const jsRoot = path.join(appRoot, 'js');
const manifestModulePath = path.join(jsRoot, 'boot', 'manifest.js');

const importMapPrefixes = new Map([
  ['crm/', './js/']
]);

const KEEP_RELATIVE = new Set([
  'index.html',
  'patches/manifest.json',
]);

const KEEP_PREFIXES = [
  'js/boot/',
  'js/router/',
  'js/ui/',
  'js/table/',
  'js/pipeline/',
  'js/notifications/',
];

const KEEP_FILES = new Set([
  'js/doccenter_rules.js',
  'js/db.js'
]);

const REPORT_DIR = path.join(repoRoot, 'REPORTS');
const GRAPH_PATH = path.join(REPORT_DIR, 'import_graph.json');
const UNUSED_PATH = path.join(REPORT_DIR, 'unused_paths.txt');

const htmlEntry = path.join(appRoot, 'index.html');

function normalizeRel(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function stripComments(source) {
  let result = '';
  let i = 0;
  const len = source.length;
  let inString = null;
  let inTemplate = false;
  let inBlockComment = false;
  let inLineComment = false;

  while (i < len) {
    const char = source[i];
    const next = i + 1 < len ? source[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += '\n';
      } else {
        result += ' ';
      }
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        result += '  ';
        i += 2;
      } else {
        result += char === '\n' ? '\n' : ' ';
        i += 1;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (char === '\\') {
        if (i + 1 < len) {
          result += source[i + 1];
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      if (char === inString) {
        inString = null;
      }
      i += 1;
      continue;
    }

    if (inTemplate) {
      result += char;
      if (char === '\\') {
        if (i + 1 < len) {
          result += source[i + 1];
          i += 2;
          continue;
        }
        i += 1;
        continue;
      }
      if (char === '`') {
        inTemplate = false;
      }
      i += 1;
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      result += '  ';
      i += 2;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      result += '  ';
      i += 2;
      continue;
    }

    if (char === '\'' || char === '"') {
      inString = char;
      result += char;
      i += 1;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      result += char;
      i += 1;
      continue;
    }

    result += char;
    i += 1;
  }

  return result;
}

const STATIC_IMPORT_RE = /import\s+(?:[^'";]*?\sfrom\s*)?['"]([^'"\n]+)['"]/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"\n]+)['"]\s*\)/g;
const EXPORT_FROM_RE = /export\s+[^;]*?\sfrom\s*['"]([^'"\n]+)['"]/g;
const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]([^'"\n]+)['"]\s*\)?/gi;

function matchAllImports(source) {
  const stripped = stripComments(source);
  const matches = [];
  const pushMatches = (regex, kind) => {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(stripped))) {
      matches.push({ spec: match[1], kind });
    }
  };
  pushMatches(STATIC_IMPORT_RE, 'static');
  pushMatches(DYNAMIC_IMPORT_RE, 'dynamic');
  pushMatches(EXPORT_FROM_RE, 'export-from');
  return matches;
}

function matchCssImports(source) {
  const matches = [];
  let match;
  CSS_IMPORT_RE.lastIndex = 0;
  while ((match = CSS_IMPORT_RE.exec(source))) {
    matches.push({ spec: match[1], kind: 'css-import' });
  }
  return matches;
}

const URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function normalizeHtmlSpec(raw) {
  const spec = raw.trim();
  if (!spec) return spec;
  if (URL_PATTERN.test(spec)) return spec;
  if (spec.startsWith('//')) return spec;
  if (spec.startsWith('/') || spec.startsWith('./') || spec.startsWith('../')) {
    return spec;
  }
  return `./${spec}`;
}

function mapImportFromHtml(source) {
  const references = [];
  const seen = new Set();
  const scriptSrcRe = /<script[^>]*type\s*=\s*"module"[^>]*src\s*=\s*"([^"]+)"[^>]*>/gi;
  const inlineModuleRe = /<script[^>]*type\s*=\s*"module"[^>]*>([\s\S]*?)<\/script>/gi;
  const regularScriptRe = /<script[^>]*src\s*=\s*"([^"]+)"[^>]*>/gi;
  const linkHrefPatterns = [
    /<link[^>]*rel\s*=\s*"stylesheet"[^>]*href\s*=\s*"([^"]+)"[^>]*>/gi,
    /<link[^>]*href\s*=\s*"([^"]+)"[^>]*rel\s*=\s*"stylesheet"[^>]*>/gi
  ];

  let match;
  scriptSrcRe.lastIndex = 0;
  while ((match = scriptSrcRe.exec(source))) {
    const spec = normalizeHtmlSpec(match[1]);
    if (!spec) continue;
    const key = `module:${spec}`;
    if (!seen.has(key)) {
      references.push({ spec, reason: 'html:module-script-src' });
      seen.add(key);
    }
  }

  regularScriptRe.lastIndex = 0;
  while ((match = regularScriptRe.exec(source))) {
    const raw = match[1];
    if (!raw) continue;
    const spec = normalizeHtmlSpec(raw);
    if (!spec) continue;
    const key = `script:${spec}`;
    if (!seen.has(key)) {
      references.push({ spec, reason: 'html:script-src' });
      seen.add(key);
    }
  }

  for (const pattern of linkHrefPatterns) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(source))) {
      const spec = normalizeHtmlSpec(match[1]);
      if (!spec) continue;
      const key = `link:${spec}`;
      if (seen.has(key)) continue;
      references.push({ spec, reason: 'html:stylesheet' });
      seen.add(key);
    }
  }

  inlineModuleRe.lastIndex = 0;
  while ((match = inlineModuleRe.exec(source))) {
    const body = match[1] || '';
    const imports = matchAllImports(body);
    imports.forEach((entry) => {
      const spec = normalizeHtmlSpec(entry.spec);
      if (!spec) return;
      references.push({ spec, reason: `html:inline-module:${entry.kind}` });
    });
  }

  const postPaintRe = /__CRM_POST_FIRST_PAINT_MODULES__[^\[]*\[([\s\S]*?)\]/m;
  const ppMatch = postPaintRe.exec(source);
  if (ppMatch) {
    const chunk = ppMatch[1];
    const specRe = /['"]([^'"]+)['"]/g;
    let specMatch;
    while ((specMatch = specRe.exec(chunk))) {
      const spec = normalizeHtmlSpec(specMatch[1]);
      if (!spec) continue;
      references.push({ spec, reason: 'html:post-first-paint' });
    }
  }

  return references;
}

function parseManifestEntries(source) {
  const entries = [];
  const arrayRe = /export\s+const\s+CORE\s*=\s*\[([\s\S]*?)\];/m;
  const match = arrayRe.exec(source);
  if (match) {
    const chunk = match[1];
    const specRe = /['"]([^'"]+)['"]/g;
    let specMatch;
    while ((specMatch = specRe.exec(chunk))) {
      entries.push({ spec: specMatch[1], reason: 'manifest:CORE' });
    }
  }
  return entries;
}

async function readPatchManifest() {
  const manifestPath = path.join(appRoot, 'patches', 'manifest.json');
  const raw = await readFileIfExists(manifestPath);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const patchList = Array.isArray(parsed?.patches) ? parsed.patches : (Array.isArray(parsed) ? parsed : []);
    return patchList.filter((item) => typeof item === 'string').map((spec) => ({ spec, reason: 'manifest:patch' }));
  } catch (err) {
    console.warn('[import-graph] Failed to parse patch manifest:', err);
    return [];
  }
}

function applyImportMap(spec) {
  for (const [prefix, target] of importMapPrefixes) {
    if (!spec.startsWith(prefix)) continue;

    const remainder = spec.slice(prefix.length);
    const normalizedTarget = target.startsWith('./') ? target.slice(2) : target;
    const base = normalizedTarget.endsWith('/') ? normalizedTarget : `${normalizedTarget}/`;

    return {
      spec: `${base}${remainder}`,
      baseDir: appRoot
    };
  }
  return { spec };
}

function normalizeSpec(spec) {
  if (!spec) return null;
  const trimmed = spec.trim();
  if (!trimmed) return null;
  return trimmed;
}

function isBareModule(spec) {
  if (spec.startsWith('./') || spec.startsWith('../')) return false;
  if (spec.startsWith('/')) return false;
  return !spec.startsWith('.');
}

const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function resolveImport(spec, importer) {
  let normalized = normalizeSpec(spec);
  if (!normalized) return null;
  if (URL_SCHEME_RE.test(normalized)) return null;
  if (normalized.startsWith('data:')) return null;
  if (normalized.startsWith('//')) return null;

  const mapResult = applyImportMap(normalized);
  normalized = mapResult.spec;
  const mappedBaseDir = mapResult.baseDir;

  const isManifestImporter = importer && path.resolve(importer) === manifestModulePath;

  if (normalized.startsWith('/')) {
    if (normalized.startsWith('/js/')) {
      normalized = '.' + normalized;
    } else if (normalized.startsWith('/styles/')) {
      normalized = '.' + normalized;
    } else {
      return null;
    }
  }

  let baseDir;
  if (mappedBaseDir) {
    baseDir = mappedBaseDir;
  } else if (isManifestImporter) {
    baseDir = jsRoot;
  } else if (!importer) {
    baseDir = appRoot;
  } else {
    baseDir = path.dirname(importer);
  }

  let resolved;
  if (normalized.startsWith('./')) {
    resolved = path.resolve(baseDir, normalized.slice(2));
  } else if (normalized.startsWith('../')) {
    resolved = path.resolve(baseDir, normalized);
  } else if (normalized.startsWith('js/')) {
    resolved = path.resolve(appRoot, normalized);
  } else if (normalized.startsWith('styles/')) {
    resolved = path.resolve(appRoot, normalized);
  } else {
    if (isBareModule(normalized)) {
      return null;
    }
    resolved = path.resolve(baseDir, normalized);
  }

  const attemptPaths = [resolved];
  if (!path.extname(resolved)) {
    attemptPaths.push(`${resolved}.js`);
    attemptPaths.push(`${resolved}.mjs`);
    attemptPaths.push(`${resolved}.json`);
  }

  for (const candidate of attemptPaths) {
    const rel = normalizeRel(candidate);
    if (!rel.startsWith('crm-app/')) continue;
    if (rel.includes('/QUARANTINE/')) continue;
    return candidate;
  }

  return attemptPaths[0];
}

async function gatherFiles(rootDir) {
  const stack = [rootDir];
  const files = [];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.DS_Store') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return files;
}

function shouldKeepRel(relPath) {
  if (KEEP_RELATIVE.has(relPath)) return true;
  if (KEEP_FILES.has(relPath)) return true;
  return KEEP_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

async function buildGraph() {
  const nodes = new Map();
  const edges = [];
  const missing = [];
  const reachable = new Set();
  const queue = [];

  const indexSource = await readFileIfExists(htmlEntry);
  if (!indexSource) {
    throw new Error('index.html not found');
  }
  const htmlRefs = mapImportFromHtml(indexSource);

  addReachable(htmlEntry, 'entry:index');

  for (const ref of htmlRefs) {
    const target = resolveImport(ref.spec, htmlEntry);
    if (!target) continue;
    enqueue(target, ref.reason, htmlEntry, ref.reason.includes('inline-module') ? 'import' : 'entry');
  }

  const manifestSource = await readFileIfExists(manifestModulePath);
  if (manifestSource) {
    const manifestEntries = parseManifestEntries(manifestSource);
    manifestEntries.forEach((entry) => {
      const target = resolveImport(entry.spec, manifestModulePath);
      if (!target) return;
      enqueue(target, entry.reason, manifestModulePath, 'manifest');
    });
  }

  const patchEntries = await readPatchManifest();
  patchEntries.forEach((entry) => {
    const target = resolveImport(entry.spec, manifestModulePath);
    if (!target) return;
    enqueue(target, entry.reason, manifestModulePath, 'manifest');
  });

  KEEP_RELATIVE.forEach((rel) => addReachable(path.join(appRoot, rel), 'keep-list'));
  KEEP_FILES.forEach((rel) => addReachable(path.join(appRoot, rel), 'keep-list'));

  function enqueue(absPath, reason, importer, edgeType) {
    const rel = normalizeRel(absPath);
    addNode(rel, reason);
    if (importer) {
      const from = normalizeRel(importer);
      edges.push({ from, to: rel, type: edgeType || 'import', reason });
    }
    if (!reachable.has(rel)) {
      reachable.add(rel);
      queue.push(absPath);
    }
  }

  function addReachable(absPath, reason) {
    const rel = normalizeRel(absPath);
    addNode(rel, reason);
    reachable.add(rel);
  }

  function addNode(rel, reason) {
    const existing = nodes.get(rel);
    if (existing) {
      if (reason && !existing.reasons.includes(reason)) existing.reasons.push(reason);
      return;
    }
    nodes.set(rel, { id: rel, reasons: reason ? [reason] : [] });
  }

  while (queue.length) {
    const currentAbs = queue.shift();
    const rel = normalizeRel(currentAbs);
    const source = await readFileIfExists(currentAbs);
    if (!source) {
      missing.push({ id: rel, reason: 'missing-file' });
      continue;
    }
    if (currentAbs.endsWith('.css')) {
      const imports = matchCssImports(source);
      for (const entry of imports) {
        const target = resolveImport(entry.spec, currentAbs);
        if (!target) continue;
        enqueue(target, `import:${entry.kind}`, currentAbs, entry.kind);
      }
      continue;
    }
    if (!currentAbs.endsWith('.js') && !currentAbs.endsWith('.mjs') && !currentAbs.endsWith('.json')) {
      continue;
    }
    const imports = matchAllImports(source);
    for (const entry of imports) {
      const target = resolveImport(entry.spec, currentAbs);
      if (!target) continue;
      enqueue(target, `import:${entry.kind}`, currentAbs, entry.kind);
    }
  }

  const allFiles = await gatherFiles(appRoot);
  const unused = [];
  for (const absPath of allFiles) {
    const rel = normalizeRel(absPath);
    if (rel.startsWith('crm-app/QUARANTINE/')) continue;
    if (rel.startsWith('crm-app/.')) continue;
    if (rel.startsWith('crm-app/reports')) continue;
    if (rel.startsWith('crm-app/_graveyard')) {
      unused.push(rel);
      continue;
    }
    if (reachable.has(rel)) continue;
    if (shouldKeepRel(rel.replace('crm-app/', ''))) continue;
    unused.push(rel);
  }

  unused.sort();

  return {
    nodes: Array.from(nodes.values()).sort((a, b) => a.id.localeCompare(b.id)),
    edges,
    missing,
    reachable: Array.from(reachable).sort(),
    unused
  };
}

async function writeOutputs(graph) {
  await ensureDir(REPORT_DIR);
  const graphData = {
    generatedAt: new Date().toISOString(),
    nodes: graph.nodes,
    edges: graph.edges,
    missing: graph.missing,
    reachable: graph.reachable
  };
  await fs.writeFile(GRAPH_PATH, JSON.stringify(graphData, null, 2));
  await fs.writeFile(UNUSED_PATH, graph.unused.join('\n') + (graph.unused.length ? '\n' : ''));
}

async function moveUnused(unused) {
  for (const rel of unused) {
    const abs = path.join(repoRoot, rel);
    const target = path.join(repoRoot, 'QUARANTINE', rel);
    await ensureDir(path.dirname(target));
    try {
      await fs.rename(abs, target);
    } catch (err) {
      if (err && err.code === 'ENOENT') {
        continue;
      }
      throw err;
    }
  }
}

async function main() {
  const graph = await buildGraph();
  await writeOutputs(graph);
  await moveUnused(graph.unused);
}

main().catch((err) => {
  console.error('[import-graph] Failed:', err);
  process.exit(1);
});
