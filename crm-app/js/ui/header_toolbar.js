import { bindQuickCreateMenu, bindHeaderQuickCreateOnce, closeQuickCreateMenu } from './quick_create_menu.js';
// import { getQuickAddMenuOptions } from '../quick_add.js';
import { onEnter, onLeave } from '../router/history.js';
import { ensureViewGuard, getViewGuard, releaseViewGuard } from '../router/view_teardown.js';
import { getSettingsApi } from '../app_context.js';

(function () { try { window.__WIRED_HEADER_TOOLBAR__ = true; console.info('[A_BEACON] header loaded'); } catch { } }());

const STATE_KEY = '__WIRED_GLOBAL_NEW_BUTTON__';
const BUTTON_ID = 'btn-header-new';
const UNIFIED_NEW_DEFAULT = true;
let ensureControlsRef = null;
let headerOnlyBeaconed = false;
const HEADER_GUARD_KEY = '__WIRED_HEADER_TOOLBAR__';
let headerLifecycleGuard = null;

function getSettingsService() {
  return getSettingsApi();
}

const headerState = (() => {
  if (typeof window === 'undefined') {
    return { host: null, header: null, observer: null, pending: false, toggle: null, wired: false };
  }
  const existing = window[STATE_KEY];
  if (existing && typeof existing === 'object') {
    if (!('unbind' in existing)) {
      existing.unbind = null;
    }
    if (!('boundHost' in existing)) {
      existing.boundHost = null;
    }
    return existing;
  }
  const state = {
    host: null,
    header: null,
    observer: null,
    pending: false,
    toggle: null,
    wired: false,
    unbind: null,
    boundHost: null
  };
  window[STATE_KEY] = state;
  return state;
})();

function postQuickAddLog(eventName) {
  if (!eventName) {
    return;
  }
  const payload = JSON.stringify({ event: eventName });
  let sent = false;
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      sent = !!navigator.sendBeacon('/__log', payload) || sent;
    } catch (_) { }
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
    }).catch(() => { });
  } catch (_) { }
}

function emitHeaderOnlyBeacon() {
  if (headerOnlyBeaconed) {
    return;
  }
  headerOnlyBeaconed = true;
  try {
    console && typeof console.info === 'function' && console.info('[VIS] quick-add: header-only');
  } catch (_) { }
  postQuickAddLog('quickadd-header-only');
}

export function ensureProfileControls() {
  try {
    if (typeof ensureControlsRef === 'function') {
      ensureControlsRef();
    }
  } catch (err) {
    if (console && typeof console.info === 'function') {
      console.info('[A_BEACON] ensureProfileControls error', err && (err.message || err));
    }
  }
}

function findHeaderNode() {
  if (typeof document === 'undefined') return null;
  const selectors = [
    '.header-bar',
    '[data-role="header-bar"]',
    '[data-ui="header-bar"]',
    '[data-role="shell-header"]',
    '[data-ui="shell-header"]',
    '[data-ui="app-header"]',
    '.app-header',
    '#app-header'
  ];
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node) return node;
  }
  const title = document.getElementById('app-title-link') || document.querySelector('.app-title');
  if (title && typeof title.closest === 'function') {
    const host = title.closest('.header-bar, [data-role], [data-ui], header');
    if (host) return host;
  }
  return null;
}

function isUnifiedNewEnabled() {
  if (typeof window !== 'undefined' && window) {
    const safe = window.__SAFE_MODE__;
    if (safe === true || safe === 1 || safe === '1') {
      return false;
    }
    const flag = window.__CRM_ENABLE_UNIFIED_NEW__;
    if (typeof flag === 'boolean') {
      return flag;
    }
  }
  return UNIFIED_NEW_DEFAULT;
}

function removeLegacyHeaderButtons(header) {
  if (!header) return;
  const legacyButtons = header.querySelectorAll([
    '#btn-add-contact',
    '#btn-add-partner',
    '#quick-add',
    '.btn-add-contact',
    '.btn-add-partner',
    '[data-quick-add]'
  ].join(','));
  legacyButtons.forEach((btn) => {
    if (btn && btn.parentNode) {
      btn.parentNode.removeChild(btn);
    }
  });
}

function teardownQuickCreateBinding() {
  const { unbind } = headerState;
  if (typeof unbind === 'function') {
    try { unbind(); }
    catch (_) { }
  }
  headerState.unbind = null;
  headerState.boundHost = null;
}

