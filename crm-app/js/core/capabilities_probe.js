(function(){
  try {
    const safeFn = (f) => typeof f === 'function';
    const caps = {
      toast: safeFn(window?.Toast?.show) || safeFn(globalThis?.Toast?.show),
      confirm: safeFn(window?.Confirm?.show) || safeFn(globalThis?.Confirm?.show),
      renderAll: safeFn(window?.renderAll) || safeFn(globalThis?.renderAll),
      selection: (function(){
        const g = globalThis;
        const cand = g.Selection || g.selection || (g.CRM && g.CRM.services && g.CRM.services.selection);
        const api = ['select','deselect','toggle','clear','count'];
        return !!cand && api.every(k => typeof cand[k] === 'function');
      })(),
      notifications: (function(){
        const n = (window?.Notifications || window?.notifications || {});
        const api = ['open','close'];
        return Object.keys(n).length ? api.every(k => typeof n[k] === 'function') : true;
      })()
    };
    globalThis.__CAPS__ = Object.freeze(caps);
    globalThis.dispatchEvent?.(new CustomEvent('ui:caps',{detail:caps}));
  } catch {}
})();
