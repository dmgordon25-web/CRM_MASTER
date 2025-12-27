import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const THEME_KEY = 'crm:theme';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => {
      const value = store.get(String(key));
      return typeof value === 'undefined' ? null : value;
    },
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    }
  };
}

describe('theme preferences', () => {
  let originalDocument;
  let originalWindow;
  let originalLocalStorage;
  let originalLocation;

  function createEnvironment(search = '') {
    const storage = createMemoryStorage();
    const body = { dataset: {} };
    const stubDocument = {
      body,
      querySelector: () => null,
      getElementById: () => null,
      addEventListener: () => {}
    };
    global.document = stubDocument;
    global.localStorage = storage;
    global.window = { document: global.document, localStorage: storage };
    global.location = { search };
  }

  async function loadThemeApi(search = '') {
    vi.resetModules();
    createEnvironment(search);
    await import('../../crm-app/js/settings_forms.js');
    return global.window.__crmThemePrefs;
  }

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;
    originalLocation = global.location;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
    global.location = originalLocation;
  });

  it('applies and persists the selected theme immediately', async () => {
    const themeApi = await loadThemeApi();
    const chosen = themeApi.setThemePreference('ocean');
    expect(chosen).toBe('ocean');
    expect(global.document.body.dataset.theme).toBe('ocean');
    expect(global.localStorage.getItem(THEME_KEY)).toBe('ocean');
  });

  it('restores the persisted theme after a reload', async () => {
    const themeApi = await loadThemeApi();
    themeApi.setThemePreference('dark');

    const nextBody = { dataset: {} };
    global.document = { body: nextBody };
    global.window.document = global.document;

    themeApi.applyTheme(themeApi.getThemePreference());
    expect(nextBody.dataset.theme).toBe('dark');
  });

  it('clears the preference when classic is selected', async () => {
    const themeApi = await loadThemeApi();
    themeApi.setThemePreference('dark');
    themeApi.setThemePreference('classic');

    expect(global.document.body.dataset.theme).toBeUndefined();
    expect(global.localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('does not apply saved themes while safe mode is active', async () => {
    const themeApi = await loadThemeApi('?safe=1');
    themeApi.setThemePreference('dark');

    expect(global.localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(global.document.body.dataset.theme).toBeUndefined();

    themeApi.applyTheme(themeApi.getThemePreference());
    expect(global.document.body.dataset.theme).toBeUndefined();
  });
});
