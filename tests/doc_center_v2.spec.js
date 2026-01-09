import { test, expect } from '@playwright/test';

test('Document Center V2 Kanban Load', async ({ page }) => {
    // 1. Load App
    await page.addInitScript(() => localStorage.setItem('flag_show_doc_widget', '1'));
    await page.goto('http://127.0.0.1:8080/#doc-center');
    await page.waitForSelector('#view-dashboard:not(.hidden)');
    await page.evaluate(() => window.DocCenter?.openDocumentCenter?.({ contextType: 'dashboard', source: 'e2e' }));
    await expect(page.locator('[data-doc-filters]')).toHaveCount(1);

    // 2. Open a Contact (First one in list)
    await page.click('[data-nav="contacts"]');
    await page.waitForSelector('#tbl-contacts tr[data-id]');
    await page.click('#tbl-contacts tr[data-id] td:first-child'); // Click first row

    // 3. Wait for Modal
    await page.waitForSelector('#contact-modal[open]');

    // 4. Click Document Checklist Tab
    await page.click('button[data-panel="docs"]');

    // 5. Verify Kanban Board Elements
    // The V2 patch creates elements with [data-doc-board] or class .doc-board-lanes
    const board = page.locator('[data-doc-board]');
    await expect(board).toBeVisible({ timeout: 5000 });

    // 6. Verify Lanes
    await expect(page.locator('.doc-lane-header:has-text("Requested")')).toBeVisible();
    await expect(page.locator('.doc-lane-header:has-text("Received")')).toBeVisible();

    console.log('Document Center V2 Kanban verified successfully.');
});
