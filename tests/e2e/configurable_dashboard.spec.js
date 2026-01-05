/**
 * E2E Test: Configurable Dashboard Consolidation
 * 
 * Verifies the consolidation of zNext into a single "Dashboard (Configurable)" surface
 * with saved layouts, and that legacy dashboard remains unchanged.
 */

import { test, expect } from '@playwright/test';

test.describe('Configurable Dashboard Consolidation', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:8125/#/labs');
        // Wait for the Labs dashboard to initialize
        await page.waitForSelector('[data-qa="labs-header"]', { timeout: 15000 });
    });

    test('Dashboard (Configurable) tab exists and is labeled correctly', async ({ page }) => {
        await page.goto('http://127.0.0.1:8125/');

        // Verify the nav button exists with correct text
        const navButton = page.locator('button[data-nav="labs"]');
        await expect(navButton).toBeVisible();
        await expect(navButton).toContainText('Dashboard (Configurable)');

        // Verify no "Dashboard (Preview)" button exists
        const noPreviewButton = page.locator('button:has-text("Dashboard (Preview)")');
        await expect(noPreviewButton).toHaveCount(0);
    });

    test('Dashboard (Configurable) header shows correct branding', async ({ page }) => {
        // Check title
        const title = page.locator('.labs-title');
        await expect(title).toContainText('Dashboard (Configurable)');

        // Verify no BETA badge
        const betaBadge = page.locator('.labs-badge-beta');
        await expect(betaBadge).toHaveCount(0);

        // Verify no engine toggle button
        const engineToggle = page.locator('[data-action="toggle-engine"]');
        await expect(engineToggle).toHaveCount(0);
    });

    test('Configuration controls dropdown exists', async ({ page }) => {
        // Verify config controls container exists
        const configControls = page.locator('[data-qa="config-controls"]');
        await expect(configControls).toBeVisible();

        // Verify dropdown exists
        const dropdown = page.locator('[data-action="config-select"]');
        await expect(dropdown).toBeVisible();

        // Verify Recommended option exists
        const recommendedOption = dropdown.locator('option[value="recommended"]');
        await expect(recommendedOption).toBeVisible();
        await expect(recommendedOption).toContainText('Recommended');
    });

    test('Configuration action buttons exist', async ({ page }) => {
        // Verify Save button
        const saveBtn = page.locator('[data-action="config-save"]');
        await expect(saveBtn).toBeVisible();
        await expect(saveBtn).toContainText('Save');

        // Verify Save As button  
        const saveAsBtn = page.locator('[data-action="config-save-as"]');
        await expect(saveAsBtn).toBeVisible();
        await expect(saveAsBtn).toContainText('Save As');

        // Verify Rename button
        const renameBtn = page.locator('[data-action="config-rename"]');
        await expect(renameBtn).toBeVisible();

        // Verify Delete button
        const deleteBtn = page.locator('[data-action="config-delete"]');
        await expect(deleteBtn).toBeVisible();

        // Verify Reset button
        const resetBtn = page.locator('[data-action="config-reset"]');
        await expect(resetBtn).toBeVisible();
        await expect(resetBtn).toContainText('Reset');
    });

    test('Recommended layout cannot be deleted', async ({ page }) => {
        // Select Recommended layout
        const dropdown = page.locator('[data-action="config-select"]');
        await dropdown.selectOption('recommended');

        // Delete button should be disabled
        const deleteBtn = page.locator('[data-action="config-delete"]');
        await expect(deleteBtn).toBeDisabled();

        // Rename button should also be disabled for Recommended
        const renameBtn = page.locator('[data-action="config-rename"]');
        await expect(renameBtn).toBeDisabled();
    });

    test('Legacy dashboard does not have drag/resize UI', async ({ page }) => {
        // Navigate to legacy dashboard
        await page.goto('http://127.0.0.1:8125/#/dashboard');
        await page.waitForSelector('#view-dashboard', { state: 'visible', timeout: 10000 });

        // Wait for dashboard to render
        await page.waitForTimeout(1000);

        // Verify no GridStack elements
        const gridStackItems = page.locator('#view-dashboard .grid-stack-item');
        await expect(gridStackItems).toHaveCount(0);

        // Verify no config controls (specific to Configurable Dashboard)
        const configControls = page.locator('#view-dashboard [data-action="config-select"]');
        await expect(configControls).toHaveCount(0);

        // Switch to "All" mode if toggle exists
        const allToggle = page.locator('#view-dashboard [data-action="toggle-all"]');
        if (await allToggle.isVisible()) {
            await allToggle.click();
            await page.waitForTimeout(500);

            // Still verify no GridStack
            const gridStackItemsAll = page.locator('#view-dashboard .grid-stack-item');
            await expect(gridStackItemsAll).toHaveCount(0);
        }
    });

    test('Dashboard (Configurable) uses GridStack', async ({ page }) => {
        // Should have GridStack container
        const gridStack = page.locator('.grid-stack');
        await expect(gridStack).toBeVisible({ timeout: 10000 });

        // Should have grid items
        const gridItems = page.locator('.grid-stack-item');
        const count = await gridItems.count();
        expect(count).toBeGreaterThan(0);
    });

    test('dirty state indicator exists but is initially hidden', async ({ page }) => {
        const dirtyIndicator = page.locator('[data-role="dirty-indicator"]');
        await expect(dirtyIndicator).toBeHidden();
    });
});
