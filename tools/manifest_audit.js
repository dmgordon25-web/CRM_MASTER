/* Node script to validate manifest lists. Exits 0 when OK, 2 on fatal. */
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', 'crm-app', 'js', 'boot');

function loadManifest() {
  const code = fs.readFileSync(path.join(root, 'manifest.js'), 'utf8');
  const coreMatch = [...code.matchAll(/CORE\s*=\s*\[(.*?)\]/gs)][0];
  const patchMatch = [...code.matchAll(/PATCHES\s*=\s*\[(.*?)\]/gs)][0];
  if (!coreMatch || !patchMatch) return { core: [], patches: [] };
  const getList = s => (s.match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
  return { core: getList(coreMatch[1]), patches: getList(patchMatch[1]) };
}

function fileExists(p) { return fs.existsSync(path.resolve(root, p)); }

(function main(){
  const { core, patches } = loadManifest();
  const all = [...core, ...patches];
  const seen = new Set(), dups = [];
  for (const p of all) (seen.has(p) ? dups.push(p) : seen.add(p));
  const missing = all.filter(p => !fileExists(p));
  // Crawl js folder for unphased files (warn only)
  const jsRoot = path.resolve(__dirname, '..', 'crm-app', 'js');
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
  const allJs = walk(jsRoot).map(p => path.relative(path.join(jsRoot, 'boot'), p).replace(/\\/g, '/'));
  const phList = new Set(all);
  const unphased = allJs
    .filter(p => !p.startsWith('boot/'))
    .map(p => (p.startsWith('../') ? p : '../' + p))
    .filter(p => !phList.has(p));

  // Report
  if (dups.length || missing.length) {
    console.error('[MANIFEST AUDIT] FAIL');
    if (dups.length) console.error('Duplicates:', dups);
    if (missing.length) console.error('Missing:', missing);
    process.exit(2);
  } else {
    console.log('[MANIFEST AUDIT] PASS');
    if (unphased.length) {
      console.warn('Unphased files (warn only):', unphased);
    }
    process.exit(0);
  }
})();
