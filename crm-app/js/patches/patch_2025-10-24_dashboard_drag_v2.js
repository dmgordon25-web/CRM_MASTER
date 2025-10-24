import initDashboardLayout, {
  setDashboardLayoutMode,
  applyDashboardHidden,
  readStoredLayoutMode,
  readStoredHiddenIds,
  getDashboardListenerCount,
} from '../ui/dashboard_layout.js';
import '../settings/dashboard_prefs.js';

const FLAG_KEY = 'patch:2025-10-24:dashboard-drag-v2';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function boot() {
  if (window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  const spec = '/js/patches/patch_2025-10-24_dashboard_drag_v2.js';
  if (!window.__PATCHES_LOADED__.includes(spec)) window.__PATCHES_LOADED__.push(spec);

  function postLog(event, data) {
    const payload = JSON.stringify(Object.assign({ event }, data || {}));
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/__log', blob);
        return;
      } catch (_err) {}
    }
    if (typeof fetch === 'function') {
      try {
        fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      } catch (_err) {}
    }
  }

  function applyStoredPreferences() {
    const hiddenIds = readStoredHiddenIds().map(String);
    applyDashboardHidden(new Set(hiddenIds), { persist: false });
    const mode = !!readStoredLayoutMode();
    setDashboardLayoutMode(mode, { persist: false, force: true });
  }

  function handleLayoutMode(evt) {
    const enabled = !!(evt && evt.detail && (typeof evt.detail.enabled !== 'undefined' ? evt.detail.enabled : evt.detail));
    setDashboardLayoutMode(enabled, { persist: false, force: true });
  }

  function handleHiddenChange(evt) {
    const hidden = evt && evt.detail && Array.isArray(evt.detail.hidden)
      ? evt.detail.hidden
      : null;
    if (!hidden) return;
    applyDashboardHidden(new Set(hidden.map(String)), { persist: false });
  }

  function whenSplashHidden(fn) {
    if (window.__SPLASH_HIDDEN__ || typeof document === 'undefined') {
      fn();
      return;
    }
    const target = document.getElementById('boot-splash') || document.getElementById('diagnostics-splash');
    if (!target || typeof MutationObserver !== 'function') {
      requestAnimationFrame(fn);
      return;
    }
    const observer = new MutationObserver(() => {
      const hidden = window.__SPLASH_HIDDEN__
        || target.hidden === true
        || target.style.display === 'none'
        || target.getAttribute('data-state') === 'hidden'
        || target.getAttribute('data-overlay-hidden') === '1';
      if (hidden) {
        observer.disconnect();
        fn();
      }
    });
    observer.observe(target, { attributes: true, attributeFilter: ['style', 'hidden', 'data-state', 'data-overlay-hidden'] });
  }

  function start() {
    try {
      initDashboardLayout();
      applyStoredPreferences();
      document.addEventListener('dashboard:layout-mode', handleLayoutMode);
      document.addEventListener('dashboard:hidden-change', handleHiddenChange);
      const listeners = getDashboardListenerCount();
      console.info('[VIS] dashboard drag v2 armed');
      postLog('dash-drag-v2-armed', { listeners });
    } catch (err) {
      console.warn('[VIS] dashboard drag v2 failed', err);
    }
  }

  whenSplashHidden(() => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  });
})();
