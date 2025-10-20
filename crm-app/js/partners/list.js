import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';

const NAME_LINK_SELECTOR = 'a.partner-name, [data-ui="partner-name"], [data-role="partner-name"]';

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
}

ready(() => {
  refresh();
  if(!dataWatcherAttached && typeof document !== 'undefined'){
    dataWatcherAttached = true;
    const rerun = () => refresh();
    document.addEventListener('app:data:changed', rerun);
    document.addEventListener('partners:list:refresh', rerun);
  }
});
