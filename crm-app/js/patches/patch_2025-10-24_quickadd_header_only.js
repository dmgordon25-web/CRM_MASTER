(function quickAddHeaderOnlyVerification() {
  if (typeof document === 'undefined') {
    return;
  }

  let armed = false;
  let observer = null;

  function postLog(eventName) {
    const payload = JSON.stringify({ event: eventName });
    let sent = false;
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      try {
        sent = !!navigator.sendBeacon('/__log', payload) || sent;
      } catch (_) {}
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
      }).catch(() => {});
    } catch (_) {}
  }

  function disconnectObserver() {
    if (!observer) {
      return;
    }
    try {
      observer.disconnect();
    } catch (_) {}
    observer = null;
  }

  function closeMenuIfOpen(button, wrapper) {
    if (!wrapper || wrapper.hidden) {
      return;
    }
    if (button && typeof button.click === 'function') {
      try { button.click(); }
      catch (_) {}
    }
  }

  function verify() {
    if (armed) {
      return true;
    }
    const headerBtn = document.getElementById('btn-header-new');
    if (!headerBtn || !headerBtn.isConnected) {
      return false;
    }
    const actionFab = document.getElementById('global-new');
    if (actionFab && actionFab.isConnected) {
      return false;
    }
    const wrapper = document.getElementById('global-new-menu');
    const menu = document.getElementById('header-new-menu');
    if (!wrapper || !menu) {
      return false;
    }
    const firstItem = menu.querySelector('button[role="menuitem"]');
    if (!firstItem) {
      return false;
    }
    const wasHidden = wrapper.hidden;
    try { headerBtn.click(); }
    catch (_) { return false; }
    const nowOpen = !wrapper.hidden && !menu.hidden && headerBtn.getAttribute('aria-expanded') === 'true';
    if (!nowOpen) {
      closeMenuIfOpen(headerBtn, wrapper);
      return false;
    }
    const focusedFirst = document.activeElement === firstItem;
    try { headerBtn.click(); }
    catch (_) { return false; }
    if (!wrapper.hidden) {
      closeMenuIfOpen(headerBtn, wrapper);
    }
    const closed = wrapper.hidden && headerBtn.getAttribute('aria-expanded') !== 'true';
    if (!closed || !focusedFirst) {
      return false;
    }
    armed = true;
    disconnectObserver();
    try {
      console && typeof console.info === 'function' && console.info('[VIS] quick-add verification armed');
    } catch (_) {}
    postLog('quickadd-verify-armed');
    if (!wasHidden && wrapper.hidden) {
      try { headerBtn.focus({ preventScroll: true }); }
      catch (_) {
        try { headerBtn.focus(); }
        catch (_) {}
      }
    }
    return true;
  }

  function schedule(fn) {
    if (typeof Promise === 'function') {
      Promise.resolve().then(fn);
      return;
    }
    try { fn(); }
    catch (_) {}
  }

  function watch() {
    if (verify()) {
      return;
    }
    if (typeof MutationObserver !== 'function') {
      return;
    }
    observer = new MutationObserver(() => {
      if (verify()) {
        disconnectObserver();
      }
    });
    const target = document.body || document.documentElement;
    if (!target) {
      return;
    }
    observer.observe(target, { childList: true, subtree: true });
    verify();
  }

  const kickoff = () => schedule(watch);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kickoff, { once: true });
  } else {
    kickoff();
  }
})();
