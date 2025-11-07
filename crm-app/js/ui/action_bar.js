import { openMergeModal } from './merge_modal.js';
import { bindHeaderQuickAddOnce } from '../quick_add.js';
import { bindHeaderQuickCreateOnce } from './quick_create_menu.js';

const BUTTON_ID = 'actionbar-merge-partners';
const DATA_ACTION_NAME = 'clear';
const ACTION_BAR_STORAGE_KEY = 'actionbar:pos:1';

let actionBarDragInitLogged = false;
let actionBarDragInitGuard = false;
let actionBarFabRemovedLogged = false;

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
if (!('mergeReadyCount' in globalWiringState)) globalWiringState.mergeReadyCount = 0;
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

function ensureStyle(originId, cssText, legacyId) {
  if (typeof document === 'undefined') return null;
  const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
  if (!head || typeof head.appendChild !== 'function') return null;
  const selector = `style[data-origin="${originId}"]`;
  let style = typeof document.querySelector === 'function' ? document.querySelector(selector) : null;
  if (!style && legacyId && typeof document.getElementById === 'function') {
    style = document.getElementById(legacyId);
  }
  if (style) {
    if (style.getAttribute && style.getAttribute('data-origin') !== originId) {
      try { style.setAttribute('data-origin', originId); }
      catch (_) {}
    }
    if (typeof cssText === 'string' && style.textContent !== cssText) {
      style.textContent = cssText;
    }
    return style;
  }
  style = document.createElement('style');
  if (legacyId) style.id = legacyId;
  style.setAttribute('data-origin', originId);
  if (typeof cssText === 'string') {
    style.textContent = cssText;
  }
  head.appendChild(style);
  return style;
}

function postActionBarTelemetry(event, data) {
  if (!event) return;
  const payload = JSON.stringify({ event, ...(data && typeof data === 'object' ? data : {}) });
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    } catch (_) {}
  }
  if (typeof fetch === 'function') {
    try { fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    catch (_) {}
  }
}

function emitActionBarFabRemoved() {
  if (actionBarFabRemovedLogged) return;
  actionBarFabRemovedLogged = true;
  try { console && typeof console.info === 'function' && console.info('[VIS] action-bar plus removed'); }
  catch (_) {}
  postActionBarTelemetry('actionbar-plus-removed');
}

function announceActionBarDragReady() {
  if (actionBarDragInitLogged) return;
  actionBarDragInitLogged = true;
  try { console.info('[VIS] action-bar drag ready'); }
  catch (_) {}
  postActionBarTelemetry('actionbar-drag-ready');
}

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

function getActionBarRoot() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('actionbar');
}

function ensureActionBarPill(bar) {
  if (typeof document === 'undefined') return null;
  const root = bar || getActionBarRoot();
  if (!root) return null;
  let pill = root.querySelector('[data-role="actionbar-pill"]');
  if (!pill) {
    pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'actionbar-pill';
    pill.setAttribute('data-role', 'actionbar-pill');
    pill.setAttribute('aria-describedby', 'actionbar-pill-tooltip');
    pill.setAttribute('aria-label', '0 • Actions');
    pill.setAttribute('title', 'Select rows to activate actions');
    const label = document.createElement('span');
    label.setAttribute('data-role', 'pill-label');
    label.textContent = '0 • Actions';
    const tooltip = document.createElement('span');
    tooltip.id = 'actionbar-pill-tooltip';
    tooltip.setAttribute('data-role', 'pill-tooltip');
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    tooltip.textContent = 'Select rows to activate actions';
    pill.appendChild(label);
    pill.appendChild(tooltip);
    if (root.firstChild) {
      root.insertBefore(pill, root.firstChild);
    } else {
      root.appendChild(pill);
    }
  }
  if (!pill.__actionBarPillWired) {
    const handleBlur = () => {
      hideActionBarPillTooltip(pill);
    };
    pill.addEventListener('blur', handleBlur);
    pill.addEventListener('click', (event) => {
      if (!event) return;
      const barEl = getActionBarRoot();
      if (!barEl || barEl.getAttribute('data-minimized') !== '1') return;
      showActionBarPillTooltip(pill);
    });
    pill.addEventListener('keydown', (event) => {
      if (!event) return;
      const key = typeof event.key === 'string' ? event.key : '';
      const keyCode = typeof event.keyCode === 'number' ? event.keyCode : 0;
      const activate = key ? (key === 'Enter' || key === ' ') : (keyCode === 13 || keyCode === 32);
      if (!activate) return;
      const barEl = getActionBarRoot();
      if (!barEl || barEl.getAttribute('data-minimized') !== '1') return;
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      showActionBarPillTooltip(pill);
    });
    pill.__actionBarPillWired = true;
  }
  return pill;
}

