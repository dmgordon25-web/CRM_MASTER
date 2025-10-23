const FLAG_KEY = 'patch:2025-10-23:longshots-search-removed';
const SPEC_ID = '/js/patches/patch_2025-10-23_longshots_search_removed.js';

if (!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
if (!window.__PATCHES_LOADED__) window.__PATCHES_LOADED__ = [];

(function run() {
  if (window.__INIT_FLAGS__[FLAG_KEY]) return;
  window.__INIT_FLAGS__[FLAG_KEY] = true;
  if (!window.__PATCHES_LOADED__.includes(SPEC_ID)) {
    window.__PATCHES_LOADED__.push(SPEC_ID);
  }

  const retireSearch = () => {
    const apply = () => {
      const selectors = [
        'input[data-table-search="#tbl-longshots"]',
        'input[data-table-search="#tbl-status-longshots"]'
      ];
      const affected = [];
      selectors.forEach((selector) => {
        const node = document.querySelector(selector);
        if (!node) return;
        if (node.dataset.tableSearch) {
          node.dataset.legacyTableSearch = node.dataset.tableSearch;
          delete node.dataset.tableSearch;
        }
        node.setAttribute('aria-hidden', 'true');
        node.setAttribute('tabindex', '-1');
        node.style.display = 'none';
        affected.push(node);
      });
      if (affected.length) {
        try { console.info('[VIS] longshots search retired'); }
        catch (_) {}
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(apply);
    } else {
      apply();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', retireSearch, { once: true });
  } else {
    retireSearch();
  }
})();
