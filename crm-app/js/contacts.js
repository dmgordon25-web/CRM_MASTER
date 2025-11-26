import { ensureSingletonModal, closeSingletonModal } from './ui/modal_singleton.js';
import { createFormFooter } from './ui/form_footer.js';
import { setReferredBy } from './contacts/form.js';
import { acquireRouteLifecycleToken } from './ui/route_lifecycle.js';
import { clearSelectionForSurface } from './services/selection_reset.js';
import { applyContactFieldVisibility, normalizeSimpleModeSettings, SIMPLE_MODE_DEFAULTS } from './editors/contact_fields.js';
import { getUiMode, onUiModeChanged } from './ui/ui_mode.js';
// Import as closeContactEntry to match usage in rest of app, or fix local usage
import { closeContactEditor as closeContactEntry, getContactEditorState, resetContactEditorForRouteLeave } from './editors/contact_entry.js';
import { getTasksApi } from './app_services.js';

export const CONTACT_MODAL_KEY = 'contact-edit';

function toast(msg) { if (window.toast) window.toast(msg); else console.log(msg); }
function escape(val) { return String(val || '').replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c])); }

export function normalizeNewContactPrefill(input = {}) {
  if (input && (input instanceof Event || input.target)) return { __isNew: true };
  return { ...input, id: input.id || `tmp-${Date.now()}` };
}
export function normalizeContactId(input) {
  if (!input) return null;
  if (input instanceof Event || (typeof input === 'object' && input.type === 'click')) return null;
  if (typeof input === 'object' && input.id) return String(input.id).trim();
  return String(input).trim();
}
export function validateContact(model) { return { ok: true, errors: {} }; }

// --- FORM RENDERER ---
function createContactForm(data, isNew) {
  const form = document.createElement('div');
  form.className = 'modal-form-grid';
  form.style.padding = '20px';

  form.innerHTML = `
    <div class="field-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
      <div class="form-group"><label>First Name</label><input class="form-control" id="c-first" value="${escape(data.firstName || data.first || '')}"></div>
      <div class="form-group"><label>Last Name</label><input class="form-control" id="c-last" value="${escape(data.lastName || data.last || '')}"></div>
      <div class="form-group"><label>Email</label><input class="form-control" id="c-email" type="email" value="${escape(data.email || '')}"></div>
      <div class="form-group"><label>Phone</label><input class="form-control" id="c-phone" type="tel" value="${escape(data.phone || '')}"></div>
    </div>
    <div class="row" style="margin-top:20px; display:flex; justify-content:flex-end; gap:10px;">
      <button class="btn" data-role="cancel">Cancel</button>
      <button class="btn brand" id="btn-save-contact">Save Contact</button>
    </div>`;

  // FIX: Use closeContactEntry (the imported name)
  form.querySelector('[data-role="cancel"]').onclick = (e) => {
    e.preventDefault();
    closeContactEntry();
  };

  const saveBtn = form.querySelector('#btn-save-contact');
  if (saveBtn) saveBtn.onclick = async (e) => {
    e.preventDefault();
    saveBtn.textContent = 'Saving...';
    try {
      await window.openDB();
      const payload = {
        ...data,
        firstName: form.querySelector('#c-first').value,
        lastName: form.querySelector('#c-last').value,
        email: form.querySelector('#c-email').value,
        phone: form.querySelector('#c-phone').value,
        updatedAt: Date.now()
      };
      await window.dbPut('contacts', payload);
      document.dispatchEvent(new CustomEvent('app:data:changed', {
        detail: { scope: 'contacts', action: isNew ? 'create' : 'update', id: payload.id }
      }));
      toast('Saved');
      closeContactEntry();
    } catch (err) {
      console.warn(err);
      toast('Save failed');
      saveBtn.textContent = 'Save';
    }
  };
  return form;
}

// --- MODAL ORCHESTRATOR ---
window.renderContactModal = async function (contactId, options = {}) {
  const rawId = normalizeContactId(contactId);
  const isNew = !rawId;

  const dlg = await ensureSingletonModal(CONTACT_MODAL_KEY, () => {
    const el = document.createElement('dialog');
    el.className = 'record-modal contact-edit-modal';
    el.innerHTML = '<div class="modal-content"><div class="modal-header"></div><div class="modal-body"></div></div>';
    document.body.appendChild(el);

    // SAFETY FIX: No focus restoration
    el.addEventListener('close', () => {
      el.removeAttribute('open');
      el.style.display = 'none';
      if (el.dataset) { el.dataset.open = '0'; }
    });
    return el;
  });

  if (!dlg) return;

  const header = dlg.querySelector('.modal-header');
  header.innerHTML = `<h3 class="modal-title" style="margin:0;">${isNew ? 'New' : 'Edit'} Contact</h3><button class="btn-close" aria-label="Close">&times;</button>`;
  header.querySelector('.btn-close').onclick = (e) => {
    e.preventDefault();
    try { dlg.close(); } catch (e) { }
  };

  const body = dlg.querySelector('.modal-body');
  body.innerHTML = '';

  let record = {};
  if (!isNew) {
    try { await window.openDB(); record = await window.dbGet('contacts', rawId); } catch (e) { }
    if (!record) { toast('Contact not found'); try { dlg.close(); } catch (_) { } return; }
  }

  body.appendChild(createContactForm(record, isNew));

  if (!dlg.hasAttribute('open')) try { dlg.showModal(); } catch (e) { dlg.setAttribute('open', ''); }
  dlg.style.display = '';
  return dlg;
};

export async function openContactModal(id, opts) { return window.renderContactModal(id, opts); }
export async function openContactEditor(t, opts) { return window.renderContactModal(opts?.contactId || t, opts); }
export async function openNewContactEditor(opts) { return window.renderContactModal(null, opts); }
// Export the alias correctly
export function closeContactEditor() { closeContactEntry(); }