function updateActionBarPillLabel(pill, count) {
  if (!pill) return;
  const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const text = `${numeric} • Actions`;
  const label = pill.querySelector('[data-role="pill-label"]');
  if (label && label.textContent !== text) {
    label.textContent = text;
  }
  pill.setAttribute('aria-label', text);
}

function hideActionBarPillTooltip(pill) {
  if (!pill) return;
  if (pill.hasAttribute('data-tip-visible')) {
    pill.removeAttribute('data-tip-visible');
  }
  const tooltip = pill.querySelector('[data-role="pill-tooltip"]');
  if (tooltip) {
    tooltip.setAttribute('aria-hidden', 'true');
  }
}

function showActionBarPillTooltip(pill) {
  if (!pill) return;
  pill.setAttribute('data-tip-visible', '1');
  const tooltip = pill.querySelector('[data-role="pill-tooltip"]');
  if (tooltip) {
    tooltip.setAttribute('aria-hidden', 'false');
  }
  if (typeof pill.focus === 'function') {
    pill.focus();
  }
}

function updateActionBarMinimizedState(count) {
  if (typeof document === 'undefined') return;
  const bar = getActionBarRoot();
  if (!bar) return;
  const pill = ensureActionBarPill(bar);
  const numeric = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (pill) {
    updateActionBarPillLabel(pill, numeric);
    if (numeric > 0) {
      hideActionBarPillTooltip(pill);
    }
  }
  const minimized = numeric <= 0;
  if (minimized) {
    if (bar.getAttribute('data-minimized') !== '1') {
      bar.setAttribute('data-minimized', '1');
    }
  } else if (bar.hasAttribute('data-minimized')) {
    bar.removeAttribute('data-minimized');
  }
  bar.setAttribute('aria-expanded', minimized ? 'false' : 'true');
}

function clearGlobalSelection(source = 'actionbar:esc') {
  if (typeof window === 'undefined') return false;
  let cleared = false;
  try {
    if (typeof window.Selection?.clear === 'function') {
      window.Selection.clear(source);
      cleared = true;
    }
  } catch (_) {}
  try {
    if (typeof window.SelectionService?.clear === 'function') {
      window.SelectionService.clear(source);
      cleared = true;
    }
  } catch (_) {}
  const store = getSelectionStore();
  if (store && typeof store.clear === 'function') {
    const scopes = inferSelectionScopes();
    scopes.forEach((scope) => {
      try {
        store.clear(scope);
        cleared = true;
      } catch (_) {}
    });
  }
  return cleared;
}

function handleActionBarKeydown(event) {
  if (!event) return;
  const key = typeof event.key === 'string' ? event.key : '';
  const keyCode = typeof event.keyCode === 'number' ? event.keyCode : 0;
  const isEscape = key ? (key === 'Escape' || key === 'Esc') : keyCode === 27;
  if (!isEscape) return;
  const count = globalWiringState.selectedCount || 0;
  if (count <= 0) {
    const pill = ensureActionBarPill();
    hideActionBarPillTooltip(pill);
    return;
  }
  const cleared = clearGlobalSelection('actionbar:esc');
  if (cleared && typeof event.preventDefault === 'function') {
    event.preventDefault();
  }
}

function applyMergeReadyFlag(count) {
  if (typeof document === 'undefined') return;
  const bar = document.getElementById('actionbar');
  if (!bar) return;
  const total = Number.isFinite(count) ? count : Number(count || 0);
  const ready = total >= 2;
  const nextValue = ready ? '1' : '0';
  if (bar.getAttribute('data-merge-ready') === nextValue) return;
  bar.setAttribute('data-merge-ready', nextValue);
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
  if (applyStoredActionBarPosition(bar)) {
    if (options.pulse !== false) {
      triggerActionBarPulse(bar);
    }
    return;
  }
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
  if (previous !== next) {
    globalWiringState.selectedCount = next;
    globalWiringState.mergeReadyCount = next;
  }
  applyMergeReadyFlag(next);
  updateActionBarMinimizedState(next);
  if (previous === next) return;
  handleSelectionTransition(previous, next);
  requestVisibilityRefresh();
}

