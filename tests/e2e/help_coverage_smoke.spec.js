const { test, expect } = require('@playwright/test');

async function openNav(page, key) {
  if (key === 'settings') {
    const shortcut = page.locator('#btn-open-settings').first();
    await expect(shortcut).toBeVisible();
    await shortcut.click();
    await expect(page.locator('#view-settings')).toBeVisible();
    return;
  }
  const button = page.locator(`#main-nav button[data-nav="${key}"]`).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(page.locator(`#view-${key}`)).toBeVisible();
}

async function assertHelpPopover(page, helpId, expectedTitle) {
  const trigger = page.locator(`.help-icon[data-help-id="${helpId}"]:visible, .help-icon[data-help="${helpId}"]:visible`).first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const popover = page.locator('.help-popover').last();
  await expect(popover).toBeVisible();
  await expect(popover.locator('h4')).toContainText(expectedTitle);
  await expect(popover).toContainText('What this is');
  await expect(popover).toContainText('What the counts mean');
}

test('help coverage smoke across major CRM surfaces', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForSelector('#boot-splash', { state: 'hidden' });

  await openNav(page, 'dashboard');
  await assertHelpPopover(page, 'dashboard-page', 'Dashboard');
  await assertHelpPopover(page, 'doc-pulse', 'Document Pulse');

  await openNav(page, 'calendar');
  await assertHelpPopover(page, 'calendar-view', 'Calendar');
  await assertHelpPopover(page, 'calendar-legend', 'Calendar Legend');

  await openNav(page, 'pipeline');
  await assertHelpPopover(page, 'pipeline-view', 'Pipeline Board');

  await openNav(page, 'settings');
  await assertHelpPopover(page, 'settings-view', 'Settings');
  await page.locator('#settings-nav button[data-panel="data"]').click();
  await expect(page.locator('.settings-panel[data-panel="data"]')).toBeVisible();
  await assertHelpPopover(page, 'backup-restore', 'Backup & Restore');
});
