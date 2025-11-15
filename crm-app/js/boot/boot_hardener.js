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
let bootAnimationDecisionCache = null;

// Boot contract signals -----------------------------------------------------
// `__BOOT_DONE__` transitions exactly once when the HARD path completes.
// `__BOOT_ANIMATION_COMPLETE__` transitions exactly once when the SOFT path
// (tab animation) either finishes or is bypassed. Both signals dispatch DOM
// events so the splash controller can deterministically react without timers.
const bootCompletionSignal = (() => {
  let resolved = false;
  let payload = null;
  return {
    resolve(nextPayload) {
      if (resolved) {
        return payload;
      }
      payload = nextPayload;
      resolved = true;
      try { window.__BOOT_DONE__ = payload; }
      catch (_) {}
      dispatchBootEvent('boot:done', payload);
      return payload;
    },
    value() {
      return payload;
    },
    isResolved() {
      return resolved;
    }
  };
})();

const animationCompletionSignal = (() => {
  let resolved = false;
  let bypassed = false;
  let at = null;
  return {
    resolve({ bypass = false, reason } = {}) {
      const now = Date.now();
      if (!resolved) {
        resolved = true;
        at = now;
        bypassed = !!bypass;
      } else if (bypass && !bypassed) {
        bypassed = true;
      }
      const payload = { at, bypassed };
      try { window.__BOOT_ANIMATION_COMPLETE__ = payload; }
      catch (_) {}
      dispatchBootEvent('boot:animation-complete', { ...payload, reason });
      return payload;
    },
    value() {
      if (!resolved) return null;
      return { at, bypassed };
    },
    isResolved() {
      return resolved;
    }
  };
})();

const hideSplashOnce = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;
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

