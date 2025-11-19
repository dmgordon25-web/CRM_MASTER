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
  const modal = page.locator('#contact-modal[open]');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openPartnerEditor(page: Page) {
  await goTo(page, 'partners');
  const rows = page.locator('#tbl-partners tbody tr:visible');
  await expect(rows.first()).toBeVisible();
  const target = rows.first();
  await target.locator('.partner-name').click();
  const modal = page.locator('#partner-modal[open]');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openNewContactModal(page: Page) {
  await page.click('#btn-header-new');
  await page.click('#header-new-menu [data-role="header-new-contact"]');
  const modal = page.locator('#contact-modal[open]');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function openNewPartnerModal(page: Page) {
  await page.click('#btn-header-new');
  await page.click('#header-new-menu [data-role="header-new-partner"]');
  const modal = page.locator('#partner-modal[open]');
  await expect(modal).toBeVisible();
  await closeModal(modal);
}

async function closeModal(modal: ReturnType<Page['locator']>) {
  const closeButton = modal.locator('[data-close], button:has-text("Close"), button:has-text("Cancel")').first();
  if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeButton.click();
  }
  await modal.waitFor({ state: 'detached' });
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

test.describe('navigation editor stability', () => {
  test('editors open and close across rapid navigation', async ({ page }) => {
    const errors = attachErrorGuards(page);
    await page.goto('/index.html');
    await page.waitForSelector('#goal-funded-label');

    for (let i = 0; i < 3; i += 1) {
      await openContactFromPipeline(page);
      await openPartnerEditor(page);
      await goTo(page, 'dashboard');
      await assertDashboardWidgetsAreNotBlank(page);
      await goTo(page, 'calendar');
      await goTo(page, 'workbench');
      await openNewContactModal(page);
      await openNewPartnerModal(page);
    }

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
