/* crm-app/js/contacts.js */
import { ensureSingletonModal, closeSingletonModal } from './ui/modal_singleton.js';
export const CONTACT_MODAL_KEY = 'contact-edit';

// --- UTILS ---
function toast(msg){ if(window.toast) window.toast(msg); else console.log(msg); }
function escape(val){ return String(val||'').replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c])); }

// --- EXPORTS (Fixes Quick Add Crash) ---
export function normalizeNewContactPrefill(input = {}) {
  if (input && (input instanceof Event || input.target)) return { __isNew: true };
  return { ...input, id: input.id || `tmp-${Date.now()}` };
}

export function normalizeContactId(input) {
  if (!input) return null;
  // FIX: Ignore MouseEvents passed by click handlers
  if (input instanceof Event || (typeof input === 'object' && input.type === 'click')) return null;
  if (typeof input === 'object' && input.id) return String(input.id).trim();
  return String(input).trim();
}

export function validateContact(model){ return { ok: true, errors: {} }; }

// --- RENDERER ---
function createContactForm(data, isNew) {
  const form = document.createElement('div');
  form.innerHTML = `
    <div class="modal-form-grid" style="padding:20px;">
      <h3>${isNew ? 'Create Contact' : 'Edit Contact'}</h3>
      <div class="form-group">
         <label>Name</label>
         <input class="form-control" id="c-name" value="${escape(data.name || data.firstName || '')}">
      </div>
      <div class="row" style="margin-top:20px;">
        <button class="btn brand" id="btn-save-contact">Save</button>
      </div>
    </div>`;

  const saveBtn = form.querySelector('#btn-save-contact');
  if(saveBtn) saveBtn.onclick = async (e) => {
      e.preventDefault();
      toast('Saved (Demo)');
      // In real app, save to DB here
      closeContactEditor();
  };
  return form;
}

window.renderContactModal = async function(contactId, options = {}){
  const rawId = normalizeContactId(contactId);
  const isNew = !rawId;

  const dlg = await ensureSingletonModal(CONTACT_MODAL_KEY, () => {
    const el = document.createElement('dialog');
    el.className = 'record-modal contact-edit-modal';
    el.innerHTML = '<div class="modal-content"><div class="modal-header"></div><div class="modal-body"></div></div>';
    document.body.appendChild(el);

    // FIX: NO FOCUS LOGIC HERE. JUST STATE CLEANUP.
    el.addEventListener('close', () => {
      el.removeAttribute('open');
      el.style.display = 'none';
      if(el.dataset) { el.dataset.open = '0'; }
    });
    return el;
  });

  if(!dlg) return;

  const header = dlg.querySelector('.modal-header');
  header.innerHTML = `<div style="display:flex;justify-content:flex-end;"><button class="btn-close" style="background:none;border:none;font-size:1.5rem;cursor:pointer;">&times;</button></div>`;
  header.querySelector('.btn-close').onclick = (e) => { e.preventDefault(); try{dlg.close();}catch(_){} };

  const body = dlg.querySelector('.modal-body');
  body.innerHTML = '';

  // Fetch real data if needed
  let record = {};
  if(!isNew){
      try {
        await window.openDB();
        record = await window.dbGet('contacts', rawId) || {};
      } catch(e){}
  }

  body.appendChild(createContactForm(record, isNew));

  if(!dlg.hasAttribute('open')) try{ dlg.showModal(); } catch(e){ dlg.setAttribute('open',''); }
  dlg.style.display = '';
  return dlg;
};

export async function openContactModal(id, opts){ return window.renderContactModal(id, opts); }
export async function openContactEditor(t, opts){ return window.renderContactModal(opts?.contactId || t, opts); }
export async function openNewContactEditor(opts){ return window.renderContactModal(null, opts); }
export function closeContactEditor(){ closeSingletonModal(CONTACT_MODAL_KEY, { remove: false }); }
