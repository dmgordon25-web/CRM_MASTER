
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyActionBarState } from '../../crm-app/js/state/actionBarGuards.js';

describe('Action Bar DOM Integration', () => {
    let mockBar;

    beforeEach(() => {
        // Mock Element
        mockBar = {
            id: 'actionbar',
            hidden: true,
            style: { display: 'none' },
            dataset: { count: '0' },
            classList: {
                _classes: new Set(),
                add(c) { this._classes.add(c); },
                remove(c) { this._classes.delete(c); },
                contains(c) { return this._classes.has(c); }
            },
            attributes: {},
            getAttribute(name) { return this.attributes[name]; },
            setAttribute(name, val) { this.attributes[name] = val; },
            removeAttribute(name) { delete this.attributes[name]; },
            hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); },
            querySelector: vi.fn((sel) => {
                // Return a mock button for verification
                return { disabled: false };
            })
        };


        const mockDoc = {
            getElementById: vi.fn((id) => {
                if (id === 'actionbar') return mockBar;
                return null;
            }),
            querySelector: vi.fn(),
            getElementsByTagName: vi.fn((tag) => {
                if (tag === 'head') return [{ appendChild: vi.fn() }];
                return [];
            }),
            createElement: vi.fn(() => ({
                setAttribute: vi.fn(),
                style: {},
                appendChild: vi.fn()
            })),
            head: { appendChild: vi.fn() },
            body: { innerHTML: '', appendChild: vi.fn() }
        };

        vi.stubGlobal('document', mockDoc);

        vi.stubGlobal('window', {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should become visible when selection count > 0', () => {
        // Act
        applyActionBarState(null, 1);

        // Assert
        expect(mockBar.getAttribute('data-visible')).toBe('1');
        expect(mockBar.style.display).not.toBe('none');
        expect(mockBar.classList.contains('has-selection')).toBe(true);
        expect(mockBar.dataset.count).toBe("1");
        expect(mockBar.hidden).toBe(false);
    });

    it('should hide when selection count is 0', () => {
        // Setup: make it visible first
        mockBar.style.display = '';
        mockBar.setAttribute('data-visible', '1');
        mockBar.classList.add('has-selection');

        // Act
        applyActionBarState(null, 0);

        // Assert
        expect(mockBar.hasAttribute('data-visible')).toBe(false);
        expect(mockBar.style.display).toBe('none');
        expect(mockBar.classList.contains('has-selection')).toBe(false);
        expect(mockBar.dataset.count).toBe("0");
        expect(mockBar.hidden).toBe(true);
    });
});
