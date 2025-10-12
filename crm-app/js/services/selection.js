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
  const domSelectedIds = new Set();

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

  function buildDetail(source, extra){
    const ids = cloneIds();
    const items = ids.map(id => {
      const meta = state.items.get(id);
      return meta ? Object.assign({}, meta, { id }) : { id, type: state.type };
    });
    const detail = Object.assign({
      type: state.type,
      ids,
      keys: ids.slice(),
      count: ids.length,
      items,
      selected: items.map(entry => entry.id),
      source
    }, extra && typeof extra === 'object' ? extra : {});
    return detail;
  }

  function updateWindowMetrics(detail){
    const snapshot = detail || buildDetail('metrics');
    const ids = Array.isArray(snapshot.ids) ? snapshot.ids.slice() : [];
    const keys = Array.isArray(snapshot.keys) ? snapshot.keys.slice() : ids.slice();
    window.__SEL_COUNT__ = keys.length;
    window.__SEL_KEYS__ = keys.slice();
    window.__SEL_IDS__ = keys.slice();
    window.__SEL_TYPE__ = snapshot.type || 'contacts';
    window.__SEL_DETAIL__ = snapshot;
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
        if(typeof window !== 'undefined' && typeof window.dispatchEvent === 'function'){
          window.dispatchEvent(new CustomEvent('selection:change', { detail }));
        }
      }catch (err) {
        if(isDebug && console && console.warn){
          console.warn('Selection change dispatch failed', err);
        }
      }
      try{
        if(typeof document !== 'undefined' && document && typeof document.dispatchEvent === 'function'){
          document.dispatchEvent(new CustomEvent('selection:change', { detail }));
          document.dispatchEvent(new CustomEvent('selection:changed', { detail }));
        }
      }catch (err) {
        if(isDebug && console && console.warn){
          console.warn('Legacy selection dispatch failed', err);
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
    updateWindowMetrics(detail);
    pendingDetail = detail;
    scheduleEmit();
    return detail;
  }

  function cssEscapeSafe(value){
    const str = value == null ? '' : String(value);
    if(typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(str);
    return str.replace(/[^a-zA-Z0-9_\-]/g, match => `\\${match}`);
  }

  const ROW_SELECTOR_TEMPLATES = [
    '[data-selectable][data-id="%ID%"]',
    '[data-selectable][data-contact-id="%ID%"]',
    '[data-selectable][data-partner-id="%ID%"]',
    '[data-row][data-id="%ID%"]',
    '[data-row][data-contact-id="%ID%"]',
    '[data-row][data-partner-id="%ID%"]',
    'tr[data-id="%ID%"]',
    'tr[data-contact-id="%ID%"]',
    'tr[data-partner-id="%ID%"]',
    '[data-selected-row="%ID%"]'
  ];

  const ROW_ROOT_SELECTOR = '[data-selectable],[data-row],tr[data-id],[data-contact-id],[data-partner-id],[data-row-id]';
  const CHECKBOX_SELECTOR = 'input[type="checkbox"],input[data-role="select"],input[data-role="select-checkbox"]';
  const handlerRegistry = new WeakMap();

  function rowsForId(id){
    const selector = ROW_SELECTOR_TEMPLATES.map(tpl => tpl.replace(/%ID%/g, cssEscapeSafe(id))).join(',');
    if(!selector) return [];
    const nodes = Array.from(document.querySelectorAll(selector));
    return nodes
      .map(node => node.closest('[data-selectable],[data-row],tr') || node)
      .filter(Boolean);
  }

  function rowForNode(node){
    if(!node) return null;
    if(node.matches && node.matches(ROW_ROOT_SELECTOR)) return node;
    return node.closest ? node.closest(ROW_ROOT_SELECTOR) : null;
  }

  function inferRowType(row){
    if(!row) return state.type || 'contacts';
    const dataset = row.dataset || {};
    if(row.hasAttribute && (row.hasAttribute('data-partner-id') || row.hasAttribute('data-partner'))) return 'partners';
    if(dataset.partnerId || dataset.partner) return 'partners';
    if(row.hasAttribute && (row.hasAttribute('data-contact-id') || row.hasAttribute('data-contact'))) return 'contacts';
    if(dataset.contactId || dataset.contact) return 'contacts';
    if(dataset.type) return normalizeType(dataset.type);
    const attr = row.getAttribute ? row.getAttribute('data-type') : null;
    if(attr) return normalizeType(attr);
    return state.type || 'contacts';
  }

  function keyForNode(node){
    const row = rowForNode(node);
    return row ? resolveRowId(row) : resolveRowId(node);
  }

  function syncRowsInContainer(container){
    if(!container || typeof container.querySelectorAll !== 'function') return;
    const rows = Array.from(container.querySelectorAll(ROW_ROOT_SELECTOR));
    rows.forEach(row => {
      const key = resolveRowId(row);
      if(!key) return;
      syncRowState(row, state.ids.has(String(key)));
    });
  }

  function handleCheckboxChange(event){
    const target = event && event.target;
    if(!target) return;
    const tag = target.tagName ? target.tagName.toLowerCase() : '';
    const matches = typeof target.matches === 'function' ? target.matches.bind(target) : null;
    if(matches){
      if(!matches(CHECKBOX_SELECTOR)) return;
    }else if(tag !== 'input'){ return; }
    const row = rowForNode(target);
    const key = keyForNode(row || target);
    if(!key) return;
    const id = String(key);
    const desired = !!target.checked;
    const current = state.ids.has(id);
    if(desired === current){
      syncRowState(row, current);
      try{ target.checked = current; }
      catch (_err) {}
      return;
    }
    const rowType = inferRowType(row);
    if(desired){
      selectKey(id, rowType, 'dom:checkbox');
    }else{
      deselectKey(id, 'dom:checkbox');
    }
    const nowSelected = state.ids.has(id);
    syncRowState(row, nowSelected);
    try{ target.checked = nowSelected; }
    catch (_err) {}
  }

  function attachRowHandlers(container){
    const target = container || document;
    if(!target || typeof target.addEventListener !== 'function') return;
    if(!handlerRegistry.has(target)){
      const changeListener = (event) => {
        if(!event) return;
        handleCheckboxChange(event);
      };
      target.addEventListener('change', changeListener, true);
      handlerRegistry.set(target, { changeListener });
    }
    syncRowsInContainer(target);
  }

  function syncRowState(row, selected){
    if(!row) return;
    try{
      if(row.classList){
        row.classList.toggle('selected', !!selected);
        row.classList.toggle('is-selected', !!selected);
      }
    }catch (_err) {}
    try{
      if(selected){
        row.setAttribute('data-selected', 'true');
        row.setAttribute('aria-selected', 'true');
      }else{
        row.setAttribute('data-selected', 'false');
        row.setAttribute('aria-selected', 'false');
      }
    }catch (_err) {}
    try{
      if(row.dataset){
        if(selected) row.dataset.selected = 'true';
        else row.dataset.selected = 'false';
      }
    }catch (_err) {}
    const control = row.querySelector('input[type="checkbox"],input[type="radio"]');
    if(control && control.checked !== !!selected){
      try{ control.checked = !!selected; }
      catch (_err) {}
    }
  }

  function syncDomSelection(){
    const ids = Array.from(state.ids);
    const retain = new Set(ids);
    domSelectedIds.forEach(id => {
      if(!retain.has(id)){
        rowsForId(id).forEach(row => syncRowState(row, false));
      }
    });
    ids.forEach(id => {
      rowsForId(id).forEach(row => syncRowState(row, true));
    });
    domSelectedIds.clear();
    ids.forEach(id => domSelectedIds.add(id));
  }

  function syncCheckboxes(){
    const checkboxes = document.querySelectorAll('table tbody input[type="checkbox"]');
    const present = new Set();
    let mutated = false;
    checkboxes.forEach(cb => {
      const id = resolveRowId(cb);
      if(!id) return;
      present.add(id);
      const shouldCheck = state.ids.has(id);
      if(cb.checked !== shouldCheck) cb.checked = shouldCheck;
      const row = cb.closest('[data-selectable],[data-row],tr');
      if(row) syncRowState(row, shouldCheck);
    });
    if(present.size || checkboxes.length){
      Array.from(state.ids).forEach(id => {
        if(!present.has(id)){
          if(state.ids.delete(id)) mutated = true;
          state.items.delete(id);
        }
      });
      if(state.ids.size === 0) state.type = 'contacts';
    }
    syncDomSelection();
    if(mutated){
      emit('sync');
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

  function selectKey(id, type, source){
    if(id == null) return;
    const key = String(id);
    if(!key) return;
    const nextType = normalizeType(type || state.type || 'contacts');
    if(state.ids.size && state.type !== nextType){
      clearSelection(source || 'select:retarget');
    }
    state.type = nextType;
    if(state.ids.has(key)){
      const meta = state.items.get(key) || {};
      state.items.set(key, Object.assign({}, meta, { type: state.type }));
      updateWindowMetrics();
      return;
    }
    state.ids.add(key);
    state.items.set(key, { type: state.type });
    scheduleSync();
    emit(source || 'select');
  }

  function deselectKey(id, source){
    if(id == null) return;
    const key = String(id);
    if(!state.ids.has(key)) return;
    state.ids.delete(key);
    state.items.delete(key);
    if(state.ids.size === 0) state.type = 'contacts';
    scheduleSync();
    emit(source || 'deselect');
  }

  function toggleKey(id, type, source){
    if(id == null) return;
    const key = String(id);
    if(state.ids.has(key)){
      deselectKey(key, source || 'toggle');
      return;
    }
    selectKey(key, type, source || 'toggle');
  }

  function clearSelection(source){
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

  function clear(source){
    clearSelection(source);
  }

  function setIds(ids, type, source){
    const nextIds = Array.isArray(ids) ? ids.map(String).filter(Boolean) : [];
    const nextType = nextIds.length ? normalizeType(type || state.type || 'contacts') : 'contacts';
    const prevItems = new Map(state.items);
    state.ids.clear();
    state.items.clear();
    nextIds.forEach(id => {
      state.ids.add(id);
      const meta = prevItems.get(id) || {};
      state.items.set(id, Object.assign({}, meta, { type: nextType }));
    });
    state.type = nextType;
    scheduleSync();
    emit(source || 'set');
  }

  function add(id, type){
    selectKey(id, type, 'add');
  }

  function remove(id){
    deselectKey(id, 'remove');
  }

  function toggle(id, type){
    toggleKey(id, type, 'toggle');
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

  function onChange(callback){
    if(typeof callback !== 'function') return ()=>{};
    listeners.add(callback);
    return ()=> listeners.delete(callback);
  }

  const Selection = {
    get(){
      return { type: state.type, ids: cloneIds() };
    },
    getIds: cloneIds,
    getSelectedIds: cloneIds,
    set(ids, type, source){ setIds(ids, type, source); },
    toggle,
    clear,
    add,
    remove,
    select: selectKey,
    deselect: deselectKey,
    onChange,
    count,
    size,
    idsOf,
    syncCheckboxes,
    attachRowHandlers,
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
    select: selectKey,
    deselect: deselectKey,
    count,
    size,
    getIds: cloneIds,
    getSelectedIds: cloneIds,
    idsOf,
    syncChecks: scheduleSync,
    attachRowHandlers,
    set: setIds,
    prune,
    toggle,
    snapshot,
    restore,
    reemit
  };

  window.Selection = Selection;
  window.SelectionService = compat;
  window.__SELMODEL__ = compat;
  if(typeof document !== 'undefined'){
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', () => attachRowHandlers(document), { once: true });
    }else{
      attachRowHandlers(document);
    }
  }
  updateWindowMetrics();
})();
