import { openMergeModal } from './merge_modal.js';

const BUTTON_ID = 'actionbar-merge-partners';
const DATA_ACTION_NAME = 'clear';
const FAB_ID = 'global-new';
const FAB_MENU_ID = 'global-new-menu';

const globalWiringState = typeof window !== 'undefined'
  ? (window.__ACTION_BAR_WIRING__ = window.__ACTION_BAR_WIRING__ || {
    windowListeners: new Map(),
    documentListeners: new Map(),
    teardown() {}
  })
  : { windowListeners: new Map(), documentListeners: new Map(), teardown() {} };

if (!('selectionOff' in globalWiringState)) globalWiringState.selectionOff = null;
if (!('selectedCount' in globalWiringState)) globalWiringState.selectedCount = 0;
if (!('actionsReady' in globalWiringState)) globalWiringState.actionsReady = false;
if (!('lastSelection' in globalWiringState)) globalWiringState.lastSelection = null;
if (!('hasSelectionSnapshot' in globalWiringState)) globalWiringState.hasSelectionSnapshot = false;
if (!('postPaintRefreshScheduled' in globalWiringState)) globalWiringState.postPaintRefreshScheduled = false;
if (!('routeState' in globalWiringState)) {
  globalWiringState.routeState = {
    key: null,
    hasCentered: false,
    centerActive: false
  };
}
if (!('dragState' in globalWiringState)) {
  globalWiringState.dragState = {
    wired: false,
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
    width: 0,
    height: 0,
    shell: null,
    moveHandler: null,
    upHandler: null,
    cancelHandler: null,
    downHandler: null,
    wiredTarget: null,
    hasManualPosition: false,
    lastPosition: null
  };
}

const scheduleVisibilityRefresh = typeof queueMicrotask === 'function'
  ? queueMicrotask
  : (fn) => {
    try {
      if (typeof Promise === 'function') {
        Promise.resolve().then(() => fn()).catch(() => {});
        return;
      }
    } catch (_) {}
    try { fn(); }
    catch (_) {}
  };

function refreshActionBarVisibility() {
  if (typeof document === 'undefined') return;
  const root = document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
  if (root) _updateDataVisible(root);
  else syncActionBarVisibility(globalWiringState.selectedCount || 0);
}

function requestVisibilityRefresh() {
  scheduleVisibilityRefresh(() => {
    refreshActionBarVisibility();
  });
}

function flushPostPaintVisibilityRefresh() {
  globalWiringState.postPaintRefreshScheduled = false;
  try {
    refreshActionBarVisibility();
  } catch (_) {}
}

function schedulePostPaintVisibilityRefresh() {
  if (globalWiringState.postPaintRefreshScheduled) return;
  globalWiringState.postPaintRefreshScheduled = true;
  const invoke = () => {
    scheduleVisibilityRefresh(() => {
      flushPostPaintVisibilityRefresh();
    });
  };
  try {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        invoke();
      });
      return;
    }
  } catch (_) {}
  invoke();
}

export function ensureActionBarPostPaintRefresh() {
  schedulePostPaintVisibilityRefresh();
}

