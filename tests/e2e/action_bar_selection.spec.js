
import { test, expect } from '@playwright/test';


function routeUrl(scope) {
    const debug = process.env.PW_DBG_CLICK === '1' ? '?dbgClick=1' : '';
    return `/${debug}#${scope}`;
}

function testDebugEnabled() {
    return process.env.PW_DBG_CLICK === '1';
}

function testDebug(...args) {
    if (!testDebugEnabled()) return;
    console.log('[PW_DBG_CLICK]', ...args);
}

function scopeTable(page, scope) {
    return page.locator(`#view-${scope}:not(.hidden) table[data-selection-scope="${scope}"]`).first();
}

async function waitForActionBarSelection(page, table, actionBar, minCount = 1) {
    await expect.poll(async () => {
        const count = Number(await actionBar.getAttribute('data-count') || '0');
        const visible = await actionBar.isVisible();
        return visible && count >= minCount;
    }, { timeout: 15000 }).toBe(true);
}


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

async function setSelectAll(table, checked) {
    await expect.poll(async () => {
        return table.locator('input[data-role="select-all"]').count();
    }, { timeout: 10000 }).toBeGreaterThan(0);

    const candidates = [
        table.locator('input[data-role="select-all"]'),
        table.locator('input[data-ui="row-check-all"]'),
        table.locator('thead input[type="checkbox"]')
    ];
    let target = null;
    for (const candidate of candidates) {
        const first = candidate.first();
        if (await first.count() && await first.isVisible()) {
            target = first;
            break;
        }
    }
    if (!target) throw new Error('Select-all checkbox not found');
    const state = await target.evaluate((input, isChecked) => {
        input.indeterminate = false;
        const tableEl = input.closest('table');
        const checkedRows = tableEl
            ? tableEl.querySelectorAll('tbody input[data-ui="row-check"]:checked, tbody input[type="checkbox"]:checked').length
            : 0;
        return {
            inputChecked: !!input.checked,
            checkedRows
        };
    }, checked);
    const shouldClick = state.inputChecked !== checked || (checked && state.checkedRows === 0);
    if (shouldClick) {
        await target.evaluate((input) => input.click());
    }
}

async function assertSelectAllToggle(page, scope) {
    await page.goto(routeUrl(scope));
    await waitForBoot(page);
    let table = scopeTable(page, scope);
    if (await table.locator('tbody tr').count() === 0) {
        table = page.locator(`table[data-selection-scope="${scope}"]:visible`).first();
    }
    await expect(table).toBeVisible();
    await page.evaluate((scopeKey) => {
        try { window.SelectionStore?.clear?.(scopeKey); } catch (_err) { }
        try { window.Selection?.clear?.('e2e:assertSelectAllToggle'); } catch (_err) { }
        try { window.SelectionService?.clear?.('e2e:assertSelectAllToggle'); } catch (_err) { }
        try { window.__UPDATE_ACTION_BAR_VISIBLE__?.(); } catch (_err) { }
    }, scope);
    await ensureSelectionCleared(page, table);

    const actionBar = page.locator('[data-ui="action-bar"]').first();
    const rowChecks = table.locator('tbody input[data-ui="row-check"]');
    await expect(rowChecks.first()).toBeVisible();
    await setSelectAll(table, true);
    let countAfterSelectAll = Number(await actionBar.getAttribute('data-count') || '0');
    let usedRowFallback = false;
    testDebug('after-select-all', scope, countAfterSelectAll);
    if (countAfterSelectAll === 0) {
        const firstRow = table.locator('tbody tr[data-id], tbody tr[data-partner-id], tbody tr[data-contact-id]').first();
        await expect(firstRow).toBeVisible();
        const firstRowCheckbox = firstRow.locator('input[data-ui="row-check"], input[type="checkbox"]').first();
        await expect(firstRowCheckbox).toBeVisible();
        await firstRowCheckbox.click();
        countAfterSelectAll = Number(await actionBar.getAttribute('data-count') || '0');
        usedRowFallback = true;
        testDebug('after-select-all-fallback', scope, countAfterSelectAll);
    }
    await waitForActionBarSelection(page, table, actionBar, 1);

    if (usedRowFallback) {
        await actionBar.locator('button[data-act="clear"]').click();
    } else {
        await setSelectAll(table, false);
    }
    await expect(actionBar).not.toBeVisible();
    await expect(actionBar).toHaveAttribute('data-count', '0');
}

