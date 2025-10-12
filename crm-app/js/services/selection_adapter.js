// selection_adapter.js — normalized Selection capability for tests & features (PATCHES-only)
(function(){
  try {
    const guess = () => {
      const g = globalThis;
      if (g.Selection && typeof g.Selection.count === 'function') return g.Selection;
      if (g.selection && typeof g.selection.count === 'function') return g.selection;
      if (g.CRM && g.CRM.services && g.CRM.services.selection) return g.CRM.services.selection;
      if (g.__selection) return g.__selection;
      return null;
    };

    const sel = guess();
    if (!sel) return;

    const countFrom = (receiver, args) => {
      if (typeof receiver.count === 'function') {
        return receiver.count.apply(receiver, args);
      }
      if (typeof receiver.all === 'function') {
        try {
          const items = receiver.all.apply(receiver, args);
          if (Array.isArray(items)) return items.length;
          if (items && typeof items.length === 'number') return items.length;
        } catch {}
      }
      return 0;
    };

    const updateMetric = () => {
      try {
        globalThis.__SEL_COUNT__ = countFrom(sel, []);
      } catch {}
    };

    const wrapMutator = (methodName) => (...args) => {
      const fn = sel && sel[methodName];
      let result;
      if (typeof fn === 'function') {
        result = fn.apply(sel, args);
      }
      updateMetric();
      return result;
    };

    const facade = {
      select: wrapMutator('select'),
      deselect: wrapMutator('deselect'),
      toggle: wrapMutator('toggle'),
      clear: wrapMutator('clear'),
      count: (...args) => countFrom(sel, args),
      all: (...args) => {
        if (typeof sel.all === 'function') {
          return sel.all.apply(sel, args);
        }
        return [];
      },
      onChange: (...args) => {
        if (typeof sel.onChange === 'function') {
          return sel.onChange.apply(sel, args);
        }
        return void 0;
      }
    };

    if (!globalThis.Selection) {
      Object.defineProperty(globalThis, 'Selection', {
        value: facade,
        configurable: false,
        enumerable: false,
        writable: false
      });
    }

    updateMetric();

    const subscribe = () => {
      try {
        if (typeof sel.onChange === 'function') {
          sel.onChange(updateMetric);
          return true;
        }
      } catch {}
      return false;
    };

    if (!subscribe()) {
      const SENTINEL = '__SEL_ADAPTER_WRAPPED__';
      try {
        if (!sel[SENTINEL]) {
          Object.defineProperty(sel, SENTINEL, {
            value: true,
            configurable: true,
            enumerable: false
          });
          ['select', 'deselect', 'toggle', 'clear'].forEach((methodName) => {
            const original = sel[methodName];
            if (typeof original === 'function') {
              sel[methodName] = function patchedSelectionMethod(...args) {
                const result = original.apply(this, args);
                updateMetric();
                return result;
              };
            }
          });
        }
      } catch {}
    }
    try { globalThis.dispatchEvent(new CustomEvent('ui:selection-ready')); } catch {}
  } catch {}
})();
