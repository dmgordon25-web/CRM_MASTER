import { test, expect, Page } from '@playwright/test';

async function countRows(page: Page, selector: string) {
  const rows = page.locator(`${selector} tbody tr`);
  await expect(rows.first()).toBeVisible();
  return rows.count();
}

test.describe('workflow counts stay consistent across navigation', () => {
  test('pipeline and leads totals remain stable', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#tbl-pipeline tbody');

    const initialPipeline = await countRows(page, '#tbl-pipeline');
    const initialLeads = await countRows(page, '#tbl-longshots');

    await page.click('#main-nav button[data-nav="dashboard"]');
    await page.waitForSelector('#goal-funded-label');
    await page.click('#main-nav button[data-nav="pipeline"]');
    await page.waitForSelector('#tbl-pipeline tbody');

    const pipelineAfterNav = await countRows(page, '#tbl-pipeline');
    const leadsAfterNav = await countRows(page, '#tbl-longshots');

    expect(pipelineAfterNav).toBe(initialPipeline);
    expect(leadsAfterNav).toBe(initialLeads);

    await page.reload();
    await page.waitForSelector('#tbl-pipeline tbody');
    const pipelineAfterReload = await countRows(page, '#tbl-pipeline');
    const leadsAfterReload = await countRows(page, '#tbl-longshots');

    expect(pipelineAfterReload).toBe(initialPipeline);
    expect(leadsAfterReload).toBe(initialLeads);
  });
});
