import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';

const DEBUG_FLAG_PARAM = 'partnerdebug';
const DEBUG_FLAG_VALUE = '1';

let partnerDebugModulePromise = null;

function safeConsoleWarn(...args){
  try{
    console && console.warn && console.warn(...args);
  }catch(_err){}
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
  });
}

let dataWatcherAttached = false;

function handleClick(event){
  if(event.__partnerEditHandled) return;
  const root = event.currentTarget;
  const table = typeof root.closest === 'function'
    ? root.closest('#tbl-partners')
    : null;
  if(table && table.getAttribute('data-mounted') === '1'){
    return;
  }
  const trigger = event.target && typeof event.target.closest === 'function'
    ? event.target.closest('a.partner-name, [data-role="partner-name"], [data-partner-id]')
    : null;
  if(!trigger || !root.contains(trigger)) return;
  const id = extractPartnerId(trigger);
  if(!id) return;
  const debugEnabled = isPartnerDebugEnabled();
  if(typeof event.stopImmediatePropagation === 'function'){
    event.stopImmediatePropagation();
  }
  event.preventDefault();
  event.stopPropagation();
  const normalized = normalizeId(id);
  if(!normalized) return;
  event.__partnerEditHandled = true;
  try{
    const result = openPartnerEditModal(normalized, {
      trigger,
      sourceHint: 'partners:list-name-click'
    });
    if(result && typeof result.catch === 'function'){
      result.catch(err => {
        try{ console && console.warn && console.warn('openPartnerEdit failed', err); }
        catch(_err){}
      });
    }
    if(debugEnabled){
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
          try{ softKill({ preserve: modalRoot, trigger }); }
          catch(err){ safeConsoleWarn('partnerdebug soft kill failed', err); }
        }
      }).catch(err => {
        safeConsoleWarn('partnerdebug soft kill scheduling failed', err);
      });
    }
  }catch(err){
    try{ console && console.warn && console.warn('openPartnerEdit error', err); }
    catch(_err){}
  }
}

function wireRoot(root){
  if(!root || root.__partnerEditWired) return;
  root.__partnerEditWired = true;
  root.addEventListener('click', handleClick);
  ensureLinkData(root);
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
