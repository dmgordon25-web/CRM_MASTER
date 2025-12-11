import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class FakeNode {
  constructor(attrs = {}, parent = null) {
    this.parent = parent;
    this.attrs = { ...attrs };
    this.dataset = {};
    Object.keys(this.attrs).forEach(key => {
      if (key.startsWith('data-')) {
        const camel = key
          .replace(/^data-/, '')
          .split('-')
          .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
          .join('');
        this.dataset[camel] = this.attrs[key];
      } else {
        this.dataset[key] = this.attrs[key];
      }
    });
  }

  getAttribute(name) {
    if (name in this.attrs) return this.attrs[name];
    return this.attrs[name.toLowerCase()] || this.attrs[name.replace(/^data-/, 'data-')];
  }

  closest(selector) {
    const selectors = selector.split(',').map(s => s.trim()).filter(Boolean);
    let node = this;
    const matches = (candidate, sel) => {
      if (!sel.startsWith('[')) return false;
      const attr = sel.slice(1, -1).replace(/^data-/, 'data-');
      return candidate.attrs[attr] != null;
    };
    while (node) {
      if (selectors.some(sel => matches(node, sel))) return node;
      node = node.parent;
    }
    return null;
  }
}

function createEvent(target) {
  return {
    target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

let handleDashboardTap;
let setTestHooks;

describe('dashboard drilldowns', () => {
  beforeEach(async () => {
    global.window = {
      CRM: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      location: {}
    };
    global.document = {
      readyState: 'complete',
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      body: {},
      documentElement: {},
      head: { appendChild: () => {} },
      createElement: () => ({ style: {}, setAttribute: () => {}, appendChild: () => {} }),
      getElementById: () => null
    };
    const mod = await import('../../crm-app/js/dashboard/index.js');
    handleDashboardTap = mod.__getHandleDashboardTapForTest();
    setTestHooks = mod.__setDashboardDrilldownTestHooks;
    setTestHooks({});
  });

  afterEach(() => {
    setTestHooks({});
  });

  it('opens contact modal for Priority Actions rows', () => {
    const row = new FakeNode({ 'data-contact-id': '123', 'data-dash-widget': 'priorityActions' });
    const child = new FakeNode({}, row);
    const event = createEvent(child);
    const openContact = vi.fn();
    setTestHooks({ openContact });

    const handled = handleDashboardTap(event, child);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledTimes(1);
    expect(openContact).toHaveBeenCalledWith('123');
  });

  it('opens partner modal for Milestones Ahead rows', () => {
    const row = new FakeNode({ 'data-partner-id': 'partner-42', 'data-dash-widget': 'milestones' });
    const child = new FakeNode({}, row);
    const event = createEvent(child);
    const openPartner = vi.fn();
    setTestHooks({ openPartner });

    const handled = handleDashboardTap(event, child);

    expect(handled).toBe(true);
    expect(openPartner).toHaveBeenCalledTimes(1);
    expect(openPartner).toHaveBeenCalledWith('partner-42');
  });
});