function shouldSchedulePostPaintForRoute(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'partners' || raw === 'contacts') return true;
  let normalized = raw;
  normalized = normalized.replace(/^#/, '');
  normalized = normalized.replace(/^\/+/, '');
  const segment = normalized.split(/[?&#]/)[0];
  return segment === 'partners' || segment === 'contacts';
}

function extractRouteKey(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw === 'partners' || raw === 'contacts') return raw;
  const hashIndex = raw.indexOf('#');
  let normalized = hashIndex >= 0 ? raw.slice(hashIndex + 1) : raw;
  normalized = normalized.replace(/^https?:\/\//, '');
  const slashDomainIndex = normalized.indexOf('/');
  if (slashDomainIndex > 0 && normalized.slice(0, slashDomainIndex).includes('.')) {
    normalized = normalized.slice(slashDomainIndex);
  }
  normalized = normalized.replace(/^\/+/, '');
  const segment = normalized.split(/[?&#/]/)[0];
  if (segment === 'partners' || segment === 'contacts') return segment;
  return null;
}

function updateActiveRouteKey(nextKey, options = {}) {
  const state = globalWiringState.routeState;
  if (!state) return;
  const normalized = typeof nextKey === 'string' && nextKey ? nextKey : null;
  const forceReset = options.forceReset === true;
  const changed = state.key !== normalized;
  if (!changed && !forceReset) return;
  state.key = normalized;
  state.hasCentered = false;
  state.centerActive = false;
  restoreActionBarDock('silent');
}

function applyRouteCandidate(value, options = {}) {
  const key = extractRouteKey(value);
  if (key) {
    updateActiveRouteKey(key, { forceReset: !!options.forceReset });
    return;
  }
  if (options.allowNullReset) {
    updateActiveRouteKey(null, { forceReset: !!options.forceReset });
  }
}

function refreshActiveRouteFromLocation(options = {}) {
  if (typeof window === 'undefined' || !window.location) return;
  const opts = { forceReset: !!options.forceReset, allowNullReset: true };
  const hash = typeof window.location.hash === 'string' ? window.location.hash : '';
  applyRouteCandidate(hash, opts);
  if (globalWiringState.routeState && globalWiringState.routeState.key) return;
  const path = typeof window.location.pathname === 'string' ? window.location.pathname : '';
  applyRouteCandidate(path, opts);
}

function isActionBarRouteActive() {
  const state = globalWiringState.routeState;
  if (!state || !state.key) return false;
  return state.key === 'partners' || state.key === 'contacts';
}

function clearActionBarInlinePosition(bar) {
  if (!bar) return;
  bar.style.transform = '';
  bar.style.top = '';
  bar.style.left = '';
  bar.style.right = '';
  bar.style.bottom = '';
}

function triggerActionBarPulse(bar) {
  if (!bar || typeof bar.animate !== 'function') return;
  try {
    bar.animate([
      { boxShadow: '0 0 0 0 rgba(59,130,246,0.35)' },
      { boxShadow: '0 0 0 18px rgba(59,130,246,0)' }
    ], {
      duration: 600,
      easing: 'ease-out',
      iterations: 1
    });
  } catch (_) {}
}

function centerActionBarForRoute(options = {}) {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (!globalWiringState.actionsReady) return;
  const bar = document.getElementById('actionbar');
  if (!bar || !bar.isConnected) return;
  clearActionBarInlinePosition(bar);
  const rect = bar.getBoundingClientRect();
  if (!rect || !Number.isFinite(rect.top)) return;
  const viewportHeight = typeof window.innerHeight === 'number' ? window.innerHeight : 0;
  if (!viewportHeight) return;
  const targetTop = Math.max(0, (viewportHeight - rect.height) / 2);
  const translateY = Math.round(targetTop - rect.top);
  bar.style.transform = `translate(-50%, ${Number.isFinite(translateY) ? `${translateY}px` : '0px'})`;
  if (options.pulse !== false) {
    triggerActionBarPulse(bar);
  }
  const state = globalWiringState.routeState;
  if (state) {
    state.centerActive = true;
  }
  const dragState = globalWiringState.dragState;
  if (dragState) {
    dragState.hasManualPosition = false;
    dragState.lastPosition = null;
  }
  if (!options.silent) {
    try { console.info('[A_BEACON] actionbar:centered'); }
    catch (_) {}
  }
}

function restoreActionBarDock(reason = 'silent') {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('actionbar');
  stopActionBarDrag('silent');
  if (!bar) return;
  clearActionBarInlinePosition(bar);
  const state = globalWiringState.routeState;
  if (state) {
    state.centerActive = false;
  }
  const dragState = globalWiringState.dragState;
  if (dragState) {
    dragState.hasManualPosition = false;
    dragState.lastPosition = null;
  }
  if (reason !== 'silent') {
    requestVisibilityRefresh();
  }
}

function handleSelectionTransition(previous, next) {
  const state = globalWiringState.routeState;
  if (!state) return;
  if (next <= 0) {
    if (previous > 0 && (state.centerActive || (globalWiringState.dragState && globalWiringState.dragState.hasManualPosition))) {
      restoreActionBarDock('silent');
    }
    return;
  }
  if (previous === 0 && next > 0 && isActionBarRouteActive() && !state.hasCentered) {
    centerActionBarForRoute();
    state.hasCentered = true;
  }
}

function handleAppViewChanged(event) {
  const detail = event && event.detail ? event.detail : {};
  const view = typeof detail.view === 'string' ? detail.view : '';
  applyRouteCandidate(view, { forceReset: true, allowNullReset: true });
  if (!shouldSchedulePostPaintForRoute(view)) return;
  ensureActionBarPostPaintRefresh();
}

function handleRouteHashChange() {
  if (typeof window === 'undefined' || !window.location) return;
  refreshActiveRouteFromLocation({ forceReset: true });
  const hash = typeof window.location.hash === 'string' ? window.location.hash : '';
  if (!shouldSchedulePostPaintForRoute(hash)) return;
  ensureActionBarPostPaintRefresh();
}

function setActionsReady(flag) {
  const next = !!flag;
  if (globalWiringState.actionsReady === next) return;
  globalWiringState.actionsReady = next;
  requestVisibilityRefresh();
}

function setSelectedCount(count) {
  const numeric = typeof count === 'number' && Number.isFinite(count) ? count : 0;
  const next = numeric > 0 ? Math.max(0, Math.floor(numeric)) : 0;
  const previous = globalWiringState.selectedCount || 0;
  if (previous === next) return;
  globalWiringState.selectedCount = next;
  handleSelectionTransition(previous, next);
  requestVisibilityRefresh();
}

function resetActionBarState() {
  globalWiringState.actionsReady = false;
  globalWiringState.selectedCount = 0;
  restoreActionBarDock('silent');
  if (globalWiringState.routeState) {
    globalWiringState.routeState.hasCentered = false;
    globalWiringState.routeState.centerActive = false;
  }
  requestVisibilityRefresh();
}

function handleSelectionChanged(detail) {
  const payload = detail && typeof detail === 'object' ? detail : {};
  const hadSnapshot = globalWiringState.hasSelectionSnapshot === true;
  globalWiringState.hasSelectionSnapshot = true;
  globalWiringState.lastSelection = payload;
  const ids = Array.isArray(payload.ids) ? payload.ids : [];
  let count = typeof payload.count === 'number' && Number.isFinite(payload.count)
    ? payload.count
    : ids.length;
  const source = typeof payload.source === 'string' ? payload.source.toLowerCase() : '';
  const isInitialSnapshot = !hadSnapshot && (source === 'snapshot' || source === 'init' || source === 'ready');
  if (isInitialSnapshot && count > 0 && !hasDomSelectionSnapshot()) {
    count = 0;
    try { window.Selection?.clear?.('actionbar:init'); }
    catch (_) {}
    try { window.SelectionService?.clear?.('actionbar:init'); }
    catch (_) {}
    try { window.SelectionStore?.clear?.('partners'); }
    catch (_) {}
  }
  setSelectedCount(count);
}

function clearSelectionSubscription() {
  const off = globalWiringState.selectionOff;
  globalWiringState.selectionOff = null;
  if (typeof off === 'function') {
    try { off(); }
    catch (_) {}
  }
  globalWiringState.hasSelectionSnapshot = false;
  globalWiringState.lastSelection = null;
}

function getSelectionApi() {
  if (typeof window === 'undefined') return null;
  const svc = window.Selection;
  if (svc && typeof svc.onChange === 'function') return svc;
  const compat = window.SelectionService;
  if (compat && typeof compat.onChange === 'function') return compat;
  return null;
}

function readSelectionSnapshot(selection) {
  if (!selection) return { ids: [], type: 'contacts' };
  try {
    if (typeof selection.get === 'function') {
      const value = selection.get();
      if (value && typeof value === 'object' && Array.isArray(value.ids)) {
        return { ...value, ids: value.ids.slice() };
      }
    }
  } catch (_) {}
  try {
    if (typeof selection.getSelectedIds === 'function') {
      const ids = selection.getSelectedIds();
      if (Array.isArray(ids)) {
        const type = typeof selection.type === 'string' && selection.type.trim()
          ? selection.type.trim()
          : 'contacts';
        return { ids: ids.slice(), type };
      }
    }
  } catch (_) {}
  return { ids: [], type: 'contacts' };
}

function ensureSelectionSubscription() {
  if (globalWiringState.selectionOff) return;
  const selection = getSelectionApi();
  if (!selection || typeof selection.onChange !== 'function') return;
  try {
    const off = selection.onChange((detail) => {
      handleSelectionChanged(detail);
    });
    globalWiringState.selectionOff = typeof off === 'function' ? off : null;
  } catch (_) {
    return;
  }
  if (!globalWiringState.hasSelectionSnapshot) {
    const snapshot = readSelectionSnapshot(selection);
    handleSelectionChanged({ ...snapshot, source: snapshot.source || 'snapshot' });
  }
}

let __actionBarResizeTimer = null;

function toOptionsKey(options) {
  if (!options) return 'default';
  if (typeof options === 'boolean') return options ? 'bool:true' : 'bool:false';
  const keys = Object.keys(options);
  if (!keys.length) return 'object:{}';
  return keys.sort().map((key) => `${key}:${options[key]}`).join('|');
}

function registerListener(target, registry, type, handler, options) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const optionsKey = toOptionsKey(options);
  const existing = registry.get(type);
  if (existing && existing.handler === handler && existing.optionsKey === optionsKey) {
    return existing.off;
  }
  if (existing) {
    target.removeEventListener(type, existing.handler, existing.options);
    registry.delete(type);
  }
  target.addEventListener(type, handler, options);
  const off = () => {
    const current = registry.get(type);
    if (!current || current.handler !== handler || current.optionsKey !== optionsKey) return;
    target.removeEventListener(type, handler, options);
    registry.delete(type);
  };
  registry.set(type, { handler, options, optionsKey, off });
  return off;
}

function registerWindowListener(type, handler, options) {
  return registerListener(typeof window !== 'undefined' ? window : null, globalWiringState.windowListeners, type, handler, options);
}

function registerDocumentListener(type, handler, options) {
  return registerListener(typeof document !== 'undefined' ? document : null, globalWiringState.documentListeners, type, handler, options);
}

function teardownAll() {
  if (typeof window !== 'undefined') {
    globalWiringState.windowListeners.forEach((entry, type) => {
      window.removeEventListener(type, entry.handler, entry.options);
    });
    globalWiringState.windowListeners.clear();
  }
  if (typeof document !== 'undefined') {
    globalWiringState.documentListeners.forEach((entry, type) => {
      document.removeEventListener(type, entry.handler, entry.options);
    });
    globalWiringState.documentListeners.clear();
  }
  clearSelectionSubscription();
  resetActionBarState();
}

globalWiringState.teardown = teardownAll;

function _isActuallyVisible(el) {
  if (!el || !el.isConnected) return false;
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
  const rects = el.getClientRects();
  return rects && rects.length > 0 && rects[0].width > 0 && rects[0].height > 0;
}

function hasDomSelectionSnapshot() {
  if (typeof document === 'undefined') return false;
  const selectors = [
    '[data-ui="row-check"][aria-checked="true"]',
    '[data-ui="row-check"]:checked',
    '[data-ui="row-check"][data-selected="true"]',
    '[data-selected="true"]',
    'tr.selected',
    '[data-row].is-selected'
  ];
  for (const selector of selectors) {
    try {
      if (document.querySelector(selector)) return true;
    } catch (_) {
      /* noop */
    }
  }
  return false;
}

function syncActionBarVisibility(selCount, explicitEl) {
  if (typeof document === 'undefined') return;
  const bar = explicitEl
    || document.querySelector('[data-ui="action-bar"]')
    || document.getElementById('actionbar');
  if (!bar) return;
  const ready = globalWiringState.actionsReady === true;
  const numeric = typeof selCount === 'number' && Number.isFinite(selCount)
    ? Math.max(0, Math.floor(selCount))
    : 0;
  if (ready && numeric > 0 && _isActuallyVisible(bar)) {
    bar.setAttribute('data-visible', '1');
  } else {
    bar.removeAttribute('data-visible');
  }
}

function _updateDataVisible(el) {
  try {
    syncActionBarVisibility(globalWiringState.selectedCount || 0, el);
  } catch {}
}

function handleActionBarResize() {
  clearTimeout(__actionBarResizeTimer);
  __actionBarResizeTimer = setTimeout(() => {
    const root = document.getElementById('actionbar');
    if (root) {
      _updateDataVisible(root);
      if (globalWiringState.dragState && globalWiringState.dragState.hasManualPosition) {
        constrainManualPositionWithinViewport(root);
      }
    } else {
      syncActionBarVisibility(globalWiringState.selectedCount || 0);
    }
  }, 100);
}

function _attachActionBarVisibilityHooks(actionBarRoot) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  registerWindowListener('resize', handleActionBarResize, { passive: true });
  window.__UPDATE_ACTION_BAR_VISIBLE__ = function updateActionBarVisible() {
    requestVisibilityRefresh();
  };
  if (actionBarRoot) {
    requestVisibilityRefresh();
  }
}

function markActionbarHost() {
  if (typeof document === 'undefined') return null;
  const bar = document.getElementById('actionbar');
  if (!bar || !bar.isConnected) {
    setActionsReady(false);
    return null;
  }
  if (typeof document.contains === 'function') {
    try {
      if (!document.contains(bar)) {
        setActionsReady(false);
        return null;
      }
    } catch (_) {}
  }
  setActionsReady(true);
  if (bar.hasAttribute('data-visible') && bar.getAttribute('data-visible') !== '1') {
    bar.removeAttribute('data-visible');
  }
  requestVisibilityRefresh();
  syncActionBarVisibility(globalWiringState.selectedCount || 0, bar);
  if (!bar.dataset.ui) {
    bar.dataset.ui = 'action-bar';
  }
  if (!bar.hasAttribute('data-ui')) {
    bar.setAttribute('data-ui', 'action-bar');
  }
  _attachActionBarVisibilityHooks(bar);
  bar.querySelectorAll('[data-act]').forEach((node) => {
    const action = node.getAttribute('data-act');
    if (!action || node.hasAttribute('data-action')) return;
    node.setAttribute('data-action', action);
  });
  const clearBtn = bar.querySelector('[data-act="clear"]');
  if (clearBtn && !clearBtn.hasAttribute('data-action')) {
    clearBtn.setAttribute('data-action', DATA_ACTION_NAME);
  }
  const mergeBtn = bar.querySelector('[data-act="merge"]');
  if (mergeBtn) {
    if (!mergeBtn.hasAttribute('data-action')) {
      mergeBtn.setAttribute('data-action', 'merge');
    }
    if (mergeBtn.getAttribute('data-qa') !== 'action-merge') {
      mergeBtn.setAttribute('data-qa', 'action-merge');
    }
  }
  const dragState = globalWiringState.dragState;
  if (dragState && dragState.hasManualPosition && dragState.lastPosition) {
    const { left = 0, top = 0 } = dragState.lastPosition;
    applyManualPosition(bar, left, top);
  } else if (globalWiringState.routeState && globalWiringState.routeState.centerActive) {
    centerActionBarForRoute({ pulse: false, silent: true });
  }
  ensureActionBarDragHandles(bar);
  return bar;
}

function initializeActionBar() {
  resetActionBarState();
  const bar = markActionbarHost();
  ensureGlobalNewFab();
  ensureMergeHandler();
  ensureSelectionSubscription();
  syncActionBarVisibility(0, bar);
}

function trackLastActionBarClick(event) {
  const target = event && event.target;
  const btn = target && typeof target.closest === 'function' ? target.closest('[data-action]') : null;
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (!action) return;
  window.__ACTION_BAR_LAST_DATA_ACTION__ = action;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (typeof window.__ACTION_BAR_LAST_DATA_ACTION__ === 'undefined') {
    window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
  }
  if (document.readyState === 'loading') {
    registerDocumentListener('DOMContentLoaded', initializeActionBar, { once: true });
  } else {
    initializeActionBar();
  }
  syncActionBarVisibility(0);
  registerDocumentListener('click', trackLastActionBarClick, true);
  registerDocumentListener('app:view:changed', handleAppViewChanged);
  registerWindowListener('hashchange', handleRouteHashChange, { passive: true });
  handleRouteHashChange();
}

function injectActionBarStyle(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('ab-inline-style')) return;
  const s = document.createElement('style'); s.id = 'ab-inline-style';
  s.textContent = `
      #actionbar{
        position:fixed; left:50%; transform:translateX(-50%);
        bottom:16px; z-index:9999;
        max-width:960px; width:auto; padding:8px 12px;
        border-radius:12px; background:rgba(20,22,28,0.88); color:#fff;
        box-shadow:0 8px 24px rgba(0,0,0,.25);
      }
      #actionbar .actionbar-actions{ display:flex; gap:8px; align-items:center; justify-content:center; position:relative; }
      #actionbar .btn{ padding:6px 10px; font-size:0.95rem; border-radius:10px; }
      #actionbar .btn.disabled{ opacity:.45; pointer-events:none; }
      #actionbar .btn.active{ outline:2px solid rgba(255,255,255,.35); transform:translateY(-1px); }
      #actionbar .actionbar-fab{ position:relative; display:flex; align-items:center; justify-content:center; }
      #global-new{
        min-width:56px; min-height:56px; border-radius:999px; border:none;
        background:var(--primary); color:var(--primary-text); cursor:pointer;
        display:flex; align-items:center; justify-content:center;
        font-size:30px; font-weight:600; line-height:1; padding:0;
        box-shadow:0 12px 32px rgba(10,102,194,0.3);
      }
      #global-new:hover,#global-new:focus-visible{
        background:var(--primary);
        outline:none;
      }
      #global-new:active{
        transform:none;
      }
      #global-new[aria-expanded="true"]{
        background:var(--primary);
      }
      #global-new-menu{
        position:fixed; left:50%; transform:translateX(-50%);
        bottom:calc(var(--fab-safe-bottom, 24px) + 72px);
        display:flex; flex-direction:column; gap:8px;
        background:rgba(15,23,42,0.96); padding:12px;
        border-radius:12px; min-width:200px;
        box-shadow:0 18px 40px rgba(15,23,42,0.35);
        z-index:10000;
      }
      #global-new-menu[hidden]{ display:none; }
      #global-new-menu button{
        border:none; border-radius:8px; padding:10px 12px;
        background:rgba(248,250,252,0.08); color:#f8fafc;
        font-size:14px; text-align:left; cursor:pointer;
      }
      #global-new-menu button:hover,#global-new-menu button:focus-visible{
        background:rgba(248,250,252,0.16);
        outline:none;
      }
    `;
  document.head.appendChild(s);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function stopActionBarDrag(reason = 'event') {
  const state = globalWiringState.dragState;
  if (!state) return;
  const shell = state.shell;
  if (shell) {
    if (state.moveHandler) shell.removeEventListener('pointermove', state.moveHandler);
    if (state.upHandler) shell.removeEventListener('pointerup', state.upHandler);
    if (state.cancelHandler) shell.removeEventListener('pointercancel', state.cancelHandler);
    if (state.pointerId != null && typeof shell.releasePointerCapture === 'function') {
      try { shell.releasePointerCapture(state.pointerId); }
      catch (_) {}
    }
  }
  const wasActive = state.active === true;
  state.active = false;
  state.pointerId = null;
  state.offsetX = 0;
  state.offsetY = 0;
  state.width = 0;
  state.height = 0;
  state.shell = null;
  state.moveHandler = null;
  state.upHandler = null;
  state.cancelHandler = null;
  if (wasActive && reason !== 'silent') {
    try { console.info('[A_BEACON] actionbar:drag-end'); }
    catch (_) {}
  }
}

function applyManualPosition(bar, left, top) {
  if (!bar) return;
  bar.style.transform = 'translate(0px, 0px)';
  bar.style.left = `${left}px`;
  bar.style.top = `${top}px`;
  bar.style.right = 'auto';
  bar.style.bottom = 'auto';
}

function constrainManualPositionWithinViewport(bar) {
  if (typeof window === 'undefined' || !bar) return;
  const state = globalWiringState.dragState;
  if (!state || !state.hasManualPosition || !state.lastPosition) return;
  const rect = bar.getBoundingClientRect();
  const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : state.width || 0;
  const height = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : state.height || 0;
  const viewportWidth = typeof window.innerWidth === 'number' ? window.innerWidth : 0;
  const viewportHeight = typeof window.innerHeight === 'number' ? window.innerHeight : 0;
  if (!viewportWidth || !viewportHeight) return;
  const maxLeft = Math.max(0, viewportWidth - width);
  const maxTop = Math.max(0, viewportHeight - height);
  const left = clamp(state.lastPosition.left || 0, 0, maxLeft);
  const top = clamp(state.lastPosition.top || 0, 0, maxTop);
  applyManualPosition(bar, left, top);
  state.lastPosition = { left, top };
}

function ensureActionBarDragHandles(bar) {
  if (!bar) return;
  const state = globalWiringState.dragState;
  if (!state) return;
  const shell = bar.querySelector('.actionbar-shell');
  if (!shell) return;
  if (state.wiredTarget && state.wiredTarget !== shell && state.downHandler) {
    state.wiredTarget.removeEventListener('pointerdown', state.downHandler);
    state.wiredTarget = null;
    state.downHandler = null;
  }
  if (state.wiredTarget === shell && state.downHandler) return;
  const handlePointerDown = (event) => {
    const btn = typeof event.button === 'number' ? event.button : 0;
    if (btn !== 0) return;
    if (!isActionBarRouteActive()) return;
    if ((globalWiringState.selectedCount || 0) <= 0) return;
    const target = event.target;
    if (target && typeof target.closest === 'function') {
      if (target.closest('button, [data-action], [data-act], a, input, select, textarea')) return;
    }
    const barEl = document.getElementById('actionbar');
    if (!barEl) return;
    const rect = barEl.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;
    stopActionBarDrag('silent');
    applyManualPosition(barEl, rect.left, rect.top);
    const dragState = globalWiringState.dragState;
    dragState.active = true;
    dragState.pointerId = event.pointerId;
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    dragState.width = rect.width;
    dragState.height = rect.height;
    dragState.shell = shell;
    dragState.hasManualPosition = true;
    dragState.lastPosition = { left: rect.left, top: rect.top };
    const routeState = globalWiringState.routeState;
    if (routeState) {
      routeState.centerActive = false;
    }
    const moveHandler = (evt) => {
      if (!dragState.active || evt.pointerId !== dragState.pointerId) return;
      const viewWidth = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : rect.right;
      const viewHeight = typeof window !== 'undefined' && typeof window.innerHeight === 'number' ? window.innerHeight : rect.bottom;
      const maxLeft = Math.max(0, viewWidth - dragState.width);
      const maxTop = Math.max(0, viewHeight - dragState.height);
      const rawLeft = evt.clientX - dragState.offsetX;
      const rawTop = evt.clientY - dragState.offsetY;
      const left = clamp(rawLeft, 0, maxLeft);
      const top = clamp(rawTop, 0, maxTop);
      applyManualPosition(barEl, left, top);
      dragState.lastPosition = { left, top };
      evt.preventDefault();
    };
    const upHandler = (evt) => {
      if (evt.pointerId !== dragState.pointerId) return;
      stopActionBarDrag();
    };
    const cancelHandler = (evt) => {
      if (evt.pointerId !== dragState.pointerId) return;
      stopActionBarDrag();
    };
    dragState.moveHandler = moveHandler;
    dragState.upHandler = upHandler;
    dragState.cancelHandler = cancelHandler;
    shell.addEventListener('pointermove', moveHandler);
    shell.addEventListener('pointerup', upHandler);
    shell.addEventListener('pointercancel', cancelHandler);
    if (typeof shell.setPointerCapture === 'function') {
      try { shell.setPointerCapture(event.pointerId); }
      catch (_) {}
    }
    try { console.info('[A_BEACON] actionbar:drag-start'); }
    catch (_) {}
    event.preventDefault();
  };
  shell.addEventListener('pointerdown', handlePointerDown);
  state.wired = true;
  state.wiredTarget = shell;
  state.downHandler = handlePointerDown;
}

function getActionsHost() {
  const bar = typeof document !== 'undefined' ? document.getElementById('actionbar') : null;
  return bar ? bar.querySelector('.actionbar-actions') : null;
}

const fabState = {
  outsideHandler: null,
  keyHandler: null
};

function showToast(kind, message) {
  const text = String(message == null ? '' : message).trim();
  if (!text) return;
  const toast = typeof window !== 'undefined' ? window.Toast : undefined;
  const legacy = typeof window !== 'undefined' ? window.toast : undefined;
  if (toast && typeof toast[kind] === 'function') {
    try { toast[kind](text); return; }
    catch (_) {}
  }
  if (toast && typeof toast.show === 'function') {
    try { toast.show(text); return; }
    catch (_) {}
  }
  if (typeof legacy === 'function') {
    try { legacy(text); }
    catch (_) {}
  }
}

function ensureFabElements() {
  const host = getActionsHost();
  if (!host) return null;
  let wrap = host.querySelector('.actionbar-fab');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'actionbar-fab';
    host.appendChild(wrap);
  }

  let fab = document.getElementById(FAB_ID);
  if (!fab) {
    fab = document.createElement('button');
    fab.id = FAB_ID;
    fab.type = 'button';
    fab.setAttribute('role', 'button');
    fab.setAttribute('aria-label', 'New');
    fab.setAttribute('data-qa', 'fab');
    fab.setAttribute('aria-expanded', 'false');
    fab.textContent = '+';
    wrap.appendChild(fab);
  } else if (!wrap.contains(fab)) {
    wrap.appendChild(fab);
  }

  if (fab) {
    if (!fab.classList.contains('fab')) {
      fab.classList.add('fab');
    }
    if (fab.getAttribute('aria-label') !== 'New') {
      fab.setAttribute('aria-label', 'New');
    }
    if (fab.getAttribute('data-qa') !== 'fab') {
      fab.setAttribute('data-qa', 'fab');
    }
    if (!fab.hasAttribute('data-action')) {
      fab.setAttribute('data-action', 'new');
    }
  }

  let menu = document.getElementById(FAB_MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = FAB_MENU_ID;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-qa', 'fab-menu');
    menu.hidden = true;

    const makeButton = (label, qa) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('data-qa', qa);
      if (!btn.hasAttribute('data-action')) {
        btn.setAttribute('data-action', qa);
      }
      btn.setAttribute('role', 'menuitem');
      return btn;
    };

    const btnContact = makeButton('New Contact', 'new-contact');
    const btnPartner = makeButton('New Partner', 'new-partner');
    const btnTask = makeButton('New Task', 'new-task');

    menu.append(btnContact, btnPartner, btnTask);
    wrap.appendChild(menu);

    btnContact.addEventListener('click', () => handleFabAction('contact'));
    btnPartner.addEventListener('click', () => handleFabAction('partner'));
    btnTask.addEventListener('click', () => handleFabAction('task'));
  } else if (!wrap.contains(menu)) {
    wrap.appendChild(menu);
  }

  if (!fab.__fabWired) {
    fab.__fabWired = true;
    fab.addEventListener('click', (event) => {
      event.preventDefault();
      toggleFabMenu();
    });
  }

  return { fab, menu };
}

