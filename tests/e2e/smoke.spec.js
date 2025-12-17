const { test, expect } = require('@playwright/test');

const navTargets = ['dashboard', 'pipeline', 'partners', 'contacts', 'calendar', 'longshots', 'settings', 'workbench'];

async function ensureNavVisible(page, target) {
  const button = page.locator(`#main-nav button[data-nav="${target}"]`).first();
  await expect(button).toBeVisible();
  await button.click();
  const view = page.locator(`#view-${target}`);
  await expect(view).toBeVisible();
}

test.describe('CRM smoke', () => {
  test('boots without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/index.html');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });

    await expect(page.locator('#btn-open-settings')).toBeVisible();
    await expect(page.locator('#global-search-root')).toBeVisible();

    for (const nav of navTargets) {
      if (await page.locator(`#main-nav button[data-nav="${nav}"]`).count() > 0) {
        await ensureNavVisible(page, nav);
      }
    }

    // Settings via header shortcut
    await page.locator('#btn-open-settings').click();
    await expect(page.locator('#view-settings')).toBeVisible();

    expect(errors).toEqual([]);
  });


});
