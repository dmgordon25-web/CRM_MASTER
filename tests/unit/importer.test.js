
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// Mock DOM things if needed
if (typeof window === 'undefined') {
    global.window = global;
}
if (typeof document === 'undefined') {
    global.document = {
        createElement: () => ({ innerHTML: '' }),
        currentScript: { previousElementSibling: { querySelector: () => ({ value: '' }) } },
        getElementById: () => ({
            addEventListener: () => { },
            value: ''
        })
    };
}

// Mock DB methods
window.dbGetAll = vi.fn().mockResolvedValue([]);
window.dbPut = vi.fn().mockResolvedValue();
window.dbBulkPut = vi.fn().mockResolvedValue();
window.dbClear = vi.fn().mockResolvedValue();
window.dispatchAppDataChanged = vi.fn();

// Import the module dynamically to ensure sidebar effects run after mocks
const importerPath = path.resolve(__dirname, '../../crm-app/js/importer.js');
let IMPORTER_INTERNALS;

describe('Importer Hardening', () => {

    beforeEach(async () => {
        vi.clearAllMocks();
        // Dynamic import to handle potential reload or state issues
        const mod = await import(importerPath);
        IMPORTER_INTERNALS = mod.IMPORTER_INTERNALS;
    });

    it('should normalize "CTC" status to "active" for Contacts', async () => {
        const rows = [
            ['Test', 'User', 'CTC', 'Clear to Close'] // Row 1 values
        ];
        // Mock headers and mapping
        const headers = ['First Name', 'Last Name', 'Status', 'Stage'];
        const mapping = {
            'first': 'First Name',
            'last': 'Last Name',
            'status': 'Status',
            'stage': 'Stage'
        };

        const result = await IMPORTER_INTERNALS.__importContacts(rows, headers, 'replace', mapping);

        // Verify dbBulkPut was called with normalized data
        expect(window.dbBulkPut).toHaveBeenCalled();

        // Debugging: print all calls
        console.log('dbBulkPut calls:', JSON.stringify(window.dbBulkPut.mock.calls, null, 2));
        console.log('dbPut calls:', JSON.stringify(window.dbPut.mock.calls, null, 2));

        // Find the call for contacts
        const calls = window.dbBulkPut.mock.calls;
        const contactCall = calls.find(call => call[0] === 'contacts');
        expect(contactCall).toBeDefined();

        const data = contactCall[1];

        expect(data).toHaveLength(1);
        expect(data[0].status).toBe('active'); // Should be normalized!
        expect(data[0].stage).toBe('clear_to_close'); // Should be normalized!
    });

    it('should normalize "Lead" status to "nurture" for Contacts', async () => {
        const rows = [
            ['Lead', 'Person', 'Lead', 'Long Shot']
        ];
        const headers = ['First Name', 'Last Name', 'Status', 'Stage'];
        const mapping = {
            'first': 'First Name',
            'last': 'Last Name',
            'status': 'Status',
            'stage': 'Stage'
        };

        await IMPORTER_INTERNALS.__importContacts(rows, headers, 'merge', mapping);

        const calls = window.dbBulkPut.mock.calls;
        // Since we didn't clear mocks between calls efficiently in the loop (actually we did in beforeEach), 
        // but wait, beforeEach clears mocks. So index 0 is likely checks.
        // However, ensureNonePartner might call dbPut for partners, or dbBulkPut might be called for partners if auto-created.
        // Let's find specific call.
        const contactCall = calls.find(call => call[0] === 'contacts');
        expect(contactCall).toBeDefined();

        const data = contactCall[1];
        expect(data[0].status).toBe('nurture');
        expect(data[0].stage).toBe('new'); // "Long Shot" -> "new"
    });
});
