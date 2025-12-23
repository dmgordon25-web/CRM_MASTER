#!/usr/bin/env node
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const { createStaticServer } = require('./static_server.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', 'crm-app');
const port = Number(process.env.SMOKE_PORT || 8081);

function startServer() {
  return new Promise((resolve, reject) => {
    const server = createStaticServer(rootDir);
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

async function run() {
  const server = await startServer();
  const baseUrl = `http://127.0.0.1:${port}/index.html`;
  console.log(`[boot-smoke] serving ${rootDir} on ${baseUrl}`);

  const executablePath = process.env.PLAYWRIGHT_CHROME || '/usr/bin/google-chrome-stable';
  const launchOptions = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'], executablePath };
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(new Error(msg.text()));
  });

  await page.goto(baseUrl);
  await page.waitForSelector('#boot-splash', { state: 'hidden', timeout: 15000 });

  const dashboardNav = page.locator('#main-nav button[data-nav="dashboard"]').first();
  if (await dashboardNav.count() > 0) {
    await dashboardNav.click();
  }
  await page.waitForSelector('#view-dashboard', { state: 'visible', timeout: 15000 });
  await page.evaluate(() => {
    const card = document.getElementById('priority-actions-card');
    if (card) {
      card.style.display = '';
      card.removeAttribute('aria-hidden');
    }
  });
  try {
    await page.waitForFunction(() => {
      const card = document.getElementById('priority-actions-card');
      return card && getComputedStyle(card).display !== 'none';
    }, { timeout: 30000 });
  } catch (err) {
    const cardState = await page.evaluate(() => {
      const card = document.getElementById('priority-actions-card');
      if (!card) return { found: false };
      const style = getComputedStyle(card);
      return {
        found: true,
        display: style.display,
        visibility: style.visibility,
        hidden: card.hidden,
        ariaHidden: card.getAttribute('aria-hidden')
      };
    });
    throw new Error(`Priority Actions card not visible: ${JSON.stringify(cardState)}`);
  }

  const priorityRow = page
    .locator('#priority-actions-card #needs-attn li[data-contact-id], #priority-actions-card #needs-attn li[data-id]')
    .first();
  try {
    await priorityRow.waitFor({ state: 'visible', timeout: 30000 });
  } catch (err) {
    const rowState = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#priority-actions-card #needs-attn li')).map((el) => {
        const style = getComputedStyle(el);
        return {
          outer: el.outerHTML.slice(0, 200),
          display: style.display,
          visibility: style.visibility,
          hidden: el.hidden
        };
      });
      return { count: rows.length, rows };
    });
    throw new Error(`Priority Actions row not visible: ${JSON.stringify(rowState)}`);
  }
  await priorityRow.click();

  const contactModal = page.locator('dialog#contact-modal');
  await contactModal.waitFor({ state: 'visible', timeout: 30000 });
  const closeButton = contactModal.locator('button[data-close]').first();
  if (await closeButton.count() === 0) {
    throw new Error('Contact modal close button not found');
  }
  await closeButton.click();
  const openModal = page.locator('dialog#contact-modal[open]');
  await openModal.waitFor({ state: 'detached', timeout: 30000 }).catch(async () => {
    await page.waitForFunction(() => {
      const modal = document.querySelector('dialog#contact-modal');
      return modal && !modal.hasAttribute('open');
    }, { timeout: 30000 });
  });

  const navTargets = ['dashboard', 'labs', 'pipeline', 'partners', 'contacts', 'calendar', 'settings'];
  for (const nav of navTargets) {
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
