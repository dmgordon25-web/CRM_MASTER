import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderPriorityActionsWidget, renderTodayWidget } from '../../crm-app/js/labs/crm_widgets.js';
import { openContactEditor } from '../../crm-app/js/contacts.js';

vi.mock('../../crm-app/js/contacts.js', () => ({
  openContactEditor: vi.fn(),
  normalizeContactId: vi.fn((id) => id),
}));

const NOW = new Date('2025-01-15T12:00:00Z');

class FakeEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.target = options.target || null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.cancelBubble = false;
  }

  preventDefault() { this.defaultPrevented = true; }

  stopPropagation() { this.cancelBubble = true; }
}

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.className = '';
    this.innerHTML = '';
    this.listeners = {};
    this.classList = {
      add: (...args) => {
        const existing = new Set(this.className.split(/\s+/).filter(Boolean));
        args.forEach((cls) => existing.add(cls));
        this.className = Array.from(existing).join(' ');
      },
      remove: (...args) => {
        const filtered = this.className.split(/\s+/).filter((cls) => !args.includes(cls) && cls);
        this.className = filtered.join(' ');
      },
      contains: (cls) => this.className.split(/\s+/).includes(cls)
    };
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const dataKey = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[dataKey] = String(value);
    }
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  appendChild(child) {
    if (!child) return null;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  addEventListener(type, handler) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  dispatchEvent(event) {
    const evt = event instanceof FakeEvent ? event : new FakeEvent(event?.type || 'event', event || {});
    evt.target = evt.target || this;
    evt.currentTarget = this;
    const handlers = this.listeners[evt.type] || [];
    handlers.forEach((fn) => fn.call(this, evt));
    if (evt.bubbles && !evt.cancelBubble && this.parentNode && typeof this.parentNode.dispatchEvent === 'function') {
      this.parentNode.dispatchEvent(evt);
    }
    return true;
  }

  closest(selector) {
    if (matchesSelector(this, selector)) return this;
    return this.parentNode && typeof this.parentNode.closest === 'function'
      ? this.parentNode.closest(selector)
      : null;
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (matchesSelector(child, selector)) return child;
      const found = child.querySelector(selector);
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    this.children.forEach((child) => {
      if (matchesSelector(child, selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    });
    return results;
  }
}

function matchesSelector(el, selector = '') {
  if (!el) return false;
  const pattern = /\[([^\]=]+)(?:\=\"?([^\]"]+)\"?)?\]/g;
  const checks = [];
  let match = pattern.exec(selector);
  while (match) {
    checks.push({ attr: match[1], value: match[2] });
    match = pattern.exec(selector);
  }
  if (!checks.length) return false;
  return checks.every(({ attr, value }) => {
    const actual = el.getAttribute(attr);
    if (value === undefined) return actual !== null;
    return actual === value;
  });
}

function bootstrapDom() {
  const body = new FakeElement('body');
  const doc = {
    body,
    createElement: (tag) => new FakeElement(tag),
    querySelector: (...args) => body.querySelector(...args),
    querySelectorAll: (...args) => body.querySelectorAll(...args),
    addEventListener() { },
    removeEventListener() { },
    getElementById: () => null
  };

  globalThis.document = doc;
  globalThis.window = { location: { hash: '#/' }, document: doc };
  globalThis.MouseEvent = FakeEvent;
  globalThis.HTMLElement = FakeElement;
  globalThis.Element = FakeElement;
}

function buildModel() {
  const contacts = [
    { id: 'contact-1', displayName: 'Ada Lovelace' },
    { id: 'contact-2', displayName: 'Grace Hopper', partnerId: 'partner-9' }
  ];
  const contactsById = {
    'contact-1': contacts[0],
    'contact-2': contacts[1]
  };
  const tasks = [
    {
      id: 'task-overdue',
      contactId: 'contact-1',
      partnerId: 'partner-1',
      title: 'Overdue follow-up',
      due: '2025-01-13T12:00:00Z'
    },
    {
      id: 'task-today',
      contactId: 'contact-1',
      title: "Today's follow-up",
      due: '2025-01-15T15:00:00Z'
    },
    {
      id: 'task-soon',
      contactName: 'Partner Task',
      partnerId: 'partner-2',
      title: 'Partner-only task',
      due: '2025-01-17T12:00:00Z'
    }
  ];

  return {
    today: NOW,
    contacts,
    contactsById,
    tasks,
    resolveContactNameStrict: (id) => contactsById[id]?.displayName || null,
    getContactDisplayName: (id) => contactsById[id]?.displayName || null
  };
}

describe('Labs dashboard drilldowns', () => {
  beforeEach(() => {
    bootstrapDom();
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    window.location.hash = '#/';
  });

  afterEach(() => {
    vi.useRealTimers();
    window.location.hash = '#/';
  });

  it('opens contact editor from Priority Actions rows even after rerender', async () => {
    const container = document.createElement('div');
    const model = buildModel();

    renderPriorityActionsWidget(container, model);
    const contactRow = container.querySelector('[data-role="priority-row"][data-contact-id="contact-1"]');
    expect(contactRow).not.toBeNull();
    // Verify correct data mapping (Priority rows with tasks have task IDs)
    expect(contactRow.getAttribute('data-task-id')).toBe('task-overdue');


    // Rerender to mimic modal reopen/resume cycles
    container.innerHTML = '';
    renderPriorityActionsWidget(container, model);
    const rerenderedRow = container.querySelector('[data-role="priority-row"][data-contact-id="contact-1"]');
    rerenderedRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Verify persistence of data mapping
    expect(rerenderedRow.getAttribute('data-task-id')).toBe('task-overdue');
  });

  it('prefers partner drilldown when contact is absent on Priority Actions', () => {
    const container = document.createElement('div');
    const model = buildModel();

    renderPriorityActionsWidget(container, model);
    const partnerRow = container.querySelector('[data-role="priority-row"][data-partner-id="partner-2"]');
    expect(partnerRow).not.toBeNull();
    partnerRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(partnerRow.getAttribute('data-partner-id')).toBe('partner-2');
  });

  it('stops bubbling for Priority Actions row clicks', () => {
    const container = document.createElement('div');
    const model = buildModel();

    renderPriorityActionsWidget(container, model);
    const contactRow = container.querySelector('[data-role="priority-row"][data-contact-id="contact-1"]');
    expect(contactRow).not.toBeNull();

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    contactRow.dispatchEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
  });

  it("Today's Work rows keep drilldown hooks after navigation cycles", () => {
    const container = document.createElement('div');
    const model = buildModel();

    renderTodayWidget(container, model);
    const taskRow = container.querySelector('[data-role="today-row"][data-contact-id="contact-1"]');
    expect(taskRow).not.toBeNull();
    taskRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(taskRow.getAttribute('data-task-id')).toBe('task-today');

    // Simulate navigation away/back by rerendering
    container.innerHTML = '';
    renderTodayWidget(container, model);
    const rerenderedTaskRow = container.querySelector('[data-role="today-row"][data-contact-id="contact-1"]');
    rerenderedTaskRow.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(rerenderedTaskRow.getAttribute('data-task-id')).toBe('task-today');
  });

  it("stops bubbling for Today's Work row clicks", () => {
    const container = document.createElement('div');
    const model = buildModel();

    renderTodayWidget(container, model);
    const taskRow = container.querySelector('[data-role="today-row"][data-contact-id="contact-1"]');
    expect(taskRow).not.toBeNull();

    const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
    taskRow.dispatchEvent(evt);

    expect(evt.defaultPrevented).toBe(true);
  });
});
