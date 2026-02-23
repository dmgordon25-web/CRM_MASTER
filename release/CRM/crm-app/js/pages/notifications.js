import { listNotifications, clearNotifications, removeNotification, onNotificationsChanged } from '../notifications/notifier.js';

const SCOPE = 'notifications';

function getSelectionStore(){
  if(typeof window === 'undefined') return null;
  const store = window.SelectionStore;
  if(!store) return null;
  const valid = ['get','set','clear','subscribe'];
  for(const key of valid){
    if(typeof store[key] !== 'function') return null;
  }
  return store;
}

function toId(value){
  if(value == null) return '';
  return String(value);
}

function toSelectionSet(input){
  if(input instanceof Set){
    return new Set(Array.from(input, toId));
  }
  if(Array.isArray(input)){
    return new Set(input.map(toId));
  }
  if(input && typeof input === 'object' && Symbol.iterator in input){
    return new Set(Array.from(input, toId));
  }
  return new Set();
}

function syncSelectionState(listEl, ids){
  if(!listEl) return;
  const selected = toSelectionSet(ids);
  const rows = listEl.querySelectorAll('[data-selection-row][data-id]');
  rows.forEach((row) => {
    const id = row.getAttribute('data-id') || '';
    const isSelected = selected.has(id);
    row.classList.toggle('is-selected', isSelected);
    if(row.dataset){
      row.dataset.selected = isSelected ? '1' : '0';
    }
    const checkbox = row.querySelector('input[data-role="select"]');
    if(checkbox){
      checkbox.checked = isSelected;
    }
  });
}

function isArchived(item) {
  return !!(item && typeof item === 'object' && item.state === 'archived');
}

function onNodeRemoved(node, callback) {
  if (!node || typeof callback !== 'function' || typeof MutationObserver !== 'function') {
    return () => {};
  }
  let done = false;
  const observer = new MutationObserver(() => {
    if (done || node.isConnected) return;
    done = true;
    observer.disconnect();
    try { callback(); } catch (_) {}
  });
  observer.observe(node.ownerDocument?.body || document.body, { childList: true, subtree: true });
  return () => {
    if (done) return;
    done = true;
    observer.disconnect();
  };
}

function fmt(ts){
  if (!ts && ts !== 0) return '';
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return String(ts || '');
    return date.toLocaleString();
  } catch (_) {
    return String(ts || '');
  }
}

function createLayout(){
  const section = document.createElement('section');
  section.setAttribute('data-notifs', '');
  section.setAttribute('role', 'region');
  section.setAttribute('aria-label', 'Notifications');
  section.setAttribute('data-selection-scope', SCOPE);

  const header = document.createElement('header');
  header.style.display = 'flex';
  header.style.gap = '8px';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';

  const heading = document.createElement('h3');
  heading.style.margin = '0';
  heading.textContent = 'Notifications';
  header.appendChild(heading);

  const controls = document.createElement('div');
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.setAttribute('data-act', 'clear-notifications');
  clearBtn.textContent = 'Clear All';
  controls.appendChild(clearBtn);
  header.appendChild(controls);

  const list = document.createElement('div');
  list.className = 'list';
  list.style.marginTop = '12px';
  list.setAttribute('data-list', 'notifications');
  list.setAttribute('data-selection-scope', SCOPE);

  section.append(header, list);
  return { section, list, clearBtn };
}

