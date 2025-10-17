const ROUTE_TABLE = Object.freeze({
  dashboard: Object.freeze({ segment: '', hash: '#/dashboard', aliases: ['#/dashboard', '#dashboard'] }),
  partners: Object.freeze({ segment: 'partners', hash: '#/partners', aliases: ['#/partners', '#partners'] }),
  workbench: Object.freeze({ segment: 'workbench', hash: '#workbench', aliases: ['#workbench', '#/workbench'] })
});

const HASH_TO_VIEW = (() => {
  const map = new Map();
  Object.entries(ROUTE_TABLE).forEach(([view, config]) => {
    const aliases = Array.isArray(config.aliases) ? config.aliases : [];
    aliases.forEach((alias) => {
      const key = String(alias || '').trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) map.set(key, view);
    });
    const hash = typeof config.hash === 'string' ? config.hash : '';
    if (hash) {
      const key = hash.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, view);
    }
  });
  return map;
})();

export const ROUTES = ROUTE_TABLE;
export const HASH_ALIAS_MAP = HASH_TO_VIEW;

export function ensureTrailingSlash(base) {
  const raw = typeof base === 'string' ? base.trim() : '';
  if (!raw) return '/';
  if (raw === '/') return '/';
  let normalized = raw;
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\/{2,}/g, '/');
  if (!normalized.endsWith('/')) normalized += '/';
  if (normalized === '//') return '/';
  return normalized;
}

export function computeBasePath() {
  try {
    const hinted = typeof window !== 'undefined' && window && typeof window.__CRM_ROUTER_BASE__ === 'string'
      ? window.__CRM_ROUTER_BASE__
      : null;
    if (hinted) return ensureTrailingSlash(hinted);
  } catch (_) {}

  try {
    const loc = typeof window !== 'undefined' ? window.location : null;
    if (!loc || typeof loc.pathname !== 'string') return '/';
    const path = loc.pathname || '/';
    const lower = path.toLowerCase();
    if (lower === '/crm') return '/crm/';
    if (lower.startsWith('/crm/')) return '/crm/';
  } catch (_) {}

  return '/';
}

function stripBase(pathname, basePath) {
  const rawPath = typeof pathname === 'string' ? pathname : '';
  const normalizedBase = ensureTrailingSlash(basePath);
  if (!rawPath) return '';
  if (normalizedBase === '/') {
    return rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  }
  const lowerPath = rawPath.toLowerCase();
  const lowerBase = normalizedBase.toLowerCase();
  if (lowerPath === lowerBase.slice(0, -1)) return '';
  if (lowerPath.startsWith(lowerBase)) return rawPath.slice(normalizedBase.length);
  if (rawPath.startsWith('/')) return rawPath.slice(1);
  return rawPath;
}

export function viewFromPathname(pathname, basePath = computeBasePath()) {
  try {
    let relative = stripBase(pathname, basePath);
    if (!relative) return 'dashboard';
    relative = relative.replace(/^\/+/, '').replace(/\/+$, '');
    if (!relative) return 'dashboard';
    if (/^index\.html?/i.test(relative)) return 'dashboard';
    const [first] = relative.split('/');
    const key = String(first || '').trim().toLowerCase();
    if (key === 'dashboard') return 'dashboard';
    if (key === 'partners') return 'partners';
    if (key === 'workbench') return 'workbench';
  } catch (_) {}
  return null;
}

export function viewFromHash(hash) {
  if (hash == null) return null;
  const key = String(hash).trim().toLowerCase();
  if (!key) return null;
  return HASH_TO_VIEW.get(key) || null;
}

export function buildPath(basePath, segment) {
  const normalizedBase = ensureTrailingSlash(basePath);
  const cleanSegment = typeof segment === 'string' ? segment.trim() : '';
  if (!cleanSegment) return normalizedBase === '/' ? '/' : normalizedBase;
  if (normalizedBase === '/') return `/${cleanSegment}`;
  return `${normalizedBase}${cleanSegment}`;
}

export function canonicalHash(view) {
  const config = ROUTE_TABLE[view];
  if (!config) return null;
  return typeof config.hash === 'string' ? config.hash : null;
}
