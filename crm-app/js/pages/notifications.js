import {
  listNotifications,
  clearNotifications,
  onNotificationsChanged,
  setNotificationState,
  setNotificationsState
} from '../notifications/notifier.js';
import { clearSelectionForSurface } from '../services/selection_reset.js';
import { isFeatureEnabled } from '../settings/flags.js';

const SCOPE = 'notifications';
const FILTERS = [
  { key: 'all', label: 'All notifications', predicate: () => true },
  { key: 'unread', label: 'Unread', predicate: (item) => item && item.state !== 'read' },
  { key: 'read', label: 'Read', predicate: (item) => item && item.state === 'read' }
];
const FILTER_MAP = new Map(FILTERS.map((entry) => [entry.key, entry]));
const DEFAULT_SELECTION_MESSAGE = 'Select notifications to mark read or archive.';

function normalizeId(value) {
  if (value == null) return '';
  const str = String(value).trim();
  return str;
}

function fmt(ts) {
  if (ts == null) return '';
  try {
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return String(ts);
    return date.toLocaleString();
  } catch (_) {
    return String(ts);
  }
}

function ensureSet(value) {
  if (value instanceof Set) {
    return new Set(Array.from(value, (entry) => String(entry)));
  }
  if (Array.isArray(value)) {
    return new Set(value.map((entry) => String(entry)));
  }
  if (value && typeof value.forEach === 'function') {
    const out = new Set();
    try { value.forEach((entry) => out.add(String(entry))); } catch (_) {}
    return out;
  }
  return new Set();
}

function getSelectionStore() {
  if (typeof window === 'undefined') return null;
  return window.SelectionStore || null;
}

function resolveFilterKey(key) {
  const str = typeof key === 'string' ? key.trim() : '';
  return FILTER_MAP.has(str) ? str : 'all';
}

function updateCounts(state, total, visible) {
  const el = state.elements.countEl;
  if (!el) return;
  if (!total) {
    el.textContent = 'No notifications';
    return;
  }
  if (visible === total) {
    el.textContent = total === 1 ? '1 notification' : `${visible} notifications`;
    return;
  }
  el.textContent = `Showing ${visible} of ${total}`;
}

function updateSelectionInfo(state, selectedCount) {
  const info = state.elements.selectionInfo;
  if (info) {
    info.textContent = selectedCount ? `${selectedCount} selected` : DEFAULT_SELECTION_MESSAGE;
  }
  const disable = !selectedCount;
  const { markReadBtn, markUnreadBtn, archiveBtn } = state.elements;
  if (markReadBtn) markReadBtn.disabled = disable;
  if (markUnreadBtn) markUnreadBtn.disabled = disable;
  if (archiveBtn) archiveBtn.disabled = disable;
}

