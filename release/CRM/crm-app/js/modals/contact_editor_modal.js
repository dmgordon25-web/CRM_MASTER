import { openContactEditor as legacyOpenContactEditor } from '../contacts.js';

function normalizeMeta(meta){
  return meta && typeof meta === 'object' ? meta : {};
}

function applyContactModalPolish(){
  if (typeof document === 'undefined') return;
  const modal = document.querySelector('[data-ui="contact-edit-modal"], #contact-modal');
  if (!modal) return;
  modal.classList.add('identity-nameplate-layout');
}

export function mountContactEditor(contactId, meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'contact-entry',
    trigger: safeMeta.trigger,
    allowAutoOpen: safeMeta.allowAutoOpen !== false,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
  };
  const target = { id: contactId, __isNew: false };
  const result = legacyOpenContactEditor(target, opts);
  applyContactModalPolish();
  if (result && typeof result.then === 'function') {
    result.then(() => applyContactModalPolish()).catch(() => {});
  }
  return result;
}

export function mountNewContactEditor(meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'contact-entry:new',
    trigger: safeMeta.trigger,
    allowAutoOpen: true,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
    prefill: safeMeta.prefill,
  };
  const prefill = Object.assign({ __isNew: true }, safeMeta.prefill || {});
  const result = legacyOpenContactEditor(prefill, opts);
  applyContactModalPolish();
  if (result && typeof result.then === 'function') {
    result.then(() => applyContactModalPolish()).catch(() => {});
  }
  return result;
}

export default { mountContactEditor, mountNewContactEditor };
