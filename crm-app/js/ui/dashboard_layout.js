import { makeDraggableGrid, applyOrder as applyGridOrder, attachOnce } from './drag_core.js';

const ORDER_STORAGE_KEY = 'dash:layout:order:v1';
const HIDDEN_STORAGE_KEY = 'dash:layout:hidden:v1';
const MODE_STORAGE_KEY = 'dash:layoutMode:v1';
const LEGACY_ORDER_KEYS = ['dash:layout:1'];
const LEGACY_WIDGET_ORDER_KEY = 'dashboard.widgets.order';
const LEGACY_HIDDEN_KEYS = ['dash:hidden:1'];
const LEGACY_MODE_KEYS = ['dash:layoutMode:1'];
const ITEM_SELECTOR = ':scope > section.card, :scope > section.grid, :scope > div.card';
const HANDLE_SELECTOR = '[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4';
const STYLE_ID = 'dash-layout-mode-style';
const DASHBOARD_ROOT_SELECTOR = 'main[data-ui="dashboard-root"]';

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
  initOnce: false,
  container: null,
  drag: null,
  dragContainer: null,
  layoutMode: false,
  hidden: new Set(),
  readyLogged: false,
  stableLogged: false,
  idMemo: new WeakMap(),
  slugCounts: new Map(),
  late: { raf: null, timeout: null, observer: null },
  routeHooked: false,
  renderGuardHooked: false
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

function normalizeId(value){
  if(value == null) return '';
  return String(value).trim();
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

function readOrderIds(){
  const stored = readJson(ORDER_STORAGE_KEY);
  if(Array.isArray(stored) && stored.length){
    return stored.map(normalizeId).filter(Boolean);
  }
  for(const key of LEGACY_ORDER_KEYS){
    const legacy = readJson(key);
    if(Array.isArray(legacy) && legacy.length){
      return legacy.map(normalizeId).filter(Boolean);
    }
  }
  const legacyKeys = readJson(LEGACY_WIDGET_ORDER_KEY);
  if(Array.isArray(legacyKeys) && legacyKeys.length){
    return convertKeysToIds(legacyKeys.map(normalizeId));
  }
  return [];
}

function writeOrderIds(orderIds){
  const normalized = Array.isArray(orderIds) ? orderIds.map(normalizeId).filter(Boolean) : [];
  if(typeof localStorage === 'undefined') return;
  try{
    if(normalized.length){
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(normalized));
    }else{
      localStorage.removeItem(ORDER_STORAGE_KEY);
    }
    for(const key of LEGACY_ORDER_KEYS){
      localStorage.removeItem(key);
    }
    const legacy = convertIdsToKeys(normalized);
    if(legacy.length){
      localStorage.setItem(LEGACY_WIDGET_ORDER_KEY, JSON.stringify(legacy));
    }else{
      localStorage.removeItem(LEGACY_WIDGET_ORDER_KEY);
    }
  }catch (_err){}
}

function readHiddenIds(){
  const stored = readJson(HIDDEN_STORAGE_KEY);
  if(Array.isArray(stored) && stored.length){
    return stored.map(normalizeId).filter(Boolean);
  }
  for(const key of LEGACY_HIDDEN_KEYS){
    const legacy = readJson(key);
    if(Array.isArray(legacy) && legacy.length){
      return legacy.map(normalizeId).filter(Boolean);
    }
  }
  return [];
}

function writeHiddenIds(ids){
  const normalized = Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : [];
  if(typeof localStorage === 'undefined') return;
  try{
    if(normalized.length){
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(normalized));
    }else{
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
    }
    for(const key of LEGACY_HIDDEN_KEYS){
      localStorage.removeItem(key);
    }
  }catch (_err){}
}

function readLayoutModeFlag(){
  if(typeof localStorage === 'undefined') return false;
  try{
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if(raw === '1' || raw === 'true') return true;
    if(raw === '0' || raw === 'false') return false;
    for(const key of LEGACY_MODE_KEYS){
      const legacy = localStorage.getItem(key);
      if(legacy === '1' || legacy === 'true') return true;
      if(legacy === '0' || legacy === 'false') return false;
    }
  }catch (_err){}
  return false;
}

function writeLayoutModeFlag(enabled){
  if(typeof localStorage === 'undefined') return;
  try{
    localStorage.setItem(MODE_STORAGE_KEY, enabled ? '1' : '0');
    for(const key of LEGACY_MODE_KEYS){
      localStorage.removeItem(key);
    }
  }catch (_err){}
}