function renderRows(state, items, selection) {
  const tbody = state.elements.tbody;
  if (!tbody) return;
  const doc = tbody.ownerDocument || document;
  if (!Array.isArray(items) || !items.length) {
    const row = doc.createElement('tr');
    const cell = doc.createElement('td');
    cell.colSpan = 6;
    cell.className = 'muted';
    cell.textContent = 'No notifications match this filter.';
    row.appendChild(cell);
    tbody.replaceChildren(row);
    if (state.elements.selectAll) {
      state.elements.selectAll.checked = false;
      state.elements.selectAll.indeterminate = false;
      state.elements.selectAll.disabled = true;
    }
    state.visibleIds = [];
    return;
  }

  const fragment = doc.createDocumentFragment();
  const visible = [];
  items.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const id = normalizeId(item.id);
    if (!id) return;
    visible.push(id);
    const row = doc.createElement('tr');
    row.setAttribute('data-id', id);
    row.dataset.state = item.state || '';

    const selectCell = doc.createElement('td');
    selectCell.dataset.column = 'select';
    selectCell.dataset.compact = '1';
    const checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('data-role', 'select');
    checkbox.setAttribute('data-id', id);
    checkbox.setAttribute('aria-label', `Select ${item.title || 'notification'}`);
    checkbox.dataset.ui = 'row-check';
    checkbox.checked = selection.has(id);
    selectCell.appendChild(checkbox);
    row.appendChild(selectCell);

    const titleCell = doc.createElement('td');
    titleCell.dataset.column = 'title';
    const strong = doc.createElement('strong');
    strong.textContent = item.title || '(untitled notification)';
    titleCell.appendChild(strong);
    row.appendChild(titleCell);

    const typeCell = doc.createElement('td');
    typeCell.dataset.column = 'type';
    typeCell.textContent = item.type || 'info';
    row.appendChild(typeCell);

    const timeCell = doc.createElement('td');
    timeCell.dataset.column = 'received';
    timeCell.textContent = fmt(item.ts);
    row.appendChild(timeCell);

    const statusCell = doc.createElement('td');
    statusCell.dataset.column = 'status';
    statusCell.textContent = item.state === 'read' ? 'Read' : 'Unread';
    row.appendChild(statusCell);

    const actionsCell = doc.createElement('td');
    actionsCell.dataset.column = 'actions';
    actionsCell.style.whiteSpace = 'nowrap';

    const toggleBtn = doc.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn subtle';
    toggleBtn.setAttribute('data-id', id);
    if (item.state === 'read') {
      toggleBtn.setAttribute('data-act', 'mark-unread');
      toggleBtn.textContent = 'Mark unread';
    } else {
      toggleBtn.setAttribute('data-act', 'mark-read');
      toggleBtn.textContent = 'Mark read';
    }
    actionsCell.appendChild(toggleBtn);

    const archiveBtn = doc.createElement('button');
    archiveBtn.type = 'button';
    archiveBtn.className = 'btn subtle';
    archiveBtn.setAttribute('data-id', id);
    archiveBtn.setAttribute('data-act', 'archive');
    archiveBtn.textContent = 'Archive';
    actionsCell.appendChild(archiveBtn);

    row.appendChild(actionsCell);
    fragment.appendChild(row);
  });

  tbody.replaceChildren(fragment);
  state.visibleIds = visible;
  const selectAll = state.elements.selectAll;
  if (selectAll) {
    const total = visible.length;
    const selectedVisible = visible.filter((id) => selection.has(id)).length;
    selectAll.disabled = total === 0;
    selectAll.checked = total > 0 && selectedVisible === total;
    selectAll.indeterminate = total > 0 && selectedVisible > 0 && selectedVisible < total;
  }
}

function syncSelection(state, selection) {
  const tbody = state.elements.tbody;
  if (!tbody) return;
  const checkboxes = tbody.querySelectorAll('input[data-role="select"]');
  checkboxes.forEach((checkbox) => {
    const id = checkbox.getAttribute('data-id');
    const shouldCheck = selection.has(id);
    if (checkbox.checked !== shouldCheck) checkbox.checked = shouldCheck;
  });
  const selectAll = state.elements.selectAll;
  if (selectAll) {
    const visible = Array.isArray(state.visibleIds) ? state.visibleIds : [];
    const total = visible.length;
    const selectedVisible = visible.filter((id) => selection.has(id)).length;
    selectAll.disabled = total === 0;
    selectAll.checked = total > 0 && selectedVisible === total;
    selectAll.indeterminate = total > 0 && selectedVisible > 0 && selectedVisible < total;
  }
  updateSelectionInfo(state, selection.size);
}

function pruneSelection(state) {
  const store = ensureSelectionStore(state);
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') return;
  const current = ensureSet(store.get(SCOPE));
  if (!current.size) return;
  const allowed = new Set((state.items || []).map((item) => normalizeId(item.id)).filter(Boolean));
  const filtered = Array.from(current).filter((id) => allowed.has(id));
  if (filtered.length !== current.size) {
    store.set(filtered, SCOPE);
  }
}

function gatherSelectedIds(state) {
  const store = ensureSelectionStore(state);
  if (!store || typeof store.get !== 'function') return [];
  const set = ensureSet(store.get(SCOPE));
  return Array.from(set);
}

