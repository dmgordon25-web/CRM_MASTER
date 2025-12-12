/* crm-app/js/ui/modal_singleton.js */
import scrollLock from './scroll_lock.js';
import { detachLoadingBlock } from './loading_block.js';

const CLEANUP_SYMBOL = Symbol.for('crm.singletonModal.cleanup');

function reportModalError(err){
  if(console && typeof console.error === 'function') console.error('[MODAL_ERROR]', err);
}

export function resetUiInteractivity(reason) {
  try {
    const win = typeof window !== 'undefined' ? window : null;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!win || !doc) return;

    // 1) Kill any obvious overlays / backdrops that can absorb clicks.
    try {
      const blockers = doc.querySelectorAll('.qa-overlay, .modal-backdrop, #diagnostics-splash');
      blockers.forEach(node => {
        if (!node) return;
        try {
          // Prefer removal; fall back to making it inert if removal fails.
          if (node.remove) {
            node.remove();
          } else if (node.parentElement) {
            node.parentElement.removeChild(node);
          }
        } catch (_) {
          try {
            node.style.pointerEvents = 'none';
            node.style.display = 'none';
            node.style.visibility = 'hidden';
            node.setAttribute('aria-hidden', 'true');
          } catch (_) {}
        }
      });
    } catch (_) {}

    // 2) Reset body pointer-events and scroll styles.
    const body = doc.body || doc.documentElement || null;
    if (body && body.style) {
      try { body.style.pointerEvents = ''; } catch (_) {}
      try { body.style.overflow = ''; } catch (_) {}
      try { body.removeAttribute('data-modal-open'); } catch (_) {}
      try { body.classList?.remove('modal-open', 'no-scroll', 'is-loading'); } catch (_) {}
    }

    // 2b) Clear orphaned loading blockers.
    try {
      const loadingHosts = doc.querySelectorAll('.loading-host.is-loading');
      loadingHosts.forEach(node => {
        let guard = 0;
        while (node && node.classList.contains('is-loading') && guard < 5) {
          const before = node.__loadingBlock ? node.__loadingBlock.count : null;
          try { detachLoadingBlock(node); } catch (_) {}
          const after = node.__loadingBlock ? node.__loadingBlock.count : null;
          guard += 1;
          if (before != null && after != null && after >= before) break;
        }
        try {
          if (node.__loadingBlock && node.__loadingBlock.count <= 0) delete node.__loadingBlock;
        } catch (_) {}
        const orphan = node.querySelector ? node.querySelector(':scope > .loading-block') : null;
        if (orphan && orphan.parentNode === node) {
          try { orphan.remove(); } catch (_) { try { node.removeChild(orphan); } catch (__e) {} }
        }
        try { node.classList.remove('is-loading'); node.classList.remove('loading-host'); } catch (_) {}
        try { node.removeAttribute('aria-busy'); } catch (_) {}
      });
    } catch (_) {}

    // 3) Reset scroll-lock bookkeeping (safe even if nothing was locked).
    try {
      if (scrollLock && typeof scrollLock.resetScrollLock === 'function') {
        scrollLock.resetScrollLock(reason || 'modal-unfreeze');
      }
    } catch (_) {}

    // 3b) Remove inert markers so the UI is clickable again.
    try {
      doc.querySelectorAll('[inert]').forEach(el => {
        try { el.removeAttribute('inert'); } catch (_) {}
      });
    } catch (_) {}

    // 4) If RenderGuard exists and is "stuck", reset it as well.
    try {
      const guard = win.RenderGuard;
      if (guard && typeof guard.__reset === 'function') {
        guard.__reset();
      }
    } catch (_) {
      // Swallow; this is a last-resort safety net.
    }

    // 5) Final pointer events reset.
    try { if (body && body.style) body.style.pointerEvents = ''; } catch (_) {}
    try { win.__crmDebugUIState && win.__crmDebugUIState('after-resetUiInteractivity'); } catch (_) {}
  } catch (_) {
    // Never throw from the safety net.
  }
}

function debugUIState(label){
  try {
    const doc = typeof document !== 'undefined' ? document : null;
    if(!doc) return;
    const body = doc.body;
    const overlays = doc.querySelectorAll('.modal-backdrop, .qa-overlay, dialog[open]');
    const loadingHosts = doc.querySelectorAll('.loading-host.is-loading');
    const inertEls = doc.querySelectorAll('[inert]');
    const containerLoading = doc.querySelectorAll('.container.is-loading, #view-dashboard.is-loading');
    const state = {
      label: label || 'ui-state',
      overlays: overlays.length,
      loadingHosts: loadingHosts.length,
      dialogOpen: doc.querySelectorAll('dialog[open]').length,
      qaOverlays: doc.querySelectorAll('.qa-overlay').length,
      backdrops: doc.querySelectorAll('.modal-backdrop').length,
      containerLoading: containerLoading.length,
      bodyLoading: body?.classList?.contains('is-loading') || false,
      bodyPointerEvents: body?.style?.pointerEvents || '',
      bodyOverflow: body?.style?.overflow || '',
      inert: inertEls.length
    };
    // eslint-disable-next-line no-console
    console.info('[CRM_DEBUG_UI]', state);
  } catch (_) {}
}

if(typeof window !== 'undefined'){
  window.__crmDebugUIState = debugUIState;
}

// Expose a manual hook for debugging in the console.
if (typeof window !== 'undefined' && !window.unfreezeCrmUi) {
  window.unfreezeCrmUi = function (reason) {
    resetUiInteractivity(reason || 'manual');
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

  // Global safety net: ensure UI interactivity is restored on every modal close.
  try { resetUiInteractivity('singleton-close'); } catch (_) {}

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

  try {
    if (typeof window !== 'undefined' && typeof window.__resetQuickCreateOverlay === 'function') {
      window.__resetQuickCreateOverlay('editor-close');
    }
  } catch (_) { }
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
