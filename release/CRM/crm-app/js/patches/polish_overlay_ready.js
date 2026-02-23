/* Polish overlay readiness shim — ensure diagnostics splash hides once core HARD prereqs are satisfied */
(function(){
  const OVERLAY_SELECTOR = '#diagnostics-splash';
  const HARD_READY_EVENTS = [
    'boot:hard-ready',
    'services-ready',
    'services:ready',
    'crm:services-ready',
    'servicesRegistry:ready',
    'crm:servicesRegistry:ready',
    'contracts:ready'
  ];
  const POLL_INTERVAL_MS = 50;
  const POLL_TIMEOUT_MS = 3000;
  const POSITIVE_TOKENS = new Set([
    '1', 'true', 'yes', 'y', 'ready', 'ok', 'okay', 'done', 'complete', 'completed',
    'healthy', 'health', 'online', 'available', 'up', 'active', 'running', 'passing',
    'pass', 'passed', 'green', 'success', 'succeeded'
  ]);
  const READINESS_KEYS = ['ready', 'status', 'state', 'value', 'result', 'ok', 'health', 'healthy'];

  function logWarn(detail){
    try { console.warn('[overlay]', detail); }
    catch (_) {}
  }

  function queueMicro(fn){
    if (typeof fn !== 'function') return () => {};
    if (typeof queueMicrotask === 'function') {
      return () => {
        try { queueMicrotask(fn); }
        catch (err) { logWarn(err); fn(); }
      };
    }
    return () => {
      try {
        Promise.resolve().then(fn).catch((err) => logWarn(err));
      } catch (err) {
        logWarn(err);
        fn();
      }
    };
  }

  function afterPaint(fn){
    if (typeof fn !== 'function') return;
    const run = () => {
      try { fn(); }
      catch (err) { logWarn(err); }
    };
    const micro = queueMicro(run);
    const raf = (typeof requestAnimationFrame === 'function')
      ? requestAnimationFrame
      : ((cb) => {
          if (typeof setTimeout === 'function') {
            return setTimeout(cb, 16);
          }
          try { cb(); }
          catch (err) { logWarn(err); }
          return null;
        });
    try {
      raf(() => micro());
    } catch (err) {
      logWarn(err);
      micro();
    }
  }

  function positiveFlag(value, seen){
    if (value === true) return true;
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return POSITIVE_TOKENS.has(normalized);
    }
    if (!value || typeof value !== 'object') return false;
    const visited = seen || new Set();
    if (visited.has(value)) return false;
    visited.add(value);
    if ('fatal' in value && value.fatal === false) return true;
    for (const key of READINESS_KEYS) {
      if (key in value && positiveFlag(value[key], visited)) return true;
    }
    return false;
  }

  function checkHardReady(){
    const global = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
    if (!global) return false;
    if (global.__BOOT_FATAL__) return false;
    const doc = (typeof document !== 'undefined') ? document : null;
    const crm = global.CRM || {};
    const ctx = crm.ctx || {};
    const boot = crm.boot || {};

    const candidates = [
      global.__BOOT_HARD_READY__,
      global.__HARD_READY__,
      global.__READY__,
      global.__SERVICES_READY__,
      global.__SERVICES_REGISTRY_READY__,
      global.__BOOT_STATUS__ && (global.__BOOT_STATUS__.hard || global.__BOOT_STATUS__.core),
      global.__BOOT_DONE__,
      boot.hardReady,
      ctx.hardReady,
      ctx.ready && (ctx.ready.hard || ctx.ready.core),
      boot.ready && (boot.ready.hard || boot.ready.core)
    ];

    for (const candidate of candidates) {
      if (positiveFlag(candidate)) return true;
    }

    const renderReady = typeof global.renderAll === 'function';
    let rootReady = false;
    if (doc) {
      try {
        rootReady = !!(doc.getElementById('app') || doc.querySelector('[data-ui="app-root"], main'));
      } catch (_) { rootReady = false; }
    }
    return renderReady && rootReady;
  }

  function whenHardReady(){
    return new Promise((resolve) => {
      const global = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : null));
      const targets = [];
      if (global && typeof global.addEventListener === 'function') targets.push(global);
      if (typeof document !== 'undefined' && document && typeof document.addEventListener === 'function') {
        targets.push(document);
      }
      let settled = false;
      let pollTimer = null;

      const cleanup = () => {
        targets.forEach((target) => {
          if (!target || typeof target.removeEventListener !== 'function') return;
          HARD_READY_EVENTS.forEach((eventName) => {
            try { target.removeEventListener(eventName, onReady); }
            catch (_) {}
          });
        });
        if (pollTimer != null) {
          try {
            const clear = (global && typeof global.clearInterval === 'function') ? global.clearInterval : clearInterval;
            if (typeof clear === 'function') clear(pollTimer);
          } catch (_) {}
          pollTimer = null;
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const onReady = () => {
        finish();
      };

      HARD_READY_EVENTS.forEach((eventName) => {
        targets.forEach((target) => {
          if (!target || typeof target.addEventListener !== 'function') return;
          try { target.addEventListener(eventName, onReady, { once: true }); }
          catch (_) {}
        });
      });

      if (checkHardReady()) {
        finish();
        return;
      }

      let elapsed = 0;
      const step = () => {
        if (settled) return;
        if (checkHardReady()) {
          finish();
          return;
        }
        elapsed += POLL_INTERVAL_MS;
        if (elapsed >= POLL_TIMEOUT_MS) {
          logWarn('hard-ready signal timeout');
          finish();
        }
      };

      const setInt = (global && typeof global.setInterval === 'function') ? global.setInterval : setInterval;
      if (typeof setInt === 'function') {
        pollTimer = setInt(step, POLL_INTERVAL_MS);
      } else {
        const schedule = () => {
          if (settled) return;
          step();
          if (!settled) schedule();
        };
        schedule();
      }
    });
  }

  function hideOverlayOnce(){
    try {
      if (typeof document === 'undefined' || !document) return;
      const overlay = document.querySelector(OVERLAY_SELECTOR);
      if (!overlay) return;
      if (overlay.dataset && overlay.dataset.overlayHidden === '1') return;
      if (overlay.dataset) overlay.dataset.overlayHidden = '1';
      try { overlay.setAttribute('data-state', 'hidden'); }
      catch (_) {}
      if (overlay.style) {
        try { overlay.style.opacity = '0'; } catch (_) {}
        try { overlay.style.pointerEvents = 'none'; } catch (_) {}
        try { overlay.style.visibility = 'hidden'; } catch (_) {}
      }
    } catch (err) {
      logWarn(err);
    }
  }

  try {
    whenHardReady()
      .then(() => afterPaint(hideOverlayOnce))
      .catch((err) => { logWarn(err); afterPaint(hideOverlayOnce); });
  } catch (err) {
    logWarn(err);
    afterPaint(hideOverlayOnce);
  }
})();
