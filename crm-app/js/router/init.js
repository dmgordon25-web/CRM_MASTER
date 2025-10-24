import { mergeMatchers, normalizeBasePath, normalizePathname, resolveRoute } from './patterns.js';

function ensureDefaultHash(){
  if(typeof window === 'undefined' || !window?.location) return;
  const hash = typeof window.location.hash === 'string' ? window.location.hash.trim() : '';
  if(hash && hash !== '#/' && hash !== '#') return;
  try{
    window.location.hash = '#/dashboard';
    return;
  }catch (_err){}
  try{
    const { pathname = '', search = '' } = window.location;
    if(window.history && typeof window.history.replaceState === 'function'){
      window.history.replaceState(null, '', `${pathname}${search}#/dashboard`);
    }
  }catch (__err){}
}

ensureDefaultHash();

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

function isWorkbenchHash(hash){
  const normalized = typeof hash === 'string' ? hash.trim().toLowerCase() : '';
  return normalized === '#/workbench' || normalized === '#workbench';
}

function queueWorkbenchMount(){
  if(typeof window === 'undefined') return;
  if(!window.requestAnimationFrame || typeof window.requestAnimationFrame !== 'function'){
    if(queueWorkbenchMount.__pending) return;
    queueWorkbenchMount.__pending = true;
    setTimeout(async () => {
      queueWorkbenchMount.__pending = false;
      await loadWorkbench();
    }, 0);
    return;
  }
  if(queueWorkbenchMount.__pending) return;
  queueWorkbenchMount.__pending = true;
  window.requestAnimationFrame(() => {
    setTimeout(async () => {
      queueWorkbenchMount.__pending = false;
      await loadWorkbench();
    }, 0);
  });
}

async function loadWorkbench(){
  try{
    const mod = await import('../workbench/index.js');
    const root = (typeof document !== 'undefined' && document)
      ? (document.querySelector('#route-root') || document.body)
      : undefined;
    if(mod && typeof mod.mountWorkbench === 'function'){
      await mod.mountWorkbench(root);
    }
    try{ console.info('[VIS] workbench armed (direct)'); }
    catch (_err){}
  }catch (err){
    try{ console.warn('[soft] [router] workbench route failed', err); }
    catch (_err){}
  }
}

function ensureWorkbenchRoute(hash){
  if(!isWorkbenchHash(hash)) return;
  queueWorkbenchMount();
}

if(typeof window !== 'undefined' && window){
  try{ ensureWorkbenchRoute(window.location && window.location.hash); }
  catch (_err){}
  window.addEventListener('hashchange', () => {
    try{ ensureWorkbenchRoute(window.location && window.location.hash); }
    catch (_err){}
  });
}

export { MATCHERS as ROUTER_MATCHERS, applyRouteFromPath };
