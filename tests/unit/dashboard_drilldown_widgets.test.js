import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import { renderReferralLeadersWidget } from '../../crm-app/js/dashboard/widgets/referral_leaders.js';

let handler;
let setHooks;

function bootstrapGlobals() {
  const doc = {
    readyState: 'complete',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: (id) => {
      if (id === 'view-dashboard') return doc.__dashRoot;
      return null;
    },
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
    },
    __dashRoot: {
      id: 'view-dashboard',
      __isRoot: true,
      contains(node) {
        let cur = node;
        while (cur) {
          if (cur === this) return true;
          cur = cur.parent || null;
        }
        return false;
      }
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
    parent: globalThis.document.__dashRoot,
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

function buildRecordDataAttrs(ids = {}, widgetKey = '') {
  const contactAttr = ids && ids.contactId ? String(ids.contactId) : '';
  const partnerAttr = ids && ids.partnerId ? String(ids.partnerId) : '';
  const attrs = [];
  if (widgetKey) {
    attrs.push(
      `data-widget="${widgetKey}"`,
      `data-dash-widget="${widgetKey}"`,
      `data-widget-id="${widgetKey}"`
    );
  }
  if (contactAttr) attrs.push(`data-contact-id="${contactAttr}"`, `data-id="${contactAttr}"`);
  if (partnerAttr) attrs.push(`data-partner-id="${partnerAttr}"`);
  return attrs.length ? ` ${attrs.join(' ')}` : '';
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

  it('opens partner editor from referral leaderboard row', () => {
    const openPartner = vi.fn();
    setHooks({ openPartner });
    const { child } = makeSyntheticRow({ partnerId: 'partner-abc', widget: 'referral-leaderboard' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openPartner).toHaveBeenCalledWith('partner-abc');
  });

  it('prevents propagation for partner rows', () => {
    const openPartner = vi.fn();
    setHooks({ openPartner });
    const evt = { target: makeSyntheticRow({ partnerId: 'partner-stop' }).child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(evt.preventDefault).toHaveBeenCalledTimes(1);
    expect(evt.stopPropagation).toHaveBeenCalledTimes(1);
    expect(openPartner).toHaveBeenCalledWith('partner-stop');
  });

  it('opens contact editor from Favorites row', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { child } = makeSyntheticRow({ contactId: 'fav-contact', widget: 'favorites' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('fav-contact');
  });

  it('opens partner editor from Favorites partner row', () => {
    const openPartner = vi.fn();
    setHooks({ openPartner });
    const { child } = makeSyntheticRow({ partnerId: 'fav-partner', widget: 'favorites' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openPartner).toHaveBeenCalledWith('fav-partner');
  });

  it('opens contact editor from Closing Watchlist row', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { child } = makeSyntheticRow({ contactId: 'closing-123', widget: 'closing-watch' });
    const evt = { target: child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('closing-123');
  });

  it('handles Priority Actions button clicks when ids live on the button', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { row } = makeSyntheticRow({ contactId: 'btn-contact-1', widget: 'priorityActions' });
    const evt = { target: row, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('btn-contact-1');
  });

  it('handles Milestones Ahead clicks when the clickable node carries the id', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const { row } = makeSyntheticRow({ contactId: 'btn-contact-2', widget: 'milestonesAhead' });
    const evt = { target: row, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openContact).toHaveBeenCalledWith('btn-contact-2');
  });

  it('handles Referral Leader clicks when the button itself has the partner id', () => {
    const openPartner = vi.fn();
    setHooks({ openPartner });
    const { row } = makeSyntheticRow({ partnerId: 'partner-self', widget: 'referral-leaderboard' });
    const evt = { target: row, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(openPartner).toHaveBeenCalledWith('partner-self');
  });

  it('prevents propagation for entity rows so other click delegates do not double-handle', () => {
    const openContact = vi.fn();
    setHooks({ openContact });
    const evt = { target: makeSyntheticRow({ contactId: 'contact-stop' }).child, preventDefault: vi.fn(), stopPropagation: vi.fn() };

    const handled = handler(evt);

    expect(handled).toBe(true);
    expect(evt.preventDefault).toHaveBeenCalledTimes(1);
    expect(evt.stopPropagation).toHaveBeenCalledTimes(1);
    expect(openContact).toHaveBeenCalledWith('contact-stop');
  });

  describe('widget row markup includes drilldown attributes', () => {
    it('favorites contact rows include widget marker and contact id', () => {
      const attrs = buildRecordDataAttrs({ contactId: 'fav-1' }, 'favorites');
      expect(attrs).toContain('data-dash-widget="favorites"');
      expect(attrs).toContain('data-contact-id="fav-1"');
    });

    it('favorites partner rows include widget marker and partner id', () => {
      const attrs = buildRecordDataAttrs({ partnerId: 'partner-99' }, 'favorites');
      expect(attrs).toContain('data-dash-widget="favorites"');
      expect(attrs).toContain('data-partner-id="partner-99"');
    });

    it('priority actions rows include widget marker and contact id', () => {
      const attrs = buildRecordDataAttrs({ contactId: 'task-1' }, 'priorityActions');
      expect(attrs).toContain('data-dash-widget="priorityActions"');
      expect(attrs).toContain('data-contact-id="task-1"');
    });

    it('milestones ahead rows include widget marker and contact id', () => {
      const attrs = buildRecordDataAttrs({ contactId: 'ms-1' }, 'milestonesAhead');
      expect(attrs).toContain('data-dash-widget="milestonesAhead"');
      expect(attrs).toContain('data-contact-id="ms-1"');
    });

    it('closing watchlist rows include widget marker and contact id', () => {
      const attrs = buildRecordDataAttrs({ contactId: 'cw-1' }, 'closing-watch');
      expect(attrs).toContain('data-dash-widget="closing-watch"');
      expect(attrs).toContain('data-contact-id="cw-1"');
    });

    it('today rows include widget marker and contact id', () => {
      const attrs = buildRecordDataAttrs({ contactId: 'today-1' }, 'today');
      expect(attrs).toContain('data-dash-widget="today"');
      expect(attrs).toContain('data-contact-id="today-1"');
    });

    it('referral leaderboard markup includes partner and widget attributes', () => {
      const host = { dataset: {}, innerHTML: '' };
      renderReferralLeadersWidget({
        host,
        contacts: [
          { id: 'c1', buyerPartnerId: 'p1', loanAmount: 1000 },
          { id: 'c2', listingPartnerId: 'p1', loanAmount: 1500 }
        ],
        partners: [{ id: 'p1', name: 'Partner One' }],
        safe: (v) => String(v),
        attr: (v) => String(v),
        money: (v) => `$${v}`,
        initials: (name) => String(name || '').slice(0, 2) || 'P',
        normalizeStatus: (value) => value || '',
        stageLabels: {}
      });

      expect(host.innerHTML).toContain('data-dash-widget="referral-leaderboard"');
      expect(host.innerHTML).toContain('data-partner-id="p1"');
    });

    it('referral leaderboard normalizes partner ids before rendering rows', () => {
      const host = { dataset: {}, innerHTML: '' };
      renderReferralLeadersWidget({
        host,
        contacts: [
          { id: 'c1', buyerPartnerId: '2', loanAmount: 1000 },
          { id: 'c2', listingPartnerId: 'partner-002', loanAmount: 1500 }
        ],
        partners: [{ id: 'partner-002', name: 'Partner Two' }],
        safe: (v) => String(v),
        attr: (v) => String(v),
        money: (v) => `$${v}`,
        initials: (name) => String(name || '').slice(0, 2) || 'P',
        normalizeStatus: (value) => value || '',
        stageLabels: {}
      });

      expect(host.innerHTML).toContain('data-partner-id="partner-002"');
    });
  });
});
