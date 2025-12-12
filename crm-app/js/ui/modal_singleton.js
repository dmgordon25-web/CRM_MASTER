/* crm-app/js/ui/modal_singleton.js */
import { resetScrollLock } from './scroll_lock.js';

const CLEANUP_SYMBOL = Symbol.for('crm.singletonModal.cleanup');

function reportModalError(err){
  if(console && typeof console.error === 'function') console.error('[MODAL_ERROR]', err);
}

// Global safety net for stuck overlays / scroll lock / diagnostics splash
function resetModalSafetyGuards(reason) {
  try {
    const win = typeof window !== 'undefined' ? window : null;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!win || !doc) return;

    // 1) Kill any obvious “full-screen blockers”
    try {
      const zombies = doc.querySelectorAll('.qa-overlay, .modal-backdrop, #app-modal, #diagnostics-splash');
      zombies.forEach(node => {
        if (!node) return;
        try { node.remove(); }
        catch (_) {
          try {
            node.style.pointerEvents = 'none';
            node.style.display = 'none';
            node.setAttribute('aria-hidden', 'true');
          } catch (_) {}
        }
      });
    } catch (_) {}

    // 2) Reset body pointer-events + scroll lock
    const body = doc.body || doc.documentElement || null;
    if (body && body.style) {
      try { body.style.pointerEvents = ''; } catch (_) {}
      try { body.style.overflow = ''; } catch (_) {}
    }

    try {
      // Hard reset scroll lock stack (safe even if nothing is locked)
      resetScrollLock(reason || 'modal-unfreeze');
    } catch (_) {}

    // 3) If diagnostics splash exists, make sure it’s not intercepting clicks
    try {
      const splash = doc.getElementById('diagnostics-splash');
      if (splash && splash.style) {
        splash.style.opacity = '0';
        splash.style.pointerEvents = 'none';
        splash.style.visibility = 'hidden';
      }
    } catch (_) {}

    // 4) If RenderGuard exists and is “stuck”, reset it and nudge a repaint
    try {
      const guard = win.RenderGuard;
      if (guard && typeof guard.__reset === 'function') {
        guard.__reset();
      }
      if (guard && typeof guard.requestRender === 'function') {
        guard.requestRender();
      }
    } catch (err) {
      try {
        console.warn('[UNFREEZE] RenderGuard reset failed', err);
      } catch (_) {}
    }

    // 5) Optional: log once per unfreeze to help diagnostics
    try {
      if (win.__ENV__ && win.__ENV__.DEBUG && console && console.info) {
        console.info('[UNFREEZE] UI safety reset invoked', { reason });
      }
    } catch (_) {}
  } catch (_) {
    // Absolutely never throw from the safety net
  }
}

// Expose for manual debugging (e.g. window.unfreezeCrmUi('manual'))
if (typeof window !== 'undefined' && !window.unfreezeCrmUi) {
  window.unfreezeCrmUi = function(reason) {
    resetModalSafetyGuards(reason || 'manual');
  };
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

  // Always try to restore global UI interactivity when a modal closes.
  try { resetModalSafetyGuards('singleton-close'); } catch (_) {}

  // 1. Run Registered Cleanup Callbacks
  const bucket = root[CLEANUP_SYMBOL];
  if(bucket && bucket.size){
    bucket.forEach(fn => {
      try{ fn(root); } catch(e){ console.warn(e); }
    });
    bucket.clear();
  }

  // 2. Run 'beforeRemove' Hook (Critical for Partner Editor state reset)
  if(typeof options.beforeRemove === 'function'){
    try { options.beforeRemove(root); } catch(e) { console.warn('[Modal] beforeRemove failed', e); }
  }

  // 3. CRITICAL: Close native dialog to release Focus Trap
  if(root.tagName === 'DIALOG' && typeof root.close === 'function'){
    if(root.hasAttribute('open') || root.open){
        try { root.close(); } catch(e) { /* ignore if already closed */ }
        root.removeAttribute('open');
    }
  }

  // 4. Hide or Remove
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

  // FIX: REMOVED document.activeElement.blur()
  // This call was triggering 'focusout' events that crashed the Contact Editor.

  // 1. Force close everything else
  closeAllOtherModals(key);

  // 2. Get or Create
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

  // Native Dialog Open (without throwing if already open)
  if(el.tagName === 'DIALOG' && typeof el.showModal === 'function'){
    if(!el.open && !el.hasAttribute('open')){
       try { el.showModal(); } catch(e) {
         el.setAttribute('open', '');
       }
    }
  }
  return el;
}
