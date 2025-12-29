
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto'; // This shims global indexedDB
import fs from 'fs';
import path from 'path';

// Simulate browser environment for db.js which expects window/self
if (typeof window === 'undefined') {
    global.window = global;
    global.self = global;
}

// Load db.js manually since it is not an ES module
const dbJsPath = path.resolve(__dirname, '../../crm-app/js/db.js');
const dbJsContent = fs.readFileSync(dbJsPath, 'utf-8');
eval(dbJsContent);

describe('Data Integrity (Backup/Restore)', () => {

    beforeEach(async () => {
        // Clear all stores before each test
        if (window.dbClear && window.STORES) {
            for (const store of window.STORES) {
                await window.dbClear(store);
            }
        }
    });

    it('should export all data correctly', async () => {
        const partner = { id: 'p1', name: 'Test Partner' };
        const contact = { id: 'c1', first: 'Test', last: 'Contact' };

        await window.dbPut('partners', partner);
        await window.dbPut('contacts', contact);

        const snapshot = await window.dbExportAll();

        expect(snapshot).toBeDefined();
        expect(snapshot.partners).toHaveLength(1);
        expect(snapshot.partners[0].id).toBe('p1');
        expect(snapshot.contacts).toHaveLength(1);
        expect(snapshot.contacts[0].id).toBe('c1');
    });

    it('should restore data deterministically in replace mode', async () => {
        // Initial state
        await window.dbPut('partners', { id: 'p_original', name: 'Original' });

        // Snapshot to restore
        const snapshot = {
            partners: [{ id: 'p_restore', name: 'Restored' }],
            contacts: [{ id: 'c_restore', first: 'Restored' }]
        };

        await window.dbRestoreAll(snapshot, 'replace');

        const partners = await window.dbGetAll('partners');
        const contacts = await window.dbGetAll('contacts');

        expect(partners).toHaveLength(1);
        expect(partners[0].id).toBe('p_restore');
        expect(partners[0].name).toBe('Restored');

        expect(contacts).toHaveLength(1);
        expect(contacts[0].id).toBe('c_restore');
    });

    it('should restore data in merge mode', async () => {
        // Initial state
        await window.dbPut('partners', { id: 'p1', name: 'Original P1' });

        // Snapshot to restore
        const snapshot = {
            partners: [
                { id: 'p1', name: 'Updated P1' }, // Update existing
                { id: 'p2', name: 'New P2' }      // Create new
            ]
        };

        await window.dbRestoreAll(snapshot, 'merge');

        const partners = await window.dbGetAll('partners');

        expect(partners).toHaveLength(2);

        const p1 = partners.find(p => p.id === 'p1');
        expect(p1.name).toBe('Updated P1');

        const p2 = partners.find(p => p.id === 'p2');
        expect(p2.name).toBe('New P2');
    });
});