function dispatchBootEvent(type, detail) {
  if (!documentRef || typeof documentRef.dispatchEvent !== 'function') {
    return;
  }
  try {
    const event = typeof CustomEvent === 'function'
      ? new CustomEvent(type, { detail })
      : new Event(type);
    documentRef.dispatchEvent(event);
  } catch (err) {
    try {
      const fallback = new Event(type);
      documentRef.dispatchEvent(fallback);
    } catch (_) {}
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

const FALSY_BOOT_VALUES = new Set(['0', 'false', 'no', 'off']);

function interpretBootAnimationValue(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower === 'instant') {
    return { enabled: true, instant: true };
  }
  if (truthyFlag(lower)) {
    return { enabled: true, instant: false };
  }
  if (FALSY_BOOT_VALUES.has(lower)) {
    return { enabled: false, instant: false };
  }
  return null;
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

function getBootAnimationDecision({ safeOverride } = {}) {
  if (bootAnimationDecisionCache) return bootAnimationDecisionCache;

  const safe = typeof safeOverride === 'boolean' ? safeOverride : isSafeMode();
  if (safe) {
    bootAnimationDecisionCache = {
      enabled: false,
      instant: true,
      source: 'safe',
      safe: true,
      reason: 'safe mode'
    };
  } else {
    let resolved = null;
    let source = 'default';

    try {
      const params = new URLSearchParams(location.search);
      if (params.has('bootAnimation')) {
        resolved = interpretBootAnimationValue(params.get('bootAnimation'));
        if (!resolved) {
          resolved = { enabled: false, instant: false };
        }
        source = 'query';
      } else if (params.has('skipBootAnimation')) {
        const rawSkip = params.get('skipBootAnimation');
        const interpretedSkip = interpretBootAnimationValue(rawSkip);
        const skip = interpretedSkip
          ? !!interpretedSkip.enabled
          : truthyFlag(rawSkip);
        resolved = { enabled: !skip, instant: false };
        source = 'legacy';
      }
    } catch (_) {}

    if (!resolved) {
      try {
        const stored = localStorage.getItem('BOOT_ANIMATION');
        const interpreted = interpretBootAnimationValue(stored);
        if (interpreted) {
          resolved = interpreted;
        } else if (stored != null) {
          resolved = { enabled: false, instant: false };
        }
        if (stored != null) {
          source = 'storage';
        }
      } catch (_) {}
    }

    if (!resolved) {
      resolved = { enabled: false, instant: false };
      source = 'default';
    }

    const enabled = !!resolved.enabled;
    const instant = resolved.instant === true;
    const reason = (() => {
      if (source === 'query') {
        return enabled ? 'debug mode' : 'query param';
      }
      if (source === 'storage') {
        return enabled ? 'debug mode' : 'localStorage';
      }
      if (source === 'legacy') {
        return enabled ? 'debug mode' : 'legacy param (skipBootAnimation)';
      }
      return 'default';
    })();

    bootAnimationDecisionCache = {
      enabled,
      instant,
      source,
      safe: false,
      reason
    };
  }

  const decision = bootAnimationDecisionCache;
  const logDetail = decision.reason || (decision.safe ? 'safe mode' : 'default');
  try {
    console.info(`[BOOT] animation: ${decision.enabled ? 'enabled' : 'disabled'} (${logDetail})`);
  } catch (_) {}

  try {
    if (typeof window !== 'undefined') {
      window.__BOOT_ANIMATION_MODE__ = {
        enabled: decision.enabled ? 1 : 0,
        source: decision.source,
        reason: decision.reason,
        safe: decision.safe ? 1 : 0,
        instant: decision.instant ? 1 : 0
      };
    }
  } catch (_) {}

  return decision;
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
  const summary = { fatal: true, reason, detail, at: Date.now() };
  bootCompletionSignal.resolve(summary);
  animationCompletionSignal.resolve({ bypass: true, reason: 'fatal' });
  overlay.show();
  const payload = buildFatalPayload(reason, detail, err);
  finalizeOnce('fatal', payload);
  postLog('boot.fail', { reason, detail });
}

function recordSuccess(meta) {
  bootCompletionSignal.resolve({ fatal: false, at: Date.now(), ...meta });
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

  async function animateTabCycle({ instant = false, decision: explicitDecision } = {}) {
    const decision = explicitDecision || getBootAnimationDecision({});
    const shouldAnimate = !!decision.enabled;
    const useInstant = shouldAnimate ? !!(decision.instant ?? instant) : true;

    const markAnimationComplete = ({ bypass = false, reason } = {}) => {
      animationCompletionSignal.resolve({ bypass, reason });
    };

    // Boot animation with two modes:
    // - Normal mode: Fast but visible initialization sequence (2-3 seconds total)
    // - Instant mode (CI): Minimal delays just enough for lifecycle cleanup
    const TAB_SEQUENCE = ['dashboard', 'longshots', 'pipeline', 'partners', 'contacts', 'calendar', 'reports', 'workbench'];
    const TAB_WAIT_TIMEOUT = instant ? 100 : 200; // Allow time for tab to activate
    const TAB_POST_DELAY = instant ? 30 : 100; // Normal: 100ms quick, CI: 30ms minimal (8×100ms = 800ms)
    const TAB_RETURN_POST_DELAY = instant ? 30 : 100;
    const FINAL_SETTLE_DELAY = instant ? 100 : 200; // Final settling delay

    function wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitFor(predicate, { timeout = 1600, interval = 70 } = {}) {
      const start = Date.now();
      while ((Date.now() - start) < timeout) {
        try {
          if (predicate()) return true;
        } catch (_) {}
        await wait(interval);
      }
      try {
        return !!predicate();
      } catch (_) {
        return false;
      }
    }

    function dispatchSyntheticClick(node, label) {
      if (!node) return;
      const opts = { bubbles: true, cancelable: true, view: typeof window !== 'undefined' ? window : undefined };
      const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const type of events) {
        try {
          const Ctor = type.startsWith('pointer') && typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
          node.dispatchEvent(new Ctor(type, opts));
        } catch (err) {
          try {
            if (documentRef && typeof documentRef.createEvent === 'function') {
              const evt = documentRef.createEvent('MouseEvents');
              evt.initEvent(type === 'click' ? 'click' : 'mousedown', true, true);
              node.dispatchEvent(evt);
            }
          } catch (_) {}
        }
      }
      try { node.focus?.(); }
      catch (_) {}
      try { node.click?.(); }
      catch (err) {
        if (label && console && console.warn) {
          console.warn(`[BOOT_ANIMATION] fallback click failed for ${label}`, err);
        }
      }
    }

    function getActiveTabName() {
      try {
        const activeButton = documentRef?.querySelector('#main-nav button[data-nav].active');
        if (activeButton) {
          const nav = activeButton.getAttribute('data-nav');
          if (nav) return nav.toLowerCase();
        }
      } catch (_) {}
      try {
        const activeMain = documentRef?.querySelector('main[id^="view-"]:not(.hidden)');
        if (activeMain && typeof activeMain.id === 'string') {
          return activeMain.id.replace(/^view-/, '').toLowerCase();
        }
      } catch (_) {}
      return '';
    }

    function getActiveDashboardMode() {
      try {
        const activeBtn = documentRef?.querySelector('[data-dashboard-mode].active');
        if (activeBtn) {
          const value = activeBtn.getAttribute('data-dashboard-mode');
          return value === 'all' ? 'all' : 'today';
        }
      } catch (_) {}
      try {
        const fallback = documentRef?.body?.dataset?.dashboardMode;
        if (fallback) return fallback === 'all' ? 'all' : 'today';
      } catch (_) {}
      return '';
    }

    async function ensureTabActive(tabName, { postDelay = TAB_POST_DELAY } = {}) {
      const target = typeof tabName === 'string' ? tabName.toLowerCase() : '';
      if (!target) return false;
      const button = documentRef?.querySelector(`#main-nav button[data-nav="${target}"]`);
      if (!button) {
        console.warn(`[BOOT_ANIMATION] nav button missing for ${target}`);
        return false;
      }
      if (getActiveTabName() === target) {
        await wait(useInstant ? postDelay : Math.max(140, postDelay));
        return true;
      }
      dispatchSyntheticClick(button, `tab:${target}`);
      const success = await waitFor(() => getActiveTabName() === target, {
        timeout: TAB_WAIT_TIMEOUT,
        interval: 50
      });
      if (!success) {
        console.warn(`[BOOT_ANIMATION] Tab activation timed out for ${target}`);
        return false;
      }
      await wait(useInstant ? postDelay : Math.max(140, postDelay));
      console.info(`[BOOT_ANIMATION] Cycled to ${target}`);
      return true;
    }

    async function ensureDashboardMode(mode, { postDelay = MODE_POST_DELAY } = {}) {
      const normalized = mode === 'all' ? 'all' : 'today';
      const button = documentRef?.querySelector(`[data-dashboard-mode="${normalized}"]`);
      if (!button && typeof window?.setDashboardMode === 'function') {
        window.setDashboardMode(normalized, { force: true, skipPersist: true, skipBus: true });
      }
      if (!button && getActiveDashboardMode() === normalized) {
        await wait(useInstant ? postDelay : Math.max(160, postDelay));
        return true;
      }
      if (!button) {
        console.warn(`[BOOT_ANIMATION] dashboard mode button missing for ${normalized}`);
        return false;
      }
      if (typeof window !== 'undefined' && typeof window.setDashboardMode === 'function') {
        try {
          window.setDashboardMode(normalized, { force: true, skipPersist: true, skipBus: true });
        } catch (_) {}
      } else {
        dispatchSyntheticClick(button, `mode:${normalized}`);
      }
      const success = await waitFor(() => getActiveDashboardMode() === normalized, {
        timeout: MODE_WAIT_TIMEOUT,
        interval: 50
      });
      if (!success) {
        console.warn(`[BOOT_ANIMATION] Dashboard mode did not reach ${normalized}`);
        return false;
      }
      await wait(useInstant ? postDelay : Math.max(160, postDelay));
      console.info(`[BOOT_ANIMATION] Set dashboard mode to: ${normalized}`);
      return true;
    }

    function getAvailablePartners() {
      try {
        const select = documentRef?.querySelector('select[data-filter-key="partner"]');
        if (!select) return [];
        const options = Array.from(select.querySelectorAll('option'));
        return options
          .filter((opt) => opt.value && opt.value !== 'all')
          .map((opt) => ({ id: opt.value, name: opt.textContent.trim() }))
          .slice(0, 2);
      } catch (err) {
        console.warn('[BOOT_ANIMATION] Failed to get partners:', err);
        return [];
      }
    }

    function setPartnerFilter(partnerId) {
      try {
        const select = documentRef?.querySelector('select[data-filter-key="partner"]');
        if (!select) return false;
        select.value = partnerId;
        const event = new Event('change', { bubbles: true });
        select.dispatchEvent(event);
        console.info(`[BOOT_ANIMATION] Set partner filter to: ${partnerId}`);
        return true;
      } catch (err) {
        console.warn(`[BOOT_ANIMATION] Failed to set partner filter to ${partnerId}:`, err);
        return false;
      }
    }

    function waitForDashboardReady() {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn('[BOOT_ANIMATION] Dashboard ready timeout - proceeding anyway');
          resolve();
        }, useInstant ? 200 : 500); // Instant mode: 200ms, normal: 500ms

        const handler = () => {
          clearTimeout(timeout);
          console.info('[BOOT_ANIMATION] Dashboard widgets ready event received');
          resolve();
        };

        if (documentRef) {
          documentRef.addEventListener('dashboard:widgets:ready', handler, { once: true });
        } else {
          clearTimeout(timeout);
          resolve();
        }
      });
    }

    if (!shouldAnimate) {
      try {
        console.info('[BOOT_ANIMATION] Minimal activation (no tab cycling)');
      } catch (_) {}
      try {
        await ensureTabActive('dashboard', { postDelay: 0 });
        if (getActiveDashboardMode() !== 'today') {
          await ensureDashboardMode('today', { postDelay: 0 });
        }
        await waitForDashboardReady();
      } catch (err) {
        console.warn('[BOOT_ANIMATION] Minimal boot activation failed:', err);
      } finally {
        markAnimationComplete({ bypass: true, reason: 'disabled' });
      }
      return;
    }

    try {
      console.info('[BOOT_ANIMATION] Starting OPTIMIZED boot animation sequence');

      // PHASE 1: Cycle through ALL tabs once with ultra-minimal spacing (30ms)
      console.info('[BOOT_ANIMATION] Cycling through all tabs (once each, 30ms intervals)');
      for (const tab of TAB_SEQUENCE) {
        await ensureTabActive(tab, { postDelay: TAB_POST_DELAY });
      }

      // PHASE 2: Return to dashboard
      console.info('[BOOT_ANIMATION] Returning to dashboard');
      await ensureTabActive('dashboard', { postDelay: TAB_RETURN_POST_DELAY });

      // PHASE 3: Wait for dashboard to be ready
      console.info('[BOOT_ANIMATION] Waiting for dashboard to be fully loaded...');
      await waitForDashboardReady();
      await wait(FINAL_SETTLE_DELAY);

      if (typeof window !== 'undefined') {
        window.__BOOT_ANIMATION_COMPLETE__ = true;
      }
      console.info('[BOOT_ANIMATION] OPTIMIZED boot animation sequence complete');
    } catch (err) {
      console.warn('[BOOT_ANIMATION] Animation sequence failed:', err);
    } finally {
      markAnimationComplete({ bypass: false, reason: 'complete' });
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

    const animationDecision = getBootAnimationDecision({ safeOverride: safe });
    await animateTabCycle({ decision: animationDecision });

    recordSuccess({ core: state.core.length, patches: state.patches.length, safe });
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
