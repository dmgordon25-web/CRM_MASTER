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

function postLog(event, data) {
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

function readStoredOrderRaw() {
  const lists = [];
  const current = readJson(ORDER_STORAGE_KEY);
  if (Array.isArray(current) && current.length) lists.push(current);
  const legacy = readJson(LEGACY_ORDER_KEY_V0);
  if (Array.isArray(legacy) && legacy.length) lists.push(legacy);
  const keys = readJson(LEGACY_ORDER_KEY);
  if (Array.isArray(keys) && keys.length) lists.push(keys);
  const combined = [];
  const seen = new Set();
  lists.forEach((list) => {
    list.forEach((value) => {
      const str = String(value || '').trim();
      if (!str || seen.has(str)) return;
      seen.add(str);
      combined.push(str);
    });
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

function persistOrderExtras(ids) {
  const order = Array.from(new Set(ids.map(String).filter(Boolean)));
  const keys = toLegacyKeys(order);
  if (typeof localStorage !== 'undefined') {
    try {
      if (keys.length) {
        localStorage.setItem(LEGACY_ORDER_KEY, JSON.stringify(keys));
      } else {
        localStorage.removeItem(LEGACY_ORDER_KEY);
      }
      localStorage.removeItem(LEGACY_ORDER_KEY_V0);
    } catch (_err) {}
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

function applyCurrentLayout(reason) {
  const container = ensureContainer();
  if (!container) return;
  const entries = scanWidgets(container, DASHBOARD_WIDGET_SELECTOR);
  if (!entries.length) return;
  buildKeyMaps(entries);
  const { list, needsPersist } = loadStoredOrder(entries);
  const changed = !arraysEqual(state.order, list);
  state.order = list;
  if (needsPersist || changed) {
    writeOrder(state.order, { syncLegacy: true });
  }
  if (state.order.length) {
    const applied = applyOrder(container, state.order, DASHBOARD_WIDGET_SELECTOR, getWidgetId);
    if (applied.length && !arraysEqual(state.order, applied)) {
      state.order = applied;
      writeOrder(state.order, { syncLegacy: true });
    }
  }
  applyVisibility(entries);
  ensureDrag();
  if (state.drag) state.drag.refresh();
}

function handleOrderChange(orderIds) {
  const ids = Array.isArray(orderIds) ? orderIds.map(String).filter(Boolean) : [];
  if (!ids.length) return;
  if (!arraysEqual(state.order, ids)) {
    state.order = ids.slice();
    writeOrder(state.order, { syncLegacy: true });
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

function handleViewChange(evt) {
  const detail = evt && evt.detail ? evt.detail : {};
  const view = detail.view || detail.id || detail.route || '';
  if (view === 'dashboard') {
    handleRouteEvent({ detail: '#/dashboard' });
  } else if (view) {
    state.lastRouteSeen = 'other';
  }
}

function onStorage(evt) {
  if (!evt || typeof evt.key !== 'string') return;
  const key = evt.key;
  if (key === HIDDEN_STORAGE_KEY || key === LEGACY_HIDDEN_KEY_V0) {
    state.hidden = new Set(readHiddenIds());
    applyVisibility();
    return;
  }
  if (key === MODE_STORAGE_KEY || key === LEGACY_MODE_KEY_V0) {
    const next = readLayoutModeFlag();
    setDashboardLayoutMode(next, { persist: false, force: true });
    return;
  }
  if (key === ORDER_STORAGE_KEY || key === LEGACY_ORDER_KEY || key === LEGACY_ORDER_KEY_V0) {
    applyCurrentLayout('storage');
  }
}

export function readStoredLayoutMode() {
  return readLayoutModeFlag();
}

export function readStoredHiddenIds() {
  return readHiddenIds();
}

export function reapplyDashboardLayout(reason) {
  applyCurrentLayout(reason || 'manual');
}

export function getDashboardListenerCount() {
  return getListenerCount();
}

export function initDashboardLayout() {
  if (state.wired) {
    ensureContainer();
    applyCurrentLayout('reinit');
    updateLayoutModeAttr();
    return state;
  }
  state.layoutMode = readLayoutModeFlag();
  state.hidden = new Set(readHiddenIds());
  ensureContainer();
  applyCurrentLayout('init');
  updateLayoutModeAttr();
  ensureDrag();
  applyVisibility();
  if (typeof window !== 'undefined') {
    if (!state.storageListener) {
      window.addEventListener('storage', onStorage);
      state.storageListener = true;
    }
    if (!state.hashListener) {
      window.addEventListener('hashchange', handleHashChange);
      state.hashListener = true;
    }
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