function renderList(listEl, store){
  const items = listNotifications();
  const activeItems = Array.isArray(items) ? items.filter(item => !isArchived(item)) : [];
  const selection = store ? toSelectionSet(store.get(SCOPE)) : new Set();
  if (!activeItems.length) {
    const empty = document.createElement('div');
    empty.setAttribute('role', 'note');
    empty.textContent = 'No notifications yet. Workflow alerts and reminders will show up here.';
    listEl.replaceChildren(empty);
    if (store && selection.size) {
      try { store.clear(SCOPE); }
      catch (_) {}
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  const activeIds = new Set();

  activeItems.forEach((item, index) => {
    const fallbackId = `${item?.type || 'notif'}-${item?.ts ?? ''}-${item?.title || ''}-${index}`;
    const rawId = item && Object.prototype.hasOwnProperty.call(item, 'id') ? item.id : fallbackId;
    const id = toId(rawId);
    activeIds.add(id);

    const row = document.createElement('div');
    row.style.padding = '8px 0';
    row.style.borderBottom = '1px solid rgba(0,0,0,0.06)';
    row.setAttribute('data-selection-row', '');
    row.setAttribute('data-id', id);
    row.setAttribute('data-selection-scope', SCOPE);
    row.setAttribute('data-selection-type', SCOPE);
    if(row.dataset){
      row.dataset.name = item?.title || '';
      row.dataset.type = item?.type || '';
      row.dataset.channel = item?.channel || '';
    }

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.gap = '12px';
    header.style.alignItems = 'center';

    const leftWrap = document.createElement('div');
    leftWrap.style.display = 'flex';
    leftWrap.style.alignItems = 'center';
    leftWrap.style.gap = '12px';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('data-ui', 'row-check');
    checkbox.setAttribute('data-id', id);
    checkbox.checked = selection.has(id);
    leftWrap.appendChild(checkbox);

    const titleWrap = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item?.title || '(untitled notification)';
    titleWrap.appendChild(title);
    leftWrap.appendChild(titleWrap);

    const actionsWrap = document.createElement('div');
    actionsWrap.style.display = 'flex';
    actionsWrap.style.gap = '8px';
    actionsWrap.style.alignItems = 'center';

    const time = document.createElement('div');
    time.style.opacity = '0.7';
    time.textContent = fmt(item?.ts);
    actionsWrap.appendChild(time);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('data-act', 'notif-remove');
    removeBtn.setAttribute('data-id', id);
    removeBtn.textContent = 'Remove';
    actionsWrap.appendChild(removeBtn);

    header.append(leftWrap, actionsWrap);

    const metaLine = document.createElement('div');
    metaLine.style.fontSize = '12px';
    metaLine.style.opacity = '0.8';
    metaLine.textContent = item?.type || 'info';

    row.append(header, metaLine);
    fragment.appendChild(row);
  });

  listEl.replaceChildren(fragment);

  if (store) {
    const filtered = new Set(Array.from(selection).filter((id) => activeIds.has(id)));
    if (filtered.size !== selection.size) {
      try { store.set(filtered, SCOPE); }
      catch (_) {}
      syncSelectionState(listEl, filtered);
      return;
    }
  }

  syncSelectionState(listEl, selection);
}

export function renderNotifications(root){
  if (!root) return;

  if (typeof root.__notifCleanup === 'function') {
    try { root.__notifCleanup(); } catch (_) {}
  }

  const { section, list, clearBtn } = createLayout();
  root.replaceChildren(section);

  const store = getSelectionStore();

  const raf = window.requestAnimationFrame || ((cb) => setTimeout(cb, 16));
  const cancelRaf = window.cancelAnimationFrame || window.clearTimeout || clearTimeout;
  let frame = null;
  const apply = () => {
    if (frame !== null) return;
    frame = raf(() => {
      frame = null;
      try { renderList(list, store); } catch (_) {}
    });
  };

  const unsub = onNotificationsChanged(apply);
  const clearHandler = () => {
    try { clearNotifications(); } catch (_) {}
    try { store?.clear(SCOPE); } catch (_) {}
  };
  clearBtn.addEventListener('click', clearHandler);

  const clickHandler = (event) => {
    const btn = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-act="notif-remove"]')
      : null;
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    if (!id) return;
    removeNotification(id);
    if (store) {
      try {
        const next = store.get(SCOPE);
        if (next.delete(id)) {
          store.set(next, SCOPE);
        }
      } catch (_) {}
    }
  };
  section.addEventListener('click', clickHandler);

  const selectionUnsub = store
    ? store.subscribe((snapshot) => {
        if(!snapshot || snapshot.scope !== SCOPE) return;
        try { syncSelectionState(list, snapshot.ids); }
        catch (_) {}
      })
    : null;

  const cleanup = () => {
    if (typeof unsub === 'function') {
      try { unsub(); } catch (_) {}
    }
    if (typeof selectionUnsub === 'function') {
      try { selectionUnsub(); } catch (_) {}
    }
    clearBtn.removeEventListener('click', clearHandler);
    section.removeEventListener('click', clickHandler);
    if (frame !== null) {
      try { cancelRaf(frame); } catch (_) {}
    }
    frame = null;
  };

  root.__notifCleanup = cleanup;
  onNodeRemoved(section, cleanup);

  apply();
}

export function initNotifications(){
  const mount = document.getElementById('notif-center-list')
    || document.getElementById('notifications-shell')
    || document.getElementById('view-notifications')
    || document.getElementById('app-main')
    || document.getElementById('root');
  const view = mount?.closest('main');
  if (view && typeof view.classList?.remove === 'function') {
    view.classList.remove('hidden');
  }
  renderNotifications(mount);
}
