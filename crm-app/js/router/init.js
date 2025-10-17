import { mergeMatchers, normalizeBasePath, normalizePathname, resolveRoute } from './patterns.js';

function deriveBasePaths(){
  const bases = [];

  if(typeof window !== 'undefined' && window){
    try{
      const hint = window.__CRM_BOOT_BASE__;
      if(typeof hint === 'string' && hint){
        const url = new URL(hint, window.location ? window.location.href : undefined);
        const idx = url.pathname.lastIndexOf('/js/');
        const path = idx !== -1 ? url.pathname.slice(0, idx + 1) : url.pathname;
        if(path) bases.push(path);
      }
    }catch (_err){}
  }

  try{
    const rawMeta = typeof import.meta !== 'undefined' && import.meta ? import.meta.url : null;
    if(rawMeta){
      const meta = new URL(rawMeta, typeof window !== 'undefined' && window.location ? window.location.href : undefined);
      const idx = meta.pathname.indexOf('/js/');
      const path = idx !== -1 ? meta.pathname.slice(0, idx + 1) : meta.pathname;
      if(path) bases.push(path);
    }
  }catch (_err){}

  if(bases.length === 0){
    if(typeof window !== 'undefined' && window?.location?.pathname){
      bases.push(window.location.pathname);
    }else{
      bases.push('/');
    }
  }

  const normalized = bases
    .map((value) => {
      try{ return normalizeBasePath(value); }
      catch (_err){ return '/'; }
    })
    .filter((value, index, list) => list.indexOf(value) === index);

  if(!normalized.includes('/')) normalized.push('/');
  return normalized;
}

const BASE_PATHS = deriveBasePaths();
const MATCHERS = mergeMatchers(BASE_PATHS);

function applyRouteFromPath(){
  if(typeof window === 'undefined' || !window?.location) return;
  const { location } = window;
  const currentHash = typeof location.hash === 'string' ? location.hash : '';
  if(currentHash && currentHash !== '#') return;

  const normalizedPath = normalizePathname(location.pathname || '/');
  const match = resolveRoute(normalizedPath, MATCHERS);
  if(!match) return;

  let targetHash = match.hash;
  if(match.preserveSearch && location.search){
    const query = location.search.startsWith('?') ? location.search : `?${location.search}`;
    targetHash += query;
  }

  if(currentHash === targetHash) return;

  try{
    location.hash = targetHash;
  }catch (_err){
    try{
      if(window.history && typeof window.history.replaceState === 'function'){
        const title = typeof document !== 'undefined' ? document.title : '';
        window.history.replaceState(null, title, `${location.pathname}${location.search}${targetHash}`);
      }
    }catch (__err){}
  }
}

applyRouteFromPath();

export { MATCHERS as ROUTER_MATCHERS, applyRouteFromPath };
