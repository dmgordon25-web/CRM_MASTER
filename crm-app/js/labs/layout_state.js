const VISIBILITY_PREFIX = 'labs:layout:';
const VISIBILITY_SUFFIX = ':visibility';

function visibilityStorageKey(sectionId) {
  const safeId = sectionId ? String(sectionId).trim() : 'default';
  return `${VISIBILITY_PREFIX}${safeId}${VISIBILITY_SUFFIX}`;
}

function readVisibility(sectionId) {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(visibilityStorageKey(sectionId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch (_err) {}
  return {};
}

function writeVisibility(sectionId, state) {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = state && typeof state === 'object' ? state : {};
    if (Object.keys(payload).length) {
      localStorage.setItem(visibilityStorageKey(sectionId), JSON.stringify(payload));
    } else {
      localStorage.removeItem(visibilityStorageKey(sectionId));
    }
  } catch (_err) {}
}

export function loadSectionLayoutState(sectionId) {
  const visible = readVisibility(sectionId) || {};
  return { visible };
}

export function saveSectionLayoutState(sectionId, layoutState) {
  const visible = layoutState && layoutState.visible && typeof layoutState.visible === 'object'
    ? layoutState.visible
    : {};
  writeVisibility(sectionId, visible);
}
