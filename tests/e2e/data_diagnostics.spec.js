import { test, expect } from '@playwright/test';

test.describe('Settings data diagnostics', () => {
  test('lists canonical and orphan stage/status values deterministically', async ({ page }) => {
    await page.goto('/index.html?e2e=1#/settings');
    await page.waitForSelector('.settings-panel');

    await page.evaluate(async () => {
      const stores = ['contacts', 'deals', 'documents', 'tasks'];
      for (const store of stores) {
        await window.dbClear(store);
      }
      await window.dbPut('contacts', {
        id: 'diag-contact-1',
        first: 'Diag',
        last: 'Canonical',
        stage: 'clear_to_close',
        status: 'active'
      });
      await window.dbPut('documents', {
        id: 'diag-doc-1',
        name: 'Diagnostic doc',
        status: 'Requested'
      });
    });

    await page.locator('#settings-nav button[data-panel="data"]').click();
    await page.waitForSelector('#settings-data-diagnostics');
    await page.locator('#btn-run-data-diagnostics').click();

    await expect(page.locator('#data-diagnostics-canonical')).toContainText('cleared-to-close');
    await expect(page.locator('#data-diagnostics-orphans')).toContainText('Requested');
  });
});
