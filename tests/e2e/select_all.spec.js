const { test, expect } = require('@playwright/test');

async function bootToContacts(page) {
    await page.goto('/index.html');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });
    const contactsTab = page.locator('#main-nav button[data-nav="contacts"]').first();
    await expect(contactsTab).toBeVisible();
    await contactsTab.click();
    await page.waitForSelector('#view-contacts', { state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('#view-contacts tbody tr').length > 0);
}

test.describe('Select All Regression Proof', () => {
    test('Select All behaves correctly with partial selection', async ({ page }) => {
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        await bootToContacts(page);

        // Wait for table to be populated
        const rows = page.locator('#view-contacts tbody tr[data-id]');
        await expect(rows.first()).toBeVisible({ timeout: 10000 });

        const count = await rows.count();
        console.log(`Found ${count} rows`);
        expect(count).toBeGreaterThan(0);

        // 1. Select first row (Partial Selection)
        const firstCheckbox = rows.first().locator('input[data-ui="row-check"]');
        await expect(firstCheckbox).toBeVisible();
        await firstCheckbox.check();
        await expect(firstCheckbox).toBeChecked();

        // Scroll to ensure visibility
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);

        // 2. Locate Select All Checkbox
        const selectAll = page.locator('#view-contacts input[data-role="select-all"]');
        await expect(selectAll).toBeVisible();

        // Stability wait for layout/visibility
        await page.waitForTimeout(1000);

        // 3. Click Select All -> Should Select ALL visible (increase selection)
        console.log('Clicking Select All (Expect Select All)');
        await selectAll.click();

        // Verify all selected
        const actionBar = page.locator('#actionbar');
        try {
            await expect(actionBar).toHaveAttribute('data-count', String(count), { timeout: 20000 });
        } catch (e) {
            const actual = await actionBar.getAttribute('data-count');
            const visible = await actionBar.isVisible();
            console.log(`Failed to verify count. Expected ${count}, Got ${actual}. Visible: ${visible}`);
            throw e;
        }

        // Verify all checked
        for (let i = 0; i < count; i++) {
            await expect(rows.nth(i).locator('input[data-ui="row-check"]')).toBeChecked();
        }

        // 4. Click Select All again -> Should Clear ALL (empty selection)
        console.log('Clicking Select All Again (Expect Clear)');
        await selectAll.click();

        // Verify cleared
        await expect(async () => {
            const isVisible = await actionBar.isVisible();
            const countAttr = await actionBar.getAttribute('data-count');
            if (isVisible && countAttr !== '0') {
                throw new Error('Action bar still visible with count ' + countAttr);
            }
        }).toPass({ timeout: 10000 });

        for (let i = 0; i < count; i++) {
            await expect(rows.nth(i).locator('input[data-ui="row-check"]')).not.toBeChecked();
        }

        // 5. REGRESSION TEST: Navigate away and back
        console.log('Navigating to Dashboard and back to check re-render binding');
        await page.click('#main-nav button[data-nav="dashboard"]');
        await page.waitForSelector('#view-dashboard', { state: 'visible' });
        await page.click('#main-nav button[data-nav="contacts"]');
        await page.waitForSelector('#view-contacts', { state: 'visible' });
        await page.waitForFunction(() => document.querySelectorAll('#view-contacts tbody tr').length > 0);

        // 6. Select All again -> Should work (expect N selected)

        // Handle persistence: If already selected, we expect Clear first
        const initCount = await actionBar.getAttribute('data-count');
        const persisted = initCount === String(count);

        const newSelectAll = page.locator('#view-contacts input[data-role="select-all"]');
        await expect(newSelectAll).toBeVisible();

        if (persisted) {
            await newSelectAll.click(); // Clear
            await expect(actionBar).not.toBeVisible({ timeout: 5000 });
            await newSelectAll.click(); // Select All
        } else {
            await newSelectAll.click();
        }

        // Verify all selected again
        await expect(actionBar).toHaveAttribute('data-count', String(count), { timeout: 20000 });
        await expect(actionBar).toHaveAttribute('data-count', String(count), { timeout: 20000 });
    });
});

