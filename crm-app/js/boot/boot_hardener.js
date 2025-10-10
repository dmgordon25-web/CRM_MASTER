/* Boot Orchestrator: deterministic, idempotent, with hard fail/success lanes */
const baseUrl = new URL('.', import.meta.url);
const toUrl = (p) => new URL(p, baseUrl).href;

// Basic utilities
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const postLog = (kind, payload) => {
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ts: Date.now(), ...payload })
    }).catch(()=>{});
  } catch {}
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
  } catch { return false; }
}

function corePrereqsReady(w) {
  return typeof w.openDB === 'function'
    && (w.Selection || w.SelectionService)
    && typeof w.$ === 'function'
    && typeof w.renderAll === 'function'
    && w.Toast && typeof w.Toast.show === 'function'
    && w.Confirm && typeof w.Confirm.show === 'function';
}

async function importList(list, state) {
  for (const p of (list || [])) {
    try {
      await import(toUrl(p));
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
  await importList(CORE, state);
  if (!corePrereqsReady(w) && !state.fatal) {
    await sleep(60);
    await importList(CORE, state);
  }
  if (!corePrereqsReady(w) || state.fatal) {
    console.error('[BOOT] core prerequisites missing or required import failed');
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
export const __private = { toUrl, corePrereqsReady, isSafeMode };
/* End of file */
