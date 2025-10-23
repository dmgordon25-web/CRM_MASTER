import { initActionBarDrag } from '../ui/action_bar.js';

const FLAG_KEY = 'patch:2025-10-23:actionbar-drag';
const SPEC_ID = '/js/patches/patch_2025-10-23_actionbar_drag.js';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

function postTelemetry(event) {
  if (!event || typeof event !== 'string') return;
  try {
    const body = JSON.stringify({ event });
    if (typeof navigator !== 'undefined'
      && navigator
      && typeof navigator.sendBeacon === 'function') {
      try {
        if (navigator.sendBeacon('/__log', body)) return;
      } catch (_) {}
    }
    if (typeof fetch === 'function') {
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  } catch (_) {}
}

(function run() {
  if (window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  if (!window.__PATCHES_LOADED__.includes(SPEC_ID)) {
    window.__PATCHES_LOADED__.push(SPEC_ID);
  }
  const arm = () => {
    const invoke = () => {
      const bar = document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
      if (!bar) return;
      initActionBarDrag();
      try { console.info('[VIS] action-bar drag armed'); }
      catch (_) {}
      postTelemetry('actionbar-drag-armed');
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(invoke);
    } else {
      invoke();
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arm, { once: true });
  } else {
    arm();
  }
})();