function closeFabMenu() {
  const menu = document.getElementById(FAB_MENU_ID);
  const fab = document.getElementById(FAB_ID);
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  if (fab) fab.setAttribute('aria-expanded', 'false');
  if (fabState.outsideHandler) {
    document.removeEventListener('click', fabState.outsideHandler, true);
    fabState.outsideHandler = null;
  }
  if (fabState.keyHandler) {
    document.removeEventListener('keydown', fabState.keyHandler, true);
    fabState.keyHandler = null;
  }
}

function openFabMenu() {
  const elements = ensureFabElements();
  if (!elements) return;
  const { fab, menu } = elements;
  menu.hidden = false;
  fab.setAttribute('aria-expanded', 'true');
  if (!fabState.outsideHandler) {
    fabState.outsideHandler = (event) => {
      const target = event.target;
      if (!target) return;
      const menuEl = document.getElementById(FAB_MENU_ID);
      const fabEl = document.getElementById(FAB_ID);
      if (!menuEl || menuEl.hidden) return;
      if (menuEl.contains(target) || (fabEl && fabEl.contains(target))) return;
      closeFabMenu();
    };
    document.addEventListener('click', fabState.outsideHandler, true);
  }
  if (!fabState.keyHandler) {
    fabState.keyHandler = (event) => {
      if (event.key === 'Escape') {
        closeFabMenu();
      }
    };
    document.addEventListener('keydown', fabState.keyHandler, true);
  }
}

