(function(){
  const params = new URLSearchParams(location.search);
  if (params.get('debug') !== '1') return;

  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;inset:0;background:#0b1020;color:#e6f1ff;z-index:100000;overflow:auto;padding:24px;font:14px/1.4 system-ui';
  div.innerHTML = `
    <h2>CRM Self-Test</h2>
    <pre id="boot-json" style="white-space:pre-wrap;background:#111;padding:12px;border-radius:8px;"></pre>
    <button id="export">Export Logs</button>
  `;
  document.body.appendChild(div);
  const out = {
    phases: Object.keys(window.__BOOT_DONE__||{}).length ? window.__BOOT_DONE__ : null,
    services: window.CRM?.health || {},
    patchesFailed: window.__PATCHES_FAILED__ || [],
    logs: window.__BOOT_LOGS__ || []
  };
  document.getElementById('boot-json').textContent = JSON.stringify(out, null, 2);
  document.getElementById('export').onclick = () => (window.CRM && window.CRM.exportLogs && window.CRM.exportLogs());
})();
