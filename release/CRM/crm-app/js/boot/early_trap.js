/* Early trap: intercept fatal errors before boot, surface diagnostics, and mark boot state */

// FIX: Capture Smoke Test flag immediately before Router clears the URL
(function(){
  try {
    if (window.location && window.location.search && window.location.search.indexOf('skipBootAnimation') !== -1) {
      window.__SKIP_BOOT_ANIMATION__ = true;
    }
  } catch (_) {}
})();

(function(){
  const global = (typeof window !== 'undefined') ? window : (typeof self !== 'undefined' ? self : null);
  if (!global) return;

  const doc = typeof document !== 'undefined' ? document : null;
  const state = global.__BOOT_EARLY_TRAP_STATE__ = global.__BOOT_EARLY_TRAP_STATE__ || {};

  let fatalNoted = !!state.fatalAt;
  let readyNoted = state.bootState === 'ready';
  let splashWasVisible = false;
  let pendingBootState = state.bootState && doc && doc.body ? null : (state.bootState || null);

  function now(){
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return Math.round(performance.now());
    }
    return Date.now();
  }

  function setBootDataAttr(value){
    if (!doc) return;
    const body = doc.body;
    if (!body) {
      pendingBootState = value || null;
      return;
    }
    if (!value) {
      body.removeAttribute('data-boot');
      return;
    }
    body.setAttribute('data-boot', value);
  }

  function flushPendingBootState(){
    if (!pendingBootState) return;
    const value = pendingBootState;
    pendingBootState = null;
    setBootDataAttr(value);
  }

  if (doc) {
    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', flushPendingBootState, { once: true });
    } else {
      flushPendingBootState();
    }
  }

  function fallbackOverlay(payload){
    if (!doc) return;
    const diagHost = doc.getElementById('diagnostics');
    const host = diagHost || doc.body;
    if (!host) return;
    if (diagHost) {
      try { diagHost.hidden = false; } catch (_) {}
      try { diagHost.innerHTML = ''; } catch (_) {}
    }
    const container = doc.getElementById('diagnostics-fallback') || (function(){
      const el = doc.createElement('div');
      el.id = 'diagnostics-fallback';
      el.style.background = 'rgba(15, 23, 42, 0.92)';
      el.style.color = '#f8fafc';
      el.style.padding = '24px';
      el.style.borderRadius = '12px';
      el.style.maxWidth = '520px';
      el.style.margin = '24px auto';
      el.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      el.style.boxShadow = '0 20px 60px rgba(15,23,42,0.45)';
      el.style.wordBreak = 'break-word';
      if (host === doc.body) {
        el.style.position = 'relative';
        el.style.zIndex = '2147483600';
      }
      host.appendChild(el);
      return el;
    })();
    if (container) {
      container.textContent = '';
      const title = doc.createElement('h3');
      title.textContent = 'Boot diagnostics';
      title.style.marginTop = '0';
      const summary = doc.createElement('p');
      summary.textContent = payload && payload.message ? String(payload.message) : 'Boot halted before startup.';
      summary.style.whiteSpace = 'pre-wrap';
      const detail = doc.createElement('pre');
      detail.textContent = payload && payload.detail ? String(payload.detail) : '';
      detail.style.overflowX = 'auto';
      detail.style.whiteSpace = 'pre-wrap';
      detail.style.marginTop = '16px';
      detail.style.background = 'rgba(15,23,42,0.6)';
      detail.style.padding = '12px';
      detail.style.borderRadius = '8px';
      container.appendChild(title);
      container.appendChild(summary);
      if (detail.textContent) {
        container.appendChild(detail);
      }
    }
  }

  function normalizeError(value){
    if (!value) {
      return { message: 'Unknown error', detail: '', name: '' };
    }
    if (value instanceof Error) {
      return {
        name: value.name || 'Error',
        message: value.message || String(value),
        detail: value.stack || value.message || String(value)
      };
    }
    if (typeof value === 'object') {
      const name = typeof value.name === 'string' ? value.name : '';
      const message = typeof value.message === 'string'
        ? value.message
        : (typeof value.reason === 'string' ? value.reason : JSON.stringify(value, null, 2));
      const stack = typeof value.stack === 'string' ? value.stack : '';
      return {
        name,
        message: message || String(value),
        detail: stack || message || String(value)
      };
    }
    const text = String(value);
    return { name: '', message: text, detail: text };
  }

  function sendLog(kind, payload){
    try {
      const basePayload = {
        kind,
        ts: Date.now(),
        href: (typeof location !== 'undefined' && location && location.href) ? location.href : ''
      };
      const body = JSON.stringify({ ...basePayload, ...payload });
      let delivered = false;
      if (typeof navigator !== 'undefined' && navigator && typeof navigator.sendBeacon === 'function') {
        try {
          delivered = navigator.sendBeacon('/__log', body) === true;
        } catch (_) {}
      }
      if (delivered) return;
      if (typeof fetch !== 'function') return;
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (_) {}
  }

  function rememberFatal(payload){
    state.fatalEvents = state.fatalEvents || [];
    state.fatalEvents.push(payload);
    state.lastFatal = payload;
    state.pendingOverlay = payload;
  }

  function showOverlay(payload){
    try {
      if (typeof global.showDiagnosticsOverlay === 'function') {
        global.showDiagnosticsOverlay(payload);
        state.pendingOverlay = null;
        return;
      }
    } catch (_) {}
    fallbackOverlay(payload);
  }

  function ensureSplashVisible(){
    if (!doc) return;
    try {
      const el = doc.getElementById('diagnostics-splash');
      if (el) {
        el.style.display = 'block';
      }
    } catch (_) {}
  }

  function markFatal(payload){
    if (fatalNoted) {
      showOverlay(payload);
      return;
    }
    fatalNoted = true;
    readyNoted = true;
    state.fatalAt = Date.now();
    state.bootState = 'fatal';
    try { global.__BOOT_FATAL__ = true; } catch (_) {}
    setBootDataAttr('fatal');
    ensureSplashVisible();
    rememberFatal(payload);
    showOverlay(payload);
  }

  function afterPaint(fn){
    if (typeof fn !== 'function') return;
    const safeRun = () => {
      try { fn(); }
      catch (_) {}
    };
    const raf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame.bind(global) : null;
    if (raf) {
      raf(() => {
        if (fatalNoted) return;
        if (raf) {
          raf(() => { if (!fatalNoted) safeRun(); });
        } else {
          safeRun();
        }
      });
      return;
    }
    if (typeof global.setTimeout === 'function') {
      global.setTimeout(() => { if (!fatalNoted) safeRun(); }, 16);
      return;
    }
    safeRun();
  }

  function markReady(){
    if (fatalNoted || readyNoted) return;
    readyNoted = true;
    state.readyAt = Date.now();
    state.bootState = 'ready';
    afterPaint(() => {
      if (fatalNoted) return;
      setBootDataAttr('ready');
    });
  }

  function monitorSplash(){
    if (!doc) return;

    const attach = () => {
      const splash = doc.getElementById('diagnostics-splash');
      if (!splash) return;

      const compute = () => {
        if (!splash) return;
        let display = '';
        let inlineDisplay = '';
        try {
          inlineDisplay = splash.style && typeof splash.style.display === 'string' ? splash.style.display : '';
          display = inlineDisplay;
        } catch (_) {}
        if (!display && typeof global.getComputedStyle === 'function') {
          try {
            display = global.getComputedStyle(splash).display;
          } catch (_) {}
        }
        if (inlineDisplay) {
          if (inlineDisplay !== 'none') {
            splashWasVisible = true;
          } else if (!splashWasVisible) {
            splashWasVisible = true;
          }
        }
        if (!inlineDisplay && display && display !== 'none') {
          splashWasVisible = true;
        }
        const hiddenToken = (splash.dataset && splash.dataset.overlayHidden === '1')
          || splash.getAttribute('data-state') === 'hidden';
        const isHidden = hiddenToken || display === 'none';
        if (splashWasVisible && isHidden) {
          markReady();
          return true;
        }
        return false;
      };

      compute();

      if (typeof MutationObserver === 'function') {
        const observer = new MutationObserver(() => {
          if (fatalNoted) {
            observer.disconnect();
            return;
          }
          if (compute()) {
            observer.disconnect();
          }
        });
        try {
          observer.observe(splash, { attributes: true, attributeFilter: ['style', 'data-overlay-hidden', 'data-state'] });
        } catch (_) {}
      }
    };

    if (doc.readyState === 'loading') {
      doc.addEventListener('DOMContentLoaded', attach, { once: true });
    } else {
      attach();
    }
  }

  monitorSplash();

  function handleFatal(kind, errorValue){
    const normalized = normalizeError(errorValue);
    const payload = {
      kind,
      at: Date.now(),
      message: normalized.message,
      name: normalized.name,
      detail: normalized.detail,
      clock: now()
    };
    markFatal(payload);
    sendLog(`boot.${kind}`, { message: normalized.message, name: normalized.name, detail: normalized.detail });
  }

  const previousOnError = typeof global.onerror === 'function' ? global.onerror : null;
  global.onerror = function(message, source, lineno, colno, error){
    handleFatal('unhandled', error || message);
    if (previousOnError) {
      try { return previousOnError.apply(this, arguments); }
      catch (_) {}
    }
    return false;
  };

  const previousOnUnhandledRejection = typeof global.onunhandledrejection === 'function'
    ? global.onunhandledrejection
    : null;
  global.onunhandledrejection = function(event){
    const reason = event && (event.reason !== undefined ? event.reason : event);
    handleFatal('unhandledrejection', reason);
    if (previousOnUnhandledRejection) {
      try { return previousOnUnhandledRejection.apply(this, arguments); }
      catch (_) {}
    }
    return false;
  };

  function ensureSplashOnEvents(){
    const events = ['error', 'unhandledrejection'];
    events.forEach((eventName) => {
      try {
        global.addEventListener(eventName, ensureSplashVisible, { once: true });
      } catch (_) {}
    });
  }

  ensureSplashOnEvents();

  const stubOverlay = function(payload){
    state.pendingOverlay = payload;
    fallbackOverlay(payload);
  };

  if (typeof global.showDiagnosticsOverlay !== 'function') {
    global.showDiagnosticsOverlay = stubOverlay;
  }

  if (state.pendingOverlay && typeof global.showDiagnosticsOverlay === 'function'
    && global.showDiagnosticsOverlay !== stubOverlay) {
    try { global.showDiagnosticsOverlay(state.pendingOverlay); }
    catch (_) { fallbackOverlay(state.pendingOverlay); }
  }

  const hardReadyEvents = [
    'boot:hard-ready',
    'services-ready',
    'services:ready',
    'crm:services-ready',
    'servicesRegistry:ready',
    'crm:servicesRegistry:ready'
  ];

  hardReadyEvents.forEach((eventName) => {
    try {
      global.addEventListener(eventName, () => markReady(), { once: true });
    } catch (_) {}
    if (doc) {
      try {
        doc.addEventListener(eventName, () => markReady(), { once: true });
      } catch (_) {}
    }
  });

  global.__BOOT_EARLY_TRAP__ = {
    markFatal,
    markReady,
    state,
    setBootState: setBootDataAttr
  };
})();
