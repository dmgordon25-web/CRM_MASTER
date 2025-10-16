/* Boot Orchestrator: deterministic, idempotent, with hard fail/success lanes */
const BOOT_BASE_HINT = (typeof window !== 'undefined')
  ? window.__CRM_BOOT_BASE__
  : null;

const BASE_URL = (() => {
  if (BOOT_BASE_HINT) {
    try {
      return new URL(BOOT_BASE_HINT);
    } catch (_) {
      try { return new URL(BOOT_BASE_HINT, import.meta.url); } catch (__) {}
    }
  }
  return new URL('../', import.meta.url);
})();

const APP_BASE_URL = (() => {
  try { return new URL('../', BASE_URL); } catch (_) { return BASE_URL; }
})();

const LOG_ENDPOINT = (() => {
  try { return new URL('__log', APP_BASE_URL); } catch (_) { return null; }
})();

const SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function normalize(spec) {
  if (typeof spec !== 'string') throw new TypeError('invalid module specifier');
  const trimmed = spec.trim();
  if (!trimmed) throw new TypeError('invalid module specifier');

  const withExt = (trimmed.endsWith('.js') || trimmed.endsWith('.mjs'))
    ? trimmed
    : `${trimmed}.js`;

  if (SCHEME_RE.test(withExt)) {
    return withExt;
  }

  if (withExt.startsWith('//')) {
    try { return new URL(withExt, APP_BASE_URL).href; } catch (_) { return withExt; }
  }

  if (withExt.startsWith('./') || withExt.startsWith('../')) {
    return new URL(withExt, BASE_URL).href;
  }

  if (withExt.startsWith('/')) {
    try { return new URL(`.${withExt}`, APP_BASE_URL).href; } catch (_) { return withExt; }
  }

  return withExt;
}

