import './quick_add_compat.js';
import { toggleQuickCreateMenu, isQuickCreateMenuOpen } from './quick_create_menu.js';

(function(){try{window.__WIRED_HEADER_TOOLBAR__=true;console.info('[A_BEACON] header loaded');}catch{}}());

const STATE_KEY = '__WIRED_GLOBAL_NEW_BUTTON__';
const BUTTON_ID = 'btn-header-new';
let headerOnlyBeaconed = false;

function postQuickAddLog(eventName) {
  if (!eventName) {
    return;
  }
  const payload = JSON.stringify({ event: eventName });
  let sent = false;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      sent = !!navigator.sendBeacon('/__log', payload) || sent;
    } catch (_) {}
  }
  if (sent || typeof fetch !== 'function') {
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

function emitHeaderOnlyBeacon() {
  if (headerOnlyBeaconed) {
    return;
  }
  headerOnlyBeaconed = true;
  try {
    console && typeof console.info === 'function' && console.info('[VIS] quick-add: header-only');
  } catch (_) {}
  postQuickAddLog('quickadd-header-only');
}

function setupGlobalNewButton() {
  if (window[STATE_KEY]) return;

  try {
    const header = document.querySelector('.header-bar');
    if (!header) return;

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

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      try {
        window.openQuickAddCompat?.();
      } catch (err) {
        if (console && typeof console.warn === 'function') {
          console.warn('quick add compat failed', err);
        }
      }
      toggleQuickCreateMenu({ anchor: toggle, source: 'header' });
    });

    if (!toggle.__quickCreateStateWired) {
      toggle.__quickCreateStateWired = true;
      const handleState = (event) => {
        const detail = event && event.detail ? event.detail : {};
        const expanded = !!(detail.open && detail.source === 'header');
        toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        if (!toggle.isConnected) {
          document.removeEventListener('quick-create-menu:state', handleState);
        }
      };
      document.addEventListener('quick-create-menu:state', handleState);
      if (isQuickCreateMenuOpen('header')) {
        toggle.setAttribute('aria-expanded', 'true');
      }
    }

    const mountCandidates = [];
    const explicitMount = header.querySelector('[data-role="header-toolbar"]');
    if (explicitMount) mountCandidates.push(explicitMount);
    const actionWrap = header.querySelector('.header-actions');
    if (actionWrap) mountCandidates.push(actionWrap);
    const rightWrap = header.querySelector('.header-right');
    if (rightWrap) mountCandidates.push(rightWrap);
    const profileWrap = header.querySelector('#lo-profile-chip');
    if (profileWrap && profileWrap.parentElement) mountCandidates.push(profileWrap.parentElement);
    const notifParent = (() => {
      const wrap = header.querySelector('#notif-wrap');
      return wrap && wrap.parentElement === header ? wrap.parentElement : null;
    })();
    if (notifParent) mountCandidates.push(notifParent);
    const quickAddParent = (() => {
      const quickAdd = header.querySelector('#quick-add');
      return quickAdd && quickAdd.parentElement ? quickAdd.parentElement : null;
    })();
    if (quickAddParent) mountCandidates.push(quickAddParent);

    let mount = mountCandidates.find((node) => node && node instanceof HTMLElement && header.contains(node));
    if (!mount) {
      mount = header;
    }

    if (mount && mount !== header) {
      mount.appendChild(host);
    } else {
      const notifWrap = header.querySelector('#notif-wrap');
      if (notifWrap && notifWrap.parentElement === header) {
        header.insertBefore(host, notifWrap);
      } else {
        const quickAdd = header.querySelector('#quick-add');
        if (quickAdd && quickAdd.parentElement === header) {
          quickAdd.insertAdjacentElement('afterend', host);
        } else {
          const grow = header.querySelector('.grow');
          if (grow && grow.parentElement === header) {
            grow.insertAdjacentElement('afterend', host);
          } else {
            header.appendChild(host);
          }
        }
      }
    }

    window[STATE_KEY] = true;
    emitHeaderOnlyBeacon();
  } catch (err) {
    if (console && typeof console.warn === 'function') {
      console.warn('header toolbar injection failed', err);
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGlobalNewButton, { once: true });
  } else {
    setupGlobalNewButton();
  }
}

