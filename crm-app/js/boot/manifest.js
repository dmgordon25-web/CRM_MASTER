/* Manifest with relative paths (relative to crm-app/js). Dedupe and phase separation. */
import patchManifest from '../../patches/manifest.json' assert { type: 'json' };
import { normalizeModuleId, isSafeMode } from './boot_hardener.js';

const rawPatchList = Array.isArray(patchManifest?.patches)
  ? patchManifest.patches
  : (Array.isArray(patchManifest) ? patchManifest : null);

if (!Array.isArray(rawPatchList)) {
  throw new Error('Invalid patch manifest: expected an array or { patches: [] }');
}

const PATCH_LIST = rawPatchList.map((spec) => {
  if (typeof spec !== 'string') {
    throw new TypeError('Invalid patch manifest entry; expected string');
  }
  const trimmed = spec.trim();
  if (!trimmed) {
    throw new Error('Invalid patch manifest entry; empty string');
  }
  return trimmed;
});

export const CORE = [
  './env.js',
  './db.js',
  './core/renderGuard.js',
  './services/selection.js',
  './utils.js',
  './render.js',
  './db_compat.js',
  './ical.js',
  './presets.js',
  '../seed_data_inline.js',
  './seed_data.js',
  './ui_shims.js',
  './header_ui.js',
  './email/merge_vars.js',
  './contact_stage_tracker.js',
  './commissions.js',
  './post_funding.js',
  './qa.js',
  './bulk_log.js',
  './print.js',
  './app.js',
  './settings_forms.js',
  './compose.js',
  './services/pipelineStages.js',
  './services/softDelete.js',
  './pipeline/stages.js',
  './pages/workbench.js',
  './pages/email_templates.js',
  './pages/notifications.js',
  './boot/contracts/services.js',
  './boot/phases.js'
];

export const PATCHES = Object.freeze([...PATCH_LIST]);

export const patches = PATCHES;

export const SAFE_MODE = isSafeMode();

export const ACTIVE_PATCHES = SAFE_MODE ? [] : PATCHES;

const pickSpec = (list, suffix) => list.find((entry) => entry.endsWith(suffix)) ?? `./${suffix}`;

const REQUIRED_MODULES = [
  pickSpec(CORE, 'env.js'),
  pickSpec(CORE, 'db.js'),
  pickSpec(CORE, 'utils.js'),
  pickSpec(CORE, 'render.js'),
  pickSpec(PATCHES, 'ui/Toast.js'),
  pickSpec(PATCHES, 'ui/Confirm.js')
];

export const REQUIRED = new Set(REQUIRED_MODULES.map((spec) => {
  try {
    return normalizeModuleId(spec);
  } catch (_) {
    return spec;
  }
}));

export { normalizeModuleId, isSafeMode };
