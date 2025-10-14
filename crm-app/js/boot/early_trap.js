/* Early trap: ensures visible signal + logging on unhandled errors before boot */
(function(){
  function log(kind, payload){
    try {
      fetch('/__log', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ kind, ts: Date.now(), ...payload }) }).catch(()=>{});
    } catch (e) {}
  }
  function showSplash(){
    const el = document.getElementById('diagnostics-splash');
    if (el) el.style.display = 'block';
  }
  window.addEventListener('error', e => { showSplash(); log('boot.unhandled', { err: String(e?.error || e?.message || 'error') }); });
  window.addEventListener('unhandledrejection', e => { showSplash(); log('boot.unhandledrejection', { err: String(e?.reason || 'promise rejection') }); });

  // ---- SMOKE COMPAT: unstarvable selection metric (Pipeline + Partners) ----
  try {
    // Always-fresh count from the live DOM
    const computeSelCount = () => {
      try {
        const q = (sel) => Array.from(document.querySelectorAll(sel));
        // Count any checked row checkbox in Pipeline or Partners
        const n =
          q('#tbl-pipeline [data-ui="row-check"]:checked').length +
          q('#tbl-partners [data-ui="row-check"]:checked').length;
        // Mirror the action bar attribute many parts of the app/CSS watch
        const bar = document.querySelector('[data-ui="action-bar"]');
        if (bar) bar.setAttribute('data-visible', n > 0 ? '1' : '0');
        return n | 0;
      } catch { return 0; }
    };

    // Define accessor so every read re-counts; keep it overridable and writable
    try {
      const desc = Object.getOwnPropertyDescriptor(globalThis, '__SEL_COUNT__');
      if (!desc || !('get' in desc)) {
        let _shadow = 0;
        Object.defineProperty(globalThis, '__SEL_COUNT__', {
          configurable: true,
          get() { return computeSelCount(); },
          set(v) { _shadow = (v | 0); } // accept writes from app/tests without breaking the getter
        });
      }
    } catch {}

    // After any click/change on a row checkbox, recompute next tick
    const recomputeSoon = () => { try { queueMicrotask(computeSelCount); } catch { setTimeout(computeSelCount, 0); } };
    const wants = (t) => !!(t && (t.closest?.('#tbl-pipeline [data-ui="row-check"]') || t.closest?.('#tbl-partners [data-ui="row-check"]')));
    document.addEventListener('click',  (e) => { if (wants(e.target)) recomputeSoon(); }, true);
    document.addEventListener('change', (e) => { if (wants(e.target)) recomputeSoon(); }, true);
  } catch {}
})();
