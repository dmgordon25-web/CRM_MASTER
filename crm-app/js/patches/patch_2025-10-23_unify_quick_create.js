import { wireQuickAddUnified } from '../ui/quick_add_unified.js';

const FLAG_KEY = 'patch:2025-10-23:unify-quick-create';
const SPEC_ID = '/js/patches/patch_2025-10-23_unify_quick_create.js';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function run() {
  if (window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  if (!window.__PATCHES_LOADED__.includes(SPEC_ID)) {
    window.__PATCHES_LOADED__.push(SPEC_ID);
  }

  const start = () => {
    const invoke = () => {
      try {
        wireQuickAddUnified();
        console.info('[VIS] unified quick add ready');
      } catch (err) {
        console.warn('[VIS] unified quick add wiring failed', err);
      }
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
