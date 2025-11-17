import { openContactEditor as legacyOpenContactEditor } from '../contacts.js';

function normalizeMeta(meta){
  return meta && typeof meta === 'object' ? meta : {};
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
  return legacyOpenContactEditor(target, opts);
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
  return legacyOpenContactEditor(prefill, opts);
}

export default { mountContactEditor, mountNewContactEditor };