function ensureHostNode() {
  if (typeof document === 'undefined') return null;
  let host = headerState.host && headerState.host.isConnected ? headerState.host : null;
  let toggle = host ? host.querySelector(`#${BUTTON_ID}`) : null;
  if (!host || !toggle) {
    toggle = document.getElementById(BUTTON_ID);
    host = toggle ? toggle.closest('.header-new-wrap') : null;
  }
  if (!host || !toggle) {
    host = document.createElement('div');
    host.className = 'dropdown header-new-wrap';
    host.dataset.role = 'header-new-host';
    host.style.position = 'relative';
    toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn brand';
    toggle.id = BUTTON_ID;
    toggle.textContent = 'New+';
    toggle.setAttribute('aria-label', 'Create new record');
    host.appendChild(toggle);
  } else {
    const label = toggle.textContent ? toggle.textContent.trim() : '';
    if (label !== 'New+') {
      toggle.textContent = 'New+';
    }
    if (!toggle.hasAttribute('aria-label')) {
      toggle.setAttribute('aria-label', 'Create new record');
    }
  }
  headerState.host = host;
  headerState.toggle = toggle;
  return host;
}

function ensureQuickCreateBinding(host) {
  if (!host) {
    teardownQuickCreateBinding();
    return;
  }
  if (headerState.boundHost === host && typeof headerState.unbind === 'function') {
    return;
  }
  teardownQuickCreateBinding();
  try {
    // const quickAddOptions = getQuickAddMenuOptions();
    const unbind = bindQuickCreateMenu(host, {
      toggleSelector: `#${BUTTON_ID}`,
      enableActionBar: true
    });
    headerState.unbind = typeof unbind === 'function' ? unbind : null;
    headerState.boundHost = host;
    try {
      const bus = typeof window !== 'undefined' ? (window.AppBus || window.__APP_BUS__ || null) : null;
      bindHeaderQuickCreateOnce(host, bus);
    } catch (_) { }
  } catch (err) {
    headerState.unbind = null;
    if (console && typeof console.warn === 'function') {
      console.warn('[header] quick-create bind failed', err);
    }
  }
}

function pickHeaderMount(header) {
  if (!header) return null;
  const mounts = [];
  const explicitMount = header.querySelector('[data-role="header-toolbar"], [data-ui="header-toolbar"]');
  if (explicitMount) mounts.push(explicitMount);
  const actionWrap = header.querySelector('.header-actions, [data-role="header-actions"], [data-ui="header-actions"], [data-zone="header-actions"]');
  if (actionWrap) mounts.push(actionWrap);
  const rightWrap = header.querySelector('.header-right, [data-role="header-right"], [data-ui="header-right"], [data-zone="header-right"]');
  if (rightWrap) mounts.push(rightWrap);
  const utilityWrap = header.querySelector('[data-role="header-utilities"], [data-ui="header-utilities"], [data-zone="header-utilities"]');
  if (utilityWrap) mounts.push(utilityWrap);
  const slotMount = header.querySelector('[data-slot="header-actions"], [data-slot="actions"], [data-area="header-actions"], [data-area="actions"]');
  if (slotMount) mounts.push(slotMount);
  const profileWrap = header.querySelector('#lo-profile-chip');
  if (profileWrap && profileWrap.parentElement) mounts.push(profileWrap.parentElement);
  const notifParent = (() => {
    const wrap = header.querySelector('#notif-wrap');
    return wrap && wrap.parentElement ? wrap.parentElement : null;
  })();
  if (notifParent) mounts.push(notifParent);
  const quickAddParent = (() => {
    const quickAdd = header.querySelector('#quick-add');
    return quickAdd && quickAdd.parentElement ? quickAdd.parentElement : null;
  })();
  if (quickAddParent) mounts.push(quickAddParent);
  for (const node of mounts) {
    if (node instanceof HTMLElement && header.contains(node)) {
      return node;
    }
  }
  return header;
}

