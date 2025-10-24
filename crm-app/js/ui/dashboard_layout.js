import { makeDraggableGrid, applyOrder, getListenerCount } from './drag_core.js';
import { scanWidgets, getWidgetId, DASHBOARD_WIDGET_SELECTOR, findDashboardContainer } from './dashboard_ids.js';

const ORDER_STORAGE_KEY = 'dash:layout:order:v1';
const HIDDEN_STORAGE_KEY = 'dash:layout:hidden:v1';
const MODE_STORAGE_KEY = 'dash:layoutMode:v1';
const LEGACY_ORDER_KEY = 'dashboard.widgets.order';
const LEGACY_ORDER_KEY_V0 = 'dash:layout:1';
const LEGACY_HIDDEN_KEY_V0 = 'dash:hidden:1';
const LEGACY_MODE_KEY_V0 = 'dash:layoutMode:1';

const HANDLE_SELECTOR = '[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4';
const GRID_GAP_FALLBACK = 8;
const LOG_LABEL = '[VIS] dash init';

const LEGACY_ID_TO_KEY = new Map([
  ['dashboard-focus', 'focus'],
  ['dashboard-filters', 'filters'],
  ['dashboard-kpis', 'kpis'],
  ['dashboard-pipeline-overview', 'pipeline'],
  ['dashboard-today', 'today'],
  ['referral-leaderboard', 'leaderboard'],
  ['dashboard-stale', 'stale'],
  ['dashboard-insights', 'insights'],
  ['dashboard-opportunities', 'opportunities'],
]);

const LEGACY_KEY_TO_ID = new Map(Array.from(LEGACY_ID_TO_KEY.entries()).map(([id, key]) => [key, id]));

const state = {
  wired: false,
  container: null,
  drag: null,
  layoutMode: false,
  hidden: new Set(),
  order: [],
  idToKey: new Map(),
  keyToId: new Map(),
  mutationObserver: null,
  lastRouteSeen: '',
  storageListener: false,
  hashListener: false,
  viewListener: false,
  routeListener: false,
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
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    } catch (_err) {}
  }
  if (typeof fetch === 'function') {
    try {
      fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
    } catch (_err) {}
  }
}

function readJson(key) {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function writeHiddenIds(ids) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (ids && ids.length) {
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(ids));
    } else {
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
    }
    localStorage.removeItem(LEGACY_HIDDEN_KEY_V0);
  } catch (_err) {}
}

function readHiddenIds() {
  const next = readJson(HIDDEN_STORAGE_KEY);
  if (Array.isArray(next)) return next.map(String).filter(Boolean);
  const legacy = readJson(LEGACY_HIDDEN_KEY_V0);
  if (Array.isArray(legacy)) return legacy.map(String).filter(Boolean);
  return [];
}

function writeLayoutModeFlag(enabled) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(MODE_STORAGE_KEY, enabled ? '1' : '0');
    localStorage.removeItem(LEGACY_MODE_KEY_V0);
  } catch (_err) {}
}

