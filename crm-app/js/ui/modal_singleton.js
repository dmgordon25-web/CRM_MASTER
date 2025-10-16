const CLEANUP_SYMBOL = Symbol.for('crm.singletonModal.cleanup');

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
    catch(_err){
      try{ target.focus(); }
      catch(__err){}
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

export function ensureSingletonModal(key, createFn){
  if(typeof document === 'undefined') return null;
  const selector = `[data-modal-key="${key}"]`;
  const existing = document.querySelector(selector);
  if(existing){
    const el = tagModalKey(existing, key);
    focusModalRoot(el);
    return el;
  }
  const created = typeof createFn === 'function' ? createFn() : null;
  if(created instanceof Promise){
    return created.then(node => {
      const el = tagModalKey(node, key);
      focusModalRoot(el);
      return el;
    });
  }
  const el = tagModalKey(created, key);
  focusModalRoot(el);
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
  const bucket = root[CLEANUP_SYMBOL];
  if(bucket && bucket.size){
    bucket.forEach(fn => {
      try{ fn(root); }
      catch(_err){}
    });
    bucket.clear();
  }
  if(typeof options.beforeRemove === 'function'){
    try{ options.beforeRemove(root); }
    catch(_err){}
  }
  if(options.remove !== false){
    const parent = root.parentNode;
    if(parent){
      parent.removeChild(root);
    }
  }
  root[CLEANUP_SYMBOL] = new Set();
}
