/**
 * editor_lifecycle.js (Formerly contact_entry.js)
 * Manages Contact Editor state.
 */
let editorState = { status: 'idle', activeId: null };

export function getContactEditorState() { return { ...editorState }; }

export function closeContactEditor(reason) {
    const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');
    if (modal) {
        modal.style.display = 'none';
        if (modal.hasAttribute('open')) modal.removeAttribute('open');
        // Dispatch event for UI cleanup
        try { window.dispatchEvent(new CustomEvent('contact:editor:closed', { detail: { reason } })); } catch (e) { }
    }
    editorState.status = 'idle';
}

export function resetContactEditorForRouteLeave() { closeContactEditor('route-leave'); }

export default { getContactEditorState, closeContactEditor, resetContactEditorForRouteLeave };
