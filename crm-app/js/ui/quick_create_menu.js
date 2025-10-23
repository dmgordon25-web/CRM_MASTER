import { openPartnerEditModal } from './modals/partner_edit/index.js';

const WRAPPER_ID = 'global-new-menu';
const MENU_ID = 'header-new-menu';
const BUTTON_PREFIX = 'header-new-';

const state = {
  open: false,
  source: null,
  anchor: null,
  wrapper: null,
  menu: null,
  outsideHandler: null,
  keyHandler: null
};

function emitState() {
  if (typeof document === 'undefined') return;
  const detail = { open: state.open, source: state.source };
  try {
    const event = new CustomEvent('quick-create-menu:state', { detail });
    document.dispatchEvent(event);
  } catch (_) {}
}

function showToast(kind, message) {
  const text = String(message == null ? '' : message).trim();
  if (!text) return;
  const toast = window.Toast;
  if (toast && typeof toast[kind] === 'function') {
    try {
      toast[kind](text);
      return;
    } catch (_) {}
  }
  if (toast && typeof toast.show === 'function') {
    try {
      toast.show(text);
      return;
    } catch (_) {}
  }
  if (typeof window.toast === 'function') {
    try { window.toast(text); }
    catch (_) {}
  }
}

function callSafely(fn, ...args) {
  if (typeof fn !== 'function') return null;
  try {
    return fn(...args);
  } catch (err) {
    if (console && typeof console.warn === 'function') {
      console.warn('[quick-create] action failed', err);
    }
    showToast('warn', 'Something went wrong');
    return null;
  }
}

function ensureButton(label, kind) {
  const { menu } = state;
  if (!menu) return null;
  const role = `${BUTTON_PREFIX}${kind}`;
  let btn = menu.querySelector(`button[data-role="${role}"]`);
  if (btn) return btn;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn ghost';
  btn.textContent = label;
  btn.dataset.role = role;
  btn.setAttribute('role', 'menuitem');
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    handleSelection(kind);
  });
  menu.appendChild(btn);
  return btn;
}

function ensureMenuElements() {
  if (typeof document === 'undefined') return null;

  let wrapper = document.getElementById(WRAPPER_ID);
  if (!wrapper) {
    wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.hidden = true;
    wrapper.style.position = 'fixed';
    wrapper.style.zIndex = '10050';
    wrapper.style.display = 'block';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.left = '0';
    wrapper.style.top = '0';
    document.body.appendChild(wrapper);
  }

  let menu = document.getElementById(MENU_ID);
  if (!menu) {
    menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'card hidden';
    menu.hidden = true;
    menu.style.minWidth = '180px';
    menu.style.padding = '8px';
    menu.style.display = 'flex';
    menu.style.flexDirection = 'column';
    menu.style.gap = '4px';
    menu.style.pointerEvents = 'auto';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('data-qa', 'fab-menu');
  }

  if (menu.parentElement !== wrapper) {
    wrapper.appendChild(menu);
  }
  if (!wrapper.parentElement) {
    document.body.appendChild(wrapper);
  }

  state.wrapper = wrapper;
  state.menu = menu;

  ensureButton('Contact', 'contact');
  ensureButton('Partner', 'partner');
  ensureButton('Task', 'task');

  return { wrapper, menu };
}

function handleSelection(kind) {
  closeQuickCreateMenu();
  const item = kind === 'partner' ? 'partner' : kind === 'task' ? 'task' : 'contact';
  try {
    console && typeof console.info === 'function' && console.info('[A_BEACON] quick-create:select', { item });
  } catch (_) {}
  if (kind === 'contact') {
    openContactEditor();
    return;
  }
  if (kind === 'partner') {
    openPartnerEditor();
    return;
  }
  if (kind === 'task') {
    openTaskEditor();
  }
}

function openContactEditor() {
  if (typeof window.renderContactModal === 'function') {
    callSafely(window.renderContactModal, null);
    return;
  }
  if (typeof window.openNewContact === 'function') {
    callSafely(window.openNewContact);
    return;
  }
  showToast('warn', 'Contact modal unavailable');
}

function openPartnerEditor() {
  if (typeof openPartnerEditModal === 'function') {
    Promise.resolve(callSafely(openPartnerEditModal, '', { allowAutoOpen: true }));
    return;
  }
  if (typeof window.openPartnerEditModal === 'function') {
    Promise.resolve(callSafely(window.openPartnerEditModal, '', { allowAutoOpen: true }));
    return;
  }
  showToast('warn', 'Partner modal unavailable');
}

function openTaskEditor() {
  const handlers = [
    window.openTaskQuickAdd,
    window.CRM && window.CRM.openTaskQuickCreate,
    window.Tasks && window.Tasks.openQuickCreate,
    window.openTaskQuickCreate,
    window.renderTaskModal
  ].filter((fn) => typeof fn === 'function');
  if (handlers.length) {
    try { handlers[0](); }
    catch (_) {}
    return;
  }
  showToast('info', 'Tasks coming soon');
}

