// selection_adapter.js — bridge legacy SelectionService/Store to Selection capability (PATCHES phase)
(function(){
  try {
    if (globalThis.__SELECTION_ADAPTER_INSTALLED__) return;
    Object.defineProperty(globalThis, '__SELECTION_ADAPTER_INSTALLED__', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    const emitReady = () => {
      try { globalThis.dispatchEvent(new CustomEvent('ui:selection-ready')); } catch {}
    };

    const existing = globalThis.Selection;
    if (existing && typeof existing.count === 'function') {
      try { globalThis.__SEL_COUNT__ = existing.count() | 0; } catch {}
      emitReady();
      return;
    }

    const svc = globalThis.SelectionService;
    if (!svc || typeof svc !== 'object') return;

    function toArray(value){
      if (!value) return [];
      if (Array.isArray(value)) return value.map(String);
      if (value instanceof Set) return Array.from(value).map(String);
      if (typeof value.forEach === 'function') {
        const out = [];
        try { value.forEach((entry) => out.push(String(entry))); }
        catch {}
        return out;
      }
      return [];
    }

    function readIds(){
      try {
        if (typeof svc.getIds === 'function') return toArray(svc.getIds());
      } catch {}
      try {
        if (typeof svc.getSelectedIds === 'function') return toArray(svc.getSelectedIds());
      } catch {}
      try {
        if (svc.ids != null) return toArray(svc.ids);
      } catch {}
      return [];
    }

    function applyList(list, type){
      const next = Array.isArray(list) ? list.map(String).filter(Boolean) : [];
      const targetType = typeof type === 'string' && type ? type : (typeof svc.type === 'string' ? svc.type : undefined);
      if (typeof svc.set === 'function') {
        try { svc.set(next, targetType); return; } catch {}
      }
      if (typeof svc.clear === 'function') {
        try { svc.clear(targetType); } catch {}
      }
      if (typeof svc.add === 'function') {
        next.forEach((id) => {
          try { svc.add(id, targetType); } catch {}
        });
        return;
      }
      if (typeof svc.toggle === 'function') {
        const current = new Set(readIds());
        const desired = new Set(next);
        current.forEach((id) => {
          if (!desired.has(id)) {
            try { svc.toggle(id, targetType); } catch {}
          }
        });
        desired.forEach((id) => {
          if (!current.has(id)) {
            try { svc.toggle(id, targetType); } catch {}
          }
        });
      }
    }

    function count(){
      try {
        if (typeof svc.count === 'function') return Number(svc.count()) || 0;
      } catch {}
      try {
        if (typeof svc.size === 'function') return Number(svc.size()) || 0;
      } catch {}
      const ids = readIds();
      return Array.isArray(ids) ? ids.length : 0;
    }

    function all(){
      return readIds();
    }

    function updateMetric(){
      try { globalThis.__SEL_COUNT__ = count() | 0; } catch {}
    }

    function select(id, type){
      const key = id == null ? '' : String(id);
      if (!key) return;
      if (typeof svc.add === 'function') {
        try { svc.add(key, type); updateMetric(); return; } catch {}
      }
      if (typeof svc.toggle === 'function') {
        const ids = new Set(readIds());
        if (!ids.has(key)) {
          try { svc.toggle(key, type); updateMetric(); return; } catch {}
        }
      }
      const ids = readIds();
      if (!ids.includes(key)) {
        ids.push(key);
        applyList(ids, type);
        updateMetric();
      }
    }

    function deselect(id){
      const key = id == null ? '' : String(id);
      if (!key) return;
      if (typeof svc.remove === 'function') {
        try { svc.remove(key); updateMetric(); return; } catch {}
      }
      if (typeof svc.del === 'function') {
        try { svc.del(key); updateMetric(); return; } catch {}
      }
      if (typeof svc.toggle === 'function') {
        const ids = new Set(readIds());
        if (ids.has(key)) {
          try { svc.toggle(key); updateMetric(); return; } catch {}
        }
      }
      const ids = readIds().filter((candidate) => candidate !== key);
      applyList(ids);
      updateMetric();
    }

    function toggle(id, type){
      const key = id == null ? '' : String(id);
      if (!key) return;
      if (typeof svc.toggle === 'function') {
        try { svc.toggle(key, type); updateMetric(); return; } catch {}
      }
      const ids = new Set(readIds());
      if (ids.has(key)) ids.delete(key); else ids.add(key);
      applyList(Array.from(ids), type);
      updateMetric();
    }

    function clear(){
      if (typeof svc.clear === 'function') {
        try { svc.clear(); updateMetric(); return; } catch {}
      }
      applyList([]);
      updateMetric();
    }

    function onChange(fn){
      if (typeof fn !== 'function') return () => {};
      if (typeof svc.onChange === 'function') {
        try {
          const off = svc.onChange(() => {
            try { fn({ all: all(), count: count() }); } catch {}
          });
          return typeof off === 'function' ? off : () => {};
        } catch {}
      }
      if (typeof svc.subscribe === 'function') {
        try {
          const off = svc.subscribe(() => {
            try { fn({ all: all(), count: count() }); } catch {}
          });
          return typeof off === 'function' ? off : () => {};
        } catch {}
      }
      return () => {};
    }

    const adapter = { select, deselect, toggle, clear, count, all, onChange };

    Object.defineProperty(globalThis, 'Selection', {
      value: adapter,
      configurable: true,
      enumerable: false,
      writable: false
    });

    updateMetric();
    emitReady();
  } catch {}
})();

// === Selection Facade: deterministic API for tests & UI ===
(function ensureSelectionFacade(){
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const existingSet = window.__SEL_FACADE_SET__;
    const existingCbs = window.__SEL_FACADE_CBS__;
    const _set = existingSet instanceof Set ? existingSet : new Set();
    const _cbs = existingCbs instanceof Set ? existingCbs : new Set();
    window.__SEL_FACADE_SET__ = _set;
    window.__SEL_FACADE_CBS__ = _cbs;

    function emit() {
      try { window.__SEL_COUNT__ = (_set.size | 0); } catch {}
      _cbs.forEach((fn) => { try { fn(_set.size | 0); } catch {} });
    }

    function markRow(id, selected) {
      try {
        const esc = (s) => String(s).replace(/[\\"]/g, "\\$&");
        const row = document.querySelector(
          `[data-ui="row"][data-id="${esc(id)}"], tr[data-id="${esc(id)}"], .grid-row[data-id="${esc(id)}"]`
        );
        if (row) {
          if (selected) row.setAttribute('data-selected', '1');
          else row.removeAttribute('data-selected');
          const cb = row.querySelector(
            '[data-ui="row-check"], input[type="checkbox"][data-row-check], input[type="checkbox"][name="select"], input[type="checkbox"]'
          );
          if (cb) {
            const needs = !!selected;
            if (cb.checked !== needs) {
              cb.checked = needs;
              cb.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
            }
          }
        }
      } catch {}
    }

    function onDomChange(e) {
      try {
        const t = e.target;
        if (!t || typeof t.matches !== 'function') return;
        if (!t.matches('[data-ui="row-check"], input[type="checkbox"][data-row-check], input[type="checkbox"][name="select"], input[type="checkbox"]')) {
          return;
        }
        const row = t.closest('[data-ui="row"][data-id], tr[data-id], .grid-row[data-id]');
        const id = row && row.getAttribute('data-id');
        if (!id) return;
        const key = String(id);
        if (t.checked) _set.add(key); else _set.delete(key);
        if (row) {
          if (t.checked) row.setAttribute('data-selected', '1');
          else row.removeAttribute('data-selected');
        }
        emit();
      } catch {}
    }

    if (window.Selection && typeof window.Selection.select === 'function' && typeof window.Selection.count === 'function') {
      if (!window.__SEL_FACADE_SYNC__) {
        window.__SEL_FACADE_SYNC__ = true;
        try { document.addEventListener('change', onDomChange, true); } catch {}
      }
      return;
    }

    _set.clear();

    function select(id) {
      if (!id) return;
      const key = String(id);
      _set.add(key);
      markRow(key, true);
      emit();
    }

    function deselect(id) {
      if (!id) return;
      const key = String(id);
      _set.delete(key);
      markRow(key, false);
      emit();
    }

    function clear() {
      try { _set.forEach((id) => markRow(id, false)); } catch {}
      _set.clear();
      emit();
    }

    function count() {
      return _set.size | 0;
    }

    function onChange(cb) {
      if (typeof cb === 'function') {
        _cbs.add(cb);
        return () => _cbs.delete(cb);
      }
      return () => {};
    }

    try { document.addEventListener('change', onDomChange, true); } catch {}

    window.Selection = {
      select,
      deselect,
      clear,
      count,
      onChange
    };

    try {
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        emit();
      } else {
        document.addEventListener('DOMContentLoaded', () => emit(), { once: true });
      }
    } catch {}
  } catch {}
})();
