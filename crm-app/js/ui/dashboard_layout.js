import { makeDraggableGrid, attachOnce, listenerCount as dragListenerCount } from './drag_core.js';

const ORDER_STORAGE_KEY = 'dash:layout:1';
const HIDDEN_STORAGE_KEY = 'dash:hidden:1';
const MODE_STORAGE_KEY = 'dash:layoutMode:1';
const LEGACY_ORDER_KEY = 'dashboard.widgets.order';
const ITEM_SELECTOR = ':scope > section.card[id], :scope > section.grid[id], :scope > div.card[id]';
const HANDLE_SELECTOR = '[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4';
const STYLE_ID = 'dash-layout-mode-style';

const DASHBOARD_WIDGETS = [
  { id: 'dashboard-focus', key: 'focus', label: 'Focus Summary' },
  { id: 'dashboard-filters', key: 'filters', label: 'Filters' },
  { id: 'dashboard-kpis', key: 'kpis', label: 'KPIs' },
  { id: 'dashboard-pipeline-overview', key: 'pipeline', label: 'Pipeline Overview' },
  { id: 'dashboard-today', key: 'today', label: "Today's Work" },
  { id: 'referral-leaderboard', key: 'leaderboard', label: 'Referral Leaderboard' },
  { id: 'dashboard-stale', key: 'stale', label: 'Stale Deals' },
  { id: 'dashboard-insights', key: 'insights', label: 'Insights Grid' },
  { id: 'dashboard-opportunities', key: 'opportunities', label: 'Opportunities' }
];

const KEY_TO_ID = new Map(DASHBOARD_WIDGETS.map(widget => [widget.key, widget.id]));
const ID_TO_KEY = new Map(DASHBOARD_WIDGETS.map(widget => [widget.id, widget.key]));

const state = {
  wired: false,
  container: null,
  drag: null,
  layoutMode: false,
  hidden: new Set(),
  loggedInit: false
};

const lateState = {
  rafId: null,
  timeoutId: null,
  observer: null,
  notify: false,
  reported: false,
  reason: null
};

function postLog(event, data){
  const payload = JSON.stringify(Object.assign({ event }, data || {}));
  if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
    try{
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    }catch (_err){}
  }
  if(typeof fetch === 'function'){
    try{ fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    catch (_err){}
  }
}

