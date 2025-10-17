import {
  ROUTES,
  HASH_ALIAS_MAP,
  buildPath,
  canonicalHash,
  computeBasePath,
  ensureTrailingSlash,
  viewFromHash,
  viewFromPathname
} from './config.js';

const basePath = ensureTrailingSlash(computeBasePath());

function normalizeHash(hash) {
  if (hash == null) return '';
  const raw = String(hash).trim();
  if (!raw) return '';
  return raw.toLowerCase();
}

function normalizePath(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return '/';
  let normalized = raw.trim();
  if (!normalized) return '/';
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized.toLowerCase();
}

function targetUrlFor(view) {
  const config = ROUTES[view];
  if (!config) return null;
  const loc = typeof window !== 'undefined' ? window.location : null;
  const search = loc && typeof loc.search === 'string' ? loc.search : '';
  const hash = canonicalHash(view);
  const path = buildPath(basePath, config.segment);
  if (!hash) return null;
  return `${path}${search}${hash}`;
}

function currentPathname() {
  try {
    const loc = typeof window !== 'undefined' ? window.location : null;
    if (!loc || typeof loc.pathname !== 'string') return '';
    return loc.pathname;
  } catch (_) {
    return '';
  }
}

function currentHash() {
  try {
    const loc = typeof window !== 'undefined' ? window.location : null;
    if (!loc || typeof loc.hash !== 'string') return '';
    return loc.hash;
  } catch (_) {
    return '';
  }
}

function hashesMatch(current, expected, view) {
  if (current === expected) return true;
  if (view === 'workbench') {
    const normalized = normalizeHash(current);
    if (normalized === '#/workbench') return true;
  }
  return false;
}

function ensureHistoryUrl(view) {
  const target = targetUrlFor(view);
  if (!target) return;
  const loc = typeof window !== 'undefined' ? window.location : null;
  if (!loc) return;
  const expectedHash = canonicalHash(view);
  const desiredPath = buildPath(basePath, ROUTES[view].segment);
  const activePath = currentPathname();
  const activeHash = currentHash();
  const samePath = normalizePath(activePath) === normalizePath(desiredPath);
  const sameHash = hashesMatch(activeHash, expectedHash, view);
  if (samePath && sameHash) return;
  try {
    const history = window.history;
    if (history && typeof history.replaceState === 'function') {
      history.replaceState(null, '', target);
      return;
    }
  } catch (_) {}
  try {
    window.location.replace(target);
    return;
  } catch (_) {}
  try {
    const hash = canonicalHash(view);
    if (hash) loc.hash = hash;
  } catch (_) {}
}

function deriveInitialView() {
  const loc = typeof window !== 'undefined' ? window.location : null;
  if (!loc) return null;
  const activeHash = currentHash();
  const hinted = viewFromHash(activeHash);
  if (hinted) return hinted;
  if (activeHash && normalizeHash(activeHash) === '#') return 'dashboard';
  const pathView = viewFromPathname(loc.pathname, basePath);
  return pathView;
}

function alignInitialUrl() {
  const view = deriveInitialView();
  if (!view) return;
  ensureHistoryUrl(view);
}

function handleViewChanged(event) {
  const detail = event && typeof event === 'object' ? event.detail : null;
  const view = detail && typeof detail.view === 'string'
    ? detail.view
    : (typeof event === 'string' ? event : null);
  if (!view || !ROUTES[view]) return;
  ensureHistoryUrl(view);
}

(function installListeners(){
  alignInitialUrl();
  try {
    if (typeof window !== 'undefined' && window) {
      window.addEventListener('app:view:changed', handleViewChanged);
      window.addEventListener('hashchange', () => {
        const hash = currentHash();
        const mapped = viewFromHash(hash);
        if (!mapped) return;
        ensureHistoryUrl(mapped);
      });
    }
  } catch (_) {}
})();

try {
  if (typeof window !== 'undefined') {
    window.__CRM_ROUTER_BASE__ = basePath;
    window.__CRM_ROUTE_MAP__ = ROUTES;
    window.__CRM_ROUTE_HASHES__ = HASH_ALIAS_MAP;
  }
} catch (_) {}
