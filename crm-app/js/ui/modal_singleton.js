const CLEANUP_SYMBOL = Symbol.for('crm.singletonModal.cleanup');
const MODAL_DEBUG_PARAM = 'modaldebug';
const ENTITY_PARAM_HINTS = ['id', 'partnerId', 'partner', 'contactId', 'contact', 'entityId', 'recordId', 'loanId'];

function reportModalError(err){
  if(!err) return;
  if(console && typeof console.error === 'function'){
    console.error('[MODAL_ERROR]', err);
  }
}

let modalDebugSticky = false;
let modalDebugStorageHooked = false;

function hasDebugToken(input){
  return typeof input === 'string' && input.includes(`${MODAL_DEBUG_PARAM}=1`);
}

function computeModalDebugEnabled(){
  if(typeof window === 'undefined') return false;
  try{
    const loc = window.location;
    if(loc){
      if(hasDebugToken(loc.search)) return true;
      const hash = typeof loc.hash === 'string' ? loc.hash : '';
      if(hasDebugToken(hash)) return true;
      const hashQueryIndex = hash.indexOf('?');
      if(hashQueryIndex !== -1 && hasDebugToken(hash.slice(hashQueryIndex))){
        return true;
      }
    }
  }catch(err){ reportModalError(err); }
  try{
    if(window.localStorage && window.localStorage.getItem(MODAL_DEBUG_PARAM) === '1'){
      return true;
    }
  }catch(err){ reportModalError(err); }
  return false;
}

