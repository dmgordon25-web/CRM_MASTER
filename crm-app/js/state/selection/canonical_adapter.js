const DEFAULT_SCOPE = 'contacts';

function toScope(scope) {
  if (typeof scope !== 'string') return DEFAULT_SCOPE;
  const trimmed = scope.trim();
  return trimmed ? trimmed : DEFAULT_SCOPE;
}

function toSelectionType(scope) {
  const key = toScope(scope);
  return key === 'partners' ? 'partners' : 'contacts';
}

function normalizeIds(ids) {
  if (!ids) return [];
  if (Array.isArray(ids)) {
    return ids.map((value) => String(value ?? '')).filter(Boolean);
  }
  if (ids instanceof Set) {
    return Array.from(ids, (value) => String(value ?? '')).filter(Boolean);
  }
  if (typeof ids[Symbol.iterator] === 'function') {
    return Array.from(ids, (value) => String(value ?? '')).filter(Boolean);
  }
  return [];
}

function safeWindow() {
  return typeof window !== 'undefined' ? window : undefined;
}

function safeDocument() {
  return typeof document !== 'undefined' ? document : undefined;
}

function getSelectionStore() {
  const win = safeWindow();
  const store = win && win.SelectionStore;
  if (!store) return null;
  const required = ['get', 'set', 'clear', 'count'];
  for (const key of required) {
    if (typeof store[key] !== 'function') return null;
  }
  return store;
}

function debugLog(message, meta) {
  const win = safeWindow();
  const env = win && win.__ENV__;
  if (!env || env.DEBUG !== true) return;
  try {
    if (typeof console !== 'undefined' && console && typeof console.debug === 'function') {
      console.debug('[selection]', message, meta);
    }
  } catch (_) {}
}

function syncSelectionApis(ids, scope, source) {
  const list = normalizeIds(ids);
  const win = safeWindow();
  const type = toSelectionType(scope);
  const origin = typeof source === 'string' && source.trim() ? source.trim() : 'selection:set';
  let applied = false;

  if (win) {
    const selection = win.Selection;
    if (selection && typeof selection.set === 'function') {
      try {
        selection.set(list, type, origin);
        applied = true;
      } catch (err) {
        debugLog('selection.set failed', { err, scope: toScope(scope), origin });
      }
    }

    const service = win.SelectionService;
    if (service && typeof service.set === 'function') {
      try {
        service.set(list, type, origin);
        applied = true;
      } catch (err) {
        debugLog('SelectionService.set failed', { err, scope: toScope(scope), origin });
      }
    }

    if (!applied && list.length === 0) {
      try { win.SelectionService?.clear?.(origin); }
      catch (_) {}
      try { win.Selection?.clear?.(origin); }
      catch (_) {}
    }
  }

  return list;
}

function setStoreIds(list, scope) {
  const store = getSelectionStore();
  if (!store) return;
  try {
    store.set(new Set(list), toScope(scope));
  } catch (err) {
    debugLog('SelectionStore.set failed', { err, scope: toScope(scope) });
  }
}

function clearStore(scope) {
  const store = getSelectionStore();
  if (!store) return;
  try {
    store.clear(toScope(scope));
  } catch (err) {
    debugLog('SelectionStore.clear failed', { err, scope: toScope(scope) });
  }
}

function readStoreIds(scope) {
  const store = getSelectionStore();
  if (!store) return [];
  try {
    const snapshot = store.get(toScope(scope));
    if (snapshot instanceof Set) {
      return Array.from(snapshot, (value) => String(value ?? '')).filter(Boolean);
    }
    if (Array.isArray(snapshot)) {
      return snapshot.map((value) => String(value ?? '')).filter(Boolean);
    }
    if (snapshot && typeof snapshot.forEach === 'function') {
      const list = [];
      snapshot.forEach((value) => {
        const id = String(value ?? '');
        if (id) list.push(id);
      });
      return list;
    }
  } catch (err) {
    debugLog('SelectionStore.get failed', { err, scope: toScope(scope) });
  }
  return [];
}

