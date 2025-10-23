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

export function normalizeModuleId(spec) {
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
  const normalized = normalizeModuleId(spec);
  return import(normalized);
}

const globalScope = (typeof window !== 'undefined')
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : null);
const documentRef = (typeof document !== 'undefined') ? document : null;
const earlyTrap = globalScope && globalScope.__BOOT_EARLY_TRAP__;
let finalizedState = earlyTrap && earlyTrap.state && earlyTrap.state.bootState
  ? String(earlyTrap.state.bootState)
  : null;
let readyFinalizationPromise = null;

function ensureBodyBootAttr(value) {
  if (!documentRef || !documentRef.body) return;
  if (!value) {
    documentRef.body.removeAttribute('data-boot');
    return;
  }
  documentRef.body.setAttribute('data-boot', value);
}

function showOverlayPayload(payload) {
  if (!globalScope) return;
  try {
    if (typeof globalScope.showDiagnosticsOverlay === 'function') {
      globalScope.showDiagnosticsOverlay(payload);
      return;
    }
  } catch (_) {}
  const diagnosticsHost = documentRef && documentRef.getElementById('diagnostics');
  if (diagnosticsHost) {
    try { diagnosticsHost.hidden = false; } catch (_) {}
  }
}

function finalizeOnce(state, payload) {
  if (state !== 'fatal' && state !== 'ready') return;
  if (state === 'fatal') {
    if (finalizedState === 'fatal') return;
    finalizedState = 'fatal';
    if (earlyTrap && typeof earlyTrap.markFatal === 'function') {
      try {
        earlyTrap.markFatal(payload || {});
        return;
      } catch (_) {}
    }
    ensureBodyBootAttr('fatal');
    showOverlayPayload(payload);
    return;
  }

  if (finalizedState === 'fatal' || finalizedState === 'ready') return;
  finalizedState = 'ready';
  if (earlyTrap && typeof earlyTrap.markReady === 'function') {
    try {
      earlyTrap.markReady();
      return;
    } catch (_) {}
  }
  ensureBodyBootAttr('ready');
}

function afterFirstPaint() {
  if (!globalScope || typeof globalScope.requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    globalScope.requestAnimationFrame(() => {
      globalScope.requestAnimationFrame(() => resolve());
    });
  });
}

function scheduleReadyFinalization() {
  if (readyFinalizationPromise) return readyFinalizationPromise;
  readyFinalizationPromise = afterFirstPaint()
    .then(() => finalizeOnce('ready'))
    .catch(() => {});
  return readyFinalizationPromise;
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
let headerImportScheduled = false;

const hideSplashOnce = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    (function(){const el=document.getElementById('boot-splash');if(el){requestAnimationFrame(()=>{el.style.display='none';window.__SPLASH_HIDDEN__=true;console.info('[A_BEACON] splash hidden');});}}());
  };
})();

function finalizeSplashAndHeader() {
  if (headerImportScheduled) return;
  headerImportScheduled = true;
  (function(){ try { window.__SPLASH_SEEN__ = !!document.getElementById('boot-splash'); } catch {} }());
  hideSplashOnce();
  // One-time helper + end-of-boot dynamic import with multiple fallback paths
  if (typeof window.__DYN_LOADER__ === 'undefined') {
    window.__DYN_LOADER__ = 1;
    async function __dynImport(paths){ for(const p of paths){ try{ const m=await import(p); console.info('[A_BEACON] imported',p); return m;}catch(e){ console.info('[A_BEACON] import failed',p); } } }
    requestAnimationFrame(()=>requestAnimationFrame(async()=>{
      const base = import.meta.url;
      const HEAD = ['crm/ui/header_toolbar.js','/js/ui/header_toolbar.js','./ui/header_toolbar.js', new URL('../ui/header_toolbar.js', base).href];
      await __dynImport(HEAD).catch(()=>{});
      console.info('[A_BEACON] attempted header import');
    }));
  }
}

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

const splash = (() => {
  let originalMarkup = null;
  let showingMessage = false;
  let lastMessage = null;

  function el() {
    try {
      return document.getElementById('diagnostics-splash');
    } catch (_) {
      return null;
    }
  }

  function restore(elRef) {
    if (!elRef || originalMarkup == null || !showingMessage) return;
    try { elRef.innerHTML = originalMarkup; }
    catch (_) {}
    showingMessage = false;
    lastMessage = null;
  }

  function applyMessage(elRef, message) {
    if (!elRef || !message) {
      restore(elRef);
      return;
    }
    const text = String(message);
    if (!text) {
      restore(elRef);
      return;
    }
    if (!showingMessage) {
      try { originalMarkup = elRef.innerHTML; }
      catch (_) { originalMarkup = null; }
    }
    if (showingMessage && lastMessage === text) {
      return;
    }
    try {
      elRef.textContent = text;
      showingMessage = true;
      lastMessage = text;
    } catch (_) {
      restore(elRef);
    }
  }

  return {
    el,
    show(message) {
      const element = el();
      if (!element) return;
      applyMessage(element, message);
      try { element.style.display = 'block'; }
      catch (_) {}
    },
    hide() {
      const element = el();
      if (!element) return;
      restore(element);
      try { element.style.display = 'none'; }
      catch (_) {}
      noteOverlayHidden();
    }
  };
})();

