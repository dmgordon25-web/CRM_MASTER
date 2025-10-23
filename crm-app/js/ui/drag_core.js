const FLAG_MAP = new WeakMap();
const STATE_MAP = new WeakMap();
let GLOBAL_LISTENER_COUNT = 0;

function parseSelectors(sel){
  if(!sel) return [];
  if(Array.isArray(sel)) return sel.map(String).map(s => s.trim()).filter(Boolean);
  return String(sel)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}


function readStoredOrder(key){
  if(!key || typeof localStorage === 'undefined') return [];
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  }catch (_err){
    return [];
  }
}

function writeStoredOrder(key, order){
  if(!key || typeof localStorage === 'undefined') return;
  try{
    if(Array.isArray(order) && order.length){
      localStorage.setItem(key, JSON.stringify(order));
    }else{
      localStorage.removeItem(key);
    }
  }catch (_err){}
}

function collectItems(container, itemSelector){
  if(!container || !itemSelector) return [];
  try{
    return Array.from(container.querySelectorAll(itemSelector))
      .filter(el => el && el.nodeType === 1 && el.id);
  }catch (_err){
    return [];
  }
}

function firstHandleFor(item, selectors){
  if(!item) return null;
  let fallback = null;
  for(const sel of selectors){
    try{
      const candidate = item.querySelector(sel);
      if(candidate){
        const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
        if(rect && rect.width > 0 && rect.height > 0) return candidate;
        if(!fallback) fallback = candidate;
      }
    }catch (_err){}
  }
  if(!fallback){
    const children = item.children ? Array.from(item.children) : [];
    fallback = children.find(el => {
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      return rect && rect.width > 0 && rect.height > 0;
    }) || null;
  }
  if(fallback) return fallback;
  return item;
}

function preventTextSelection(doc){
  if(!doc) return () => {};
  const body = doc.body;
  if(!body) return () => {};
  const prev = body.style.userSelect;
  body.style.userSelect = 'none';
  return () => {
    body.style.userSelect = prev;
  };
}

function shouldIgnoreTarget(target){
  if(!target) return false;
  const interactiveSel = 'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"], [data-action]';
  const interactive = target.closest ? target.closest(interactiveSel) : null;
  return !!interactive;
}

function applySavedOrder(state){
  const { container, itemSelector, storageKey } = state;
  if(!container || !itemSelector || !storageKey || state.appliedInitialOrder) return;
  const saved = readStoredOrder(storageKey);
  if(!saved.length) {
    state.appliedInitialOrder = true;
    return;
  }
  const items = collectItems(container, itemSelector);
  if(!items.length) {
    state.appliedInitialOrder = true;
    return;
  }
  const map = new Map();
  items.forEach(item => map.set(item.id, item));
  const handled = new Set();
  const frag = document.createDocumentFragment();
  saved.forEach(id => {
    const node = map.get(id);
    if(!node || handled.has(node)) return;
    handled.add(node);
    frag.appendChild(node);
  });
  items.forEach(item => {
    if(handled.has(item)) return;
    frag.appendChild(item);
  });
  container.appendChild(frag);
  state.appliedInitialOrder = true;
}

function persistCurrentOrder(state){
  const { container, itemSelector, storageKey } = state;
  if(!container || !itemSelector || !storageKey) return;
  const items = collectItems(container, itemSelector);
  const order = items.map(item => item.id);
  writeStoredOrder(storageKey, order);
}

function computeTargetIndex(state, pointerY){
  const baseItems = state.baseItems || [];
  if(!baseItems.length) {
    state.targetIndex = 0;
    return;
  }
  let idx = baseItems.length;
  for(let i = 0; i < baseItems.length; i += 1){
    const el = baseItems[i];
    if(!el || typeof el.getBoundingClientRect !== 'function') continue;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    if(pointerY < mid){
      idx = i;
      break;
    }
  }
  state.targetIndex = idx;
}

function finishDrag(state, commit){
  const dragEl = state.dragEl;
  if(!dragEl) return;
  try{
    if(state.pointerId != null && typeof dragEl.releasePointerCapture === 'function'){
      dragEl.releasePointerCapture(state.pointerId);
    }
  }catch (_err){}
  if(state.moveListener){
    dragEl.removeEventListener('pointermove', state.moveListener);
  }
  if(state.upListener){
    dragEl.removeEventListener('pointerup', state.upListener);
    dragEl.removeEventListener('pointercancel', state.upListener);
  }
  dragEl.style.transition = state.prevTransition;
  dragEl.style.transform = '';
  dragEl.style.pointerEvents = state.prevPointerEvents;
  dragEl.style.willChange = '';
  dragEl.style.zIndex = state.prevZIndex;
  if(typeof state.restoreSelection === 'function'){
    state.restoreSelection();
  }
  if(commit){
    const container = state.container;
    const base = state.baseItems || [];
    let insertBefore = null;
    if(state.targetIndex >= base.length){
      insertBefore = null;
    }else{
      insertBefore = base[state.targetIndex];
    }
    if(insertBefore){
      container.insertBefore(dragEl, insertBefore);
    }else{
      container.appendChild(dragEl);
    }
    const beforeOrder = state.startOrder || [];
    const afterOrder = collectItems(container, state.itemSelector).map(item => item.id);
    const changed = beforeOrder.length !== afterOrder.length
      || beforeOrder.some((id, i) => id !== afterOrder[i]);
    if(changed){
      persistCurrentOrder(state);
    }
  }
  state.dragging = false;
  state.pointerId = null;
  state.dragEl = null;
  state.baseItems = null;
  state.moveListener = null;
  state.upListener = null;
  state.targetIndex = 0;
  state.startOrder = null;
  state.startIndex = null;
}