function resetActionBarState() {
  globalWiringState.actionsReady = false;
  globalWiringState.selectedCount = 0;
  globalWiringState.mergeReadyCount = 0;
  applyMergeReadyFlag(0);
  restoreActionBarDock('silent');
  if (globalWiringState.routeState) {
    globalWiringState.routeState.hasCentered = false;
    globalWiringState.routeState.centerActive = false;
  }
  updateActionBarMinimizedState(0);
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
  const store = getSelectionStore();
  if (store && typeof store.subscribe === 'function') {
    try {
      const off = store.subscribe((snapshot) => {
        const scope = typeof snapshot?.scope === 'string' && snapshot.scope.trim()
          ? snapshot.scope.trim()
          : '';
        let ids = [];
        if (snapshot?.ids instanceof Set) {
          ids = Array.from(snapshot.ids, (value) => String(value ?? '')).filter(Boolean);
        } else if (Array.isArray(snapshot?.ids)) {
          ids = snapshot.ids.map((value) => String(value ?? '')).filter(Boolean);
        }
        const count = Number.isFinite(snapshot?.count) ? snapshot.count : ids.length;
        handleSelectionChanged({
          ids,
          count,
          scope,
          type: scope,
          source: 'store'
        });
      });
      globalWiringState.selectionOff = typeof off === 'function' ? off : null;
    } catch (_) { /* noop */ }
    if (globalWiringState.selectionOff && !globalWiringState.hasSelectionSnapshot) {
      const scopes = inferSelectionScopes();
      let activeScope = '';
      let ids = [];
      for (const candidate of scopes) {
        const scopeKey = typeof candidate === 'string' && candidate.trim() ? candidate.trim() : '';
        if (!scopeKey) continue;
        try {
          const snapshot = store.get(scopeKey);
          if (snapshot && typeof snapshot.forEach === 'function') {
            const list = [];
            snapshot.forEach((value) => {
              const id = String(value ?? '');
              if (id) list.push(id);
            });
            if (list.length) {
              ids = list;
              activeScope = scopeKey;
              break;
            }
          }
        } catch (_) { /* noop */ }
      }
      if (!activeScope && scopes.length) {
        const first = scopes[0];
        activeScope = typeof first === 'string' && first.trim() ? first.trim() : 'contacts';
      }
      handleSelectionChanged({
        ids,
        count: ids.length,
        scope: activeScope,
        type: activeScope,
        source: 'store-init'
      });
    }
  }
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

  const numeric = typeof selCount === 'number' && Number.isFinite(selCount)
    ? Math.max(0, Math.floor(selCount))
    : 0;
  const idleVisible = bar?.dataset?.idleVisible === '1';
  const hasSelections = numeric > 0;
  const shouldBeVisible = hasSelections || idleVisible;
  
  if (hasSelections) {
    // When we have selections, show the full action bar (not minimized)
    bar.setAttribute('data-visible', '1');
    bar.dataset.idleVisible = '1';
    // Ensure display is not none and visibility is proper
    if (bar.style) {
      if (bar.style.display === 'none') {
        bar.style.display = '';
      }
      bar.style.opacity = '1';
      bar.style.visibility = 'visible';
      bar.style.pointerEvents = 'auto';
    }
    // CRITICAL: Remove minimized state when we have selections
    if (bar.hasAttribute('data-minimized')) {
      bar.removeAttribute('data-minimized');
    }
    bar.setAttribute('aria-expanded', 'true');
  } else {
    // When count is 0, show the minimized pill (don't hide the bar completely)
    bar.removeAttribute('data-visible');
    bar.removeAttribute('data-idle-visible');
    // CRITICAL: Do NOT set display: none - let the minimized state show the pill
    // The CSS handles hiding the shell and showing the pill via data-minimized="1"
    if (bar.style) {
      if (bar.style.display === 'none') {
        bar.style.display = '';  // Remove display:none to allow pill to show
      }
      bar.style.opacity = '1';  // Keep visible for pill
      bar.style.visibility = 'visible';  // Keep visible for pill
      bar.style.pointerEvents = 'auto';  // Keep interactive for pill
    }
    // CRITICAL: Set minimized state when count is 0 to show the pill
    bar.setAttribute('data-minimized', '1');
    bar.setAttribute('aria-expanded', 'false');
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
  // Export updateActionBarMinimizedState for use by other modules
  window.updateActionBarMinimizedState = updateActionBarMinimizedState;
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
    if (typeof bar.removeAttribute === 'function') {
      bar.removeAttribute('data-visible');
    } else {
      bar.setAttribute('data-visible', '0');
    }
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
  } else if (applyStoredActionBarPosition(bar)) {
    /* position restored from storage */
  } else if (globalWiringState.routeState && globalWiringState.routeState.centerActive) {
    centerActionBarForRoute({ pulse: false, silent: true });
  }
  ensureActionBarDragHandles(bar);
  ensureHeaderQuickAddBinding();
  return bar;
}

