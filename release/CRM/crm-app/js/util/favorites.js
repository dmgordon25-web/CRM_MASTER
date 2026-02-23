const FAVORITE_TYPES = new Set(['contact', 'partner']);

function normalizeFavoriteId(value) {
  if (value == null) return '';
  const str = String(value).trim();
  return str;
}

function normalizeFavoriteList(input) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const result = [];
  for (let i = 0; i < list.length; i += 1) {
    const id = normalizeFavoriteId(list[i]);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function normalizeFavoriteSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    contacts: normalizeFavoriteList(source.contacts),
    partners: normalizeFavoriteList(source.partners)
  };
}

export function ensureFavoriteState() {
  const win = typeof window === 'undefined' ? null : window;
  if (!win) {
    return { contacts: new Set(), partners: new Set() };
  }
  const existing = win.__FAVORITES_STATE__;
  if (existing && existing.contacts instanceof Set && existing.partners instanceof Set) {
    return existing;
  }
  const state = {
    contacts: new Set(),
    partners: new Set()
  };
  win.__FAVORITES_STATE__ = state;
  return state;
}

export function applyFavoriteSnapshot(snapshot) {
  const normalized = normalizeFavoriteSnapshot(snapshot);
  const state = ensureFavoriteState();
  state.contacts.clear();
  normalized.contacts.forEach(id => state.contacts.add(id));
  state.partners.clear();
  normalized.partners.forEach(id => state.partners.add(id));
  return normalized;
}