function beginDrag(state, item, evt){
  if(state.dragging) return;
  const container = state.container;
  const items = collectItems(container, state.itemSelector);
  if(items.length < 2) return;
  state.startOrder = items.map(el => el.id);
  state.dragging = true;
  state.dragEl = item;
  state.pointerId = evt.pointerId;
  state.baseItems = items.filter(el => el !== item);
  const startIndex = items.indexOf(item);
  state.startIndex = startIndex;
  state.targetIndex = Math.min(startIndex, state.baseItems.length);
  state.prevTransition = item.style.transition;
  state.prevPointerEvents = item.style.pointerEvents;
  state.prevZIndex = item.style.zIndex;
  state.restoreSelection = preventTextSelection(item.ownerDocument);
  item.style.transition = 'none';
  item.style.pointerEvents = 'none';
  item.style.zIndex = '1000';
  item.style.willChange = 'transform';
  try{
    if(typeof item.setPointerCapture === 'function'){
      item.setPointerCapture(evt.pointerId);
    }
  }catch (_err){}
  state.originX = evt.clientX;
  state.originY = evt.clientY;
  state.moveListener = (moveEvt) => {
    if(moveEvt.pointerId !== state.pointerId) return;
    const dx = moveEvt.clientX - state.originX;
    const dy = moveEvt.clientY - state.originY;
    item.style.transform = `translate(${dx}px, ${dy}px)`;
    computeTargetIndex(state, moveEvt.clientY);
  };
  state.upListener = (upEvt) => {
    if(upEvt.pointerId !== state.pointerId) return;
    upEvt.preventDefault();
    finishDrag(state, true);
  };
  item.addEventListener('pointermove', state.moveListener);
  item.addEventListener('pointerup', state.upListener);
  item.addEventListener('pointercancel', state.upListener);
}

function handlePointerDown(evt, state){
  if(!state.container || state.dragging) return;
  if(evt.button != null && evt.button !== 0 && evt.pointerType !== 'touch') return;
  if(shouldIgnoreTarget(evt.target)) return;
  const item = evt.target && state.itemSelector
    ? evt.target.closest(state.itemSelector)
    : null;
  if(!item || !state.container.contains(item)) return;
  if(!item.id) return;
  const handle = firstHandleFor(item, state.handleSelectors);
  if(!handle || !handle.contains(evt.target)) return;
  evt.preventDefault();
  beginDrag(state, item, evt);
}

function ensureState(container, options){
  let state = STATE_MAP.get(container);
  if(!state){
    state = {
      container,
      itemSelector: options.itemSelector,
      handleSelectors: parseSelectors(options.handleSel),
      storageKey: options.storageKey,
      dragging: false,
      appliedInitialOrder: false,
      targetIndex: 0
    };
    state.onPointerDown = (evt) => handlePointerDown(evt, state);
    STATE_MAP.set(container, state);
    attachOnce(container, 'pointerdown', state.onPointerDown, 'drag-core:pointerdown');
  }else{
    state.itemSelector = options.itemSelector;
    state.handleSelectors = parseSelectors(options.handleSel);
    state.storageKey = options.storageKey;
  }
  applySavedOrder(state);
  return state;
}

export function attachOnce(el, type, fn, flagKey){
  if(!el || typeof el.addEventListener !== 'function') return false;
  if(!type || typeof fn !== 'function') return false;
  const key = flagKey ? String(flagKey) : `${type}:${fn.name || 'fn'}`;
  let flags = FLAG_MAP.get(el);
  if(!flags){
    flags = new Set();
    FLAG_MAP.set(el, flags);
  }
  if(flags.has(key)) return false;
  el.addEventListener(type, fn);
  flags.add(key);
  GLOBAL_LISTENER_COUNT += 1;
  return true;
}

export function makeDraggableList(options = {}){
  const container = options.container;
  if(!container) return null;
  const itemSelector = options.itemSel || options.itemSelector;
  const handleSel = options.handleSel;
  const storageKey = options.storageKey || '';
  if(!itemSelector || !handleSel || !storageKey) return null;
  const state = ensureState(container, {
    itemSelector,
    handleSel,
    storageKey
  });
  return {
    container,
    storageKey,
    itemSelector,
    handleSel
  };
}

makeDraggableList.listenerCount = function listenerCount(){
  return GLOBAL_LISTENER_COUNT;
};

export default makeDraggableList;
