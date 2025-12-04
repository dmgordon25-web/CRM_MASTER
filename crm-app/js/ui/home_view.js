import { getSettingsApi } from '../app_context.js';

const STORAGE_KEY = 'crm:homeView';
const HOME_VIEW_DASHBOARD = 'dashboard';
const HOME_VIEW_LABS = 'labs';

let cached = null;
let hydrating = false;

function normalizeHomeView(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return text === HOME_VIEW_LABS ? HOME_VIEW_LABS : HOME_VIEW_DASHBOARD;
}

function readLocal() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (typeof stored === 'string' && stored.trim()) {
      return normalizeHomeView(stored);
    }
  } catch (_err) { /* noop */ }
  return null;
}

function writeLocal(value) {
  try { localStorage.setItem(STORAGE_KEY, normalizeHomeView(value)); }
  catch (_err) { /* noop */ }
}

async function hydrateFromSettings() {
  if (hydrating) return cached || HOME_VIEW_DASHBOARD;
  const settingsApi = getSettingsApi();
  if (!settingsApi || typeof settingsApi.get !== 'function') {
    return cached || HOME_VIEW_DASHBOARD;
  }
  hydrating = true;
  try {
    const data = await settingsApi.get();
    const preference = normalizeHomeView(data && data.ui && data.ui.homeView);
    cached = preference;
    writeLocal(preference);
    return preference;
  } catch (_err) {
    return cached || HOME_VIEW_DASHBOARD;
  } finally {
    hydrating = false;
  }
}

function ensureInitialized() {
  if (cached) return cached;
  const localValue = readLocal();
  cached = localValue || HOME_VIEW_DASHBOARD;
  hydrateFromSettings();
  return cached;
}

function getHomeViewPreference() {
  return ensureInitialized();
}

function setHomeViewPreference(value, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const preference = normalizeHomeView(value);
  cached = preference;
  writeLocal(preference);
  if (opts.persist === false) {
    return preference;
  }
  const settingsApi = getSettingsApi();
  if (settingsApi && typeof settingsApi.save === 'function') {
    try { settingsApi.save({ ui: { homeView: preference } }, { silent: opts.silent !== false }); }
    catch (_err) { /* noop */ }
  }
  return preference;
}

export {
  HOME_VIEW_DASHBOARD,
  HOME_VIEW_LABS,
  normalizeHomeView,
  getHomeViewPreference,
  setHomeViewPreference,
  hydrateFromSettings
};

export default {
  HOME_VIEW_DASHBOARD,
  HOME_VIEW_LABS,
  normalizeHomeView,
  getHomeViewPreference,
  setHomeViewPreference,
  hydrateFromSettings
};
