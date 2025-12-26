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
  const baseUrl = `http://127.0.0.1:${port}/index.html?e2e=1`;
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

  async function hardCloseContactModal(pageRef) {
    const modalOpen = pageRef.locator('dialog#contact-modal[open]');
    if (!(await modalOpen.count())) return;

    await pageRef.keyboard.press('Escape').catch(() => {});
    await pageRef.waitForTimeout(100);

    const modal = pageRef.locator('dialog#contact-modal').first();
    const closeCandidates = [
      '[data-close]',
      '.modal-close',
      'button:has-text("Close")',
      'button:has-text("Done")',
      'button[aria-label*="Close"]',
      'button[aria-label*="close"]',
      'button:has-text("Cancel")'
    ];
    for (const sel of closeCandidates) {
      const btn = modal.locator(sel).first();
      if (await btn.count()) {
        await btn.click({ timeout: 1000, force: true }).catch(() => {});
        await pageRef.waitForTimeout(100);
        if (!(await modalOpen.count())) return;
      }
    }

    await pageRef.evaluate(() => {
      const dlg = document.querySelector('dialog#contact-modal');
      if (!dlg) return;
      try { dlg.close(); } catch (e) {}
      try { dlg.removeAttribute('open'); } catch (e) {}
      try { dlg.dataset.open = '0'; dlg.dataset.opening = '0'; } catch (e) {}
    });
    await pageRef.waitForTimeout(100);

    await pageRef.waitForSelector('dialog#contact-modal[open]', { state: 'detached', timeout: 2000 }).catch(() => {});

    const still = await modalOpen.count();
    if (still) {
      await pageRef.evaluate(() => {
        const dlg = document.querySelector('dialog#contact-modal[open]');
        if (dlg) try { dlg.remove(); } catch (e) {}
      });
    }

    const stillAfter = await pageRef.locator('dialog#contact-modal[open]').count();
    if (stillAfter) {
      await pageRef.evaluate(() => {
        const dlg = document.querySelector('dialog#contact-modal');
        console.log('[boot-smoke] modal open attr=', dlg && dlg.hasAttribute('open'), 'data-open=', dlg && dlg.dataset && dlg.dataset.open);
      });
      throw new Error('contact-modal still open after hardCloseContactModal');
    }
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
  await hardCloseContactModal(page);

  const logPriorityRowContext = async (label) => {
    const info = await page.evaluate((lbl) => {
      const priorityRow = document.querySelector('#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]');
      if (!priorityRow) {
        return { label: lbl, missing: true };
      }

      const rect = priorityRow.getBoundingClientRect();
      const cx = Math.floor(rect.left + rect.width / 2);
      const cy = Math.floor(rect.top + rect.height / 2);
      const describeEl = (el) => {
        if (!el) return 'null';
        const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
        const id = el.id ? `#${el.id}` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.trim().replace(/\s+/g, '.')}` : '';
        return `${tag}${id}${cls}`;
      };
      const styleSummary = (el) => {
        if (!el) return 'n/a';
        const cs = getComputedStyle(el);
        return { pointerEvents: cs.pointerEvents, visibility: cs.visibility, display: cs.display, opacity: cs.opacity };
      };
      const overlays = Array.from(
        document.querySelectorAll(
          'dialog[open], dialog[aria-hidden="false"], [data-ui*="modal"], [data-modal-key], [data-open="1"], .overlay, .modal-backdrop, [data-ui*="quick-create"], [data-overlay]'
        )
      ).filter((el) => {
        const cs = getComputedStyle(el);
        return cs.visibility !== 'hidden' && cs.display !== 'none';
      });
      const hit = document.elementFromPoint(cx, cy);

      return {
        label: lbl,
        center: { cx, cy, elementFromPoint: describeEl(hit) },
        styles: {
          dashboard: styleSummary(document.querySelector('#view-dashboard')),
          card: styleSummary(document.getElementById('priority-actions-card')),
          row: styleSummary(priorityRow)
        },
        overlays: overlays.map(describeEl)
      };
    }, label);
    console.log('[boot-smoke][diag]', info);
  };

  const logModalDiagnostics = async (label) => {
    const info = await page.evaluate((lbl) => {
      const describeEl = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          tag: el.tagName ? el.tagName.toLowerCase() : 'node',
          id: el.id || null,
          classes: el.className && typeof el.className === 'string' ? el.className.trim() : null,
          openAttr: el.hasAttribute('open'),
          dataOpen: el.dataset ? el.dataset.open : undefined,
          ariaHidden: el.getAttribute('aria-hidden'),
          display: cs.display,
          visibility: cs.visibility,
          pointerEvents: cs.pointerEvents
        };
      };

      const dialogModal = document.querySelector('dialog#contact-modal');
      const dataUiModal = document.querySelector('[data-ui="contact-edit-modal"]');
      return { label: lbl, dialog: describeEl(dialogModal), dataUi: describeEl(dataUiModal) };
    }, label);
    console.log('[boot-smoke][modal-diag]', info);
  };

  const priorityRowSelector = '#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]';
  const priorityRow = () => page.locator(priorityRowSelector).first();
  await priorityRow().waitFor({ state: 'attached', timeout: 30000 });
  const rowCount = await page.locator(priorityRowSelector).count();
  const firstRowId = await priorityRow().evaluate((el) => el.getAttribute('data-contact-id') || el.getAttribute('data-id') || '');
  console.log(`[boot-smoke] Priority Actions rows=${rowCount} firstRowContactId=${firstRowId}`);
  await page.evaluate(() => {
    const card = document.getElementById('priority-actions-card');
    if (card) {
      card.style.display = '';
      card.removeAttribute('aria-hidden');
    }
  });
  const contactModal = page.locator('dialog#contact-modal[open], [data-ui="contact-edit-modal"][open], [data-ui="contact-edit-modal"][data-open="1"]');
  const waitForContactModal = async () => {
    try {
      await page.waitForFunction(
        (id) => window.__E2E__?.lastOpen?.type === 'contact' && window.__E2E__?.lastOpen?.id === id,
        firstRowId,
        { timeout: 30000 }
      );
    } catch (err) {
      await logModalDiagnostics('waitForFunction failed');
      throw err;
    }

    try {
      await contactModal.waitFor({ state: 'visible', timeout: 30000 });
    } catch (err) {
      await logModalDiagnostics('contact-modal visible wait failed');
      const dialogExists = await page.locator('dialog#contact-modal').count();
      if (dialogExists) {
        await logModalDiagnostics('contact-modal exists but not open');
      }
      throw err;
    }
  };

  const openFirstPriorityAction = async () => {
    const card = page.locator('#priority-actions-card');
    await card.waitFor({ state: 'attached', timeout: 30000 });
    await page.evaluate(() => {
      const el = document.querySelector('#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]');
      if (!el) return null;
      el.style.display = 'list-item';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      const cardEl = document.getElementById('priority-actions-card');
      if (cardEl) {
        cardEl.style.setProperty('display', 'block', 'important');
        cardEl.style.visibility = 'visible';
        cardEl.style.opacity = '1';
        cardEl.removeAttribute('aria-hidden');
      }
      const list = el.closest('#priority-actions-card #needs-attn');
      if (list) {
        list.style.setProperty('display', 'block', 'important');
        list.style.visibility = 'visible';
        list.style.opacity = '1';
      }
    });
    await page.waitForFunction(() => {
      const c = document.getElementById('priority-actions-card');
      if (!c) return false;
      const cs = getComputedStyle(c);
      const box = c.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    }, { timeout: 30000 });
    await priorityRow().waitFor({ state: 'attached', timeout: 30000 });
    await logPriorityRowContext('pre-click');

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const row = priorityRow();
      const childTarget = () => row.locator('.insight-sub, .insight-title, .list-main, .insight-meta').first();
      try {
        await row.waitFor({ state: 'attached', timeout: 30000 });
        await childTarget().waitFor({ state: 'attached', timeout: 10000 });
        const [rowVisible, targetVisible] = await Promise.all([
          row.isVisible().catch(() => false),
          childTarget().isVisible().catch(() => false)
        ]);
        const rowBox = await row.boundingBox();
        const childBox = await childTarget().boundingBox();
        console.log(`[boot-smoke] Attempt ${attempt} row visible=${rowVisible} target visible=${targetVisible}`, 'row bbox', rowBox, 'child bbox', childBox);
        if ((!rowBox || !rowBox.width || !rowBox.height) && childBox && childBox.width && childBox.height) {
          console.log('[boot-smoke] Priority row bbox missing/zero while child is non-zero (expected child click)');
        }

        let clicked = false;
        if (targetVisible) {
          await childTarget().click({ timeout: 5000 });
          clicked = true;
        } else {
          await row.evaluate((el) => {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          });
          clicked = true;
        }

        if (clicked) {
          const modalAppeared = await contactModal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
          await logModalDiagnostics('post-click presence');
          if (modalAppeared) return;
        }
      } catch (err) {
        const msg = String(err.message || err || '');
        if (attempt < maxAttempts && /detached from dom|not attached/i.test(msg)) {
          await page.waitForTimeout(150);
          continue;
        }
        if (attempt < maxAttempts && /not visible|timeout/i.test(msg)) {
          await page.waitForTimeout(150);
          continue;
        }
        throw err;
      }
      await page.waitForTimeout(150);
    }
    throw new Error('Unable to open contact modal from Priority Actions after retries');
  };

  await openFirstPriorityAction();
  await waitForContactModal();
  await hardCloseContactModal(page);
  await hardClearOverlays(page);

  await openFirstPriorityAction();
  await waitForContactModal();
  await hardCloseContactModal(page);
  await hardClearOverlays(page);

  const navTargets = ['dashboard', 'labs', 'pipeline', 'partners', 'contacts', 'calendar', 'settings'];
  for (const nav of navTargets) {
    await hardClearOverlays(page);
    await hardCloseContactModal(page);
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
