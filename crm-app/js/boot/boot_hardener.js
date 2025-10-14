/* Boot Orchestrator: deterministic, idempotent, with hard fail/success lanes */
const BASE_URL = new URL('../', import.meta.url);

function normalize(spec) {
  if (typeof spec !== 'string') throw new TypeError('invalid module specifier');
  const trimmed = spec.trim();
  if (!trimmed) throw new TypeError('invalid module specifier');
  const rel = (trimmed.startsWith('./') || trimmed.startsWith('../')) ? trimmed : `./${trimmed}`;
  return new URL(rel, BASE_URL).href;
}

async function dynImport(spec) {
  const normalized = normalize(spec.endsWith('.js') || spec.endsWith('.mjs') ? spec : `${spec}.js`);
  return import(normalized);
}

function domRootReady() {
  try {
    return !!(document.querySelector('#app, [data-ui="app-root"], [data-ui="shell"]'));
  } catch (_) {
    return false;
  }
}

function corePrereqsReady() {
  try {
    const w = window;
    return typeof w.openDB === 'function'
      && (w.Selection || w.SelectionService)
      && typeof w.renderAll === 'function'
      && w.Toast && typeof w.Toast.show === 'function'
      && w.Confirm && typeof w.Confirm.show === 'function'
      && domRootReady();
  } catch (_) {
    return false;
  }
}

const originalConsoleError = console.error.bind(console);
console.error = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && first.includes('DOMNodeRemovedFromDocument')) {
    console.warn(...args);
    return;
  }
  originalConsoleError(...args);
};

const timeSource = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
  ? () => performance.now()
  : () => Date.now();
const bootStart = timeSource();
let overlayHiddenAt = null;
let perfPingNoted = false;
let logFallbackNoted = false;

function noteOverlayHidden() {
  if (overlayHiddenAt == null) {
    overlayHiddenAt = timeSource();
  }
}

function logFallback(detail) {
  if (logFallbackNoted) return;
  logFallbackNoted = true;
  const suffix = detail ? ` (${detail})` : '';
  try {
    console.info(`[BOOT] log fallback active${suffix}`);
  } catch (_) {}
}

function applyLogFallback(promise) {
  if (!promise || typeof promise.then !== 'function') return promise;
  return promise.then((response) => {
    try {
      if (response && typeof response.ok === 'boolean' && !response.ok) {
        const status = typeof response.status === 'number' ? `status ${response.status}` : '';
        logFallback(status);
      }
    } catch (_) {}
    return response;
  }, (err) => {
    const detail = err && (err.message || err.name)
      ? `${err.message || err.name}`
      : '';
    logFallback(detail);
    throw err;
  });
}

function shouldWatchLogEndpoint(resource) {
  try {
    if (typeof resource === 'string') {
      return resource.includes('/__log');
    }
    if (resource && typeof resource.url === 'string') {
      return resource.url.includes('/__log');
    }
  } catch (_) {}
  return false;
}

const nativeFetch = (typeof fetch === 'function')
  ? fetch.bind(typeof window !== 'undefined' ? window : globalThis)
  : null;

if (typeof window !== 'undefined' && nativeFetch && !window.__LOG_FETCH_PATCHED__) {
  const patchedFetch = function patchedFetch(resource, init) {
    const promise = nativeFetch(resource, init);
    if (shouldWatchLogEndpoint(resource)) {
      return applyLogFallback(promise);
    }
    return promise;
  };
  try {
    window.fetch = patchedFetch;
    window.__LOG_FETCH_PATCHED__ = true;
  } catch (_) {}
}

const splash = {
  el() { return document.getElementById('diagnostics-splash'); },
  show() { const e = this.el(); if (e) e.style.display = 'block'; },
  hide() {
    const e = this.el();
    if (e) e.style.display = 'none';
    noteOverlayHidden();
  }
};

const postLog = (kind, payload) => {
  if (!nativeFetch) return;
  try {
    const promise = nativeFetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, ts: Date.now(), ...payload })
    });
    applyLogFallback(promise).catch(() => {});
  } catch (err) {
    const detail = err && (err.message || err.name)
      ? `${err.message || err.name}`
      : '';
    logFallback(detail);
  }
};

function truthyFlag(v) {
  const s = String(v || '').toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function isSafeMode() {
  try {
    const q = new URLSearchParams(location.search);
    if (truthyFlag(q.get('safe'))) return true;
  } catch (_) {}
  try {
    if (truthyFlag(localStorage.getItem('SAFE'))) return true;
  } catch (_) {}
  return false;
}

function waitForDomReady() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });
}

function asPromise(result) {
  if (result && typeof result.then === 'function') return result;
  return Promise.resolve(result);
}