function toggleFabMenu(forceOpen) {
  const menu = document.getElementById(FAB_MENU_ID);
  if (forceOpen === true) {
    openFabMenu();
    return;
  }
  if (forceOpen === false) {
    closeFabMenu();
    return;
  }
  if (!menu || menu.hidden) {
    openFabMenu();
  } else {
    closeFabMenu();
  }
}

function ensureGlobalNewFab() {
  injectActionBarStyle();
  const bar = markActionbarHost();
  if (!bar) return;
  ensureFabElements();
}

function getSelectionStore() {
  if (typeof window === 'undefined') return null;
  const store = window.SelectionStore || null;
  return store && typeof store.get === 'function' ? store : null;
}

function inferSelectionScopes() {
  if (typeof document === 'undefined') return ['contacts'];
  const scopes = new Set();
  document.querySelectorAll('[data-selection-scope]').forEach((node) => {
    const scope = node.getAttribute('data-selection-scope');
    if (scope && scope.trim()) scopes.add(scope.trim());
  });
  if (!scopes.size) {
    scopes.add('contacts');
  }
  return Array.from(scopes);
}

function inferRowForSelection(scope, id) {
  if (typeof document === 'undefined') return null;
  const scopeKey = scope && scope.trim() ? scope.trim() : 'contacts';
  const idKey = String(id ?? '');
  if (!idKey) return null;
  const hosts = Array.from(document.querySelectorAll('[data-selection-scope]'));
  for (const host of hosts) {
    const hostScope = host.getAttribute && host.getAttribute('data-selection-scope');
    const normalizedScope = hostScope && hostScope.trim() ? hostScope.trim() : 'contacts';
    if (normalizedScope !== scopeKey) continue;
    const rows = Array.from(host.querySelectorAll('tr[data-id]'));
    const match = rows.find((row) => row.getAttribute && row.getAttribute('data-id') === idKey);
    if (match) return match;
  }
  return null;
}

