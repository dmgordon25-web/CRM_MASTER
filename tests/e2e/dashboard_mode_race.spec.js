import { test, expect } from '@playwright/test';

test.describe('Dashboard mode race: All ↔ Today', () => {
  test('rapid toggles never leave Labs visible in Today mode', async ({ page }) => {
    const consoleModeErrors = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/dashboard|mode|labs|mount|unmount/i.test(text)) {
        consoleModeErrors.push(text);
      }
    });

    await page.goto('/#/dashboard');

    const header = page.locator('#dashboard-header');
    const todayBtn = header.locator('[data-dashboard-mode="today"]');
    const allBtn = header.locator('[data-dashboard-mode="all"]');
    const viewDashboard = page.locator('#view-dashboard');
    const labsHost = page.locator('#dashboard-labs-classic-host');

    await expect(header).toBeVisible();
    await expect(todayBtn).toBeVisible();
    await expect(allBtn).toBeVisible();
    await expect(todayBtn).toHaveClass(/active/);

    for (let i = 0; i < 10; i += 1) {
      await allBtn.click();
      await expect(allBtn).toHaveClass(/active/);

      await todayBtn.click();
      await expect(todayBtn).toHaveClass(/active/);

      await expect(viewDashboard).toBeVisible();
      await expect(viewDashboard).not.toHaveJSProperty('hidden', true);
      await expect(viewDashboard).not.toHaveCSS('display', 'none');
      await expect(labsHost).not.toBeVisible();
    }

    await expect(todayBtn).toHaveClass(/active/);
    await expect(viewDashboard).toBeVisible();

    const firstCard = viewDashboard.locator('section.card, div.card').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();
    await expect(viewDashboard).toBeVisible();

    expect(consoleModeErrors).toEqual([]);
  });
});
