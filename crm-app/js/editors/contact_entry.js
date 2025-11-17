const debugEnabled = () => typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DEBUG === true;

let modalModulePromise = null;
const HISTORY_LIMIT = 20;
const history = [];

const state = {
  status: 'idle',
  currentId: null,
  lastMeta: null,
  pendingRequest: null,
  activePromise: null,
  modalRoot: null,
  closeListener: null,
};

// Inventory: entry points now routed here from dashboard, workbench, quick add, calendar,
// partners (contact drilldowns), relationships map, partners detail, patch_2025-09-26 dashboard reports,
// and universal quick-create menu. Previously many of these called contacts.js openContactModal directly.

function logDebug(message, payload){
  if(!debugEnabled()) return;
  try{ console.debug('[contact-entry]', message, payload || {}); }
  catch(_err){}
}

function pushHistory(entry){
  if(!debugEnabled()) return;
  history.push(Object.assign({ ts: Date.now() }, entry));
  if(history.length > HISTORY_LIMIT){
    history.splice(0, history.length - HISTORY_LIMIT);
  }
}

function buildSourceHint(meta){
  const base = meta && typeof meta.source === 'string' && meta.source.trim()
    ? meta.source.trim()
    : 'contact-entry';
  const ctx = meta && typeof meta.context === 'string' && meta.context.trim()
    ? meta.context.trim()
    : '';
  return ctx ? `${base}:${ctx}` : base;
}

function normalizeMeta(meta){
  return meta && typeof meta === 'object' ? { ...meta } : {};
}

function loadModalModule(){
  if(!modalModulePromise){
    modalModulePromise = import('../modals/contact_editor_modal.js');
  }
  return modalModulePromise;
}

function detachCloseListener(){
  if(state.modalRoot && state.closeListener){
    try{ state.modalRoot.removeEventListener('close', state.closeListener); }
    catch(_err){}
  }
  state.modalRoot = null;
  state.closeListener = null;
}

function attachCloseListener(root){
  if(!(root instanceof HTMLElement)){
    detachCloseListener();
    return;
  }
  detachCloseListener();
  const handler = () => {
    const statusBefore = state.status;
    state.status = 'idle';
    state.currentId = null;
    pushHistory({ action: 'closed', statusBefore });
    processPendingQueue();
  };
  try{ root.addEventListener('close', handler); }
  catch(_err){}
  state.modalRoot = root;
  state.closeListener = handler;
}

function focusModal(){
  const root = state.modalRoot;
  if(!root || typeof root.querySelector !== 'function') return;
  const focusTarget = root.querySelector('.dlg') || root;
  if(focusTarget && typeof focusTarget.focus === 'function'){
    try{ focusTarget.focus({ preventScroll: true }); }
    catch(_err){
      try{ focusTarget.focus(); }
      catch(__err){}
    }
  }
}

function queueRequest(request){
  state.pendingRequest = request;
  if(!state.activePromise){
    state.activePromise = processPendingQueue();
  }
  return state.activePromise;
}

async function processPendingQueue(){
  if(!state.pendingRequest){
    state.activePromise = null;
    return null;
  }
  const next = state.pendingRequest;
  state.pendingRequest = null;
  try{
    const result = await performOpen(next.id, next.meta, next.isNew);
    return result;
  }finally{
    state.activePromise = null;
    if(state.pendingRequest){
      return processPendingQueue();
    }
  }
}

async function performOpen(targetId, meta, isNew){
  const metaObj = normalizeMeta(meta);
  const statusBefore = state.status;
  pushHistory({
    action: isNew ? 'new' : 'open',
    id: targetId || '',
    meta: metaObj,
    statusBefore,
  });
  logDebug('start', { targetId, meta: metaObj, isNew, statusBefore });
  state.status = 'opening';
  state.currentId = isNew ? null : (targetId || null);
  state.lastMeta = metaObj;

  try{
    const mod = await loadModalModule();
    const mount = isNew ? mod.mountNewContactEditor : mod.mountContactEditor;
    if(typeof mount !== 'function'){
      throw new Error('contact modal unavailable');
    }
    const result = await mount(targetId, Object.assign({}, metaObj, { sourceHint: buildSourceHint(metaObj) }));
    state.status = 'open';
    attachCloseListener(result);
    pushHistory({ action: 'opened', id: targetId || '', statusAfter: state.status });
    if(!isNew && state.currentId && targetId === state.currentId){
      focusModal();
    }
    return result || null;
  }catch(err){
    pushHistory({ action: 'error', id: targetId || '', error: String(err || '') });
    state.status = 'idle';
    state.currentId = null;
    detachCloseListener();
    throw err;
  }finally{
    if(state.status === 'opening'){
      state.status = 'idle';
      state.currentId = null;
    }
  }
}

export function closeContactEditor(reason){
  const statusBefore = state.status;
  if(statusBefore === 'idle') return;
  state.status = 'closing';
  pushHistory({ action: 'close', reason, statusBefore });
  const root = state.modalRoot;
  if(root && typeof root.close === 'function'){
    try{ root.close(); }
    catch(_err){}
  }
  detachCloseListener();
  state.status = 'idle';
  state.currentId = null;
  processPendingQueue();
}

export function openContactEditor(contactId, meta = {}){
  const targetId = contactId == null ? '' : String(contactId);
  const statusBefore = state.status;
  if(statusBefore === 'opening'){
    if(state.currentId && targetId && state.currentId === targetId){
      return state.activePromise || Promise.resolve(null);
    }
    return queueRequest({ id: targetId, meta, isNew: false });
  }
  if(statusBefore === 'open'){
    if(state.currentId && targetId && state.currentId === targetId){
      focusModal();
      return state.activePromise || Promise.resolve(state.modalRoot);
    }
    return queueRequest({ id: targetId, meta, isNew: false });
  }
  if(statusBefore === 'closing'){
    return queueRequest({ id: targetId, meta, isNew: false });
  }
  return queueRequest({ id: targetId, meta, isNew: false });
}

export function openNewContactEditor(meta = {}){
  const statusBefore = state.status;
  if(statusBefore === 'opening' || statusBefore === 'open' || statusBefore === 'closing'){
    return queueRequest({ id: '', meta, isNew: true });
  }
  return queueRequest({ id: '', meta, isNew: true });
}

if(typeof window !== 'undefined'){
  window.__DBG_dumpContactEditorHistory = function(){ return Array.from(history); };
}

export default { openContactEditor, openNewContactEditor, closeContactEditor };
