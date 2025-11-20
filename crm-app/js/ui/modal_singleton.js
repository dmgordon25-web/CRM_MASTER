/* crm-app/js/ui/modal_singleton.js */

// TRACKING STATE
let currentOpenModalId = null;
let currentModalElement = null;

// Symbol for storing cleanup callbacks on modal elements
const CLEANUP_CALLBACKS_KEY = Symbol('modalCleanupCallbacks');

/**
 * Strictly ensures only one modal is open at a time.
 * Force-closes any existing modal before allowing a new one.
 */
export async function ensureSingletonModal(key, createFn) {
  // 1. Check if we are already open with this key
  if (currentOpenModalId === key && currentModalElement && currentModalElement.isConnected) {
    return currentModalElement; // Already open, do nothing
  }

  // 2. Force close ANY active modal to prevent Focus Traps/Deadlocks
  if (currentOpenModalId || currentModalElement) {
    console.log(`[Modal] Force-closing collision: ${currentOpenModalId} -> ${key}`);
    closeSingletonModal(currentOpenModalId, { remove: true });
  }

  // 3. Cleanup DOM just in case (Zombie Modals)
  const zombies = document.querySelectorAll('dialog[open], .record-modal:not(.hidden)');
  zombies.forEach(el => {
    if (el.dataset.modalKey !== key) {
      try { el.close(); } catch(e) {}
      try { el.classList.add('hidden'); } catch(e) {}
      try { el.style.display = 'none'; } catch(e) {}
    }
  });

  // 4. Create/Get the new modal
  let el = document.querySelector(`[data-modal-key="${key}"]`);

  if (!el && typeof createFn === 'function') {
    const result = createFn();
    el = result instanceof Promise ? await result : result;
  }

  if (!el) {
    console.error(`[Modal] Failed to create modal for key: ${key}`);
    return null;
  }

  // 5. Set State
  currentOpenModalId = key;
  currentModalElement = el;

  // 6. Tag & Show
  el.dataset.modalKey = key;
  el.dataset.ui = `${key}-modal`;
  el.classList.remove('hidden');
  el.style.display = '';
  el.removeAttribute('aria-hidden');

  if (el.tagName === 'DIALOG' && typeof el.showModal === 'function') {
    // Avoid "InvalidStateError" if already open
    if (!el.hasAttribute('open')) {
      el.showModal();
    }
  }

  return el;
}

export function closeSingletonModal(target, options = {}) {
  // Allow passing key string OR element
  let el = target;
  if (typeof target === 'string') {
    el = document.querySelector(`[data-modal-key="${target}"]`);
  }

  // If we are closing the "Current" modal, clear state
  if (currentModalElement === el || (target && target === currentOpenModalId)) {
    currentOpenModalId = null;
    currentModalElement = null;
  }

  if (!el) return;

  // 1. Execute cleanup callbacks BEFORE closing (wrapped individually for safety)
  if (el[CLEANUP_CALLBACKS_KEY] && Array.isArray(el[CLEANUP_CALLBACKS_KEY])) {
    el[CLEANUP_CALLBACKS_KEY].forEach(fn => {
      try {
        fn();
      } catch (e) {
        try {
          console.error('[Modal] Cleanup callback error:', e);
        } catch (_) {}
      }
    });
    // Clear the callbacks after execution
    el[CLEANUP_CALLBACKS_KEY] = [];
  }

  // 2. Close Dialog (hardened)
  if (el.tagName === 'DIALOG' && typeof el.close === 'function') {
    // Explicitly close the dialog if it has the open attribute
    if (el.hasAttribute('open')) {
      try { el.close(); } catch(e) {
        try {
          console.error('[Modal] Close error:', e);
        } catch (_) {}
      }
    }
    // Always remove the open attribute to ensure clean state
    el.removeAttribute('open');
  }

  // 3. Hide DOM (enhanced to remove any focus traps or overlay artifacts)
  el.classList.add('hidden');
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');

  // 4. Remove any focus trap by blurring if element has focus
  try {
    if (el.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  } catch (_err) {}

  // 5. Optional: beforeRemove callback for additional cleanup
  if (options.beforeRemove && typeof options.beforeRemove === 'function') {
    try {
      options.beforeRemove(el);
    } catch (_err) {
      try {
        console.error('[Modal] beforeRemove callback error:', _err);
      } catch (_) {}
    }
  }

  // 6. Optional: Remove from DOM (Clean slate for next time)
  if (options.remove === true && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

export function registerModalCleanup(root, fn) {
  if (!root || typeof fn !== 'function') return;

  // Store cleanup callbacks on the element
  if (!root[CLEANUP_CALLBACKS_KEY]) {
    root[CLEANUP_CALLBACKS_KEY] = [];
  }
  root[CLEANUP_CALLBACKS_KEY].push(fn);
}