function ensureHeaderQuickAddBinding() {
  if (typeof document === 'undefined') return;
  try {
    const bus = typeof window !== 'undefined' ? (window.AppBus || window.__APP_BUS__ || null) : null;
    bindHeaderQuickAddOnce(document, bus);
    bindHeaderQuickCreateOnce(document, bus);
  } catch (err) {
    try {
      console && typeof console.warn === 'function' && console.warn('[action-bar] quick-add bind failed', err);
    } catch (_) {}
  }
}

function initializeActionBar() {
  resetActionBarState();
  const bar = markActionbarHost();
  injectActionBarStyle();
  ensureActionBarFabRemoved(bar);
  ensureActionBarPill(bar);
  ensureMergeHandler();
  ensureSelectionSubscription();
  syncActionBarVisibility(0, bar);
  updateActionBarMinimizedState(globalWiringState.selectedCount || 0);
  ensureHeaderQuickAddBinding();
  registerDocumentListener('keydown', handleActionBarKeydown);
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
  updateActionBarMinimizedState(globalWiringState.selectedCount || 0);
  registerDocumentListener('click', trackLastActionBarClick, true);
  registerDocumentListener('app:view:changed', handleAppViewChanged);
  registerWindowListener('hashchange', handleRouteHashChange, { passive: true });
  handleRouteHashChange();
}

