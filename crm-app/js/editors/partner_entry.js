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

// Inventory: dashboard widgets, partners list rows, partner quick create, calendar, workbench,
// relationships map, pipeline leaderboard clicks, dashboard reports, and universal quick-create menu
// now delegate here. Legacy paths invoked ui/partner_edit_modal.js directly.

function logDebug(message, payload){
  if(!debugEnabled()) return;
  try{ console.debug('[partner-entry]', message, payload || {}); }
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
    : 'partner-entry';
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
    modalModulePromise = import('../modals/partner_editor_modal.js');
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

function hardReset(reason, options = {}){
  const { preserveQueue = false } = options;
  const snapshot = { ...state };
  pushHistory({ action: 'hard-reset', reason, snapshot });
  detachCloseListener();
  state.status = 'idle';
  state.currentId = null;
  if(!preserveQueue){
    state.pendingRequest = null;
    state.activePromise = null;
  }
  state.modalRoot = null;
  state.closeListener = null;
}

function attachCloseListener(root){
  if(!(root instanceof HTMLElement) || !root.isConnected){
    pushHistory({ action: 'attach-close-skipped', reason: 'invalid-root' });
    logDebug('attachCloseListener: invalid root', { root });
    hardReset('invalid-root');
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
  if(!root || !root.isConnected){
    pushHistory({ action: 'focus-failed', reason: 'root-detached' });
    logDebug('focusModal: missing root', { root });
    return;
  }
  if(typeof root.querySelector !== 'function') return;
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
  pushHistory({ action: 'queue', id: request && request.id ? String(request.id) : '', meta: request && request.meta, isNew: request && request.isNew });
  if(state.activePromise){
    logDebug('queueRequest: active promise in flight', { request });
    return state.activePromise.then(
      (value) => value,
      (err) => {
        const relay = state.activePromise;
        if(relay) return relay;
        throw err;
      },
      () => state.activePromise,
      () => state.activePromise,
    );
  }
  if(!state.activePromise){
    state.activePromise = processPendingQueue();
  }
  return state.activePromise;
}

async function processPendingQueue(){
  pushHistory({ action: 'process-start', pending: !!state.pendingRequest, status: state.status });
  logDebug('processPendingQueue:start', { pending: !!state.pendingRequest, status: state.status });
  if(!state.pendingRequest){
    state.activePromise = null;
    return null;
  }
  const next = state.pendingRequest;
  state.pendingRequest = null;
  let failed = false;
  let error = null;
  try{
    pushHistory({ action: 'process-open', id: next && next.id ? String(next.id) : '', isNew: next && next.isNew });
    const result = await performOpen(next.id, next.meta, next.isNew);
    return result;
  }catch(err){
    failed = true;
    error = err;
  }finally{
    pushHistory({ action: 'process-end', pending: !!state.pendingRequest });
    logDebug('processPendingQueue:end', { pending: !!state.pendingRequest });
    if(state.pendingRequest){
      const nextPromise = processPendingQueue();
      state.activePromise = nextPromise;
      if(!failed){
        return nextPromise;
      }
      // Ensure the failed promise rejects while still surfacing the queued promise for callers.
      // Avoid unhandled rejections from the queued branch by attaching a noop handler.
      nextPromise.catch(() => {});
      throw error;
    }else{
      state.activePromise = null;
      if(failed){
        throw error;
      }
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
    const mount = isNew ? mod.mountNewPartnerEditor : mod.mountPartnerEditor;
    if(typeof mount !== 'function'){
      throw new Error('partner modal unavailable');
    }
    const result = await mount(targetId, Object.assign({}, metaObj, { sourceHint: buildSourceHint(metaObj) }));
    state.status = 'open';
    attachCloseListener(result);
    logDebug('opened', { targetId, status: state.status, rootConnected: !!(result && result.isConnected) });
    pushHistory({ action: 'opened', id: targetId || '', statusAfter: state.status });
    if(!isNew && state.currentId && targetId === state.currentId){
      focusModal();
    }
    return result || null;
  }catch(err){
    pushHistory({ action: 'error', id: targetId || '', error: String(err || '') });
    logDebug('performOpen failed', { err });
    hardReset('open-failed', { preserveQueue: true });
    throw err;
  }finally{
    if(state.status === 'opening'){
      state.status = 'idle';
      state.currentId = null;
    }
  }
}

export function closePartnerEditor(reason){
  const statusBefore = state.status;
  if(statusBefore === 'idle') return;
  state.status = 'closing';
  pushHistory({ action: 'close', reason, statusBefore });
  logDebug('closePartnerEditor', { reason, statusBefore });
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

export function openPartnerEditor(partnerId, meta = {}){
  const targetId = partnerId == null ? '' : String(partnerId);
  const statusBefore = state.status;
  pushHistory({ action: 'invoke-open', id: targetId, meta: normalizeMeta(meta), statusBefore });
  logDebug('openPartnerEditor invoked', { targetId, statusBefore, meta });
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

export function openNewPartnerEditor(meta = {}){
  const statusBefore = state.status;
  pushHistory({ action: 'invoke-open-new', statusBefore, meta: normalizeMeta(meta) });
  logDebug('openNewPartnerEditor invoked', { statusBefore, meta });
  if(statusBefore === 'opening' || statusBefore === 'open' || statusBefore === 'closing'){
    return queueRequest({ id: '', meta, isNew: true });
  }
  return queueRequest({ id: '', meta, isNew: true });
}

if(typeof window !== 'undefined'){
  window.__DBG_dumpPartnerEditorHistory = function(){ return Array.from(history); };
  window.__DBG_resetPartnerEditor = function(reason = 'manual'){
    hardReset(reason);
    return { ...state };
  };
}

export default { openPartnerEditor, openNewPartnerEditor, closePartnerEditor };
