import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../crm-app');

describe('project sanity', () => {
  it('includes the CRM index file', () => {
    expect(fs.existsSync(path.join(root, 'index.html'))).toBe(true);
  });
});

class FakeElement extends EventTarget {
  constructor(tagName = 'div') {
    super();
    this.tagName = String(tagName || '').toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.style = {};
    this.dataset = {};
    this.attributes = new Map();
    this.hidden = false;
    this._className = '';
    this._classes = new Set();
    this.textContent = '';
    this.isConnected = false;
    this.classList = {
      add: (...names) => {
        names.forEach((n) => { if (n) { this._classes.add(String(n)); } });
        this._syncClassName();
      },
      remove: (...names) => {
        names.forEach((n) => this._classes.delete(String(n)));
        this._syncClassName();
      },
      contains: (name) => this._classes.has(String(name))
    };
  }

  _syncClassName() {
    this._className = Array.from(this._classes).join(' ');
  }

  get className() {
    return this._className;
  }

  set className(value) {
    const next = String(value || '');
    this._className = next;
    this._classes = new Set(next.split(/\s+/).filter(Boolean));
  }

  setAttribute(name, value) {
    const key = String(name);
    const val = String(value);
    this.attributes.set(key, val);
    if (key === 'id') this.id = val;
    if (key === 'class') this.className = val;
    if (key.startsWith('data-')) {
      const dataKey = key.replace('data-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[dataKey] = val;
    }
  }

  getAttribute(name) {
    const val = this.attributes.get(String(name));
    return typeof val === 'undefined' ? null : val;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  appendChild(child) {
    if (!child) return child;
    child.parentElement = this;
    const setConnection = (node, value) => {
      node.isConnected = value;
      node.children.forEach((c) => setConnection(c, value));
    };
    setConnection(child, this.isConnected);
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter((c) => c !== child);
    child.parentElement = null;
    const setConnection = (node, value) => {
      node.isConnected = value;
      node.children.forEach((c) => setConnection(c, value));
    };
    setConnection(child, false);
    return child;
  }

  contains(node) {
    let cursor = node;
    while (cursor) {
      if (cursor === this) return true;
      cursor = cursor.parentElement;
    }
    return false;
  }

  closest(selector) {
    let cursor = this;
    while (cursor) {
      if (cursor.matches(selector)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  }

  matches(selector) {
    if (!selector) return false;
    const selectors = selector.split(',').map((s) => s.trim()).filter(Boolean);
    return selectors.some((sel) => {
      if (!sel) return false;
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) return (this.className || '').split(/\s+/).includes(sel.slice(1));
      const dataRoleMatch = sel.match(/^\[data-role\s*=\s*"?([\w-]+)"?\]$/);
      if (dataRoleMatch) return this.dataset.role === dataRoleMatch[1];
      const attrMatch = sel.match(/^\[([\w-]+)\s*=\s*"?(.+?)"?\]$/);
      if (attrMatch) {
        const [, attr, value] = attrMatch;
        const current = this.getAttribute(attr) || (this.dataset && this.dataset[attr.replace('data-', '')]);
        if (current === value) return true;
      }
      if (sel === this.tagName.toLowerCase() || sel === this.tagName) return true;
      return false;
    });
  }

  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const found = typeof child.querySelector === 'function' ? child.querySelector(selector) : null;
      if (found) return found;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      if (typeof child.querySelectorAll === 'function') {
        results.push(...child.querySelectorAll(selector));
      }
    }
    return results;
  }

  getBoundingClientRect() {
    return { width: 240, height: 180, top: 20, bottom: 60, left: 16, right: 256 };
  }
}

class FakeDocument extends EventTarget {
  constructor() {
    super();
    this.body = new FakeElement('body');
    this.body.isConnected = true;
    this.documentElement = new FakeElement('html');
    this.documentElement.clientWidth = 1280;
    this.documentElement.clientHeight = 720;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  _walk(node, fn) {
    if (!node) return null;
    const result = fn(node);
    if (result) return result;
    for (const child of node.children) {
      const found = this._walk(child, fn);
      if (found) return found;
    }
    return null;
  }

  getElementById(id) {
    return this._walk(this.body, (node) => node.id === id ? node : null);
  }

  querySelector(selector) {
    return this._walk(this.body, (node) => node.matches(selector) ? node : null);
  }

  querySelectorAll(selector) {
    const matches = [];
    this._walk(this.body, (node) => {
      if (node.matches(selector)) {
        matches.push(node);
      }
      return null;
    });
    return matches;
  }
}

const withFakeDom = () => {
  const doc = new FakeDocument();
  const win = new EventTarget();
  win.innerWidth = 1280;
  win.innerHeight = 720;
  doc.defaultView = win;
  return { document: doc, window: win };
};

describe('quick create menu', () => {
  let originalDocument;
  let originalWindow;
  let bindQuickCreate;
  let resetQuickCreateOverlay;

  beforeEach(async () => {
    originalDocument = global.document;
    originalWindow = global.window;
    vi.resetModules();
    const { document: fakeDocument, window: fakeWindow } = withFakeDom();
    global.document = fakeDocument;
    global.window = fakeWindow;
    ({ bindQuickCreate, resetQuickCreateOverlay } = await import('../../crm-app/js/ui/quick_create_menu.js'));
    fakeDocument.body.appendChild(createNewButton());
    resetQuickCreateOverlay('test-setup');
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
  });

  function createNewButton() {
    const host = new FakeElement('div');
    host.className = 'header-new-wrap';
    host.setAttribute('data-role', 'header-new-host');
    const btn = new FakeElement('button');
    btn.id = 'quick-add-unified';
    btn.textContent = 'New+';
    host.appendChild(btn);
    return host;
  }

  it('opens the dropdown when the New+ button is clicked', () => {
    const bound = bindQuickCreate();
    expect(bound).toBe(true);

    const btn = document.getElementById('quick-add-unified');
    expect(btn).toBeTruthy();

    btn.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }));

    const menu = document.getElementById('header-new-menu');
    expect(menu).toBeTruthy();
    expect(menu.hidden).toBe(false);
    expect(menu.getAttribute('aria-hidden')).toBe('false');
  });
});
