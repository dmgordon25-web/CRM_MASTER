import { test, expect } from '@playwright/test';

test.describe('Dashboard Header & Toggle Parity', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to root which should redirect to dashboard
        await page.goto('/#/dashboard');
        await page.waitForTimeout(1000); // Allow for boot
    });

    test('Dashboard loads with persistent header and without Configurable hero', async ({ page }) => {
        // 1. Verify Header Elements
        const header = page.locator('#dashboard-header');
        await expect(header).toBeVisible();
        await expect(header).not.toHaveClass(/hidden/);

        const title = header.locator('h2');
        await expect(title).toHaveText('Dashboard');

        // 2. Verify Toggle Buttons
        const todayBtn = header.locator('[data-dashboard-mode="today"]');
        const allBtn = header.locator('[data-dashboard-mode="all"]');
        await expect(todayBtn).toBeVisible();
        await expect(allBtn).toBeVisible();
        await expect(todayBtn).toHaveClass(/active/);

        // 3. Verify KPIs
        const kpis = header.locator('#dashboard-header-kpis');
        await expect(kpis).toBeVisible();
        // Check for "Contacts", "Partners" labels
        await expect(kpis).toContainText('Contacts');
        await expect(kpis).toContainText('Partners');

        // 4. Verify View Container is "view-dashboard"
        const viewDashboard = page.locator('#view-dashboard');
        await expect(viewDashboard).toBeVisible();

        // 5. Verify "Dashboard (Configurable)" hero is NOT present
        // The hero usually has h3 "Dashboard (Configurable)"
        const hero = page.locator('h3:has-text("Dashboard (Configurable)")');
        await expect(hero).not.toBeVisible();

        // 6. Verify Legend is Visible (inline)
        const legend = header.locator('.dashboard-legend');
        await expect(legend).toBeVisible();

        // Check for specific legend items
        await expect(legend.locator('.dashboard-legend-item')).toHaveCount(6); // 6 stages
        await expect(legend).toContainText('Leads & nurture');
        await expect(legend).toContainText('Lost / Denied');
    });

    test('Switching to All mode shows Unmounted View', async ({ page }) => {
        const header = page.locator('#dashboard-header');
        const allBtn = header.locator('[data-dashboard-mode="all"]');

        // Click All
        await allBtn.click();
        await page.waitForTimeout(500);

        // 1. Header should still be visible
        await expect(header).toBeVisible();
        await expect(allBtn).toHaveClass(/active/);

        // 2. "view-dashboard" (Legacy/Configurable) should be VISIBLE
        const viewDashboard = page.locator('#view-dashboard');
        await expect(viewDashboard).toBeVisible();

        // 3. Labs Host should be HIDDEN (Unmounted)
        const labsHost = page.locator('#dashboard-labs-classic-host');
        if (await labsHost.count() > 0) {
            await expect(labsHost).not.toBeVisible();
        }
    });

    test('Today Mode shows Mounted View', async ({ page }) => {
        const header = page.locator('#dashboard-header');
        const todayBtn = header.locator('[data-dashboard-mode="today"]');
        const allBtn = header.locator('[data-dashboard-mode="all"]');

        // Ensure we start in All
        await allBtn.click();
        await page.waitForTimeout(500);

        // Click Today
        await todayBtn.click();
        await page.waitForTimeout(500);

        // 1. "view-dashboard" should be HIDDEN
        const viewDashboard = page.locator('#view-dashboard');
        await expect(viewDashboard).not.toBeVisible();

        // 2. Labs Host should be VISIBLE
        const labsHost = page.locator('#dashboard-labs-classic-host');
        await expect(labsHost).toBeVisible();
    });

    test('Switching to Today shows Legacy Today View', async ({ page }) => {
        const header = page.locator('#dashboard-header');
        const todayBtn = header.locator('[data-dashboard-mode="today"]');
        const allBtn = header.locator('[data-dashboard-mode="all"]');

        // Ensure we start in All (since beforeEach goes to dashboard default which might be Today)
        await allBtn.click();
        await page.waitForTimeout(500);

        // Click Today
        await todayBtn.click();
        await page.waitForTimeout(500);

        // 1. "view-dashboard" should be HIDDEN (Configurable hidden)
        const viewDashboard = page.locator('#view-dashboard');
        await expect(viewDashboard).not.toBeVisible();

        // 2. Labs Classic Host (Legacy wrapper) should be VISIBLE
        const labsHost = page.locator('#dashboard-labs-classic-host');
        await expect(labsHost).toBeVisible();
    });

    test('Header hides when navigating to valid non-dashboard route', async ({ page }) => {
        // Switch to Pipeline
        await page.goto('/#/pipeline');
        await page.waitForTimeout(500);

        const header = page.locator('#dashboard-header');
        await expect(header).not.toBeVisible();

        // Switch back
        await page.goto('/#/dashboard');
        await page.waitForTimeout(500);
        await expect(header).toBeVisible();
    });
});
