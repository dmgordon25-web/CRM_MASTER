/* Node script to validate manifest lists. Exits 0 when OK, 2 on fatal. */
const fs = require('fs'), path = require('path');
const jsRoot = path.resolve(__dirname, '..', 'crm-app', 'js');
const manifestDir = path.join(jsRoot, 'boot');

const canonicalPatchOrder = [
  './patch_20250923_baseline.js',
  './patch_20250924_bootstrap_ready.js',
  './patch_20250926_ctc_actionbar.js',
  './patch_2025-09-26_phase1_pipeline_partners.js',
  './patch_2025-09-26_phase2_automations.js',
  './patch_2025-09-26_phase3_dashboard_reports.js',
  './patch_2025-09-26_phase4_polish_regression.js',
  './patch_2025-09-27_doccenter2.js',
  './patch_2025-09-27_contact_linking_5A.js',
  './patch_2025-09-27_contact_linking_5B.js',
  './patch_2025-09-27_contact_linking_5C.js',
  './patch_2025-09-27_merge_ui.js',
  './patch_2025-09-27_phase6_polish_telemetry.js',
  './patch_2025-09-27_release_prep.js',
  './patch_2025-09-27_masterfix.js',
  './patch_2025-09-27_nth_bundle_and_qa.js',
  './patch_2025-10-02_baseline_ux_cleanup.js',
  './patch_2025-10-02_medium_nice.js',
  './patch_2025-10-03_calendar_ics_button.js',
  './patch_2025-10-03_quick_add_partner.js',
  './patch_2025-10-03_automation_seed.js',
  './contacts_merge.js',
  './contacts_merge_orchestrator.js',
  './pipeline/kanban_dnd.js'
];

function loadManifest() {
  const code = fs.readFileSync(path.join(manifestDir, 'manifest.js'), 'utf8');
  const coreMatch = [...code.matchAll(/CORE\s*=\s*\[(.*?)\]/gs)][0];
  const patchMatch = [...code.matchAll(/PATCHES\s*=\s*\[(.*?)\]/gs)][0];
  if (!coreMatch || !patchMatch) return { core: [], patches: [] };
  const getList = s => (s.match(/'([^']+)'/g) || []).map(x => x.slice(1, -1));
  return { core: getList(coreMatch[1]), patches: getList(patchMatch[1]) };
}

function fileExists(p) {
  const clean = p.startsWith('./') ? p.slice(2) : p;
  return fs.existsSync(path.resolve(jsRoot, clean));
}

(function main(){
  const { core: CORE, patches: PATCHES } = loadManifest();
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

  const all = [...CORE, ...PATCHES];
  const seen = new Set(), dups = [];
  for (const p of all) (seen.has(p) ? dups.push(p) : seen.add(p));
  const missing = all.filter(p => !fileExists(p));

  const patchSeen = new Set();
  const patchDupes = [];
  for (const patch of PATCHES) {
    if (patchSeen.has(patch)) patchDupes.push(patch);
    else patchSeen.add(patch);
  }

  const canonicalIndexMap = new Map(
    canonicalPatchOrder.map((entry, index) => [entry, index])
  );
  const patchOrderIssues = [];
  let canonicalPointer = 0;
  let lastCanonicalPatchIndex = -1;
  for (let i = 0; i < PATCHES.length; i += 1) {
    const patch = PATCHES[i];
    if (!canonicalIndexMap.has(patch)) continue;

    const canonicalIndex = canonicalIndexMap.get(patch);
    if (canonicalIndex === canonicalPointer) {
      canonicalPointer += 1;
      lastCanonicalPatchIndex = i;
      continue;
    }

    if (canonicalIndex > canonicalPointer) {
      const skipped = canonicalPatchOrder.slice(canonicalPointer, canonicalIndex);
      if (skipped.length) {
        patchOrderIssues.push(
          `missing canonical entries before ${patch}: ${skipped.join(', ')}`
        );
      }
      canonicalPointer = canonicalIndex + 1;
      lastCanonicalPatchIndex = i;
      continue;
    }

    patchOrderIssues.push(
      `canonical entry ${patch} appears after later canonical entries`
    );
    lastCanonicalPatchIndex = i;
  }
  if (canonicalPointer < canonicalPatchOrder.length) {
    const missingCanonical = canonicalPatchOrder.slice(canonicalPointer);
    patchOrderIssues.push(`missing canonical entries: ${missingCanonical.join(', ')}`);
  }
  const extraPatches =
    canonicalPointer >= canonicalPatchOrder.length &&
    lastCanonicalPatchIndex < PATCHES.length - 1
      ? PATCHES.slice(lastCanonicalPatchIndex + 1)
      : [];
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

  // Report
  const errors = [];
  if (dups.length) errors.push(['Duplicates:', dups]);
  if (missing.length) errors.push(['Missing:', missing]);
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
    if (extraPatches.length) {
      console.warn('[MANIFEST AUDIT] Extra PATCHES:', extraPatches);
    }
    if (unphased.length) {
      console.warn('Unphased files (warn only):', unphased);
    }
    process.exit(0);
  }
})();