function readSelectionSnapshot(scope) {
  const win = safeWindow();
  if (!win) return [];
  try {
    const selection = win.Selection;
    if (selection && typeof selection.get === 'function') {
      const value = selection.get();
      if (value && typeof value === 'object' && Array.isArray(value.ids)) {
        return value.ids.map((id) => String(id ?? '')).filter(Boolean);
      }
    }
  } catch (err) {
    debugLog('Selection.get failed', { err, scope: toScope(scope) });
  }
  try {
    const compat = win.SelectionService;
    if (compat && typeof compat.getSelectedIds === 'function') {
      const ids = compat.getSelectedIds();
      if (Array.isArray(ids)) {
        return ids.map((id) => String(id ?? '')).filter(Boolean);
      }
    }
  } catch (err) {
    debugLog('SelectionService.getSelectedIds failed', { err, scope: toScope(scope) });
  }
  return [];
}

function normalizePayload(payload) {
  const scope = toScope(payload && payload.scope);
  const type = toSelectionType(scope);
  const ids = normalizeIds(payload && payload.ids);
  const count = Number.isFinite(payload && payload.count)
    ? Number(payload.count)
    : ids.length;
  const source = typeof payload?.source === 'string' && payload.source.trim()
    ? payload.source.trim()
    : 'selection:event';
  const detail = {
    type,
    ids,
    count,
    source,
    scope,
  };
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'ready')) {
    detail.ready = payload.ready === true;
  }
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'selection')) {
    detail.selection = payload.selection;
  }
  return detail;
}

export function emitSelectionChanged(payload) {
  const doc = safeDocument();
  if (!doc || typeof doc.dispatchEvent !== 'function') return null;
  const detail = normalizePayload(payload || {});
  try {
    doc.dispatchEvent(new CustomEvent('selection:changed', { detail }));
    debugLog('event:selection:changed', detail);
  } catch (err) {
    debugLog('selection:changed dispatch failed', { err, detail });
  }
  return detail;
}

export function set(ids, options = {}) {
  const scope = toScope(options.scope);
  const source = typeof options.source === 'string' && options.source.trim()
    ? options.source.trim()
    : 'selection:set';
  const list = syncSelectionApis(ids, scope, source);
  setStoreIds(list, scope);
  const payload = {
    type: toSelectionType(scope),
    ids: list,
    count: typeof options.count === 'number' ? options.count : list.length,
    source,
    scope,
  };
  if (options && Object.prototype.hasOwnProperty.call(options, 'ready')) {
    payload.ready = options.ready === true;
  }
  emitSelectionChanged(payload);
  return list;
}

export function selectMany(ids, options = {}) {
  const scope = toScope(options.scope);
  const base = new Set(get({ scope }));
  normalizeIds(ids).forEach((id) => base.add(id));
  return set(Array.from(base), { ...options, scope, source: options.source || 'selection:selectMany' });
}

export function selectOne(id, options = {}) {
  if (id == null) return get(options);
  const list = [String(id)];
  return selectMany(list, { ...options, source: options.source || 'selection:selectOne' });
}

export function clear(options = {}) {
  const scope = toScope(options.scope);
  const source = typeof options.source === 'string' && options.source.trim()
    ? options.source.trim()
    : 'selection:clear';
  syncSelectionApis([], scope, source);
  clearStore(scope);
  emitSelectionChanged({ type: toSelectionType(scope), ids: [], count: 0, source, scope });
  return [];
}

export function get(options = {}) {
  const scope = toScope(options.scope);
  const storeIds = readStoreIds(scope);
  if (storeIds.length) return storeIds;
  return readSelectionSnapshot(scope);
}

export default {
  selectMany,
  selectOne,
  set,
  clear,
  get,
  emitSelectionChanged,
};
