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
    const existing = globalThis.Selection;
    if (!existing || typeof existing.select !== 'function' || typeof existing.count !== 'function') return;

    if (existing.__SEL_FACADE__) {
      if (!globalThis.__SEL_FACADE_SYNC__ && existing.__SEL_FACADE_DOM__) {
        globalThis.__SEL_FACADE_SYNC__ = true;
        try { document.addEventListener('change', existing.__SEL_FACADE_DOM__, true); } catch {}
      }
      return;
    }

    const base = existing;
    const state = globalThis.__SEL_FACADE_STATE__ || {};
    if (!state.set) state.set = new Set();
    if (!state.cbs) state.cbs = new Set();
    if (typeof state.offBase === 'function') {
      try { state.offBase(); } catch {}
      state.offBase = undefined;
    }

    const _set = state.set;
    const _cbs = state.cbs;

    const normalize = (id) => {
      const key = id == null ? '' : String(id);
      return key;
    };

    const markRow = (id, selected) => {
      try {
        const esc = (s) => String(s).replace(/[\\"]/g, "\\$&");
        const qs = `[data-ui="row"][data-id="${esc(id)}"], tr[data-id="${esc(id)}"], .grid-row[data-id="${esc(id)}"]`;
        const row = document.querySelector(qs);
        if (!row) return;
        if (selected) row.setAttribute('data-selected', '1');
        else row.removeAttribute('data-selected');
        const cb = row.querySelector('[data-ui="row-check"], input[type="checkbox"][data-row-check], input[type="checkbox"][name="select"], input[type="checkbox"]');
        if (cb) {
          const needs = !!selected;
          if (cb.checked !== needs) cb.checked = needs;
        }
      } catch {}
    };

    const emit = () => {
      const size = _set.size | 0;
      try { globalThis.__SEL_COUNT__ = size; } catch {}
      const payload = { count: size, all: Array.from(_set) };
      _cbs.forEach((fn) => { try { fn(payload); } catch {} });
    };

    const syncDomFromSet = () => {
      try { _set.forEach((id) => markRow(id, true)); } catch {}
    };

    const syncFromBase = () => {
      const nextList = [];
      try {
        if (typeof base.all === 'function') {
          const arr = base.all();
          if (Array.isArray(arr)) {
            arr.forEach((value) => {
              const key = normalize(value);
              if (key) nextList.push(key);
            });
          }
        }
      } catch {}
      const nextSet = new Set(nextList);
      Array.from(_set).forEach((current) => {
        if (!nextSet.has(current)) {
          _set.delete(current);
          markRow(current, false);
        }
      });
      nextList.forEach((key) => {
        if (!_set.has(key)) {
          _set.add(key);
          markRow(key, true);
        }
      });
      emit();
    };

    const onDomChange = state.domHandler || function onDomChange(e) {
      try {
        const t = e.target;
        if (!t || typeof t.matches !== 'function') return;
        if (!t.matches('[data-ui="row-check"], input[type="checkbox"][data-row-check], input[type="checkbox"][name="select"], input[type="checkbox"]')) return;
        const row = typeof t.closest === 'function' ? t.closest('[data-ui="row"][data-id], tr[data-id], .grid-row[data-id]') : null;
        const id = row && row.getAttribute('data-id');
        const key = normalize(id);
        if (!key) return;
        if (t.checked) {
          _set.add(key);
          markRow(key, true);
          emit();
          try { base.select(id); } catch {}
        } else {
          _set.delete(key);
          markRow(key, false);
          emit();
          try { base.deselect(id); } catch {}
        }
      } catch {}
    };
    state.domHandler = onDomChange;

    if (!globalThis.__SEL_FACADE_SYNC__) {
      globalThis.__SEL_FACADE_SYNC__ = true;
      try { document.addEventListener('change', onDomChange, true); } catch {}
    }

    let offBase = () => {};
    try {
      if (typeof base.onChange === 'function') {
        offBase = base.onChange(() => { syncFromBase(); });
      } else if (typeof base.subscribe === 'function') {
        offBase = base.subscribe(() => { syncFromBase(); });
      }
    } catch {}
    state.offBase = typeof offBase === 'function' ? offBase : () => {};

    const facade = {
      select(id, type) {
        const key = normalize(id);
        if (!key) return;
        _set.add(key);
        markRow(key, true);
        emit();
        try { base.select(id, type); } catch {}
      },
      deselect(id) {
        const key = normalize(id);
        if (!key) return;
        _set.delete(key);
        markRow(key, false);
        emit();
        try { base.deselect(id); } catch {}
      },
      toggle(id, type) {
        const key = normalize(id);
        if (!key) return;
        if (_set.has(key)) this.deselect(id);
        else this.select(id, type);
      },
      clear() {
        Array.from(_set).forEach((key) => { markRow(key, false); });
        _set.clear();
        emit();
        try { base.clear(); } catch {}
      },
      count() {
        return _set.size | 0;
      },
      all() {
        return Array.from(_set);
      },
      onChange(cb) {
        if (typeof cb !== 'function') return () => {};
        _cbs.add(cb);
        try { cb({ count: _set.size | 0, all: Array.from(_set) }); } catch {}
        return () => { _cbs.delete(cb); };
      }
    };

    Object.defineProperty(facade, '__SEL_FACADE__', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
    Object.defineProperty(facade, '__SEL_FACADE_DOM__', {
      value: onDomChange,
      configurable: false,
      enumerable: false,
      writable: false
    });

    Object.defineProperty(globalThis, 'Selection', {
      value: facade,
      configurable: true,
      enumerable: false,
      writable: false
    });

    globalThis.__SEL_FACADE_STATE__ = state;

    syncFromBase();
    syncDomFromSet();

    try {
      if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          syncDomFromSet();
        } else {
          document.addEventListener('DOMContentLoaded', () => { syncDomFromSet(); }, { once: true });
        }
      }
    } catch {}
  } catch {}
})();
