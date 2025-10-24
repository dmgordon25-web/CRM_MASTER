/* Node script to validate manifest lists. Exits 0 when OK, 2 on fatal. */
const fs = require('fs'), path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const jsRoot = path.join(repoRoot, 'crm-app', 'js');
const manifestDir = path.join(jsRoot, 'boot');
const patchesManifestPath = path.join(repoRoot, 'crm-app', 'patches', 'manifest.json');
const bootManifestPath = path.join(manifestDir, 'manifest.js');

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeSpec(spec) {
  const value = String(spec).trim();
  if (!value) return value;
  if (value.startsWith('./') || value.startsWith('../') || value.startsWith('/')) return value;
  if (value.startsWith('crm-app/js/')) return `./${value.slice('crm-app/js/'.length)}`;
  if (value.startsWith('js/')) return `./${value.slice(3)}`;
  return value.startsWith('.') ? value : `./${value}`;
}

/* merge-proof parse beacon */ void 0;

function loadManifest() {
  const code = fs.readFileSync(bootManifestPath, 'utf8');
  const coreMatch = [...code.matchAll(/CORE\s*=\s*\[(.*?)\]/gs)][0];
  const patchMatch = [...code.matchAll(/PATCHES\s*=\s*\[(.*?)\]/gs)][0];
  if (!coreMatch || !patchMatch) return { core: [], patches: [] };
  const getList = (s) => (s.match(/'([^']+)'/g) || []).map((x) => normalizeSpec(x.slice(1, -1)));
  return { core: getList(coreMatch[1]), patches: getList(patchMatch[1]) };
}

function fileExists(spec) {
  const normalized = normalizeSpec(spec);
  if (normalized.startsWith('/')) return fs.existsSync(normalized);
  return fs.existsSync(path.resolve(jsRoot, normalized));
}

