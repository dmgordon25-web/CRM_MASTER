import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';

const NAME_LINK_SELECTOR = 'a.partner-name, [data-ui="partner-name"], [data-role="partner-name"]';
const DIALOG_ALLOWLIST = '[data-ui="merge-modal"],[data-ui="merge-confirm"],[data-ui="toast"]';
const LEGACY_DIALOG_SELECTOR = '#partner-profile-modal,.partner-profile-modal,[data-legacy-partner-dialog]';

function removeLegacyDialog(dialog){
  if(!dialog || String(dialog.nodeName || '').toLowerCase() !== 'dialog') return false;
  try {
    if(dialog.matches?.(LEGACY_DIALOG_SELECTOR)){
      dialog.close?.();
      dialog.remove?.();
      return true;
    }
  } catch (_err) {}
  const id = (dialog.id || '').toLowerCase();
  const className = (dialog.className || '').toLowerCase();
  if(id.includes('partner-profile') || className.includes('partner-profile')){
    try { dialog.close?.(); }
    catch (_err) {}
    try { dialog.remove?.(); }
    catch (_err) {}
    return true;
  }
  return false;
}

function closeDisallowedDialogs(){
  if(typeof document === 'undefined') return;
  const allow = DIALOG_ALLOWLIST;
  document.querySelectorAll('dialog').forEach(dialog => {
    if(removeLegacyDialog(dialog)) return;
    if(!dialog.hasAttribute?.('open')) return;
    try {
      if(dialog.matches?.(allow)) return;
    } catch (_err) {
      // If matches throws, fall through and attempt close.
    }
    try {
      if(typeof dialog.close === 'function'){
        dialog.close();
        return;
      }
    } catch (_err) {}
    try {
      dialog.removeAttribute?.('open');
    } catch (__err) {}
  });
}

function isPartnersRoute(){
  if(typeof window === 'undefined' || !window?.location) return false;
  const raw = typeof window.location.hash === 'string' ? window.location.hash : '';
  if(!raw || raw === '#') return false;
  const cleaned = raw.replace(/^#/, '').replace(/^\/+/, '').toLowerCase();
  if(!cleaned) return false;
  const segment = cleaned.split('?')[0];
  return segment === 'partners' || segment.startsWith('partners/');
}

function guardPartnerRouteDialogs(){
  if(!isPartnersRoute()) return;
  closeDisallowedDialogs();
}

function ensureDialogGuard(){
  if(typeof window === 'undefined' || window.__PARTNERS_DIALOG_GUARD__) return;
  window.__PARTNERS_DIALOG_GUARD__ = true;
  window.addEventListener('hashchange', guardPartnerRouteDialogs);
  document.addEventListener('partners:list:refresh', guardPartnerRouteDialogs);
  document.addEventListener('app:data:changed', guardPartnerRouteDialogs);
}

function ready(fn){
  if(typeof document === 'undefined'){ return; }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }else{
    fn();
  }
}

function getListRoot(){
  if(typeof document === 'undefined') return null;
  const table = document.getElementById('tbl-partners');
  if(!table) return null;
  if(table.tBodies && table.tBodies.length){
    return table.tBodies[0];
  }
  return table;
}

function normalizeId(value){
  return String(value == null ? '' : value).trim();
}

function assignIdAttributes(node, id){
  if(!node || !id) return;
  const normalized = normalizeId(id);
  if(!normalized) return;
  if(node.dataset){
    node.dataset.id = normalized;
    if(!node.dataset.partnerId) node.dataset.partnerId = normalized;
  }
  node.setAttribute('data-id', normalized);
  if(!node.getAttribute('data-partner-id')){
    node.setAttribute('data-partner-id', normalized);
  }
}

function extractPartnerId(node){
  if(!node) return '';
  const dataset = node.dataset || {};
  if(dataset.id) return normalizeId(dataset.id);
  if(dataset.partnerId) return normalizeId(dataset.partnerId);
  if(node.getAttribute){
    const attrId = node.getAttribute('data-id') || node.getAttribute('data-partner-id');
    if(attrId) return normalizeId(attrId);
  }
  const row = typeof node.closest === 'function'
    ? node.closest('tr[data-id], tr[data-partner-id]')
    : null;
  if(row){
    const rowId = row.getAttribute('data-id') || row.getAttribute('data-partner-id');
    if(rowId){
      assignIdAttributes(node, rowId);
      return normalizeId(rowId);
    }
  }
  return '';
}