function injectActionBarStyle(){
  if (typeof document === 'undefined') return;
  if (document.getElementById('ab-inline-style')) return;
  ensureStyle('crm:action-bar', `
      #actionbar{
        position:fixed; left:50%; transform:translateX(-50%);
        bottom:16px; z-index:9999;
        max-width:960px; width:auto; padding:8px 12px;
        border-radius:12px; background:rgba(20,22,28,0.88); color:#fff;
        box-shadow:0 8px 24px rgba(0,0,0,.25);
      }
      #actionbar[data-minimized="1"]{
        top:72px; right:24px; left:auto; bottom:auto;
        transform:none; padding:0; background:transparent; box-shadow:none;
        border-radius:999px; pointer-events:auto; width:auto; max-width:none;
      }
      #actionbar[data-minimized="1"] .actionbar-shell{ display:none !important; }
      #actionbar [data-role="actionbar-pill"]{
        display:none; position:relative; align-items:center; gap:6px;
        padding:6px 12px; border-radius:999px; background:rgba(20,22,28,0.92);
        color:#fff; font-weight:600; font-size:0.85rem; letter-spacing:.01em;
        border:0; cursor:pointer; pointer-events:auto; box-shadow:0 8px 20px rgba(15,23,42,.28);
      }
      #actionbar [data-role="actionbar-pill"]:focus-visible{ outline:2px solid rgba(148,163,184,.85); outline-offset:2px; }
      #actionbar[data-minimized="1"] [data-role="actionbar-pill"]{ display:none; }
      #actionbar [data-role="actionbar-pill"] [data-role="pill-tooltip"]{
        position:absolute; top:calc(100% + 8px); right:0; background:rgba(15,23,42,0.95);
        color:#f8fafc; padding:6px 10px; border-radius:8px; font-size:12px;
        white-space:nowrap; box-shadow:0 12px 24px rgba(15,23,42,0.3);
        opacity:0; transform:translateY(-4px); transition:opacity .15s ease, transform .15s ease;
        pointer-events:none;
      }
      #actionbar [data-role="actionbar-pill"][data-tip-visible="1"] [data-role="pill-tooltip"]{
        opacity:1; transform:translateY(0);
      }
      #actionbar .actionbar-actions{ display:flex; gap:8px; align-items:center; justify-content:center; position:relative; }
      #actionbar .btn{ padding:6px 10px; font-size:0.95rem; border-radius:10px; }
      #actionbar .btn.disabled{ opacity:.45; pointer-events:none; }
      #actionbar .btn.active{ outline:2px solid rgba(255,255,255,.35); transform:translateY(-1px); }
    `, 'ab-inline-style');
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

function readStoredActionBarPosition() {
  if (typeof window === 'undefined') return null;
  const storage = window.localStorage;
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    const raw = storage.getItem(ACTION_BAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    const left = Number(parsed.left);
    const top = Number(parsed.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
    return { left, top };
  } catch (_) {
    return null;
  }
}

function persistActionBarPosition(position) {
  if (typeof window === 'undefined' || !position) return;
  const left = Number(position.left);
  const top = Number(position.top);
  if (!Number.isFinite(left) || !Number.isFinite(top)) return;
  const storage = window.localStorage;
  if (!storage || typeof storage.setItem !== 'function') return;
  try {
    storage.setItem(ACTION_BAR_STORAGE_KEY, JSON.stringify({ left, top }));
  } catch (_) {}
}

function applyStoredActionBarPosition(bar) {
  if (!bar) return false;
  const stored = readStoredActionBarPosition();
  if (!stored) return false;
  const rect = typeof bar.getBoundingClientRect === 'function' ? bar.getBoundingClientRect() : null;
  const width = rect && Number.isFinite(rect.width) && rect.width > 0
    ? rect.width
    : (typeof bar.offsetWidth === 'number' ? bar.offsetWidth : 0);
  const height = rect && Number.isFinite(rect.height) && rect.height > 0
    ? rect.height
    : (typeof bar.offsetHeight === 'number' ? bar.offsetHeight : 0);
  const viewportWidth = typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0
    ? window.innerWidth
    : null;
  const viewportHeight = typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0
    ? window.innerHeight
    : null;
  const effectiveWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const effectiveHeight = Number.isFinite(height) && height > 0 ? height : 0;
  const maxLeft = viewportWidth != null ? Math.max(0, viewportWidth - effectiveWidth) : stored.left;
  const maxTop = viewportHeight != null ? Math.max(0, viewportHeight - effectiveHeight) : stored.top;
  const left = viewportWidth != null ? clamp(stored.left, 0, maxLeft) : stored.left;
  const top = viewportHeight != null ? clamp(stored.top, 0, maxTop) : stored.top;
  applyManualPosition(bar, left, top);
  const state = globalWiringState.dragState;
  if (state) {
    state.hasManualPosition = true;
    state.lastPosition = { left, top };
    state.width = effectiveWidth;
    state.height = effectiveHeight;
  }
  const routeState = globalWiringState.routeState;
  if (routeState) {
    routeState.centerActive = false;
  }
  persistActionBarPosition({ left, top });
  return true;
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
  persistActionBarPosition(state.lastPosition);
}

function ensureActionBarDragHandles(bar) {
  if (!bar) return;
  const state = globalWiringState.dragState;
  if (!state) return;
  const handleTarget = bar;
  if (!handleTarget || typeof handleTarget.addEventListener !== 'function') return;
  if (state.wiredTarget && state.wiredTarget !== handleTarget && state.downHandler) {
    state.wiredTarget.removeEventListener('pointerdown', state.downHandler);
    state.wiredTarget = null;
    state.downHandler = null;
  }
  if (state.wiredTarget === handleTarget && state.downHandler) return;
  const handlePointerDown = (event) => {
    if (!event) return;
    const isPrimary = typeof event.isPrimary === 'boolean' ? event.isPrimary : true;
    if (!isPrimary) return;
    const btn = typeof event.button === 'number' ? event.button : 0;
    if (btn !== 0) return;
    if (bar.getAttribute('data-visible') !== '1') return;
    const target = event.target;
    if (target && typeof target.closest === 'function') {
      if (target.closest('button, [data-action], [data-act], a, input, select, textarea')) return;
    }
    const barEl = handleTarget;
    if (!barEl || !barEl.isConnected) return;
    const rect = typeof barEl.getBoundingClientRect === 'function' ? barEl.getBoundingClientRect() : null;
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
    dragState.shell = handleTarget;
    dragState.hasManualPosition = true;
    dragState.lastPosition = { left: rect.left, top: rect.top };
    const routeState = globalWiringState.routeState;
    if (routeState) {
      routeState.centerActive = false;
    }
    const moveHandler = (evt) => {
      if (!dragState.active || evt.pointerId !== dragState.pointerId) return;
      const primary = typeof evt.isPrimary === 'boolean' ? evt.isPrimary : true;
      if (!primary) return;
      const viewWidth = typeof window !== 'undefined' && typeof window.innerWidth === 'number'
        ? window.innerWidth
        : rect.right;
      const viewHeight = typeof window !== 'undefined' && typeof window.innerHeight === 'number'
        ? window.innerHeight
        : rect.bottom;
      const width = dragState.width || rect.width;
      const height = dragState.height || rect.height;
      const maxLeft = Math.max(0, viewWidth - width);
      const maxTop = Math.max(0, viewHeight - height);
      const rawLeft = evt.clientX - dragState.offsetX;
      const rawTop = evt.clientY - dragState.offsetY;
      const left = clamp(rawLeft, 0, maxLeft);
      const top = clamp(rawTop, 0, maxTop);
      applyManualPosition(barEl, left, top);
      dragState.lastPosition = { left, top };
      dragState.hasManualPosition = true;
      evt.preventDefault();
    };
    const finalize = () => {
      if (dragState.lastPosition) {
        persistActionBarPosition(dragState.lastPosition);
      }
      stopActionBarDrag();
    };
    const upHandler = (evt) => {
      if (evt.pointerId !== dragState.pointerId) return;
      finalize();
    };
    const cancelHandler = (evt) => {
      if (evt.pointerId !== dragState.pointerId) return;
      finalize();
    };
    dragState.moveHandler = moveHandler;
    dragState.upHandler = upHandler;
    dragState.cancelHandler = cancelHandler;
    handleTarget.addEventListener('pointermove', moveHandler);
    handleTarget.addEventListener('pointerup', upHandler);
    handleTarget.addEventListener('pointercancel', cancelHandler);
    if (typeof handleTarget.setPointerCapture === 'function') {
      try { handleTarget.setPointerCapture(event.pointerId); }
      catch (_) {}
    }
    try { console.info('[A_BEACON] actionbar:drag-start'); }
    catch (_) {}
  };
  handleTarget.addEventListener('pointerdown', handlePointerDown);
  state.wired = true;
  state.wiredTarget = handleTarget;
  state.downHandler = handlePointerDown;
}

export function initActionBarDrag() {
  if (actionBarDragInitGuard) return;
  if (typeof document === 'undefined') return;
  const bar = document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
  if (!bar) return;
  actionBarDragInitGuard = true;
  ensureActionBarDragHandles(bar);
  const dragState = globalWiringState.dragState;
  if (dragState && dragState.hasManualPosition && dragState.lastPosition) {
    const { left = 0, top = 0 } = dragState.lastPosition;
    applyManualPosition(bar, left, top);
  } else {
    applyStoredActionBarPosition(bar);
  }
  announceActionBarDragReady();
}

function getActionsHost() {
  const bar = typeof document !== 'undefined' ? document.getElementById('actionbar') : null;
  return bar ? bar.querySelector('.actionbar-actions') : null;
}

function ensureActionBarFabRemoved(bar) {
  if (typeof document === 'undefined') return;
  const root = bar || document.getElementById('actionbar');
  if (!root) return;
  const host = root.querySelector('.actionbar-actions') || root;
  const wrappers = host ? Array.from(host.querySelectorAll('.actionbar-fab')) : [];
  wrappers.forEach((wrap) => {
    const fab = wrap.querySelector('#global-new');
    if (fab) {
      try { fab.remove(); }
      catch (_) {}
    }
    if (!wrap.children.length) {
      wrap.remove();
    }
  });
  const strayFab = document.getElementById('global-new');
  if (strayFab) {
    try { strayFab.remove(); }
    catch (_) {}
  }
  if (!document.getElementById('global-new')) {
    emitActionBarFabRemoved();
  }
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

export function ensurePartnersMergeButton() {
  const bar = markActionbarHost();
  injectActionBarStyle();
  ensureActionBarFabRemoved(bar);
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
