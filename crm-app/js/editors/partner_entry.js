const debugEnabled = () => typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DEBUG === true;

let modalModulePromise = null;
const state = {
  status: 'idle',
  currentId: null,
  lastMeta: null,
  pending: null,
  queue: null,
};
const history = [];
const HISTORY_LIMIT = 20;

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

function loadModalModule(){
  if(!modalModulePromise){
    modalModulePromise = import('../modals/partner_editor_modal.js');
  }
  return modalModulePromise;
}

async function performOpen(targetId, meta, isNew){
  const metaObj = meta && typeof meta === 'object' ? { ...meta } : {};
  const statusBefore = state.status;
  pushHistory({
    action: isNew ? 'new' : 'open',
    id: targetId || '',
    source: metaObj.source || '',
    context: metaObj.context || '',
    statusBefore,
  });
  logDebug('start', { targetId, meta: metaObj, isNew });
  state.status = 'opening';
  state.currentId = isNew ? null : (targetId || null);
  state.lastMeta = metaObj;

  try{
    const mod = await loadModalModule();
    const mount = isNew ? mod.mountNewPartnerEditor : mod.mountPartnerEditor;
    if(typeof mount !== 'function'){
      throw new Error('partner modal unavailable');
    }
    state.status = 'open';
    const result = await mount(targetId, Object.assign({}, metaObj, { sourceHint: buildSourceHint(metaObj) }));
    return result || null;
  }catch(err){
    pushHistory({ action: 'error', id: targetId || '', error: String(err || '') });
    throw err;
  }finally{
    state.status = 'idle';
    state.currentId = null;
    const queued = state.queue;
    state.queue = null;
    if(queued){
      logDebug('processing queued request', queued);
      state.pending = performOpen(queued.partnerId, queued.meta, queued.isNew);
      state.pending.catch(() => {});
    }
  }
}

export function openPartnerEditor(partnerId, meta){
  const targetId = partnerId == null ? '' : String(partnerId);
  const statusBefore = state.status;
  if((statusBefore === 'opening' || statusBefore === 'closing') && state.currentId && targetId && state.currentId !== targetId){
    logDebug('open requested during transition for different partner', { currentId: state.currentId, targetId });
  }

  if(statusBefore === 'opening' || statusBefore === 'closing'){
    state.queue = { partnerId: targetId, meta, isNew: false };
    return state.pending || Promise.resolve(null);
  }

  if(statusBefore === 'open'){
    if(state.currentId && targetId && state.currentId === targetId){
      logDebug('focus existing partner editor', { targetId });
      return state.pending || Promise.resolve(null);
    }
    state.queue = { partnerId: targetId, meta, isNew: false };
    return state.pending || Promise.resolve(null);
  }

  state.pending = performOpen(targetId, meta, false);
  return state.pending;
}

export function openNewPartnerEditor(meta){
  const statusBefore = state.status;
  if(statusBefore === 'opening' || statusBefore === 'closing' || statusBefore === 'open'){
    state.queue = { partnerId: '', meta, isNew: true };
    return state.pending || Promise.resolve(null);
  }
  state.pending = performOpen('', meta, true);
  return state.pending;
}

if(typeof window !== 'undefined'){
  window.__DBG_dumpPartnerEditorHistory = function(){ return Array.from(history); };
}

export default { openPartnerEditor, openNewPartnerEditor };
