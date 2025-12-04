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

async function scrollToContactRow(page, index = 10) {
  const rowId = await page.evaluate((targetIndex) => {
    const rows = document.querySelectorAll('#view-contacts tbody tr');
    if (!rows.length) return null;
    const idx = Math.min(Math.max(targetIndex, 0), rows.length - 1);
    const row = rows[idx];
    row?.scrollIntoView({ block: 'center' });
    return row?.getAttribute('data-id') || row?.getAttribute('data-contact-id');
  }, index);

  expect(rowId, 'contact row id should resolve').toBeTruthy();
  return rowId;
}

test.describe('selection + scroll stability', () => {
  test('contacts editor preserves scroll and clears selection predictably', async ({ page }) => {
    await bootToContacts(page);

    const targetId = await scrollToContactRow(page, 24);
    const targetRow = page.locator(`#view-contacts tbody tr[data-id="${targetId}"]`);

    // Ensure the selection affordance is reachable before interacting
    const checkbox = targetRow.locator('input[data-ui="row-check"]');
    await expect(checkbox).toBeVisible();

    await checkbox.check();
    await expect(checkbox).toBeChecked();

    const scrollBefore = await page.evaluate(() => Math.round(window.scrollY));

    await targetRow.locator('a[data-role="contact-name"]').first().click();
    await page.waitForSelector('[data-ui="contact-edit-modal"]', { state: 'visible' });

    // Current behavior clears table selection when the editor opens
    await expect(checkbox).not.toBeChecked();

    await page.click('[data-ui="contact-edit-modal"] button[data-close]');
    await page.waitForSelector('[data-ui="contact-edit-modal"]', { state: 'hidden' });

    const scrollAfter = await page.evaluate(() => Math.round(window.scrollY));
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(5);
    await expect(checkbox).not.toBeChecked();
  });

  test('contacts selection resets when switching views', async ({ page }) => {
    await bootToContacts(page);

    const targetId = await scrollToContactRow(page, 3);
    const checkbox = page.locator(`#view-contacts tbody tr[data-id="${targetId}"] input[data-ui="row-check"]`);
    await expect(checkbox).toBeVisible();

    await checkbox.check();
    await expect(checkbox).toBeChecked();

    const pipelineTab = page.locator('#main-nav button[data-nav="pipeline"]').first();
    await pipelineTab.click();
    await page.waitForSelector('#view-pipeline', { state: 'visible' });

    const contactsTab = page.locator('#main-nav button[data-nav="contacts"]').first();
    await contactsTab.click();
    await page.waitForSelector('#view-contacts', { state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('#view-contacts tbody tr').length > 0);

    await expect(checkbox).not.toBeChecked();
  });
});
