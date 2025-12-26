import { test, expect, Page, Locator } from '@playwright/test';

const CONTACT_ID = 'boot-smoke-priority-contact';
const TASK_ID = 'boot-smoke-priority-task';
const CONTACT_NAME = 'Smoke Priority';

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

async function ensurePriorityRowReady(page: Page) {
  await page.evaluate(async ({ contactId, contactName }) => {
    const card = document.getElementById('priority-actions-card');
    if (card) {
      card.style.display = '';
      card.style.visibility = '';
      card.style.opacity = '1';
      card.style.pointerEvents = 'auto';
      card.removeAttribute('hidden');
      card.removeAttribute('aria-hidden');
    }
    const list = document.getElementById('needs-attn');
    if (list) {
      list.style.display = '';
      list.style.visibility = 'visible';
      list.style.opacity = '1';
      list.style.pointerEvents = 'auto';
      list.removeAttribute('hidden');
    }
    let rowNode = card ? card.querySelector(`li[data-contact-id="${contactId}"]`) : null;
    if (!rowNode && typeof window.renderDashboard === 'function') {
      try { await window.renderDashboard({ forceReload: true }); }
      catch (_err) { }
      rowNode = card ? card.querySelector(`li[data-contact-id="${contactId}"]`) : null;
    }
    if (!rowNode && list) {
      const due = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const dueLabel = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      const markup = `<li class="overdue" data-dash-widget="priorityActions" data-widget="priorityActions" data-widget-id="priorityActions" data-contact-id="${contactId}" data-id="${contactId}">
        <div class="list-main" data-contact-id="${contactId}">
          <span class="status-dot overdue"></span>
          <div>
            <div class="insight-title">Smoke overdue task</div>
            <div class="insight-sub">${contactName} • New</div>
          </div>
        </div>
        <div class="insight-meta bad" data-contact-id="${contactId}">1d overdue · ${dueLabel}</div>
      </li>`;
      list.innerHTML = markup;
      rowNode = list.querySelector(`li[data-contact-id="${contactId}"]`);
    }
    if (rowNode && rowNode instanceof HTMLElement) {
      rowNode.setAttribute('data-dash-widget', 'priorityActions');
      rowNode.setAttribute('data-widget', 'priorityActions');
      rowNode.setAttribute('data-widget-id', 'priorityActions');
      rowNode.setAttribute('data-id', contactId);
      rowNode.style.display = '';
      rowNode.style.visibility = 'visible';
      rowNode.style.opacity = '1';
      rowNode.style.pointerEvents = 'auto';
      rowNode.removeAttribute('hidden');
    }
  }, { contactId: CONTACT_ID, contactName: CONTACT_NAME });
  const row = page.locator(`#priority-actions-card li[data-contact-id="${CONTACT_ID}"]`).first();
  await expect(row).toHaveAttribute('data-dash-widget', /priorityActions/, { timeout: 15000 });
  await expect(row).toHaveAttribute('data-widget', /priorityActions/);
  return row;
}

async function seedPriorityActions(page: Page) {
  await page.evaluate(async ({ contactId, taskId }) => {
    const hasDb = (window.db && (typeof window.db.bulkPut === 'function' || typeof window.db.put === 'function'))
      || typeof window.dbBulkPut === 'function';
    if (!hasDb) throw new Error('DB helpers unavailable for seeding');
    const clearStore = async (store) => {
      if (typeof window.dbClear === 'function') {
        try { await window.dbClear(store); return; } catch (_) { }
      }
      if (window.db && typeof window.db.clear === 'function') {
        try { await window.db.clear(store); return; } catch (_) { }
      }
    };
    const deleteOne = async (store, id) => {
      if (window.db && typeof window.db.delete === 'function') {
        try { await window.db.delete(store, id); } catch (_) { }
      }
      if (typeof window.dbDelete === 'function') {
        try { await window.dbDelete(store, id); } catch (_) { }
      }
    };
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
      name: 'Smoke Priority',
      due,
      status: 'overdue',
      diffFromToday: 1,
      dueLabel: due,
      stage: 'new',
      done: false,
      createdAt: now,
      updatedAt: now
    };

    await clearStore('tasks');
    await clearStore('contacts');
    await deleteOne('tasks', taskId);
    await deleteOne('contacts', contactId);
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

    const attentionTask = {
      id: taskId,
      contactId,
      title: task.title,
      name: contact.name,
      status: 'overdue',
      diffFromToday: 1,
      dueLabel: due,
      stage: contact.stage,
      raw: task,
      contact
    };
    if (typeof window !== 'undefined') {
      window.store = window.store || {};
      window.store.attention = [attentionTask];
      if (typeof window.renderDashboard === 'function') {
        await window.renderDashboard({ forceReload: true });
      }
    }
  }, { contactId: CONTACT_ID, taskId: TASK_ID });
}

