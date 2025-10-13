let overlayRoot = null;
let domReadyHandler = null;
let beforeUnloadHandler = null;
let visibilityChangeHandler = null;
let beforeUnloadAttached = false;
let visibilityChangeAttached = false;

function ensureCanaries(){
  const root = typeof window !== 'undefined' ? window : globalThis;
  if(!root) return;
  root.CRM = root.CRM || {};
  root.CRM.canaries = root.CRM.canaries || {};
}

function appendRoot(){
  if(typeof document === 'undefined' || !document) return;
  if(!overlayRoot) return;
  const body = document.body;
  if(body && typeof body.appendChild === 'function'){
    if(!body.contains(overlayRoot)){
      body.appendChild(overlayRoot);
    }
  }else if(!domReadyHandler && typeof document.addEventListener === 'function'){
    domReadyHandler = () => {
      try { appendRoot(); }
      finally {
        if(typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function'){
          document.removeEventListener('DOMContentLoaded', domReadyHandler);
        }
        domReadyHandler = null;
      }
    };
    document.addEventListener('DOMContentLoaded', domReadyHandler, { once:true });
  }
}

function bindLifecycle(){
  if(typeof window !== 'undefined' && window){
    if(!beforeUnloadAttached){
      beforeUnloadHandler = () => {
        try { teardownDebugOverlay(); }
        catch(_){ }
      };
      try {
        window.addEventListener('beforeunload', beforeUnloadHandler, { once:true });
      } catch(_) {
        try { window.addEventListener('beforeunload', beforeUnloadHandler); }
        catch(_){ }
      }
      beforeUnloadAttached = true;
    }
  }
  if(typeof document !== 'undefined' && document && typeof document.addEventListener === 'function'){
    if(!visibilityChangeAttached){
      visibilityChangeHandler = () => {
        try {
          if(document.visibilityState === 'hidden'){
            teardownDebugOverlay();
          }
        } catch(_){ }
      };
      document.addEventListener('visibilitychange', visibilityChangeHandler);
      visibilityChangeAttached = true;
    }
  }
}

export function mountDebugOverlay(){
  if(typeof document === 'undefined' || !document) return null;
  ensureCanaries();
  if(overlayRoot && overlayRoot.isConnected) return overlayRoot;
  if(!overlayRoot){
    overlayRoot = document.createElement('div');
    overlayRoot.setAttribute('data-qa', 'debug-overlay');
    overlayRoot.style.position = 'fixed';
    overlayRoot.style.top = '0';
    overlayRoot.style.right = '0';
    overlayRoot.style.zIndex = '2147483646';
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.display = 'flex';
    overlayRoot.style.flexDirection = 'column';
    overlayRoot.style.alignItems = 'flex-end';
    overlayRoot.style.gap = '8px';
    overlayRoot.style.padding = '12px';
  }
  appendRoot();
  if(overlayRoot && overlayRoot.style){
    overlayRoot.style.opacity = overlayRoot.style.opacity || '1';
  }
  if(typeof window !== 'undefined' && window && window.CRM && window.CRM.canaries){
    window.CRM.canaries.logOverlayClosed = false;
  }
  bindLifecycle();
  return overlayRoot;
}

export function teardownDebugOverlay(){
  try {
    if(domReadyHandler && typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function'){
      document.removeEventListener('DOMContentLoaded', domReadyHandler);
    }
  } catch(_){ }
  domReadyHandler = null;

  try {
    const node = overlayRoot && overlayRoot.parentNode
      ? overlayRoot
      : (typeof document !== 'undefined' && document ? document.querySelector('[data-qa="debug-overlay"]') : null);
    if(node && node.parentNode && typeof node.parentNode.removeChild === 'function'){
      node.parentNode.removeChild(node);
    }
  } catch(_){ }
  overlayRoot = null;

  if(beforeUnloadAttached && typeof window !== 'undefined' && window && typeof window.removeEventListener === 'function'){
    try { window.removeEventListener('beforeunload', beforeUnloadHandler); }
    catch(_){ }
    beforeUnloadAttached = false;
  }
  beforeUnloadHandler = null;

  if(visibilityChangeAttached && typeof document !== 'undefined' && document && typeof document.removeEventListener === 'function'){
    try { document.removeEventListener('visibilitychange', visibilityChangeHandler); }
    catch(_){ }
    visibilityChangeAttached = false;
  }
  visibilityChangeHandler = null;

  ensureCanaries();
  if(typeof window !== 'undefined' && window && window.CRM && window.CRM.canaries){
    window.CRM.canaries.logOverlayClosed = true;
  }
}

export default { mountDebugOverlay, teardownDebugOverlay };
