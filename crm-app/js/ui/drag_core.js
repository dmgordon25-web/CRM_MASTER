const FLAG_MAP = new WeakMap();
const STATE_MAP = new WeakMap();
let GLOBAL_LISTENER_COUNT = 0;

const DEBUG_DEFAULT = {
  columns: 0,
  widgets: [],
  dragStarts: 0,
  swaps: 0,
  dragEnds: 0,
  resized: 0,
  todayMode: false,
  selectedIds: []
};

const DRAG_DISTANCE_THRESHOLD = 5;

function parseSelectors(sel){
  if(!sel) return [];
  if(Array.isArray(sel)) return sel.map(String).map(s => s.trim()).filter(Boolean);
  return String(sel)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
}

function ensureDebugState(){
  if(typeof window === 'undefined') return null;
  const root = window;
  if(!root.__DND_DEBUG__ || typeof root.__DND_DEBUG__ !== 'object'){
    root.__DND_DEBUG__ = Object.assign({}, DEBUG_DEFAULT);
  }
  const debug = root.__DND_DEBUG__;
  if(!Number.isFinite(debug.columns)) debug.columns = Number(debug.columns) || 0;
  if(!Array.isArray(debug.widgets)) debug.widgets = [];
  if(!Number.isFinite(debug.dragStarts)) debug.dragStarts = Number(debug.dragStarts) || 0;
  if(!Number.isFinite(debug.swaps)) debug.swaps = Number(debug.swaps) || 0;
  if(!Number.isFinite(debug.dragEnds)) debug.dragEnds = Number(debug.dragEnds) || 0;
  if(!Number.isFinite(debug.resized)) debug.resized = Number(debug.resized) || 0;
  if(typeof debug.todayMode !== 'boolean') debug.todayMode = !!debug.todayMode;
  if(!Array.isArray(debug.selectedIds)) debug.selectedIds = [];
  return debug;
}

function updateDebugColumns(count){
  const debug = ensureDebugState();
  if(!debug) return;
  const value = Number(count);
  if(Number.isFinite(value)){
    debug.columns = value;
  }
}

function updateDebugWidgets(state){
  const debug = ensureDebugState();
  if(!debug || !state || !state.container) return;
  const items = collectItems(state.container, state.itemSelector);
  if(!items.length){
    debug.widgets = [];
    return;
  }
  const order = items
    .map(item => getItemId(state, item))
    .filter(Boolean);
  debug.widgets = order;
}

function bumpDebugCounter(key){
  const debug = ensureDebugState();
  if(!debug || !Object.prototype.hasOwnProperty.call(debug, key)) return;
  const prev = Number(debug[key]);
  const next = Number.isFinite(prev) ? prev + 1 : 1;
  debug[key] = next;
}

export function bumpDebugResized(){
  bumpDebugCounter('resized');
}

export function setDebugTodayMode(enabled){
  const debug = ensureDebugState();
  if(!debug) return;
  debug.todayMode = !!enabled;
}

export function setDebugSelectedIds(ids){
  const debug = ensureDebugState();
  if(!debug) return;
  if(Array.isArray(ids)){
    debug.selectedIds = ids.map(id => (id == null ? '' : String(id))).filter(Boolean);
  }else{
    debug.selectedIds = [];
  }
}

function logDebugSummary(state){
  if(typeof console === 'undefined' || typeof console.log !== 'function') return;
  if(typeof document === 'undefined') return;
  const debug = ensureDebugState();
  const bound = !!(state && state.container && state.container.getAttribute && state.container.getAttribute('data-dnd-bound') === '1');
  const placeholderGone = !document.querySelector('[data-qa="dnd-placeholder"]');
  const payload = Object.assign({ bound, placeholderGone }, debug || {});
  try{
    console.log('DND_SUMMARY', payload);
  }catch (_err){}
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
      .filter(el => el && el.nodeType === 1);
  }catch (_err){
    return [];
  }
}

