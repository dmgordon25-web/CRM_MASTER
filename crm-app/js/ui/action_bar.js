import { openMergeModal } from './merge_modal.js';

const BUTTON_ID = 'actionbar-merge-partners';
const DATA_ACTION_NAME = 'clear';
const FAB_ID = 'global-new';
const FAB_MENU_ID = 'global-new-menu';

function findActionbarHost() {
  if (typeof document === 'undefined') return null;
  return document.getElementById('actionbar') || document.querySelector('.actionbar');
}

function isActionVisible(node) {
  if (!node) return false;
  if (node.hidden) return false;
  if (node.hasAttribute && node.hasAttribute('hidden')) return false;
  if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return false;
  const style = node.style || {};
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  return true;
}

function ensurePrimaryAction(bar) {
  if (!bar) return null;
  const candidates = [
    { selector: '[data-act="clear"]', action: 'clear' },
    { selector: '[data-action="clear"]', action: 'clear' },
    { selector: '[data-act="filter"]', action: 'filter' },
    { selector: '[data-action="filter"]', action: 'filter' },
    { selector: '[data-act="new"]', action: 'new' },
    { selector: '[data-action="new"]', action: 'new' }
  ];

  for (const { selector, action } of candidates) {
    const node = bar.querySelector(selector);
    if (!node) continue;
    if (!node.hasAttribute('data-action')) {
      node.setAttribute('data-action', action);
    }
    if (isActionVisible(node)) {
      return node;
    }
  }

  const fallback = bar.querySelector('[data-action]:not([data-action="merge"])')
    || bar.querySelector('[data-act]:not([data-act="merge"])')
    || bar.querySelector('button:not([data-action="merge"])');
  if (!fallback) return null;

  if (!fallback.hasAttribute('data-action')) {
    const fallbackAction = fallback.getAttribute('data-act')
      || fallback.getAttribute('aria-label')
      || (fallback.textContent ? fallback.textContent.trim().toLowerCase().replace(/\s+/g, '-') : '');
    const normalized = fallbackAction || 'action';
    fallback.setAttribute('data-action', normalized);
  }
  return fallback;
}

function markActionbarHost() {
  if (typeof document === 'undefined') return null;
  const bar = findActionbarHost();
  if (!bar) return null;
  if (!bar.dataset.ui) {
    bar.dataset.ui = 'action-bar';
  }
  if (!bar.hasAttribute('data-ui')) {
    bar.setAttribute('data-ui', 'action-bar');
  }
  if (!bar.hasAttribute('data-visible')) {
    bar.setAttribute('data-visible', bar.classList.contains('has-selection') ? '1' : '0');
  }
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
  ensurePrimaryAction(bar);
  return bar;
}

function mountActionBar() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  window.CRM = window.CRM || {};
  if (window.CRM._actionBarMounted) return;

  const bar = markActionbarHost();
  if (!bar) {
    console.warn('[action-bar] host not found for mount');
    return;
  }

  window.CRM._actionBarMounted = true;

  if (typeof window.__ACTION_BAR_LAST_DATA_ACTION__ === 'undefined') {
    window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
  }

  ensureGlobalNewFab();
  ensureMergeHandler();

  if (!window.__ACTION_BAR_DATA_ACTION_WIRED__) {
    window.__ACTION_BAR_DATA_ACTION_WIRED__ = true;
    document.addEventListener('click', (event) => {
      const target = event.target;
      const btn = target && typeof target.closest === 'function'
        ? target.closest('[data-action]')
        : null;
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (!action) return;
      window.__ACTION_BAR_LAST_DATA_ACTION__ = action;
    }, true);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('crm:shell-ready', () => mountActionBar(), { once: true });
  if (findActionbarHost()) {
    mountActionBar();
  }
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
    const selection = gatherCurrentSelection();
    if (!Array.isArray(selection) || selection.length < 2) {
      showToast('warn', 'Select at least two items to merge');
      return;
    }
    try {
      openMergeModal(selection);
    } catch (err) {
      console.warn('[action-bar] merge modal failed', err);
    }
  };
  mergeBtn.addEventListener('click', handler);
  mergeBtn.__mergeHandlerWired = true;
}

if (typeof document !== 'undefined' && !document.__ACTION_BAR_MERGE_REWIRE__) {
  document.__ACTION_BAR_MERGE_REWIRE__ = true;
  document.addEventListener('app:data:changed', () => {
    ensureMergeHandler();
  }, { passive: true });
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