function extractLabelFromRow(row) {
  if (!row) return '';
  const preferredAttrs = ['data-label', 'data-name', 'data-title'];
  for (const key of preferredAttrs) {
    const value = row.getAttribute(key);
    if (value && value.trim()) return value.trim();
  }
  const dataset = row.dataset || {};
  for (const key of ['label', 'name', 'title']) {
    const value = dataset[key];
    if (value && value.trim()) return value.trim();
  }
  const cell = row.querySelector('[data-field="name"], td');
  const text = cell && cell.textContent ? cell.textContent.trim() : '';
  return text || '';
}

function extractRecordFromRow(row, scope, id) {
  const base = { id: String(id ?? ''), scope: scope || 'contacts' };
  if (!row) return base;
  const dataset = row.dataset || {};
  const record = { ...base };
  Object.keys(dataset).forEach((key) => {
    if (!(key in record)) {
      record[key] = dataset[key];
    }
  });
  if (!record.label) {
    const label = extractLabelFromRow(row);
    if (label) record.label = label;
  }
  const summaryCell = row.querySelector('[data-field], td');
  if (summaryCell && summaryCell.textContent && !record.summary) {
    record.summary = summaryCell.textContent.trim();
  }
  return record;
}

function gatherSelectionFromStore() {
  const store = getSelectionStore();
  if (!store) return [];
  const scopes = inferSelectionScopes();
  const selection = [];
  const seen = new Set();
  scopes.forEach((scope) => {
    try {
      const ids = store.get(scope);
      if (!ids || typeof ids.forEach !== 'function') return;
      ids.forEach((value) => {
        const id = String(value ?? '');
        if (!id) return;
        const key = `${scope}::${id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const row = inferRowForSelection(scope, id);
        const label = extractLabelFromRow(row) || `${scope} #${id}`;
        const record = extractRecordFromRow(row, scope, id);
        selection.push({ id, scope, label, record });
      });
    } catch (err) {
      console.warn('[action-bar] selection read failed', err);
    }
  });
  return selection;
}

