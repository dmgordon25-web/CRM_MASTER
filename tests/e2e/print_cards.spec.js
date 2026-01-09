const { test, expect } = require('@playwright/test');

test.describe('Print Cards', () => {
  test('renders card blocks for contacts with mailing addresses', async ({ page }) => {
    await page.goto('/index.html?e2e=1');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });

    await page.evaluate(() => {
      window.location.hash = '#/contacts';
    });
    await expect(page.locator('#view-contacts')).toBeVisible();

    const printBtn = page.locator('#btn-print-cards');
    await expect(printBtn).toBeVisible();
    await expect(printBtn).toHaveAttribute('href', '#/print');

    await page.evaluate(() => {
      window.location.hash = '#/print';
    });
    await expect(page.locator('#view-print')).toBeVisible();
    await page.waitForFunction(() => typeof window.renderPrintCards === 'function');

    await page.evaluate(async () => {
      const now = Date.now();
      if (typeof window.dbClear === 'function') {
        await window.dbClear('contacts');
      } else if (typeof window.dbGetAll === 'function') {
        const all = await window.dbGetAll('contacts');
        for (const c of all) await window.dbDelete('contacts', c.id);
      }

      const contacts = [
        {
          id: 'print-1',
          first: 'Pat',
          last: 'Address',
          email: 'pat.address@example.com',
          stage: 'Lead',
          status: 'New',
          createdAt: now + 1000,
          birthday: '2000-01-15',
          address: '123 Maple St',
          city: 'Austin',
          state: 'TX',
          zip: '78701'
        },
        {
          id: 'print-2',
          first: 'No',
          last: 'Address',
          email: 'no.address@example.com',
          stage: 'Lead',
          status: 'New',
          createdAt: now + 2000,
          birthday: '2000-02-20'
        }
      ];

      if (typeof window.dbBulkPut === 'function') {
        await window.dbBulkPut('contacts', contacts);
      } else if (window.db && window.db.bulkPut) {
        await window.db.bulkPut('contacts', contacts);
      } else {
        throw new Error('No DB helper found');
      }
    });

    await page.selectOption('#print-range', 'all');
    await page.evaluate(async () => {
      const overlay = document.getElementById('diagnostics-overlay');
      if (overlay) {
        overlay.style.pointerEvents = 'none';
        overlay.style.display = 'none';
      }
      if (typeof window.renderPrintCards === 'function') {
        await window.renderPrintCards();
      }
    });

    const cards = page.locator('#print-area .print-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Pat Address');
    await expect(page.locator('#print-area')).not.toContainText('No Address');
  });
});
