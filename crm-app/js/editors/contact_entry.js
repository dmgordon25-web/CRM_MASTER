/**
 * contact_entry.js
 * State bridge for the Contact Editor.
 *
 * EXPORTS REQUIRED:
 * - getContactEditorState
 * - closeContactEditor
 * - resetContactEditorForRouteLeave
 */

// 1. Internal State
let editorState = {
  status: 'idle',
  activeId: null
};

// 2. Exported Functions
export function getContactEditorState() {
  return { ...editorState };
}

export function closeContactEditor(reason) {
  const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

  if (modal) {
    // DOM Cleanup
    if (modal.hasAttribute('open')) modal.removeAttribute('open');
    if (modal.style.display !== 'none') modal.style.display = 'none';

    // State Cleanup
    if (modal.dataset) {
      modal.dataset.open = '0';
      modal.dataset.opening = '0';
      if (reason) modal.dataset.closeReason = reason;
    }

    // Event Dispatch
    try {
      const event = new CustomEvent('contact:editor:closed', { detail: { reason } });
      window.dispatchEvent(event);
    } catch (e) {
      console.warn('[contact_entry] Event dispatch failed', e);
    }
  }

  // Reset Internal State
  editorState.status = 'idle';
  editorState.activeId = null;
}

export function resetContactEditorForRouteLeave() {
  closeContactEditor('route-leave');
}

// 3. Default Export (Safety Net)
export default {
  getContactEditorState,
  closeContactEditor,
  resetContactEditorForRouteLeave
};
