import { openPartnerEditModal } from './modals/partner_edit/index.js';

const STATE_KEY = '__WIRED_GLOBAL_NEW_BUTTON__';
const MENU_ID = 'header-new-menu';
const BUTTON_ID = 'btn-header-new';

function showToast(message) {
  const text = String(message ?? '').trim();
  if (!text) return;
  const toastApi = window.Toast;
  if (toastApi && typeof toastApi.show === 'function') {
    toastApi.show(text);
    return;
  }
  if (typeof window.toast === 'function') {
    window.toast(text);
  }
}

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return null;
  try {
    return fn(...args);
  } catch (err) {
    console && console.warn && console.warn('header new button action failed', err);
    showToast('Something went wrong');
    return null;
  }
}

function createMenuItem(label, onSelect) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = label;
  btn.dataset.role = `header-new-${label.toLowerCase()}`;
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    onSelect();
  });
  return btn;
}

function setupGlobalNewButton() {
  if (window[STATE_KEY]) return;

  const header = document.querySelector('.header-bar');
  if (!header) return;

  window[STATE_KEY] = true;

  const legacyButtons = header.querySelectorAll('#btn-add-contact');
  legacyButtons.forEach((btn) => {
    if (btn && btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });

  const host = document.createElement('div');
  host.className = 'dropdown header-new-wrap';
  host.style.position = 'relative';

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn brand';
  toggle.id = BUTTON_ID;
  toggle.textContent = '+ New';
  toggle.setAttribute('aria-haspopup', 'true');
  toggle.setAttribute('aria-expanded', 'false');
  host.appendChild(toggle);

  const menu = document.createElement('div');
  menu.className = 'card hidden';
  menu.id = MENU_ID;
  menu.style.position = 'absolute';
  menu.style.top = '42px';
  menu.style.right = '0';
  menu.style.minWidth = '160px';
  menu.style.padding = '8px';
  menu.style.display = 'flex';
  menu.style.flexDirection = 'column';
  menu.style.gap = '4px';
  menu.hidden = true;
  host.appendChild(menu);

  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.classList.add('hidden');
    toggle.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocumentClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function openMenu() {
    if (!menu.hidden) return;
    menu.hidden = false;
    menu.classList.remove('hidden');
    toggle.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', onDocumentClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  function onDocumentClick(event) {
    if (!host.contains(event.target)) {
      closeMenu();
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      closeMenu();
      toggle.focus();
    }
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  const actions = {
    contact() {
      closeMenu();
      if (typeof window.renderContactModal === 'function') {
        callSafely(window.renderContactModal, null);
        return;
      }
      if (typeof window.openNewContact === 'function') {
        callSafely(window.openNewContact);
        return;
      }
      showToast('Contact modal unavailable');
    },
    partner() {
      closeMenu();
      if (typeof openPartnerEditModal === 'function') {
        Promise.resolve(callSafely(openPartnerEditModal, '', { allowAutoOpen: true }));
        return;
      }
      if (typeof window.openPartnerEditModal === 'function') {
        Promise.resolve(callSafely(window.openPartnerEditModal, '', { allowAutoOpen: true }));
        return;
      }
      showToast('Partner modal unavailable');
    },
    task() {
      closeMenu();
      const fn = window.openTaskQuickAdd;
      if (typeof fn === 'function') {
        callSafely(fn);
        return;
      }
      showToast('Tasks coming soon');
    }
  };

  menu.appendChild(createMenuItem('Contact', actions.contact));
  menu.appendChild(createMenuItem('Partner', actions.partner));
  menu.appendChild(createMenuItem('Task', actions.task));

  const notifWrap = header.querySelector('#notif-wrap');
  if (notifWrap && notifWrap.parentNode === header) {
    header.insertBefore(host, notifWrap);
  } else {
    header.appendChild(host);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalNewButton, { once: true });
  } else {
    setupGlobalNewButton();
  }
}

export {};