function convertKeysToIds(keys){
  return keys
    .map(key => KEY_TO_ID.get(String(key)) || String(key))
    .map(normalizeId)
    .filter(Boolean);
}

function convertIdsToKeys(ids){
  return ids
    .map(id => ID_TO_KEY.get(String(id)) || String(id))
    .map(normalizeId)
    .filter(Boolean);
}

function slugify(text){
  if(!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function resolveTitleText(node){
  if(!node) return '';
  const label = node.getAttribute ? node.getAttribute('data-widget-label') : null;
  if(label) return label.trim();
  try{
    const handle = node.querySelector(HANDLE_SELECTOR);
    if(handle && typeof handle.textContent === 'string'){
      return handle.textContent.trim();
    }
  }catch (_err){}
  return '';
}

function getDashboardContainer(){
  if(typeof document === 'undefined') return null;
  return document.querySelector(DASHBOARD_ROOT_SELECTOR)
    || document.getElementById('view-dashboard')
    || null;
}

function ensureContainer(){
  if(typeof document === 'undefined') return null;
  const next = getDashboardContainer();
  if(!next){
    state.container = null;
    return null;
  }
  if(state.container !== next){
    state.container = next;
    state.idMemo = new WeakMap();
  }
  if(!document.contains(next)) return null;
  return next;
}

function collectWidgets(container){
  if(!container) return [];
  try{
    return Array.from(container.querySelectorAll(ITEM_SELECTOR))
      .filter(node => node && node.nodeType === 1);
  }catch (_err){
    return [];
  }
}

function ensureWidgetId(node, seen){
  if(!node) return '';
  const dataset = node.dataset || {};
  const memo = state.idMemo.get(node);
  let candidate = normalizeId(dataset.widgetId || dataset.widget || dataset.widgetKey || memo || node.id);
  if(!candidate){
    const title = resolveTitleText(node);
    candidate = slugify(title);
  }
  if(!candidate){
    candidate = 'widget';
  }else{
    candidate = slugify(candidate) || 'widget';
  }
  let finalId = candidate;
  if(seen.has(finalId)){
    let index = state.slugCounts.get(candidate) || 1;
    finalId = `${candidate}-${index}`;
    while(seen.has(finalId)){
      index += 1;
      finalId = `${candidate}-${index}`;
    }
    state.slugCounts.set(candidate, index + 1);
  }else{
    state.slugCounts.set(candidate, Math.max(1, state.slugCounts.get(candidate) || 1));
  }
  node.dataset.widgetId = finalId;
  state.idMemo.set(node, finalId);
  seen.add(finalId);
  return finalId;
}

function prepareWidgets(container){
  const items = collectWidgets(container);
  if(!items.length) return items;
  state.slugCounts = new Map();
  const seen = new Set();
  items.forEach(item => ensureWidgetId(item, seen));
  return items;
}

function getWidgetId(node){
  if(!node) return '';
  const dataset = node.dataset || {};
  const value = dataset.widgetId || state.idMemo.get(node) || '';
  return normalizeId(value);
}

function applyVisibility(container){
  const target = container || ensureContainer();
  if(!target) return;
  const items = collectWidgets(target);
  if(!items.length) return;
  const seen = new Set();
  items.forEach(item => {
    const widgetId = ensureWidgetId(item, seen);
    const hide = state.hidden.has(widgetId);
    if(hide){
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

function computeGridMetrics(container){
  const first = container ? container.querySelector(ITEM_SELECTOR) : null;
  if(!first || typeof first.getBoundingClientRect !== 'function'){
    return { colWidth: 320, rowHeight: 260, gap: 16 };
  }
  const rect = first.getBoundingClientRect();
  let gap = 16;
  if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
    try{
      const style = window.getComputedStyle(first);
      const values = [style.marginRight, style.marginBottom, style.columnGap, style.rowGap, style.gap]
        .map(val => parseFloat(val || '0'))
        .filter(num => Number.isFinite(num) && num >= 0);
      if(values.length){
        gap = Math.max(gap, ...values);
      }
    }catch (_err){}
  }
  return {
    colWidth: Math.max(1, rect.width),
    rowHeight: Math.max(1, rect.height),
    gap: Math.max(0, gap)
  };
}

function toIdSet(input){
  const result = new Set();
  if(input instanceof Set){
    input.forEach(value => {
      const id = normalizeId(value);
      if(id) result.add(id);
    });
    return result;
  }
  if(Array.isArray(input)){
    input.forEach(value => {
      const id = normalizeId(value);
      if(id) result.add(id);
    });
  }
  return result;
}

function isDashboardRoute(){
  if(typeof location === 'undefined' || !location) return false;
  const hash = typeof location.hash === 'string' ? location.hash : '';
  return hash.startsWith('#/dashboard');
}

function cleanupLateHandles(){
  if(state.late.raf !== null && typeof cancelAnimationFrame === 'function'){
    try{ cancelAnimationFrame(state.late.raf); }
    catch (_err){}
  }
  state.late.raf = null;
  if(state.late.timeout !== null){
    try{ clearTimeout(state.late.timeout); }
    catch (_err){}
  }
  state.late.timeout = null;
  if(state.late.observer){
    try{ state.late.observer.disconnect(); }
    catch (_err){}
    state.late.observer = null;
  }
}

function runLayoutPass(reason, options = {}){
  const container = ensureContainer();
  if(!container) return false;
  if(options.refreshHidden !== false){
    state.hidden = new Set(readHiddenIds());
  }
  prepareWidgets(container);
  if(options.refreshOrder !== false){
    const order = readOrderIds();
    if(order.length){
      applyGridOrder(container, order, ITEM_SELECTOR, getWidgetId);
    }
  }
  applyVisibility(container);
  return true;
}

function scheduleStabilize(reason){
  if(!isDashboardRoute()) return;
  const container = ensureContainer();
  if(!container) return;
  cleanupLateHandles();
  const lateApply = () => {
    const applied = runLayoutPass(reason || 'late');
    if(applied && !state.stableLogged){
      state.stableLogged = true;
      try{ console.info('[VIS] dash layout applied (stable)'); }
      catch (_err){}
      postLog('dash-layout-applied', reason ? { reason } : undefined);
    }
  };
  if(typeof requestAnimationFrame === 'function'){
    state.late.raf = requestAnimationFrame(() => {
      state.late.raf = null;
      lateApply();
    });
  }
  if(typeof setTimeout === 'function'){
    state.late.timeout = setTimeout(() => {
      state.late.timeout = null;
      lateApply();
    }, 0);
  }
  if(typeof MutationObserver === 'function'){
    const observer = new MutationObserver(() => {
      observer.disconnect();
      if(state.late.observer === observer){
        state.late.observer = null;
      }
      lateApply();
    });
    try{
      observer.observe(container, { childList: true });
      state.late.observer = observer;
    }catch (_err){
      observer.disconnect();
    }
  }
}

function handleOrderChange(orderIds){
  const normalized = Array.isArray(orderIds) ? orderIds.map(normalizeId).filter(Boolean) : [];
  writeOrderIds(normalized);
  state.stableLogged = false;
  scheduleStabilize('order-change');
}

function ensureDragController(container){
  if(!container) return null;
  if(state.drag && state.dragContainer !== container){
    try{ state.drag.disable?.(); }
    catch (_err){}
    state.drag = null;
    state.dragContainer = null;
  }
  if(state.drag){
    if(state.layoutMode){
      state.drag.enable?.();
    }else{
      state.drag.disable?.();
    }
    state.drag.refresh?.();
    return state.drag;
  }
  const metrics = computeGridMetrics(container);
  const controller = makeDraggableGrid({
    container,
    itemSel: ITEM_SELECTOR,
    handleSel: HANDLE_SELECTOR,
    storageKey: ORDER_STORAGE_KEY,
    grid: metrics,
    idGetter: getWidgetId,
    enabled: true,
    onOrderChange: handleOrderChange
  });
  if(!controller) return null;
  state.drag = controller;
  state.dragContainer = container;
  if(state.layoutMode){
    controller.enable?.();
  }else{
    controller.disable?.();
  }
  return controller;
}

function updateLayoutModeAttr(container){
  const target = container || ensureContainer();
  if(!target) return;
  target.setAttribute('data-dash-layout-mode', state.layoutMode ? 'on' : 'off');
}

function handleRouteLeave(){
  cleanupLateHandles();
  state.container = null;
  state.dragContainer = null;
  state.idMemo = new WeakMap();
  state.slugCounts = new Map();
  state.stableLogged = false;
  state.readyLogged = false;
  if(state.drag){
    try{ state.drag.disable(); }
    catch (_err){}
    state.drag = null;
  }
}

function ensureRouteHook(){
  if(state.routeHooked || typeof window === 'undefined') return;
  const handler = () => {
    if(!isDashboardRoute()){
      handleRouteLeave();
    }
  };
  window.addEventListener('hashchange', handler);
  state.routeHooked = true;
}

function ensureRenderGuardHook(){
  if(state.renderGuardHooked || typeof window === 'undefined') return;
  const guard = window.RenderGuard;
  if(!guard || typeof guard.registerHook !== 'function') return;
  try{
    guard.registerHook(() => {
      requestDashboardLayoutPass({ reason: 'render-guard', skipImmediate: true });
    });
    state.renderGuardHooked = true;
  }catch (_err){}
}

function onStorage(evt){
  if(!evt || typeof evt.key !== 'string') return;
  if(evt.key === MODE_STORAGE_KEY || LEGACY_MODE_KEYS.includes(evt.key)){
    const next = readLayoutModeFlag();
    setDashboardLayoutMode(next, { persist: false, force: true, silent: true });
    return;
  }
  if(evt.key === HIDDEN_STORAGE_KEY || LEGACY_HIDDEN_KEYS.includes(evt.key)){
    state.hidden = new Set(readHiddenIds());
    if(isDashboardRoute()){
      requestDashboardLayoutPass({ reason: 'storage-hidden' });
    }
    return;
  }
  if(evt.key === ORDER_STORAGE_KEY || LEGACY_ORDER_KEYS.includes(evt.key) || evt.key === LEGACY_WIDGET_ORDER_KEY){
    if(isDashboardRoute()){
      state.stableLogged = false;
      requestDashboardLayoutPass({ reason: 'storage-order', skipImmediate: true });
    }
  }
}

export function setDashboardLayoutMode(enabled, options = {}){
  const next = !!enabled;
  const force = !!options.force;
  if(!force && state.layoutMode === next) return;
  state.layoutMode = next;
  if(options.persist !== false){
    writeLayoutModeFlag(next);
  }
  const container = ensureContainer();
  if(next && isDashboardRoute()){
    ensureDragController(container);
  }else if(state.drag){
    try{ state.drag.disable(); }
    catch (_err){}
  }
  updateLayoutModeAttr(container);
  if(!options.silent && isDashboardRoute()){
    state.stableLogged = false;
    requestDashboardLayoutPass({ reason: 'layout-mode', skipImmediate: true });
  }
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
  if(isDashboardRoute()){
    state.stableLogged = false;
    scheduleStabilize('visibility-change');
  }
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
  requestDashboardLayoutPass({ reason: reason || 'reapply' });
}

export function requestDashboardLayoutPass(input){
  const opts = typeof input === 'string' ? { reason: input } : (input || {});
  const reason = opts.reason || null;
  if(!isDashboardRoute()) return;
  const container = ensureContainer();
  if(!container) return;
  if(!opts.skipImmediate){
    runLayoutPass(reason);
  }
  state.stableLogged = false;
  scheduleStabilize(reason);
}

export function initDashboardDragOnce(){
  if(!isDashboardRoute()) return;
  const container = ensureContainer();
  if(!container) return;

  if(!state.initOnce){
    state.layoutMode = readLayoutModeFlag();
    state.hidden = new Set(readHiddenIds());
    ensureStyle();
    if(typeof window !== 'undefined'){
      attachOnce(window, 'storage', onStorage, 'dash-layout:storage');
    }
    ensureRouteHook();
    ensureRenderGuardHook();
    state.initOnce = true;
  }else{
    state.layoutMode = readLayoutModeFlag();
    state.hidden = new Set(readHiddenIds());
  }

  runLayoutPass('init');
  state.stableLogged = false;
  scheduleStabilize('init');
  updateLayoutModeAttr(container);

  if(state.layoutMode){
    ensureDragController(container);
  }else if(state.drag){
    try{ state.drag.disable(); }
    catch (_err){}
  }

  if(!state.readyLogged){
    state.readyLogged = true;
    try{ console.info('[VIS] dash drag ready (idle-until-dashboard)'); }
    catch (_err){}
    postLog('dash-drag-direct');
  }
}

export function initDashboardLayout(){
  initDashboardDragOnce();
  return state;
}

export default initDashboardLayout;
