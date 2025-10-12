const BUTTON_ID = 'actionbar-merge-partners';
const DATA_ACTION_NAME = 'clear';
const FAB_ID = 'global-new';
const FAB_MENU_ID = 'global-new-menu';

function markActionbarHost() {
  if (typeof document === 'undefined') return null;
  const bar = document.getElementById('actionbar');
  if (!bar) return null;
  if (!bar.dataset.ui) {
    bar.dataset.ui = 'action-bar';
  }
  if (!bar.hasAttribute('data-visible')) {
    bar.setAttribute('data-visible', bar.classList.contains('has-selection') ? '1' : '0');
  }
  const clearBtn = bar.querySelector('[data-act="clear"]');
  if (clearBtn && !clearBtn.hasAttribute('data-action')) {
    clearBtn.setAttribute('data-action', DATA_ACTION_NAME);
  }
  const mergeBtn = bar.querySelector('[data-act="merge"]');
  if (mergeBtn && !mergeBtn.hasAttribute('data-action')) {
    mergeBtn.setAttribute('data-action', 'merge');
  }
  return bar;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (typeof window.__ACTION_BAR_LAST_DATA_ACTION__ === 'undefined') {
    window.__ACTION_BAR_LAST_DATA_ACTION__ = null;
  }
  if (!window.__ACTION_BAR_DATA_ACTION_WIRED__) {
    window.__ACTION_BAR_DATA_ACTION_WIRED__ = true;
    const setup = () => {
      markActionbarHost();
      ensureGlobalNewFab();
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
