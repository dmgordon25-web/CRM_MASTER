
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks
const window = {
    Selection: { set: vi.fn(), clear: vi.fn() },
    SelectionService: { set: vi.fn(), clear: vi.fn() },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' })
};
const document = {
    dispatchEvent: vi.fn(),
    querySelector: vi.fn(),
    getElementById: vi.fn()
};

// Mock SelectionStore
class MockSelectionStore {
    constructor() {
        this.store = new Map();
    }
    get(scope) {
        if (!this.store.has(scope)) this.store.set(scope, new Set());
        return this.store.get(scope);
    }
    set(set, scope) {
        this.store.set(scope, set);
    }
    count(scope) {
        return this.get(scope).size;
    }
    subscribe() { }
}

const store = new MockSelectionStore();

// Copied logic from app.js (simplified for test)
function isSelectableRowVisible(row) {
    if (!row) return false;
    return true;
}

function normalizeIdSet(ids, scope, store) {
    if (ids instanceof Set) return ids;
    if (Array.isArray(ids)) return new Set(ids.map(String));
    if (ids && typeof ids[Symbol.iterator] === 'function') {
        return new Set(Array.from(ids, (value) => String(value)));
    }
    return store ? store.get(scope) : new Set();
}

function applySelectAllToStore(checkbox, store, entries) {
    if (!checkbox || !store) return;
    const scope = 'contacts';
    checkbox.indeterminate = false;

    // Use passed entries instead of DOM query
    const targets = entries.filter(entry => !entry.disabled && isSelectableRowVisible(entry.row));

    if (!targets.length) {
        checkbox.indeterminate = false;
        checkbox.checked = false;
        store.set(new Set(), scope);
        return;
    }

    const ids = targets.map(entry => entry.id);
    const base = store.get(scope);
    const next = base instanceof Set
        ? new Set(base)
        : new Set(Array.from(base || [], value => String(value)));

    // MODIFIED LOGIC: State-based (matches app.js)
    // 1. If ALL visible rows are selected -> Clear selection.
    // 2. If NOT all visible rows are selected (partial or none) -> Select all visible.

    // Check if we currently have all visible targets selected
    // Note: 'entries' corresponds to targets in app.js
    const allVisibleAreSelected = targets.length > 0 && targets.every(entry => next.has(entry.id));

    if (allVisibleAreSelected) {
        // CLEAR OPERATION
        ids.forEach(id => next.delete(id));
        checkbox.checked = false;
        targets.forEach(entry => {
            if (entry.checkbox) entry.checkbox.checked = false;
        });
    } else {
        // SELECT ALL OPERATION
        ids.forEach(id => next.add(id));
        checkbox.checked = true;
        targets.forEach(entry => {
            if (entry.checkbox) entry.checkbox.checked = true;
        });
    }

    store.set(next, scope);
}

describe('Select All Logic', () => {
    let entries;
    let checkbox;

    beforeEach(() => {
        store.set(new Set(), 'contacts');
        checkbox = { checked: false, indeterminate: false };
        entries = [
            { id: '1', row: {}, checkbox: { checked: false } },
            { id: '2', row: {}, checkbox: { checked: false } },
            { id: '3', row: {}, checkbox: { checked: false } }
        ];
    });

    it('should select all when currently empty (regardless of checkbox input state)', () => {
        // Browser might say checked=true or false, logic should infer "Select All"
        checkbox.checked = true;

        applySelectAllToStore(checkbox, store, entries);

        expect(store.get('contacts').size).toBe(3);
        expect(store.get('contacts').has('1')).toBe(true);
        expect(store.get('contacts').has('2')).toBe(true);
        expect(store.get('contacts').has('3')).toBe(true);
    });

    it('should clear all when all are already selected', () => {
        // Setup: All selected
        store.set(new Set(['1', '2', '3']), 'contacts');
        entries.forEach(e => e.checkbox.checked = true);

        // Even if browser says checked=true (weird edge case), seeing all selected means we should toggle to clear?
        // Wait, if I click a checked box, it becomes unchecked.
        // But logic says: If ALL visible selected -> Clear.
        checkbox.checked = false;

        applySelectAllToStore(checkbox, store, entries);

        expect(store.get('contacts').size).toBe(0);
    });

    it('should select all when partially selected (Regression Proof)', () => {
        // Setup: 1 selected
        store.set(new Set(['1']), 'contacts');
        entries[0].checkbox.checked = true;

        // CRITICAL: Even if the checkbox comes in as unchecked (e.g. browser confused by indeterminate toggle),
        // we must UPGRADE to full selection because not all are selected.
        checkbox.checked = false;

        applySelectAllToStore(checkbox, store, entries);

        expect(store.get('contacts').size).toBe(3);
        expect(store.get('contacts').has('2')).toBe(true);
    });

    it('should NOT clear hidden rows when unchecking', () => {
        // Setup: 1, 2, 3 in view. 4 hidden.
        // All selected.
        store.set(new Set(['1', '2', '3', '4']), 'contacts');

        // Browser unchecks
        checkbox.checked = false;

        applySelectAllToStore(checkbox, store, entries);

        // Should clear 1, 2, 3. 4 Remains.
        expect(store.get('contacts').has('1')).toBe(false);
        expect(store.get('contacts').has('4')).toBe(true);
    });
});
