/* eslint-disable no-console */
// Simple, durable notifier with stable queue shape + change events.
const EVT = "notifications:changed";
const KEY = "notifications:queue";

function safeParse(json) {
  try { return JSON.parse(json); } catch (_) { return null; }
}

function readStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = safeParse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (_) { return []; }
}

function writeStorage(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list || [])); } catch (_) {}
}

function normalizeIdValue(value) {
  if (value == null) return '';
  const normalized = String(value).trim();
  return normalized;
}

function normalizeStateValue(stateLike, metaLike, source) {
  const meta = metaLike && typeof metaLike === 'object' ? metaLike : {};
  const sourceObj = source && typeof source === 'object' ? source : {};
  const raw = stateLike ?? meta.state ?? (meta.archived === true ? 'archived' : null);
  let normalized = raw == null ? '' : String(raw).trim().toLowerCase();
  if (!normalized && (meta.read === true || sourceObj.read === true)) normalized = 'read';
  if (!normalized && sourceObj.archived === true) normalized = 'archived';
  if (normalized === 'archived') return 'archived';
  if (normalized === 'read') return 'read';
  return 'unread';
}

function applyState(target, state) {
  if (!target || typeof target !== 'object') return;
  const meta = target.meta && typeof target.meta === 'object' ? target.meta : (target.meta = {});
  meta.state = state;
  if ('read' in meta) delete meta.read;
  if ('archived' in meta) delete meta.archived;
  target.state = state;
}

function isArchived(item) {
  return !!(item && typeof item === 'object' && item.state === 'archived');
}

function shouldIncludeArchived(options) {
  if (options === true) return true;
  if (options && typeof options === 'object' && options.includeArchived === true) return true;
  return false;
}

function cloneListFrom(source) {
  if (!Array.isArray(source)) return [];
  const out = [];
  for (let i = 0; i < source.length; i += 1) {
    const clone = cloneNotification(source[i]);
    if (clone) out.push(clone);
  }
  return out;
}

function cloneNotification(item) {
  if (!item || typeof item !== 'object') return null;
  const meta = item.meta && typeof item.meta === 'object' ? Object.assign({}, item.meta) : {};
  const clone = Object.assign({}, item, { meta });
  return clone;
}

function normalizeItem(x) {
  if (!x || typeof x !== "object") return null;
  const id = x.id || x.uuid || x.key || String(Date.now() + Math.random());
  const ts = Number(x.ts || x.time || Date.now());
  const type = String(x.type || "info");
  const title = String(x.title || x.message || "");
  const meta = (x.meta && typeof x.meta === "object") ? Object.assign({}, x.meta) : {};
  const state = normalizeStateValue(x.state, meta, x);
  const item = { id, ts, type, title, meta };
  applyState(item, state);
  return item;
}

const Notifier = (function() {
  // In-memory cache; always keep an Array
  let queue = Array.isArray(window.__NOTIF_QUEUE__) ? window.__NOTIF_QUEUE__ : null;
  if (Array.isArray(queue)) {
    const normalized = queue.map(normalizeItem).filter(Boolean);
    queue.length = 0;
    Array.prototype.push.apply(queue, normalized);
  } else {
    queue = readStorage().map(normalizeItem).filter(Boolean);
    window.__NOTIF_QUEUE__ = queue; // keep a single reference
  }

  function emit() {
    writeStorage(queue);
    try { window.dispatchEvent(new CustomEvent(EVT)); } catch (_) {}
  }

  return {
    getCount(options) {
      if (!Array.isArray(queue)) return 0;
      if (shouldIncludeArchived(options)) return queue.length;
      let count = 0;
      for (let i = 0; i < queue.length; i += 1) {
        if (!isArchived(queue[i])) count += 1;
      }
      return count;
    },
    list(options) {
      if (!Array.isArray(queue)) return [];
      const includeArchived = shouldIncludeArchived(options);
      if (includeArchived) return cloneListFrom(queue);
      const filtered = [];
      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        if (!item || isArchived(item)) continue;
        const clone = cloneNotification(item);
        if (clone) filtered.push(clone);
      }
      return filtered;
    },
    push(item) {
      const n = normalizeItem(item);
      if (!n) return false;
      queue.push(n);
      emit(); return true;
    },
    replace(list) {
      const next = Array.isArray(list) ? list.map(normalizeItem).filter(Boolean) : [];
      if (!next.length && !queue.length) {
        queue.length = 0;
        emit();
        return queue.length;
      }
      const stateMap = new Map(queue.map(item => [item.id, item.state]));
      next.forEach(item => {
        const preserved = stateMap.get(item.id);
        if (preserved && preserved !== 'unread') {
          applyState(item, preserved);
        }
      });
      queue.length = 0;
      Array.prototype.push.apply(queue, next);
      emit();
      return queue.length;
    },
    remove(id) {
      if (!id) return false;
      const before = queue.length;
      // FIX: never use reduce on undefined
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i]?.id === id) queue.splice(i, 1);
      if (queue.length !== before) emit();
      return before !== queue.length;
    },
    clear() {
      if (!queue.length) return 0;
      const n = queue.length;
      queue.length = 0;
      emit(); return n;
    },
    onChanged(handler) {
      try { window.addEventListener(EVT, handler); } catch (_) {}
      return () => { try { window.removeEventListener(EVT, handler); } catch (_) {} };
    },
    setState(id, state) {
      const key = normalizeIdValue(id);
      if (!key) return false;
      const nextState = normalizeStateValue(state);
      let changed = false;
      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        if (!item || item.id !== key) continue;
        if (item.state !== nextState) {
          applyState(item, nextState);
          changed = true;
        }
        break;
      }
      if (changed) emit();
      return changed;
    },
    bulkSetState(ids, state, options) {
      const list = Array.isArray(ids) ? ids : [];
      if (!list.length) return this.list(options);
      const targets = new Set(list.map(normalizeIdValue).filter(Boolean));
      if (!targets.size) return this.list(options);
      const nextState = normalizeStateValue(state);
      let changed = false;
      for (let i = 0; i < queue.length; i += 1) {
        const item = queue[i];
        if (!item || !targets.has(item.id)) continue;
        if (item.state !== nextState) {
          applyState(item, nextState);
          changed = true;
        }
      }
      if (changed) emit();
      return this.list(options);
    }
  };
})();

// Expose a stable global and named exports
window.Notifier = window.Notifier || Notifier;
export const getNotificationsCount = (...args) => Notifier.getCount(...args);
export const listNotifications       = (...args) => Notifier.list(...args);
export const pushNotification        = (item) => Notifier.push(item);
export const replaceNotifications    = (list) => Notifier.replace(list);
export const removeNotification      = (id) => Notifier.remove(id);
export const clearNotifications      = () => Notifier.clear();
export const onNotificationsChanged  = (h) => Notifier.onChanged(h);
export const setNotificationState    = (id, state) => Notifier.setState(id, state);
export const setNotificationsState   = (ids, state, options) => Notifier.bulkSetState(ids, state, options);
export default Notifier;