async function dynImport(spec) {
  const normalized = normalize(spec);
  return import(normalized);
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
let fatalBlockEl = null;
let fatalSummaryEl = null;
let fatalDetailEl = null;

const FATAL_DETAIL_MAX_LEN = 1800;

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

const LOG_ENDPOINT_HREF = LOG_ENDPOINT ? LOG_ENDPOINT.href : null;
const LOG_ENDPOINT_PATH = LOG_ENDPOINT ? LOG_ENDPOINT.pathname : null;

function matchesLogEndpoint(candidate) {
  if (!LOG_ENDPOINT) return false;
  try {
    const url = new URL(candidate, APP_BASE_URL);
    return url.href === LOG_ENDPOINT_HREF || url.pathname === LOG_ENDPOINT_PATH;
  } catch (_) {
    return candidate === LOG_ENDPOINT_HREF || candidate === LOG_ENDPOINT_PATH;
  }
}

function shouldWatchLogEndpoint(resource) {
  if (!LOG_ENDPOINT) return false;
  try {
    if (typeof resource === 'string') {
      return matchesLogEndpoint(resource);
    }
    if (resource && typeof resource.url === 'string') {
      return matchesLogEndpoint(resource.url);
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

function resetFatalElements() {
  if (!fatalBlockEl) return;
  try { fatalBlockEl.style.display = 'none'; } catch (_) {}
  try { fatalBlockEl.removeAttribute('data-state'); } catch (_) {}
  if (fatalSummaryEl) {
    try { fatalSummaryEl.textContent = ''; } catch (_) {}
  }
  if (fatalDetailEl) {
    try { fatalDetailEl.textContent = ''; } catch (_) {}
    try { fatalDetailEl.style.display = 'none'; } catch (_) {}
  }
}

function ensureFatalElements(root) {
  if (!root) return null;
  if (fatalBlockEl && fatalBlockEl.isConnected) return fatalBlockEl;
  const doc = root.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const block = doc.createElement('section');
  block.setAttribute('data-role', 'boot-fatal');
  block.style.marginTop = '16px';
  block.style.padding = '14px';
  block.style.borderRadius = '8px';
  block.style.background = 'rgba(15, 23, 42, 0.75)';
  block.style.border = '1px solid rgba(248, 113, 113, 0.65)';
  block.style.fontFamily = "var(--font-mono, Menlo, monospace)";
  block.style.fontSize = '12px';
  block.style.lineHeight = '1.45';
  block.style.whiteSpace = 'pre-wrap';
  block.style.wordBreak = 'break-word';

  const summary = doc.createElement('div');
  summary.setAttribute('data-role', 'boot-fatal-summary');
  summary.style.marginBottom = '8px';
  summary.style.fontWeight = '700';
  summary.style.color = '#fecaca';

  const detail = doc.createElement('pre');
  detail.setAttribute('data-role', 'boot-fatal-detail');
  detail.style.margin = '0';
  detail.style.whiteSpace = 'pre-wrap';
  detail.style.wordBreak = 'break-word';
  detail.style.background = 'rgba(15, 23, 42, 0.8)';
  detail.style.borderRadius = '6px';
  detail.style.padding = '10px';
  detail.style.maxHeight = '320px';
  detail.style.overflow = 'auto';
  detail.style.display = 'none';

  block.appendChild(summary);
  block.appendChild(detail);
  root.appendChild(block);

  fatalBlockEl = block;
  fatalSummaryEl = summary;
  fatalDetailEl = detail;
  return fatalBlockEl;
}

function applyFatalElements(root, meta) {
  const block = ensureFatalElements(root);
  if (!block) return;
  try { block.style.display = 'block'; } catch (_) {}
  try { block.setAttribute('data-state', 'fatal'); } catch (_) {}
  if (fatalSummaryEl) {
    try { fatalSummaryEl.textContent = meta.summary || ''; } catch (_) {}
  }
  if (fatalDetailEl) {
    const detailText = meta.detail ? String(meta.detail) : '';
    if (detailText) {
      const trimmed = detailText.length > FATAL_DETAIL_MAX_LEN
        ? `${detailText.slice(0, FATAL_DETAIL_MAX_LEN)}...`
        : detailText;
      try { fatalDetailEl.textContent = trimmed; } catch (_) {}
      try { fatalDetailEl.style.display = 'block'; } catch (_) {}
    } else {
      try { fatalDetailEl.textContent = ''; } catch (_) {}
      try { fatalDetailEl.style.display = 'none'; } catch (_) {}
    }
  }
}

const splash = {
  el() { return document.getElementById('diagnostics-splash'); },
  clearFatal(target) {
    const el = target || this.el();
    if (!el) return;
    resetFatalElements();
    try { el.removeAttribute('role'); } catch (_) {}
    try { el.removeAttribute('aria-live'); } catch (_) {}
    try {
      if (el.dataset) {
        if (el.dataset.state === 'fatal') delete el.dataset.state;
        delete el.dataset.reason;
        delete el.dataset.path;
        delete el.dataset.probe;
      }
    } catch (_) {}
    try {
      if (typeof document !== 'undefined' && document && document.body && document.body.dataset) {
        delete document.body.dataset.bootFatal;
      }
    } catch (_) {}
    try {
      if (typeof document !== 'undefined' && document && document.documentElement && document.documentElement.dataset) {
        delete document.documentElement.dataset.bootState;
      }
    } catch (_) {}
  },
  show() {
    const e = this.el();
    if (!e) return;
    try { e.style.display = 'block'; } catch (_) {}
    try { e.hidden = false; } catch (_) {}
    try { e.style.visibility = 'visible'; } catch (_) {}
    try { e.style.opacity = ''; } catch (_) {}
    try {
      if (e.dataset && e.dataset.state !== 'fatal') e.dataset.state = 'visible';
    } catch (_) {}
  },
  hide() {
    const e = this.el();
    if (e) {
      this.clearFatal(e);
      try { e.style.display = 'none'; } catch (_) {}
      try { e.hidden = true; } catch (_) {}
      try { if (e.dataset) e.dataset.state = 'hidden'; } catch (_) {}
      try { e.style.visibility = 'hidden'; } catch (_) {}
      try { e.style.opacity = '0'; } catch (_) {}
    }
    noteOverlayHidden();
  },
  renderFatal(meta = {}) {
    const e = this.el();
    if (!e) return;
    this.show();
    this.clearFatal(e);
    try { if (e.dataset) e.dataset.state = 'fatal'; } catch (_) {}
    try { if (e.dataset && meta.reason) e.dataset.reason = meta.reason; } catch (_) {}
    try { if (e.dataset && meta.path) e.dataset.path = meta.path; } catch (_) {}
    try { if (e.dataset && meta.probe) e.dataset.probe = meta.probe; } catch (_) {}
    try { e.setAttribute('role', 'alert'); } catch (_) {}
    try { e.setAttribute('aria-live', 'assertive'); } catch (_) {}
    try { e.hidden = false; } catch (_) {}
    try { e.style.visibility = 'visible'; } catch (_) {}
    try { e.style.opacity = '1'; } catch (_) {}
    try { e.style.display = 'block'; } catch (_) {}
    try {
      if (typeof document !== 'undefined' && document && document.body && document.body.dataset) {
        document.body.dataset.bootFatal = '1';
      }
    } catch (_) {}
    try {
      if (typeof document !== 'undefined' && document && document.documentElement && document.documentElement.dataset) {
        document.documentElement.dataset.bootState = 'fatal';
      }
    } catch (_) {}
    applyFatalElements(e, meta);
  }
};

const postLog = (kind, payload) => {
  if (!nativeFetch || !LOG_ENDPOINT) return;
  try {
    const promise = nativeFetch(LOG_ENDPOINT_HREF, {
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

async function evaluatePrereqs(records, kind, overridesByPath = null) {
  const extractor = kind === 'hard'
    ? (mod) => mod?.HARD_PREREQS || mod?.CORE_PREREQS || {}
    : (mod) => mod?.SOFT_PREREQS || {};

  const hardOverrides = kind === 'hard' && overridesByPath && typeof overridesByPath === 'object'
    ? overridesByPath
    : null;

  for (const { path, module } of records) {
    const overrideChecks = hardOverrides && Object.prototype.hasOwnProperty.call(hardOverrides, path)
      ? hardOverrides[path]
      : null;
    const overrideEntries = (overrideChecks && typeof overrideChecks === 'object')
      ? Object.entries(overrideChecks)
      : [];
    const baseEntries = Object.entries(extractor(module) || {});
    const combined = overrideEntries.length
      ? overrideEntries.concat(baseEntries)
      : baseEntries;

    for (const [name, probe] of combined) {
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

function formatFatalSummary(reason, meta = {}) {
  if (meta && typeof meta.summary === 'string' && meta.summary.trim()) {
    return meta.summary.trim();
  }
  const required = meta.required === true || reason === 'required_failure';
  const path = meta.path ? String(meta.path) : '';
  const probe = meta.probe ? String(meta.probe) : '';
  const base = required
    ? 'Fatal boot failure — required module unavailable.'
    : 'Boot failure — core prerequisite missing.';
  const fragments = [];
  if (path) fragments.push(path);
  if (probe) fragments.push(`probe: ${probe}`);
  if (fragments.length) {
    return `${base} (${fragments.join(' · ')})`;
  }
  return base;
}

function emitBootFatal(payload) {
  if (typeof window === 'undefined') return;
  try {
    if (typeof window.dispatchEvent === 'function') {
      if (typeof CustomEvent === 'function') {
        const evt = new CustomEvent('crm:boot:fatal', { detail: payload });
        window.dispatchEvent(evt);
      } else if (typeof document !== 'undefined' && document && typeof document.createEvent === 'function') {
        const evt = document.createEvent('CustomEvent');
        evt.initCustomEvent('crm:boot:fatal', false, false, payload);
        window.dispatchEvent(evt);
      }
    }
  } catch (_) {}
}

function recordFatal(reason, detail, meta = {}) {
  const summary = formatFatalSummary(reason, meta);
  const payload = { fatal: true, reason, detail, summary, at: Date.now(), ...meta };
  try {
    window.__BOOT_DONE__ = payload;
    window.__BOOT_FATAL__ = true;
    window.__BOOT_FATAL_DETAIL__ = payload;
  } catch (_) {}
  splash.renderFatal({ ...meta, reason, detail, summary });
  postLog('boot.fail', { reason, detail, summary, ...meta });
  emitBootFatal(payload);
}

function recordSuccess(meta) {
  const payload = { fatal: false, at: Date.now(), ...meta };
  try {
    window.__BOOT_DONE__ = payload;
    window.__BOOT_FATAL__ = false;
    try { delete window.__BOOT_FATAL_DETAIL__; } catch (_) {}
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
  const hardPrereqOverrides = (CORE && typeof CORE === 'object' && CORE.PREREQS && typeof CORE.PREREQS === 'object')
    ? CORE.PREREQS
    : null;
  splash.show();

  try {
    const coreRecords = await loadModules(CORE, { fatalOnFailure: true });
    state.core = coreRecords.map(({ path }) => path);

    await waitForDomReady();
    await evaluatePrereqs(coreRecords, 'hard', hardPrereqOverrides);
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
    const failingPath = (err && typeof err === 'object' && typeof err.path === 'string')
      ? err.path
      : null;
    const required = !!(failingPath && requiredSet.has(failingPath));
    const reason = required
      ? 'required_failure'
      : 'boot_failure';
    const detail = String(err?.stack || err);
    const meta = {
      path: failingPath,
      probe: err?.probe || null,
      required
    };
    recordFatal(reason, detail, meta);
    return { reason, fatal: true, path: failingPath, probe: meta.probe, detail, required };
  }
}

export const __private = { normalize, dynImport, isSafeMode };
/* End of file */