function readLayoutModeFlag() {
  if (typeof localStorage === 'undefined') return false;
  try {
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch (_err) {}
  const legacy = readJson(LEGACY_MODE_KEY_V0);
  if (legacy === '1' || legacy === 1 || legacy === true) return true;
  if (legacy === '0' || legacy === 0 || legacy === false) return false;
  return false;
}

function ensureContainer() {
  if (typeof document === 'undefined') return null;
  if (state.container && document.contains(state.container)) return state.container;
  const next = findDashboardContainer();
  if (next) state.container = next;
  return state.container;
}

function collectKeys(el, id) {
  const keys = new Set();
  if (!el) return Array.from(keys);
  if (el.dataset) {
    const dataKey = el.dataset.dashWidget || el.dataset.widgetKey || el.dataset.widget;
    if (dataKey) keys.add(String(dataKey));
  }
  if (el.getAttribute) {
    const attr = el.getAttribute('data-widget') || el.getAttribute('data-section') || el.getAttribute('data-key');
    if (attr) keys.add(String(attr));
  }
  if (LEGACY_ID_TO_KEY.has(id)) keys.add(LEGACY_ID_TO_KEY.get(id));
  return Array.from(keys).filter(Boolean);
}

function buildKeyMaps(entries) {
  state.idToKey.clear();
  state.keyToId.clear();
  entries.forEach(({ el, id }) => {
    if (!id) return;
    state.keyToId.set(id, id);
    const keys = collectKeys(el, id);
    if (keys.length) {
      if (!state.idToKey.has(id)) state.idToKey.set(id, keys[0]);
      keys.forEach((key) => {
        const value = String(key);
        if (!state.keyToId.has(value)) state.keyToId.set(value, id);
        const lower = value.toLowerCase();
        if (!state.keyToId.has(lower)) state.keyToId.set(lower, id);
      });
    }
  });
  LEGACY_KEY_TO_ID.forEach((legacyId, key) => {
    if (!legacyId) return;
    if (!state.keyToId.has(key)) state.keyToId.set(key, legacyId);
    const lower = key.toLowerCase();
    if (!state.keyToId.has(lower)) state.keyToId.set(lower, legacyId);
    if (!state.idToKey.has(legacyId)) state.idToKey.set(legacyId, key);
  });
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
  return combined;
}

function resolveStoredValue(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  if (state.keyToId.has(str)) return state.keyToId.get(str);
  const lower = str.toLowerCase();
  if (state.keyToId.has(lower)) return state.keyToId.get(lower);
  if (LEGACY_KEY_TO_ID.has(str)) return LEGACY_KEY_TO_ID.get(str);
  const legacyLower = str.toLowerCase();
  if (LEGACY_KEY_TO_ID.has(legacyLower)) return LEGACY_KEY_TO_ID.get(legacyLower);
  return str;
}

function loadStoredOrder(entries) {
  const raw = readStoredOrderRaw();
  const knownIds = new Set(entries.map(({ id }) => id));
  const seen = new Set();
  const resolved = [];
  let matched = 0;
  raw.forEach((value) => {
    const id = resolveStoredValue(value);
    if (!id || !knownIds.has(id) || seen.has(id)) return;
    resolved.push(id);
    seen.add(id);
    matched += 1;
  });
  entries.forEach(({ id }) => {
    if (!id || seen.has(id)) return;
    resolved.push(id);
    seen.add(id);
  });
  const needsPersist = matched !== raw.length || resolved.length !== raw.length;
  return { list: resolved, needsPersist };
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function toLegacyKeys(ids) {
  const seen = new Set();
  const out = [];
  ids.forEach((id) => {
    const key = state.idToKey.get(id) || LEGACY_ID_TO_KEY.get(id);
    const normalized = key ? String(key) : '';
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
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
  if (typeof window !== 'undefined' && window.Settings && typeof window.Settings.save === 'function') {
    try {
      Promise.resolve(window.Settings.save({ dashboardOrder: keys.slice() })).catch((err) => {
        if (console && console.warn) console.warn('[dash-layout] settings save failed', err);
      });
    } catch (_err) {}
  }
  try {
    document?.dispatchEvent?.(new CustomEvent('dashboard:layout-order', { detail: { ids: order.slice(), keys: keys.slice() } }));
  } catch (_err) {}
}

function writeOrder(ids, options = {}) {
  const order = Array.from(new Set(ids.map(String).filter(Boolean)));
  if (typeof localStorage !== 'undefined') {
    try {
      if (order.length) {
        const raw = JSON.stringify(order);
        const existing = localStorage.getItem(ORDER_STORAGE_KEY);
        if (existing !== raw) localStorage.setItem(ORDER_STORAGE_KEY, raw);
      } else {
        localStorage.removeItem(ORDER_STORAGE_KEY);
      }
    } catch (_err) {}
  }
  if (options.syncLegacy !== false) {
    persistOrderExtras(order);
  }
}

function applyVisibility(entries) {
  const container = ensureContainer();
  if (!container) return;
  const list = Array.isArray(entries) ? entries : scanWidgets(container, DASHBOARD_WIDGET_SELECTOR);
  list.forEach(({ el, id }) => {
    const shouldHide = state.hidden.has(id);
    if (shouldHide) {
      if (el.dataset.dashPrevDisplay === undefined) {
        el.dataset.dashPrevDisplay = el.style.display || '';
      }
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
      el.dataset.dashHidden = 'true';
    } else {
      if (el.dataset.dashPrevDisplay !== undefined) {
        el.style.display = el.dataset.dashPrevDisplay;
        delete el.dataset.dashPrevDisplay;
      } else {
        el.style.display = '';
      }
      el.removeAttribute('aria-hidden');
      if (el.dataset.dashHidden) delete el.dataset.dashHidden;
    }
  });
}

function computeGridOptions(container) {
  const entries = scanWidgets(container, DASHBOARD_WIDGET_SELECTOR);
  const first = entries.length ? entries[0].el : null;
  if (!first || typeof first.getBoundingClientRect !== 'function') {
    return { colWidth: 320, rowHeight: 260, gap: GRID_GAP_FALLBACK };
  }
  const rect = first.getBoundingClientRect();
  let gap = GRID_GAP_FALLBACK;
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(first);
      const gapValues = [style.marginRight, style.marginBottom, style.rowGap, style.gap]
        .map((val) => parseFloat(val || '0'))
        .filter((num) => Number.isFinite(num) && num >= 0);
      if (gapValues.length) {
        gap = Math.max(gap, ...gapValues);
      }
    } catch (_err) {}
  }
  return {
    colWidth: Math.max(1, rect.width),
    rowHeight: Math.max(1, rect.height),
    gap: Math.max(0, gap),
  };
}

function ensureDrag() {
  const container = ensureContainer();
  if (!container) return null;
  if (!state.drag) {
    const grid = computeGridOptions(container);
    state.drag = makeDraggableGrid({
      container,
      itemSel: DASHBOARD_WIDGET_SELECTOR,
      handleSel: HANDLE_SELECTOR,
      storageKey: ORDER_STORAGE_KEY,
      grid,
      idGetter: getWidgetId,
      enabled: state.layoutMode,
      onOrderChange: handleOrderChange,
    });
  } else {
    if (state.layoutMode) state.drag.enable();
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
  applyVisibility();
}

function toIdSet(input) {
  const set = new Set();
  if (!input) return set;
  if (input instanceof Set) {
    input.forEach((value) => {
      const id = String(value || '');
      if (id) set.add(id);
    });
    return set;
  }
  if (Array.isArray(input)) {
    input.forEach((value) => {
      const id = String(value || '');
      if (id) set.add(id);
    });
  }
  return set;
}

function appendWidgetToTail(id, persist) {
  const container = ensureContainer();
  if (!container || !id) return;
  const entries = scanWidgets(container, DASHBOARD_WIDGET_SELECTOR);
  const entry = entries.find((item) => item.id === id);
  if (!entry) return;
  container.appendChild(entry.el);
  const nextOrder = state.order.filter((value) => value !== id);
  nextOrder.push(id);
  state.order = nextOrder;
  writeOrder(state.order, { syncLegacy: persist !== false });
  if (state.drag) state.drag.refresh();
}

export function setDashboardLayoutMode(enabled, options = {}) {
  const next = !!enabled;
  const force = !!options.force;
  if (!force && state.layoutMode === next) return;
  state.layoutMode = next;
  if (options.persist !== false) {
    writeLayoutModeFlag(next);
  }
  ensureDrag();
  if (state.drag) {
    if (next) state.drag.enable();
    else state.drag.disable();
  }
  updateLayoutModeAttr();
}

export function applyDashboardHidden(input, options = {}) {
  const nextSet = toIdSet(input);
  const prev = state.hidden;
  let changed = nextSet.size !== prev.size;
  if (!changed) {
    for (const id of nextSet) {
      if (!prev.has(id)) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;
  const newlyShown = [];
  prev.forEach((id) => {
    if (!nextSet.has(id)) newlyShown.push(id);
  });
  state.hidden = nextSet;
  if (options.persist !== false) {
    writeHiddenIds(Array.from(nextSet).sort());
  }
  if (newlyShown.length) {
    newlyShown.forEach((id) => appendWidgetToTail(id, options.persist !== false));
  }
  applyVisibility();
}

function updateLayoutModeAttr() {
  const container = ensureContainer();
  if (!container) return;
  container.setAttribute('data-dash-layout-mode', state.layoutMode ? 'on' : 'off');
}

function scheduleAfterRender(fn) {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      setTimeout(fn, 0);
    });
  } else {
    setTimeout(fn, 0);
  }
}

function armMutationObserver() {
  if (typeof MutationObserver !== 'function') return;
  const container = ensureContainer();
  if (!container) return;
  if (state.mutationObserver) {
    state.mutationObserver.disconnect();
    state.mutationObserver = null;
  }
  const observer = new MutationObserver(() => {
    observer.disconnect();
    if (state.mutationObserver === observer) state.mutationObserver = null;
    applyCurrentLayout('mutation');
  });
  observer.observe(container, { childList: true });
  state.mutationObserver = observer;
}

function logRouteInit() {
  const container = ensureContainer();
  const entries = container ? scanWidgets(container, DASHBOARD_WIDGET_SELECTOR) : [];
  const payload = {
    items: entries.length,
    hidden: state.hidden.size,
    listeners: getListenerCount(),
  };
  try {
    console.info(LOG_LABEL, payload);
  } catch (_err) {}
  postLog('dash-init', payload);
}

function handleRouteEvent(evt) {
  const detail = evt && evt.detail;
  const hash = typeof detail === 'string' ? detail : detail && (detail.hash || detail.route);
  if (hash && !hash.startsWith('#/dashboard')) return;
  const cameFromOther = state.lastRouteSeen !== 'dashboard';
  state.lastRouteSeen = 'dashboard';
  armMutationObserver();
  scheduleAfterRender(() => {
    applyCurrentLayout('route');
    if (cameFromOther) {
      logRouteInit();
    }
  });
}

function handleHashChange() {
  const hash = typeof window !== 'undefined' && window.location ? window.location.hash : '';
  if (hash === '#/dashboard' || hash.startsWith('#/dashboard?')) {
    handleRouteEvent({ detail: hash });
  } else {
    state.lastRouteSeen = 'other';
  }
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
  if (typeof document !== 'undefined') {
    if (!state.viewListener) {
      document.addEventListener('app:view:changed', handleViewChange);
      state.viewListener = true;
    }
    if (!state.routeListener) {
      document.addEventListener('route:enter', handleRouteEvent);
      state.routeListener = true;
    }
  }
  state.wired = true;
  return state;
}

export default initDashboardLayout;
