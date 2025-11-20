/* crm-app/js/ui/modal_singleton.js */

// TRACKING STATE
let currentOpenModalId = null;
let currentModalElement = null;

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

  // 1. Close Dialog
  if (el.tagName === 'DIALOG' && typeof el.close === 'function' && el.hasAttribute('open')) {
    try { el.close(); } catch(e) { console.warn('[Modal] Close error', e); }
  }

  // 2. Hide DOM
  el.classList.add('hidden');
  el.style.display = 'none';
  el.setAttribute('aria-hidden', 'true');

  // 3. Optional: Remove from DOM (Clean slate for next time)
  if (options.remove === true && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

export function registerModalCleanup(root, fn) {
  // Legacy compatibility stub - no longer needed with strict destruction
}
