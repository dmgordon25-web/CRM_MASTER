/* crm-app/js/ui/modal_singleton.js */
const CLEANUP_SYMBOL = Symbol.for('crm.singletonModal.cleanup');

function reportModalError(err){
  if(console && typeof console.error === 'function') console.error('[MODAL_ERROR]', err);
}

function toElement(node){
  if(!node) return null;
  if(node.nodeType === Node.ELEMENT_NODE) return node;
  if('host' in node && node.host instanceof HTMLElement) return node.host;
  return null;
}

function deriveModalId(key, node){
  if(typeof key === 'string' && key) return key;
  const el = toElement(node);
  if(el){
    if(el.dataset?.modalKey) return el.dataset.modalKey;
    if(el.getAttribute('data-modal-key')) return el.getAttribute('data-modal-key');
  }
  return 'unknown';
}

function tagModalKey(root, key){
  const el = toElement(root);
  if(!el) return el;
  el.setAttribute('data-modal-key', key);
  if(el.dataset) el.dataset.modalKey = key;
  if(!el[CLEANUP_SYMBOL]) el[CLEANUP_SYMBOL] = new Set();
  return el;
}

export function registerModalCleanup(root, cleanup){
  if(!root || typeof cleanup !== 'function') return;
  const el = toElement(root);
  if(!el) return;
  if(!el[CLEANUP_SYMBOL]) el[CLEANUP_SYMBOL] = new Set();
  el[CLEANUP_SYMBOL].add(cleanup);
}

export function closeSingletonModal(target, options = {}){
  if(typeof document === 'undefined') return;
  const key = typeof target === 'string' ? target : null;
  let root = key ? document.querySelector(`[data-modal-key="${key}"]`) : toElement(target);

  if(!root) return;

  // 1. Run Cleanup Callbacks (Prevent memory leaks/zombie listeners)
  const bucket = root[CLEANUP_SYMBOL];
  if(bucket && bucket.size){
    bucket.forEach(fn => {
      try{ fn(root); } catch(e){ console.warn(e); }
    });
    bucket.clear();
  }

  // 2. CRITICAL: Close the native dialog to release the Focus Trap
  if(root.tagName === 'DIALOG' && typeof root.close === 'function' && root.open){
    try { root.close(); } catch(e) { /* ignore */ }
    root.removeAttribute('open');
  }

  // 3. Hide/Remove
  if(options.remove !== false){
    try { root.remove(); } catch(e) { if(root.parentNode) root.parentNode.removeChild(root); }
  } else {
    root.classList.add('hidden');
    root.style.display = 'none';
    root.setAttribute('aria-hidden', 'true');
  }
}

function closeAllOtherModals(currentKey){
  if(typeof document === 'undefined') return;
  // Find anything that looks like a modal and kill it
  const all = document.querySelectorAll('[data-modal-key], dialog[open], .record-modal:not(.hidden)');
  all.forEach(el => {
    const key = el.getAttribute('data-modal-key');
    if(key !== currentKey){
      closeSingletonModal(el, { remove: true });
    }
  });
}

export function ensureSingletonModal(key, createFn){
  if(typeof document === 'undefined') return null;

  // 1. Safety Blur (Stops focus fighting immediately)
  if(document.activeElement && document.activeElement !== document.body){
    try { document.activeElement.blur(); } catch(e){}
  }

  // 2. Force close everything else
  closeAllOtherModals(key);

  // 3. Resolve Element
  const selector = `[data-modal-key="${key}"]`;
  let el = document.querySelector(selector);

  if(!el && typeof createFn === 'function'){
    const result = createFn();
    if(result instanceof Promise){
      return result.then(newNode => setupModal(newNode, key));
    }
    el = result;
  }

  return setupModal(el, key);
}

function setupModal(el, key){
  if(!el) return null;
  el = tagModalKey(el, key);

  // Ensure visible
  el.classList.remove('hidden');
  el.style.display = '';
  el.removeAttribute('aria-hidden');

  // Native Dialog Open
  if(el.tagName === 'DIALOG' && typeof el.showModal === 'function'){
    if(!el.open){
       try { el.showModal(); } catch(e) {
         el.setAttribute('open', '');
       }
    }
  }
  return el;
}
