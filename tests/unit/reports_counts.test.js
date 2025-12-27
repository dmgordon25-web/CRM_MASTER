import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

function createElement(initial = {}) {
  return Object.assign({
    textContent: '',
    value: '',
    dataset: {},
    style: {},
    setAttribute() {},
    appendChild() {},
  }, initial);
}

describe('reports view counts', () => {
  let originalDocument;
  let originalWindow;
  let contacts;
  let partners;

  beforeEach(() => {
    originalDocument = global.document;
    originalWindow = global.window;

    contacts = [
      { id: 'c-1', stage: 'application', status: 'inprogress', loanAmount: 100000 },
      { id: 'c-2', stage: 'funded', fundedDate: '2024-01-02', loanAmount: 200000 },
    ];
    partners = [];

    const listeners = {};
    const addEventListener = (type, cb) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(cb);
    };
    const dispatchEvent = (event) => {
      const list = listeners[event.type] || [];
      list.forEach((cb) => cb(event));
      return true;
    };

    const elements = {
      'rep-range': createElement({ value: 'all' }),
      'rep-start': createElement(),
      'rep-end': createElement(),
      'rep-funded-count': createElement(),
      'rep-funded-sum': createElement(),
      'rep-pipeline-open': createElement(),
    };
    const tbody = createElement({ innerHTML: '' });
    elements.tbody = tbody;

    const document = {
      readyState: 'complete',
      addEventListener,
      dispatchEvent,
      createElement: () => createElement({ click: vi.fn() }),
      querySelector: (selector) => (selector === '#tbl-funded tbody' ? tbody : null),
      getElementById: (id) => elements[id] || null,
    };

    global.openDB = vi.fn(() => Promise.resolve());
    global.dbGetAll = vi.fn(async (store) => {
      if (store === 'contacts') return contacts;
      if (store === 'partners') return partners;
      return [];
    });

    global.document = document;
    global.window = { document };
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    vi.resetModules();
  });

  it('recomputes funded and pipeline counts after data mutations', async () => {
    vi.resetModules();
    await import('../../crm-app/js/reports.js');

    await global.window.renderReportsView();

    const pipelineNode = global.document.getElementById('rep-pipeline-open');
    const fundedNode = global.document.getElementById('rep-funded-count');

    expect(pipelineNode.dataset.count).toBe('1');
    expect(fundedNode.textContent).toBe('1');

    contacts = [
      { id: 'c-1', stage: 'funded', fundedDate: '2024-02-10', loanAmount: 300000 },
      { id: 'c-2', stage: 'funded', fundedDate: '2024-01-02', loanAmount: 200000 },
    ];

    const renderSpy = vi.spyOn(global.window, 'renderReportsView');
    global.document.dispatchEvent({ type: 'app:data:changed' });
    await Promise.resolve();
    const maybePromise = renderSpy.mock.results.at(-1)?.value;
    if (maybePromise && typeof maybePromise.then === 'function') {
      await maybePromise;
    }

    expect(renderSpy).toHaveBeenCalled();

    expect(pipelineNode.dataset.count).toBe('0');
    expect(fundedNode.textContent).toBe('2');
  });
});
