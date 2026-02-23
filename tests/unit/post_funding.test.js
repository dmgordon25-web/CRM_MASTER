import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const scriptPath = path.resolve('crm-app/js/post_funding.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

function createHarness(options = {}) {
  const contacts = new Map();
  const tasks = [];
  const listeners = new Map();

  const windowObj = {
    __INIT_FLAGS__: {},
    __CRM_NOW__: options.now,
    uuid: () => 'task-id-fixed',
    openDB: vi.fn().mockResolvedValue(undefined),
    dbGet: vi.fn(async (store, id) => {
      if (store !== 'contacts') return null;
      return contacts.get(String(id)) || null;
    }),
    dbGetAll: vi.fn(async (store) => {
      if (store === 'contacts') return Array.from(contacts.values());
      if (store === 'tasks') return tasks.slice();
      return [];
    }),
    dbPut: vi.fn(async (store, record) => {
      if (store === 'contacts' && record && record.id != null) {
        contacts.set(String(record.id), { ...record });
      }
      if (store === 'tasks' && record && record.id != null) {
        const idx = tasks.findIndex((task) => String(task.id) === String(record.id));
        if (idx >= 0) tasks[idx] = { ...record };
        else tasks.push({ ...record });
      }
      return record;
    }),
    dbBulkPut: vi.fn(async (store, list) => {
      if (store === 'tasks') {
        list.forEach((task) => tasks.push({ ...task }));
      }
      if (store === 'contacts') {
        list.forEach((record) => {
          if (record && record.id != null) contacts.set(String(record.id), { ...record });
        });
      }
      return list;
    }),
    renderAll: vi.fn().mockResolvedValue(undefined),
    console
  };

  const documentObj = {
    readyState: options.readyState || 'complete',
    addEventListener: vi.fn((event, callback) => {
      listeners.set(event, callback);
    })
  };

  const context = {
    window: windowObj,
    document: documentObj,
    openDB: windowObj.openDB,
    dbGet: windowObj.dbGet,
    dbGetAll: windowObj.dbGetAll,
    dbPut: windowObj.dbPut,
    dbBulkPut: windowObj.dbBulkPut,
    renderAll: windowObj.renderAll,
    uuid: windowObj.uuid,
    console,
    Date,
    Math,
    CustomEvent: class {}
  };

  vm.createContext(context);
  vm.runInContext(scriptSource, context, { filename: 'post_funding.js' });

  return { windowObj, documentObj, contacts, tasks, listeners };
}

describe('post_funding workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('creates annual mortgage review reminder 11 months after fundedDate', async () => {
    const { windowObj, tasks } = createHarness();
    const contact = {
      id: 'c-1',
      first: 'Jamie',
      last: 'Doe',
      stage: 'funded',
      fundedDate: '2025-01-15'
    };

    await windowObj.dbPut('contacts', contact);

    expect(tasks).toHaveLength(1);
    const annual = tasks[0];
    expect(annual.title).toBe('Annual mortgage review: Jamie Doe');
    expect(annual.due).toBe('2025-12-15');
    expect(annual.id).toBe('postfunding-annual:c-1');
  });

  it('updates existing annual reminder due date when fundedDate changes', async () => {
    const { windowObj, tasks } = createHarness();

    await windowObj.dbPut('contacts', {
      id: 'c-2',
      firstName: 'Alex',
      lastName: 'Smith',
      stage: 'funded',
      fundedDate: '2025-01-10'
    });

    await windowObj.dbPut('contacts', {
      id: 'c-2',
      firstName: 'Alex',
      lastName: 'Smith',
      stage: 'funded',
      fundedDate: '2025-02-10'
    });

    expect(tasks).toHaveLength(1);
    const annual = tasks[0];
    expect(annual.title).toBe('Annual mortgage review: Alex Smith');
    expect(annual.due).toBe('2026-01-10');
  });

  it('does not create reminder without a funded date', async () => {
    const { windowObj, tasks } = createHarness({ now: '2025-02-10T00:00:00.000Z' });

    await windowObj.dbPut('contacts', {
      id: 'c-3',
      firstName: 'No',
      lastName: 'Date',
      stage: 'funded'
    });

    expect(tasks).toHaveLength(0);
  });
});
