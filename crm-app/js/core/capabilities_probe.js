(function(){
  function snapshotCaps() {
    try {
      const safeFn = (f) => typeof f === 'function';
      const g = globalThis;
      const candidateSel = g.Selection || g.selection || (g.CRM && g.CRM.services && g.CRM.services.selection);
      const hasSel = !!candidateSel && ['select', 'deselect', 'toggle', 'clear', 'count'].every((k) => typeof candidateSel[k] === 'function');
      const toastShow = g?.Toast?.show || g?.toast?.show;
      const confirmShow = g?.Confirm?.show || g?.confirm?.show;
      const renderAllFn = g?.renderAll || g?.RenderAll;
      const caps = {
        toast: safeFn(toastShow),
        confirm: safeFn(confirmShow),
        renderAll: safeFn(renderAllFn),
        selection: hasSel,
        notifications: (function(){
          const n = (g?.Notifications || g?.notifications || {});
          const api = ['open', 'close'];
          return Object.keys(n).length ? api.every((k) => typeof n[k] === 'function') : true;
        })()
      };
      g.__CAPS__ = Object.freeze(caps);
      if (typeof g.dispatchEvent === 'function') {
        try {
          g.dispatchEvent(new CustomEvent('ui:caps', { detail: caps }));
        } catch {}
      }
    } catch {}
  }
  try { setTimeout(snapshotCaps, 0); } catch {}
  try {
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('ui:selection-ready', snapshotCaps, { once: false });
    }
  } catch {}
})();
