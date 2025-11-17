import { openPartnerEditModal as legacyOpenPartnerEditor } from '../ui/partner_edit_modal.js';

function normalizeMeta(meta){
  return meta && typeof meta === 'object' ? meta : {};
}

export function mountPartnerEditor(partnerId, meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'partner-entry',
    trigger: safeMeta.trigger,
    allowAutoOpen: safeMeta.allowAutoOpen !== false,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
  };
  return legacyOpenPartnerEditor(partnerId || '', opts);
}

export function mountNewPartnerEditor(meta){
  const safeMeta = normalizeMeta(meta);
  const opts = {
    sourceHint: safeMeta.sourceHint || safeMeta.source || 'partner-entry:new',
    trigger: safeMeta.trigger,
    allowAutoOpen: true,
    suppressErrorToast: safeMeta.suppressErrorToast === true,
  };
  return legacyOpenPartnerEditor('', opts);
}

export default { mountPartnerEditor, mountNewPartnerEditor };
