(function sessionBeaconPatch() {
  const HIDDEN_BYE_TIMEOUT = 30000; // 30s grace period before hidden tabs are marked bye
  const state = { armed: false, hiddenTimer: null };

  function markBye() {
    cancelHiddenTimer();
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

  function cancelHiddenTimer() {
    if (state.hiddenTimer !== null) {
      clearTimeout(state.hiddenTimer);
      state.hiddenTimer = null;
    }
  }

  function scheduleHiddenBye() {
    cancelHiddenTimer();
    state.hiddenTimer = window.setTimeout(() => {
      state.hiddenTimer = null;
      markBye();
    }, HIDDEN_BYE_TIMEOUT);
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      scheduleHiddenBye();
    } else if (document.visibilityState === 'visible') {
      cancelHiddenTimer();
    }
  }

  function armBeacons() {
    if (state.armed) {
      return;
    }
    state.armed = true;
    window.addEventListener('pagehide', markBye, { capture: true });
    window.addEventListener('beforeunload', markBye, { capture: true });
    document.addEventListener('visibilitychange', onVisibilityChange, { capture: true });
    console.info('[VIS] session beacons armed');
  }

  document.addEventListener('DOMContentLoaded', () => {
    fetch('/__hello', { method: 'GET' })
      .then((res) => (res && res.ok ? res.json() : null))
      .then((payload) => {
        if (payload && payload.sid) {
          window.__SID = payload.sid;
        }
      })
      .catch(() => {})
      .finally(armBeacons);
  }, { once: true });
})();