function escapeAttr(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function renderFavoriteToggle(type, recordId, active) {
  const normalizedType = FAVORITE_TYPES.has(type) ? type : 'contact';
  const id = normalizeFavoriteId(recordId);
  const isActive = Boolean(active);
  const labelType = normalizedType === 'partner' ? 'partner' : 'contact';
  const label = isActive
    ? `Remove ${labelType} from favorites`
    : `Add ${labelType} to favorites`;
  const classes = ['favorite-toggle'];
  if (isActive) classes.push('is-active');
  const attrs = [
    'type="button"',
    `class="${classes.join(' ')}"`,
    'data-role="favorite-toggle"',
    `data-favorite-type="${normalizedType}"`,
    `data-record-id="${escapeAttr(id)}"`,
    `aria-pressed="${isActive ? 'true' : 'false'}"`,
    `aria-label="${escapeAttr(label)}"`
  ];
  return `<button ${attrs.join(' ')}>${isActive ? '★' : '☆'}</button>`;
}

function getFavoriteSet(type) {
  const state = ensureFavoriteState();
  return type === 'partner' ? state.partners : state.contacts;
}

export function isFavorite(type, id) {
  const key = normalizeFavoriteId(id);
  if (!key) return false;
  return getFavoriteSet(type).has(key);
}

export function setFavoriteLocal(type, id, active) {
  const key = normalizeFavoriteId(id);
  if (!key) {
    return { changed: false, active: false };
  }
  const set = getFavoriteSet(type);
  const current = set.has(key);
  const next = active == null ? !current : Boolean(active);
  if (current === next) {
    return { changed: false, active: current };
  }
  if (next) set.add(key);
  else set.delete(key);
  return { changed: true, active: next };
}

export function updateFavoriteButtonDom(node, type, id, active) {
  if (!node) return;
  const normalizedType = FAVORITE_TYPES.has(type) ? type : 'contact';
  const key = normalizeFavoriteId(id);
  const isActive = Boolean(active);
  node.dataset.favoriteType = normalizedType;
  node.dataset.recordId = key;
  node.setAttribute('data-favorite-type', normalizedType);
  node.setAttribute('data-record-id', key);
  node.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  const labelType = normalizedType === 'partner' ? 'partner' : 'contact';
  node.setAttribute('aria-label', isActive
    ? `Remove ${labelType} from favorites`
    : `Add ${labelType} to favorites`);
  node.classList.toggle('is-active', isActive);
  node.textContent = isActive ? '★' : '☆';
}

export function syncFavoriteDom(type, id, active) {
  if (typeof document === 'undefined') return;
  const normalizedType = FAVORITE_TYPES.has(type) ? type : 'contact';
  const key = normalizeFavoriteId(id);
  if (!key) return;
  const buttons = Array.from(document.querySelectorAll('[data-role="favorite-toggle"]'));
  buttons.forEach(button => {
    if (!button || button.dataset.favoriteType !== normalizedType) return;
    if (normalizeFavoriteId(button.dataset.recordId) !== key) return;
    updateFavoriteButtonDom(button, normalizedType, key, active);
  });
  const hosts = Array.from(document.querySelectorAll('[data-role="favorite-host"]'));
  hosts.forEach(host => {
    if (!host || host.dataset.favoriteType !== normalizedType) return;
    if (normalizeFavoriteId(host.dataset.recordId) !== key) return;
    host.dataset.recordId = key;
    host.setAttribute('data-record-id', key);
    if (active) {
      host.classList.add('is-favorite');
      host.setAttribute('data-favorite', '1');
    } else {
      host.classList.remove('is-favorite');
      host.removeAttribute('data-favorite');
    }
  });
  const selector = normalizedType === 'partner'
    ? '[data-partner-id]'
    : '[data-contact-id]';
  const rows = Array.from(document.querySelectorAll(selector));
  rows.forEach(row => {
    if (!row) return;
    const rowId = normalizeFavoriteId(
      normalizedType === 'partner'
        ? row.getAttribute('data-partner-id') || row.dataset.partnerId
        : row.getAttribute('data-contact-id') || row.dataset.contactId || row.getAttribute('data-id')
    );
    if (rowId !== key) return;
    if (active) {
      row.classList.add('is-favorite');
      row.setAttribute('data-favorite', '1');
    } else {
      row.classList.remove('is-favorite');
      row.removeAttribute('data-favorite');
    }
  });
}

export async function persistFavorites(options = {}) {
  const win = typeof window === 'undefined' ? null : window;
  if (!win || !win.Settings || typeof win.Settings.save !== 'function') {
    return false;
  }
  const state = ensureFavoriteState();
  const payload = {
    favorites: {
      contacts: Array.from(state.contacts),
      partners: Array.from(state.partners)
    }
  };
  const silent = options.silent !== undefined ? options.silent : true;
  await win.Settings.save(payload, { silent });
  return true;
}

export async function toggleFavorite(type, id, options = {}) {
  const normalizedType = FAVORITE_TYPES.has(type) ? type : 'contact';
  const result = setFavoriteLocal(normalizedType, id);
  syncFavoriteDom(normalizedType, id, result.active);
  if (!result.changed) {
    if (typeof window !== 'undefined' && typeof window.renderFavoritesWidget === 'function') {
      try { window.renderFavoritesWidget(); } catch (_err) {}
    }
    return result.active;
  }
  try {
    await persistFavorites({ silent: options.silent !== false });
    if (typeof window !== 'undefined' && typeof window.renderFavoritesWidget === 'function') {
      try { window.renderFavoritesWidget(); } catch (_err) {}
    }
    return result.active;
  } catch (err) {
    setFavoriteLocal(normalizedType, id, !result.active);
    syncFavoriteDom(normalizedType, id, !result.active);
    if (typeof window !== 'undefined' && typeof window.renderFavoritesWidget === 'function') {
      try { window.renderFavoritesWidget(); } catch (_err) {}
    }
    throw err;
  }
}

const FAVORITES_EXPORT = {
  ensureFavoriteState,
  normalizeFavoriteSnapshot,
  applyFavoriteSnapshot,
  renderFavoriteToggle,
  isFavorite,
  setFavoriteLocal,
  updateFavoriteButtonDom,
  syncFavoriteDom,
  persistFavorites,
  toggleFavorite
};

if (typeof window !== 'undefined') {
  const existing = window.__CRM_FAVORITES__ && typeof window.__CRM_FAVORITES__ === 'object'
    ? window.__CRM_FAVORITES__
    : {};
  window.__CRM_FAVORITES__ = Object.assign({}, existing, FAVORITES_EXPORT);
}

export default FAVORITES_EXPORT;
