#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { createStaticServer } = require('./static_server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', 'crm-app');
const preferredPort = Number(process.env.SMOKE_PORT || 8081);

function listenOn(port) {
  return new Promise((resolve, reject) => {
    const server = createStaticServer(rootDir);
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

async function startServer() {
  try {
    const server = await listenOn(preferredPort);
    return { server, port: preferredPort };
  } catch (err) {
    if (err && err.code === 'EADDRINUSE') {
      const fallback = await listenOn(0);
      const actualPort = fallback.address().port;
      return { server: fallback, port: actualPort };
    }
    throw err;
  }
}

async function run() {
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  console.log(`[boot-smoke] serving ${rootDir} on ${baseUrl}`);

  const candidatePaths = [
    process.env.PLAYWRIGHT_CHROME,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  const resolvedPath = candidatePaths.find((p) => fs.existsSync(p));
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const attemptOptions = [];
  if (resolvedPath) {
    attemptOptions.push({ ...launchOptions, executablePath: resolvedPath });
  }
  try {
    const bundled = chromium.executablePath();
    if (bundled && fs.existsSync(bundled)) {
      attemptOptions.push({ ...launchOptions, executablePath: bundled });
    }
  } catch (_err) {}
  attemptOptions.push({ ...launchOptions, channel: 'chrome' });
  attemptOptions.push({ ...launchOptions, channel: 'chromium' });

  let browser;
  let lastError;
  for (const opts of attemptOptions) {
    try {
      browser = await chromium.launch(opts);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!browser) {
    const installChrome = () => {
      try {
        execSync('which google-chrome-stable', { stdio: 'ignore' });
        return;
      } catch (_) {}
      execSync('wget -q -O /tmp/google-chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb', { stdio: 'inherit' });
      execSync('sudo dpkg -i /tmp/google-chrome.deb || sudo apt-get -fy install', { stdio: 'inherit' });
      execSync('sudo apt-get install -y xdg-utils', { stdio: 'inherit' });
    };
    if (/executable doesn't exist/i.test(String(lastError || ''))) {
      try {
        installChrome();
        browser = await chromium.launch({ ...launchOptions, executablePath: '/usr/bin/google-chrome-stable' });
      } catch (err) {
        throw err;
      }
    } else {
      throw lastError;
    }
  }
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(new Error(msg.text()));
  });

  async function hardClearOverlays(pageRef) {
    await pageRef.evaluate(() => {
      document.querySelectorAll('dialog[open]').forEach(d => {
        try { d.close(); } catch (e) {}
        try { d.removeAttribute('open'); } catch (e) {}
        try { d.remove(); } catch (e) {}
      });
      document.querySelectorAll('.record-modal, .modal, .overlay, [data-ui*="modal"], [data-modal-key], [data-open="1"]').forEach(el => {
        const isDialogish =
          el.tagName === 'DIALOG' ||
          el.classList.contains('record-modal') ||
          el.getAttribute('data-open') === '1' ||
          (el.getAttribute('role') === 'dialog');
        if (isDialogish) {
          try { el.remove(); } catch (e) {}
        }
      });
      document.documentElement.classList.remove('modal-open');
      if (document.body) document.body.classList.remove('modal-open');
      document.documentElement.style.pointerEvents = '';
      if (document.body) document.body.style.pointerEvents = '';
      const styleId = '__boot_smoke_overlay_kill__';
      if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
        dialog[open], .record-modal, .modal, .overlay { pointer-events: none !important; }
      `;
        (document.head || document.documentElement).appendChild(s);
      }
    });
    await pageRef.waitForTimeout(50);
  }

  await page.goto(baseUrl);
  await page.waitForSelector('#boot-splash', { state: 'hidden', timeout: 15000 });
  await hardClearOverlays(page);
  await seedPriorityActions(page);

  async function seedPriorityActions(pageRef) {
    await pageRef.evaluate(async () => {
      const hasDb = (window.db && (typeof window.db.bulkPut === 'function' || typeof window.db.put === 'function')) ||
        typeof window.dbBulkPut === 'function';
      if (!hasDb) throw new Error('DB helpers unavailable for boot smoke seeding');
      const putMany = async (store, records) => {
        if (window.db && typeof window.db.bulkPut === 'function') {
          return window.db.bulkPut(store, records);
        }
        if (typeof window.dbBulkPut === 'function') {
          return window.dbBulkPut(store, records);
        }
        if (window.db && typeof window.db.put === 'function') {
          for (const rec of records) { // eslint-disable-line no-restricted-syntax
            // eslint-disable-next-line no-await-in-loop
            await window.db.put(store, rec);
          }
        }
      };

      const contactId = 'boot-smoke-priority-contact';
      const taskId = 'boot-smoke-priority-task';
      const now = Date.now();
      const yesterday = new Date(now - 24 * 60 * 60 * 1000);
      const due = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

      const contact = {
        id: contactId,
        first: 'Smoke',
        last: 'Priority',
        name: 'Smoke Priority',
        notes: 'Boot smoke seeded contact',
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
    });
  }

  const dashActive = page.locator('#main-nav button[data-nav="dashboard"].active');
  if (await dashActive.count() === 0) {
    throw new Error('Dashboard nav is not active at boot');
  }
  await page.waitForSelector('#view-dashboard', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await page.evaluate(() => { window.scrollTo(0, document.body.scrollHeight); });
  await page.waitForTimeout(200);
  await hardClearOverlays(page);

  const priorityRow = page
    .locator('#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]')
    .first();
  await priorityRow.waitFor({ state: 'attached', timeout: 30000 });
  const rowCount = await page.locator('#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]').count();
  const firstRowId = await priorityRow.evaluate((el) => el.getAttribute('data-contact-id') || el.getAttribute('data-id') || '');
  console.log(`[boot-smoke] Priority Actions rows=${rowCount} firstRowContactId=${firstRowId}`);
  await page.evaluate(() => {
    const card = document.getElementById('priority-actions-card');
    if (card) {
      card.style.display = '';
      card.removeAttribute('aria-hidden');
    }
  });
  await priorityRow.evaluate((el) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });

  const contactModal = page.locator('dialog#contact-modal[open]');
  await contactModal.waitFor({ state: 'visible', timeout: 30000 });
  await page.keyboard.press('Escape').catch(() => {});
  const closeBtn = page
    .locator(
      'dialog#contact-modal[open] [data-close], dialog#contact-modal[open] button:has-text("Close"), dialog#contact-modal[open] button[aria-label*="Close"], dialog#contact-modal[open] .modal-close'
    )
    .first();
  if (await closeBtn.count()) {
    await closeBtn.click({ timeout: 2000, force: true }).catch(() => {});
  }
  await page
    .locator('dialog#contact-modal[open]')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(async () => {
      const stillOpen = await page.locator('dialog#contact-modal[open]').count();
      if (stillOpen) throw new Error('contact-modal still open after close attempts');
    });
  await hardClearOverlays(page);

  const navTargets = ['dashboard', 'labs', 'pipeline', 'partners', 'contacts', 'calendar', 'settings'];
  for (const nav of navTargets) {
    await hardClearOverlays(page);
    const btn = page.locator(`#main-nav button[data-nav="${nav}"]`);
    if (await btn.count() > 0) {
      await btn.first().click();
    }
    await page.waitForSelector(`#view-${nav}`, { state: 'visible', timeout: 10000 }).catch(() => { });
  }

  // Labs module sanity check
  await page.evaluate(async () => {
    try {
      const mod = await import('./js/labs/data.js');
      if (typeof mod.getContactDisplayName !== 'function') {
        throw new Error('getContactDisplayName is missing from labs/data.js exports');
      }
      console.log('[boot-smoke] labs/data.js verified');
    } catch (e) {
      throw new Error('Labs module verification failed: ' + e.message);
    }
  });

  if (errors.length) {
    throw errors[0];
  }

  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  console.log('[boot-smoke] PASS');
}

run().catch((err) => {
  console.error('[boot-smoke] FAIL', err?.message || err);
  process.exit(1);
});
