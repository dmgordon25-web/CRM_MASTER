import { initActionBarDrag } from '../ui/action_bar.js';

const FLAG_KEY = 'patch:2025-10-23:actionbar-drag';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function boot() {
  if (window.__INIT_FLAGS__[FLAG_KEY]) return;
  // STRICT GUARD: Prevent multiple active instances
  if (window.__PATCH_ACTIONBAR_DRAG_ACTIVE__) return;
  window.__PATCH_ACTIONBAR_DRAG_ACTIVE__ = true;

  window.__INIT_FLAGS__[FLAG_KEY] = true;
  const spec = '/js/patches/patch_2025-10-23_actionbar_drag.js';
  if (!window.__PATCHES_LOADED__.includes(spec)) {
    window.__PATCHES_LOADED__.push(spec);
  }

  function postLog(event, data) {
    const payload = JSON.stringify(Object.assign({ event }, data || {}));
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/__log', blob);
        return;
      } catch (_err) { }
    }
    if (typeof fetch === 'function') {
      try { fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
      catch (_err) { }
    }
  }

  function arm() {
    try {
      // Quarantined: initActionBarDrag();
      console.info('[VIS] action-bar drag quarantined (disabled in patch)');
      postLog('actionbar-drag-quarantined');
    } catch (err) {
      console.warn('[VIS] action-bar drag arm failed', err);
    }
  }

  const start = () => {
    // GUARD: Ensure body exists
    if (!document.body) return;

    const invoke = () => {
      const bar = document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
      if (!bar) return;
      arm();
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(invoke);
    } else {
      invoke();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
