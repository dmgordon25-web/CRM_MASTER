// selection_fallback.js — Provide Selection capability if app didn't expose one (PATCHES-only, idempotent)
(function(){
  try {
    if (globalThis.Selection && typeof globalThis.Selection.count === 'function') return; // app already provides it

    // Simple in-memory set synchronized with DOM state
    const ids = new Set();
    const cbs = new Set();
    let selectionType = 'contacts';
    const qRow = () => Array.from(document.querySelectorAll('[data-ui="row"][data-id]'));
    const byId = (id) => document.querySelector('[data-ui="row"][data-id="'+id+'"]');
    const qChecks = () => Array.from(document.querySelectorAll('[data-ui="row-check"]'));

    const coerceType = (hint) => {
      if (!hint) return null;
      const text = String(hint).toLowerCase();
      if (!text) return null;
      if (text.includes('partner')) return 'partners';
      if (text.includes('contact')) return 'contacts';
      return null;
    };

    const detectRowType = (row) => {
      if (!row) return selectionType || 'contacts';
      const dataset = row.dataset || {};
      const hints = [
        dataset.selectionType,
        dataset.selectionScope,
        dataset.scope,
        dataset.type,
        row.getAttribute && row.getAttribute('data-selection-type'),
        row.getAttribute && row.getAttribute('data-selection-scope'),
        row.getAttribute && row.getAttribute('data-type'),
        row.getAttribute && row.getAttribute('data-entity')
      ];
      const host = typeof row.closest === 'function'
        ? row.closest('[data-selection-scope],[data-entity],[data-type],table')
        : null;
      if (host) {
        hints.push(
          host.getAttribute && host.getAttribute('data-selection-scope'),
          host.getAttribute && host.getAttribute('data-selection-type'),
          host.getAttribute && host.getAttribute('data-entity'),
          host.getAttribute && host.getAttribute('data-type')
        );
      }
      for (const hint of hints) {
        const type = coerceType(hint);
        if (type) return type;
      }
      return selectionType || 'contacts';
    };

    const updateSelectionTypeFrom = (row) => {
      const type = detectRowType(row);
      selectionType = type || 'contacts';
    };

    const recalcSelectionType = () => {
      if (!ids.size) {
        selectionType = 'contacts';
        return;
      }
      for (const id of ids) {
        const row = byId(id);
        updateSelectionTypeFrom(row);
        if (selectionType) return;
      }
      selectionType = 'contacts';
    };

    function syncFromDOM(){
      try {
        ids.clear();
        let inferredType = null;
        qRow().forEach(row => { if (row.getAttribute('data-selected') === '1') ids.add(row.getAttribute('data-id')); });
        qChecks().forEach(ch => {
          const row = ch.closest('[data-ui="row"][data-id]'); if (!row) return;
          if (ch.checked) { ids.add(row.getAttribute('data-id')); row.setAttribute('data-selected','1'); }
          else { row.removeAttribute('data-selected'); ids.delete(row.getAttribute('data-id')); }
          if (!inferredType && ch.checked) inferredType = detectRowType(row);
        });
        if (!inferredType && ids.size) {
          const first = ids.values().next().value;
          inferredType = detectRowType(byId(first));
        }
        if (inferredType) selectionType = inferredType;
        else if (!ids.size) selectionType = 'contacts';
        updateMetric(); notify();
      } catch {}
    }

    function updateRow(id, on){
      const row = byId(id); if (!row) return;
      const chk = row.querySelector('[data-ui="row-check"]');
      if (on) {
        ids.add(id);
        row.setAttribute('data-selected','1');
        updateSelectionTypeFrom(row);
        if (chk && !chk.checked) chk.checked = true;
      }
      else {
        ids.delete(id);
        row.removeAttribute('data-selected');
        if (chk && chk.checked) chk.checked = false;
        recalcSelectionType();
      }
    }

    function select(id){ updateRow(String(id), true); updateMetric(); notify(); }
    function deselect(id){ updateRow(String(id), false); updateMetric(); notify(); }
    function toggle(id){
      const k = String(id);
      updateRow(k, !ids.has(k));
      updateMetric(); notify();
    }
    function clear(){
      Array.from(ids).forEach(k => updateRow(k, false));
      updateMetric(); notify();
    }
    function all(){ return Array.from(ids); }
    function count(){ return ids.size; }
    function onChange(fn){ if (typeof fn === 'function') { cbs.add(fn); return ()=>cbs.delete(fn); } }
    function notify(){
      try {
        const payload = { all: all(), count: count(), type: selectionType };
        cbs.forEach(fn => fn(payload));
        if (typeof document !== 'undefined' && document && typeof document.dispatchEvent === 'function') {
          document.dispatchEvent(new CustomEvent('selection:changed', { detail: payload }));
        }
      } catch {}
    }
    function updateMetric(){ try { globalThis.__SEL_COUNT__ = ids.size|0; } catch {} }

    // Attach event delegation to stay in sync when user clicks checkboxes
    function onDoc(e){
      try {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (t.matches && t.matches('[data-ui="row-check"]')) {
          const row = t.closest('[data-ui="row"][data-id]'); if (!row) return;
          const id = row.getAttribute('data-id'); if (!id) return;
          if (t.checked) ids.add(id); else ids.delete(id);
          if (t.checked) row.setAttribute('data-selected','1'); else row.removeAttribute('data-selected');
          updateMetric(); notify();
        }
      } catch {}
    }

    // Initialize once DOM is ready enough
    const init = () => {
      try {
        syncFromDOM();
        document.addEventListener('change', onDoc, true);
        if (!globalThis.Selection) {
          Object.defineProperty(globalThis, 'Selection', {
            value: { select, deselect, toggle, clear, count, all, onChange },
            configurable: false, enumerable: false, writable: false
          });
        }
        try { globalThis.dispatchEvent(new CustomEvent('ui:selection-ready')); } catch {}
      } catch {}
    };
    if (document.readyState === 'complete' || document.readyState === 'interactive') { setTimeout(init, 0); }
    else { document.addEventListener('DOMContentLoaded', init, { once: true }); }
  } catch {}
})();
