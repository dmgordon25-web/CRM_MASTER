import { test, expect } from '@playwright/test';

test.describe('Packet B: Seeding & Calendar Parity', () => {
  test('runs Demo Week seed profile and validates calendar + pipeline coverage', async ({ page }) => {
    await page.goto('/index.html?e2e=1#/settings');
    await page.waitForSelector('.settings-panel');
    await page.locator('#settings-nav button[data-panel="data"]').click();
    await page.waitForSelector('.settings-panel[data-panel="data"].active, .settings-panel[data-panel="data"]:not([hidden])');

    await page.locator('#seed-profile-select').selectOption('demo-week');
    await page.locator('#btn-run-seed-profile').click();

    await expect.poll(async () => {
      return page.evaluate(async () => {
        const events = await window.dbGetAll('events');
        return Array.isArray(events) ? events.length : 0;
      });
    }).toBeGreaterThan(12);

    await page.goto('/index.html?e2e=1#/calendar');
    await page.waitForSelector('.calendar-month-grid');

    const visibleLegendCount = await page.locator('.calendar-legend .legend-chip').count();
    expect(visibleLegendCount).toBeGreaterThanOrEqual(6);

    const distinctEventCategories = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.event-chip[data-category]'));
      return new Set(chips.map((el) => el.getAttribute('data-category'))).size;
    });
    expect(distinctEventCategories).toBeGreaterThanOrEqual(6);

    await page.goto('/index.html?e2e=1#/pipeline');
    await page.waitForFunction(() => document.querySelectorAll('#view-pipeline tbody tr').length > 0);

    const pipelineRows = await page.locator('#view-pipeline tbody tr').count();
    expect(pipelineRows).toBeGreaterThanOrEqual(8);
  });
});
