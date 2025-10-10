/* Patches Loader → single ordered boot path via boot loader */
import { CORE, PATCHES, REQUIRED } from '../boot/manifest.js';
import { ensureCoreThenPatches } from '../boot/boot_hardener.js';
// future phases:
// import { runPhase } from '../boot/phase_runner.js';

window.CRM = window.CRM || {};
window.CRM.ctx = {
  logger: {
    log: (...args) => console.log('[CRM]', ...args),
    error: (...args) => console.error('[CRM]', ...args),
  },
  env: window.__ENV__ || {},
  featureFlags: window.__FEATURES__ || {},
};

export default ensureCoreThenPatches({ CORE, PATCHES, REQUIRED });
