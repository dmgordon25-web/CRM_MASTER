import initDashboardLayout, {
  setDashboardLayoutMode,
  applyDashboardHidden,
  readStoredLayoutMode,
  readStoredHiddenIds,
  reapplyDashboardLayout
} from '../ui/dashboard_layout.js';
import '../settings/dashboard_prefs.js';

const FLAG_KEY = 'patch:2025-10-23:dashboard-drag-fix';

if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if(!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function boot(){
  if(window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  const spec = '/js/patches/patch_2025-10-23_dashboard_drag_fix.js';
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

  function applyFromStorage(){
    const hiddenIds = readStoredHiddenIds().map(String);
    applyDashboardHidden(new Set(hiddenIds), { persist: false });
    const mode = !!readStoredLayoutMode();
    setDashboardLayoutMode(mode, { persist: false, force: true });
  }

  function handleLayoutMode(evt){
    const enabled = !!(evt && evt.detail && typeof evt.detail.enabled !== 'undefined'
      ? evt.detail.enabled
      : evt?.detail);
    setDashboardLayoutMode(enabled, { persist: false, force: true });
  }

  function handleHiddenChange(evt){
    const hidden = evt && evt.detail && Array.isArray(evt.detail.hidden)
      ? evt.detail.hidden
      : null;
    if(!hidden) return;
    const next = new Set(hidden.map(String));
    applyDashboardHidden(next, { persist: false });
  }

  function handleHashChange(){
    const hash = typeof window.location?.hash === 'string' ? window.location.hash : '';
    if(hash === '#/dashboard' || hash.startsWith('#/dashboard?')){
      reapplyDashboardLayout('route');
    }
  }

  function handleViewChange(evt){
    const view = evt && evt.detail ? evt.detail.view : undefined;
    if(view === 'dashboard'){
      reapplyDashboardLayout('view');
    }
  }

  function arm(){
    try{
      initDashboardLayout();
      applyFromStorage();
      document.addEventListener('dashboard:layout-mode', handleLayoutMode);
      document.addEventListener('dashboard:hidden-change', handleHiddenChange);
      window.addEventListener('hashchange', handleHashChange);
      document.addEventListener('app:view:changed', handleViewChange);
      handleHashChange();
      console.info('[VIS] dashboard drag+prefs armed');
      postLog('dash-drag-armed');
    }catch (err){
      console.warn('[VIS] dashboard drag+prefs failed', err);
    }
  }

  const start = () => {
    if(typeof requestAnimationFrame === 'function'){
      requestAnimationFrame(arm);
    }else{
      arm();
    }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start, { once: true });
  }else{
    start();
  }
})();
