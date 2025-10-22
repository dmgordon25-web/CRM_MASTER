(function(){
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const ROOT = window;
  const HANDLER_KEY = '__ROUTE_TOAST_SENTINEL_HANDLER__';
  const TIMER_KEY = '__ROUTE_TOAST_SENTINEL_TIMER__';
  const TOAST_ID = 'dev-route-toast';

  const safeLog = (...args) => {
    try {
      console.info('[A_BEACON] route toast sentinel', ...args);
    } catch (_) {}
  };

  const removeListener = () => {
    try {
      if (ROOT[HANDLER_KEY] && typeof ROOT.removeEventListener === 'function') {
        ROOT.removeEventListener('hashchange', ROOT[HANDLER_KEY], false);
      }
    } catch (_) {}
    ROOT[HANDLER_KEY] = undefined;
  };

  const hideToast = () => {
    try {
      if (ROOT[TIMER_KEY]) {
        clearTimeout(ROOT[TIMER_KEY]);
        ROOT[TIMER_KEY] = null;
      }
      const existing = document.getElementById(TOAST_ID);
      if (existing) {
        existing.remove();
      }
    } catch (_) {}
  };

  const showToast = (hash) => {
    const text = `Switched to: ${hash || '#/'}`;
    try {
      const toastApi = ROOT.Toast;
      if (toastApi && typeof toastApi.show === 'function') {
        toastApi.show(text);
      } else if (typeof ROOT.toast === 'function') {
        ROOT.toast(text);
      }
    } catch (err) {
      safeLog('toast api error', err && (err.message || err));
    }
    hideToast();
    try {
      const div = document.createElement('div');
      div.id = TOAST_ID;
      div.textContent = text;
      div.setAttribute('role', 'status');
      div.style.position = 'fixed';
      div.style.bottom = '16px';
      div.style.right = '16px';
      div.style.padding = '8px 12px';
      div.style.background = 'rgba(17,17,17,0.9)';
      div.style.color = '#fff';
      div.style.borderRadius = '4px';
      div.style.fontFamily = 'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif';
      div.style.fontSize = '14px';
      div.style.zIndex = '2147483647';
      div.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
      document.body.appendChild(div);
      ROOT[TIMER_KEY] = setTimeout(() => {
        hideToast();
      }, 1500);
    } catch (err) {
      safeLog('fallback toast failed', err && (err.message || err));
    }
  };

  removeListener();

  const handler = () => {
    try {
      hideToast();
      showToast(ROOT.location ? ROOT.location.hash : '');
    } catch (err) {
      safeLog('handler error', err && (err.message || err));
    }
  };

  try {
    ROOT.addEventListener('hashchange', handler, false);
    ROOT[HANDLER_KEY] = handler;
    safeLog('active');
  } catch (err) {
    safeLog('attach failed', err && (err.message || err));
  }
})();
