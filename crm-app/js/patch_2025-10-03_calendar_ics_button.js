
let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){

    if (window.__WIRED_CAL_ICS__) return;
    window.__WIRED_CAL_ICS__ = true;

    function run() {
      const view = document.getElementById('view-calendar') || document.querySelector('[data-view="calendar"]');
      if (!view) return;
      const existing = view.querySelector('#cal-export-ics,[data-act="calendar:export:ics"],[data-ics-export]');
      if (existing) {
        existing.setAttribute('data-ics-export', '1');
        existing.dataset.act = 'calendar:export:ics';
        return;
      }

      const button = document.createElement('button');
      button.textContent = 'Export .ics';
      button.type = 'button';
      button.id = 'cal-export-ics';
      button.setAttribute('data-ics-export', '1');
      button.dataset.act = 'calendar:export:ics';

      (view.querySelector('header') || view).appendChild(button);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
      run();
    }

    window.RenderGuard?.registerHook?.(run);
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

