
import { test, expect } from '@playwright/test';

async function waitForBoot(page) {
    await page.waitForFunction(() => {
        const boot = window.__BOOT_DONE__;
        if (boot && typeof boot.then === 'function') return false;
        if (boot && typeof boot === 'object') return true;
        return document.documentElement?.getAttribute('data-booted') === '1';
    });
}

async function assertNoDashboardRefreshSpam(page) {
    const notifications = page.locator('.labs-notification');
    const count = await notifications.count();
    if (count > 0) {
        expect(count).toBeLessThanOrEqual(1);
    }
}

async function ensureSelectionCleared(page, table) {
    const checked = table.locator('tbody input[data-ui="row-check"]:checked');
    const checkedCount = await checked.count();
    if (checkedCount === 0) return;
    const actionBar = page.locator('[data-ui="action-bar"]').first();
    const clearButton = actionBar.locator('button[data-act="clear"]');
    if (await clearButton.count()) {
        await clearButton.click();
        await expect(actionBar).not.toBeVisible();
    }
}

async function setSelectAll(tableHandle, checked) {
    const updated = await tableHandle.evaluate((tableEl, isChecked) => {
        const inputs = Array.from(tableEl.querySelectorAll('input[data-role="select-all"]'));
        const preferred = inputs.find((input) => {
            if (input.hidden) return false;
            if (input.getAttribute('aria-hidden') === 'true') return false;
            if (input.getAttribute('data-auto-hidden') === '1') return false;
            const style = window.getComputedStyle(input);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = input.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });
        const input = preferred || inputs[0] || null;
        if (!input) return false;
        input.indeterminate = false;
        const checkedRows = tableEl.querySelectorAll('tbody input[data-ui="row-check"]:checked');
        const shouldClick = input.checked !== isChecked || (isChecked && checkedRows.length === 0);
        if (shouldClick) {
            input.click();
        }
        return true;
    }, checked);
    if (!updated) throw new Error('Select-all checkbox not found');
}

async function assertSelectAllToggle(page, scope) {
    await page.goto(`/#${scope}`);
    await waitForBoot(page);
    const table = page.locator(`table[data-selection-scope="${scope}"]:visible`).first();
    await expect(table).toBeVisible();
    await ensureSelectionCleared(page, table);

    const actionBar = page.locator('[data-ui="action-bar"]').first();
    const rowChecks = table.locator('tbody input[data-ui="row-check"]');
    await expect(rowChecks.first()).toBeVisible();
    const tableHandle = await table.elementHandle();
    expect(tableHandle).not.toBeNull();
    await setSelectAll(tableHandle, true);
    await expect.poll(async () => {
        const countAttr = await actionBar.getAttribute('data-count');
        return Number(countAttr || '0');
    }).toBeGreaterThan(0);
    await expect(actionBar).toBeVisible();

    await setSelectAll(tableHandle, false);
    await expect(actionBar).not.toBeVisible();
    await expect(actionBar).toHaveAttribute('data-count', '0');
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
        await assertNoDashboardRefreshSpam(page);

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
        await assertNoDashboardRefreshSpam(page);
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
        await assertNoDashboardRefreshSpam(page);
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

        const tableHandle = await page.locator('table[data-selection-scope="contacts"]:visible').first().elementHandle();
        expect(tableHandle).not.toBeNull();
        await setSelectAll(tableHandle, true);
        await expect(actionBar).toBeVisible();
        await expect(actionBar).toHaveAttribute('data-count', /[1-9]\d*/);

        await actionBar.locator('button[data-act="clear"]').click();
        await expect(actionBar).not.toHaveAttribute('data-visible', '1');
        await expect(actionBar).toHaveAttribute('data-count', '0');
        await expect(page.locator('table[data-selection-scope="contacts"] tbody tr[data-id] input[data-ui="row-check"]:checked')).toHaveCount(0);
    });

    test('should toggle select-all across contacts partners pipeline', async ({ page }) => {
        await assertSelectAllToggle(page, 'contacts');
        await assertSelectAllToggle(page, 'partners');
        await assertSelectAllToggle(page, 'pipeline');
    });

    test('should keep action bar stable across tab switching select-all cycles', async ({ page }) => {
        let subscriberFailures = 0;
        page.on('console', msg => {
            if (msg.text().includes('subscriber failed')) {
                subscriberFailures += 1;
            }
        });

        for (let cycle = 0; cycle < 2; cycle += 1) {
            await assertSelectAllToggle(page, 'contacts');
            await assertSelectAllToggle(page, 'partners');
            await assertSelectAllToggle(page, 'pipeline');
        }

        expect(subscriberFailures).toBe(0);
    });
});
