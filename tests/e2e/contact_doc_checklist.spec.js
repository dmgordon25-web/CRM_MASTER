const { test, expect } = require('@playwright/test');

test.describe('contact document checklist', () => {
  test('persists checklist toggles across reload', async ({ page }) => {
    await page.goto('/index.html');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });

    await page.evaluate(async () => {
      if (typeof window.openDB === 'function') await window.openDB();
      if (typeof window.dbClear === 'function') {
        await window.dbClear('contacts');
      } else if (window.db && typeof window.db.clear === 'function') {
        await window.db.clear('contacts');
      }
      const contact = {
        id: 'doc-check-1',
        first: 'Doc',
        last: 'Checklist',
        email: 'doc.checklist@example.com',
        phone: '5551234567',
        stage: 'application',
        status: 'inprogress',
        pipelineMilestone: 'Intro Call',
        loanType: 'Conventional',
        loanProgram: 'Conventional',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      if (typeof window.dbPut === 'function') {
        await window.dbPut('contacts', contact);
      } else if (window.db && typeof window.db.put === 'function') {
        await window.db.put('contacts', contact);
      }
    });

    await page.evaluate(() => new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('contact:modal:ready', handler);
        resolve();
      };
      document.addEventListener('contact:modal:ready', handler);
      if (window.Contacts && typeof window.Contacts.open === 'function') {
        window.Contacts.open('doc-check-1');
      }
    }));

    await expect(page.locator('#contact-modal-body')).toBeVisible();
    await page.locator('#contact-tabs button[data-panel="docs"]').click();

    const checklistItem = page.locator('#c-doc-checklist input[data-doc-key="gov-id"]');
    await expect(checklistItem).toBeVisible();
    await checklistItem.check();

    await page.reload();
    await page.waitForSelector('#boot-splash', { state: 'hidden' });

    await page.evaluate(() => new Promise((resolve) => {
      const handler = () => {
        document.removeEventListener('contact:modal:ready', handler);
        resolve();
      };
      document.addEventListener('contact:modal:ready', handler);
      if (window.Contacts && typeof window.Contacts.open === 'function') {
        window.Contacts.open('doc-check-1');
      }
    }));

    const checklistItemAfter = page.locator('#c-doc-checklist input[data-doc-key="gov-id"]');
    await page.locator('#contact-tabs button[data-panel="docs"]').click();
    await expect(checklistItemAfter).toBeVisible();
    await expect(checklistItemAfter).toBeChecked();
  });
});
