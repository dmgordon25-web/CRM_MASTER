// Legacy partner quick add modal removed in favor of /js/ui/quick_add_unified.js.
export {};

let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){
  if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_2025-10-03_quick_add_partner.js')){
    window.__PATCHES_LOADED__.push('/js/patch_2025-10-03_quick_add_partner.js');
  }
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error)||console.error;

  if(__wired){
    log('[patch_2025-10-03_quick_add_partner.init] already wired');
    window.CRM.health['patch_2025-10-03_quick_add_partner'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-10-03_quick_add_partner'] = 'ok';
    log('[patch_2025-10-03_quick_add_partner.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-10-03_quick_add_partner'] = 'error';
    error('[patch_2025-10-03_quick_add_partner.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-10-03_quick_add_partner'] = window.CRM.modules['patch_2025-10-03_quick_add_partner'] || {};
window.CRM.modules['patch_2025-10-03_quick_add_partner'].init = init;

