
let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){

    if (window.__WIRED_CAL_ICS__) return;
    window.__WIRED_CAL_ICS__ = true;

    const apply = () => {
      if (window.CalendarExports && typeof window.CalendarExports.ensureButtons === 'function'){
        window.CalendarExports.ensureButtons();
      }
    };

    const run = () => { apply(); };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    document.addEventListener('calendar:exports:ready', apply, { once: true });
    window.RenderGuard?.registerHook?.(apply);
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error)||console.error;

  if(__wired){
    log('[patch_2025-10-03_calendar_ics_button.init] already wired');
    window.CRM.health['patch_2025-10-03_calendar_ics_button'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-10-03_calendar_ics_button'] = 'ok';
    log('[patch_2025-10-03_calendar_ics_button.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-10-03_calendar_ics_button'] = 'error';
    error('[patch_2025-10-03_calendar_ics_button.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-10-03_calendar_ics_button'] = window.CRM.modules['patch_2025-10-03_calendar_ics_button'] || {};
window.CRM.modules['patch_2025-10-03_calendar_ics_button'].init = init;

