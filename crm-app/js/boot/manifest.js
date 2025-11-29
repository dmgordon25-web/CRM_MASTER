/* Manifest with relative paths (relative to crm-app/js). Dedupe and phase separation. */
import { normalizeModuleId, isSafeMode } from './boot_hardener.js';

const isNodeRuntime = typeof process !== 'undefined'
  && !!process?.versions?.node
  && process?.release?.name === 'node';

async function loadPatchManifest() {
  if (isNodeRuntime) {
    const [fs, url, path] = await Promise.all([
      import('node:fs'),
      import('node:url'),
      import('node:path')
    ]);
    const manifestPath = path.resolve(
      path.dirname(url.fileURLToPath(import.meta.url)),
      '../../patches/manifest.json'
    );
    try {
      const raw = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      throw new Error(`Failed to read patch manifest at ${manifestPath}: ${detail}`);
    }
  }

  if (typeof fetch === 'function') {
    const manifestUrl = new URL('../../patches/manifest.json', import.meta.url);
    let response;
    try {
      response = await fetch(manifestUrl, {
        cache: 'no-store',
        credentials: 'same-origin'
      });
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      throw new Error(`Failed to request patch manifest (${manifestUrl}): ${detail}`);
    }

    if (!response || !response.ok) {
      const statusText = response && response.statusText ? response.statusText : 'Unknown error';
      const status = response && typeof response.status === 'number' ? response.status : '??';
      throw new Error(`Failed to load patch manifest (${status} ${statusText})`);
    }

    try {
      return await response.json();
    } catch (err) {
      const detail = err && err.message ? err.message : String(err);
      throw new Error(`Invalid JSON in patch manifest (${manifestUrl}): ${detail}`);
    }
  }

  const mod = await import('../../patches/manifest.json', {
    assert: { type: 'json' }
  });
  return mod?.default ?? mod;
}

const patchManifest = await loadPatchManifest();

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
  './core/theme_injector.js',
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
  './print.js',
  // './contacts.js', // Removed to prevent circular dependency boot hang
  './app.js',
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
