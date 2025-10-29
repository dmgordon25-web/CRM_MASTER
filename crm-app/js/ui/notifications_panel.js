import { listNotifications, onNotificationsChanged, setNotificationsState } from '../notifications/notifier.js';
import { toastInfo, toastSoftError } from './toast_helpers.js';

if (!window.__WIRED_NOTIF_TAB_COUNT__) {
  window.__WIRED_NOTIF_TAB_COUNT__ = true;

  const raf = window.requestAnimationFrame || (cb => setTimeout(cb, 16));

  let latest = [];
  let readErrorNotified = false;
  let persistErrorNotified = false;
  let refreshErrorNotified = false;

  function isRecord(obj) {
    return obj && typeof obj === 'object';
  }

  function cloneNotification(item) {
    if (!isRecord(item)) return null;
    const meta = isRecord(item.meta) ? item.meta : {};
    const copy = Object.assign({}, item);
    copy.meta = Object.assign({}, meta);
    return copy;
  }

  function readNotifications() {
    try {
      const list = typeof listNotifications === 'function' ? listNotifications() : [];
      if (!Array.isArray(list)) return [];
      readErrorNotified = false;
      return list.map(cloneNotification).filter(Boolean);
    } catch (err) {
      const label = 'notifications panel: unable to read notifications';
      if (!readErrorNotified) {
        readErrorNotified = true;
        toastSoftError(label, err, 'Unable to load notifications.');
      } else {
        try { console.warn(label, err); }
        catch (_) {}
      }
      return [];
    }
  }

  function isRead(item) {
    return isRecord(item) && item.state === 'read';
  }

  function isArchived(item) {
    return isRecord(item) && item.state === 'archived';
  }

  function unreadCount(list) {
    const source = Array.isArray(list) ? list : latest;
    let count = 0;
    for (let i = 0; i < source.length; i++) {
      if (isArchived(source[i])) continue;
      if (!isRead(source[i])) count += 1;
    }
    return count;
  }

  function setTab(n) {
    const sel = ['[data-nav="notifications"]','[data-tab="notifications"]','a[href="#notifications"]','.tab-notifications','#tab-notifications'];
    const tab = sel.map(s => document.querySelector(s)).find(Boolean);
    if (!tab) return;
    const base = "Notifications";
    tab.textContent = (n > 0) ? `${base}[${n}]` : base;
    tab.setAttribute("data-count", String(n || 0));
  }

  function updateBadge(count) {
    const badge = document.getElementById('notif-badge');
    if (!badge) return;
    const value = Number.isFinite(count) ? count : 0;
    badge.textContent = String(value);
    if (value > 0) {
      badge.style.display = badge.dataset.display || 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  }

  function ensureBadgeDisplayCache() {
    const badge = document.getElementById('notif-badge');
    if (badge && !badge.dataset.display) {
      const current = badge.style.display && badge.style.display !== 'none'
        ? badge.style.display
        : 'inline-block';
      badge.dataset.display = current;
    }
  }

  function describe(item) {
    if (!isRecord(item)) return '(notification)';
    if (item.title) return String(item.title);
    if (item.meta && typeof item.meta.title === 'string') return item.meta.title;
    return '(notification)';
  }

  function renderEmptyState(host) {
    if (!host) return;
    const li = document.createElement('li');
    li.className = 'muted';
    li.dataset.qa = 'notif-empty';
    li.textContent = 'No notifications';
    host.replaceChildren(li);
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

  function applyStateToItem(item, state) {
    if (!isRecord(item)) return false;
    const next = typeof state === 'string' ? state : '';
    if (!next || item.state === next) return false;
    item.state = next;
    if (!isRecord(item.meta)) item.meta = {};
    item.meta.state = next;
    if ('read' in item.meta) delete item.meta.read;
    if ('archived' in item.meta) delete item.meta.archived;
    return true;
  }

  function syncNotification(target, source) {
    if (!isRecord(target) || !isRecord(source)) return;
    target.id = source.id;
    target.ts = source.ts;
    target.type = source.type;
    target.title = source.title;
    target.state = source.state;
    target.meta = isRecord(source.meta) ? Object.assign({}, source.meta) : {};
  }

  function mergeLatest(nextList) {
    const source = Array.isArray(nextList) ? nextList : [];
    const prevMap = new Map();
    for (let i = 0; i < latest.length; i += 1) {
      const existing = latest[i];
      const key = getItemId(existing, i);
      if (key) prevMap.set(key, existing);
    }
    const seen = new Set();
    const merged = [];
    for (let i = 0; i < source.length; i += 1) {
      const normalized = cloneNotification(source[i]);
      if (!normalized) continue;
      const key = getItemId(normalized, i);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const existing = prevMap.get(key);
      if (existing) {
        syncNotification(existing, normalized);
        merged.push(existing);
        prevMap.delete(key);
      } else {
        merged.push(normalized);
      }
    }
    latest = merged;
  }

  const schedulePersistRead = (() => {
    const pending = new Set();
    let handle = null;
    const flush = () => {
      handle = null;
      if (!pending.size) return;
      const ids = Array.from(pending);
      pending.clear();
      try {
        setNotificationsState(ids, 'read');
        persistErrorNotified = false;
      } catch (err) {
        const label = 'notifications panel: unable to persist mark-all read';
        if (!persistErrorNotified) {
          persistErrorNotified = true;
          toastSoftError(label, err, 'Unable to mark notifications read.');
        } else {
          try { console.warn(label, err); }
          catch (_) {}
        }
        scheduleRefresh();
      }
    };
    return function enqueue(ids) {
      if (!Array.isArray(ids) || !ids.length) return;
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (!id) continue;
        pending.add(String(id));
      }
      if (handle !== null) return;
      handle = raf(flush);
    };
  })();

  let refreshHandle = null;
  function scheduleRefresh() {
    if (refreshHandle !== null) return;
    refreshHandle = raf(() => {
      refreshHandle = null;
      refresh();
    });
  }

  function renderList(list) {
    const panel = document.getElementById('notif-panel');
    const host = document.getElementById('notif-bell-list');
    if (!panel || !host) return;

    ensureBadgeDisplayCache();

    const items = Array.isArray(list) ? list.filter(item => !isArchived(item)) : [];
    if (!items.length) {
      renderEmptyState(host);
      return;
    }

    const trimmed = items.slice(-50).sort((a, b) => {
      const at = Number(a?.ts) || 0;
      const bt = Number(b?.ts) || 0;
      return bt - at;
    });

    const existing = new Map();
    const children = host.children;
    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (!(node instanceof HTMLElement)) continue;
      const key = node.dataset ? node.dataset.id : '';
      if (!key) continue;
      existing.set(key, node);
    }

    const frag = document.createDocumentFragment();
    const seen = new Set();
    for (let i = 0; i < trimmed.length; i += 1) {
      const item = trimmed[i];
      const key = getItemId(item, i);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      let li = existing.get(key);
      if (li) {
        existing.delete(key);
      } else {
        li = document.createElement('li');
      }
      li.dataset.id = key;
      const label = describe(item);
      if (li.textContent !== label) li.textContent = label;
      if (!isRead(item)) li.classList.add('unread');
      else li.classList.remove('unread');
      frag.appendChild(li);
    }

    existing.forEach((node) => {
      try { node.remove(); }
      catch (_) {
        if (node && node.parentNode) {
          try { node.parentNode.removeChild(node); }
          catch (__err) {}
        }
      }
    });

    host.replaceChildren(frag);
  }

  function persistReadAll() {
    if (!Array.isArray(latest) || !latest.length) return false;
    const unreadIds = [];
    let mutated = false;
    for (let i = 0; i < latest.length; i += 1) {
      const item = latest[i];
      if (!isRecord(item) || isRead(item) || isArchived(item)) continue;
      const id = getItemId(item, i);
      if (!id) continue;
      unreadIds.push(id);
      if (applyStateToItem(item, 'read')) mutated = true;
    }
    if (!unreadIds.length) {
      console.info('notifications panel: mark-all read skipped; nothing unread');
      return false;
    }
    schedulePersistRead(unreadIds);
    return mutated;
  }

  function ensureMarkAllButton() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const header = panel.querySelector('.row');
    const existing = panel.querySelector('[data-qa="notif-mark-all-read"]');
    if (existing) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.dataset.qa = 'notif-mark-all-read';
    btn.textContent = 'Mark all read';
    const target = header || panel;
    if (header) {
      header.insertBefore(btn, header.querySelector('#btn-clear-notifs'));
    } else {
      target.appendChild(btn);
    }
    btn.addEventListener('click', () => {
      const changed = persistReadAll();
      if (!changed) return;
      const unread = unreadCount(latest);
      updateBadge(unread);
      setTab(unread);
      renderList(latest);
      toastInfo('All notifications marked read');
    });
  }

  function togglePanel(show) {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    const shouldShow = typeof show === 'boolean'
      ? show
      : panel.classList.contains('hidden') || panel.hidden;
    if (shouldShow) {
      panel.classList.remove('hidden');
      panel.hidden = false;
      renderList(latest);
    } else {
      panel.classList.add('hidden');
      panel.hidden = true;
    }
  }

  function wireBell() {
    const bell = document.getElementById('notif-bell');
    if (!bell || bell.__notifPanel) return;
    bell.__notifPanel = true;
    bell.addEventListener('click', evt => {
      evt.preventDefault();
      togglePanel();
    });
  }

  function wireDismiss() {
    const bell = document.getElementById('notif-bell');
    const panel = document.getElementById('notif-panel');
    if (!panel || panel.__notifDismiss) return;
    panel.__notifDismiss = true;
    document.addEventListener('click', evt => {
      const target = evt.target;
      if (!panel || panel.hidden) return;
      if (panel.contains(target)) return;
      if (bell && (bell === target || bell.contains(target))) return;
      togglePanel(false);
    });
  }

  function refresh(list) {
    try {
      const source = Array.isArray(list) ? list : readNotifications();
      mergeLatest(source);
      const unread = unreadCount(latest);
      updateBadge(unread);
      setTab(unread);
      renderList(latest);
      ensureMarkAllButton();
      refreshErrorNotified = false;
    } catch (err) {
      const label = 'notifications panel: refresh failed';
      if (!refreshErrorNotified) {
        refreshErrorNotified = true;
        toastSoftError(label, err, 'Unable to refresh notifications.');
      } else {
        try { console.warn(label, err); }
        catch (_) {}
      }
    }
  }

  function init() {
    wireBell();
    wireDismiss();
    ensureMarkAllButton();
    scheduleRefresh();
  }

  // Listen to our API event and general app updates
  const onChange = () => scheduleRefresh();
  onNotificationsChanged(onChange);
  try { window.addEventListener('app:data:changed', onChange); } catch (_) {}
  raf(() => scheduleRefresh());

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
}