const AVATAR_STORAGE_KEY = 'user:avatar:dataurl';
const LEGACY_PROFILE_KEY = 'profile:v1';
let headerAvatarBridgeInitialized = false;

function warnAvatarBridge(message, detail) {
  try {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      if (detail !== undefined) {
        console.warn(message, detail);
      } else {
        console.warn(message);
      }
    }
  } catch (_) {}
}

function readLegacyAvatar() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return '';
  } catch (err) {
    warnAvatarBridge('[soft] legacy avatar storage unavailable', err && (err.message || err));
    return '';
  }
  try {
    const raw = window.localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.photoDataUrl === 'string') {
      return parsed.photoDataUrl;
    }
  } catch (err) {
    warnAvatarBridge('[soft] legacy avatar parse failed', err && (err.message || err));
  }
  return '';
}

function readStoredAvatar() {
  if (typeof window === 'undefined') return '';
  try {
    if (window.localStorage) {
      const direct = window.localStorage.getItem(AVATAR_STORAGE_KEY);
      if (typeof direct === 'string') {
        return direct;
      }
    }
  } catch (err) {
    warnAvatarBridge('[soft] avatar storage read failed', err && (err.message || err));
    return '';
  }
  return readLegacyAvatar();
}

function applyHeaderAvatar(dataUrl) {
  if (typeof document === 'undefined') return;
  const chip = document.getElementById('lo-profile-chip');
  if (!chip) return;
  const nameEl = chip.querySelector('[data-role="lo-name"]');
  if (!nameEl) return;

  const photoDataUrl = typeof dataUrl === 'string' ? dataUrl : '';
  const hasPhoto = !!photoDataUrl && photoDataUrl.startsWith('data:');
  if (hasPhoto) {
    if (!nameEl.__photoOriginal) {
      nameEl.__photoOriginal = {
        display: nameEl.style.display || '',
        alignItems: nameEl.style.alignItems || '',
        gap: nameEl.style.gap || ''
      };
    }
    nameEl.style.display = 'flex';
    nameEl.style.alignItems = 'center';
    nameEl.style.gap = '8px';
    let img = nameEl.querySelector('[data-role="lo-photo"]');
    if (!img) {
      img = document.createElement('img');
      img.dataset.role = 'lo-photo';
      img.alt = '';
      img.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
      nameEl.insertBefore(img, nameEl.firstChild);
    }
    img.src = photoDataUrl;
    nameEl.__photoFlexApplied = true;
  } else {
    const img = nameEl.querySelector('[data-role="lo-photo"]');
    if (img) {
      try { img.remove(); }
      catch (_) { if (img.parentNode) img.parentNode.removeChild(img); }
    }
    if (nameEl.__photoFlexApplied && nameEl.__photoOriginal) {
      const original = nameEl.__photoOriginal;
      nameEl.style.display = original.display;
      nameEl.style.alignItems = original.alignItems;
      nameEl.style.gap = original.gap;
    }
    nameEl.__photoFlexApplied = false;
  }
}

function initHeaderAvatarBridge() {
  if (headerAvatarBridgeInitialized) return;
  headerAvatarBridgeInitialized = true;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const update = (fallbackUrl) => {
    const stored = readStoredAvatar();
    const dataUrl = stored || (typeof fallbackUrl === 'string' ? fallbackUrl : '');
    applyHeaderAvatar(dataUrl);
  };

  const ready = () => update('');
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }

  window.addEventListener('avatar:updated', (event) => {
    const detailUrl = event && event.detail && typeof event.detail.dataUrl === 'string'
      ? event.detail.dataUrl
      : '';
    update(detailUrl);
  });

  try {
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[VIS] header avatar bridge ready');
    }
  } catch (_) {}
}

initHeaderAvatarBridge();
