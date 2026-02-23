
let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){

    if (window.__WIRED_AUTO_SEED__) return; window.__WIRED_AUTO_SEED__ = true;
    function run(){
      try{
        const Templates = window.Templates || (window.__modules__?.['js/email/templates_store.js']?.Templates);
        if (!Templates) return;
        const items = Templates.list?.() || [];
        if (!items.length){
          Templates.upsert({ name:'Birthday Greeting', subject:'Happy Birthday, {first}!', body:'Hi {first}, just wanted to wish you a happy birthday! – {loName}' }, { silent:true });
          Templates.upsert({ name:'Loan Milestone: CTC', subject:'Clear to Close 🎉', body:'Congrats {first}! You’re clear to close. Next steps… – {loName}' }, { silent:true });
          Templates.upsert({ name:'Post-Funding Check-in', subject:'How’s the new home?', body:'Hi {first}, checking in after closing. Anything you need? – {loName}' }, { silent:true });
        }
      }catch (e) { console.warn('automation seed skipped', e); }
    }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_2025-10-03_automation_seed.init] already wired');
    window.CRM.health['patch_2025-10-03_automation_seed'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-10-03_automation_seed'] = 'ok';
    log('[patch_2025-10-03_automation_seed.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-10-03_automation_seed'] = 'error';
    error('[patch_2025-10-03_automation_seed.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-10-03_automation_seed'] = window.CRM.modules['patch_2025-10-03_automation_seed'] || {};
window.CRM.modules['patch_2025-10-03_automation_seed'].init = init;

