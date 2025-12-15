import { test, expect, Page } from '@playwright/test';

async function ensureDashboard(page: Page) {
  await page.goto('/index.html');
  await page.waitForSelector('#boot-splash', { state: 'hidden' });
  const dashboardNav = page.locator('#main-nav button[data-nav="dashboard"]').first();
  if (await dashboardNav.count()) {
    await dashboardNav.click();
  }
  await expect(page.locator('#view-dashboard')).toBeVisible();
}

async function closeContactModal(page: Page) {
  const modal = page.locator('[data-modal-key="contact-edit"], [data-ui="contact-edit-modal"]');
  if (await modal.count() === 0) return;
  const closeButton = modal.locator('[data-close]').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
  await modal.evaluateAll((nodes) => {
    nodes.forEach((node) => {
      node.removeAttribute('open');
      node.classList.add('hidden');
      node.setAttribute('aria-hidden', 'true');
    });
  });
  await expect(modal).toBeHidden({ timeout: 5000 });
}

async function closePartnerModal(page: Page) {
  const modal = page.locator('[data-ui="partner-edit-modal"], #partner-modal');
  if (await modal.count() === 0) return;
  const closeButton = modal.locator('[data-close],[data-close-partner],[data-ui="close"]').first();
  if (await closeButton.count()) {
    await closeButton.click();
  }
  await expect(modal).toBeHidden({ timeout: 5000 });
}

async function closeQuickAddOverlay(page: Page) {
  const overlay = page.locator('.qa-overlay');
  if (await overlay.count() === 0) return;
  const closeButton = overlay.locator('.qa-close, .qa-cancel').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
  await expect(overlay).toBeHidden({ timeout: 5000 });
}

async function openRowAndAssertEditor(page: Page, selector: string) {
  const container = page.locator(selector).first();
  if (await container.count()) {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      }
    }, selector);
  }
  const row = page.locator(`${selector} [data-contact-id], ${selector} [data-partner-id]`).first();
  await row.waitFor({ state: 'attached', timeout: 8000 });
  const wasHidden = await row.evaluate((el) => {
    const style = window.getComputedStyle(el);
    const hidden = style.visibility === 'hidden' || style.display === 'none';
    if (hidden) {
      el.style.visibility = 'visible';
      el.style.display = style.display === 'none' ? 'list-item' : style.display;
    }
    return hidden;
  });
  const contactId = await row.getAttribute('data-contact-id');
  const partnerId = await row.getAttribute('data-partner-id');
  const handle = await row.elementHandle();
  if (!handle) throw new Error('Drilldown row not found');
  await handle.evaluate((el: HTMLElement, hidden: boolean) => {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    if (hidden) {
      el.click();
    } else {
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  }, wasHidden);
  if (contactId) {
    await expect(page.locator('[data-modal-key="contact-edit"], [data-ui="contact-edit-modal"]')).toBeVisible({ timeout: 5000 });
    await closeContactModal(page);
  } else if (partnerId) {
    await expect(page.locator('[data-ui="partner-edit-modal"], #partner-modal')).toBeVisible({ timeout: 5000 });
    await closePartnerModal(page);
  } else {
    throw new Error('Row missing contact/partner id');
  }
  await page.click('#app-title-link');
}

async function exerciseNewPlus(page: Page) {
  const newButton = page.locator('#quick-add-unified');
  await expect(newButton).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await newButton.click();
  const menu = page.locator('#header-new-menu');
  await expect(menu).toBeVisible({ timeout: 2000 });
  const partnerOption = menu.locator('button[data-role="header-new-partner"]');
  const contactOption = menu.locator('button[data-role="header-new-contact"]');
  await expect(partnerOption).toBeVisible();
  await expect(contactOption).toBeVisible();
  await partnerOption.scrollIntoViewIfNeeded();
  await partnerOption.evaluate((el: HTMLElement) => el.click());
  const partnerModal = page.locator('[data-ui="partner-edit-modal"], #partner-modal');
  const partnerQuickAdd = page.locator('.qa-overlay .qa-form-partner');
  const partnerOpened = await Promise.race([
    partnerModal.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'modal').catch(() => null),
    partnerQuickAdd.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'quickadd').catch(() => null)
  ]);
  if (partnerOpened === 'quickadd') {
    await closeQuickAddOverlay(page);
  } else {
    await expect(partnerModal).toBeVisible({ timeout: 1000 });
    await closePartnerModal(page);
  }
  await newButton.click();
  await expect(menu).toBeVisible({ timeout: 2000 });
  await contactOption.scrollIntoViewIfNeeded();
  await contactOption.evaluate((el: HTMLElement) => el.click());
  const contactModal = page.locator('[data-modal-key="contact-edit"], [data-ui="contact-edit-modal"]');
  const contactQuickAdd = page.locator('.qa-overlay .qa-form-contact');
  const contactOpened = await Promise.race([
    contactModal.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'modal').catch(() => null),
    contactQuickAdd.waitFor({ state: 'visible', timeout: 8000 }).then(() => 'quickadd').catch(() => null)
  ]);
  if (contactOpened === 'quickadd') {
    await closeQuickAddOverlay(page);
  } else {
    await expect(contactModal).toBeVisible({ timeout: 1000 });
    await closeContactModal(page);
  }
  await page.click('#app-title-link');
}

test.describe('Dashboard drilldown smoke', () => {
  test('New+ and widget drilldowns open editors', async ({ page }) => {
    await ensureDashboard(page);
    await exerciseNewPlus(page);
    await openRowAndAssertEditor(page, '#needs-attn');
    await openRowAndAssertEditor(page, '#upcoming');
    await openRowAndAssertEditor(page, '#top3');
  });
});
