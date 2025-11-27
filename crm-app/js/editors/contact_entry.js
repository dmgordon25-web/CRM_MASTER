// crm-app/js/editors/contact_entry.js

/**
 * Contact Entry Editor - State & Lifecycle Management
 * Handles the "bridge" between the application router and the contact editor modal.
 */

let editorState = {
  status: 'idle', // idle, opening, open, closing
  activeId: null,
  pendingPromise: null
};

export function getContactEditorState() {
  return { ...editorState };
}

/**
 * Closes the contact editor if it is open.
 * @param {string} reason - Optional debugging reason
 */
export function closeContactEditor(reason) {
  const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

  if (modal) {
    // 1. Clear Open Attributes
    if (modal.hasAttribute('open')) modal.removeAttribute('open');
    if (modal.style.display !== 'none') modal.style.display = 'none';

    // 2. Reset Dataset State
    if (modal.dataset) {
      modal.dataset.open = '0';
      modal.dataset.opening = '0';
      if (reason) modal.dataset.closeReason = reason;
    }

    // 3. Dispatch Event for UI Cleanup (e.g. backdrop removal)
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
 * Resets state when navigating away (Route Lifecycle Hook)
 */
export function resetContactEditorForRouteLeave() {
  closeContactEditor('route-leave');
}

// Default export for robust import handling
export default {
  closeContactEditor,
  getContactEditorState,
  resetContactEditorForRouteLeave
};
