/* Ensure fatal errors always surface a visible diagnostics splash + get logged. */
(function(){
  function push(kind, payload){
    try {
      window.__BOOT_LOGS__ = Array.isArray(window.__BOOT_LOGS__) ? window.__BOOT_LOGS__ : [];
      window.__BOOT_LOGS__.push({ t: Date.now(), kind, ...payload });
    } catch {}
  }
  function splashOn(err){
    const msg = String(err?.stack || err);
    try {
      window.__DIAG__ = window.__DIAG__ || { visible:false, events:[] };
      window.__DIAG__.events.push({ ts: Date.now(), err: msg });
      const el = document.getElementById('diagnostics-splash');
      if (el) el.style.display = 'block';
      fetch('/__log',{method:'POST',headers:{'Content-Type':'application/json'},
        body: JSON.stringify({kind:'boot.unhandled', ts: Date.now(), err: msg})}).catch(()=>{});
    } catch {}
    push('boot.unhandled', { err: msg });
  }
  window.addEventListener('error', e => splashOn(e.error || e.message));
  window.addEventListener('unhandledrejection', e => splashOn(e.reason || 'unhandledrejection'));
  window.CRM = window.CRM || {};
  window.CRM.exportLogs = function(){
    try {
      const logs = Array.isArray(window.__BOOT_LOGS__) ? window.__BOOT_LOGS__ : [];
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'crm-frontend-logs.json';
      a.click();
    } catch {}
  };
})();
