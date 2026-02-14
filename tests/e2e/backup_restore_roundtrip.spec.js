const { test, expect } = require('@playwright/test');

test.describe('Snapshot backup/restore roundtrip', () => {
  test('restores IDB data plus primary localStorage keys', async ({ page }) => {
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/index.html?e2e=1');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });

    await page.evaluate(async () => {
      const stores = Array.isArray(window.STORES) ? window.STORES : [];
      for (const store of stores) {
        if (typeof window.dbClear === 'function') await window.dbClear(store);
      }
      window.localStorage.removeItem('crm:theme');
      window.localStorage.removeItem('calendar:legend:visibility');
    });

    const contactId = `roundtrip-contact-${Date.now()}`;
    const partnerId = `roundtrip-partner-${Date.now()}`;

    await page.evaluate(async ({ contactId, partnerId }) => {
      const now = Date.now();
      await window.dbPut('contacts', {
        id: contactId,
        first: 'Roundtrip',
        last: 'Contact',
        email: 'roundtrip.contact@example.com',
        createdAt: now,
        updatedAt: now
      });
      await window.dbPut('partners', {
        id: partnerId,
        name: 'Roundtrip Partner LLC',
        email: 'roundtrip.partner@example.com',
        createdAt: now,
        updatedAt: now
      });
      window.localStorage.setItem('crm:theme', 'midnight');
      window.localStorage.setItem('calendar:legend:visibility', JSON.stringify({ meetings: false, tasks: true }));
      if (typeof window.dispatchAppDataChanged === 'function') {
        window.dispatchAppDataChanged('e2e:seed');
      }
    }, { contactId, partnerId });

    const snapshotText = await page.evaluate(async () => {
      const data = await window.dbExportAll();
      return JSON.stringify({ version: 2, stores: data });
    });

    await page.evaluate(async () => {
      const stores = Array.isArray(window.STORES) ? window.STORES : [];
      for (const store of stores) {
        if (typeof window.dbClear === 'function') await window.dbClear(store);
      }
      window.localStorage.removeItem('crm:theme');
      window.localStorage.removeItem('calendar:legend:visibility');
      window.localStorage.removeItem('notifications:queue');
      if (typeof window.dispatchAppDataChanged === 'function') {
        window.dispatchAppDataChanged('e2e:wipe');
      }
    });

    await page.evaluate(async (serialized) => {
      const file = new File([serialized], 'snapshot.json', { type: 'application/json' });
      await window.Snapshot.restoreJSON(file);
    }, snapshotText);

    const restoredLocalStorage = await page.evaluate(() => ({
      theme: window.localStorage.getItem('crm:theme'),
      legend: window.localStorage.getItem('calendar:legend:visibility')
    }));

    expect(restoredLocalStorage.theme).toBe('midnight');
    expect(restoredLocalStorage.legend).toBe(JSON.stringify({ meetings: false, tasks: true }));

    const contactsNav = page.locator('#main-nav button[data-nav="contacts"]').first();
    await contactsNav.click();
    await expect(page.locator('#view-contacts')).toBeVisible();
    await expect(page.locator(`#view-contacts tr[data-id="${contactId}"]`)).toBeVisible();

    const partnersNav = page.locator('#main-nav button[data-nav="partners"]').first();
    await partnersNav.click();
    await expect(page.locator('#view-partners')).toBeVisible();
    await expect(page.locator(`#view-partners tr[data-id="${partnerId}"]`)).toBeVisible();

    expect(errors).toEqual([]);
  });
});
