// capabilities_probe.js — surface live capability snapshots for diagnostics (PATCHES phase)
(function(){
  try {
    if (globalThis.__CAPS_PROBE_INITIALIZED__) return;
    Object.defineProperty(globalThis, '__CAPS_PROBE_INITIALIZED__', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    const root = globalThis.__CAPS__ = globalThis.__CAPS__ || {};
    const listeners = {};

    function snapshotSelection(){
      try {
        const sel = globalThis.Selection;
        if (sel && typeof sel.count === 'function') {
          const all = typeof sel.all === 'function'
            ? sel.all()
            : (typeof sel.getSelectedIds === 'function' ? sel.getSelectedIds() : []);
          root.selection = {
            ok: true,
            count: Number(sel.count()) || 0,
            all: Array.isArray(all) ? all.slice() : Array.from(all || [])
          };
          return;
        }
      } catch {}
      root.selection = { ok: false, count: 0, all: [] };
    }

    function bindSelection(){
      const sel = globalThis.Selection;
      if (!sel || typeof sel.onChange !== 'function') return false;
      if (listeners.selection) return true;
      try {
        const off = sel.onChange(() => snapshotSelection());
        listeners.selection = typeof off === 'function' ? off : () => {};
      } catch {
        listeners.selection = () => {};
      }
      snapshotSelection();
      return true;
    }

    function onReady(){
      if (bindSelection()) {
        if (globalThis.removeEventListener) {
          try { globalThis.removeEventListener('ui:selection-ready', onReady); } catch {}
        }
      } else {
        snapshotSelection();
      }
    }

    if (!bindSelection()) {
      snapshotSelection();
      if (globalThis.addEventListener) {
        try { globalThis.addEventListener('ui:selection-ready', onReady); } catch {}
      }
    }
  } catch {}
})();