function placeHost(header, host) {
  if (!header || !host) return;
  const doc = header.ownerDocument || document;
  if (!doc) return;

  const nav = doc.getElementById('main-nav');
  if (nav) {
    const searchContainer = nav.querySelector('#universal-search-container');
    const calendarBtn = nav.querySelector('[data-nav="calendar"]');

    if (searchContainer && calendarBtn) {
      if (host.parentElement !== nav) {
        nav.insertBefore(host, calendarBtn);
      } else if (host.nextElementSibling !== calendarBtn) {
        nav.insertBefore(host, calendarBtn);
      }
      return;
    }

    if (searchContainer) {
      if (host.parentElement !== nav) {
        searchContainer.insertAdjacentElement('afterend', host);
      } else if (host.previousElementSibling !== searchContainer) {
        searchContainer.insertAdjacentElement('afterend', host);
      }
      return;
    }
  }

  const mount = pickHeaderMount(header);
  if (mount && mount !== header) {
    if (host.parentElement !== mount) {
      mount.appendChild(host);
    }
    return;
  }
  const notifWrap = header.querySelector('#notif-wrap');
  if (notifWrap && notifWrap.parentElement === header) {
    if (notifWrap.previousSibling !== host) {
      header.insertBefore(host, notifWrap);
    }
    return;
  }
  const quickAdd = header.querySelector('#quick-add');
  if (quickAdd && quickAdd.parentElement === header) {
    if (quickAdd.nextSibling !== host) {
      quickAdd.insertAdjacentElement('afterend', host);
    }
    return;
  }
  const grow = header.querySelector('.grow');
  if (grow && grow.parentElement === header) {
    if (grow.nextSibling !== host) {
      grow.insertAdjacentElement('afterend', host);
    }
    return;
  }
  if (host.parentElement !== header) {
    header.appendChild(host);
  }
}

function ensureHeaderToolbar() {
  if (typeof document === 'undefined') return false;
  try {
    const header = findHeaderNode();
    if (!header) {
      teardownQuickCreateBinding();
      headerState.header = null;
      headerState.wired = false;
      return false;
    }
    if (!isUnifiedNewEnabled()) {
      teardownQuickCreateBinding();
      if (headerState.host && headerState.host.parentElement) {
        try { headerState.host.remove(); }
        catch (_) {
          try { headerState.host.parentElement.removeChild(headerState.host); }
          catch (__err) { }
        }
      }
      headerState.host = null;
      headerState.toggle = null;
      headerState.header = header;
      headerState.wired = true;
      return true;
    }
    removeLegacyHeaderButtons(header);
    const host = ensureHostNode();
    if (!host) {
      teardownQuickCreateBinding();
      headerState.wired = false;
      return false;
    }
    placeHost(header, host);
    ensureQuickCreateBinding(host);
    headerState.header = header;
    headerState.wired = !!host.isConnected;
    if (host.isConnected) {
      emitHeaderOnlyBeacon();
    }
    return headerState.wired;
  } catch (err) {
    teardownQuickCreateBinding();
    headerState.wired = false;
    if (console && typeof console.warn === 'function') {
      console.warn('header toolbar injection failed', err);
    }
    return false;
  }
}

function scheduleHeaderEnsure() {
  if (headerState.pending) return;
  headerState.pending = true;
  const run = () => {
    headerState.pending = false;
    ensureHeaderToolbar();
  };
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(run);
    return;
  }
  if (typeof Promise === 'function') {
    Promise.resolve().then(run);
    return;
  }
  run();
}

function ensureHeaderObserver() {
  if (headerState.observer || typeof MutationObserver !== 'function') return;
  if (typeof document === 'undefined') return;
  const target = document.body || document.documentElement;
  if (!target) return;
  const observer = new MutationObserver(() => {
    scheduleHeaderEnsure();
  });
  try {
    observer.observe(target, { childList: true, subtree: true });
  } catch (_) {
    return;
  }
  headerState.observer = observer;
}

function initHeaderToolbar() {
  ensureHeaderObserver();
  scheduleHeaderEnsure();
}

function mountHeaderToolbarLifecycle(context) {
  if (typeof document === 'undefined') return;
  const doc = document;
  const root = doc.body || doc.documentElement;
  if (!root) return;
  const guard = ensureViewGuard(root, HEADER_GUARD_KEY);
  if (!guard) {
    return;
  }
  headerLifecycleGuard = guard;
  guard.addCleanup(() => {
    if (headerLifecycleGuard === guard) {
      headerLifecycleGuard = null;
    }
  });

  const run = () => {
    initHeaderToolbar();
  };

  if (doc.readyState === 'loading') {
    const onReady = () => run();
    try {
      doc.addEventListener('DOMContentLoaded', onReady, { once: true });
    } catch (_err) {
      doc.addEventListener('DOMContentLoaded', onReady);
    }
    guard.addCleanup(() => {
      try { doc.removeEventListener('DOMContentLoaded', onReady); }
      catch (_err) { }
    });
  } else {
    run();
  }

  guard.addCleanup(() => {
    const observer = headerState.observer;
    if (observer && typeof observer.disconnect === 'function') {
      try { observer.disconnect(); }
      catch (_err) { }
    }
    headerState.observer = null;
    headerState.pending = false;
  });

  guard.addCleanup(() => {
    teardownQuickCreateBinding();
    headerState.host = null;
    headerState.toggle = null;
    headerState.header = null;
    headerState.wired = false;
  });

  guard.addCleanup(() => closeQuickCreateMenu());

  if (context && typeof context.markBound === 'function') {
    context.markBound();
  }
}

