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
    root.detail = root.detail || {};
    const listeners = {};

    function detectToast(){
      try {
        const api = globalThis.Toast;
        if (api && (typeof api.success === 'function' || typeof api.show === 'function' || typeof api.info === 'function')) {
          return true;
        }
        if (typeof globalThis.toast === 'function') return true;
      } catch {}
      return false;
    }

    function detectConfirm(){
      try {
        if (typeof globalThis.confirmAction === 'function') return true;
        const confirmApi = globalThis.Confirm;
        if (confirmApi && typeof confirmApi.show === 'function') return true;
        if (typeof globalThis.confirm === 'function') return true;
      } catch {}
      return false;
    }

    function detectRenderAll(){
      return typeof globalThis.renderAll === 'function';
    }

    function updateFlags(){
      try { root.toast = detectToast(); } catch { root.toast = false; }
      try { root.confirm = detectConfirm(); } catch { root.confirm = false; }
      try { root.renderAll = detectRenderAll(); } catch { root.renderAll = false; }
      try {
        const detail = root.detail && root.detail.selection ? root.detail.selection : null;
        root.selection = !!(detail && detail.ok);
      } catch { root.selection = false; }
    }

    function snapshotSelection(){
      try {
        const sel = globalThis.Selection;
        if (sel && typeof sel.count === 'function') {
          const all = typeof sel.all === 'function'
            ? sel.all()
            : (typeof sel.getSelectedIds === 'function' ? sel.getSelectedIds() : []);
          root.detail.selection = {
            ok: true,
            count: Number(sel.count()) || 0,
            all: Array.isArray(all) ? all.slice() : Array.from(all || [])
          };
          updateFlags();
          return;
        }
      } catch {}
      root.detail.selection = { ok: false, count: 0, all: [] };
      updateFlags();
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

    updateFlags();

    function handleRoute(){
      updateFlags();
    }

    try { globalThis.addEventListener?.('app:view:changed', handleRoute); } catch {}
    try { globalThis.addEventListener?.('app:navigate', handleRoute); } catch {}
    try { globalThis.addEventListener?.('hashchange', handleRoute); } catch {}
  } catch {}
})();