function hookStorageListener(){
  if(modalDebugStorageHooked) return;
  modalDebugStorageHooked = true;
  if(typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  try{
    window.addEventListener('storage', (event) => {
      if(!event) return;
      if(event.key === MODAL_DEBUG_PARAM){
        modalDebugSticky = false;
      }
    });
  }catch(err){ reportModalError(err); }
}

function isModalDebugEnabled(){
  if(modalDebugSticky) return true;
  const enabled = computeModalDebugEnabled();
  if(enabled){
    modalDebugSticky = true;
  }else{
    hookStorageListener();
  }
  return enabled;
}

function deriveModalId(key, node){
  if(typeof key === 'string' && key) return key;
  const el = toElement(node);
  if(el){
    if(typeof el.dataset?.modalKey === 'string' && el.dataset.modalKey){
      return el.dataset.modalKey;
    }
    const attr = el.getAttribute && el.getAttribute('data-modal-key');
    if(typeof attr === 'string' && attr) return attr;
    if(typeof el.dataset?.ui === 'string' && el.dataset.ui){
      return el.dataset.ui.replace(/-modal$/, '');
    }
  }
  return 'unknown';
}

function readModalContext(){
  const context = { route: '', tab: '', entityId: '', sourceHint: '' };
  if(typeof window === 'undefined' || !window?.location) return context;
  try{
    const hash = typeof window.location.hash === 'string' ? window.location.hash : '';
    const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
    const queryIndex = trimmed.indexOf('?');
    const pathPart = queryIndex === -1 ? trimmed : trimmed.slice(0, queryIndex);
    const queryPart = queryIndex === -1 ? '' : trimmed.slice(queryIndex + 1);
    const segments = pathPart.split('/').map(seg => seg.trim()).filter(Boolean);
    if(segments.length){
      context.route = segments[0];
      if(segments.length > 1){
        context.tab = segments[1];
      }
    }
    if(queryPart){
      let params;
        try{
          params = new URLSearchParams(queryPart);
        }catch(err){
          reportModalError(err);
          params = null;
        }
      if(params){
        if(!context.tab){
          context.tab = params.get('tab')
            || params.get('view')
            || params.get('section')
            || '';
        }
        for(const key of ENTITY_PARAM_HINTS){
          const value = params.get(key);
          if(value){
            context.entityId = value;
            break;
          }
        }
      }
    }
    if(!context.entityId && segments.length > 1){
      const tail = segments.slice(1).reverse().find(seg => /[0-9A-Za-z_-]{3,}/.test(seg));
      if(tail) context.entityId = tail;
    }
  }catch(err){ reportModalError(err); }
  return context;
}

function postModalDebug(payload){
  if(!payload || typeof payload !== 'object') return;
  try{
    const body = JSON.stringify(payload);
    if(typeof navigator !== 'undefined'
      && navigator
      && typeof navigator.sendBeacon === 'function'){
      try{
        if(navigator.sendBeacon('/__log', body)) return;
      }catch(err){ reportModalError(err); }
    }
    if(typeof fetch === 'function'){
      fetch('/__log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    }
  }catch(err){ reportModalError(err); }
}

function emitModalOpenDebug(modalId, debugState, details = {}){
  if(!debugState) return;
  const payload = {
    kind: 'modal-open',
    modalId,
    ts: debugState.time,
    context: debugState.context,
    stack: debugState.stack,
    reused: details.reused === true,
    promise: details.promise === true
  };
  try{
    console.info('[MODAL_OPEN]', {
      modalId,
      time: debugState.time,
      context: debugState.context,
      reused: details.reused === true,
      promise: details.promise === true
    });
    if(debugState.stack){
      console.info('[MODAL_STACK]', debugState.stack);
    }
    }catch(err){ reportModalError(err); }
    postModalDebug(payload);
  }

function emitModalCloseDebug(modalId){
  if(!isModalDebugEnabled()) return;
  const time = Date.now();
  try{
    console.info('[MODAL_CLOSE]', { modalId, time });
  }catch(err){ reportModalError(err); }
  postModalDebug({ kind: 'modal-close', modalId, ts: time });
}

function prepareModalOpenDebug(modalId){
  if(!isModalDebugEnabled()) return null;
  const time = Date.now();
  let stack = '';
  try{ stack = new Error('modal-open').stack || ''; }
  catch(err){
    reportModalError(err);
    stack = '';
  }
  const context = readModalContext();
  return { time, stack, context };
}

function toElement(node){
  if(!node) return null;
  if(node.nodeType === Node.ELEMENT_NODE) return /** @type {HTMLElement} */ (node);
  if('host' in node && node.host instanceof HTMLElement) return node.host;
  return null;
}

function focusModalRoot(root){
  if(!root) return;
  const shell = typeof root.querySelector === 'function'
    ? root.querySelector('.dlg, [role="document"], [data-modal-shell]')
    : null;
  const target = shell instanceof HTMLElement ? shell : root;
  if(typeof target.focus === 'function'){
    try{ target.focus({ preventScroll: true }); }
    catch(err){
      reportModalError(err);
      try{ target.focus(); }
      catch(innerErr){ reportModalError(innerErr); }
    }
  }
  if(root.style){
    const currentZ = Number.parseInt(root.style.zIndex || '', 10);
    if(Number.isNaN(currentZ) || currentZ < 1000){
      root.style.zIndex = '1400';
    }
  }
}

function tagModalKey(root, key){
  const el = toElement(root);
  if(!el) return el;
  el.setAttribute('data-modal-key', key);
  if(el.dataset){
    el.dataset.modalKey = key;
  }
  if(!el.getAttribute('data-ui')){
    el.setAttribute('data-ui', `${key}-modal`);
  }
  if(el.dataset && !el.dataset.ui){
    el.dataset.ui = `${key}-modal`;
  }
  if(!el[CLEANUP_SYMBOL]){
    el[CLEANUP_SYMBOL] = new Set();
  }
  return el;
}

function closeAllOtherModals(currentKey){
  if(typeof document === 'undefined') return;
  try{
    const allModals = document.querySelectorAll('[data-modal-key]');
    allModals.forEach(modal => {
      const modalKey = modal.getAttribute('data-modal-key');
      if(modalKey && modalKey !== currentKey){
        closeSingletonModal(modal, { remove: false });
      }
    });
  }catch(err){
    reportModalError(err);
  }
}

export function ensureSingletonModal(key, createFn){
  if(typeof document === 'undefined') return null;
  const initialId = deriveModalId(key);
  const debugState = prepareModalOpenDebug(initialId);
  const selector = `[data-modal-key="${key}"]`;
  const existing = document.querySelector(selector);
  if(existing){
    const el = tagModalKey(existing, key);
    closeAllOtherModals(key);
    focusModalRoot(el);
    if(debugState){
      const modalId = deriveModalId(key, el);
      emitModalOpenDebug(modalId, debugState, { reused: true });
    }
    return el;
  }
  closeAllOtherModals(key);
  const created = typeof createFn === 'function' ? createFn() : null;
  if(created instanceof Promise){
    return created.then(node => {
      const el = tagModalKey(node, key);
      focusModalRoot(el);
      if(debugState){
        const modalId = deriveModalId(key, el);
        emitModalOpenDebug(modalId, debugState, { promise: true });
      }
      return el;
    });
  }
  const el = tagModalKey(created, key);
  focusModalRoot(el);
  if(debugState){
    const modalId = deriveModalId(key, el);
    emitModalOpenDebug(modalId, debugState);
  }
  return el;
}

export function registerModalCleanup(root, cleanup){
  if(!root || typeof cleanup !== 'function') return;
  const el = toElement(root);
  if(!el) return;
  let bucket = el[CLEANUP_SYMBOL];
  if(!bucket){
    bucket = new Set();
    el[CLEANUP_SYMBOL] = bucket;
  }
  bucket.add(cleanup);
}

export function closeSingletonModal(target, options = {}){
  if(typeof document === 'undefined') return;
  const key = typeof target === 'string' ? target : null;
  let root = null;
  if(key){
    root = document.querySelector(`[data-modal-key="${key}"]`);
  }else{
    root = toElement(target);
  }
  if(!root) return;
  const modalId = deriveModalId(key, root);
  const bucket = root[CLEANUP_SYMBOL];
  if(bucket && bucket.size){
    const cleaners = Array.from(bucket);
    try{
      cleaners.forEach(fn => {
        if(typeof fn !== 'function') return;
        try{ fn(root); }
        catch(err){
          if(console && typeof console.error === 'function'){
            console.error('[MODAL_CLEANUP_ERROR]', err);
          }
        }
      });
    }finally{
      bucket.clear();
    }
  }
  if(typeof options.beforeRemove === 'function'){
    try{ options.beforeRemove(root); }
    catch(err){ reportModalError(err); }
  }
  if(options.remove !== false){
    const parent = root.parentNode;
    if(parent){
      try{
        parent.removeChild(root);
      }catch(err){
        reportModalError(err);
        if(typeof root.remove === 'function'){
          try{ root.remove(); }
          catch(innerErr){ reportModalError(innerErr); }
        }
      }
    }else if(typeof root.remove === 'function'){
      try{ root.remove(); }
      catch(err){ reportModalError(err); }
    }
  }else if(root.style){
    root.style.display = 'none';
  }
  root[CLEANUP_SYMBOL] = new Set();
  emitModalCloseDebug(modalId);
}