function clearSurfaceSelection(reason) {
  try { clearSelectionForSurface(SCOPE, { reason }); } catch (_) {}
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

function resolveMount(explicit) {
  if (explicit && typeof explicit.querySelector === 'function') return explicit;
  if (typeof document === 'undefined') return null;
  const shell = document.getElementById('notifications-shell');
  if (shell) return shell;
  const view = document.getElementById('view-notifications');
  if (view) {
    const within = view.querySelector('#notifications-shell');
    if (within) return within;
    return view;
  }
  return document.getElementById('app-main') || document.getElementById('root');
}

function ensureSelectionStore(state) {
  if (state.store) return state.store;
  const store = getSelectionStore();
  if (!store) return null;
  state.store = store;
  if (typeof store.subscribe === 'function' && !state.storeOff) {
    state.storeOff = store.subscribe((snapshot) => {
      if (!snapshot || snapshot.scope !== SCOPE) return;
      const ids = ensureSet(snapshot.ids);
      syncSelection(state, ids);
    });
  }
  return store;
}

function readActiveNotifications() {
  try {
    const list = listNotifications({ includeArchived: true });
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item === 'object' && item.state !== 'archived')
      .map((item) => ({ ...item, id: normalizeId(item.id) }))
      .filter((item) => item.id)
      .sort((a, b) => {
        const at = Number(a.ts || 0);
        const bt = Number(b.ts || 0);
        if (bt !== at) return bt - at;
        const titleCmp = String(a.title || '').localeCompare(String(b.title || ''));
        if (titleCmp !== 0) return titleCmp;
        return a.id.localeCompare(b.id);
      });
  } catch (err) {
    try { console.warn('[notifications] list failed', err); } catch (_) {}
    return [];
  }
}

