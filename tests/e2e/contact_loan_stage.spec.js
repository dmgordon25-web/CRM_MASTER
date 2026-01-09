const { test, expect } = require('@playwright/test');

async function openContacts(page) {
  const contactsTab = page.locator('#main-nav button[data-nav="contacts"]').first();
  await expect(contactsTab).toBeVisible();
  await contactsTab.click();

  await page.waitForSelector('#view-contacts', { state: 'visible' });
  await page.waitForFunction(() => document.querySelectorAll('#view-contacts tbody tr').length > 0);
}

async function seedLoanStageContact(page) {
  await page.evaluate(async () => {
    const now = Date.now();
    if (typeof window.dbClear === 'function') {
      await window.dbClear('contacts');
    } else if (typeof window.dbGetAll === 'function') {
      const all = await window.dbGetAll('contacts');
      for (const c of all) await window.dbDelete('contacts', c.id);
    }
    const contact = {
      id: 'loan-stage-1',
      first: 'Loan',
      last: 'Stage',
      email: 'loan.stage@example.com',
      phone: '5551234567',
      stage: 'application',
      status: 'inprogress',
      createdAt: now
    };
    if (typeof window.dbBulkPut === 'function') {
      await window.dbBulkPut('contacts', [contact]);
    } else if (window.db && window.db.bulkPut) {
      await window.db.bulkPut('contacts', [contact]);
    } else if (typeof window.dbPut === 'function') {
      await window.dbPut('contacts', contact);
    }
    if (typeof window.renderAll === 'function') window.renderAll();
  });
}

async function openContactById(page, id) {
  const row = page.locator(`#view-contacts tbody tr[data-id="${id}"]`);
  await expect(row).toBeVisible();
  await row.locator('a[data-role="contact-name"]').first().click();
  await expect(page.locator('[data-ui="contact-edit-modal"]')).toBeVisible();
}

test.describe('Contact loan stage persistence', () => {
  test('loan stage saves and reloads', async ({ page }) => {
    await page.goto('/index.html?e2e=1');
    await page.waitForSelector('#boot-splash', { state: 'hidden' });
    await seedLoanStageContact(page);
    await openContacts(page);

    await openContactById(page, 'loan-stage-1');

    const loanTab = page.locator('#contact-tabs button[data-panel="loan"]');
    await loanTab.click();

    const loanStageSelect = page.locator('#c-loanStage');
    await expect(loanStageSelect).toBeVisible();
    await loanStageSelect.selectOption('underwriting');

    await page.locator('#btn-save-contact').click();

    await expect.poll(async () => {
      return page.evaluate(async () => {
        if (typeof window.openDB === 'function') await window.openDB();
        const record = await window.dbGet('contacts', 'loan-stage-1');
        return record?.loanStage || '';
      });
    }).toBe('underwriting');

    await page.reload();
    await page.waitForSelector('#boot-splash', { state: 'hidden' });
    await openContacts(page);

    await openContactById(page, 'loan-stage-1');
    await loanTab.click();
    await expect(page.locator('#c-loanStage')).toHaveValue('underwriting');
  });
});
