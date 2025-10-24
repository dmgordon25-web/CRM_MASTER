import initDashboardLayout, { requestDashboardLayoutPass } from '../ui/dashboard_layout.js';

const FLAG_KEY = 'patch:2025-10-24:dashboard-drag-v2';

if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if(!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function boot(){
  if(window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  const spec = '/js/patches/patch_2025-10-24_dashboard_drag_v2.js';
  if(!window.__PATCHES_LOADED__.includes(spec)){
    window.__PATCHES_LOADED__.push(spec);
  }

  function postLog(event, data){
    const payload = JSON.stringify(Object.assign({ event }, data || {}));
    if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
      try{
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/__log', blob);
        return;
      }catch (_err){}
    }
    if(typeof fetch === 'function'){
      try{ fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
      catch (_err){}
    }
  }

  function arm(){
    try{
      initDashboardLayout();
      requestDashboardLayoutPass({ reason: 'arm' });
      console.info('[VIS] dashboard drag v2 armed');
      postLog('dash-drag-v2-armed');
    }catch (err){
      console.warn('[VIS] dashboard drag v2 failed', err);
    }
  }

  const start = () => {
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(arm);
      return;
    }
    arm();
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }else{
    start();
  }
})();
