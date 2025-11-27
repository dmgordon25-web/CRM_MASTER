/**
 * contact_entry.js
 * Manages the lifecycle state of the Contact Editor modal.
 * Acts as a bridge between the Router (app.js) and the Renderer (contacts.js).
 */

let editorState = {
  status: 'idle', // idle, opening, open, closing
  activeId: null,
  pendingPromise: null
};

/**
 * Returns the current state of the editor (used by Route Lifecycle).
 */
export function getContactEditorState() {
  return { ...editorState };
}

/**
 * Closes the contact editor modal if it is open.
 * Handles DOM cleanup and state reset.
 * @param {string} reason - Optional debug reason (e.g., 'route-leave', 'save')
 */
export function closeContactEditor(reason) {
  const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

  if (modal) {
    // 1. Clear standard HTML Dialog attributes
    try {
      if (modal.hasAttribute('open')) modal.removeAttribute('open');
      if (modal.style.display !== 'none') modal.style.display = 'none';
      if (typeof modal.close === 'function' && modal.open) modal.close();
    } catch (e) { /* ignore close errors */ }

    // 2. Reset dataset state for CSS transitions
    if (modal.dataset) {
      modal.dataset.open = '0';
      modal.dataset.opening = '0';
      if (reason) modal.dataset.closeReason = reason;
    }

    // 3. Notify listeners (e.g., Action Bar or Blur/Focus handlers)
    try {
      const event = new CustomEvent('contact:editor:closed', { detail: { reason } });
      window.dispatchEvent(event);
    } catch (e) {
      console.warn('[contact_entry] Dispatch failed', e);
    }
  }

  // 4. Reset Internal State
  editorState.status = 'idle';
  editorState.activeId = null;
}

/**
 * Hook for Router to safely close editor when navigating away.
 */
export function resetContactEditorForRouteLeave() {
  closeContactEditor('route-leave');
}

// Default export for compatibility
export default {
  closeContactEditor,
  getContactEditorState,
  resetContactEditorForRouteLeave
};
