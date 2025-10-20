const ROUTE_TABLE = [
  { segments: ['dashboard'], hash: '#/dashboard' },
  { segments: ['partners'], hash: '#/partners' },
  { segments: ['workbench'], hash: '#workbench' },
  { segments: [], hash: '#/dashboard', allowIndex: true }
];

let warned = false;

function toSegments(path){
  if(typeof path !== 'string') return [];
  return path
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function escapeRegex(value){
  return String(value ?? '')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCanonicalPath(baseSegments, routeSegments){
  const combined = [...baseSegments, ...routeSegments]
    .map((segment) => String(segment || '').trim())
    .filter(Boolean);
  if(combined.length === 0) return '/';
  return `/${combined.join('/')}`;
}

function createFallbackTester(canonical, allowIndex){
  const normalized = canonical === '' ? '/' : canonical;
  if(normalized === '/' || normalized === ''){
    return (path) => typeof path === 'string' && (path === '/' || path === '/index.html');
  }
  const trimmed = normalized.endsWith('/') ? normalized.replace(/\/+$/, '') : normalized;
  const trailing = `${trimmed}/`;
  return (path) => {
    if(typeof path !== 'string' || !path) return false;
    if(path === trimmed || path === trailing) return true;
    if(allowIndex === true && path === `${trimmed}/index.html`){
      return true;
    }
    return path.startsWith(trailing);
  };
}

function compileRouteMatcher(baseSegments, definition){
  const routeSegments = Array.isArray(definition.segments)
    ? definition.segments.map((segment) => String(segment || '').trim()).filter(Boolean)
    : [];
  const allowIndex = definition.allowIndex === true || routeSegments.length === 0;
  const preserveSearch = definition.preserveSearch === true;
  const canonical = buildCanonicalPath(baseSegments, routeSegments);
  const pattern = canonical === '/'
    ? '^(?:/index\\.html)?/?$'
    : `^${escapeRegex(canonical)}${allowIndex ? '(?:/index\\.html)?' : ''}/?$`;
  try{
    const matcher = new RegExp(pattern);
    return {
      hash: definition.hash,
      preserveSearch,
      test(path){
        return typeof path === 'string' && matcher.test(path);
      }
    };
  }catch (err){
    if(!warned && typeof console !== 'undefined' && console && typeof console.warn === 'function'){
      warned = true;
      console.warn('[router] pattern compile failed; using fallback', {
        pattern,
        error: err && err.message ? err.message : err
      });
    }
    return {
      hash: definition.hash,
      preserveSearch,
      test: createFallbackTester(canonical, allowIndex)
    };
  }
}

export function compileRouteTable(basePath){
  const segments = toSegments(basePath);
  return ROUTE_TABLE.map((definition) => compileRouteMatcher(segments, definition));
}

export function normalizePathname(pathname){
  if(typeof pathname !== 'string' || pathname.length === 0) return '/';
  let cleaned = pathname;
  if(!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  try{
    cleaned = decodeURIComponent(cleaned);
  }catch (_err){}
  cleaned = cleaned.replace(/\\/g, '/');
  cleaned = cleaned.replace(/\/+/g, '/');
  if(cleaned.length > 1 && cleaned.endsWith('/')){
    cleaned = cleaned.replace(/\/+$/, '/');
  }
  return cleaned;
}

export function mergeMatchers(basePaths){
  const seen = new Set();
  const result = [];
  basePaths.forEach((base) => {
    const key = String(base || '/');
    if(seen.has(key)) return;
    seen.add(key);
    compileRouteTable(key).forEach((entry) => result.push(entry));
  });
  return result;
}

export function resolveRoute(pathname, matchers){
  if(!Array.isArray(matchers) || matchers.length === 0) return null;
  const target = typeof pathname === 'string' ? pathname : '/';
  for(const entry of matchers){
    try{
      if(entry && typeof entry.test === 'function' && entry.test(target)){
        return {
          hash: entry.hash,
          preserveSearch: entry.preserveSearch === true
        };
      }
    }catch (_err){}
  }
  return null;
}

export function normalizeBasePath(basePath){
  if(typeof basePath !== 'string' || basePath.length === 0) return '/';
  let normalized = basePath;
  if(!normalized.startsWith('/')) normalized = `/${normalized}`;
  normalized = normalized.replace(/\\/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  if(!normalized.endsWith('/')) normalized = `${normalized}/`;
  if(normalized === '//') return '/';
  return normalized;
}
