import { openContactsMergeByIds } from '../contacts_merge_orchestrator.js';
import { openPartnersMergeByIds } from '../partners_merge_orchestrator.js';

const BUTTON_ID = 'actionbar-merge-partners';
const DATA_ACTION_NAME = 'clear';
const ACTION_REQUIREMENTS = new Map([
  ['merge', 2],
  ['edit', 1],
  ['tag', 1],
  ['noop', 1],
  ['emailTogether', 1],
  ['emailMass', 1],
  ['task', 1],
  ['bulkLog', 1],
  ['delete', 1],
  ['clear', 1]
]);

function normalizeSelectionType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'contacts';
  if (raw === 'partners' || raw === 'partner') return 'partners';
  if (raw.includes('partner')) return 'partners';
  return 'contacts';
}

function requirementFor(action) {
  if (!action) return 1;
  if (ACTION_REQUIREMENTS.has(action)) return ACTION_REQUIREMENTS.get(action);
  return 1;
}

function markActionbarHost() {
  if (typeof document === 'undefined') return null;
  const bar = document.getElementById('actionbar');
  if (!bar) return null;
  if (!bar.dataset.ui) {
    bar.dataset.ui = 'action-bar';
  }
  if (!bar.hasAttribute('data-visible')) {
    bar.setAttribute('data-visible', '0');
  }
  syncDataActions(bar);
  return bar;
}

function syncDataActions(bar) {
  if (!bar) return;
  bar.querySelectorAll('[data-act]').forEach((btn) => {
    const act = btn.getAttribute('data-act');
    if (act && !btn.hasAttribute('data-action')) {
      btn.setAttribute('data-action', act);
    }
  });
  const clearBtn = bar.querySelector('[data-action="clear"], [data-act="clear"]');
  if (clearBtn && !clearBtn.getAttribute('data-action')) {
    clearBtn.setAttribute('data-action', DATA_ACTION_NAME);
  }
}