function gatherSelectionFromDom() {
  if (typeof document === 'undefined') return [];
  const nodes = Array.from(document.querySelectorAll('[data-role="select"]'));
  const selection = [];
  const seen = new Set();
  nodes.forEach((node) => {
    if (!node.checked) return;
    const scopeHost = typeof node.closest === 'function' ? node.closest('[data-selection-scope]') : null;
    const scope = scopeHost && scopeHost.getAttribute ? scopeHost.getAttribute('data-selection-scope') : 'contacts';
    const row = typeof node.closest === 'function' ? node.closest('tr[data-id]') : null;
    const id = row && row.getAttribute ? row.getAttribute('data-id') : null;
    if (!id) return;
    const scopeKey = scope && scope.trim() ? scope.trim() : 'contacts';
    const key = `${scopeKey}::${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    const label = extractLabelFromRow(row) || `${scopeKey} #${id}`;
    const record = extractRecordFromRow(row, scopeKey, id);
    selection.push({ id, scope: scopeKey, label, record });
  });
  return selection;
}

function gatherCurrentSelection() {
  const viaStore = gatherSelectionFromStore();
  if (viaStore.length) return viaStore;
  return gatherSelectionFromDom();
}

function ensureMergeHandler() {
  if (typeof document === 'undefined') return;
  const bar = markActionbarHost();
  if (!bar) return;
  const mergeBtn = bar.querySelector('[data-act="merge"]');
  if (!mergeBtn) return;
  if (mergeBtn.getAttribute('data-qa') !== 'action-merge') {
    mergeBtn.setAttribute('data-qa', 'action-merge');
  }
  if (mergeBtn.__mergeHandlerWired) return;
  const handler = (event) => {
    event.preventDefault();
    const disabled = mergeBtn.getAttribute('data-disabled') === '1'
      || mergeBtn.hasAttribute('disabled');
    if (disabled) return;
    const selection = gatherCurrentSelection();
    if (!Array.isArray(selection) || selection.length < 2) {
      mergeBtn.setAttribute('data-disabled', '1');
      mergeBtn.setAttribute('aria-disabled', 'true');
      mergeBtn.setAttribute('disabled', '');
      return;
    }
    try {
      openMergeModal(selection, { source: 'action-bar', event });
    } catch (err) {
      console.warn('[action-bar] merge modal failed', err);
    }
  };
  mergeBtn.addEventListener('click', handler);
  mergeBtn.__mergeHandlerWired = true;
}

