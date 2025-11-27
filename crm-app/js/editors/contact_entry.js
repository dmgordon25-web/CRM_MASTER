/**
 * contact_entry.js
 * Manages the lifecycle state of the Contact Editor modal.
 */

let editorState = {
  status: 'idle', // idle, opening, open, closing
  activeId: null,
  pendingPromise: null
};

export function getContactEditorState() {
  return { ...editorState };
}

export function closeContactEditor(reason) {
  const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

  if (modal) {
    try {
      if (modal.hasAttribute('open')) modal.removeAttribute('open');
      if (modal.style.display !== 'none') modal.style.display = 'none';
      if (typeof modal.close === 'function' && modal.open) modal.close();
    } catch (e) { /* safe ignore */ }

    if (modal.dataset) {
      modal.dataset.open = '0';
      modal.dataset.opening = '0';
    }

    try {
      const event = new CustomEvent('contact:editor:closed', { detail: { reason } });
      window.dispatchEvent(event);
    } catch (e) { console.warn('Dispatch failed', e); }
  }

  editorState.status = 'idle';
  editorState.activeId = null;
}

export function resetContactEditorForRouteLeave() {
  closeContactEditor('route-leave');
}

// Default export for fallback compatibility
export default {
  closeContactEditor,
  getContactEditorState,
  resetContactEditorForRouteLeave
};