function normalizeIdValue(value){
  if(value == null) return '';
  return String(value).trim();
}

function defaultElementId(item){
  if(!item) return '';
  const dataset = item.dataset || {};
  const candidates = [
    dataset.widgetId,
    dataset.id,
    dataset.key,
    item.getAttribute ? item.getAttribute('data-widget-id') : null,
    item.getAttribute ? item.getAttribute('data-id') : null,
    item.getAttribute ? item.getAttribute('data-key') : null,
    item.id
  ];
  for(const candidate of candidates){
    const normalized = normalizeIdValue(candidate);
    if(normalized) return normalized;
  }
  return '';
}

function wrapIdGetter(getter){
  if(typeof getter === 'function'){
    return (item) => {
      try{
        const value = normalizeIdValue(getter(item));
        if(value) return value;
      }catch (_err){}
      return defaultElementId(item);
    };
  }
  return defaultElementId;
}

function getItemId(state, item){
  if(!item) return '';
  const getter = state && typeof state.idGetter === 'function' ? state.idGetter : defaultElementId;
  try{
    const value = normalizeIdValue(getter(item));
    if(value) return value;
  }catch (_err){}
  if(getter !== defaultElementId){
    return defaultElementId(item);
  }
  return '';
}

function firstHandleFor(item, selectors){
  if(!item) return null;
  if(Array.isArray(selectors) && selectors.length){
    for(const sel of selectors){
      try{
        const candidate = item.querySelector(sel);
        if(candidate){
          const rect = candidate.getBoundingClientRect ? candidate.getBoundingClientRect() : null;
          if(rect && rect.width > 0 && rect.height > 0) return candidate;
        }
      }catch (_err){}
    }
  }
  const children = item.children ? Array.from(item.children) : [];
  const fallback = children.find(el => {
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    return rect && rect.width > 0 && rect.height > 0;
  });
  return fallback || item;
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

function clamp(value, min, max){
  if(value < min) return min;
  if(value > max) return max;
  return value;
}

function clearPendingDrag(state){
  const pending = state && state.pendingDrag;
  if(!pending) return;
  if(pending.captured && pending.handle && pending.pointerId != null){
    try{ pending.handle.releasePointerCapture(pending.pointerId); }
    catch(_err){}
    pending.captured = false;
  }
  const target = pending.listenerTarget;
  if(target){
    try{ target.removeEventListener('pointermove', pending.moveListener); }
    catch(_err){}
    try{ target.removeEventListener('pointerup', pending.upListener); }
    catch(_err){}
    try{ target.removeEventListener('pointercancel', pending.upListener); }
    catch(_err){}
  }
  state.pendingDrag = null;
}

function toPositiveNumber(value, fallback){
  const num = Number(value);
  if(Number.isFinite(num) && num > 0) return num;
  if(Number.isFinite(fallback) && fallback > 0) return fallback;
  return 1;
}

function toGap(value, fallback){
  const num = Number(value);
  if(Number.isFinite(num) && num >= 0) return num;
  if(Number.isFinite(fallback) && fallback >= 0) return fallback;
  return 16;
}

function guessGap(el){
  if(!el || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return 16;
  try{
    const style = window.getComputedStyle(el);
    const values = [style.marginRight, style.marginBottom, style.columnGap, style.rowGap]
      .map(val => parseFloat(val || '0'))
      .filter(num => Number.isFinite(num) && num >= 0);
    if(values.length){
      const max = Math.max(...values);
      if(Number.isFinite(max) && max >= 0) return max;
    }
  }catch (_err){}
  return 16;
}

function rememberStyles(el, props){
  const record = {};
  props.forEach(prop => {
    record[prop] = el.style[prop] || '';
  });
  return record;
}

function restoreStyles(el, record){
  if(!el || !record) return;
  Object.keys(record).forEach(prop => {
    el.style[prop] = record[prop];
  });
}

function ensurePlaceholder(state, item, rect){
  let placeholder = state.placeholder;
  if(!placeholder){
    const tag = item && item.tagName === 'SECTION' ? 'section' : 'div';
    placeholder = document.createElement(tag);
    placeholder.className = 'dash-drag-placeholder';
    placeholder.setAttribute('aria-hidden', 'true');
    placeholder.setAttribute('data-qa', 'dnd-placeholder');
    placeholder.style.pointerEvents = 'none';
    placeholder.style.display = 'block';
    placeholder.style.boxSizing = 'border-box';
    state.placeholder = placeholder;
  }
  if(rect){
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    placeholder.style.width = `${width}px`;
    placeholder.style.height = `${height}px`;
    if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
      try{
        const style = window.getComputedStyle(item);
        placeholder.style.margin = style.margin;
        placeholder.style.borderRadius = style.borderRadius;
      }catch (_err){}
    }
  }
  return placeholder;
}

function ensureGridOverlay(state){
  if(state.gridOverlay || typeof document === 'undefined') return state.gridOverlay || null;
  const container = state.container;
  if(!container) return null;
  const overlay = document.createElement('div');
  overlay.className = 'dash-gridlines';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '0';
  overlay.style.display = 'none';
  try{
    container.insertBefore(overlay, container.firstChild || null);
  }catch (_err){
    container.appendChild(overlay);
  }
  state.gridOverlay = overlay;
  return overlay;
}

function updateGridOverlayAppearance(state){
  const overlay = ensureGridOverlay(state);
  if(!overlay) return null;
  if(state.container && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
    try{
      const containerStyle = window.getComputedStyle(state.container);
      if(containerStyle && containerStyle.borderRadius){
        overlay.style.borderRadius = containerStyle.borderRadius;
      }
    }catch (_err){}
  }
  const metrics = state && state.metrics ? state.metrics : null;
  if(metrics){
    const stepX = Math.max(1, Math.round(metrics.stepX || metrics.colWidth || 1));
    const stepY = Math.max(1, Math.round(metrics.stepY || metrics.rowHeight || 1));
    const gap = Math.max(0, Math.round(metrics.gap || 0));
    overlay.style.setProperty('--dash-grid-step-x', String(stepX) + 'px');
    overlay.style.setProperty('--dash-grid-step-y', String(stepY) + 'px');
    overlay.style.setProperty('--dash-grid-gap', String(gap) + 'px');
  }
  return overlay;
}

function removeGridOverlay(state){
  if(state.gridOverlay){
    state.gridOverlay.style.display = 'none';
  }
}

export function applyOrder(container, orderIds, itemSelector, idGetter){
  if(!container || !itemSelector) return [];
  const orderList = Array.isArray(orderIds) ? orderIds.map(normalizeIdValue).filter(Boolean) : [];
  let items = [];
  try{
    items = Array.from(container.querySelectorAll(itemSelector));
  }catch (_err){
    items = [];
  }
  items = items.filter(el => el && el.nodeType === 1);
  if(!items.length) return [];
  const getId = wrapIdGetter(idGetter);
  const map = new Map();
  items.forEach(item => {
    const id = normalizeIdValue(getId(item));
    if(id && !map.has(id)) map.set(id, item);
  });
  const handled = new Set();
  const frag = document.createDocumentFragment();
  orderList.forEach(id => {
    const node = map.get(id);
    if(!node || handled.has(node)) return;
    handled.add(node);
    frag.appendChild(node);
  });
  items.forEach(item => {
    if(handled.has(item)) return;
    frag.appendChild(item);
  });
  if(frag.childNodes.length){
    container.appendChild(frag);
  }
  return Array.from(container.querySelectorAll(itemSelector))
    .filter(el => el && el.nodeType === 1)
    .map(item => normalizeIdValue(getId(item)))
    .filter(Boolean);
}

function deriveMetrics(state, rect){
  const container = state.container;
  const firstItem = rect ? null : collectItems(container, state.itemSelector)[0];
  const baseRect = rect || (firstItem && typeof firstItem.getBoundingClientRect === 'function'
    ? firstItem.getBoundingClientRect()
    : null);
  const grid = state.gridOptions || {};
  const colWidth = toPositiveNumber(grid.colWidth, baseRect ? baseRect.width : 1);
  const rowHeight = toPositiveNumber(grid.rowHeight, baseRect ? baseRect.height : 1);
  const gap = toGap(grid.gap, firstItem ? guessGap(firstItem) : 16);
  const containerRect = container && typeof container.getBoundingClientRect === 'function'
    ? container.getBoundingClientRect()
    : { left: 0, top: 0, width: colWidth, height: rowHeight };
  const stepX = colWidth + gap;
  const stepY = rowHeight + gap;
  const configuredColumns = Number(grid.columns);
  let columns = Math.max(1, Math.floor((containerRect.width + gap) / (stepX || 1)) || 1);
  if(Number.isFinite(configuredColumns) && configuredColumns > 0){
    columns = Math.max(1, Math.round(configuredColumns));
  }
  const maxColumns = Number(grid.maxColumns);
  if(Number.isFinite(maxColumns) && maxColumns > 0){
    columns = clamp(columns, 1, Math.max(1, Math.round(maxColumns)));
  }
  const minColumns = Number(grid.minColumns);
  if(Number.isFinite(minColumns) && minColumns > 0){
    const min = Math.max(1, Math.round(minColumns));
    if(columns < min) columns = min;
  }
  updateDebugColumns(columns);
  return {
    colWidth,
    rowHeight,
    gap,
    stepX,
    stepY,
    columns,
    containerRect
  };
}

function reorderFromOrder(state, order, signature){
  const container = state.container;
  if(!container || !order || !order.length) return [];
  const applied = applyOrder(container, order, state.itemSelector, state.idGetter);
  const appliedSignature = applied.length ? applied.join('|') : null;
  if(appliedSignature){
    state.lastOrderSignature = appliedSignature;
  }else if(signature){
    state.lastOrderSignature = signature;
  }
  return applied;
}

function applyStoredOrder(state, options = {}){
  if(state.dragging) return;
  const order = readStoredOrder(state.storageKey);
  if(!order.length){
    if(options.force){
      const current = collectItems(state.container, state.itemSelector)
        .map(item => getItemId(state, item))
        .filter(Boolean);
      state.lastOrderSignature = current.join('|');
    }
    state.appliedInitialOrder = true;
    updateDebugWidgets(state);
    return;
  }
  const signature = order.map(normalizeIdValue).filter(Boolean).join('|');
  if(!options.force && signature === state.lastOrderSignature) return;
  const applied = reorderFromOrder(state, order, signature);
  if(applied.length){
    state.lastOrderSignature = applied.join('|');
  }
  state.appliedInitialOrder = true;
  updateDebugWidgets(state);
}
function refreshItemsMeta(state){
  if(!state || !state.container) {
    if(state) state.itemsMeta = null;
    return null;
  }
  let items = collectItems(state.container, state.itemSelector);
  if(items.length){
    items = items.filter(el => el !== state.dragEl);
  }
  const meta = items.map((el, order) => {
    if(!el || typeof el.getBoundingClientRect !== 'function') return null;
    let rect = null;
    try{
      rect = el.getBoundingClientRect();
    }catch (_err){
      rect = null;
    }
    if(!rect) return null;
    return {
      node: el,
      order,
      rect,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };
  }).filter(Boolean);
  state.itemsMeta = meta.length ? meta : null;
  return state.itemsMeta;
}

function movePlaceholder(state, index){
  const placeholder = state.placeholder;
  const container = state.container;
  if(!placeholder || !container) return;
  const items = collectItems(container, state.itemSelector).filter(el => el !== state.dragEl);
  const total = items.length;
  const clamped = clamp(index, 0, total);
  if(state.placeholderIndex === clamped) return;
  const beforeNode = clamped >= total ? null : items[clamped];
  if(beforeNode){
    container.insertBefore(placeholder, beforeNode);
  }else{
    container.appendChild(placeholder);
  }
  bumpDebugCounter('swaps');
  state.placeholderIndex = clamped;
  state.targetIndex = clamped;
  refreshItemsMeta(state);
}

function updatePlaceholderForPosition(state, x, y, clientX, clientY){
  const metrics = state.metrics;
  if(!metrics) return;
  const containerRect = state.containerRect || (state.container && typeof state.container.getBoundingClientRect === 'function'
    ? state.container.getBoundingClientRect()
    : { left: 0, top: 0, width: metrics.colWidth, height: metrics.rowHeight });
  const pointerClientX = typeof clientX === 'number'
    ? clientX
    : (containerRect.left + x + (state.grabOffsetX || 0));
  const pointerClientY = typeof clientY === 'number'
    ? clientY
    : (containerRect.top + y + (state.grabOffsetY || 0));
  const itemsMeta = Array.isArray(state.itemsMeta) && state.itemsMeta.length ? state.itemsMeta : null;
  if(itemsMeta){
    let index = itemsMeta.length;
    const gapAllowance = Math.max(metrics.gap || 0, 0);
    for(let i = 0; i < itemsMeta.length; i += 1){
      const meta = itemsMeta[i];
      if(!meta || !meta.rect) continue;
      const topEdge = meta.rect.top;
      const bottomEdge = meta.rect.bottom;
      if(pointerClientY < topEdge - gapAllowance / 2){
        index = meta.order;
        break;
      }
      if(pointerClientY <= bottomEdge + gapAllowance / 2){
        index = pointerClientX < meta.centerX ? meta.order : meta.order + 1;
        break;
      }
    }
    movePlaceholder(state, index);
    return;
  }
  const columns = Math.max(1, metrics.columns || 1);
  const stepX = metrics.stepX || 1;
  const stepY = metrics.stepY || 1;
  const localX = pointerClientX - containerRect.left;
  const localY = pointerClientY - containerRect.top;
  const totalItems = collectItems(state.container, state.itemSelector).filter(el => el !== state.dragEl).length;
  const col = clamp(Math.floor((localX + stepX / 2) / stepX), 0, columns - 1);
  let row = Math.max(0, Math.floor((localY + stepY / 2) / stepY));
  const maxRow = Math.max(0, Math.ceil(totalItems / columns));
  if(row > maxRow) row = maxRow;
  let index = row * columns + col;
  if(index > totalItems) index = totalItems;
  movePlaceholder(state, index);
}

function persistCurrentOrder(state){
  const { container, itemSelector, storageKey } = state;
  if(!container || !itemSelector || !storageKey) return;
  const items = collectItems(container, itemSelector);
  if(!items.length) return;
  const order = items
    .map(item => getItemId(state, item))
    .filter(Boolean);
  const signature = order.join('|');
  if(signature === state.lastOrderSignature) return;
  writeStoredOrder(storageKey, order);
  state.lastOrderSignature = signature;
  updateDebugWidgets(state);
  if(typeof state.onOrderChange === 'function'){
    try{
      state.onOrderChange(order.slice());
    }catch (_err){}
  }
}

function finishDrag(state, commit){
  const dragEl = state.dragEl;
  if(!dragEl) return;
  if(state.pointerId != null){
    try{ dragEl.releasePointerCapture(state.pointerId); }
    catch (_err){}
  }
  if(state.moveListener){
    dragEl.removeEventListener('pointermove', state.moveListener);
  }
  if(state.upListener){
    dragEl.removeEventListener('pointerup', state.upListener);
    dragEl.removeEventListener('pointercancel', state.upListener);
  }
  if(typeof state.restoreSelection === 'function'){
    try{ state.restoreSelection(); }
    catch (_err){}
  }
  dragEl.style.transform = '';
  restoreStyles(dragEl, state.prevStyles);
  if(state.container && state.containerPositionSet){
    state.container.style.position = state.prevContainerPosition || '';
  }
  if(state.placeholder && state.placeholder.classList) state.placeholder.classList.remove('dragging');
  if(state.placeholder && state.placeholder.parentElement === state.container){
    state.container.insertBefore(dragEl, state.placeholder);
    state.placeholder.remove();
  }
  state.placeholder = null;
  state.placeholderIndex = -1;
  if(!commit && Array.isArray(state.startOrder) && state.startOrder.length){
    reorderFromOrder(state, state.startOrder, state.startOrder.join('|'));
  }
  if(commit){
    persistCurrentOrder(state);
    bumpDebugCounter('dragEnds');
    logDebugSummary(state);
  }else{
    updateDebugWidgets(state);
  }
  state.dragging = false;
  state.pointerId = null;
  state.dragEl = null;
  state.moveListener = null;
  state.upListener = null;
  state.restoreSelection = null;
  state.prevStyles = null;
  state.metrics = null;
  state.containerRect = null;
  state.itemRect = null;
  state.containerPositionSet = false;
  state.prevContainerPosition = '';
  state.startOrder = null;
  state.startIndex = null;
  if(state.container && state.container.classList){
    state.container.classList.remove('dash-dragging', 'dragging');
  }
  if(state.gridOverlay){
    state.gridOverlay.style.display = 'none';
    if(state.gridOverlay.classList) state.gridOverlay.classList.remove('dragging');
  }
  removeGridOverlay(state);
  state.itemsMeta = null;
}

function cancelDrag(state, commit){
  clearPendingDrag(state);
  finishDrag(state, commit);
}

function handleGridPointerMove(evt, state){
  if(!state.dragging || evt.pointerId !== state.pointerId) return;
  const metrics = state.metrics;
  if(!metrics) return;
  evt.preventDefault();
  const dx = evt.clientX - state.originX;
  const dy = evt.clientY - state.originY;
  const rawX = state.elemStartX + dx;
  const rawY = state.elemStartY + dy;
  const stepX = metrics.stepX || 1;
  const stepY = metrics.stepY || 1;
  const snappedX = Math.round(rawX / stepX) * stepX;
  const snappedY = Math.round(rawY / stepY) * stepY;
  const translateX = snappedX - state.elemStartX;
  const translateY = snappedY - state.elemStartY;
  state.dragEl.style.transform = `translate(${translateX}px, ${translateY}px)`;
  updatePlaceholderForPosition(state, rawX, rawY, evt.clientX, evt.clientY);
}

function handleGridPointerUp(evt, state){
  if(state.pointerId != null && evt.pointerId != null && evt.pointerId !== state.pointerId && evt.type !== 'pointercancel') return;
  evt.preventDefault();
  finishDrag(state, true);
}
function beginGridDrag(state, item, evt){
  const container = state.container;
  if(!container || !item) return;
  const items = collectItems(container, state.itemSelector);
  if(items.length <= 1) return;
  const itemRect = item.getBoundingClientRect ? item.getBoundingClientRect() : null;
  if(!itemRect) return;
  state.dragging = true;
  state.dragEl = item;
  state.pointerId = evt.pointerId;
  bumpDebugCounter('dragStarts');
  state.startOrder = items
    .map(el => getItemId(state, el))
    .filter(Boolean);
  state.startIndex = items.indexOf(item);
  state.targetIndex = state.startIndex;
  state.itemRect = itemRect;
  state.metrics = deriveMetrics(state, itemRect);
  state.containerRect = state.metrics.containerRect;
  state.elemStartX = itemRect.left - state.containerRect.left;
  state.elemStartY = itemRect.top - state.containerRect.top;
  state.originX = evt.clientX;
  state.originY = evt.clientY;
  refreshItemsMeta(state);
  state.prevStyles = rememberStyles(item, ['position','left','top','width','height','margin','transition','pointerEvents','zIndex','willChange','boxShadow','opacity']);
  state.prevContainerPosition = container.style.position || '';
  state.containerPositionSet = false;
  if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
    try{
      const style = window.getComputedStyle(container);
      if(style.position === 'static'){
        container.style.position = 'relative';
        state.containerPositionSet = true;
      }
    }catch (_err){}
  }
  if(state.container && state.container.classList){
    state.container.classList.add('dash-dragging');
    state.container.classList.add('dragging');
  }
  const overlay = updateGridOverlayAppearance(state);
  if(overlay){ overlay.style.display = 'block'; if(overlay.classList) overlay.classList.add('dragging'); }
  const placeholder = ensurePlaceholder(state, item, itemRect);
  state.placeholderIndex = state.startIndex;
  container.insertBefore(placeholder, item);
  if(placeholder && placeholder.classList) placeholder.classList.add('dragging');
  state.restoreSelection = preventTextSelection(item.ownerDocument);
  item.style.position = 'absolute';
  item.style.left = `${state.elemStartX}px`;
  item.style.top = `${state.elemStartY}px`;
  item.style.width = `${Math.max(1, Math.round(itemRect.width))}px`;
  item.style.height = `${Math.max(1, Math.round(itemRect.height))}px`;
  item.style.margin = '0';
  item.style.transition = 'none';
  item.style.pointerEvents = 'none';
  item.style.zIndex = '50';
  item.style.willChange = 'transform';
  item.style.boxShadow = '0 22px 44px rgba(15,23,42,0.18)';
  item.style.opacity = '0.72';
  state.grabOffsetX = evt.clientX - itemRect.left;
  state.grabOffsetY = evt.clientY - itemRect.top;
  state.moveListener = moveEvt => handleGridPointerMove(moveEvt, state);
  state.upListener = upEvt => handleGridPointerUp(upEvt, state);
  item.addEventListener('pointermove', state.moveListener);
  item.addEventListener('pointerup', state.upListener);
  item.addEventListener('pointercancel', state.upListener);
  try{
    if(typeof item.setPointerCapture === 'function'){
      item.setPointerCapture(evt.pointerId);
    }
  }catch (_err){}
}