function handleActionBarDataChanged() {
  ensureMergeHandler();
}

if (typeof document !== 'undefined') {
  registerDocumentListener('app:data:changed', handleActionBarDataChanged, { passive: true });
  registerDocumentListener('selection:ready', () => {
    ensureSelectionSubscription();
  }, { passive: true });
}

if (typeof window !== 'undefined') {
  ensureSelectionSubscription();
}

function handleFabAction(kind) {
  closeFabMenu();
  if (kind === 'contact') {
    if (window.QuickAddUnified && typeof window.QuickAddUnified.open === 'function') {
      window.QuickAddUnified.open('contact');
      return;
    }
    showToast('warn', 'Contact quick create unavailable');
    return;
  }
  if (kind === 'partner') {
    if (window.QuickAddUnified && typeof window.QuickAddUnified.open === 'function') {
      window.QuickAddUnified.open('partner');
      return;
    }
    if (window.CRM && typeof window.CRM.openPartnerQuickCreate === 'function') {
      window.CRM.openPartnerQuickCreate();
      return;
    }
    if (typeof window.openPartnerQuickCreate === 'function') {
      window.openPartnerQuickCreate();
      return;
    }
    showToast('warn', 'Partner quick create unavailable');
    return;
  }
  if (kind === 'task') {
    const taskHandlers = [
      window.CRM && window.CRM.openTaskQuickCreate,
      window.Tasks && window.Tasks.openQuickCreate,
      window.openTaskQuickCreate,
      window.renderTaskModal
    ].filter((fn) => typeof fn === 'function');
    if (taskHandlers.length) {
      try { taskHandlers[0](); }
      catch (_) {}
      return;
    }
    showToast('info', 'Tasks coming soon');
    return;
  }
}

