/* eslint-disable no-console */
import { toastSoftError, toastSuccess, toastWarn } from './toast_helpers.js';
import { validateContact } from '../contacts.js';
import { validatePartner } from '../partners.js';
import { bindQuickAddValidation } from './quick_add_validation.js';

function broadcastDataChanged(detail){
  const payload = detail && typeof detail === 'object' ? detail : {};
  try {
    if(typeof window.dispatchAppDataChanged === 'function'){
      window.dispatchAppDataChanged(payload);
      return;
    }
  } catch (_) {}
  try {
    if(typeof document !== 'undefined' && typeof document.dispatchEvent === 'function'){
      document.dispatchEvent(new CustomEvent('app:data:changed', { detail: payload }));
    }
  } catch (_) {}
}

const DEFAULT_COPY = {
  modalTitle: 'Quick Add',
  contactTab: 'Contact',
  partnerTab: 'Partner',
  cancel: 'Cancel',
  contactSubmit: 'Save Contact',
  partnerSubmit: 'Save Partner',
  contactFirstName: 'First Name',
  contactLastName: 'Last Name',
  contactEmail: 'Email',
  contactPhone: 'Phone',
  partnerCompany: 'Company',
  partnerName: 'Primary Contact',
  partnerEmail: 'Email',
  partnerPhone: 'Phone'
};

let quickAddCopy = null;

const CONTACT_VALIDATION_CONFIG = {
  name: {
    fields: ['firstName', 'lastName'],
    message: () => 'Name is required'
  },
  email: {
    fields: ['email'],
    message: (code) => code === 'invalid' ? 'Enter a valid email' : 'Email is required'
  },
  phone: {
    fields: ['phone'],
    message: () => 'Phone is required'
  }
};

const PARTNER_VALIDATION_CONFIG = {
  name: {
    fields: ['name'],
    message: () => 'Enter the primary contact name'
  }
};

const QUICK_ADD_INVALID_TOAST = 'Please fix highlighted fields';