(function main(){
  const { core: CORE, patches: PATCHES } = loadManifest();

  let patchManifestRaw;
  try {
    patchManifestRaw = readJSON(patchesManifestPath);
  } catch (err) {
    console.error('[AUDIT] Failed to parse crm-app/patches/manifest.json');
    console.error(err.message || err);
    process.exit(2);
  }

  let patchManifestList = null;
  if (Array.isArray(patchManifestRaw)) {
    patchManifestList = patchManifestRaw.map(String);
  } else if (patchManifestRaw && Array.isArray(patchManifestRaw.patches)) {
    patchManifestList = patchManifestRaw.patches.map(String);
  }

  if (!patchManifestList) {
    console.error('[AUDIT] Invalid crm-app/patches/manifest.json structure; expected an array or { patches: [] }');
    process.exit(2);
  }

  const normalizedPatchManifest = patchManifestList.map(normalizeSpec);

  const manifestsNormalized = normalizedPatchManifest.every((entry, idx) => entry === patchManifestList[idx]);
  if (!manifestsNormalized) {
    console.error('[AUDIT] crm-app/patches/manifest.json entries must be relative to crm-app/js using ./ prefixes');
    process.exit(2);
  }

  const sameLength = normalizedPatchManifest.length === PATCHES.length;
  const sameItems = sameLength && PATCHES.every((entry, idx) => entry === normalizedPatchManifest[idx]);
  if (!sameItems) {
    const limit = Math.max(PATCHES.length, normalizedPatchManifest.length);
    let diffIndex = -1;
    for (let i = 0; i < limit; i += 1) {
      if (PATCHES[i] !== normalizedPatchManifest[i]) {
        diffIndex = i;
        break;
      }
    }
    console.error('[AUDIT] PATCHES mismatch between manifests. First diff at index:', diffIndex);
    console.error('patches/manifest.json tail:', normalizedPatchManifest.slice(-6));
    console.error('boot/manifest.js tail:', PATCHES.slice(-6));
    process.exit(3);
  }

  const TAIL_RULES = [
    './patches/patch_2025-10-24_quickadd_header_only.js',
    './patches/patch_2025-10-23_calendar_contact_and_task.js',
    './patches/patch_2025-10-24_polish.js',
  ].map(normalizeSpec).filter((spec) => fileExists(spec));

  const tailLen = TAIL_RULES.length;
  if (tailLen > 0 && PATCHES.length < tailLen) {
    console.error('[AUDIT] Manifest too short to contain required tail files.');
    console.error('[AUDIT] Required tail length:', tailLen, 'Actual length:', PATCHES.length);
    process.exit(4);
  }

  if (tailLen > 0) {
    const actualTail = PATCHES.slice(-tailLen);
    const sameLen = actualTail.length === tailLen;
    const sameItems = sameLen && actualTail.every((x, i) => x === TAIL_RULES[i]);
    if (!sameItems) {
      const firstIdx = PATCHES.findIndex((x) => x === (TAIL_RULES[0] || ''));
      const contiguousAtEnd =
        firstIdx >= 0 &&
        firstIdx === PATCHES.length - tailLen &&
        PATCHES.slice(firstIdx).every((x, i) => x === TAIL_RULES[i]);

      console.error('[AUDIT] Tail rule violation.');
      console.error('[AUDIT] Expected tail:', TAIL_RULES);
      console.error('[AUDIT] Actual tail:', actualTail);
      if (firstIdx >= 0 && !contiguousAtEnd) {
        console.error('[AUDIT] Tail block found at index', firstIdx, 'but it is not the final contiguous block.');
      }
      const max = Math.max(actualTail.length, TAIL_RULES.length);
      for (let i = 0; i < max; i += 1) {
        if (actualTail[i] !== TAIL_RULES[i]) {
          console.error('[AUDIT] First tail diff at offset', i, 'expected:', TAIL_RULES[i], 'got:', actualTail[i]);
          break;
        }
      }
      process.exit(4);
    }
  }

  const all = [...CORE, ...PATCHES];
  const seen = new Set(), dups = [];
  for (const p of all) {
    if (seen.has(p)) dups.push(p);
    else seen.add(p);
  }
  const missing = all.filter((p) => !fileExists(p));

  const patchSeen = new Set();
  const patchDupes = [];
  for (const patch of PATCHES) {
    if (patchSeen.has(patch)) patchDupes.push(patch);
    else patchSeen.add(patch);
  }

  const patchOrderIssues = [];

  // Crawl js folder for unphased files (warn only)
  function walk(dir){
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const out = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...walk(full));
      else if (full.endsWith('.js')) out.push(full);
    }
    return out;
  }
  const allJs = walk(jsRoot)
    .map(p => './' + path.relative(jsRoot, p).replace(/\\/g, '/'));
  const phList = new Set(all);
  const unphased = allJs
    .filter(p => !p.startsWith('./boot/'))
    .filter(p => !phList.has(p));

  const CORE_DISALLOWED = [
    './ui/',
    './calendar_',
    './calendar/',
    './contacts',
    './partners',
    './reports',
    './notifications',
    './importer_',
    './importer/',
    './merge/',
    './doc/',
    './dash',
    './patch_',
    './migrations',
    './templates',
    './filters',
    './state/',
    './actions',
    './action_bar',
    './quick_add',
    './data/',
    './ics',
    './csv'
  ];
  const bad = CORE.filter(p => CORE_DISALLOWED.some(pref => p.startsWith(pref)));
  if (bad.length) {
    console.error('[MANIFEST AUDIT] CORE contains disallowed paths:', bad);
    process.exit(1);
  }

  const errors = [];
  if (dups.length) errors.push(['Duplicates:', dups]);
  if (missing.length) errors.push(['Missing or unreachable modules:', missing]);
  if (patchDupes.length) errors.push(['PATCHES duplicates:', patchDupes]);
  if (patchOrderIssues.length) errors.push(['PATCHES out of order:', patchOrderIssues]);

  if (errors.length) {
    console.error('[MANIFEST AUDIT] FAIL');
    for (const [label, list] of errors) {
      console.error(label, list);
    }
    process.exit(2);
  } else {
    console.log('[MANIFEST AUDIT] PASS');
    if (unphased.length) {
      console.warn('Unphased files (warn only):', unphased);
    }
    process.exit(0);
  }
})();
