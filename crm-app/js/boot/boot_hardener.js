/* Boot hardener: resolves imports relative to this file and enforces a core contract. */
const baseUrl = new URL('.', import.meta.url);
const toUrl = p => new URL(p, baseUrl).href;

function ensureTelemetry() {
  const w = window;
  w.__PATCHES_LOADED__ = Array.isArray(w.__PATCHES_LOADED__) ? w.__PATCHES_LOADED__ : [];
  w.__PATCHES_FAILED__ = Array.isArray(w.__PATCHES_FAILED__) ? w.__PATCHES_FAILED__ : [];
  w.__BOOT_LOGS__ = Array.isArray(w.__BOOT_LOGS__) ? w.__BOOT_LOGS__ : [];
}

function corePrereqsReady() {
  const w = window;
  return typeof w.openDB === 'function'
    && (w.Selection || w.SelectionService)
    && typeof w.$ === 'function'
    && typeof w.renderAll === 'function'
    && w.Toast && typeof w.Toast.show === 'function'
    && w.Confirm && typeof w.Confirm.show === 'function';
}

function isSafeMode() {
  try {
    const q = new URLSearchParams(location.search);
    const param = (q.get('safe') || '').toLowerCase();
    const local = (localStorage.getItem('SAFE') || '').toLowerCase();
    return ['1','true','yes'].includes(param) || ['1','true','yes'].includes(local);
  } catch { return false; }
}

function canonicalPatchId(p) {
  if (!p) return p;
  if (p.startsWith('../')) return `/js/${p.slice(3)}`;
  if (p.startsWith('./')) return `/js/${p.slice(2)}`;
  return p.startsWith('/') ? p : `/js/${p}`;
}

async function importOne(path, state, kind) {
  if (!path) return;
  const phase = kind || 'core';
  try {
    await import(toUrl(path));
    const id = phase === 'patch' ? canonicalPatchId(path) : path;
    state.loaded.push(id);
    if (phase === 'patch') {
      if (!window.__PATCHES_LOADED__.includes(id)) window.__PATCHES_LOADED__.push(id);
    }
  } catch (err) {
    const id = phase === 'patch' ? canonicalPatchId(path) : path;
    const info = { path: id, err: String(err?.stack || err) };
    state.failed.push(info);
    if (phase === 'patch') {
      window.__PATCHES_FAILED__.push(info);
    }
    if (state.required.has(path) || state.required.has(id)) state.fatal = true;
  }
}

async function importAll(list, state, phase) {
  for (const p of list) { /* preserve order to reduce surprises */
    // eslint-disable-next-line no-await-in-loop
    await importOne(p, state, phase);
    if (state.fatal) break;
  }
}

function postLog(kind, payload) {
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ts: Date.now(), payload })
    }).catch(() => {});
  } catch {}
}

function showDiagnosticsSplash(state) {
  const w = window;
  w.__DIAG__ = w.__DIAG__ || { visible: false, events: [] };
  w.__DIAG__.visible = true;
  w.__DIAG__.events.push({ ts: Date.now(), kind: 'boot', state });
  const el = document.getElementById('diagnostics-splash');
  if (el) el.style.display = 'block';
  postLog('boot.fail', state);
}

function hideDiagnosticsSplash() {
  const el = document.getElementById('diagnostics-splash');
  if (el) el.style.display = 'none';
}

try {
  window.hideDiagnostics = window.hideDiagnostics || hideDiagnosticsSplash;
} catch {}

export async function ensureCoreThenPatches(manifest = {}) {
  if (window.__BOOT_HARDENER_PROMISE__) return window.__BOOT_HARDENER_PROMISE__;
  window.__BOOT_HARDENER_PROMISE__ = (async () => {
    ensureTelemetry();
    const w = window;

    const CORE = Array.isArray(manifest.CORE) ? manifest.CORE : [];
    const PATCHES = Array.isArray(manifest.PATCHES) ? manifest.PATCHES : [];
    const REQUIRED = manifest.REQUIRED instanceof Set || Array.isArray(manifest.REQUIRED)
      ? new Set(manifest.REQUIRED)
      : new Set();

    const state = {
      loaded: [],
      failed: [],
      fatal: false,
      required: REQUIRED
    };

    // Core pass (with one retry if prereqs not ready yet)
    await importAll(CORE, state, 'core');
    if (!corePrereqsReady() && !state.fatal) {
      await importAll(CORE, state, 'core');
    }

    if (!corePrereqsReady() || state.fatal) {
      state.fatal = true;
      state.reason = 'fatal';
      const summary = {
        loaded: state.loaded.slice(),
        failed: state.failed.map(f => ({ ...f })),
        fatal: true,
        reason: 'fatal',
        required: Array.from(state.required)
      };
      w.__BOOT_DONE__ = summary;
      showDiagnosticsSplash(summary);
      postLog('boot.contract_miss', { prereqs: corePrereqsReady() });
      return summary;
    }

    if (!isSafeMode() && PATCHES && PATCHES.length) {
      await importAll(PATCHES, state, 'patch');
    }

    state.reason = state.fatal ? 'fatal' : 'ok';
    const summary = {
      loaded: state.loaded.slice(),
      failed: state.failed.map(f => ({ ...f })),
      fatal: state.fatal,
      reason: state.reason,
      required: Array.from(state.required)
    };
    w.__BOOT_DONE__ = summary;

    const cleanupSplash = () => {
      try {
        const el = document.getElementById('diagnostics-splash');
        if (el) el.style.display = 'none';
      } catch {}
    };

    if (!state.fatal) {
      requestAnimationFrame(() => {
        cleanupSplash();
        try {
          if (typeof w.renderAll === 'function') {
            w.renderAll();
          }
          // mark explicit success for later checks
          w.__BOOT_DONE__.success = true;
        } catch (err) {
          console.error('RenderAll failed:', err);
          postLog('boot.render_fail', { err: String(err.stack || err) });
          showDiagnosticsSplash(state);
        }
      });
    } else {
      showDiagnosticsSplash(state);
    }

    return summary;
  })();
  return window.__BOOT_HARDENER_PROMISE__;
}

export const __private = { toUrl, corePrereqsReady };