function buildShell(root) {
  const doc = root.ownerDocument || document;
  root.classList.add('card');
  root.setAttribute('data-view', 'notifications');

  const header = doc.createElement('div');
  header.className = 'row';
  header.style.alignItems = 'center';
  header.style.gap = '12px';

  const heading = doc.createElement('h2');
  heading.textContent = 'Notifications';
  heading.style.margin = '0';
  header.appendChild(heading);

  const count = doc.createElement('span');
  count.className = 'muted';
  header.appendChild(count);

  const spacer = doc.createElement('div');
  spacer.className = 'grow';
  header.appendChild(spacer);

  const clearBtn = doc.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn danger';
  clearBtn.setAttribute('data-act', 'clear-all');
  clearBtn.textContent = 'Clear All';
  header.appendChild(clearBtn);

  const filtersRow = doc.createElement('div');
  filtersRow.className = 'row';
  filtersRow.style.alignItems = 'center';
  filtersRow.style.gap = '12px';
  filtersRow.style.margin = '12px 0';

  const filterLabel = doc.createElement('label');
  filterLabel.className = 'row';
  filterLabel.style.alignItems = 'center';
  filterLabel.style.gap = '8px';
  const filterText = doc.createElement('span');
  filterText.textContent = 'Filter';
  filterLabel.appendChild(filterText);
  const filterSelect = doc.createElement('select');
  filterSelect.setAttribute('data-role', 'filter');
  FILTERS.forEach((entry) => {
    const option = doc.createElement('option');
    option.value = entry.key;
    option.textContent = entry.label;
    filterSelect.appendChild(option);
  });
  filterSelect.value = 'all';
  filterLabel.appendChild(filterSelect);
  filtersRow.appendChild(filterLabel);

  const bulkRow = doc.createElement('div');
  bulkRow.className = 'row';
  bulkRow.style.alignItems = 'center';
  bulkRow.style.gap = '8px';
  bulkRow.style.margin = '0 0 12px';

  const selectionInfo = doc.createElement('span');
  selectionInfo.className = 'muted';
  selectionInfo.textContent = DEFAULT_SELECTION_MESSAGE;
  bulkRow.appendChild(selectionInfo);

  const markReadBtn = doc.createElement('button');
  markReadBtn.type = 'button';
  markReadBtn.className = 'btn subtle';
  markReadBtn.setAttribute('data-act', 'mark-selected-read');
  markReadBtn.textContent = 'Mark selected read';
  markReadBtn.disabled = true;
  bulkRow.appendChild(markReadBtn);

  const markUnreadBtn = doc.createElement('button');
  markUnreadBtn.type = 'button';
  markUnreadBtn.className = 'btn subtle';
  markUnreadBtn.setAttribute('data-act', 'mark-selected-unread');
  markUnreadBtn.textContent = 'Mark selected unread';
  markUnreadBtn.disabled = true;
  bulkRow.appendChild(markUnreadBtn);

  const archiveBtn = doc.createElement('button');
  archiveBtn.type = 'button';
  archiveBtn.className = 'btn subtle';
  archiveBtn.setAttribute('data-act', 'archive-selected');
  archiveBtn.textContent = 'Archive selected';
  archiveBtn.disabled = true;
  bulkRow.appendChild(archiveBtn);

  const tableWrap = doc.createElement('div');
  tableWrap.className = 'table-wrap';
  tableWrap.style.overflowX = 'auto';

  const table = doc.createElement('table');
  table.className = 'table list-table table-managed';
  table.setAttribute('data-selection-scope', SCOPE);
  table.id = 'notifications-table';

  const thead = doc.createElement('thead');
  const headRow = doc.createElement('tr');

  const selectTh = doc.createElement('th');
  selectTh.dataset.column = 'select';
  selectTh.dataset.compact = '1';
  const selectAll = doc.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.setAttribute('data-role', 'select-all');
  selectAll.setAttribute('aria-label', 'Select all notifications');
  selectTh.appendChild(selectAll);
  headRow.appendChild(selectTh);

  const titleTh = doc.createElement('th');
  titleTh.dataset.column = 'title';
  titleTh.textContent = 'Title';
  headRow.appendChild(titleTh);

  const typeTh = doc.createElement('th');
  typeTh.dataset.column = 'type';
  typeTh.textContent = 'Type';
  headRow.appendChild(typeTh);

  const receivedTh = doc.createElement('th');
  receivedTh.dataset.column = 'received';
  receivedTh.textContent = 'Received';
  headRow.appendChild(receivedTh);

  const statusTh = doc.createElement('th');
  statusTh.dataset.column = 'status';
  statusTh.textContent = 'Status';
  headRow.appendChild(statusTh);

  const actionsTh = doc.createElement('th');
  actionsTh.dataset.column = 'actions';
  actionsTh.textContent = 'Actions';
  headRow.appendChild(actionsTh);

  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = doc.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);

  root.replaceChildren(header, filtersRow, bulkRow, tableWrap);

  return {
    header,
    countEl: count,
    filterSelect,
    selectionInfo,
    markReadBtn,
    markUnreadBtn,
    archiveBtn,
    table,
    tbody,
    selectAll,
    clearBtn
  };
}

