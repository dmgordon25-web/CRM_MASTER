import { ensureSingletonModal, closeSingletonModal } from './ui/modal_singleton.js';
import { createContactForm } from './contacts/form.js';

export const CONTACT_MODAL_KEY = 'contact-edit';

function toast(msg, kind = 'info'){
  if(typeof window.toast === 'function') window.toast(msg);
  else if(console && console.log) console.log(`[${kind}] ${msg}`);
}

function normalizeContactId(input){
  // FIX: Detect and ignore Event objects (clicks)
  if (input && (input instanceof Event || (input.type && input.target))) return null;
  if (input && typeof input === 'object' && input.id) return String(input.id).trim();
  return typeof input === 'string' ? input.trim() : null;
}

function safePrefill(input){
   if(!input || typeof input !== 'object') return {};
   // Strip event objects
   if(input instanceof Event || input.target) return {};
   return input;
}

// --- Main Modal Renderer ---

window.renderContactModal = async function(contactId, options = {}){
  const rawId = normalizeContactId(contactId);
  const isNew = !rawId;

  // 1. Acquire Singleton Shell
  const dlg = await ensureSingletonModal(CONTACT_MODAL_KEY, () => {
    const el = document.createElement('dialog');
    el.className = 'record-modal contact-edit-modal';
    el.innerHTML = '<div class="modal-content"><div class="modal-header"></div><div class="modal-body"></div></div>';
    document.body.appendChild(el);

    // FIX: NUCLEAR OPTION - Do NOT restore focus.
    const cleanup = () => {
      el.removeAttribute('open');
      el.style.display = 'none';
      if(el.dataset) { el.dataset.open = '0'; el.dataset.contactId = ''; }
    };
    el.addEventListener('close', cleanup);
    el.addEventListener('cancel', () => {
       // Allow default close (ESC key), which triggers 'close' event
    });

    return el;
  });

  if(!dlg) return;

  // 2. Fetch Data (if editing)
  let record = null;
  if(!isNew){
    try {
      await window.openDB();
      record = await window.dbGet('contacts', rawId);
    } catch(e) { console.warn(e); }

    if(!record){
      toast('No contact found', 'warn');
      // FIX: Force close if data missing to release focus trap
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
       <button type="button" class="btn-close" aria-label="Close" style="font-size:1.5rem;cursor:pointer;background:none;border:none;">&times;</button>
    </div>
  `;

  body.innerHTML = '';
  const formData = isNew ? safePrefill(options.prefetchedRecord) : record;

  if(typeof createContactForm === 'function'){
      const form = await createContactForm(formData, isNew);
      body.appendChild(form);
  } else if(window.createContactForm){
      const form = await window.createContactForm(formData, isNew);
      body.appendChild(form);
  } else {
      body.textContent = "Form loader missing.";
  }

  // 4. Wire Close Button
  header.querySelector('.btn-close').onclick = (e) => {
    e.preventDefault();
    try { dlg.close(); } catch(e){}
  };

  // 5. Show
  dlg.dataset.contactId = rawId || 'new';
  if(!dlg.hasAttribute('open')){
    try { dlg.showModal(); } catch(e){ dlg.setAttribute('open',''); }
  }
  dlg.style.display = '';
  return dlg;
};

// --- Public Entry Points ---

export async function openContactModal(contactId, options){
  const safeId = normalizeContactId(contactId);
  return window.renderContactModal(safeId, options);
}

export async function openContactEditor(target, options){
  const opts = options || {};
  const safeId = normalizeContactId(opts.contactId || target);
  return window.renderContactModal(safeId, opts);
}

export async function openNewContactEditor(options){
  return window.renderContactModal(null, options);
}

export function closeContactEditor(){
  closeSingletonModal(CONTACT_MODAL_KEY, { remove: false });
}
