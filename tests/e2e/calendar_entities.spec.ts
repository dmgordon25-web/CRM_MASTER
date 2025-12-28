import { test, expect, Page } from '@playwright/test';

async function bootAndSeedCalendar(page: Page) {
  await page.goto('/index.html');
  await page.waitForSelector('#boot-splash', { state: 'hidden' });

  const today = new Date();
  const iso = today.toISOString().slice(0, 10);

  await page.evaluate(({ isoDate }) => {
    const seed = window.__SEED_DATA__ || {};
    const contact = Array.isArray(seed.contacts) ? seed.contacts.find((c) => c && c.id != null) : null;
    const partner = Array.isArray(seed.partners) ? seed.partners.find((p) => p && p.id != null) : null;
    const contactId = contact && contact.id != null ? String(contact.id) : 'c1';
    const partnerId = partner && partner.id != null ? String(partner.id) : 'p1';
    const contactName = contact ? `${contact.firstName || contact.name || 'Contact'}` : 'Contact';
    const partnerName = partner ? `${partner.company || partner.name || 'Partner'}` : 'Partner';

    const contactEvent = {
      id: 'contact-cal-check',
      title: 'Contact Review',
      type: 'meeting',
      date: isoDate,
      contactId,
      contactName,
      startTime: '09:00',
    };

    const partnerEvent = {
      id: 'partner-cal-check',
      title: 'Partner Sync',
      type: 'partner',
      date: isoDate,
      partnerId,
      partnerName,
      source: { entity: 'partner', id: partnerId },
      startTime: '10:00',
    };

    if (!Array.isArray(seed.events)) seed.events = [];
    seed.events.length = 0;
    seed.events.push(contactEvent, partnerEvent);

    if (window.CalendarProvider && typeof window.CalendarProvider.registerProvider === 'function') {
      window.CalendarProvider.registerProvider(({ start, end, view }) => ({
        start,
        end,
        view,
        contacts: seed.contacts || [],
        events: [contactEvent, partnerEvent],
        tasks: [],
        deals: [],
      }));
    }
  }, { isoDate: iso });
}

async function navigateToCalendar(page: Page) {
  const nav = page.locator('#main-nav button[data-nav="calendar"]').first();
  await expect(nav).toBeVisible();
  await nav.click();
  await expect(page.locator('#view-calendar')).toBeVisible();
}

async function closeContactModal(page: Page) {
  const modal = page.locator('[data-modal-key="contact-edit"], [data-ui="contact-edit-modal"]');
  if (await modal.count() === 0) return;
  const closeButton = modal.locator('[data-close]').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
  await expect(modal).toBeHidden({ timeout: 5000 });
}

async function closePartnerModal(page: Page) {
  const modal = page.locator('[data-ui="partner-edit-modal"], #partner-modal');
  if (await modal.count() === 0) return;
  const closeButton = modal.locator('[data-close],[data-close-partner],[data-ui="close"]').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
  }
  await expect(modal).toBeHidden({ timeout: 5000 });
}

test.describe('Calendar entity semantics', () => {
  test('contact and partner events render distinctly and open correct editors', async ({ page }) => {
    await bootAndSeedCalendar(page);
    await navigateToCalendar(page);

    const contactChip = page.locator('[data-qa="cal-event"]', { hasText: 'Contact Review' }).first();
    const partnerChip = page.locator('[data-qa="cal-event"]', { hasText: 'Partner Sync' }).first();

    await expect(contactChip).toBeVisible();
    await expect(partnerChip).toBeVisible();

    await expect(contactChip).toHaveAttribute('data-type', 'contact');
    await expect(partnerChip).toHaveAttribute('data-type', 'partner');

    await expect(contactChip.locator('.cal-event-icon')).toHaveText('👥');
    await expect(partnerChip.locator('.cal-event-icon')).toHaveText('🤝');

    await contactChip.click();
    await expect(page.locator('[data-modal-key="contact-edit"], [data-ui="contact-edit-modal"]')).toBeVisible({ timeout: 8000 });
    await closeContactModal(page);

    await partnerChip.click();
    await expect(page.locator('[data-ui="partner-edit-modal"], #partner-modal')).toBeVisible({ timeout: 8000 });
    await closePartnerModal(page);
  });
});