function readContactFormModel(form){
  if(!form || typeof form.querySelector !== 'function'){
    return { firstName: '', lastName: '', email: '', phone: '', name: '' };
  }
  const read = (name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if(!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
  };
  const firstName = read('firstName');
  const lastName = read('lastName');
  const email = read('email');
  const phone = read('phone');
  const name = `${firstName} ${lastName}`.trim();
  return { firstName, lastName, email, phone, name };
}

function readPartnerFormModel(form){
  if(!form || typeof form.querySelector !== 'function'){
    return { company: '', name: '', email: '', phone: '' };
  }
  const read = (name) => {
    const input = form.querySelector(`[name="${name}"]`);
    if(!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value.trim() : String(value || '').trim();
  };
  return {
    company: read('company'),
    name: read('name'),
    email: read('email'),
    phone: read('phone')
  };
}

function focusField(node){
  if(!node || typeof node.focus !== 'function') return;
  try {
    node.focus({ preventScroll: true });
  } catch (_err) {
    try { node.focus(); }
    catch (_focusErr) {}
  }
}

// Unified Quick Add modal with Contact/Partner tabs; idempotent wiring.
export function wireQuickAddUnified(options = {}) {
  const provided = options && typeof options === 'object' && options.copy && typeof options.copy === 'object'
    ? options.copy
    : null;
  if (provided) {
    quickAddCopy = { ...DEFAULT_COPY, ...provided };
  }
  if (window.__WIRED_QUICK_ADD_UNIFIED__) return;
  window.__WIRED_QUICK_ADD_UNIFIED__ = true;

  function html() {
    const copy = quickAddCopy || DEFAULT_COPY;
    const get = (key) => {
      const value = copy[key];
      return value == null ? DEFAULT_COPY[key] : String(value);
    };
    return `
<div class="qa-overlay" role="dialog" aria-modal="true" style="position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;">
  <div class="qa-modal" style="background:#fff;min-width:560px;max-width:720px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
    <div class="qa-header" style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #eee;">
      <div style="font-size:18px;font-weight:600;">${get('modalTitle')}</div>
      <button type="button" class="qa-close" aria-label="Close" style="border:none;background:transparent;font-size:20px;cursor:pointer;">×</button>
    </div>
    <div class="qa-tabs" style="display:flex;gap:8px;padding:10px 16px;border-bottom:1px solid #f2f2f2;">
      <button class="qa-tab qa-tab-contact" data-tab="contact" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#f9f9f9;cursor:pointer;">${get('contactTab')}</button>
      <button class="qa-tab qa-tab-partner" data-tab="partner" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('partnerTab')}</button>
    </div>
    <div class="qa-body" style="padding:16px;">
      <form class="qa-form qa-form-contact" data-kind="contact" style="display:block;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>${get('contactFirstName')}<input name="firstName" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactLastName')}<input name="lastName" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactEmail')}<input name="email" type="email" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('contactPhone')}<input name="phone" type="tel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" class="qa-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('cancel')}</button>
          <button type="submit" class="qa-save" style="padding:8px 12px;border-radius:8px;border:1px solid #2b7;background:#2b7;color:#fff;cursor:pointer;">${get('contactSubmit')}</button>
        </div>
      </form>
      <form class="qa-form qa-form-partner" data-kind="partner" style="display:none;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <label>${get('partnerCompany')}<input name="company" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerName')}<input name="name" type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerEmail')}<input name="email" type="email" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
          <label>${get('partnerPhone')}<input name="phone" type="tel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:8px;"></label>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px;">
          <button type="button" class="qa-cancel" style="padding:8px 12px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;">${get('cancel')}</button>
          <button type="submit" class="qa-save" style="padding:8px 12px;border-radius:8px;border:1px solid #2b7;background:#2b7;color:#fff;cursor:pointer;">${get('partnerSubmit')}</button>
        </div>
      </form>
    </div>
  </div>
</div>`;
  }

  function close() {
    const el = document.querySelector(".qa-overlay");
    if (el && el.parentElement) el.parentElement.removeChild(el);
    if (typeof document.removeEventListener === 'function') {
      document.removeEventListener("keydown", onKey);
    }
  }

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  function open(initialTab) {
    close();
    const tpl = document.createElement("template");
    tpl.innerHTML = html().trim();
    let node = tpl.content && tpl.content.firstElementChild;
    if(!node){
      const fallbackWrap = document.createElement('div');
      fallbackWrap.innerHTML = tpl.innerHTML;
      node = fallbackWrap.firstElementChild;
    }
    if(!node) return;
    document.body.appendChild(node);
    if (typeof document.addEventListener === 'function') {
      document.addEventListener("keydown", onKey);
    }

    function selectTab(tab) {
      const isContact = tab === "contact";
      node.querySelector(".qa-form-contact").style.display = isContact ? "block" : "none";
      node.querySelector(".qa-form-partner").style.display = isContact ? "none" : "block";
      node.querySelector(".qa-tab-contact").style.background = isContact ? "#f9f9f9" : "#fff";
      node.querySelector(".qa-tab-partner").style.background = isContact ? "#fff" : "#f9f9f9";
    }

    node.querySelector(".qa-close").addEventListener("click", close);
    node.querySelectorAll(".qa-cancel").forEach(b => b.addEventListener("click", close));
    node.querySelector(".qa-tab-contact").addEventListener("click", () => selectTab("contact"));
    node.querySelector(".qa-tab-partner").addEventListener("click", () => selectTab("partner"));

    const contactForm = node.querySelector('.qa-form[data-kind="contact"]');
    const partnerForm = node.querySelector('.qa-form[data-kind="partner"]');

    const contactSaveBtn = contactForm ? contactForm.querySelector('.qa-save') : null;
    let contactSaving = false;
    const contactValidation = contactForm
      ? bindQuickAddValidation(contactForm, CONTACT_VALIDATION_CONFIG, {
          buildModel: readContactFormModel,
          validate: validateContact,
          onResult: (result) => {
            if (contactSaveBtn) {
              contactSaveBtn.disabled = contactSaving || !result.ok;
            }
          }
        })
      : null;

    const partnerSaveBtn = partnerForm ? partnerForm.querySelector('.qa-save') : null;
    let partnerSaving = false;
    const partnerValidation = partnerForm
      ? bindQuickAddValidation(partnerForm, PARTNER_VALIDATION_CONFIG, {
          buildModel: readPartnerFormModel,
          validate: validatePartner,
          onResult: (result) => {
            if (partnerSaveBtn) {
              partnerSaveBtn.disabled = partnerSaving || !result.ok;
            }
          }
        })
      : null;

    if (contactForm) {
      contactForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const validationResult = contactValidation
          ? contactValidation.run(true)
          : { ok: true, model: readContactFormModel(contactForm) };
        const model = validationResult.model || readContactFormModel(contactForm);
        if (!validationResult.ok) {
          toastWarn(QUICK_ADD_INVALID_TOAST);
          if (validationResult.firstInvalid) {
            focusField(validationResult.firstInvalid);
          }
          return;
        }

        contactSaving = true;
        if (contactSaveBtn) {
          contactSaveBtn.disabled = true;
        }

        const now = Date.now();
        const first = model.firstName || '';
        const last = model.lastName || '';
        const email = model.email || '';
        const phone = model.phone || '';
        const name = model.name || [first, last].filter(Boolean).join(' ').trim();
        const rec = {
          firstName: first,
          lastName: last,
          first,
          last,
          name,
          email,
          phone,
          createdAt: now,
          updatedAt: now,
          stage: "Application",
          status: "Active",
        };
        let saved = false;
        let assignedId = model.id != null ? model.id : null;
        let failureMessage = '';
        let failureToastShown = false;
        try {
          if (window.Contacts?.createQuick) {
            const result = await window.Contacts.createQuick(rec);
            if(result && result.id != null && assignedId == null){
              assignedId = result.id;
            }
            saved = true;
          } else if (typeof window.dbPut === "function") {
            const putResult = await window.dbPut("contacts", rec);
            if((putResult ?? rec?.id) != null && assignedId == null){
              assignedId = putResult ?? rec?.id;
            }
            saved = true;
          } else {
            failureMessage = 'Contacts service unavailable. Contact not saved.';
            try { console.warn("[quickAdd] no Contacts.createQuick or dbPut; saved to memory only", rec); }
            catch (_) {}
          }
        } catch (err) {
          failureMessage = 'Unable to save contact. Please try again.';
          failureToastShown = toastSoftError('[soft] [quickAdd] contact save failed', err, failureMessage);
        } finally {
          contactSaving = false;
          const contactId = assignedId != null ? String(assignedId) : (rec?.id != null ? String(rec.id) : '');
          broadcastDataChanged({
            scope: 'contacts',
            action: 'create',
            reason: 'quick-add:contact',
            source: 'quick-add',
            contactId,
            ids: contactId ? [contactId] : undefined
          });
          if (saved) {
            toastSuccess("Contact created");
          } else if (failureMessage && !failureToastShown) {
            failureToastShown = toastWarn(failureMessage);
          }
          close();
        }
      });
    }

    if (partnerForm) {
      partnerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const validationResult = partnerValidation
          ? partnerValidation.run(true)
          : { ok: true, model: readPartnerFormModel(partnerForm) };
        const model = validationResult.model || readPartnerFormModel(partnerForm);
        if (!validationResult.ok) {
          toastWarn(QUICK_ADD_INVALID_TOAST);
          if (validationResult.firstInvalid) {
            focusField(validationResult.firstInvalid);
          }
          return;
        }

        partnerSaving = true;
        if (partnerSaveBtn) {
          partnerSaveBtn.disabled = true;
        }

        const rec = {
          company: model.company || '',
          name: model.name || '',
          email: model.email || '',
          phone: model.phone || '',
          createdAt: Date.now(),
          tier: "Unassigned",
        };
        let saved = false;
        let assignedId = model.id != null ? model.id : null;
        let failureMessage = '';
        let failureToastShown = false;
        try {
          if (window.Partners?.createQuick) {
            const result = await window.Partners.createQuick(rec);
            if(result && result.id != null && assignedId == null){
              assignedId = result.id;
            }
            saved = true;
          } else if (typeof window.dbPut === "function") {
            const putResult = await window.dbPut("partners", rec);
            if((putResult ?? rec?.id) != null && assignedId == null){
              assignedId = putResult ?? rec?.id;
            }
            saved = true;
          } else {
            failureMessage = 'Partners service unavailable. Partner not saved.';
            try { console.warn("[quickAdd] no Partners.createQuick or dbPut; saved to memory only", rec); }
            catch (_) {}
          }
        } catch (err) {
          failureMessage = 'Unable to save partner. Please try again.';
          failureToastShown = toastSoftError('[soft] [quickAdd] partner save failed', err, failureMessage);
        } finally {
          partnerSaving = false;
          const partnerId = assignedId != null ? String(assignedId) : (rec?.id != null ? String(rec.id) : '');
          broadcastDataChanged({
            scope: 'partners',
            action: 'create',
            reason: 'quick-add:partner',
            source: 'quick-add',
            partnerId,
            ids: partnerId ? [partnerId] : undefined
          });
          if (saved) {
            toastSuccess("Partner created");
          } else if (failureMessage && !failureToastShown) {
            failureToastShown = toastWarn(failureMessage);
          }
          close();
        }
      });
    }

    selectTab(initialTab || "contact");
  }

  // Expose for debugging or programmatic open
  window.QuickAddUnified = { open };
}