function selectionApi() {
  const primary = typeof window !== 'undefined' ? window.Selection : null;
  const fallback = typeof window !== 'undefined' ? window.SelectionService : null;

  function count() {
    if (primary && typeof primary.count === 'function') return Number(primary.count()) || 0;
    if (fallback && typeof fallback.count === 'function') return Number(fallback.count()) || 0;
    if (primary && primary.ids instanceof Set) return primary.ids.size;
    if (fallback && fallback.ids instanceof Set) return fallback.ids.size;
    return 0;
  }

  function atLeast(n) {
    if (primary && typeof primary.atLeast === 'function') return !!primary.atLeast(n);
    if (fallback && typeof fallback.atLeast === 'function') return !!fallback.atLeast(n);
    const threshold = Number(n);
    if (!Number.isFinite(threshold)) return count() > 0;
    return count() >= threshold;
  }

  function ids() {
    if (primary) {
      if (typeof primary.all === 'function') {
        const list = primary.all();
        if (Array.isArray(list)) return list.map((id) => String(id));
      }
      if (typeof primary.getSelectedIds === 'function') {
        const list = primary.getSelectedIds();
        if (Array.isArray(list)) return list.map((id) => String(id));
      }
      if (typeof primary.get === 'function') {
        const snap = primary.get();
        if (snap && Array.isArray(snap.ids)) return snap.ids.map((id) => String(id));
      }
    }
    if (fallback) {
      if (typeof fallback.getIds === 'function') {
        return Array.from(fallback.getIds() || [], (id) => String(id));
      }
      if (fallback.ids instanceof Set) {
        return Array.from(fallback.ids, (id) => String(id));
      }
    }
    return [];
  }

  function type() {
    if (primary) {
      if (typeof primary.get === 'function') {
        const snap = primary.get();
        if (snap && snap.type) return normalizeSelectionType(snap.type);
      }
      if (typeof primary.type === 'string') return normalizeSelectionType(primary.type);
    }
    if (fallback && typeof fallback.type === 'string') return normalizeSelectionType(fallback.type);
    return 'contacts';
  }

  function onChange(cb) {
    if (primary && typeof primary.onChange === 'function') return primary.onChange(cb);
    if (fallback && typeof fallback.onChange === 'function') return fallback.onChange(cb);
    return null;
  }

  return { count, atLeast, ids, type, onChange };
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
      #actionbar .actionbar-actions{ display:flex; gap:8px; align-items:center; justify-content:center; }
      #actionbar .btn{ padding:6px 10px; font-size:0.95rem; border-radius:10px; }
      #actionbar .btn.disabled{ opacity:.45; pointer-events:none; }
      #actionbar .btn.active{ outline:2px solid rgba(255,255,255,.35); transform:translateY(-1px); }
    `;
  document.head.appendChild(s);
}

function getActionsHost() {
  const bar = typeof document !== 'undefined' ? document.getElementById('actionbar') : null;
  return bar ? bar.querySelector('.actionbar-actions') : null;
}

export function ensurePartnersMergeButton() {
  markActionbarHost();
  injectActionBarStyle();
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

function updateActionStates(){
  const bar = markActionbarHost();
  if (!bar) return;
  syncDataActions(bar);
  const selection = selectionApi();
  const count = selection.count();
  const visible = count > 0 ? '1' : '0';
  bar.setAttribute('data-visible', visible);
  bar.classList?.toggle?.('has-selection', count > 0);
  bar.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.getAttribute('data-action');
    const required = requirementFor(action);
    const enabled = required <= 0 ? true : selection.atLeast(required);
    if (enabled) {
      btn.removeAttribute('data-disabled');
      if ('disabled' in btn) btn.disabled = false;
      btn.classList?.remove?.('disabled');
    } else {
      btn.setAttribute('data-disabled', '1');
      if ('disabled' in btn) btn.disabled = true;
      btn.classList?.add?.('disabled');
    }
  });
}

function ensureSelectionSubscription(){
  if (typeof window === 'undefined') return;
  if (window.__ACTION_BAR_SEL_UNSUB__) return;
  const selection = selectionApi();
  const unsub = selection.onChange(() => {
    updateActionStates();
  });
  if (typeof unsub === 'function') {
    window.__ACTION_BAR_SEL_UNSUB__ = unsub;
  }
}

async function runMergeFlow(){
  const selection = selectionApi();
  const ids = selection.ids();
  if (!Array.isArray(ids) || ids.length < 2) return;
  const [first, second] = ids.slice(0, 2);
  const type = selection.type();
  try {
    const opener = type === 'partners' ? openPartnersMergeByIds : openContactsMergeByIds;
    const result = await opener(first, second);
    if (result && result.status === 'ok') {
      const message = type === 'partners'
        ? 'Partners merged successfully'
        : 'Contacts merged successfully';
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show(message);
      } else if (typeof window.toast === 'function') {
        window.toast(message);
      }
    } else if (result && result.status === 'error') {
      console.warn('[action-bar] merge returned error', result.error || result);
    }
  } catch (err) {
    console.warn('[action-bar] merge failed', err);
  }
}

function handleActionClick(event){
  const bar = markActionbarHost();
  if (!bar) return;
  const btn = event.target && event.target.closest && event.target.closest('[data-action]');
  if (!btn || !bar.contains(btn)) return;
  const disabled = btn.getAttribute('data-disabled') === '1' || btn.disabled;
  if (disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  const action = btn.getAttribute('data-action');
  if (action === 'merge') {
    event.preventDefault();
    event.stopPropagation();
    runMergeFlow();
  }
}

function ensureActionBarBoot(){
  if (typeof document === 'undefined') return;
  if (window.__ACTION_BAR_ENABLEMENT_WIRED__) return;
  window.__ACTION_BAR_ENABLEMENT_WIRED__ = true;

  const setup = () => {
    const bar = markActionbarHost();
    if (!bar) return;
    syncDataActions(bar);
    ensureSelectionSubscription();
    updateActionStates();
    document.addEventListener('selection:changed', updateActionStates);
    bar.addEventListener('click', handleActionClick, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (typeof window.__ACTION_BAR_LAST_DATA_ACTION__ === 'undefined') {
    window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
  }
  if (!window.__ACTION_BAR_DATA_ACTION_WIRED__) {
    window.__ACTION_BAR_DATA_ACTION_WIRED__ = true;
    const setup = () => {
      markActionbarHost();
      ensureActionBarBoot();
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setup, { once: true });
    } else {
      setup();
    }
    document.addEventListener('click', (event) => {
      const btn = event.target && event.target.closest && event.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      if (!action) return;
      window.__ACTION_BAR_LAST_DATA_ACTION__ = action;
    }, true);
  } else {
    ensureActionBarBoot();
  }
}

ensureActionBarBoot();