const overlay = {
  show(message) {
    splash.show(message);
  },
  hide() { splash.hide(); }
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

export function isSafeMode() {
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
    let normalized = null;
    try {
      normalized = normalizeModuleId(spec);
      const module = await import(normalized);
      records.push({ path: normalized, original: spec, module });
    } catch (err) {
      const detail = String(err?.stack || err);
      if (fatalOnFailure) {
        if (!normalized) {
          try { normalized = normalizeModuleId(spec); }
          catch (_) { normalized = spec; }
        }
        console.error('[BOOT] import failed:', normalized, detail);
        if (err && typeof err === 'object') {
          err.path = normalized;
          err.originalPath = spec;
        }
        throw err;
      } else {
        console.warn('[BOOT] optional import failed:', spec, detail);
      }
    }
  }
  return records;
}

function buildFatalPayload(reason, detail, err) {
  const name = (err && err.name) ? String(err.name) : 'Boot failure';
  const message = (err && err.message)
    ? String(err.message)
    : (reason === 'required_import'
      ? 'Required module failed to load'
      : 'Boot sequence halted');
  const modulePath = (err && err.path) ? String(err.path) : (err && err.originalPath ? String(err.originalPath) : '');
  const moduleInfo = modulePath ? `module: ${modulePath}` : '';
  const detailText = moduleInfo
    ? `${moduleInfo}\n${detail}`
    : detail;
  return {
    kind: reason,
    at: Date.now(),
    name,
    message,
    detail: detailText
  };
}

function recordFatal(reason, detail, err) {
  try {
    window.__BOOT_DONE__ = { fatal: true, reason, detail, at: Date.now() };
  } catch (_) {}
  overlay.show();
  const payload = buildFatalPayload(reason, detail, err);
  finalizeOnce('fatal', payload);
  postLog('boot.fail', { reason, detail });
}

function recordSuccess(meta) {
  try {
    window.__BOOT_DONE__ = { fatal: false, at: Date.now(), ...meta };
  } catch (_) {}
  overlay.hide();
  try { globalScope?.requestAnimationFrame?.(() => { try { globalScope.overlay && typeof overlay.hide === 'function' && overlay.hide(); } catch (_) {} }); } catch (_) {}
  if (!perfPingNoted) {
    const stop = overlayHiddenAt == null ? timeSource() : overlayHiddenAt;
    const elapsed = Math.max(0, Math.round(stop - bootStart));
    try {
      console.info(`[PERF] overlay hidden in ${elapsed}ms`);
    } catch (_) {}
    perfPingNoted = true;
  }
  scheduleReadyFinalization();
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
  const requiredSet = new Set((REQUIRED ? Array.from(REQUIRED) : []).map((value) => {
    try {
      return normalizeModuleId(value);
    } catch (_) {
      return value;
    }
  }));
  try {
    overlay && overlay.show && overlay.show('Loading…');
  } catch (_) {}

  try {
    const coreRecords = await loadModules(CORE, { fatalOnFailure: true });
    state.core = coreRecords.map(({ path }) => path);

    await waitForDomReady();
    await evaluatePrereqs(coreRecords, 'hard');
    overlay.hide();
    const readyPromise = scheduleReadyFinalization();

    const safe = isSafeMode();
    state.safe = safe;
    if (safe) {
      hideSplashOnce();
      finalizeSplashAndHeader();
    }

    if (typeof window !== 'undefined') {
      try {
        const expected = safe
          ? []
          : (PATCHES || []).map((spec) => {
            try { return normalizeModuleId(spec); }
            catch (_) { return spec; }
          });
        window.__EXPECTED_PATCHES__ = expected;
        window.__SAFE_MODE__ = safe ? 1 : 0;
      } catch (_) {}
    }

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

    await readyPromise;

    recordSuccess({ core: state.core.length, patches: state.patches.length, safe });
    hideSplashOnce();
    finalizeSplashAndHeader();
    return { reason: 'ok' };
  } catch (err) {
    const reason = (err && typeof err === 'object' && err.path && requiredSet.has(err.path))
      ? 'required_import'
      : 'boot_failure';
    recordFatal(reason, String(err?.stack || err), err);
    throw err;
  }
}

export const __private = { normalize: normalizeModuleId, dynImport, isSafeMode };
/* End of file */
