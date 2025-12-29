
const { test, expect } = require('@playwright/test');

test.describe('Labs Default & Remaining Parity', () => {

    // 1. Verify Default Route
    test('Root / redirects to /#/labs', async ({ page }) => {
        // Navigate to root
        await page.goto('/');

        // Check URL
        await expect(page).toHaveURL(/.*#\/labs/);

        // Check Labs dashboard visible
        await expect(page.locator('.labs-crm-dashboard')).toBeVisible({ timeout: 10000 });
    });

    // 2. Verify Legacy Fallback
    test('Can navigate to Legacy Dashboard', async ({ page }) => {
        await page.goto('/#/labs');
        // If we added a link, click it. Otherwise force navigation to test accessibility.
        // For now, testing direct navigation works.
        await page.goto('/#/dashboard');
        await expect(page).toHaveURL(/.*#\/dashboard/);

        // Check for legacy dashboard element (e.g. .dashboard-container or .kpi-row)
        // Legacy dashboard usually has .card elements or #dashboard
        // Check for legacy dashboard element using valid ID
        await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 10000 });
    });

    // 3. Verify Remaining Widgets Parity
    test('Upcoming Celebrations renders and handles drilldown', async ({ page }) => {
        await page.goto('/#/labs');
        const widget = page.locator('.labs-widget[data-widget-id="upcomingCelebrations"]');
        await widget.scrollIntoViewIfNeeded();
        await expect(widget).toBeVisible();

        const list = widget.locator('.celebration-list');
        if (await list.isVisible()) {
            const rows = list.locator('[data-role="celebration-row"]');
            expect(await rows.count()).toBeGreaterThan(0);

            await rows.first().click();

            const modal = page.locator('.modal-dialog, .editor-panel').first();
            await expect(modal).toBeVisible();
            await page.keyboard.press('Escape');
        }
    });

    test('Favorites renders and handles drilldown', async ({ page }) => {
        await page.goto('/#/labs');
        const widget = page.locator('.labs-widget[data-widget-id="favorites"]');
        await widget.scrollIntoViewIfNeeded();
        await expect(widget).toBeVisible();

        const list = widget.locator('.favorite-list');
        if (await list.isVisible()) {
            const rows = list.locator('[data-role="favorite-row"]');
            expect(await rows.count()).toBeGreaterThan(0);

            await rows.first().click();

            const modal = page.locator('.modal-dialog, .editor-panel').first();
            await expect(modal).toBeVisible();
            await page.keyboard.press('Escape');
        }
    });

});
