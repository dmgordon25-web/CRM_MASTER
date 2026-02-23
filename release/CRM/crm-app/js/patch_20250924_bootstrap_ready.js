let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){
  // patch_20250924_bootstrap_ready.js — Ensure first render after DB ready
  if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
  if(window.__INIT_FLAGS__.bootstrap_ready_fix) return; window.__INIT_FLAGS__.bootstrap_ready_fix = true;
  if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_20250924_bootstrap_ready.js')){
    window.__PATCHES_LOADED__.push('/js/patch_20250924_bootstrap_ready.js');
  }

  async function emit(detail){
    const payload = detail || {source:'bootstrap'};
    if(typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(payload);
      return;
    }
    document.dispatchEvent(new CustomEvent('app:data:changed', {detail: payload}));
  }

  async function init(){
    try{
      if(typeof openDB === 'function') await openDB();
    }catch (err) { console && console.warn && console.warn('bootstrap openDB failed', err); }
    await emit({source:'bootstrap'});
  }

  if(document.readyState==='complete' || document.readyState==='interactive'){ init(); }
  else document.addEventListener('DOMContentLoaded', init, {once:true});
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_20250924_bootstrap_ready.init] already wired');
    window.CRM.health['patch_20250924_bootstrap_ready'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_20250924_bootstrap_ready'] = 'ok';
    log('[patch_20250924_bootstrap_ready.init] complete');
  } catch (e) {
    window.CRM.health['patch_20250924_bootstrap_ready'] = 'error';
    error('[patch_20250924_bootstrap_ready.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_20250924_bootstrap_ready'] = window.CRM.modules['patch_20250924_bootstrap_ready'] || {};
window.CRM.modules['patch_20250924_bootstrap_ready'].init = init;
