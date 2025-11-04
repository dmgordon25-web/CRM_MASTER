(function sessionBeaconPatch() {
  const state = { armed: false };

  function markBye() {
    const sid = window.__SID;
    if (!sid) {
      return;
    }
    const target = `/__bye?sid=${encodeURIComponent(sid)}`;
    if (navigator.sendBeacon) {
      try {
        if (navigator.sendBeacon(target, '')) {
          return;
        }
      } catch (_) {
        // ignore and fallback
      }
    }
    try {
      fetch(target, { method: 'POST', body: '', keepalive: true }).catch(() => {});
    } catch (_) {
      fetch(target, { method: 'GET', keepalive: true }).catch(() => {});
    }
  }

  function armBeacons() {
    if (state.armed) {
      return;
    }
    state.armed = true;
    window.addEventListener('pagehide', markBye, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        markBye();
      }
    }, { capture: true });
    console.info('[VIS] session beacons armed');
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetch('/__hello', { method: 'GET' })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((payload) => {
        if (payload && payload.sid) {
          window.__SID = payload.sid;
          // Store in sessionStorage for beforeunload handler access
          try {
            sessionStorage.setItem('crm-session-id', payload.sid);
          } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(armBeacons);
  }, { once: true });
})();
