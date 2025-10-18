import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';
import { installPartnerNameClickGate } from '../ui/guards/partner_click_gate.js';
import { installPartnersDialogGuard } from '../routes/partners_dialog_guard.js';

const DEBUG_FLAG_PARAM = 'partnerdebug';
const DEBUG_FLAG_VALUE = '1';
const NAME_LINK_SELECTOR = 'a.partner-name, [data-ui="partner-name"], [data-role="partner-name"]';

let partnerDebugModulePromise = null;
let partnersDialogGuardHandle = null;

const scheduleMicrotask = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => Promise.resolve().then(fn);

function safeConsoleWarn(...args){
  try{
    console && console.warn && console.warn(...args);
  }catch(_err){}
}

function ensurePartnersDialogGuard(){
  if(partnersDialogGuardHandle) return partnersDialogGuardHandle;
  try{
    const guard = installPartnersDialogGuard();
    partnersDialogGuardHandle = guard && typeof guard === 'object'
      ? guard
      : null;
    if(partnersDialogGuardHandle && typeof partnersDialogGuardHandle.sweep === 'function'){
      try{ partnersDialogGuardHandle.sweep(); }
      catch(_err){}
    }
  }catch(err){
    safeConsoleWarn('partners dialog guard install failed', err);
    partnersDialogGuardHandle = null;
  }
  return partnersDialogGuardHandle;
}

function isPartnerDebugEnabled(){
  if(typeof window === 'undefined') return false;
  try{
    const search = typeof window.location?.search === 'string' ? window.location.search : '';
    if(search){
      try{
        const params = new URLSearchParams(search);
        if(params.get(DEBUG_FLAG_PARAM) === DEBUG_FLAG_VALUE){
          return true;
        }
      }catch(_err){}
    }
  }catch(_err){}
  try{
    if(window.localStorage?.getItem(DEBUG_FLAG_PARAM) === DEBUG_FLAG_VALUE){
      return true;
    }
  }catch(_err){}
  return false;
}

function ensurePartnerDebugModule(){
  if(partnerDebugModulePromise) return partnerDebugModulePromise;
  partnerDebugModulePromise = import('../boot/partners_dom_debug.js').then(mod => {
    if(mod && typeof mod.ensurePartnerDomDebug === 'function'){
      try{ mod.ensurePartnerDomDebug(); }
      catch(_err){}
    }
    return mod;
  }).catch(err => {
    safeConsoleWarn('partnerdebug module load failed', err);
    return null;
  });
  return partnerDebugModulePromise;
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

  root.addEventListener('click', handler, true);
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
  const guardHandle = ensurePartnersDialogGuard();
  const guardSweep = guardHandle && typeof guardHandle.sweep === 'function'
    ? guardHandle.sweep
    : null;
  const debugEnabled = isPartnerDebugEnabled();
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

  if(guardSweep){
    try{
      scheduleMicrotask(() => {
        try{ guardSweep(); }
        catch(_err){}
      });
    }catch(_err){
      try{ guardSweep(); }
      catch(__err){}
    }
    if(result && typeof result.then === 'function'){
      result.then(() => {
        try{ guardSweep(); }
        catch(_err){}
      }).catch(() => {
        try{ guardSweep(); }
        catch(_err){}
      });
    }
  }

  if(debugEnabled){
    const triggerEl = trigger || null;
    const modulePromise = ensurePartnerDebugModule();
    const resolvedResult = Promise.resolve(result).catch(() => null);
    Promise.all([modulePromise, resolvedResult]).then(values => {
      const [mod, modalRoot] = values;
      const api = mod && typeof mod.softKillPartnerDialogs === 'function'
        ? mod
        : (typeof window !== 'undefined' && window.__PARTNER_DEBUG__ ? window.__PARTNER_DEBUG__ : null);
      const softKill = api && typeof api.softKillPartnerDialogs === 'function'
        ? api.softKillPartnerDialogs
        : null;
      if(softKill){
        try{ softKill({ preserve: modalRoot, trigger: triggerEl }); }
        catch(err){ safeConsoleWarn('partnerdebug soft kill failed', err); }
      }
    }).catch(err => {
      safeConsoleWarn('partnerdebug soft kill scheduling failed', err);
    });
  }

  return result;
}

function wireRoot(root){
  if(!root || root.__partnerEditWired) return;
  root.__partnerEditWired = true;
  ensureLinkData(root);
  ensureCanonicalNameCapture(root);
  installPartnerNameClickGate(root, (id, ctx) => invokePartnerEdit(id, ctx), {
    resolveId(trigger){
      const id = extractPartnerId(trigger);
      return normalizeId(id);
    },
    beforeOpen(){
      ensureLinkData(root);
      const table = typeof root.closest === 'function'
        ? root.closest('#tbl-partners')
        : null;
      if(table && table.getAttribute('data-mounted') === '1'){
        return false;
      }
      return true;
    }
  });
}

function refresh(){
  const root = getListRoot();
  if(root && !root.__partnerEditWired){
    wireRoot(root);
  }
  ensureLinkData(root);
}

ready(() => {
  ensurePartnersDialogGuard();
  refresh();
  if(!dataWatcherAttached && typeof document !== 'undefined'){
    dataWatcherAttached = true;
    const rerun = () => refresh();
    document.addEventListener('app:data:changed', rerun);
    document.addEventListener('partners:list:refresh', rerun);
  }
});
