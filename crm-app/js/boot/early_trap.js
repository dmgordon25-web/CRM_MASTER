/* Early trap: ensures visible signal + logging on unhandled errors before boot */
(function(){
  function log(kind, payload){
    try {
      if (typeof fetch !== 'function') return;
      fetch('/__log', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ kind, ts: Date.now(), href: location.href, ...payload }), keepalive:true }).catch(()=>{});
    } catch (e) {}
  }
  function showSplash(){
    const el = document.getElementById('diagnostics-splash');
    if (el) el.style.display = 'block';
  }
  window.addEventListener('error', e => { showSplash(); log('boot.unhandled', { err: String(e?.error || e?.message || 'error') }); });
  window.addEventListener('unhandledrejection', e => { showSplash(); log('boot.unhandledrejection', { err: String(e?.reason || 'promise rejection') }); });
})();