function ensureState(root) {
  if (!root) return null;
  if (root.__notificationsState) return root.__notificationsState;
  const state = {
    root,
    filter: 'all',
    items: [],
    filtered: [],
    visibleIds: [],
    store: null,
    storeOff: null,
    unsubscribe: null,
    cleaned: false,
    elements: buildShell(root)
  };

  const handleFilterChange = (event) => {
    const value = event && event.target ? event.target.value : null;
    state.filter = resolveFilterKey(value);
    update(state);
  };
  state.elements.filterSelect.addEventListener('change', handleFilterChange);
  state.onFilterChange = handleFilterChange;

  const handleClick = (event) => {
    const trigger = event.target && typeof event.target.closest === 'function'
      ? event.target.closest('[data-act]')
      : null;
    if (!trigger) return;
    const act = trigger.getAttribute('data-act');
    if (!act) return;
    event.preventDefault();
    if (act === 'clear-all') {
      try { clearNotifications(); }
      catch (err) { try { console.warn('[notifications] clear failed', err); } catch (_) {} }
      clearSurfaceSelection('notifications:clear-all');
      return;
    }
    if (act === 'mark-selected-read' || act === 'mark-selected-unread' || act === 'archive-selected') {
      const ids = gatherSelectedIds(state);
      if (!ids.length) return;
      try {
        if (act === 'mark-selected-read') {
          setNotificationsState(ids, 'read');
        } else if (act === 'mark-selected-unread') {
          setNotificationsState(ids, 'unread');
        } else {
          setNotificationsState(ids, 'archived');
          clearSurfaceSelection('notifications:archive-selected');
        }
      } catch (err) {
        try { console.warn('[notifications] bulk action failed', err); } catch (_) {}
      }
      return;
    }
    const id = trigger.getAttribute('data-id');
    if (!id) return;
    if (act === 'mark-read') {
      try { setNotificationState(id, 'read'); } catch (err) { try { console.warn('[notifications] mark read failed', err); } catch (_) {} }
      return;
    }
    if (act === 'mark-unread') {
      try { setNotificationState(id, 'unread'); } catch (err) { try { console.warn('[notifications] mark unread failed', err); } catch (_) {} }
      return;
    }
    if (act === 'archive') {
      try { setNotificationState(id, 'archived'); } catch (err) { try { console.warn('[notifications] archive failed', err); } catch (_) {} }
    }
  };
  root.addEventListener('click', handleClick);
  state.onClick = handleClick;

  state.unsubscribe = onNotificationsChanged(() => update(state));
  ensureSelectionStore(state);

  state.cleanup = () => {
    if (state.cleaned) return;
    state.cleaned = true;
    if (state.unsubscribe) {
      try { state.unsubscribe(); } catch (_) {}
      state.unsubscribe = null;
    }
    if (state.storeOff) {
      try { state.storeOff(); } catch (_) {}
      state.storeOff = null;
    }
    if (state.onFilterChange) {
      try { state.elements.filterSelect.removeEventListener('change', state.onFilterChange); } catch (_) {}
      state.onFilterChange = null;
    }
    if (state.onClick) {
      try { root.removeEventListener('click', state.onClick); } catch (_) {}
      state.onClick = null;
    }
    if (state.cancelRemoval) {
      try { state.cancelRemoval(); } catch (_) {}
      state.cancelRemoval = null;
    }
    clearSurfaceSelection('notifications:cleanup');
    delete root.__notificationsState;
  };

  state.cancelRemoval = onNodeRemoved(root, state.cleanup);
  root.__notificationsState = state;
  return state;
}

function update(state) {
  if (!state || state.cleaned) return;
  state.items = readActiveNotifications();
  pruneSelection(state);
  const filterEntry = FILTER_MAP.get(resolveFilterKey(state.filter)) || FILTERS[0];
  state.filter = filterEntry.key;
  state.elements.filterSelect.value = state.filter;
  const filtered = state.items.filter((item) => {
    try { return filterEntry.predicate(item); }
    catch (_) { return true; }
  });
  state.filtered = filtered;
  const store = ensureSelectionStore(state);
  const selection = store && typeof store.get === 'function'
    ? ensureSet(store.get(SCOPE))
    : new Set();
  renderRows(state, filtered, selection);
  updateCounts(state, state.items.length, filtered.length);
  syncSelection(state, selection);
}

export function renderNotifications(root) {
  if (!isFeatureEnabled('notificationsMVP')) return;
  const mount = resolveMount(root);
  if (!mount) return;
  const state = ensureState(mount);
  if (!state) return;
  update(state);
}

export function initNotifications() {
  if (!isFeatureEnabled('notificationsMVP')) return;
  const mount = resolveMount();
  if (!mount) return;
  const view = mount.closest && mount.closest('main');
  if (view && typeof view.classList?.remove === 'function') {
    view.classList.remove('hidden');
  }
  renderNotifications(mount);
}
