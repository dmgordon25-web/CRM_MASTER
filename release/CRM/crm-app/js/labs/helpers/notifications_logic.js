function isRecord(obj) {
  return obj && typeof obj === 'object';
}

function resolveNotifierFns() {
  if (typeof window === 'undefined') return {};
  const api = window.Notifier;
  const list = typeof api?.list === 'function'
    ? api.list.bind(api)
    : (() => {
      try { return Array.isArray(window.__NOTIF_QUEUE__) ? window.__NOTIF_QUEUE__.slice() : []; }
      catch (_) { return []; }
    });
  const onChanged = typeof api?.onChanged === 'function'
    ? api.onChanged.bind(api)
    : ((handler) => {
      if (typeof handler !== 'function') return () => {};
      try { window.addEventListener('notifications:changed', handler); }
      catch (_) { return () => {}; }
      return () => { try { window.removeEventListener('notifications:changed', handler); } catch (_) {} };
    });
  const bulkSetState = typeof api?.bulkSetState === 'function'
    ? api.bulkSetState.bind(api)
    : (() => {});

  return { list, onChanged, bulkSetState };
}

function isArchived(item) {
  return isRecord(item) && item.state === 'archived';
}

function isRead(item) {
  return isRecord(item) && item.state === 'read';
}

function getItemId(item, fallbackIndex) {
  if (!isRecord(item)) return '';
  const meta = isRecord(item.meta) ? item.meta : {};
  const candidates = [
    item.id,
    item.uuid,
    item.key,
    meta.id,
    meta.key,
    meta.uuid,
    meta.stateId,
    meta.queue && (meta.queue.id || meta.queue.key)
  ];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i];
    if (candidate == null) continue;
    const str = String(candidate).trim();
    if (str) return str;
  }
  if (item.ts != null) return `ts:${item.ts}`;
  if (meta.contactId && meta.type) return `${meta.type}|${meta.contactId}`;
  if (item.title) return `title:${item.title}`;
  if (fallbackIndex != null) return `idx:${fallbackIndex}`;
  return '';
}

function normalizeList(source) {
  if (!Array.isArray(source)) return [];
  const trimmed = source.filter((item) => !isArchived(item)).slice(-50);
  return trimmed.sort((a, b) => {
    const at = Number(a?.ts) || 0;
    const bt = Number(b?.ts) || 0;
    return bt - at;
  });
}

export function getNotificationsSnapshot() {
  const { list } = resolveNotifierFns();
  const source = typeof list === 'function' ? list() : [];
  const normalized = normalizeList(source);
  const unread = normalized.reduce((count, item) => (isRead(item) ? count : count + 1), 0);
  const withIds = normalized.map((item, index) => ({
    item,
    id: getItemId(item, index)
  })).filter((entry) => entry.id);
  return { items: withIds, unread };
}

export function markNotificationsRead(ids) {
  if (!Array.isArray(ids) || !ids.length) return;
  const { bulkSetState } = resolveNotifierFns();
  if (typeof bulkSetState !== 'function') return;
  try { bulkSetState(ids, 'read'); }
  catch (_err) { /* silent */ }
}

export function subscribeNotifications(handler) {
  if (typeof handler !== 'function') return () => {};
  const { onChanged } = resolveNotifierFns();
  if (typeof onChanged !== 'function') return () => {};
  try { return onChanged(handler); }
  catch (_err) { return () => {}; }
}
