// crm-app/js/boot/early_trap.js
(function(){
  window.__BOOT_LOGS__ = [];
  function push(kind, payload){
    try { window.__BOOT_LOGS__.push({ t: Date.now(), kind, ...payload }); } catch (_) { }
  }
  window.addEventListener('error', (e)=>{
    push('onerror', { message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, stack: e.error && e.error.stack });
    const splash = document.getElementById('diagnostics-splash');
    if (splash) splash.style.display = 'block';
  });
  window.addEventListener('unhandledrejection', (e)=>{
    push('unhandledrejection', { reason: String(e.reason && e.reason.stack || e.reason) });
    const splash = document.getElementById('diagnostics-splash');
    if (splash) splash.style.display = 'block';
  });
  window.CRM = window.CRM || {};
  window.CRM.exportLogs = function(){
    const blob = new Blob([JSON.stringify(window.__BOOT_LOGS__, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'crm-frontend-logs.json';
    a.click();
  };
})();
