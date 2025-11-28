import { test, expect } from '@playwright/test';

test('Calendar Test', async ({ page }) => {
    await page.goto('http://localhost:8080/#/calendar');
    // Wait for the view to load
    await page.waitForTimeout(1000);
    // Assert: The element div.calendar-view (or #calendar-root) exists and is visible.
    // We'll check for both possibilities or a generic container
    const calendar = page.locator('.calendar-view, #calendar-root, [data-ui="calendar-root"]');
    await expect(calendar.first()).toBeVisible();
});

test('Editor Test', async ({ page }) => {
    await page.goto('http://localhost:8080');
    // Click the Global New Button -> Contact
    // Assuming #quick-add is the button. If it opens a menu, we need to handle that.
    // Based on previous steps, #quick-add might open the modal directly if the menu is disabled.
    // If the menu is enabled, we click #quick-add then "Contact".

    const newBtn = page.locator('#quick-add-unified');
    await newBtn.click();

    // Check if menu opens
    const menu = page.locator('#header-new-menu');
    if (await menu.isVisible()) {
        await menu.getByText('Contact').click();
    }

    // Assert: The modal [data-ui="contact-edit-modal"] becomes visible (display != none).
    const modal = page.locator('[data-ui="contact-edit-modal"]');
    await expect(modal).toBeVisible();
});

test('Action Bar Test', async ({ page }) => {
    await page.goto('http://localhost:8080/#/contacts');
    // Select a contact row
    // Wait for rows to load
    await page.waitForSelector('input[type="checkbox"][data-ui="row-check"]');

    const checkbox = page.locator('input[type="checkbox"][data-ui="row-check"]').first();
    await checkbox.check();

    // Verify Action Bar appears
    const actionBar = page.locator('#action-bar');
    await expect(actionBar).toBeVisible();

    // Deselect the row
    await checkbox.uncheck();

    // Assert: Action Bar display is none.
    await expect(actionBar).toBeHidden();
    await expect(actionBar).toHaveCSS('display', 'none');
});