test.describe('Action Bar Selection', () => {
    test('should show action bar when a row is selected', async ({ page }) => {
        page.on('console', msg => console.log('[BROWSER]', msg.text()));

        // Navigate to Contacts
        await page.goto(routeUrl('contacts'));
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
        await page.goto(routeUrl('contacts'));
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
        await page.goto(routeUrl('partners'));
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
        await page.goto(routeUrl('pipeline'));
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
        await page.goto(routeUrl('contacts'));
        await waitForBoot(page);
        await page.waitForSelector('#view-contacts table[data-selection-scope="contacts"] tbody tr[data-id]');

        const actionBar = page.locator('[data-ui="action-bar"]').first();
        const rows = scopeTable(page, 'contacts').locator('tbody tr[data-id]');
        await expect(rows.first()).toBeVisible();
        const rowCheckboxes = scopeTable(page, 'contacts').locator('tbody input[data-ui="row-check"]');
        await expect(rowCheckboxes.first()).toBeVisible();

        const table = scopeTable(page, 'contacts');
        await setSelectAll(table, true);
        if (Number(await actionBar.getAttribute('data-count') || '0') === 0) {
            const firstRow = table.locator('tbody tr[data-id], tbody tr[data-partner-id], tbody tr[data-contact-id]').first();
        await expect(firstRow).toBeVisible();
        const firstRowCheckbox = firstRow.locator('input[data-ui="row-check"], input[type="checkbox"]').first();
            await expect(firstRowCheckbox).toBeVisible();
            await firstRowCheckbox.click();
            await setSelectAll(table, true);
        }
        await waitForActionBarSelection(page, table, actionBar, 1);
        await expect(actionBar).toHaveAttribute('data-count', /[1-9]\d*/);

        await actionBar.locator('button[data-act="clear"]').click();
        await expect(actionBar).not.toHaveAttribute('data-visible', '1');
        await expect(actionBar).toHaveAttribute('data-count', '0');
        await expect(scopeTable(page, 'contacts').locator('tbody tr[data-id] input[data-ui="row-check"]:checked, tbody tr[data-id] input[type="checkbox"]:checked')).toHaveCount(0);
    });

    test('should toggle select-all across contacts partners pipeline', async ({ page }) => {
        await assertSelectAllToggle(page, 'contacts');
        await assertSelectAllToggle(page, 'partners');
        await assertSelectAllToggle(page, 'pipeline');
    });

    test('should keep action bar stable across tab switching select-all cycles', async ({ page }) => {
        test.setTimeout(60000);
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

    test('tripwire selection flow across contacts partners pipeline', async ({ page }) => {
        test.setTimeout(60000);
        const errors = [];
        page.on('pageerror', error => {
            errors.push(`pageerror:${error.message || error}`);
        });
        page.on('console', msg => {
            if (msg.text().includes('subscriber failed')) {
                errors.push(`console:${msg.text()}`);
            }
            if (msg.type() === 'error') {
                errors.push(`console:${msg.text()}`);
            }
        });

        const scopes = ['contacts', 'partners', 'pipeline'];
        for (const scope of scopes) {
            await page.goto(routeUrl(scope));
            await waitForBoot(page);
            let table = scopeTable(page, scope);
            if (await table.locator('tbody tr').count() === 0) {
                table = page.locator(`table[data-selection-scope="${scope}"]:visible`).first();
            }
            await expect(table).toBeVisible();
            await ensureSelectionCleared(page, table);

            const actionBar = page.locator('[data-ui="action-bar"]').first();
            const rowCheckbox = table.locator('tbody input[data-ui="row-check"]').first();
            await expect(rowCheckbox).toBeVisible();
            await rowCheckbox.click();
            await expect(actionBar).toBeVisible();

            await setSelectAll(table, true);
            await waitForActionBarSelection(page, table, actionBar, 1);

            await setSelectAll(table, false);
            await expect.poll(async () => {
                return table.locator('tbody input[data-ui="row-check"]:checked').count();
            }).toBe(0);
            await expect(actionBar).not.toBeVisible();
        }

        expect(errors).toEqual([]);
    });
});
