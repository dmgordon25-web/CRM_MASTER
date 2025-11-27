// crm-app/js/editors/contact_entry.js
const editorState = { status: 'idle', activeId: null };

export function getContactEditorState() { return { ...editorState }; }

export function closeContactEditor(reason) {
    const modal = document.getElementById('contact-modal') || document.querySelector('[data-ui="contact-edit-modal"]');
    if (modal) {
        modal.style.display = 'none';
        if (modal.hasAttribute('open')) modal.removeAttribute('open');
        try { window.dispatchEvent(new CustomEvent('contact:editor:closed', { detail: { reason } })); } catch (e) { }
    }
    editorState.status = 'idle';
}

export function resetContactEditorForRouteLeave() { closeContactEditor('route-leave'); }

export default { getContactEditorState, closeContactEditor, resetContactEditorForRouteLeave };