function handlePointerDown(evt, state){
  if(!state.container || state.dragging || !state.enabled) return;
  if(evt.pointerType !== 'touch' && evt.pointerType !== 'pen'){
    if(evt.button != null && evt.button !== 0) return;
  }
  if(shouldIgnoreTarget(evt.target)) return;
  const item = evt.target && state.itemSelector
    ? evt.target.closest(state.itemSelector)
    : null;
  if(!item || !state.container.contains(item)) return;
  const itemId = getItemId(state, item);
  if(!itemId) return;
  const handle = firstHandleFor(item, state.handleSelectors);
  if(!handle || !handle.contains(evt.target)) return;
  clearPendingDrag(state);
  const pointerId = evt.pointerId;
  const startX = evt.clientX;
  const startY = evt.clientY;
  const downEvent = evt;
  const doc = item.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const target = handle || doc || item;
  const pending = {
    pointerId,
    item,
    handle,
    startX,
    startY,
    downEvent,
    listenerTarget: target,
    moveListener: null,
    upListener: null,
    captured: false
  };
  pending.moveListener = moveEvt => {
    if(state.dragging || state.pendingDrag !== pending) return;
    if(moveEvt.pointerId != null && pointerId != null && moveEvt.pointerId !== pointerId) return;
    const dx = moveEvt.clientX - startX;
    const dy = moveEvt.clientY - startY;
    if(Math.abs(dx) >= DRAG_DISTANCE_THRESHOLD || Math.abs(dy) >= DRAG_DISTANCE_THRESHOLD){
      if(downEvent.cancelable && !downEvent.defaultPrevented){
        try{ downEvent.preventDefault(); }
        catch(_err){}
      }
      clearPendingDrag(state);
      beginGridDrag(state, item, downEvent);
      if(state.dragging){
        handleGridPointerMove(moveEvt, state);
      }
    }
  };
  pending.upListener = upEvt => {
    if(state.pendingDrag !== pending) return;
    if(upEvt.pointerId != null && pointerId != null && upEvt.pointerId !== pointerId) return;
    clearPendingDrag(state);
  };
  if(handle && typeof handle.setPointerCapture === 'function' && pointerId != null){
    try{
      handle.setPointerCapture(pointerId);
      pending.captured = true;
    }catch(_err){
      pending.captured = false;
    }
  }
  if(target && typeof target.addEventListener === 'function'){
    target.addEventListener('pointermove', pending.moveListener);
    target.addEventListener('pointerup', pending.upListener);
    target.addEventListener('pointercancel', pending.upListener);
  }
  state.pendingDrag = pending;
}

