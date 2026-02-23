import { mergeMatchers, normalizeBasePath, normalizePathname, resolveRoute } from './patterns.js';
import { startRouteHistory } from './history.js';

const globalScope = typeof window !== 'undefined' ? window : null;
const markPerf = (name) => {
  if (typeof performance !== 'undefined' && performance && typeof performance.mark === 'function') {
    try {
      performance.mark(name);
    } catch (_) { }
  }
  try {
    if (globalScope?.console?.info) {
      globalScope.console.info(`[perf] ${name}`);
    }
  } catch (_) { }
};

function getPostPaintSources() {
  if (!globalScope) return [];
  const seen = new Set();
  const rawList = Array.isArray(globalScope.__CRM_POST_FIRST_PAINT_MODULES__)
    ? globalScope.__CRM_POST_FIRST_PAINT_MODULES__
    : [];
  return rawList
    .map((entry) => {
      if (typeof entry !== 'string') return null;
      const trimmed = entry.trim();
      if (!trimmed) return null;
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        return trimmed;
      }
      try {
        const base = globalScope.__CRM_BOOT_BASE__
          ? new URL(globalScope.__CRM_BOOT_BASE__, globalScope.location?.href)
          : new URL('../', import.meta.url);
        return new URL(trimmed, base).href;
      } catch (_) {
        return trimmed;
      }
    })
    .filter((entry) => {
      if (!entry || seen.has(entry)) return false;
      seen.add(entry);
      return true;
    });
}

let postPaintScheduled = false;

function schedulePostFirstPaintModules() {
  if (postPaintScheduled || !globalScope) return;
  postPaintScheduled = true;
  markPerf('crm:first-route-ready');

  const beginPostPaint = () => {
    markPerf('crm:post-first-paint-start');

    const sources = getPostPaintSources();
    if (sources.length === 0) return;

    const loadDeferred = () => {
      sources.forEach((spec) => {
        import(/* @vite-ignore */ spec).catch((error) => {
          try {
            console.error('[router] deferred module failed to load', spec, error);
          } catch (_) { }
        });
      });
    };

    if (typeof globalScope.requestIdleCallback === 'function') {
      globalScope.requestIdleCallback(loadDeferred);
      return;
    }
    globalScope.setTimeout(loadDeferred, 0);
  };

  if (typeof globalScope.requestAnimationFrame === 'function') {
    globalScope.requestAnimationFrame(() => {
      globalScope.requestAnimationFrame(beginPostPaint);
    });
    return;
  }
  beginPostPaint();
}

function ensureDefaultHash() {
  if (typeof window === 'undefined' || !window?.location) return;
  const hash = typeof window.location.hash === 'string' ? window.location.hash.trim() : '';
  if (hash && hash !== '#/' && hash !== '#') return;

  let defaultView = 'labs';
  try {
    // Check local storage for preference, default to Labs if not explicitly 'dashboard'
    const stored = window.localStorage ? window.localStorage.getItem('crm:homeView') : null;
    if (stored === 'dashboard') defaultView = 'dashboard';
  } catch (_) { }

  try {
    window.location.hash = `#/${defaultView}`;
    return;
  } catch (_err) { }
  try {
    const { pathname = '', search = '' } = window.location;
    if (window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `${pathname}${search}#/${defaultView}`);
    }
  } catch (__err) { }
}

ensureDefaultHash();

function deriveBasePaths() {
  const bases = [];

  if (typeof window !== 'undefined' && window) {
    try {
      const hint = window.__CRM_BOOT_BASE__;
      if (typeof hint === 'string' && hint) {
        const url = new URL(hint, window.location ? window.location.href : undefined);
        const idx = url.pathname.lastIndexOf('/js/');
        const path = idx !== -1 ? url.pathname.slice(0, idx + 1) : url.pathname;
        if (path) bases.push(path);
      }
    } catch (_err) { }
  }

  try {
    const rawMeta = typeof import.meta !== 'undefined' && import.meta ? import.meta.url : null;
    if (rawMeta) {
      const meta = new URL(rawMeta, typeof window !== 'undefined' && window.location ? window.location.href : undefined);
      const idx = meta.pathname.indexOf('/js/');
      const path = idx !== -1 ? meta.pathname.slice(0, idx + 1) : meta.pathname;
      if (path) bases.push(path);
    }
  } catch (_err) { }

  if (bases.length === 0) {
    if (typeof window !== 'undefined' && window?.location?.pathname) {
      bases.push(window.location.pathname);
    } else {
      bases.push('/');
    }
  }

  const normalized = bases
    .map((value) => {
      try { return normalizeBasePath(value); }
      catch (_err) { return '/'; }
    })
    .filter((value, index, list) => list.indexOf(value) === index);

  if (!normalized.includes('/')) normalized.push('/');
  return normalized;
}

const BASE_PATHS = deriveBasePaths();
const MATCHERS = mergeMatchers(BASE_PATHS);

function applyRouteFromPath() {
  if (typeof window === 'undefined' || !window?.location) return;
  const { location } = window;
  const currentHash = typeof location.hash === 'string' ? location.hash : '';
  if (currentHash && currentHash !== '#') return;

  const normalizedPath = normalizePathname(location.pathname || '/');
  const match = resolveRoute(normalizedPath, MATCHERS);
  if (!match) return;

  let targetHash = match.hash;
  if (match.preserveSearch && location.search) {
    const query = location.search.startsWith('?') ? location.search : `?${location.search}`;
    targetHash += query;
  }

  if (currentHash === targetHash) return;

  try {
    location.hash = targetHash;
  } catch (_err) {
    try {
      if (window.history && typeof window.history.replaceState === 'function') {
        const title = typeof document !== 'undefined' ? document.title : '';
        window.history.replaceState(null, title, `${location.pathname}${location.search}${targetHash}`);
      }
    } catch (__err) { }
  }
}

applyRouteFromPath();
schedulePostFirstPaintModules();
startRouteHistory();

export { MATCHERS as ROUTER_MATCHERS, applyRouteFromPath };
