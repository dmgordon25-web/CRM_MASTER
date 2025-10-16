/* Early trap: ensures visible signal + logging on unhandled errors before boot */
(function(){
  if (typeof window === 'undefined') return;
  if (window.__EARLY_TRAP_INSTALLED__) return;
  window.__EARLY_TRAP_INSTALLED__ = true;

  const global = window;
  let pendingFatal = null;
  let pendingFlushHooked = false;

  function log(kind, payload){
    try {
      if (typeof fetch !== 'function') return;
      const body = JSON.stringify({
        kind,
        ts: Date.now(),
        href: location && typeof location.href === 'string' ? location.href : null,
        ...payload
      });
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(()=>{});
    } catch (_err) {}
  }

  function showSplash(){
    try {
      const el = document.getElementById('diagnostics-splash');
      if (el) {
        el.style.display = 'block';
      }
    } catch (_err) {}
  }

  function markFatal(){
    global.__BOOT_FATAL__ = true;
    try {
      const doc = global.document;
      if (!doc) return;
      const target = doc.body || doc.documentElement;
      if (target && typeof target.setAttribute === 'function') {
        target.setAttribute('data-boot', 'fatal');
      }
    } catch (_err) {}
  }

  function clearChildren(node){
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function applyPanelStyles(panel){
    if (!panel || !panel.style) return;
    panel.style.position = 'fixed';
    panel.style.inset = '0';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.alignItems = 'center';
    panel.style.justifyContent = 'center';
    panel.style.background = 'rgba(15, 23, 42, 0.94)';
    panel.style.color = '#f8fafc';
    panel.style.padding = '32px';
    panel.style.boxSizing = 'border-box';
    panel.style.zIndex = '2147483646';
    panel.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    panel.style.textAlign = 'center';
    panel.style.gap = '12px';
    panel.style.pointerEvents = 'auto';
  }

  function renderFatalImmediate(message, stackTop){
    const doc = global.document;
    if (!doc) return;

    let panel = null;
    const host = doc.getElementById('diagnostics');
    if (host) {
      host.hidden = false;
      clearChildren(host);
      panel = host;
    } else if (doc.body) {
      panel = doc.getElementById('boot-fatal-overlay');
      if (!panel) {
        panel = doc.createElement('div');
        panel.id = 'boot-fatal-overlay';
        doc.body.appendChild(panel);
      } else {
        clearChildren(panel);
      }
    }
    if (!panel) return;

    applyPanelStyles(panel);
    panel.setAttribute('role', 'alert');
    panel.setAttribute('data-boot-state', 'fatal');

    const wrap = doc.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.gap = '12px';
    wrap.style.maxWidth = '720px';
    wrap.style.width = '100%';

    const heading = doc.createElement('h2');
    heading.textContent = 'Boot failure';
    heading.style.margin = '0';
    heading.style.fontSize = '20px';
    heading.style.fontWeight = '700';
    heading.style.textAlign = 'center';
    wrap.appendChild(heading);

    const messageEl = doc.createElement('p');
    messageEl.textContent = message || 'Unhandled error during boot.';
    messageEl.style.margin = '0';
    messageEl.style.fontSize = '16px';
    messageEl.style.fontWeight = '500';
    messageEl.style.textAlign = 'center';
    messageEl.style.maxWidth = '680px';
    wrap.appendChild(messageEl);

    if (stackTop) {
      const stackEl = doc.createElement('code');
      stackEl.textContent = stackTop;
      stackEl.style.background = 'rgba(15, 23, 42, 0.55)';
      stackEl.style.padding = '8px 12px';
      stackEl.style.borderRadius = '6px';
      stackEl.style.fontSize = '13px';
      stackEl.style.whiteSpace = 'pre-wrap';
      stackEl.style.wordBreak = 'break-word';
      stackEl.style.maxWidth = '680px';
      stackEl.style.textAlign = 'left';
      wrap.appendChild(stackEl);
    }

    const help = doc.createElement('div');
    help.style.display = 'flex';
    help.style.flexDirection = 'column';
    help.style.alignItems = 'center';
    help.style.gap = '4px';
    help.style.fontSize = '14px';
    help.style.opacity = '0.85';

    const hint = doc.createElement('span');
    hint.textContent = 'Check /__log for full diagnostics or refresh to retry.';
    hint.style.textAlign = 'center';
    help.appendChild(hint);

    const safeLink = doc.createElement('a');
    safeLink.href = '?safe=1';
    safeLink.textContent = 'Launch Safe Mode';
    safeLink.style.color = '#34d399';
    safeLink.style.fontWeight = '600';
    safeLink.style.textDecoration = 'underline';
    help.appendChild(safeLink);

    wrap.appendChild(help);
    panel.appendChild(wrap);
  }

  function flushPending(){
    if (!pendingFatal) return;
    const payload = pendingFatal;
    pendingFatal = null;
    try {
      renderFatalImmediate(payload.message, payload.stackTop);
    } catch (_err) {}
  }

  function showFatal(message, stackTop){
    const doc = global.document;
    if (!doc || (doc.readyState === 'loading' && !doc.body)) {
      pendingFatal = { message, stackTop };
      if (doc && !pendingFlushHooked && typeof doc.addEventListener === 'function') {
        pendingFlushHooked = true;
        doc.addEventListener('DOMContentLoaded', () => {
          pendingFlushHooked = false;
          flushPending();
        }, { once: true });
      }
      return;
    }
    flushPending();
    renderFatalImmediate(message, stackTop);
  }

  function ensureFatalRenderer(){
    if (typeof global.__BOOT_FATAL_RENDER__ === 'function') {
      return global.__BOOT_FATAL_RENDER__;
    }
    global.__BOOT_FATAL_RENDER__ = showFatal;
    return showFatal;
  }

  function extractStackTop(error){
    if (!error || typeof error !== 'object') return null;
    const raw = typeof error.stack === 'string' ? error.stack.split('\n') : null;
    if (!raw || !raw.length) return null;
    for (let i = 1; i < raw.length; i += 1) {
      const line = raw[i];
      if (line && line.trim()) {
        return line.trim();
      }
    }
    const fallback = raw[0];
    return fallback && fallback.trim() ? fallback.trim() : null;
  }

  function normalizeErrorEvent(evt){
    const err = evt && evt.error;
    let message = '';
    if (err && typeof err === 'object') {
      if (typeof err.message === 'string' && err.message) {
        message = err.message;
      } else {
        try { message = String(err); }
        catch (_err) { message = 'Unhandled error'; }
      }
    } else if (evt && typeof evt.message === 'string' && evt.message) {
      message = evt.message;
    } else {
      message = 'Unhandled error';
    }
    const stackTop = extractStackTop(err);
    if (!stackTop && evt) {
      const parts = [];
      if (typeof evt.filename === 'string' && evt.filename) {
        parts.push(evt.filename);
      }
      const hasLine = typeof evt.lineno === 'number' && Number.isFinite(evt.lineno);
      const hasCol = typeof evt.colno === 'number' && Number.isFinite(evt.colno);
      if (hasLine) {
        const suffix = hasCol ? `${evt.lineno}:${evt.colno}` : `${evt.lineno}`;
        parts.push(suffix);
      } else if (hasCol) {
        parts.push(String(evt.colno));
      }
      if (parts.length) {
        const location = parts.join(':');
        if (location && !message.includes(location)) {
          message = `${message} @ ${location}`;
        }
      }
    }
    const context = {};
    if (evt && typeof evt.filename === 'string' && evt.filename) context.file = evt.filename;
    if (evt && typeof evt.lineno === 'number' && Number.isFinite(evt.lineno)) context.line = evt.lineno;
    if (evt && typeof evt.colno === 'number' && Number.isFinite(evt.colno)) context.col = evt.colno;
    return { message, stackTop, context };
  }

  function normalizeRejectionEvent(evt){
    const reason = evt ? evt.reason : null;
    if (reason && typeof reason === 'object') {
      let message = '';
      if (typeof reason.message === 'string' && reason.message) {
        message = reason.message;
      } else {
        try { message = String(reason); }
        catch (_err) { message = 'Unhandled promise rejection'; }
      }
      const stackTop = extractStackTop(reason);
      return { message, stackTop, context: {} };
    }
    if (typeof reason === 'string' && reason) {
      return { message: reason, stackTop: null, context: {} };
    }
    return { message: 'Unhandled promise rejection', stackTop: null, context: {} };
  }

  function recordFatal(kind, detail){
    markFatal();
    showSplash();
    const render = ensureFatalRenderer();
    try { render(detail.message, detail.stackTop || null); }
    catch (_err) {}
    global.__BOOT_FATAL_DETAIL__ = {
      kind,
      message: detail.message,
      stack: detail.stackTop || null,
      at: Date.now()
    };
    const payload = { err: detail.message };
    if (detail.stackTop) payload.stack = detail.stackTop;
    if (detail.context && typeof detail.context === 'object') {
      Object.assign(payload, detail.context);
    }
    log(kind, payload);
  }

  ensureFatalRenderer();

  if (typeof document !== 'undefined' && document && document.readyState !== 'loading') {
    flushPending();
  }

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('error', (evt) => {
      const detail = normalizeErrorEvent(evt || {});
      recordFatal('boot.unhandled', detail);
    });
    global.addEventListener('unhandledrejection', (evt) => {
      const detail = normalizeRejectionEvent(evt || {});
      recordFatal('boot.unhandledrejection', detail);
    });
  }
})();
