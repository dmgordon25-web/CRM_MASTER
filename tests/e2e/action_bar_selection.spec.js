
import { test, expect } from '@playwright/test';

async function waitForBoot(page) {
    await page.waitForFunction(() => {
        const boot = window.__BOOT_DONE__;
        if (boot && typeof boot.then === 'function') return false;
        if (boot && typeof boot === 'object') return true;
        return document.documentElement?.getAttribute('data-booted') === '1';
    });
}

test.describe('Action Bar Selection', () => {
    test('should show action bar when a row is selected', async ({ page }) => {
        page.on('console', msg => console.log('[BROWSER]', msg.text()));

        // Navigate to Contacts
        await page.goto('/#contacts');
        await waitForBoot(page);
        await page.waitForSelector('table[data-selection-scope="contacts"]');

        // Ensure action bar is initially hidden or minimized
        const actionBar = page.locator('[data-ui="action-bar"]').first();
        await expect(actionBar).not.toBeVisible();

        // Find the first row's checkbox
        const firstRowCheckbox = page.locator('table[data-selection-scope="contacts"] tbody tr[data-id] input[data-ui="row-check"]').first();

        // Click the checkbox
        await firstRowCheckbox.click();

        // Verify action bar becomes visible
        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-visible', '1');
        await expect(actionBar).toHaveAttribute('data-count', '1');

        // Click again to deselect
        await firstRowCheckbox.click();

        // Verify action bar hides
        await expect(actionBar).not.toBeVisible();
    });

    test('should show action bar when multiple rows are selected', async ({ page }) => {
        // Navigate to Contacts
        await page.goto('/#contacts');
        await waitForBoot(page);
        await page.waitForSelector('table[data-selection-scope="contacts"]');

        const actionBar = page.locator('[data-ui="action-bar"]');
        const checkboxes = page.locator('table[data-selection-scope="contacts"] tbody tr[data-id] input[data-ui="row-check"]');

        // Select first two rows
        await checkboxes.nth(0).click();
        await checkboxes.nth(1).click();

        // Verify count is 2
        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-count', '2');
    });

    test('should show action bar for partners selection', async ({ page }) => {
        await page.goto('/#partners');
        await waitForBoot(page);
        await page.waitForSelector('table[data-selection-scope="partners"]');

        const actionBar = page.locator('[data-ui="action-bar"]').first();
        const firstRowCheckbox = page.locator('table[data-selection-scope="partners"] tbody tr[data-id] input[data-ui="row-check"]').first();

        await firstRowCheckbox.click();

        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-count', '1');
    });

    test('should show action bar for pipeline selection', async ({ page }) => {
        await page.goto('/#pipeline');
        await waitForBoot(page);
        await page.waitForSelector('table[data-selection-scope="pipeline"]');

        const actionBar = page.locator('[data-ui="action-bar"]').first();
        const pipelineTable = page.locator('table[data-selection-scope="pipeline"]');
        let rowCheckbox = pipelineTable.locator('tbody input[data-ui="row-check"]').first();
        if (await rowCheckbox.count() === 0) {
            rowCheckbox = pipelineTable.locator('tbody input[type="checkbox"]').first();
        }

        await rowCheckbox.click();

        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-count', '1');
    });

    test('should keep action bar in sync for select-all and clear', async ({ page }) => {
        await page.goto('/#contacts');
        await waitForBoot(page);
        await page.waitForSelector('table[data-selection-scope="contacts"] tbody tr[data-id]');

        const actionBar = page.locator('[data-ui="action-bar"]').first();
        const rows = page.locator('table[data-selection-scope="contacts"] tbody tr[data-id]');
        await expect(rows.first()).toBeVisible();
        const rowCheckboxes = page.locator('table[data-selection-scope="contacts"] tbody input[data-ui="row-check"]');
        await expect(rowCheckboxes.first()).toBeVisible();

        const selectAll = page.locator('table[data-selection-scope="contacts"] input[data-role="select-all"]');
        await expect(selectAll).toBeVisible();
        await selectAll.check();
        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-count', /[1-9]\d*/);

        await actionBar.locator('button[data-act="clear"]').click();
        await expect(actionBar).not.toHaveAttribute('data-visible', '1');
        await expect(actionBar).toHaveAttribute('data-count', '0');
        await expect(page.locator('table[data-selection-scope="contacts"] tbody tr[data-id] input[data-ui="row-check"]:checked')).toHaveCount(0);
    });
});
