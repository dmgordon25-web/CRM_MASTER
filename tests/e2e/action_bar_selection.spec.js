
import { test, expect } from '@playwright/test';

test.describe('Action Bar Selection', () => {
    test('should show action bar when a row is selected', async ({ page }) => {
        page.on('console', msg => console.log('[BROWSER]', msg.text()));

        // Navigate to Contacts
        await page.goto('/#contacts');
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
});
