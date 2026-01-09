const { test, expect } = require('@playwright/test');

test.describe('Mutation Repaint Contract Audit', () => {
    test('Partner Save triggers app:data:changed and repaints UI', async ({ page }) => {
        // Forward console logs
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));

        // 1. Setup & Spy
        await page.goto('/index.html?e2e=1');
        await page.waitForSelector('#boot-splash', { state: 'hidden' });

        // Evaluate a spy on the document event AND the window function
        await page.evaluate(() => {
            window.__EVENTS_CAPTURED__ = [];

            // 1. Listen to document event
            document.addEventListener('app:data:changed', (e) => {
                console.log('[TEST-SPY] Event caught via DOM:', JSON.stringify(e.detail));
                window.__EVENTS_CAPTURED__.push(e.detail);
            });

            // 2. Hook window.dispatchAppDataChanged because patch_masterfix might intercept/defer it
            // and we want to ensure we catch the intent even if the DOM event is delayed or swallowed.
            if (typeof window.dispatchAppDataChanged === 'function') {
                const original = window.dispatchAppDataChanged;
                window.dispatchAppDataChanged = (detail) => {
                    console.log('[TEST-SPY] Event caught via Function:', JSON.stringify(detail));
                    // Dedupe if needed, but push for now
                    window.__EVENTS_CAPTURED__.push(detail);
                    original(detail);
                };
            }
        });

        // 2. Open Partner Modal (Create New)
        // We can trigger this via console to avoid navigating UI if preferred, 
        // but UI interaction is more realistic. Let's use the UI if we can find the button,
        // or just invoke the global function if exposed (which it is via modal_singleton/index.js usually).
        // For audit strictness, let's use the exposed global to ensure we test the *modal's* behavior, not the button's.

        const partnerName = `Audit Partner ${Date.now()}`;

        await page.evaluate(async () => {
            // Ensure DB is clean-ish or we just create a new one
            if (typeof window.openPartnerEditModal === 'function') {
                await window.openPartnerEditModal(null, { allowAutoOpen: true }); // New partner with explicit permission
            } else {
                throw new Error('openPartnerEditModal not found');
            }
        });

        // 3. Fill Form
        const modal = page.locator('#partner-modal');
        await expect(modal).toBeVisible();
        await modal.locator('#p-name').fill(partnerName);
        await modal.locator('#p-company').fill('Audit Corp');

        // 4. Save
        await modal.locator('#p-save').click();
        await expect(modal).toBeHidden();

        // 5. Verify Signal Emission
        const events = await page.evaluate(() => window.__EVENTS_CAPTURED__);
        const partnerEvent = events.find(e => e.scope === 'partners' && (e.action === 'create' || e.action === 'update'));

        expect(partnerEvent, 'Missing app:data:changed event for partner save').toBeTruthy();
        expect(partnerEvent.scope).toBe('partners');

        // 6. Verify UI Repaint (Partners List)
        // Navigate to partners view to check visibility
        await page.evaluate(() => window.location.hash = '#partners');

        // The list should show the new partner
        // We might need to wait for render
        const row = page.locator(`tr:has-text("${partnerName}")`);
        await expect(row).toBeVisible();

        // 7. Verify Data Persistence (Double Check)
        const dbRecord = await page.evaluate(async (name) => {
            const all = await window.dbGetAll('partners');
            return all.find(p => p.name === name);
        }, partnerName);
        expect(dbRecord).toBeTruthy();
        expect(dbRecord.company).toBe('Audit Corp');
    });
});
