(function(){
  if(window.Selection && typeof window.Selection.get === 'function') return;

  const isDebug = window.__ENV__ && window.__ENV__.DEBUG === true;
  const raf = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (fn)=> setTimeout(fn, 16);

  const state = {
    ids: new Set(),
    items: new Map(),
    type: 'contacts'
  };

  const listeners = new Set();
  let syncScheduled = false;
  const enqueueMicrotask = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn) => Promise.resolve().then(fn);

  function cloneIds(){
    return Array.from(state.ids);
  }

  function normalizeType(type){
    return type === 'partners' ? 'partners' : 'contacts';
  }

  function resolveRowId(node){
    if(!node) return null;
    const attrNames = ['data-id','data-contact-id','data-partner-id','data-row-id'];
    for(const name of attrNames){
      if(node.getAttribute){
        const val = node.getAttribute(name);
        if(val) return String(val);
      }
    }
    if(node.dataset){
      for(const key of ['id','contactId','partnerId','rowId']){
        if(node.dataset[key]) return String(node.dataset[key]);
      }
    }
    const row = node.closest ? node.closest('[data-id],[data-contact-id],[data-partner-id],[data-row-id],tr') : null;
    if(row){
      for(const name of attrNames){
        const val = row.getAttribute(name);
        if(val) return String(val);
      }
      if(row.dataset){
        for(const key of ['id','contactId','partnerId','rowId']){
          if(row.dataset[key]) return String(row.dataset[key]);
        }
      }
    }
    return null;
  }

  function resolveRowElement(node){
    if(!node || typeof node.closest !== 'function') return null;
    return node.closest('[data-row], tr[data-id], tr[data-row-id], li[data-id], [data-selectable]') || null;
  }

  function resolveSelectionType(node){
    if(!node) return state.type;
    if(node.dataset){
      if(node.dataset.selectionType) return normalizeType(node.dataset.selectionType);
      if(node.dataset.type) return normalizeType(node.dataset.type);
    }
    const scopeHost = typeof node.closest === 'function'
      ? node.closest('[data-selection-type],[data-selection-scope]')
      : null;
    if(scopeHost){
      const viaType = scopeHost.getAttribute && scopeHost.getAttribute('data-selection-type');
      if(viaType) return normalizeType(viaType);
      const viaScope = scopeHost.getAttribute && scopeHost.getAttribute('data-selection-scope');
      if(viaScope) return normalizeType(viaScope);
      if(scopeHost.dataset){
        if(scopeHost.dataset.selectionType) return normalizeType(scopeHost.dataset.selectionType);
        if(scopeHost.dataset.selectionScope) return normalizeType(scopeHost.dataset.selectionScope);
      }
    }
    return state.type;
  }

  function buildDetail(source, extra){
    const detail = Object.assign({ type: state.type, ids: cloneIds(), source }, extra && typeof extra === 'object' ? extra : {});
    return detail;
  }

  let emitScheduled = false;
  let pendingDetail = null;

  function flushEmit(){
    emitScheduled = false;
    const detail = pendingDetail;
    pendingDetail = null;
    if(!detail) return;
    enqueueMicrotask(() => {
      try{
        if(typeof document !== 'undefined' && document && typeof document.dispatchEvent === 'function'){
          document.dispatchEvent(new CustomEvent('selection:changed', { detail }));
        }
      }catch (err) {
        if(isDebug && console && console.warn){
          console.warn('Selection event dispatch failed', err);
        }
      }
      listeners.forEach(cb => {
        try{ cb(detail); }
        catch (err) { if(isDebug && console && console.warn) console.warn('Selection listener failed', err); }
      });
    });
  }

  function scheduleEmit(){
    if(emitScheduled) return;
    emitScheduled = true;
    enqueueMicrotask(flushEmit);
  }

  function emit(source, extra){
    const detail = buildDetail(source, extra);
    pendingDetail = detail;
    scheduleEmit();
    return detail;
  }

  function checkboxSelector(){
    return '[data-ui="row-check"], table tbody input[type="checkbox"][data-role="select"]';
  }

  function syncCheckboxes(){
    if(typeof document === 'undefined') return;
    const checkboxes = document.querySelectorAll(checkboxSelector());
    const present = new Set();
    checkboxes.forEach(cb => {
      const id = resolveRowId(cb);
      if(!id) return;
      present.add(id);
      const shouldCheck = state.ids.has(id);
      if(cb.checked !== shouldCheck) cb.checked = shouldCheck;
      const row = resolveRowElement(cb);
      if(row){
        if(shouldCheck) row.setAttribute('data-selected', '1');
        else row.removeAttribute('data-selected');
        row.classList?.toggle?.('is-selected', shouldCheck);
        if(row.style && !shouldCheck && row.style.backgroundColor && row.style.backgroundColor.includes('rgba')){
          row.style.backgroundColor = '';
        }
      }
    });
    if(present.size || checkboxes.length){
      Array.from(state.ids).forEach(id => {
        if(!present.has(id)){
          state.ids.delete(id);
          state.items.delete(id);
        }
      });
      if(state.ids.size === 0) state.type = 'contacts';
    }
  }

  function scheduleSync(){
    if(syncScheduled) return;
    syncScheduled = true;
    raf(()=>{
      syncScheduled = false;
      try{ syncCheckboxes(); }
      catch (err) { if(isDebug && console && console.warn) console.warn('selection sync failed', err); }
    });
  }

  function updateMetrics(){
    try { window.__SEL_COUNT__ = state.ids.size; }
    catch (_) {}
  }

  function setActionBarVisibility(){
    if(typeof document === 'undefined') return;
    const visible = state.ids.size > 0 ? '1' : '0';
    document.querySelectorAll('[data-ui="action-bar"]').forEach(bar => {
      bar.setAttribute('data-visible', visible);
    });
  }

  function clear(source){
    if(state.ids.size === 0 && state.type === 'contacts'){
      emit(source || 'clear');
      return;
    }
    state.ids.clear();
    state.items.clear();
    state.type = 'contacts';
    scheduleSync();
    emit(source || 'clear');
  }

  function setIds(ids, type, source){
    const nextIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    state.ids = new Set(nextIds);
    state.items = new Map(nextIds.map(id => [id, { type: normalizeType(type) }]));
    state.type = normalizeType(type);
    scheduleSync();
    emit(source || 'set');
  }

  function add(id, type){
    if(id == null) return;
    const key = String(id);
    const nextType = normalizeType(type);
    if(state.ids.size && state.type !== nextType){
      clear();
    }
    state.type = nextType;
    const before = state.ids.size;
    state.ids.add(key);
    state.items.set(key, { type: state.type });
    if(state.ids.size !== before){
      scheduleSync();
      emit('add');
    }
  }

  function remove(id){
    if(id == null) return;
    const key = String(id);
    if(!state.ids.has(key)) return;
    state.ids.delete(key);
    state.items.delete(key);
    if(state.ids.size === 0) state.type = 'contacts';
    scheduleSync();
    emit('remove');
  }

  function toggle(id, type){
    if(id == null) return;
    const key = String(id);
    if(state.ids.has(key)){
      remove(key);
      return;
    }
    add(key, type);
  }

  function prune(ids, source){
    const list = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    if(!list.length) return false;
    let changed = false;
    list.forEach(id => {
      if(state.ids.delete(id)){
        changed = true;
        state.items.delete(id);
      }
    });
    if(changed && state.ids.size === 0) state.type = 'contacts';
    if(changed){
      scheduleSync();
      emit(source || 'prune');
    }
    return changed;
  }

  function snapshot(){
    return { ids: cloneIds(), type: state.type };
  }

  function restore(snap, source){
    if(!snap || !Array.isArray(snap.ids)){
      clear(source || 'restore');
      return;
    }
    setIds(snap.ids, snap.type, source || 'restore');
  }

  function reemit(source, extra){
    emit(source || 'refresh', extra);
  }

  function idsOf(filterType){
    const target = filterType ? normalizeType(filterType) : null;
    const entries = Array.from(state.items.entries())
      .filter(([, meta]) => !target || (meta && meta.type === target))
      .map(([key]) => key);
    return entries;
  }

  function count(){
    return state.ids.size;
  }

  function size(){
    return state.ids.size;
  }

  function all(){
    return cloneIds();
  }

  function getSelectedIds(){
    return cloneIds();
  }

  function atLeast(n){
    const limit = Number(n);
    if(!Number.isFinite(limit)) return state.ids.size > 0;
    return state.ids.size >= limit;
  }

  function onChange(callback){
    if(typeof callback !== 'function') return ()=>{};
    listeners.add(callback);
    return ()=> listeners.delete(callback);
  }

  const Selection = {
    get(){
      return { type: state.type, ids: cloneIds() };
    },
    set(ids, type, source){ setIds(ids, type, source); },
    select(id, type){ add(id, type); },
    deselect(id){ remove(id); },
    toggle,
    clear,
    add,
    remove,
    onChange,
    count,
    size,
    all,
    getSelectedIds,
    atLeast,
    idsOf,
    syncCheckboxes,
    snapshot,
    restore,
    reemit,
    prune
  };

  const compat = {
    get type(){ return state.type; },
    set type(value){ state.type = normalizeType(value); },
    get ids(){ return state.ids; },
    get items(){ return state.items; },
    add,
    remove,
    del: remove,
    clear,
    count,
    size,
    all,
    getSelectedIds: cloneIds,
    atLeast,
    getIds: cloneIds,
    idsOf,
    syncChecks: scheduleSync,
    set: setIds,
    prune,
    toggle,
    snapshot,
    restore,
    reemit
  };

  function handleCheckboxChange(event){
    const target = event.target;
    const InputCtor = typeof HTMLInputElement !== 'undefined' ? HTMLInputElement : null;
    if(!target || (InputCtor && !(target instanceof InputCtor))) return;
    const checkbox = target.closest ? target.closest(checkboxSelector()) : null;
    if(!checkbox || checkbox !== target) return;
    const id = resolveRowId(checkbox);
    if(!id) return;
    const type = resolveSelectionType(checkbox);
    toggle(id, type);
    const row = resolveRowElement(checkbox);
    const active = state.ids.has(String(id));
    if(row){
      if(active) row.setAttribute('data-selected', '1');
      else row.removeAttribute('data-selected');
      row.classList?.toggle?.('is-selected', active);
    }
    if(checkbox.checked !== active){
      checkbox.checked = active;
    }
  }

  if(typeof document !== 'undefined' && !window.__SEL_CB_WIRED__){
    window.__SEL_CB_WIRED__ = true;
    document.addEventListener('change', handleCheckboxChange, true);
  }

  window.Selection = Selection;
  window.SelectionService = compat;
  window.__SELMODEL__ = compat;

  onChange(()=>{
    updateMetrics();
    setActionBarVisibility();
  });
  updateMetrics();
  setActionBarVisibility();
})();