function handleOutsideClick(event) {
  const { wrapper, anchor } = state;
  if (!wrapper || wrapper.hidden) return;
  const target = event.target;
  if (wrapper.contains(target)) return;
  if (anchor && typeof anchor.contains === 'function' && anchor.contains(target)) return;
  closeQuickCreateMenu();
}

function handleKeyDown(event) {
  if (event.key === 'Escape') {
    closeQuickCreateMenu();
  }
}

function positionMenu(anchor, source) {
  const { wrapper, menu } = state;
  if (!wrapper || !menu) return;
  const anchorRect = anchor && typeof anchor.getBoundingClientRect === 'function'
    ? anchor.getBoundingClientRect()
    : null;

  wrapper.hidden = false;
  menu.hidden = false;
  menu.classList.remove('hidden');
  const previousVisibility = wrapper.style.visibility;
  wrapper.style.visibility = 'hidden';
  wrapper.style.pointerEvents = 'none';

  const menuRect = menu.getBoundingClientRect();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth || document.documentElement.clientWidth || 0 : 0;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight || document.documentElement.clientHeight || 0 : 0;

  const margin = source === 'actionbar' ? 12 : 8;
  let top;
  if (source === 'actionbar') {
    const anchorTop = anchorRect ? anchorRect.top : viewportHeight;
    top = anchorTop - menuRect.height - margin;
    if (!Number.isFinite(top)) {
      top = viewportHeight - menuRect.height - 72;
    }
    if (top < 8) {
      const fallback = anchorRect ? anchorRect.bottom + margin : 8;
      const maxTop = Math.max(8, viewportHeight - menuRect.height - 8);
      top = Math.min(fallback, maxTop);
    }
  } else {
    const anchorBottom = anchorRect ? anchorRect.bottom : 48;
    top = anchorBottom + margin;
    if (!Number.isFinite(top)) {
      top = 64;
    }
    if (viewportHeight && top + menuRect.height + 8 > viewportHeight) {
      const candidate = anchorRect ? anchorRect.top - menuRect.height - margin : viewportHeight - menuRect.height - 8;
      if (candidate >= 8) {
        top = candidate;
      } else {
        top = Math.max(8, viewportHeight - menuRect.height - 8);
      }
    }
  }

  let left;
  if (anchorRect) {
    if (source === 'actionbar') {
      left = anchorRect.left + (anchorRect.width / 2) - (menuRect.width / 2);
    } else {
      left = anchorRect.left + anchorRect.width - menuRect.width;
    }
  } else {
    left = (viewportWidth - menuRect.width) / 2;
  }
  if (!Number.isFinite(left)) {
    left = (viewportWidth - menuRect.width) / 2;
  }
  const minLeft = 8;
  const maxLeft = Math.max(minLeft, viewportWidth - menuRect.width - 8);
  if (left < minLeft) left = minLeft;
  if (left > maxLeft) left = maxLeft;

  wrapper.style.left = `${Math.round(left)}px`;
  wrapper.style.top = `${Math.round(top)}px`;
  wrapper.style.right = 'auto';
  wrapper.style.bottom = 'auto';
  wrapper.style.visibility = previousVisibility || '';
  wrapper.style.pointerEvents = 'auto';
}

export function closeQuickCreateMenu() {
  const { wrapper, menu } = state;
  if (!wrapper || !menu || wrapper.hidden) return;
  wrapper.hidden = true;
  menu.hidden = true;
  if (menu.classList && typeof menu.classList.add === 'function') {
    menu.classList.add('hidden');
  }
  wrapper.style.left = '';
  wrapper.style.top = '';
  wrapper.style.right = '';
  wrapper.style.bottom = '';
  state.open = false;
  state.source = null;
  state.anchor = null;
  if (state.outsideHandler) {
    document.removeEventListener('click', state.outsideHandler, true);
    state.outsideHandler = null;
  }
  if (state.keyHandler) {
    document.removeEventListener('keydown', state.keyHandler, true);
    state.keyHandler = null;
  }
  emitState();
}

export function openQuickCreateMenu(options = {}) {
  const { anchor = null, source = 'header' } = options;
  const elements = ensureMenuElements();
  if (!elements) return;
  state.anchor = anchor;
  state.source = source;
  state.open = true;
  positionMenu(anchor, source);
  if (!state.outsideHandler) {
    state.outsideHandler = (event) => handleOutsideClick(event);
    document.addEventListener('click', state.outsideHandler, true);
  }
  if (!state.keyHandler) {
    state.keyHandler = (event) => handleKeyDown(event);
    document.addEventListener('keydown', state.keyHandler, true);
  }
  try {
    console && typeof console.info === 'function' && console.info('[A_BEACON] quick-create:open', { source });
  } catch (_) {}
  emitState();
}

export function toggleQuickCreateMenu(options = {}) {
  const { source = 'header' } = options;
  if (state.open && state.source === source) {
    closeQuickCreateMenu();
    return;
  }
  openQuickCreateMenu(options);
}

export function isQuickCreateMenuOpen(source) {
  if (!state.open) return false;
  if (!source) return true;
  return state.source === source;
}
