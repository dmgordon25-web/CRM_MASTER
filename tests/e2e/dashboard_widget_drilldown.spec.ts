import { test, expect, Page } from '@playwright/test';

const CONTACT_ID = 'boot-smoke-priority-contact';
const TASK_ID = 'boot-smoke-priority-task';

async function gotoDashboard(page: Page) {
  await page.goto('/index.html?e2e=1');
  await page.waitForSelector('#boot-splash', { state: 'hidden' });
  const dashboardNav = page.locator('#main-nav button[data-nav="dashboard"]').first();
  if (await dashboardNav.count()) {
    await dashboardNav.click();
  }
  await expect(page.locator('#view-dashboard')).toBeVisible();
}

async function refreshDashboard(page: Page) {
  await page.evaluate(async () => {
    if (typeof window.handleDashboardRefresh === 'function') {
      await window.handleDashboardRefresh({ forceReload: true, includeReports: true });
    } else if (typeof window.renderDashboard === 'function') {
      await window.renderDashboard({ forceReload: true });
      if (typeof window.renderReports === 'function') {
        await window.renderReports();
      }
    }
  });
}

async function seedPriorityActions(page: Page) {
  await page.evaluate(async ({ contactId, taskId }) => {
    const hasDb = (window.db && (typeof window.db.bulkPut === 'function' || typeof window.db.put === 'function'))
      || typeof window.dbBulkPut === 'function';
    if (!hasDb) throw new Error('DB helpers unavailable for seeding');
    const putMany = async (store, records) => {
      if (window.db && typeof window.db.bulkPut === 'function') {
        return window.db.bulkPut(store, records);
      }
      if (typeof window.dbBulkPut === 'function') {
        return window.dbBulkPut(store, records);
      }
      if (window.db && typeof window.db.put === 'function') {
        for (const rec of records) {
          // eslint-disable-next-line no-await-in-loop
          await window.db.put(store, rec);
        }
      }
      return null;
    };

    const now = Date.now();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    const due = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const contact = {
      id: contactId,
      first: 'Smoke',
      last: 'Priority',
      name: 'Smoke Priority',
      notes: 'E2E seeded contact',
      stage: 'new',
      lane: 'pipeline',
      createdAt: now,
      updatedAt: now
    };

    const task = {
      id: taskId,
      contactId,
      title: 'Smoke overdue task',
      due,
      done: false,
      createdAt: now,
      updatedAt: now
    };

    await putMany('contacts', [contact]);
    await putMany('tasks', [task]);

    if (typeof window.handleDashboardRefresh === 'function') {
      await window.handleDashboardRefresh({ forceReload: true, includeReports: true });
    } else if (typeof window.renderDashboard === 'function') {
      await window.renderDashboard({ forceReload: true });
      if (typeof window.renderReports === 'function') {
        await window.renderReports();
      }
    }
  }, { contactId: CONTACT_ID, taskId: TASK_ID });
}

async function openPriorityActionsRow(page: Page) {
  const row = page.locator(`#priority-actions-card li[data-contact-id="${CONTACT_ID}"]`).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();

  await page.waitForFunction(
    (id) => window.__E2E__?.lastOpen?.type === 'contact' && window.__E2E__?.lastOpen?.id === id,
    CONTACT_ID,
    { timeout: 15000 }
  );

  const modal = page.locator('[data-ui="contact-edit-modal"], [data-modal-key="contact-edit"]');
  await expect(modal).toBeVisible({ timeout: 5000 });
  const closeButton = modal.locator('[data-close]').first();
  await expect(closeButton).toBeVisible({ timeout: 5000 });
  await closeButton.click();

  await page.waitForFunction(
    (id) => window.__E2E__?.lastClose?.type === 'contact' && window.__E2E__?.lastClose?.id === id,
    CONTACT_ID,
    { timeout: 10000 }
  );
  await expect(modal).toBeHidden({ timeout: 10000 });
}

test.describe('Dashboard widget drilldowns', () => {
  test('Priority Actions opens the correct contact before and after rerender', async ({ page }) => {
    await gotoDashboard(page);
    await seedPriorityActions(page);
    await openPriorityActionsRow(page);

    const pipelineNav = page.locator('#main-nav button[data-nav="pipeline"]').first();
    await pipelineNav.click();
    await expect(page.locator('#view-pipeline')).toBeVisible();

    const dashboardNav = page.locator('#main-nav button[data-nav="dashboard"]').first();
    await dashboardNav.click();
    await expect(page.locator('#view-dashboard')).toBeVisible();
    await refreshDashboard(page);

    await expect(page.locator(`#priority-actions-card li[data-contact-id="${CONTACT_ID}"]`).first()).toBeVisible({ timeout: 15000 });
    await openPriorityActionsRow(page);
  });
});
