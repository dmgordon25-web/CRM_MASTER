
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMinimalTask, createTaskFromEvent } from '../../crm-app/js/tasks/api.js';

// Mock Globals
const dbPut = vi.fn();
const openDB = vi.fn();
const dispatchAppDataChanged = vi.fn();

vi.stubGlobal('window', {
    dispatchAppDataChanged,
    toast: vi.fn(),
    __CALENDAR_IMPL__: { invalidateCache: vi.fn() },
    dbPut,
    openDB
});
vi.stubGlobal('document', {
    dispatchEvent: vi.fn()
});
vi.stubGlobal('navigator', {
    sendBeacon: vi.fn()
});
vi.stubGlobal('dbPut', dbPut);
vi.stubGlobal('openDB', openDB);

// Ensure crypto.randomUUID is available 
if (!globalIterator().crypto) {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-' + Math.random() });
}

function globalIterator() { return typeof globalThis !== 'undefined' ? globalThis : global; }

describe('Task Persistence API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbPut.mockResolvedValue('ok');
        openDB.mockResolvedValue({});
    });

    it('should create a minimal task with valid date string', async () => {
        const payload = {
            note: 'Test Task',
            due: '2025-12-31',
            linkedType: 'contact',
            linkedId: 'c123'
        };

        const result = await createMinimalTask(payload);

        expect(result.status).toBe('ok');
        expect(dbPut).toHaveBeenCalled();
        const callArg = dbPut.mock.calls[0][1];
        expect(callArg.due).toBe('2025-12-31');
        expect(callArg.title).toBe('Test Task');
    });

    it('should correctly handle string dates in createTaskFromEvent', async () => {
        // This reproduces the toISODate bug
        const event = {
            contactId: 'c123',
            date: '2025-10-10', // String date
            title: 'Event Task'
        };

        const result = await createTaskFromEvent(event);
        expect(result.status).toBe('ok');
        const callArg = dbPut.mock.calls[0][1];

        // BUG EXPECTATION: Current code calls `toISODate` which ignores strings and returns today
        // We asserting the CORRECT behavior here to demonstrate failure if bug exists
        expect(callArg.due).toBe('2025-10-10');
    });

    it('should generate an ID if not provided', async () => {
        const payload = {
            note: 'No ID Task',
            due: '2025-01-01',
            linkedType: 'partner',
            linkedId: 'p123'
        };
        const result = await createMinimalTask(payload);
        expect(result.task.id).toBeDefined();
        // expect(result.task.id).toMatch(/uuid-|task-/); // Depending on uuid impl
    });

    it('should fail gracefully if dbPut throws', async () => {
        // Simplify console.error to avoid noise
        const originalError = console.error;
        console.error = vi.fn();

        dbPut.mockRejectedValue(new Error('DB Failed'));

        const payload = {
            note: 'Fail Task',
            linkedType: 'contact',
            linkedId: 'c123'
        };

        const result = await createMinimalTask(payload);
        expect(result.status).toBe('error');
        expect(result.error).toBeDefined();

        console.error = originalError;
    });
});
