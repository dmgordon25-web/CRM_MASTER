const STORAGE_PREFIX = 'labs:layout:';
const CURRENT_VERSION = 1;

const WIDTH_TOKENS = ['w1', 'w2', 'w3'];
const SIZE_TO_WIDTH = {
  small: 'w1',
  medium: 'w2',
  large: 'w3'
};

function safeSectionId(sectionId) {
  const normalized = sectionId == null ? '' : String(sectionId).trim();
  return normalized || 'default';
}

function layoutStorageKey(sectionId) {
  return `${STORAGE_PREFIX}${safeSectionId(sectionId)}`;
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
  } catch (_err) { }
}

function normalizeWidthToken(token) {
  const raw = typeof token === 'string' ? token.trim() : '';
  if (WIDTH_TOKENS.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (SIZE_TO_WIDTH[lower]) return SIZE_TO_WIDTH[lower];
  return '';
}

function defaultWidthToken(size) {
  const key = typeof size === 'string' ? size.toLowerCase() : '';
  return SIZE_TO_WIDTH[key] || 'w2';
}

function buildDefaults(defaultWidgets = []) {
  const order = [];
  const widths = {};
  const visibility = {};
  (Array.isArray(defaultWidgets) ? defaultWidgets : []).forEach((widget) => {
    const id = widget?.id ? String(widget.id) : '';
    if (!id || order.includes(id)) return;
    order.push(id);
    widths[id] = defaultWidthToken(widget?.size);
    visibility[id] = true;
  });
  return { order, widths, visibility };
}

function mergeOrder(defaultOrder, storedOrder = []) {
  const normalizedDefault = Array.isArray(defaultOrder) ? defaultOrder : [];
  const normalizedStored = Array.isArray(storedOrder) ? storedOrder.map(String) : [];
  const seen = new Set();
  const merged = [];

  normalizedStored.forEach((id) => {
    if (!id || seen.has(id)) return;
    if (normalizedDefault.includes(id)) {
      merged.push(id);
      seen.add(id);
    }
  });

  normalizedDefault.forEach((id) => {
    if (!id || seen.has(id)) return;
    merged.push(id);
    seen.add(id);
  });

  return merged;
}

function normalizeLayout(defaultWidgets, rawState) {
  const defaults = buildDefaults(defaultWidgets);
  const order = mergeOrder(defaults.order, rawState?.order);

  const widths = {};
  order.forEach((id) => {
    const override = rawState?.widths?.[id];
    const normalized = normalizeWidthToken(override);
    widths[id] = normalized || defaults.widths[id] || 'w2';
  });

  const visibility = {};
  order.forEach((id) => {
    const stored = rawState?.visibility?.[id];
    visibility[id] = stored === false ? false : true;
  });

  const preset = typeof rawState?.preset === 'string' ? rawState.preset : '';

  return {
    version: CURRENT_VERSION,
    order,
    widths,
    visibility,
    preset
  };
}

function migrateLegacy(sectionId) {
  const safeId = safeSectionId(sectionId);
  const prefix = `${STORAGE_PREFIX}${safeId}`;
  const legacyOrder = readJson(`${prefix}:order`) || readJson(prefix);
  const legacyWidths = readJson(`${prefix}:widths`) || readJson(`labs:widths:${safeId}`);
  const legacyVisibility = readJson(`${prefix}:visibility`);
  const legacyPreset = readJson(`${prefix}:preset`);

  const hasLegacy = !!(legacyOrder || legacyWidths || legacyVisibility || legacyPreset);
  if (!hasLegacy) return null;

  const merged = {
    order: Array.isArray(legacyOrder) ? legacyOrder.map(String) : [],
    widths: legacyWidths && typeof legacyWidths === 'object' ? legacyWidths : {},
    visibility: legacyVisibility && typeof legacyVisibility === 'object' ? legacyVisibility : {},
    preset: typeof legacyPreset === 'string' ? legacyPreset : ''
  };

  // Clean up legacy fragments after migration to reduce confusion.
  clearLegacyKeys(safeId);
  return merged;
}

function clearLegacyKeys(sectionId) {
  if (typeof localStorage === 'undefined') return;
  const safeId = safeSectionId(sectionId);
  const prefix = `${STORAGE_PREFIX}${safeId}`;
  localStorage.removeItem(`${prefix}:order`);
  localStorage.removeItem(`${prefix}:widths`);
  localStorage.removeItem(`${prefix}:visibility`);
  localStorage.removeItem(`${prefix}:preset`);
  localStorage.removeItem(prefix);
  localStorage.removeItem(`labs:widths:${safeId}`);
}

export function loadSectionLayout(sectionId, defaultWidgets = []) {
  const key = layoutStorageKey(sectionId);
  const safeId = safeSectionId(sectionId);
  let stored = readJson(key);

  if (!stored) {
    const migrated = migrateLegacy(safeId);
    if (migrated) {
      const normalized = normalizeLayout(defaultWidgets, migrated);
      writeJson(key, normalized);
      return normalized;
    }
  }

  if (!stored || typeof stored !== 'object') {
    const normalized = normalizeLayout(defaultWidgets, {});
    writeJson(key, normalized);
    return normalized;
  }

  const normalized = normalizeLayout(defaultWidgets, stored);
  if (!stored.version || stored.version !== CURRENT_VERSION) {
    writeJson(key, normalized);
  }
  return normalized;
}

export function saveSectionLayout(sectionId, layout, defaultWidgets = []) {
  const normalized = normalizeLayout(defaultWidgets, layout || {});
  writeJson(layoutStorageKey(sectionId), normalized);
  return normalized;
}

export function resetSectionLayout(sectionId, defaultWidgets = []) {
  const defaults = normalizeLayout(defaultWidgets, {});
  writeJson(layoutStorageKey(sectionId), defaults);
  clearLegacyKeys(sectionId);
  return defaults;
}

export function applyPresetToSection(sectionId, presetId, defaultWidgets = [], presetConfig = {}) {
  const safePreset = presetId ? String(presetId).trim() : '';
  if (!safePreset || safePreset === 'default') {
    return resetSectionLayout(sectionId, defaultWidgets);
  }

  // Sticky Hiding Logic:
  // We want to respect the user's explicit choice to hide a widget.
  // If the user currently has a widget hidden, applying a preset should NOT re-show it.
  // Exception: If the user resets the layout, that's handled by resetSectionLayout.
  const currentLayout = loadSectionLayout(sectionId, defaultWidgets);
  const currentVisibility = currentLayout?.visibility || {};

  const defaults = buildDefaults(defaultWidgets);
  const order = mergeOrder(defaults.order, presetConfig.order);
  const widths = {};

  order.forEach((id) => {
    const override = presetConfig.widths?.[id];
    const normalized = normalizeWidthToken(override);
    widths[id] = normalized || defaults.widths[id] || 'w2';
  });

  const visibility = {};
  order.forEach((id) => {
    // 1. If currently hidden by user, keep it hidden (sticky).
    if (currentVisibility[id] === false) {
      visibility[id] = false;
      return;
    }

    // 2. Otherwise apply preset preference.
    const presetVisible = presetConfig.visibility?.[id];
    visibility[id] = presetVisible === false ? false : true;
  });

  const layout = {
    version: CURRENT_VERSION,
    order,
    widths,
    visibility,
    preset: safePreset
  };
  return saveSectionLayout(sectionId, layout, defaultWidgets);
}

export { layoutStorageKey };
