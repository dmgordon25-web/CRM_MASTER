/* crm-app/js/contacts.js */
import { ensureSingletonModal, closeSingletonModal } from './ui/modal_singleton.js';
import { createContactForm } from './contacts/form.js';

const CONTACT_MODAL_KEY = 'contact-edit';

function toast(msg){
  if(typeof window.toast === 'function') window.toast(msg);
  else if(console && console.log) console.log(msg);
}

async function normalizeNewContactPrefill(prefill){
  if(!prefill) return null;
  return prefill;
}

function normalizeContactId(input){
  // FIX: If input is an Event object (click), ignore it.
  if (input && typeof input === 'object') return null;
  return typeof input === 'string' ? input.trim() : null;
}

// --- Main Modal Renderer ---

window.renderContactModal = async function(contactId, options = {}){
  const isNew = !contactId;

  // 1. Acquire Singleton Shell
  const dlg = await ensureSingletonModal(CONTACT_MODAL_KEY, () => {
    const el = document.createElement('dialog');
    el.className = 'record-modal contact-edit-modal';
    el.innerHTML = '<div class="modal-content"><div class="modal-header"></div><div class="modal-body"></div></div>';
    document.body.appendChild(el);

    // FIX: "Nuclear Option" for Focus Deadlocks.
    // We do NOT attempt to restore focus to the invoker. It is too risky.
    el.addEventListener('close', () => {
      el.removeAttribute('open');
      el.style.display = 'none';
      // Clear state
      if(el.dataset) { el.dataset.open = '0'; el.dataset.contactId = ''; }
    });

    return el;
  });

  if(!dlg) return;

  // 2. Fetch Data
  let record = null;
  if(!isNew){
    try {
      await window.openDB();
      record = await window.dbGet('contacts', contactId);
    } catch(e) { console.warn(e); }

    if(!record){
      toast('No contact found');
      // FIX: CRITICAL - Close the shell if data missing, otherwise we lock the screen
      try { dlg.close(); } catch(e){}
      return;
    }
  }

  // 3. Render Form
  const header = dlg.querySelector('.modal-header');
  const body = dlg.querySelector('.modal-body');

  header.innerHTML = `
    <h2 class="modal-title">${isNew ? 'New Contact' : 'Edit Contact'}</h2>
    <div class="modal-header-actions">
       <button type="button" class="btn-close" aria-label="Close">&times;</button>
    </div>
  `;

  body.innerHTML = '';
  const form = await createContactForm(isNew ? (options.prefetchedRecord || {}) : record, isNew);
  body.appendChild(form);

  // 4. Wire Close Button
  header.querySelector('.btn-close').onclick = () => {
    try { dlg.close(); } catch(e){}
  };

  // 5. Show
  dlg.dataset.contactId = contactId || 'new';
  if(!dlg.hasAttribute('open')){
    try { dlg.showModal(); } catch(e){ dlg.setAttribute('open',''); }
  }
  dlg.style.display = '';
};

// --- Public Entry Points ---

export async function openContactModal(contactId, options){
  const safeId = normalizeContactId(contactId);
  return window.renderContactModal(safeId, options);
}

export async function openNewContactEditor(options){
  return window.renderContactModal(null, options);
}

export function closeContactEditor(){
  closeSingletonModal(CONTACT_MODAL_KEY, { remove: false });
}
