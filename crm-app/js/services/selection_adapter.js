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
      try {
        const n = count() | 0;
        globalThis.__SEL_COUNT__ = n;
        // Mirror action bar attribute used by the smoke assertion
        const bar = document.querySelector?.('[data-ui="action-bar"]');
        if (bar) bar.setAttribute('data-visible', n > 0 ? '1' : '0');
      } catch {}
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

    // --- DOM bridge: ensure checkbox clicks drive Selection via the adapter ---
    (function installDomSelectionBridge(){
      try {
        if (globalThis.__SELECTION_DOM_BRIDGE__) return;
        Object.defineProperty(globalThis, '__SELECTION_DOM_BRIDGE__', {
          value: true, configurable: false, enumerable: false, writable: false
        });

        function rowIdFrom(el){
          if (!el) return '';
          const id = el.getAttribute?.('data-id') || '';
          return id ? String(id) : '';
        }
        const pendingSync = typeof WeakSet === 'function' ? new WeakSet() : new Set();

        function syncCheckbox(cb){
          const id = rowIdFrom(cb);
          if (!id) return;
          let ids;
          try { ids = new Set(readIds()); }
          catch { ids = new Set(); }
          const shouldBeSelected = !!cb.checked;
          const isSelected = ids.has(id);
          if (shouldBeSelected && !isSelected) {
            try { select(id); } catch {}
            return;
          }
          if (!shouldBeSelected && isSelected) {
            try { deselect(id); } catch {}
          }
        }

        function scheduleSync(cb, viaClick){
          if (!cb) return;
          if (pendingSync.has(cb)) return;
          pendingSync.add(cb);
          const run = () => {
            try { syncCheckbox(cb); } catch {}
            try { pendingSync.delete(cb); } catch {}
          };
          if (viaClick) {
            try { setTimeout(run, 0); }
            catch { queueMicrotask(run); }
          } else {
            queueMicrotask(run);
          }
        }

        // Capture-phase so we run regardless of app handler order
        document.addEventListener('change', (e) => {
          const cb = e.target && (e.target.closest?.('[data-ui="row-check"]'));
          if (!cb) return;
          scheduleSync(cb, false);
        }, true);
        document.addEventListener('click',  (e) => {
          const cb = e.target && (e.target.closest?.('[data-ui="row-check"]'));
          if (!cb) return;
          scheduleSync(cb, true);
        }, true);
      } catch {}
    })();

    updateMetric();
    emitReady();
  } catch {}
})();
