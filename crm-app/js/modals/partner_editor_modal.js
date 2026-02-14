import { openPartnerEditModal as legacyOpenPartnerEditor } from '../ui/partner_edit_modal.js';

function normalizeMeta(meta){
  return meta && typeof meta === 'object' ? meta : {};
}

function applyPartnerModalPolish(){
  if (typeof document === 'undefined') return;
  const modal = document.querySelector('[data-ui="partner-edit-modal"], #partner-modal');
  if (!modal) return;
  modal.classList.add('identity-nameplate-layout');
}

export function mountPartnerEditor(partnerId, meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'partner-entry',
    trigger: safeMeta.trigger,
    allowAutoOpen: safeMeta.allowAutoOpen !== false,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
  };
  const result = legacyOpenPartnerEditor(partnerId || '', opts);
  applyPartnerModalPolish();
  if (result && typeof result.then === 'function') {
    result.then(() => applyPartnerModalPolish()).catch(() => {});
  }
  return result;
}

export function mountNewPartnerEditor(meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'partner-entry:new',
    trigger: safeMeta.trigger,
    allowAutoOpen: true,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
  };
  const result = legacyOpenPartnerEditor('', opts);
  applyPartnerModalPolish();
  if (result && typeof result.then === 'function') {
    result.then(() => applyPartnerModalPolish()).catch(() => {});
  }
  return result;
}

export default { mountPartnerEditor, mountNewPartnerEditor };
