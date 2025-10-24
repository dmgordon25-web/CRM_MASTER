import { listQueries, saveQuery } from '../workbench/queries_store.js';

const FLAG = 'patch:2025-10-23:workbench-route';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function boot() {
  if (window.__INIT_FLAGS__[FLAG]) return;
  window.__INIT_FLAGS__[FLAG] = true;
  const spec = '/js/patches/patch_2025-10-23_workbench_route.js';
  if (!window.__PATCHES_LOADED__.includes(spec)) {
    window.__PATCHES_LOADED__.push(spec);
  }

  function postLog(event, data) {
    if (!event) return;
    const payload = JSON.stringify({ event, ...(data && typeof data === 'object' ? data : {}) });
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/__log', blob);
        return;
      }
    } catch (_err) {}
    if (typeof fetch === 'function') {
      try {
        fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      } catch (_err) {}
    }
  }

  function ensureNavVisible() {
    try {
      const btn = document.querySelector('#main-nav [data-nav="workbench"]');
      if (!btn) return;
      btn.classList.remove('hidden');
      btn.removeAttribute('aria-hidden');
    } catch (_err) {}
  }

  function seedExampleQuery() {
    try {
      const items = listQueries();
      if (Array.isArray(items) && items.length) return;
      saveQuery({
        name: 'Active contacts',
        entity: 'contacts',
        definition: "helpers.includes(helpers.lower(row.stage || row.status), 'progress')"
      });
    } catch (err) {
      console.warn('[soft] [workbench] query seed failed', err);
    }
  }

  function overrideLoader() {
    const loadWorkbench = () => import(new URL('../workbench/index.js', import.meta.url).href);
    window.WorkbenchRoute = window.WorkbenchRoute || {};
    window.WorkbenchRoute.load = () => loadWorkbench().catch((err) => {
      console.warn('[soft] [workbench] override load failed; falling back', err);
      return import(new URL('../pages/workbench.js', import.meta.url).href);
    });
  }

  function init() {
    overrideLoader();
    seedExampleQuery();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureNavVisible, { once: true });
    } else {
      ensureNavVisible();
    }
    try { console.info('[VIS] workbench route armed'); }
    catch (_err) {}
    postLog('workbench-route-armed');
  }

  init();
})();
