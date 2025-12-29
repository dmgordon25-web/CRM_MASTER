
const { test, expect } = require('@playwright/test');

test.describe('Labs Interaction Widgets Parity', () => {
    test.beforeEach(async ({ page }) => {
        // Debug logging
        page.on('console', msg => console.log(`BROWSER LOG: ${msg.text()}`));
        page.on('pageerror', err => console.log(`BROWSER ERROR: ${err}`));

        // Navigate to Labs dashboard
        console.log('Navigating to /#/labs...');
        await page.goto('/#/labs');

        // Wait for the dashboard shell to render
        try {
            await page.waitForSelector('.labs-crm-dashboard', { state: 'visible', timeout: 5000 });
        } catch (e) {
            console.log('Dashboard selector .labs-crm-dashboard not found.');
            const body = await page.innerHTML('body');
            console.log('Body content snapshot:', body.slice(0, 1000));
            throw e;
        }
    });

    test('Milestones Widget renders and handles drilldown', async ({ page }) => {
        console.log('STEP 1: Testing Milestones Widget...');
        const widget = page.locator('.labs-widget[data-widget-id="milestones"]');

        await widget.scrollIntoViewIfNeeded();
        await expect(widget).toBeVisible({ timeout: 5000 });
        console.log('STEP 2: Widget visible');

        const list = widget.locator('[data-role="milestone-list"]');
        const empty = widget.locator('.labs-widget__state--empty');

        await page.waitForTimeout(1000); // Async render wait

        const isListVisible = await list.isVisible();
        console.log(`STEP 3: List visible? ${isListVisible}`);

        if (isListVisible) {
            const rows = list.locator('[data-role="milestone-row"]');
            const count = await rows.count();
            console.log(`Found ${count} milestone rows.`);
            expect(count).toBeGreaterThan(0);

            const firstRow = rows.first();
            const contactId = await firstRow.getAttribute('data-contact-id');
            console.log(`Row Contact ID: ${contactId}`);
            expect(contactId).toBeTruthy();

            // Drilldown check
            console.log('STEP 4: Clicking row');
            await firstRow.click();

            // Verify Contact Editor Modal
            const modal = page.locator('.modal-dialog, .editor-panel').first();
            await expect(modal).toBeVisible({ timeout: 5000 });
            console.log('STEP 5: Contact Editor opened successfully.');

            // Close modal
            await page.keyboard.press('Escape');
        } else {
            console.log('STEP 3B: Checking empty state');
            await expect(empty).toBeVisible();
            console.log('Milestones widget is empty.');
        }
    });

    test('Referral Leaderboard renders and handles drilldown', async ({ page }) => {
        console.log('Testing Referral Leaderboard...');
        const widget = page.locator('.labs-widget[data-widget-id="referralLeaderboard"]');

        await widget.scrollIntoViewIfNeeded();
        await expect(widget).toBeVisible({ timeout: 5000 });

        const list = widget.locator('[data-role="referral-list"]');
        const empty = widget.locator('.labs-widget__state--empty');

        await page.waitForTimeout(1000);

        if (await list.isVisible()) {
            const rows = list.locator('[data-role="referral-row"]');
            expect(await rows.count()).toBeGreaterThan(0);
            console.log(`Found ${await rows.count()} referral rows.`);

            const firstRow = rows.first();
            const partnerId = await firstRow.getAttribute('data-partner-id');
            expect(partnerId).toBeTruthy();

            await firstRow.click();

            const modal = page.locator('.modal-dialog, .editor-panel').first();
            await expect(modal).toBeVisible({ timeout: 5000 });
            console.log('Partner Editor opened successfully.');

            await page.keyboard.press('Escape');
        } else {
            await expect(empty).toBeVisible();
            console.log('Referral Leaderboard widget is empty.');
        }
    });
});
