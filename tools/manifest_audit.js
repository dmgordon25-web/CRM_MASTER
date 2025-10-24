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
  // Order rationale: feature polish → bundle/QA → fixes → final prep. Keep in lockstep with crm-app/js/boot/manifest.js.
  './patch_2025-09-27_phase6_polish_telemetry.js',
  './patch_2025-09-27_nth_bundle_and_qa.js',
  './patch_2025-09-27_masterfix.js',
  './patches/polish_overlay_ready.js',
  './patch_2025-09-27_release_prep.js',
  './patch_2025-10-02_baseline_ux_cleanup.js',
  './patch_2025-10-02_medium_nice.js',
  './patch_2025-10-03_calendar_ics_button.js',
  './patch_2025-10-03_quick_add_partner.js',
  './patch_2025-10-03_automation_seed.js',
  './patches/patch_2025-10-23_dashboard_drag.js',
  './contacts_merge.js',
  './contacts_merge_orchestrator.js',
  './pipeline/kanban_dnd.js',
  './patches/patch_2025-10-23_session_beacon.js',
  './patches/patch_2025-10-23_unify_quick_create.js',
  './patches/patch_2025-10-23_dashboard_drag_fix.js',
  './patches/patch_2025-10-23_actionbar_drag.js',
  './patches/patch_2025-10-23_calendar_contact_and_task.js',
  './patches/patch_2025-10-24_longshots_cleanup.js'
  './patches/patch_2025-10-24_quickadd_header_only.js'
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

  const patchOrderIssues = [];
  for (let i = 0; i < canonicalPatchOrder.length; i += 1) {
    const expected = canonicalPatchOrder[i];
    const actual = PATCHES[i];
    if (actual === undefined) {
      patchOrderIssues.push(`index ${i}: expected ${expected} but manifest ended`);
      continue;
    }
    if (actual !== expected) {
      const foundAt = PATCHES.indexOf(expected);
      if (foundAt === -1) {
        patchOrderIssues.push(`index ${i}: expected ${expected} but found ${actual} (missing expected entry)`);
      } else {
        patchOrderIssues.push(`index ${i}: expected ${expected} but found ${actual} (expected entry currently at index ${foundAt})`);
      }
    }
  }
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