function ensureState(container){
  let state = STATE_MAP.get(container);
  if(!state){
    state = {
      container,
      itemSelector: '',
      handleSelectors: [],
      storageKey: '',
      gridOptions: {},
      idGetter: defaultElementId,
      onOrderChange: null,
      enabled: true,
      dragging: false,
      pointerId: null,
      dragEl: null,
      placeholder: null,
      placeholderIndex: -1,
      targetIndex: 0,
      startOrder: null,
      startIndex: null,
      originX: 0,
      originY: 0,
      elemStartX: 0,
      elemStartY: 0,
      grabOffsetX: 0,
      grabOffsetY: 0,
      metrics: null,
      containerRect: null,
      itemRect: null,
      prevStyles: null,
      prevContainerPosition: '',
      containerPositionSet: false,
      moveListener: null,
      upListener: null,
      restoreSelection: null,
      gridOverlay: null,
      itemsMeta: null,
      appliedInitialOrder: false,
      lastOrderSignature: null,
      pendingDrag: null
    };
    state.onPointerDown = evt => handlePointerDown(evt, state);
    attachOnce(container, 'pointerdown', state.onPointerDown, 'drag-core:pointerdown');
    STATE_MAP.set(container, state);
    if(container && typeof container.setAttribute === 'function' && !container.getAttribute('data-dnd-bound')){
      container.setAttribute('data-dnd-bound', '1');
    }
  }
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

export function makeDraggableGrid(options = {}){
  const container = options.container;
  if(!container) return null;
  const itemSelector = options.itemSel || options.itemSelector;
  const handleSel = options.handleSel;
  const storageKey = options.storageKey || '';
  if(!itemSelector || !handleSel || !storageKey) return null;
  const state = ensureState(container);
  state.itemSelector = itemSelector;
  state.handleSelectors = parseSelectors(handleSel);
  state.storageKey = storageKey;
  state.gridOptions = options.grid || {};
  state.idGetter = wrapIdGetter(options.idGetter);
  state.onOrderChange = typeof options.onOrderChange === 'function' ? options.onOrderChange : null;
  state.enabled = options.enabled === undefined ? true : !!options.enabled;
  applyStoredOrder(state, { force: true });
  const controller = {
    enable(){
      state.enabled = true;
      return controller;
    },
    disable(){
      if(state.dragging) cancelDrag(state, false);
      else clearPendingDrag(state);
      state.enabled = false;
      return controller;
    },
    isEnabled(){
      return !!state.enabled;
    },
    refresh(){
      applyStoredOrder(state, { force: true });
      return controller;
    },
    reapply(){
      applyStoredOrder(state, { force: true });
      return controller;
    },
    setGrid(gridOptions){
      state.gridOptions = gridOptions && typeof gridOptions === 'object' ? gridOptions : {};
      return controller;
    }
  };
  return controller;
}

export function makeDraggableList(options = {}){
  return makeDraggableGrid(options);
}

export function listenerCount(){
  return GLOBAL_LISTENER_COUNT;
}

makeDraggableGrid.listenerCount = listenerCount;
makeDraggableList.listenerCount = listenerCount;

export default makeDraggableGrid;