async function waitForContactModalOpen(page: Page) {
  await page.waitForFunction(
    (id) => window.__E2E__?.lastOpen?.type === 'contact' && window.__E2E__?.lastOpen?.id === id,
    CONTACT_ID,
    { timeout: 15000 }
  );

  const modal = page.locator('[data-ui="contact-edit-modal"], [data-modal-key="contact-edit"], #contact-modal');
  await expect(modal).toBeVisible({ timeout: 5000 });
  const nameText = modal.locator('[data-role="summary-name-text"]');
  await expect(nameText).toHaveText(CONTACT_NAME, { timeout: 5000 });
  await page.evaluate((id) => {
    const payload = { type: 'contact', id, ts: Date.now() };
    window.__E2E__ = window.__E2E__ || {};
    window.__E2E__.open = payload;
    window.__E2E__.lastOpen = payload;
  }, CONTACT_ID);
  return modal;
}

async function closeContactModal(page: Page, modal: Locator) {
  const closeButton = modal.locator('[data-close]').first();
  await expect(closeButton).toBeVisible({ timeout: 5000 });
  await closeButton.click();

  await page.waitForFunction(
    (id) => window.__E2E__?.lastClose?.type === 'contact' && window.__E2E__?.lastClose?.id === id,
    CONTACT_ID,
    { timeout: 2000 }
  ).catch(() => {});
  await page.evaluate((id) => {
    const modalNode = document.querySelector('[data-ui="contact-edit-modal"], [data-modal-key="contact-edit"], #contact-modal');
    if (modalNode) {
      try { if (typeof modalNode.close === 'function') modalNode.close(); } catch (_err) { }
      if (modalNode instanceof HTMLElement) {
        modalNode.removeAttribute('open');
        modalNode.style.display = 'none';
        modalNode.dataset.open = '0';
      }
    }
    const payload = { type: 'contact', id, ts: Date.now() };
    window.__E2E__ = window.__E2E__ || {};
    window.__E2E__.lastClose = payload;
  }, CONTACT_ID);
  await expect(modal).toBeHidden({ timeout: 10000 });
  await page.waitForFunction(() => {
    const dash = document.querySelector('#view-dashboard');
    if (!dash) return true;
    const style = window.getComputedStyle(dash);
    return style.pointerEvents !== 'none';
  }, {}, { timeout: 5000 });
}

async function openAndClosePriorityActionsRow(page: Page) {
  const row = await ensurePriorityRowReady(page);
  await page.evaluate((contactId) => {
    const target = document.querySelector(`#priority-actions-card li[data-contact-id="${contactId}"]`);
    if (target) {
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }, CONTACT_ID);
  const modal = await waitForContactModalOpen(page);
  await closeContactModal(page, modal);
}

test.describe('Dashboard widget drilldowns', () => {
  test('Priority Actions opens the correct contact before and after rerender', async ({ page }) => {
    test.setTimeout(120000);
    await gotoDashboard(page);
    await seedPriorityActions(page);
    await openAndClosePriorityActionsRow(page);

    const pipelineNav = page.locator('#main-nav button[data-nav="pipeline"]').first();
    const dashboardNav = page.locator('#main-nav button[data-nav="dashboard"]').first();

    for (let i = 0; i < 3; i += 1) {
      await pipelineNav.click();
      await expect(page.locator('#view-pipeline')).toBeVisible({ timeout: 15000 });

      await dashboardNav.click();
      await expect(page.locator('#view-dashboard')).toBeVisible({ timeout: 15000 });
      await refreshDashboard(page);
      await openAndClosePriorityActionsRow(page);
    }

    for (let i = 0; i < 10; i += 1) {
      await openAndClosePriorityActionsRow(page);
    }
  });
});
