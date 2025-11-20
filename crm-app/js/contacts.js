/* crm-app/js/contacts.js */
import { ensureSingletonModal, closeSingletonModal } from './ui/modal_singleton.js';

export const CONTACT_MODAL_KEY = 'contact-edit';

// --- Helpers ---

function toast(msg, kind = 'info'){
  if(typeof window.toast === 'function') window.toast(msg);
  else if(console && console.log) console.log(`[${kind}] ${msg}`);
}

function escape(val){
  return String(val||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
}

// --- Exported Utilities (Restored for Quick Add / Importer) ---

export function normalizeNewContactPrefill(input = {}) {
  // Safety: Handle Event objects passed by click handlers
  if (input && (input instanceof Event || input.target)) return { __isNew: true };

  const now   = Date.now();
  const first = typeof input.firstName === 'string' ? input.firstName.trim() : '';
  const last  = typeof input.lastName  === 'string' ? input.lastName.trim()  : '';
  const name  = (typeof input.name === 'string' ? input.name.trim() : '') || [first, last].filter(Boolean).join(' ');
  const id    = (input.id != null && String(input.id).trim() !== '') ? String(input.id) : `tmp-${now}`;

  return {
    id,
    __isNew: input.__isNew !== false,
    name,
    firstName: first,
    lastName: last,
    email: typeof input.email === 'string' ? input.email.trim() : '',
    phone: typeof input.phone === 'string' ? input.phone.trim() : '',
    ...input,
  };
}

export function normalizeContactId(input) {
  if (!input) return null;
  // Check to reject Event objects
  if (input instanceof Event || (typeof input === 'object' && input.type === 'click')) return null;
  if (typeof input === 'object' && input.id) return String(input.id).trim();
  return String(input).trim();
}

export function validateContact(model){
  const errors = {};
  const source = model || {};
  const name = source.name || [source.firstName, source.lastName].join(' ').trim();
  if(!name) errors.name = 'Name is required';
  return { ok: Object.keys(errors).length === 0, errors };
}

// --- Internal Form Renderer ---

function createContactForm(data, isNew) {
  const c = data || {};
  const form = document.createElement('div');
  form.className = 'contact-editor-layout';
  const val = (k) => escape(c[k] || '');

  form.innerHTML = `
    <div class="modal-form-grid">
      <div class="form-group full">
         <label>Name <span class="req">*</span></label>
         <div class="row gap-2">
            <input class="form-control" id="c-first" placeholder="First" value="${val('firstName')}">
            <input class="form-control" id="c-last" placeholder="Last" value="${val('lastName')}">
         </div>
      </div>
      <div class="form-group">
         <label>Email</label>
         <input type="email" class="form-control" id="c-email" value="${val('email')}">
      </div>
      <div class="form-group">
         <label>Phone</label>
         <input type="tel" class="form-control" id="c-phone" value="${val('phone')}">
      </div>
      <div class="form-group full actions-row">
         <button type="button" class="btn brand" id="btn-save-contact">Save Contact</button>
      </div>
    </div>
  `;

  const saveBtn = form.querySelector('#btn-save-contact');
  if(saveBtn) {
    saveBtn.onclick = async (e) => {
      e.preventDefault();
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const payload = {
        ...c,
        firstName: form.querySelector('#c-first').value.trim(),
        lastName: form.querySelector('#c-last').value.trim(),
        email: form.querySelector('#c-email').value.trim(),
        phone: form.querySelector('#c-phone').value.trim(),
        updatedAt: Date.now()
      };

      if(!payload.firstName && !payload.lastName){
        toast('Name required', 'warn');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Contact';
        return;
      }

      try {
        await window.openDB();
        await window.dbPut('contacts', payload);
        const event = new CustomEvent('app:data:changed', {
           detail: { scope: 'contacts', action: isNew ? 'create' : 'update', id: payload.id }
        });
        document.dispatchEvent(event);
        toast('Saved');
        closeContactEditor();
      } catch(err) {
        console.error(err);
        toast('Save failed');
        saveBtn.disabled = false;
      }
    };
  }
  return form;
}

// --- Main Modal Renderer ---

window.renderContactModal = async function(contactId, options = {}){
  const rawId = normalizeContactId(contactId);
  const isNew = !rawId;

  const dlg = await ensureSingletonModal(CONTACT_MODAL_KEY, () => {
    const el = document.createElement('dialog');
    el.className = 'record-modal contact-edit-modal';
    el.innerHTML = '<div class="modal-content"><div class="modal-header"></div><div class="modal-body"></div></div>';
    document.body.appendChild(el);

    // NUCLEAR OPTION: No focus restore to prevent deadlock
    el.addEventListener('close', () => {
      el.removeAttribute('open');
      el.style.display = 'none';
      if(el.dataset) { el.dataset.open = '0'; el.dataset.contactId = ''; }
    });
    return el;
  });

  if(!dlg) return;

  let record = null;
  if(!isNew){
    try {
      await window.openDB();
      record = await window.dbGet('contacts', rawId);
    } catch(e) { console.warn(e); }
    if(!record){
      toast('Contact not found', 'warn');
      try { dlg.close(); } catch(e){}
      return;
    }
  } else {
    record = normalizeNewContactPrefill(options.prefetchedRecord || {});
  }

  const header = dlg.querySelector('.modal-header');
  const body = dlg.querySelector('.modal-body');

  header.innerHTML = `
    <h3 class="modal-title">${isNew ? 'New Contact' : 'Edit Contact'}</h3>
    <button type="button" class="btn-close" aria-label="Close">&times;</button>
  `;

  body.innerHTML = '';
  body.appendChild(createContactForm(record, isNew));

  header.querySelector('.btn-close').onclick = (e) => {
    e.preventDefault();
    try { dlg.close(); } catch(e){}
  };

  dlg.dataset.contactId = rawId || 'new';
  if(!dlg.hasAttribute('open')){
    try { dlg.showModal(); } catch(e){ dlg.setAttribute('open',''); }
  }
  dlg.style.display = '';
  return dlg;
};

// --- Public Entry Points ---

export async function openContactModal(contactId, options){
  return window.renderContactModal(contactId, options);
}

export async function openContactEditor(target, options){
  const opts = options || {};
  // Handle click event passed as target
  const safeId = normalizeContactId(opts.contactId || (target instanceof Event ? null : target));
  return window.renderContactModal(safeId, opts);
}

export async function openNewContactEditor(options){
  return window.renderContactModal(null, options);
}

export function closeContactEditor(){
  closeSingletonModal(CONTACT_MODAL_KEY, { remove: false });
}
