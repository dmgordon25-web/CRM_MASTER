import { listNotifications, onNotificationsChanged, replaceNotifications } from '../notifications/notifier.js';

if (!window.__WIRED_NOTIF_TAB_COUNT__) {
  window.__WIRED_NOTIF_TAB_COUNT__ = true;

  const raf = window.requestAnimationFrame || (cb => setTimeout(cb,16));

  let latest = [];

  function isRecord(obj) {
    return obj && typeof obj === 'object';
  }

  function cloneNotification(item) {
    if (!isRecord(item)) return null;
    const meta = isRecord(item.meta) ? item.meta : {};
    const copy = Object.assign({}, item);
    copy.meta = Object.assign({}, meta);
    if (copy.meta.read === true) copy.read = true;
    return copy;
  }

  function readNotifications() {
    try {
      const list = typeof listNotifications === 'function' ? listNotifications() : [];
      if (!Array.isArray(list)) return [];
      return list.map(cloneNotification).filter(Boolean);
    } catch (err) {
      console.warn('notifications panel: unable to read notifications', err);
      return [];
    }
  }

  function isRead(item) {
    if (!isRecord(item)) return false;
    if (item.read === true) return true;
    return item.meta && item.meta.read === true;
  }

  function unreadCount(list) {
    const source = Array.isArray(list) ? list : latest;
    let count = 0;
    for (let i = 0; i < source.length; i++) {
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
    host.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'muted';
    li.dataset.qa = 'notif-empty';
    li.textContent = 'No notifications';
    host.appendChild(li);
  }

  function renderList(list) {
    const panel = document.getElementById('notif-panel');
    const host = document.getElementById('notif-bell-list');
    if (!panel || !host) return;

    ensureBadgeDisplayCache();

    const items = Array.isArray(list) ? list : [];
    if (!items.length) {
      renderEmptyState(host);
      return;
    }

    const trimmed = items.slice(-50).sort((a, b) => {
      const at = Number(a?.ts) || 0;
      const bt = Number(b?.ts) || 0;
      return bt - at;
    });

    const frag = document.createDocumentFragment();
    for (let i = 0; i < trimmed.length; i++) {
      const item = trimmed[i];
      const li = document.createElement('li');
      li.dataset.id = String(item?.id || i);
      li.textContent = describe(item);
      if (!isRead(item)) li.classList.add('unread');
      frag.appendChild(li);
    }

    host.innerHTML = '';
    host.appendChild(frag);
  }

  function toast(message) {
    if (window.Toast && typeof window.Toast.info === 'function') {
      window.Toast.info(message);
      return;
    }
    if (window.Toast && typeof window.Toast.show === 'function') {
      window.Toast.show(message);
      return;
    }
    if (typeof window.toast === 'function') {
      window.toast(message);
    }
  }

  function persistReadAll(list) {
    if (!Array.isArray(list) || !list.length) return null;
    let changed = false;
    const next = list.map(item => {
      if (!isRecord(item)) return item;
      if (isRead(item)) return item;
      changed = true;
      const meta = isRecord(item.meta) ? Object.assign({}, item.meta) : {};
      meta.read = true;
      return Object.assign({}, item, { read: true, meta });
    });
    if (!changed) {
      console.info('notifications panel: mark-all read skipped; nothing unread');
      return null;
    }
    try {
      replaceNotifications(next);
      return next.map(cloneNotification).filter(Boolean);
    } catch (err) {
      console.warn('notifications panel: unable to persist mark-all read', err);
      return null;
    }
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
      const updated = persistReadAll(latest.slice());
      if (!updated) return;
      latest = updated;
      const unread = unreadCount(latest);
      updateBadge(unread);
      setTab(unread);
      renderList(latest);
      toast('All notifications marked read');
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
    latest = Array.isArray(list) ? list : readNotifications();
    const unread = unreadCount(latest);
    updateBadge(unread);
    setTab(unread);
    renderList(latest);
    ensureMarkAllButton();
  }

  function apply() {
    try {
      refresh();
    } catch (err) {
      console.warn('notifications panel: refresh failed', err);
    }
  }

  function init() {
    wireBell();
    wireDismiss();
    ensureMarkAllButton();
    refresh();
  }

  // Listen to our API event and general app updates
  onNotificationsChanged(apply);
  try { window.addEventListener("app:data:changed", apply); } catch (_) {}
  raf(() => raf(apply));

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
}
