/* Boot Orchestrator: deterministic, idempotent, with hard fail/success lanes */
const BASE_URL = new URL('./', import.meta.url);
function normalizePath(p) {
  if (typeof p !== 'string') throw new TypeError('invalid module specifier');
  let clean = p.trim();
  if (!clean) throw new TypeError('invalid module specifier');
  if (!clean.endsWith('.js') && !clean.endsWith('.mjs')) clean = `${clean}.js`;
  if (clean.startsWith('js/')) clean = `../${clean}`;
  if (!clean.startsWith('./') && !clean.startsWith('../')) clean = `./${clean}`;
  return new URL(clean, BASE_URL).href;
}
async function importModule(p) {
  return import(normalizePath(p));
}

// Basic utilities
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const postLog = (kind, payload) => {
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ts: Date.now(), ...payload })
    }).catch(()=>{});
  } catch (e) {}
};

const splash = {
  el() { return document.getElementById('diagnostics-splash'); },
  show() { const e = this.el(); if (e) e.style.display = 'block'; },
  hide() { const e = this.el(); if (e) e.style.display = 'none'; }
};

function truthyFlag(v) {
  const s = String(v || '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function isSafeMode() {
  try {
    const q = new URLSearchParams(location.search);
    return truthyFlag(q.get('safe')) || truthyFlag(localStorage.getItem('SAFE'));
  } catch (e) { return false; }
}

function corePrereqsReady(w) {
  return typeof w.openDB === 'function'
    && (w.Selection || w.SelectionService)
    && typeof w.$ === 'function'
    && typeof w.renderAll === 'function'
    && w.Toast && typeof w.Toast.show === 'function'
    && w.Confirm && typeof w.Confirm.show === 'function';
}

async function importList(list, state, options = {}) {
  const { checkPrereqs = false } = options;
  for (const p of (list || [])) {
    try {
      const mod = await importModule(p);
      if (checkPrereqs) await ensurePrereqs(mod);
      state.loaded.push(p);
    } catch (err) {
      const msg = String(err?.stack || err);
      console.error('[BOOT] import failed:', p, msg);
      state.failed.push({ path: p, err: msg });
      if (state.required.has(p)) state.fatal = true;
      if (state.fatal) break;
    }
  }
}

async function ensurePrereqs(mod) {
  const checks = mod?.CORE_PREREQS || mod?.CONTRACTS || {};
  for (const [_name, probe] of Object.entries(checks)) {
    try {
      const ok = typeof probe === 'function' ? await probe() : !!probe;
      if (!ok) throw new Error('prerequisite missing');
    } catch {
      throw new Error('prerequisite missing');
    }
  }
}

function finalizeSuccess(state) {
  const w = window;
  w.__BOOT_DONE__ = { ...state, fatal: false, success: true };
  // Multiple redundant hide paths to prevent overlay “stickiness”
  const hideAll = () => splash.hide();
  // 1) Hide immediately after we finish
  hideAll();
  // 2) Hide on the next two frames
  requestAnimationFrame(()=>requestAnimationFrame(hideAll));
  // 3) Hide on window load (late assets)
  window.addEventListener('load', hideAll, { once: true });
  // 4) Hide with a fallback timeout
  setTimeout(hideAll, 800);
  postLog('boot.success', { loaded: state.loaded.length, failed: state.failed.length });
}

function finalizeFail(state, why='contract') {
  const w = window;
  w.__BOOT_DONE__ = { ...state, fatal: true, why };
  splash.show();
  postLog('boot.fail', { why, state });
}

export async function ensureCoreThenPatches({ CORE, PATCHES, REQUIRED }) {
  const w = window;
  const state = {
    loaded: [],
    failed: [],
    fatal: false,
    required: new Set(REQUIRED || []),
    started: Date.now(),
  };

  // Always start with splash shown (early_trap may already have done this)
  splash.show();

  // CORE phase with one retry (settle racey globals without looping)
  if (document.readyState === 'loading') {
    await new Promise(res => document.addEventListener('DOMContentLoaded', res, { once: true }));
  }

  await importList(CORE, state, { checkPrereqs: true });
  if (!corePrereqsReady(w) && !state.fatal) {
    await sleep(60);
    await importList(CORE, state, { checkPrereqs: true });
  }
  if (!corePrereqsReady(w) || state.fatal) {
    const lastFailure = state.failed[state.failed.length - 1] || null;
    const modPath = lastFailure?.path || '(unknown module)';
    const err = lastFailure?.err || '(prerequisite missing)';
    console.error('[BOOT] core prerequisites missing or required import failed:', modPath, err);
    return finalizeFail(state, 'core_prereqs');
  }

  // PATCHES phase (skip only when Safe Mode explicitly requested)
  const safe = isSafeMode();
  state.safe = safe;
  if (!safe && (PATCHES?.length)) {
    await importList(PATCHES, state);
    if (state.fatal) return finalizeFail(state, 'patch_required');
  } else if (safe) {
    console.warn('[BOOT] SAFE MODE active — skipping patches');
    postLog('boot.safe_mode', {});
  }

  // RENDER phase – if render throws, we treat that as fatal
  try {
    if (typeof w.renderAll === 'function') w.renderAll();
  } catch (err) {
    console.error('[BOOT] renderAll failed:', err);
    state.failed.push({ path: 'renderAll()', err: String(err?.stack || err) });
    return finalizeFail(state, 'render');
  }

  // READY
  finalizeSuccess(state);
}

// For diagnostics and e2e sanity checks
export const __private = { normalizePath, corePrereqsReady, isSafeMode };
/* End of file */
