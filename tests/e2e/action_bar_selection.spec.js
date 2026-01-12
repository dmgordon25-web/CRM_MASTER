import { test, expect } from '@playwright/test';

async function waitForBoot(page) {
  await page.waitForFunction(() => {
    const boot = window.__BOOT_DONE__;
    if (boot && typeof boot.then === 'function') return false;
    if (boot && typeof boot === 'object') return true;
    return document.documentElement?.getAttribute('data-booted') === '1';
  });
}

test('tripwire selection flow across contacts partners pipeline', async ({ page }) => {
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
    await page.goto(`/#${scope}`);
    await waitForBoot(page);
    const table = page.locator(`table[data-selection-scope="${scope}"]:visible`).first();
    await expect(table).toBeVisible();

    const actionBar = page.locator('[data-ui="action-bar"]').first();
    const rowCheckbox = table.locator('tbody input[data-ui="row-check"]').first();
    await expect(rowCheckbox).toBeVisible();
    await rowCheckbox.click();
    await expect(actionBar).toBeVisible();

    const selectAll = table.locator('thead input[data-role="select-all"]').first();
    await expect(selectAll).toBeVisible();
    await selectAll.click();
    await expect.poll(async () => {
      return table.locator('tbody input[data-ui="row-check"]:checked').count();
    }).toBeGreaterThan(0);

    await selectAll.click();
    await expect.poll(async () => {
      return table.locator('tbody input[data-ui="row-check"]:checked').count();
    }).toBe(0);
    await expect(actionBar).not.toBeVisible();
  }

  expect(errors).toEqual([]);
});
