import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildDefaultConfig,
  normalizeDashboardConfig,
  readDashboardConfig,
  writeDashboardConfig,
  DASHBOARD_WIDGETS,
  isTodayWidget
} from '../../crm-app/js/dashboard/config.js';

type Store = Record<string, string>;

class MemoryStorage {
  private store: Store = {};
  getItem(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

declare const global: any;

describe('dashboard config', () => {
  beforeEach(() => {
    global.localStorage = new MemoryStorage();
  });

  it('builds defaults for all widgets', () => {
    const defaults = buildDefaultConfig();
    expect(defaults.widgets).toHaveLength(DASHBOARD_WIDGETS.length);
    expect(defaults.widgets.every(entry => entry.visible)).toBe(true);
    expect(defaults.defaultToAll).toBe(false);
    expect(defaults.includeTodayInAll).toBe(true);
  });

  it('normalizes invalid config and re-numbers order', () => {
    const config = normalizeDashboardConfig({
      widgets: [
        { id: DASHBOARD_WIDGETS[0].id, visible: false, order: -10 },
        { id: 'unknown', visible: true, order: 2 }
      ],
      defaultToAll: true,
      includeTodayInAll: false
    });
    expect(config.widgets[0].id).toBe(DASHBOARD_WIDGETS[0].id);
    expect(config.widgets[0].order).toBe(1);
    expect(config.defaultToAll).toBe(true);
    expect(config.includeTodayInAll).toBe(false);
    const ids = config.widgets.map(entry => entry.id);
    DASHBOARD_WIDGETS.forEach(widget => expect(ids).toContain(widget.id));
  });

  it('persists to localStorage when reading and writing', () => {
    const stored = readDashboardConfig();
    expect(stored.widgets.length).toBe(DASHBOARD_WIDGETS.length);
    stored.widgets[0].visible = false;
    const updated = writeDashboardConfig(stored);
    expect(updated.widgets[0].visible).toBe(false);
    const hydrated = readDashboardConfig();
    expect(hydrated.widgets[0].visible).toBe(false);
  });

  it('identifies today-focused widgets', () => {
    expect(isTodayWidget('today')).toBe(true);
    expect(isTodayWidget('pipeline')).toBe(false);
  });
});