export function ensurePartnersMergeButton() {
  markActionbarHost();
  injectActionBarStyle();
  ensureGlobalNewFab();
  const host = getActionsHost();
  if (!host) return null;
  let btn = document.getElementById(BUTTON_ID);
  if (btn) return btn;
  btn = document.createElement('button');
  btn.className = 'btn';
  btn.id = BUTTON_ID;
  btn.type = 'button';
  btn.textContent = 'Merge (Partners)';
  btn.disabled = true;
  btn.style.display = 'none';
  const mergeBtn = host.querySelector('[data-act="merge"]');
  if (mergeBtn && mergeBtn.nextSibling) {
    host.insertBefore(btn, mergeBtn.nextSibling);
  } else {
    host.appendChild(btn);
  }
  return btn;
}

export function setPartnersMergeState(options) {
  const btn = ensurePartnersMergeButton();
  if (!btn) return;
  const visible = !!(options && options.visible);
  const enabled = !!(options && options.enabled);
  btn.style.display = visible ? '' : 'none';
  btn.disabled = !enabled;
  if (visible) {
    btn.classList.toggle('disabled', !enabled);
    if (btn.classList && typeof btn.classList.toggle === 'function') {
      btn.classList.toggle('active', enabled);
    }
  } else if (btn.classList && typeof btn.classList.remove === 'function') {
    btn.classList.remove('active');
  }
}

export function onPartnersMerge(handler) {
  const btn = ensurePartnersMergeButton();
  if (!btn) return;
  if (btn.__partnersMergeWired) {
    btn.__partnersMergeHandler = handler;
    return;
  }
  btn.__partnersMergeWired = true;
  btn.__partnersMergeHandler = handler;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    if (typeof btn.__partnersMergeHandler === 'function') {
      btn.__partnersMergeHandler();
    }
  });
}

export function teardownActionBarWiring() {
  teardownAll();
}
