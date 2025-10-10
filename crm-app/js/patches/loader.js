/* Patches Loader → single ordered boot path via boot loader */
import { CORE, PATCHES, REQUIRED } from '../boot/manifest.js';
import { ensureCoreThenPatches } from '../boot/boot_hardener.js';
import { runPhase, checkContract } from '../boot/phase_runner.js';
import { PHASES, CONTRACTS } from '../boot/phases.js';

// establish global namespace + ctx
window.CRM = window.CRM || {};
window.CRM.ctx = window.CRM.ctx || {
  logger: {
    log: (...a) => console.log('[CRM]', ...a),
    warn: (...a) => console.warn('[CRM]', ...a),
    error: (...a) => console.error('[CRM]', ...a)
  },
  env: window.__ENV__ || {},
  featureFlags: window.__FEATURES__ || {}
};

(async function boot(){
  const coreOut = await ensureCoreThenPatches({ CORE, PATCHES, REQUIRED });
  const ctx = window.CRM.ctx;

  // If CORE failed fatally, ensure the splash is shown by now; stop here.
  if (coreOut && coreOut.reason && coreOut.reason !== 'ok') return;

  // Run SHELL
  const shellRes = await runPhase('SHELL', PHASES.SHELL, ctx, (e) => ctx.logger.log(e));
  const shellContract = checkContract('SHELL', CONTRACTS.SHELL);
  if (!shellContract.ok){
    ctx.logger.error('SHELL contract failed', shellContract.fails);
    const splash = document.getElementById('diagnostics-splash');
    if (splash) splash.style.display = 'block';
  }
  ctx.logger.log('[phase] SHELL complete', { count: shellRes.length, errors: shellRes.filter(r => !r.ok).length });

  // Run FEATURES
  const featureRes = await runPhase('FEATURES', PHASES.FEATURES, ctx, (e) => ctx.logger.log(e));
  const featContract = checkContract('FEATURES', CONTRACTS.FEATURES);
  if (!featContract.ok){
    ctx.logger.warn('FEATURES contract issues', featContract.fails);
  }
  ctx.logger.log('[phase] FEATURES complete', { count: featureRes.length, errors: featureRes.filter(r => !r.ok).length });

  // Optional: final render tick
  if (typeof window.renderAll === 'function'){
    requestAnimationFrame(() => requestAnimationFrame(() => window.renderAll()));
  }
})();
