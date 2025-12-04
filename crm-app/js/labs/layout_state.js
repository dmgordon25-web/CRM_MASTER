const STORAGE_PREFIX = 'labs:layout:';
const ORDER_KEY = 'order';
const WIDTHS_KEY = 'widths';
const VISIBILITY_KEY = 'visibility';
const PRESET_KEY = 'preset';

function safeSectionId(sectionId) {
  const normalized = sectionId == null ? '' : String(sectionId).trim();
  return normalized || 'default';
}

export function layoutStorageKey(sectionId, kind) {
  const suffix = kind ? String(kind).trim() : '';
  return `${STORAGE_PREFIX}${safeSectionId(sectionId)}${suffix ? `:${suffix}` : ''}`;
}

function readJson(key) {
  if (typeof localStorage === 'undefined' || !key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_err) {
    return null;
  }
}

function writeJson(key, value) {
  if (typeof localStorage === 'undefined' || !key) return;
  try {
    if (value == null) {
      localStorage.removeItem(key);
      return;
    }
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch (_err) {}
}

export function loadSectionLayoutState(sectionId) {
  let order = readJson(layoutStorageKey(sectionId, ORDER_KEY));
  if (!order) {
    const legacyOrder = readJson(`${STORAGE_PREFIX}${safeSectionId(sectionId)}`);
    if (Array.isArray(legacyOrder)) order = legacyOrder;
  }

  let widths = readJson(layoutStorageKey(sectionId, WIDTHS_KEY));
  if (!widths) {
    const legacyWidths = readJson(`labs:widths:${safeSectionId(sectionId)}`);
    if (legacyWidths && typeof legacyWidths === 'object') widths = legacyWidths;
  }
  const visibility = readJson(layoutStorageKey(sectionId, VISIBILITY_KEY));

  return {
    order: Array.isArray(order) ? order.map(String) : null,
    widths: widths && typeof widths === 'object' ? widths : null,
    visibility: visibility && typeof visibility === 'object' ? visibility : null
  };
}

export function saveSectionLayoutState(sectionId, state) {
  const nextState = state || {};

  const order = Array.isArray(nextState.order) ? nextState.order.map(String) : null;
  writeJson(layoutStorageKey(sectionId, ORDER_KEY), order && order.length ? order : null);

  const widths = nextState.widths && typeof nextState.widths === 'object' ? nextState.widths : null;
  writeJson(layoutStorageKey(sectionId, WIDTHS_KEY), widths && Object.keys(widths).length ? widths : null);

  const visibility = nextState.visibility && typeof nextState.visibility === 'object'
    ? nextState.visibility
    : null;
  writeJson(
    layoutStorageKey(sectionId, VISIBILITY_KEY),
    visibility && Object.keys(visibility).length ? visibility : null
  );
}

export function clearSectionLayoutState(sectionId) {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(layoutStorageKey(sectionId, ORDER_KEY));
  localStorage.removeItem(layoutStorageKey(sectionId, WIDTHS_KEY));
  localStorage.removeItem(layoutStorageKey(sectionId, VISIBILITY_KEY));
  localStorage.removeItem(layoutStorageKey(sectionId, PRESET_KEY));
  localStorage.removeItem(`${STORAGE_PREFIX}${safeSectionId(sectionId)}`);
  localStorage.removeItem(`labs:widths:${safeSectionId(sectionId)}`);
}

export function loadSectionPreset(sectionId) {
  const value = readJson(layoutStorageKey(sectionId, PRESET_KEY));
  return typeof value === 'string' ? value : null;
}

export function saveSectionPreset(sectionId, presetKey) {
  const value = presetKey ? String(presetKey).trim() : '';
  writeJson(layoutStorageKey(sectionId, PRESET_KEY), value || null);
}