async function runProbe(fn) {
  if (typeof fn !== 'function') return false;
  try {
    const outcome = await asPromise(fn());
    return !!outcome;
  } catch (_) {
    return false;
  }
}

async function evaluatePrereqs(records, kind) {
  const extractor = kind === 'hard'
    ? (mod) => mod?.HARD_PREREQS || mod?.CORE_PREREQS || {}
    : (mod) => mod?.SOFT_PREREQS || {};

  for (const { path, module } of records) {
    const checks = extractor(module) || {};
    for (const [name, probe] of Object.entries(checks)) {
      const ok = await runProbe(probe);
      if (!ok) {
        if (kind === 'hard') {
          console.error(`[BOOT] prerequisite missing: ${name} in ${path}`);
          const err = new Error(`prerequisite missing: ${name}`);
          err.path = path;
          err.probe = name;
          throw err;
        } else {
          console.warn(`[BOOT] soft prerequisite incomplete: ${name} in ${path}`);
        }
      }
    }
  }
}

async function loadModules(paths, { fatalOnFailure = true } = {}) {
  const records = [];
  for (const spec of paths || []) {
    try {
      const module = await dynImport(spec);
      records.push({ path: spec, module });
    } catch (err) {
      const detail = String(err?.stack || err);
      if (fatalOnFailure) {
        console.error('[BOOT] import failed:', spec, detail);
        if (err && typeof err === 'object') err.path = spec;
        throw err;
      } else {
        console.warn('[BOOT] optional import failed:', spec, detail);
      }
    }
  }
  return records;
}

function recordFatal(reason, detail) {
  try {
    window.__BOOT_DONE__ = { fatal: true, reason, detail, at: Date.now() };
  } catch (_) {}
  splash.show();
  postLog('boot.fail', { reason, detail });
}

function recordSuccess(meta) {
  try {
    window.__BOOT_DONE__ = { fatal: false, at: Date.now(), ...meta };
  } catch (_) {}
  splash.hide();
  if (!perfPingNoted) {
    const stop = overlayHiddenAt == null ? timeSource() : overlayHiddenAt;
    const elapsed = Math.max(0, Math.round(stop - bootStart));
    try {
      console.info(`[PERF] overlay hidden in ${elapsed}ms`);
    } catch (_) {}
    perfPingNoted = true;
  }
  postLog('boot.success', meta || {});
}

function gatherServiceWaiters(records) {
  const waiters = [];
  for (const { module } of records) {
    const fn = module?.__WHEN_SERVICES_READY;
    if (typeof fn === 'function') {
      waiters.push(() => asPromise(fn()).catch(() => {}));
    }
  }
  return waiters;
}

function maybeRenderAll() {
  try {
    if (typeof window.renderAll === 'function') {
      window.renderAll();
    }
  } catch (err) {
    console.error('[BOOT] renderAll failed:', err);
    throw err;
  }
}

export async function ensureCoreThenPatches({ CORE = [], PATCHES = [], REQUIRED = [] } = {}) {
  const state = { core: [], patches: [], safe: false };
  const requiredSet = new Set(REQUIRED || []);
  splash.show();

  try {
    const coreRecords = await loadModules(CORE, { fatalOnFailure: true });
    state.core = coreRecords.map(({ path }) => path);

    await waitForDomReady();
    await evaluatePrereqs(coreRecords, 'hard');

    let __tries = 0;
    while (!corePrereqsReady() && __tries < 40) {
      await new Promise((r) => setTimeout(r, 50));
      __tries += 1;
    }
    splash.hide();

    const safe = isSafeMode();
    state.safe = safe;

    const patchRecords = safe
      ? []
      : await loadModules(PATCHES, { fatalOnFailure: false });

    if (safe && PATCHES.length) {
      console.warn('[BOOT] SAFE MODE active — skipping patches');
      postLog('boot.safe_mode', {});
    }
    state.patches = patchRecords.map(({ path }) => path);

    maybeRenderAll();

    const waiters = gatherServiceWaiters(coreRecords);
    if (waiters.length) {
      await Promise.all(waiters.map((fn) => fn()));
    }

    await evaluatePrereqs(coreRecords, 'soft');

    recordSuccess({ core: state.core.length, patches: state.patches.length, safe });
    return { reason: 'ok' };
  } catch (err) {
    const reason = (err && typeof err === 'object' && err.path && requiredSet.has(err.path))
      ? 'required_import'
      : 'boot_failure';
    recordFatal(reason, String(err?.stack || err));
    throw err;
  }
}

export const __private = { normalize, dynImport, isSafeMode };
/* End of file */
