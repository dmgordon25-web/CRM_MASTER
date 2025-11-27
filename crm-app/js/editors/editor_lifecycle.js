/**
 * editor_lifecycle.js
 * Manages the lifecycle state of the Contact Editor modal.
 * (Replaces contact_entry.js to fix dependency deadlocks)
 */

const editorState = {
    status: 'idle',
    activeId: null
};

export function getContactEditorState() {
    return { ...editorState };
}

export function closeContactEditor(reason) {
    const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');

    if (modal) {
        // Force Hide DOM
        modal.style.display = 'none';
        if (modal.hasAttribute('open')) modal.removeAttribute('open');
        if (typeof modal.close === 'function' && modal.open) {
            try { modal.close(); } catch (e) { /* ignore */ }
        }

        // Dispatch cleanup event
        try {
            window.dispatchEvent(new CustomEvent('contact:editor:closed', { detail: { reason } }));
        } catch (e) { console.warn('Dispatch failed', e); }

        // Reset Data State
        if (modal.dataset) {
            modal.dataset.open = '0';
            modal.dataset.opening = '0';
        }
    }

    editorState.status = 'idle';
    editorState.activeId = null;
}

export function resetContactEditorForRouteLeave() {
    closeContactEditor('route-leave');
}

export default {
    getContactEditorState,
    closeContactEditor,
    resetContactEditorForRouteLeave
};
