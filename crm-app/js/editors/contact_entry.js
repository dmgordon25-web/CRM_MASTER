// crm-app/js/editors/contact_entry.js
// State management for the Contact Editor modal

const editorState = {
  status: 'idle',
  activeId: null
};

export function getContactEditorState() {
  return { ...editorState };
}

export function closeContactEditor(reason) {
  // Locate the modal
  const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

  if (modal) {
    // 1. Clear native dialog state
    if (typeof modal.close === 'function' && modal.open) {
      try { modal.close(); } catch (e) { /* ignore */ }
    }

    // 2. Force hide
    modal.style.display = 'none';
    if (modal.hasAttribute('open')) {
      modal.removeAttribute('open');
    }

    // 3. Reset Dataset
    if (modal.dataset) {
      modal.dataset.open = '0';
      modal.dataset.opening = '0';
    }
  }

  // 4. Reset Internal State
  editorState.status = 'idle';
  editorState.activeId = null;
}

export function resetContactEditorForRouteLeave() {
  closeContactEditor('route-leave');
}

// Default export to satisfy any mixed import styles
export default {
  getContactEditorState,
  closeContactEditor,
  resetContactEditorForRouteLeave
};