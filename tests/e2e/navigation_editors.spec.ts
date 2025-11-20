import { test, expect, Page } from '@playwright/test';

const NAV_TARGETS: Record<string, { button: string; readySelector: string }> = {
  dashboard: { button: '#main-nav button[data-nav="dashboard"]', readySelector: '#goal-funded-label' },
  workbench: { button: '#main-nav button[data-nav="workbench"]', readySelector: '#tbl-inprog tbody' },
  partners: { button: '#main-nav button[data-nav="partners"]', readySelector: '#tbl-partners tbody' },
  pipeline: { button: '#main-nav button[data-nav="pipeline"]', readySelector: '#tbl-pipeline tbody' },
  calendar: { button: '#main-nav button[data-nav="calendar"]', readySelector: '#view-calendar .calendar-card' }
};

async function goTo(page: Page, target: keyof typeof NAV_TARGETS) {
  const cfg = NAV_TARGETS[target];
  await page.click(cfg.button);
  await page.waitForSelector(cfg.readySelector, { state: 'visible' });
}

async function openContactFromPipeline(page: Page) {
  await goTo(page, 'pipeline');
  const rows = page.locator('#tbl-pipeline tbody tr');
  await expect(rows.first()).toBeVisible();
  await rows.first().locator('.contact-name a').click();
  const modal = page.locator('#contact-modal');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openPartnerEditor(page: Page) {
  await goTo(page, 'partners');
  const rows = page.locator('#tbl-partners tbody tr:visible');
  await expect(rows.first()).toBeVisible();
  const target = rows.first();
  await target.locator('.partner-name').click();
  const modal = page.locator('#partner-modal');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openNewContactModal(page: Page) {
  await page.click('#btn-header-new');
  await page.click('#header-new-menu [data-role="header-new-contact"]');
  const modal = page.locator('#contact-modal');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openNewPartnerModal(page: Page) {
  await page.click('#btn-header-new');
  await page.click('#header-new-menu [data-role="header-new-partner"]');
  const modal = page.locator('#partner-modal');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function closeModal(modal: ReturnType<Page['locator']>) {
  const closeButton = modal.locator('[data-close], button:has-text("Close"), button:has-text("Cancel")').first();
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
  }
  const hasOpenProperty = await modal.evaluate((node) => 'open' in node);
  if (hasOpenProperty) {
    await expect(modal).toHaveJSProperty('open', false);
  }
  await expect(modal).toBeHidden();
}

function attachErrorGuards(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    const text = msg.text();
    if (/error|exception|rejection/i.test(text)) errors.push(text);
  });
  return errors;
}

async function assertNoStaleModals(page: Page) {
  const staleModals = await page.evaluate(() => {
    const modals = Array.from(document.querySelectorAll('[data-modal-key]'));
    return modals.filter((modal: any) => {
      const isOpen = modal.dataset?.open === '1' ||
                     modal.getAttribute('aria-hidden') === 'false' ||
                     modal.hasAttribute('open') ||
                     (modal.style && modal.style.display !== 'none');
      return isOpen;
    }).map((modal: any) => modal.dataset?.modalKey || modal.id || 'unknown');
  });
  expect(staleModals).toEqual([]);
}

async function assertSingleModalOpen(page: Page, expectedKey: string) {
  const openModals = await page.evaluate(() => {
    const modals = Array.from(document.querySelectorAll('[data-modal-key]'));
    return modals.filter((modal: any) => {
      const isOpen = modal.dataset?.open === '1' ||
                     modal.getAttribute('aria-hidden') === 'false';
      return isOpen;
    }).map((modal: any) => modal.dataset?.modalKey || modal.id || 'unknown');
  });
  expect(openModals.length).toBeLessThanOrEqual(1);
  if (expectedKey) {
    expect(openModals).toContain(expectedKey);
  }
}

test.describe('navigation editor stability', () => {
  test('editors open and close across rapid navigation', async ({ page }) => {
    const errors = attachErrorGuards(page);
    await page.goto('/index.html');
    await page.waitForSelector('#goal-funded-label');

    for (let i = 0; i < 3; i += 1) {
      await openContactFromPipeline(page);
      await assertNoStaleModals(page);
      await openPartnerEditor(page);
      await assertNoStaleModals(page);
      await goTo(page, 'dashboard');
      await assertDashboardWidgetsAreNotBlank(page);
      await goTo(page, 'calendar');
      await goTo(page, 'workbench');
      await openNewContactModal(page);
      await assertNoStaleModals(page);
      await openNewPartnerModal(page);
      await assertNoStaleModals(page);
    }

    expect(errors).toEqual([]);
  });

  test('only one modal open at a time', async ({ page }) => {
    const errors = attachErrorGuards(page);
    await page.goto('/index.html');
    await page.waitForSelector('#goal-funded-label');

    // Open contact modal
    await goTo(page, 'pipeline');
    const contactRows = page.locator('#tbl-pipeline tbody tr');
    await expect(contactRows.first()).toBeVisible();
    await contactRows.first().locator('.contact-name a').click();
    const contactModal = page.locator('#contact-modal');
    await expect(contactModal).toBeVisible();
    await assertSingleModalOpen(page, 'contact-editor');

    // Try to open partner modal - should close contact modal first
    await goTo(page, 'partners');
    const partnerRows = page.locator('#tbl-partners tbody tr:visible');
    await expect(partnerRows.first()).toBeVisible();
    await partnerRows.first().locator('.partner-name').click();
    const partnerModal = page.locator('#partner-modal');
    await expect(partnerModal).toBeVisible();
    await assertSingleModalOpen(page, 'partner-edit');
    // Contact modal should be closed
    await expect(contactModal).toBeHidden();

    await closeModal(partnerModal);
    await assertNoStaleModals(page);

    expect(errors).toEqual([]);
  });

  test('modals remain responsive after navigation', async ({ page }) => {
    const errors = attachErrorGuards(page);
    await page.goto('/index.html');
    await page.waitForSelector('#goal-funded-label');

    // Navigate around a lot
    for (let i = 0; i < 5; i += 1) {
      await goTo(page, 'dashboard');
      await goTo(page, 'workbench');
      await goTo(page, 'partners');
      await goTo(page, 'pipeline');
    }

    // Now try to open modals - they should still work
    await goTo(page, 'partners');
    const partnerRows = page.locator('#tbl-partners tbody tr:visible');
    await expect(partnerRows.first()).toBeVisible();
    await partnerRows.first().locator('.partner-name').click();
    const partnerModal = page.locator('#partner-modal');
    await expect(partnerModal).toBeVisible({ timeout: 5000 });
    await closeModal(partnerModal);

    await goTo(page, 'pipeline');
    const contactRows = page.locator('#tbl-pipeline tbody tr');
    await expect(contactRows.first()).toBeVisible();
    await contactRows.first().locator('.contact-name a').click();
    const contactModal = page.locator('#contact-modal');
    await expect(contactModal).toBeVisible({ timeout: 5000 });
    await closeModal(contactModal);

    expect(errors).toEqual([]);
  });
});

async function assertDashboardWidgetsAreNotBlank(page: Page) {
  await goTo(page, 'dashboard');
  const emptyHosts = await page.evaluate(() => {
    const widgets = Array.from(document.querySelectorAll('[data-widget-id], [data-dash-widget]'));
    return widgets.filter((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return false;
      const hasText = (node.textContent || '').trim().length > 0;
      const hasChild = node.children && node.children.length > 0;
      const hasSkeleton = node.classList.contains('skeleton') || node.querySelector('.skeleton');
      return !hasText && !hasChild && !hasSkeleton;
    }).map((node) => node.id || node.dataset.widgetId || 'unknown');
  });
  expect(emptyHosts).toEqual([]);
}
