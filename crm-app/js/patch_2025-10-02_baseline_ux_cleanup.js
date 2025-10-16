const doc = typeof document !== 'undefined' ? document : null;

function resolveElement(target){
  if(!doc) return null;
  if(!target) return null;
  if(typeof target === 'string'){
    try{ return doc.querySelector(target); }
    catch (_err) { return null; }
  }
  if(typeof Element !== 'undefined' && target instanceof Element) return target;
  if(typeof target === 'object' && target.nodeType === 1) return target;
  return null;
}

export function hide(target){
  const el = resolveElement(target);
  if(!el) return;
  el.hidden = true;
  el.setAttribute('aria-hidden', 'true');
  if(el.style){
    el.style.display = 'none';
  }
}

export function setDisabled(target, off){
  const el = resolveElement(target);
  if(!el) return;
  const disabled = Boolean(off);
  if(disabled){
    el.setAttribute('disabled', '');
  }else{
    el.removeAttribute('disabled');
  }
  el.setAttribute('aria-disabled', String(disabled));
}

export function debounce(fn, wait = 150){
  let timer = null;
  return function debounced(...args){
    if(timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}

export function resolveElements(selectors){
  if(!doc) return [];
  const list = Array.isArray(selectors) ? selectors : [selectors];
  return list
    .map(sel => resolveElement(sel))
    .filter(Boolean);
}

export function doubleRaf(callback){
  const raf = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : null;
  const run = typeof callback === 'function' ? callback : ()=>{};
  if(raf){
    raf(() => raf(run));
  }else{
    setTimeout(run, 32);
  }
}

let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){
  if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_2025-10-02_baseline_ux_cleanup.js')){
    window.__PATCHES_LOADED__.push('/js/patch_2025-10-02_baseline_ux_cleanup.js');
  }
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_2025-10-02_baseline_ux_cleanup.init] already wired');
    window.CRM.health['patch_2025-10-02_baseline_ux_cleanup'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-10-02_baseline_ux_cleanup'] = 'ok';
    log('[patch_2025-10-02_baseline_ux_cleanup.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-10-02_baseline_ux_cleanup'] = 'error';
    error('[patch_2025-10-02_baseline_ux_cleanup.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-10-02_baseline_ux_cleanup'] = window.CRM.modules['patch_2025-10-02_baseline_ux_cleanup'] || {};
window.CRM.modules['patch_2025-10-02_baseline_ux_cleanup'].init = init;
