(function quickCreateWiringGuard() {
  if (typeof document === 'undefined') return;
  // GUARD: Singleton
  if (window.__PATCH_QUICK_CREATE_WIRED__) return;
  window.__PATCH_QUICK_CREATE_WIRED__ = true;

  let logged = false;
  let observer = null;

  function postLog(eventName) {
    const payload = JSON.stringify({ event: eventName });
    let sent = false;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        sent = !!navigator.sendBeacon('/__log', payload) || sent;
      } catch (_) { }
    }
    if (sent || typeof fetch !== 'function') {
      return;
    }
    try {
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => { });
    } catch (_) { }
  }

  function disconnectObserver() {
    if (observer) {
      try {
        observer.disconnect();
      } catch (_) { }
      observer = null;
    }
  }

  function logReady() {
    if (logged) {
      disconnectObserver(); // Ensure disconnected if already logged
      return true;
    }
    const headerBtn = document.getElementById('quick-add-unified')
      || document.getElementById('btn-header-new');
    const actionBtn = document.getElementById('global-new');
    if (!headerBtn || !actionBtn) {
      return false;
    }
    if (!headerBtn.isConnected || !actionBtn.isConnected) {
      return false;
    }
    logged = true;
    disconnectObserver();
    try {
      console && typeof console.info === 'function' && console.info('[VIS] quick-create wired');
    } catch (_) { }
    postLog('quick-create-wired');
    return true;
  }

  function schedule(fn) {
    if (typeof Promise === 'function') {
      Promise.resolve().then(fn);
      return;
    }
    try { fn(); }
    catch (_) { }
  }

  function watch() {
    if (logReady()) {
      return;
    }
    if (typeof MutationObserver !== 'function') {
      return;
    }
    // Safety: disconnect existing if somehow re-entrant
    disconnectObserver();

    observer = new MutationObserver(() => {
      if (logReady()) {
        disconnectObserver();
      }
    });
    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }
    observer.observe(target, { childList: true, subtree: true });

    // Safety: timeout to stop observing if it never happens
    setTimeout(disconnectObserver, 10000);

    logReady();
  }

  const kickoff = () => schedule(watch);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kickoff, { once: true });
  } else {
    kickoff();
  }
})();
