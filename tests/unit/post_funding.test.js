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

    const annual = tasks.find((task) => task.title === 'Annual mortgage review: Jamie Doe');
    expect(annual).toBeTruthy();
    expect(annual.due).toBe('2025-12-15');
  });

  it('supports __CRM_NOW__ override for deterministic funded workflow dates', async () => {
    const { windowObj, tasks } = createHarness({ now: '2025-02-10T00:00:00.000Z' });
    const contact = {
      id: 'c-2',
      firstName: 'Alex',
      lastName: 'Smith',
      stage: 'funded'
    };

    await windowObj.dbPut('contacts', contact);

    const annual = tasks.find((task) => task.title === 'Annual mortgage review: Alex Smith');
    expect(annual).toBeTruthy();
    expect(annual.due).toBe('2026-01-10');
  });
});