function resetPartnerSelection(){
  if(typeof document !== 'undefined'){
    document.querySelectorAll('#tbl-partners [data-ui="row-check"]').forEach(node => {
      node.removeAttribute('aria-checked');
      if ('checked' in node) {
        try { node.checked = false; }
        catch (_) {}
      }
      const row = node.closest('[data-id]');
      if(row && row.hasAttribute('data-selected')){
        row.removeAttribute('data-selected');
      }
    });
  }
  if (typeof window !== 'undefined') {
    try { window.SelectionStore?.clear?.('partners'); }
    catch (_) {}
    try { window.Selection?.clear?.('partners:list-init'); }
    catch (_) {}
    try { window.__UPDATE_ACTION_BAR_VISIBLE__?.(); }
    catch (_) {}
  }
}

function ensureLinkData(root){
  if(!root || typeof root.querySelectorAll !== 'function') return;
  root.querySelectorAll('a.partner-name, [data-partner-id]').forEach(link => {
    const id = extractPartnerId(link);
    if(id) assignIdAttributes(link, id);
    if(typeof link.removeAttribute === 'function'){
      try{ link.removeAttribute('onclick'); }
      catch(_err){}
    }
    try{ link.onclick = null; }
    catch(_err){}
  });
}

function ensureCanonicalNameCapture(root){
  if(!root || typeof root.addEventListener !== 'function') return;
  if(root.__partnerCanonicalCapture) return;

  const handler = (event) => {
    if(event && event.__crmRowEditorHandled) return;
    const rawTarget = event?.target;
    let target = null;
    if(rawTarget && typeof rawTarget === 'object'){
      if(typeof Element !== 'undefined' && rawTarget instanceof Element){
        target = rawTarget;
      }else if(rawTarget.nodeType === 1){
        target = rawTarget;
      }else if(rawTarget.parentElement){
        target = rawTarget.parentElement;
      }
    }
    if(!target) return;
    const trigger = typeof target.closest === 'function'
      ? target.closest(NAME_LINK_SELECTOR)
      : null;
    if(!trigger || !root.contains(trigger)) return;
    const cell = typeof trigger.closest === 'function'
      ? trigger.closest('td, th')
      : null;
    if(cell && cell.classList && !cell.classList.contains('cell-edit')) return;

    const partnerId = extractPartnerId(trigger);
    if(!partnerId) return;

    if(typeof event.preventDefault === 'function') event.preventDefault();
    if(typeof event.stopPropagation === 'function') event.stopPropagation();
    if(typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    event.__partnerEditHandled = true;

    ensureLinkData(root);
    const result = invokePartnerEdit(partnerId, { trigger, event });
    if(result && typeof result.catch === 'function'){
      result.catch(() => {});
    }
  };

  root.addEventListener('click', handler);
  root.__partnerCanonicalCapture = handler;
}

let dataWatcherAttached = false;

function invokePartnerEdit(partnerId, context){
  const normalized = normalizeId(partnerId);
  if(!normalized) return null;
  const trigger = context && context.trigger ? context.trigger : null;
  if(trigger){
    assignIdAttributes(trigger, normalized);
  }
  let result = null;
  try{
    result = openPartnerEditModal(normalized, {
      trigger,
      sourceHint: 'partners:list-name-click'
    });
  }catch(err){
    try{ console && console.warn && console.warn('openPartnerEdit error', err); }
    catch(_err){}
    return null;
  }

  if(result && typeof result.catch === 'function'){
    result.catch(err => {
      try{ console && console.warn && console.warn('openPartnerEdit failed', err); }
      catch(_err){}
    });
  }

  return result;
}

function wireRoot(root){
  if(!root || root.__partnerEditWired) return;
  root.__partnerEditWired = true;
  ensureLinkData(root);
  ensureCanonicalNameCapture(root);
}

function refresh(){
  const root = getListRoot();
  if(root && !root.__partnerEditWired){
    wireRoot(root);
  }
  ensureLinkData(root);
  guardPartnerRouteDialogs();
}

ready(() => {
  ensureDialogGuard();
  resetPartnerSelection();
  refresh();
  if(!dataWatcherAttached && typeof document !== 'undefined'){
    dataWatcherAttached = true;
    const rerun = () => refresh();
    document.addEventListener('app:data:changed', rerun);
    document.addEventListener('partners:list:refresh', rerun);
  }
});
