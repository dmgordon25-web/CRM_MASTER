import { mergeMatchers, normalizeBasePath, normalizePathname, resolveRoute } from './patterns.js';
import { initSettingsAvatarRoute } from '../settings/index.js';

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

function installWorkbenchRoute(){
  if(typeof window === 'undefined') return;
  let armed = false;
  const matches = (hash) => {
    const value = String(hash || '').trim().toLowerCase();
    return value === '#/workbench' || value === '#workbench';
  };
  const handle = () => {
    if(!window || !window.location) return;
    if(!matches(window.location.hash)) return;
    if(armed) return;
    armed = true;
    requestAnimationFrame(() => setTimeout(async () => {
      try{
        const mod = await import('../workbench/index.js');
        const root = document.querySelector('#route-root') || document.body;
        await mod.mountWorkbench(root);
        console.info('[VIS] workbench armed (lazy)');
      }catch (err){
        console.warn('[soft] [workbench] lazy mount failed', err);
        armed = false;
      }
    }, 0));
  };
  window.addEventListener('hashchange', handle);
  handle();
}

installWorkbenchRoute();
initSettingsAvatarRoute();

export { MATCHERS as ROUTER_MATCHERS, applyRouteFromPath };
