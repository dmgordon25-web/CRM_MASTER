import { openPartnerEditModal } from './modals/partner_edit/index.js';

const WRAPPER_ID = 'global-new-menu';
const MENU_ID = 'header-new-menu';
const BUTTON_PREFIX = 'header-new-';

const state = {
  open: false,
  source: null,
  origin: null,
  anchor: null,
  restoreFocus: null,
  wrapper: null,
  menu: null,
  outsideHandler: null,
  keyHandler: null
};

let bootBeaconEmitted = false;

function emitState() {
  if (typeof document === 'undefined') return;
  const detail = { open: state.open, source: state.source, origin: state.origin };
  try {
    const event = new CustomEvent('quick-create-menu:state', { detail });
    document.dispatchEvent(event);
  } catch (_) {}
}

function postLog(eventName) {
  const payload = JSON.stringify({ event: eventName });
  let sent = false;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      sent = !!navigator.sendBeacon('/__log', payload) || sent;
    } catch (_) {}
  }
  if (sent) {
    return;
  }
  if (typeof fetch !== 'function') {
    return;
  }
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

if (!bootBeaconEmitted) {
  bootBeaconEmitted = true;
  try {
    console && typeof console.info === 'function' && console.info('[VIS] quick-create unified');
  } catch (_) {}
  postLog('quick-create-unified');
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

  ensureButton('Partner', 'partner');
  ensureButton('Contact', 'contact');
  ensureButton('Task', 'task');

  return { wrapper, menu };
}

function normalizeSource() {
  return 'header';
}

function focusFirstMenuItem() {
  const { menu } = state;
  if (!menu) return;
  const first = menu.querySelector('button[role="menuitem"]');
  if (!first) return;
  if (typeof first.focus === 'function') {
    try {
      first.focus({ preventScroll: true });
      return;
    } catch (_) {}
    try { first.focus(); }
    catch (_) {}
  }
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

function positionMenu(anchor) {
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

  const margin = 8;
  const anchorBottom = anchorRect ? anchorRect.bottom : 48;
  let top = anchorBottom + margin;
  if (!Number.isFinite(top)) {
    top = 64;
  }
  if (viewportHeight && top + menuRect.height + margin > viewportHeight) {
    const candidate = anchorRect ? anchorRect.top - menuRect.height - margin : viewportHeight - menuRect.height - margin;
    if (Number.isFinite(candidate) && candidate >= margin) {
      top = candidate;
    } else {
      top = Math.max(margin, viewportHeight - menuRect.height - margin);
    }
  }

  let left;
  if (anchorRect) {
    left = anchorRect.left + anchorRect.width - menuRect.width;
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
  const { wrapper, menu, restoreFocus } = state;
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
  state.origin = null;
  const anchor = state.anchor;
  if (state.outsideHandler) {
    document.removeEventListener('click', state.outsideHandler, true);
    state.outsideHandler = null;
  }
  if (state.keyHandler) {
    document.removeEventListener('keydown', state.keyHandler, true);
    state.keyHandler = null;
  }
  state.anchor = null;
  state.restoreFocus = null;
  if (restoreFocus && typeof restoreFocus.focus === 'function') {
    try {
      restoreFocus.focus({ preventScroll: true });
    } catch (_) {
      try { restoreFocus.focus(); }
      catch (_) {}
    }
  } else if (anchor && typeof anchor.focus === 'function') {
    try {
      anchor.focus({ preventScroll: true });
    } catch (_) {
      try { anchor.focus(); }
      catch (_) {}
    }
  }
  emitState();
}

export function openQuickCreateMenu(options = {}) {
  const { anchor = null, source = 'header', origin = source } = options;
  const elements = ensureMenuElements();
  if (!elements) return;
  state.anchor = anchor;
  state.source = normalizeSource();
  state.origin = origin;
  state.open = true;
  state.restoreFocus = anchor && typeof anchor.focus === 'function' ? anchor : null;
  positionMenu(anchor);
  if (!state.outsideHandler) {
    state.outsideHandler = (event) => handleOutsideClick(event);
    document.addEventListener('click', state.outsideHandler, true);
  }
  if (!state.keyHandler) {
    state.keyHandler = (event) => handleKeyDown(event);
    document.addEventListener('keydown', state.keyHandler, true);
  }
  try {
    console && typeof console.info === 'function' && console.info('[A_BEACON] quick-create:open', { source: state.origin, context: state.source });
  } catch (_) {}
  focusFirstMenuItem();
  emitState();
}

export function toggleQuickCreateMenu(options = {}) {
  const { anchor = null, source = 'header' } = options;
  if (state.open) {
    const normalizedSource = normalizeSource();
    const sameAnchor = anchor && state.anchor === anchor;
    const sameSource = state.source === normalizedSource;
    if ((sameAnchor && sameSource) || (!anchor && sameSource)) {
      closeQuickCreateMenu();
      return state.open;
    }
  }
  openQuickCreateMenu({ anchor, source: normalizeSource(), origin: source });
  return state.open;
}

export function isQuickCreateMenuOpen(source) {
  if (!state.open) return false;
  if (!source) return true;
  return state.source === source;
}