function unmountHeaderToolbarLifecycle(context) {
  if (typeof document === 'undefined') return;
  const doc = document;
  const root = doc.body || doc.documentElement;
  if (!root) return;

  // Always call markUnbound to match the markBound from mount, regardless of guard state
  if (context && typeof context.markUnbound === 'function') {
    context.markUnbound();
  }

  const guard = headerLifecycleGuard || getViewGuard(root, HEADER_GUARD_KEY);
  if (!guard) {
    releaseViewGuard(root, HEADER_GUARD_KEY);
    return;
  }
  try { guard.release(); }
  catch (_err) { releaseViewGuard(root, HEADER_GUARD_KEY); }
  if (headerLifecycleGuard === guard) {
    headerLifecycleGuard = null;
  }
}

const HEADER_ROUTES = ['dashboard', 'pipeline', 'partners', 'longshots', 'notifications', 'calendar', 'reports', 'workbench', 'settings', 'templates', 'print'];
HEADER_ROUTES.forEach((route) => {
  onEnter(route, mountHeaderToolbarLifecycle);
  onLeave(route, unmountHeaderToolbarLifecycle);
});
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const PROFILE_KEY = 'profile:v1';
  const PHOTO_MAX_BYTES = 6 * 1024 * 1024;
  // localStorage is typically capped around 5 MB per-origin but strings are
  // stored as UTF-16, so keep writes under ~4 MB of characters to avoid quota
  // overflows once the data URL prefix is factored in.
  const LOCAL_STORAGE_SAFE_CHARS = 4 * 1024 * 1024;
  try {
    if (console && typeof console.info === 'function') {
      console.info('[A_BEACON] avatar: limit=6MB');
    }
  } catch (_err) { }
  // accept="image/" sentinel retained so legacy probes find the settings upload affordance.
  const FILE_INPUT_HTML = '<input type="file" accept="image/*">';

  function readProfileLocal() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_err) {
      return null;
    }
  }

  function isQuotaExceededError(err) {
    if (!err) return false;
    return err.name === 'QuotaExceededError'
      || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || err.code === 22
      || err.code === 1014;
  }

  function writeProfileLocal(profile) {
    try {
      if (profile && typeof profile === 'object') {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      } else {
        localStorage.removeItem(PROFILE_KEY);
      }
      return { ok: true, quota: false };
    } catch (err) {
      return { ok: false, quota: isQuotaExceededError(err), error: err };
    }
  }

  function mergeProfile(patch) {
    const current = readProfileLocal() || {};
    const merged = Object.assign({}, current, patch || {});
    const writeResult = writeProfileLocal(merged);
    if (writeResult.ok) {
      const settingsApi = getSettingsService();
      if (settingsApi && typeof settingsApi.save === 'function') {
        try {
          const result = settingsApi.save({ loProfile: merged });
          if (result && typeof result.then === 'function') {
            result.catch(() => { });
          }
        } catch (_err) { }
      }
      return { profile: merged, writeError: null };
    }
    return { profile: current, writeError: writeResult };
  }

  function renderHeader(profile) {
    const chip = document.getElementById('lo-profile-chip');
    if (!chip) return;
    const nameEl = chip.querySelector('[data-role="lo-name"]');
    const contactEl = chip.querySelector('[data-role="lo-contact"]');
    const name = typeof profile?.name === 'string' ? profile.name.trim() : '';
    const email = typeof profile?.email === 'string' ? profile.email.trim() : '';
    const phone = typeof profile?.phone === 'string' ? profile.phone.trim() : '';
    const photo = typeof profile?.photoDataUrl === 'string' ? profile.photoDataUrl : '';
    if (nameEl) {
      if (photo) {
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
      } else if (nameEl.__photoOriginal) {
        const original = nameEl.__photoOriginal;
        nameEl.style.display = original.display;
        nameEl.style.alignItems = original.alignItems;
        nameEl.style.gap = original.gap;
      }
      nameEl.textContent = name || 'Set your profile';
      if (photo) {
        let img = nameEl.querySelector('[data-role="lo-photo"]');
        if (!img) {
          img = document.createElement('img');
          img.dataset.role = 'lo-photo';
          img.alt = '';
          img.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
          nameEl.insertBefore(img, nameEl.firstChild);
        }
        img.src = photo;
      } else {
        const img = nameEl.querySelector('[data-role="lo-photo"]');
        if (img) img.remove();
      }
    }
    if (contactEl) {
      const parts = [];
      if (email) parts.push(email);
      if (phone) parts.push(phone);
      contactEl.textContent = parts.length ? parts.join(' • ') : '—';
    }
  }

  function renderPhotoPreview(photo) {
    const preview = document.getElementById('lo-photo-preview');
    const emptyState = document.getElementById('lo-photo-empty');
    if (preview) {
      if (photo) {
        preview.src = photo;
        preview.style.display = 'block';
      } else {
        preview.removeAttribute('src');
        preview.style.display = 'none';
      }
    }
    if (emptyState) {
      emptyState.style.display = photo ? 'none' : '';
    }
  }

  function applyProfile(profile) {
    renderHeader(profile || {});
    const photo = profile && typeof profile.photoDataUrl === 'string' ? profile.photoDataUrl : '';
    renderPhotoPreview(photo);
  }

  function handleFileInput(input) {
    const file = input && input.files ? input.files[0] : null;
    if (!file) {
      if (input) input.value = '';
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show('Please choose an image under 6 MB.');
      }
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = reader.result;
      if (typeof result === 'string') {
        if (result.length > LOCAL_STORAGE_SAFE_CHARS) {
          if (window.Toast && typeof window.Toast.show === 'function') {
            window.Toast.show('Image is too large to store locally. Please choose a smaller photo (about 3.5 MB or less).');
          }
          input.value = '';
          return;
        }
        const { profile, writeError } = mergeProfile({ photoDataUrl: result });
        if (writeError && window.Toast && typeof window.Toast.show === 'function') {
          if (writeError.quota) {
            window.Toast.show('Browser storage quota exceeded. Please choose a smaller photo (about 3.5 MB or less).');
          } else {
            window.Toast.show('Unable to store photo locally. Please try again.');
          }
        }
        applyProfile(profile);
      } else if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    });
    reader.addEventListener('error', () => {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    });
    try {
      reader.readAsDataURL(file);
    } catch (_err) {
      if (window.Toast && typeof window.Toast.show === 'function') {
        window.Toast.show('Unable to read image.');
      }
      input.value = '';
    }
  }

  function handleClear() {
    const { profile, writeError } = mergeProfile({ photoDataUrl: '' });
    if (writeError && window.Toast && typeof window.Toast.show === 'function') {
      window.Toast.show(writeError.quota ? 'Unable to clear photo due to storage quota.' : 'Unable to clear photo.');
    }
    applyProfile(profile);
  }

  function ensureControls() {
    const panel = document.getElementById('lo-profile-settings');
    if (!panel) return;
    let input = document.getElementById('lo-photo');
    const label = panel.querySelector('label:last-of-type') || panel;
    if (!input) {
      const template = document.createElement('div');
      template.innerHTML = FILE_INPUT_HTML;
      input = template.firstElementChild;
      if (!input) {
        return;
      }
      input.id = 'lo-photo';
      label.appendChild(input);
    }
    input.type = 'file';
    input.setAttribute('accept', 'image/*');
    if (!input.__headerToolbar) {
      input.__headerToolbar = true;
      input.addEventListener('change', evt => {
        const target = evt && evt.target instanceof HTMLInputElement ? evt.target : input;
        handleFileInput(target);
      });
    }
    const clearBtn = document.getElementById('btn-lo-photo-clear');
    if (clearBtn && !clearBtn.__headerToolbar) {
      clearBtn.__headerToolbar = true;
      clearBtn.addEventListener('click', evt => {
        evt.preventDefault();
        evt.stopPropagation();
        handleClear();
      });
    }
  }

  ensureControlsRef = ensureControls;

  function hydrate() {
    const localProfile = readProfileLocal();
    if (localProfile) {
      applyProfile(localProfile);
      return;
    }
    const settingsApi = getSettingsService();
    if (settingsApi && typeof settingsApi.get === 'function') {
      Promise.resolve(settingsApi.get())
        .then(data => {
          const profile = data && typeof data.loProfile === 'object' ? data.loProfile : {};
          if (profile && typeof profile === 'object') {
            const writeResult = writeProfileLocal(profile);
            if (!writeResult.ok && writeResult.quota && window.Toast && typeof window.Toast.show === 'function') {
              window.Toast.show('Stored profile is too large for browser storage. Please reduce the avatar size.');
            }
            applyProfile(profile);
          }
        })
        .catch(() => { });
    }
  }

  const init = () => {
    ensureControls();
    hydrate();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('storage', evt => {
    if (evt && evt.key === PROFILE_KEY) {
      hydrate();
    }
  });

  document.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope;
    if (scope && scope !== 'settings') return;
    hydrate();
  });
})();