function ensureStyle(){
  if(typeof document === 'undefined') return;
  if(document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
[data-dash-layout-mode="on"] [data-ui="card-title"],
[data-dash-layout-mode="on"] .insight-head,
[data-dash-layout-mode="on"] header,
[data-dash-layout-mode="on"] h2,
[data-dash-layout-mode="on"] h3,
[data-dash-layout-mode="on"] h4 {
  cursor: grab;
}
[data-dash-layout-mode="on"] .dash-drag-placeholder {
  border: 2px dashed var(--border-strong, #94a3b8);
  background: linear-gradient(135deg, rgba(148,163,184,0.18) 25%, rgba(148,163,184,0.08) 25%, rgba(148,163,184,0.08) 50%, rgba(148,163,184,0.18) 50%);
  background-size: 16px 16px;
}
[data-dash-layout-mode="on"] .dash-drag-placeholder::before {
  content: '';
}
`;
  const head = document.head || document.getElementsByTagName('head')[0];
  if(head){
    head.appendChild(style);
  }
}

function getDashboardContainer(){
  if(typeof document === 'undefined') return null;
  return document.querySelector('main[data-ui="dashboard-root"]')
    || document.getElementById('view-dashboard')
    || null;
}

function ensureContainer(){
  if(typeof document === 'undefined') return null;
  if(state.container && document.contains(state.container)) return state.container;
  const next = getDashboardContainer();
  if(next) state.container = next;
  return state.container;
}

function readJson(key){
  if(typeof localStorage === 'undefined') return null;
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch (_err){
    return null;
  }
}

function readHiddenIds(){
  const parsed = readJson(HIDDEN_STORAGE_KEY);
  if(!Array.isArray(parsed)) return [];
  return parsed.map(String).filter(Boolean);
}

function writeHiddenIds(ids){
  if(typeof localStorage === 'undefined') return;
  try{
    if(ids && ids.length){
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(ids));
    }else{
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
    }
  }catch (_err){}
}

function readLayoutModeFlag(){
  if(typeof localStorage === 'undefined') return false;
  try{
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if(raw === '1' || raw === 'true') return true;
    if(raw === '0' || raw === 'false') return false;
  }catch (_err){}
  return false;
}

function writeLayoutModeFlag(enabled){
  if(typeof localStorage === 'undefined') return;
  try{ localStorage.setItem(MODE_STORAGE_KEY, enabled ? '1' : '0'); }
  catch (_err){}
}

function readOrderIds(){
  const stored = readJson(ORDER_STORAGE_KEY);
  if(Array.isArray(stored) && stored.length){
    return stored.map(String).filter(Boolean);
  }
  const legacy = readJson(LEGACY_ORDER_KEY);
  if(Array.isArray(legacy) && legacy.length){
    return convertKeysToIds(legacy.map(String));
  }
  return [];
}

function convertKeysToIds(keys){
  return keys
    .map(key => KEY_TO_ID.get(String(key)) || String(key))
    .filter(Boolean);
}

function convertIdsToKeys(ids){
  return ids
    .map(id => ID_TO_KEY.get(String(id)) || String(id))
    .filter(Boolean);
}

function applyOrder(container, order){
  if(!container || !order || !order.length) return;
  const items = Array.from(container.querySelectorAll(ITEM_SELECTOR)).filter(node => node && node.id);
  if(!items.length) return;
  const map = new Map();
  items.forEach(item => map.set(item.id, item));
  const handled = new Set();
  const frag = document.createDocumentFragment();
  order.forEach(id => {
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
}

function collectDashboardItems(){
  const container = ensureContainer();
  if(!container) return [];
  try{
    return Array.from(container.querySelectorAll(ITEM_SELECTOR)).filter(el => el && el.id);
  }catch (_err){
    return [];
  }
}

function applyLayoutOnce(container){
  const target = container || ensureContainer();
  if(!target) return false;
  if(target !== state.container) state.container = target;
  const order = readOrderIds();
  if(order.length) applyOrder(target, order);
  const hiddenIds = readHiddenIds().map(String);
  state.hidden = new Set(hiddenIds);
  applyVisibility();
  if(lateState.notify && !lateState.reported){
    lateState.reported = true;
    const payload = lateState.reason ? { reason: lateState.reason } : undefined;
    try{ console.info('[VIS] dash layout applied'); }
    catch (_err){}
    postLog('dash-layout-applied', payload);
  }
  return true;
}

function scheduleLateLayout(container, options = {}){
  const hasDocument = typeof document !== 'undefined';
  const initialTarget = container && hasDocument && document.contains(container)
    ? container
    : ensureContainer();
  const skipImmediate = !!options.skipImmediate;
  lateState.notify = true;
  lateState.reported = false;
  lateState.reason = options.reason || null;
  if(lateState.rafId !== null && typeof cancelAnimationFrame === 'function'){
    try{ cancelAnimationFrame(lateState.rafId); }
    catch (_err){}
  }
  lateState.rafId = null;
  if(lateState.timeoutId !== null){
    try{ clearTimeout(lateState.timeoutId); }
    catch (_err){}
  }
  lateState.timeoutId = null;
  if(lateState.observer){
    try{ lateState.observer.disconnect(); }
    catch (_err){}
    lateState.observer = null;
  }
  const apply = () => {
    const nextTarget = container && hasDocument && document.contains(container)
      ? container
      : ensureContainer();
    return nextTarget ? applyLayoutOnce(nextTarget) : applyLayoutOnce();
  };
  if(!skipImmediate){
    apply();
  }
  if(typeof requestAnimationFrame === 'function'){
    lateState.rafId = requestAnimationFrame(() => {
      lateState.rafId = null;
      apply();
    });
  }
  if(typeof setTimeout === 'function'){
    lateState.timeoutId = setTimeout(() => {
      lateState.timeoutId = null;
      apply();
    }, 0);
  }
  if(typeof MutationObserver === 'function' && initialTarget){
    const observer = new MutationObserver(mutationsList => {
      if(!Array.isArray(mutationsList)) return;
      const hasChild = mutationsList.some(mutation => mutation && mutation.type === 'childList');
      if(!hasChild) return;
      apply();
      observer.disconnect();
      if(lateState.observer === observer){
        lateState.observer = null;
      }
    });
    try{ observer.observe(initialTarget, { childList: true }); }
    catch (_err){
      observer.disconnect();
      return;
    }
    lateState.observer = observer;
    if(typeof requestAnimationFrame === 'function'){
      let frames = 0;
      const release = () => {
        frames += 1;
        if(frames >= 2){
          if(lateState.observer === observer){
            observer.disconnect();
            lateState.observer = null;
          }
          return;
        }
        requestAnimationFrame(release);
      };
      requestAnimationFrame(release);
    }
  }
}
function computeGridOptions(container){
  const first = container ? container.querySelector(ITEM_SELECTOR) : null;
  if(!first || typeof first.getBoundingClientRect !== 'function'){
    return { colWidth: 320, rowHeight: 260, gap: 16 };
  }
  const rect = first.getBoundingClientRect();
  let gap = 16;
  if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
    try{
      const style = window.getComputedStyle(first);
      const gapValues = [style.marginRight, style.marginBottom, style.rowGap, style.gap]
        .map(val => parseFloat(val || '0'))
        .filter(num => Number.isFinite(num) && num >= 0);
      if(gapValues.length){
        gap = Math.max(gap, ...gapValues);
      }
    }catch (_err){}
  }
  return {
    colWidth: Math.max(1, rect.width),
    rowHeight: Math.max(1, rect.height),
    gap: Math.max(0, gap)
  };
}

function applyVisibility(){
  const items = collectDashboardItems();
  if(!items.length) return;
  items.forEach(item => {
    const shouldHide = state.hidden.has(item.id);
    if(shouldHide){
      if(item.dataset.dashPrevDisplay === undefined){
        item.dataset.dashPrevDisplay = item.style.display || '';
      }
      item.style.display = 'none';
      item.setAttribute('aria-hidden', 'true');
      item.dataset.dashHidden = 'true';
    }else{
      if(item.dataset.dashPrevDisplay !== undefined){
        item.style.display = item.dataset.dashPrevDisplay;
        delete item.dataset.dashPrevDisplay;
      }else{
        item.style.display = '';
      }
      item.removeAttribute('aria-hidden');
      if(item.dataset.dashHidden) delete item.dataset.dashHidden;
    }
  });
}

function persistOrderExtras(orderIds){
  const ids = Array.isArray(orderIds) ? orderIds.map(String).filter(Boolean) : [];
  const keys = convertIdsToKeys(ids);
  if(typeof localStorage !== 'undefined'){
    try{
      if(keys.length){
        localStorage.setItem(LEGACY_ORDER_KEY, JSON.stringify(keys));
      }else{
        localStorage.removeItem(LEGACY_ORDER_KEY);
      }
    }catch (_err){}
  }
  if(typeof window !== 'undefined' && window.Settings && typeof window.Settings.save === 'function'){
    try{
      const payload = { dashboardOrder: keys };
      Promise.resolve(window.Settings.save(payload)).catch(err => {
        if(console && console.warn) console.warn('[dash-layout] settings save failed', err);
      });
    }catch (_err){}
  }
  try{
    document?.dispatchEvent?.(new CustomEvent('dashboard:layout-order', { detail: { ids: ids.slice(), keys: keys.slice() } }));
  }catch (_err){}
}

function handleOrderChange(orderIds){
  persistOrderExtras(orderIds);
  applyVisibility();
}

function updateLayoutModeAttr(){
  const container = ensureContainer();
  if(!container) return;
  container.setAttribute('data-dash-layout-mode', state.layoutMode ? 'on' : 'off');
}

function ensureDrag(){
  const container = ensureContainer();
  if(!container) return null;
  if(!state.drag){
    state.drag = makeDraggableGrid({
      container,
      itemSel: ITEM_SELECTOR,
      handleSel: HANDLE_SELECTOR,
      storageKey: ORDER_STORAGE_KEY,
      grid: computeGridOptions(container),
      enabled: state.layoutMode,
      onOrderChange: handleOrderChange
    });
  }else{
    if(state.layoutMode) state.drag.enable();
    else state.drag.disable();
    state.drag.refresh();
  }
  return state.drag;
}

function logInit(){
  if(state.loggedInit) return;
  const items = collectDashboardItems();
  const listeners = dragListenerCount();
  try{ console.info('[VIS] dash-drag init', { listeners, items: items.length }); }
  catch (_err){}
  postLog('dash-drag-init', { items: items.length, listeners });
  state.loggedInit = true;
}

function reapplyLayout(reason){
  const container = ensureContainer();
  if(!container){
    scheduleLateLayout(null, { skipImmediate: false, reason });
    return;
  }
  const applied = applyLayoutOnce(container);
  if(state.drag){
    state.drag.refresh();
  }else{
    ensureDrag();
  }
  scheduleLateLayout(container, { skipImmediate: applied, reason });
}

function onStorage(evt){
  if(!evt || typeof evt.key !== 'string') return;
  if(evt.key === HIDDEN_STORAGE_KEY){
    state.hidden = new Set(readHiddenIds());
    applyVisibility();
    return;
  }
  if(evt.key === MODE_STORAGE_KEY){
    const next = readLayoutModeFlag();
    setDashboardLayoutMode(next, { persist: false, force: true });
    return;
  }
  if(evt.key === ORDER_STORAGE_KEY){
    if(state.drag){
      state.drag.refresh();
    }else{
      const order = readOrderIds();
      if(order.length && ensureContainer()){
        applyOrder(state.container, order);
      }
    }
    applyVisibility();
  }
}

function toIdSet(input){
  const result = new Set();
  if(input instanceof Set){
    input.forEach(value => {
      const id = String(value);
      if(id) result.add(id);
    });
    return result;
  }
  if(Array.isArray(input)){
    input.forEach(value => {
      const id = String(value);
      if(id) result.add(id);
    });
  }
  return result;
}

export function setDashboardLayoutMode(enabled, options = {}){
  const next = !!enabled;
  const force = !!options.force;
  if(!force && state.layoutMode === next) return;
  state.layoutMode = next;
  if(options.persist !== false){
    writeLayoutModeFlag(next);
  }
  if(state.drag){
    if(next) state.drag.enable();
    else state.drag.disable();
  }
  updateLayoutModeAttr();
}

export function applyDashboardHidden(input, options = {}){
  const nextSet = toIdSet(input);
  let changed = nextSet.size !== state.hidden.size;
  if(!changed){
    for(const id of nextSet){
      if(!state.hidden.has(id)){ changed = true; break; }
    }
  }
  if(!changed) return;
  state.hidden = nextSet;
  if(options.persist !== false){
    writeHiddenIds(Array.from(nextSet).sort());
  }
  applyVisibility();
}

export function readStoredLayoutMode(){
  return readLayoutModeFlag();
}

export function readStoredHiddenIds(){
  return readHiddenIds();
}

export function getDashboardWidgets(){
  return DASHBOARD_WIDGETS.map(widget => ({ ...widget }));
}

export function reapplyDashboardLayout(reason){
  reapplyLayout(reason);
}

export function getDashboardListenerCount(){
  return dragListenerCount();
}

export function requestDashboardLayoutPass(input){
  const opts = typeof input === 'string' ? { reason: input } : (input || {});
  const container = opts.container && typeof opts.container === 'object' && opts.container.nodeType === 1
    ? opts.container
    : null;
  scheduleLateLayout(container, { skipImmediate: !!opts.skipImmediate, reason: opts.reason || null });
}

export function initDashboardLayout(){
  if(state.wired){
    const container = ensureContainer();
    const applied = container ? applyLayoutOnce(container) : applyLayoutOnce();
    ensureDrag();
    updateLayoutModeAttr();
    scheduleLateLayout(container || null, { skipImmediate: applied, reason: 'reinit' });
    return state;
  }
  state.layoutMode = readLayoutModeFlag();
  state.hidden = new Set(readHiddenIds());
  ensureStyle();
  const container = ensureContainer();
  const applied = container ? applyLayoutOnce(container) : applyLayoutOnce();
  ensureDrag();
  updateLayoutModeAttr();
  scheduleLateLayout(container || null, { skipImmediate: applied, reason: 'init' });
  logInit();
  if(typeof window !== 'undefined'){
    attachOnce(window, 'storage', onStorage, 'dash-layout:storage');
  }
  if(window?.RenderGuard && typeof window.RenderGuard.registerHook === 'function'){
    try{ window.RenderGuard.registerHook(() => reapplyLayout('render-guard')); }
    catch (_err){}
  }
  state.wired = true;
  return state;
}

export default initDashboardLayout;
