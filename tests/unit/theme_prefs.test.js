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
  let themeApi;

  beforeEach(async () => {
    vi.resetModules();
    originalDocument = global.document;
    originalWindow = global.window;
    originalLocalStorage = global.localStorage;

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

    await import('../../crm-app/js/settings_forms.js');
    themeApi = global.window.__crmThemePrefs;
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.localStorage = originalLocalStorage;
  });

  it('applies and persists the selected theme immediately', () => {
    const chosen = themeApi.setThemePreference('ocean');
    expect(chosen).toBe('ocean');
    expect(global.document.body.dataset.theme).toBe('ocean');
    expect(global.localStorage.getItem(THEME_KEY)).toBe('ocean');
  });

  it('restores the persisted theme after a reload', () => {
    themeApi.setThemePreference('dark');

    const nextBody = { dataset: {} };
    global.document = { body: nextBody };
    global.window.document = global.document;

    themeApi.applyTheme(themeApi.getThemePreference());
    expect(nextBody.dataset.theme).toBe('dark');
  });

  it('clears the preference when classic is selected', () => {
    themeApi.setThemePreference('dark');
    themeApi.setThemePreference('classic');

    expect(global.document.body.dataset.theme).toBeUndefined();
    expect(global.localStorage.getItem(THEME_KEY)).toBeNull();
  });
});
