import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

let handler;
let setHooks;

function bootstrapGlobals() {
  const doc = {
    readyState: 'complete',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
    createElement: () => ({
      style: {},
      setAttribute() {},
      appendChild() {},
      innerHTML: '',
      classList: { add() {}, remove() {}, contains() { return false; } },
      dataset: {},
      querySelector: () => null,
      querySelectorAll: () => []
    }),
    body: {
      appendChild() {},
      querySelector: () => null
    }
  };

  globalThis.window = globalThis.window || {};
  globalThis.document = doc;
  globalThis.navigator = globalThis.navigator || { userAgent: 'vitest' };
}

function makeSyntheticRow({ contactId = '', partnerId = '', widget = '' } = {}) {
  const attrs = {};
  if (widget) attrs['data-dash-widget'] = widget;
  if (contactId) attrs['data-contact-id'] = contactId;
  if (partnerId) attrs['data-partner-id'] = partnerId;

  const row = {
    attrs,
    parent: null,
    closest(selector) {
      const hasId = Boolean(this.attrs['data-contact-id'] || this.attrs['data-partner-id']);
      const matchesDrilldown = selector === '[data-contact-id],[data-partner-id]' || selector.includes('[data-contact-id]') || selector.includes('[data-partner-id]');
      if (matchesDrilldown && hasId) return this;
      return this.parent && typeof this.parent.closest === 'function'
        ? this.parent.closest(selector)
        : null;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    setAttribute(name, value) {
      this.attrs[name] = value;
      return value;
    }
  };

  const child = {
    parent: row,
    closest(selector) {
      return this.parent && typeof this.parent.closest === 'function'
        ? this.parent.closest(selector)
        : null;
    },
    getAttribute() {
      return null;
    }
  };

  return { row, child };
}

beforeAll(async () => {
  bootstrapGlobals();
  const mod = await import('../../crm-app/js/dashboard/index.js');
  handler = mod.__getHandleDashboardClickForTest();
  setHooks = mod.__setDashboardDrilldownTestHooks;
});

afterEach(() => {
  setHooks({});
});

describe('dashboard drilldown widgets', () => {
  it('opens contact editor from Priority Actions row', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { child } = makeSyntheticRow({ contactId: 'contact-123', widget: 'priorityActions' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('contact-123');
  });

  it('opens contact editor from Milestones Ahead row', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { child } = makeSyntheticRow({ contactId: 'contact-456', widget: 'milestonesAhead' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('contact-456');
  });

  it('opens contact editor from Today list row', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { child } = makeSyntheticRow({ contactId: 'contact-789', widget: 'today' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('contact-789');
  });
});
