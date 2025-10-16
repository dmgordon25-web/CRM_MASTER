const globalScope = typeof window !== 'undefined'
  ? window
  : (typeof globalThis !== 'undefined' ? globalThis : null);

function fallbackRender(message, stackTop){
  if (typeof document === 'undefined' || !document) return;
  try {
    const doc = document;
    const target = doc.body || doc.documentElement;
    if (target && typeof target.setAttribute === 'function') {
      target.setAttribute('data-boot', 'fatal');
    }
    let host = doc.getElementById('diagnostics');
    if (host) {
      host.hidden = false;
      while (host.firstChild) host.removeChild(host.firstChild);
      const text = stackTop ? `${message}\n${stackTop}` : message;
      host.textContent = text;
      return;
    }
    if (!doc.body) return;
    let panel = doc.getElementById('boot-fatal-overlay');
    if (!panel) {
      panel = doc.createElement('div');
      panel.id = 'boot-fatal-overlay';
      doc.body.appendChild(panel);
    }
    const text = stackTop ? `${message}\n${stackTop}` : message;
    panel.textContent = text;
  } catch (_err) {}
}

export function showFatal(message, stackTop){
  if (!globalScope) {
    fallbackRender(message || 'Boot failure', stackTop || null);
    return;
  }
  const render = typeof globalScope.__BOOT_FATAL_RENDER__ === 'function'
    ? globalScope.__BOOT_FATAL_RENDER__
    : null;
  if (render) {
    try { render(message, stackTop || null); }
    catch (_err) {}
  } else {
    fallbackRender(message || 'Boot failure', stackTop || null);
  }
}

function attachOverlay(value){
  if (!value || typeof value !== 'object') {
    value = {};
  }
  if (typeof value.showFatal !== 'function') {
    value.showFatal = showFatal;
  }
  return value;
}

let overlayStore = attachOverlay(globalScope ? globalScope.__DBG_OVERLAY__ : {});

if (globalScope) {
  let defined = false;
  const existing = Object.getOwnPropertyDescriptor(globalScope, '__DBG_OVERLAY__');
  if (!existing || existing.configurable) {
    try {
      Object.defineProperty(globalScope, '__DBG_OVERLAY__', {
        configurable: true,
        enumerable: true,
        get(){ return overlayStore; },
        set(value){ overlayStore = attachOverlay(value); }
      });
      defined = true;
    } catch (_err) {}
  }
  if (!defined) {
    overlayStore = attachOverlay(globalScope.__DBG_OVERLAY__);
  }
  overlayStore = attachOverlay(overlayStore);
  try {
    globalScope.__DBG_OVERLAY__ = overlayStore;
  } catch (_err) {}
}

export default { showFatal };
