import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      if (!Number.isInteger(index) || index < 0 || index >= store.size) return null;
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      if (key == null) return null;
      const value = store.get(String(key));
      return value === undefined ? null : value;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

const moduleUrl = new URL('../../crm-app/js/ui/dashboard_layout.js', import.meta.url);

async function importLayoutModule() {
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return import(`${moduleUrl.href}?t=${cacheBuster}`);
}

describe('dashboard layout persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    globalThis.localStorage = createMemoryStorage();
    globalThis.window = undefined;
    globalThis.document = undefined;
  });

  afterEach(() => {
    vi.resetModules();
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.document;
  });

  it('persists layout mode across reloads and clears on reset', async () => {
    const first = await importLayoutModule();
    first.setDashboardLayoutMode(true);
    expect(globalThis.localStorage.getItem('dash:layoutMode:v1')).toBe('1');

    const second = await importLayoutModule();
    expect(second.readStoredLayoutMode()).toBe(true);

    const result = second.resetDashboardLayoutState({ skipLayoutPass: true });
    expect(Array.isArray(result.removedKeys)).toBe(true);
    expect(globalThis.localStorage.getItem('dash:layoutMode:v1')).toBeNull();

    const third = await importLayoutModule();
    expect(third.readStoredLayoutMode()).toBe(false);
  });

  it('clears persisted hidden widget ids', async () => {
    const first = await importLayoutModule();
    first.applyDashboardHidden(new Set(['goal-progress-card']));
    globalThis.localStorage.setItem('dash:layout:order:v1', JSON.stringify(['goal-progress-card']));
    expect(globalThis.localStorage.getItem('dash:layout:hidden:v1')).toContain('goal-progress-card');

    const second = await importLayoutModule();
    expect(second.readStoredHiddenIds()).toEqual(['goal-progress-card']);

    second.resetDashboardLayoutState({ skipLayoutPass: true });
    expect(globalThis.localStorage.getItem('dash:layout:hidden:v1')).toBeNull();
    expect(globalThis.localStorage.getItem('dash:layout:order:v1')).toBeNull();

    const third = await importLayoutModule();
    expect(third.readStoredHiddenIds()).toEqual([]);
  });
});
