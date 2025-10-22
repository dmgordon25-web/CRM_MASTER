import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import puppeteer from 'puppeteer';

function startServer() {
  const server = spawn('node', ['tools/dev_server.mjs'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  server.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });
  server.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  const readyPromise = new Promise((resolve, reject) => {
    let resolved = false;
    let buffer = '';
    const timeout = setTimeout(() => {
      if (!resolved) {
        cleanup();
        reject(new Error('dev server did not become ready within 15s'));
      }
    }, 15000);
    const handleData = (chunk) => {
      const text = chunk.toString();
      buffer += text;
      const match = buffer.match(/\[SERVER\] listening on (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) {
        resolved = true;
        cleanup();
        resolve(match[1]);
      }
    };

    const handleExit = (code) => {
      if (!resolved) {
        cleanup();
        reject(new Error(`dev server exited early (code ${code})`));
      }
    };

    const handleError = (err) => {
      if (!resolved) {
        cleanup();
        reject(err);
      }
    };

    const cleanup = () => {
      server.stdout.off('data', handleData);
      server.off('exit', handleExit);
      server.off('error', handleError);
      clearTimeout(timeout);
    };

    server.stdout.on('data', handleData);
    server.once('exit', handleExit);
    server.once('error', handleError);
  });

  return { server, readyPromise };
}

async function waitForReadyState(page) {
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 });
}

async function ensureNewButton(page) {
  const found = await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const btn of buttons) {
      const text = (btn.textContent || '').toLowerCase();
      if (!text.includes('new')) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const style = window.getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (parseFloat(style.opacity || '1') === 0) continue;
      let node = btn.parentElement;
      let hidden = false;
      while (node && node !== document.body) {
        const s = window.getComputedStyle(node);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity || '1') === 0) {
          hidden = true;
          break;
        }
        node = node.parentElement;
      }
      if (!hidden) {
        return true;
      }
    }
    return false;
  }, { timeout: 15000 });
  if (!found) {
    throw new Error('visible "New" button not found');
  }
}

async function ensureAvatarInput(page) {
  await page.evaluate(() => { window.location.hash = '#/settings/profiles'; });
  await page.waitForFunction(() => !!document.querySelector('input[type="file"][accept="image/*"]'), { timeout: 15000 });
}

async function ensureContactModal(page) {
  await page.waitForFunction(() => typeof window.renderContactModal === 'function', { timeout: 15000 });
  await page.waitForFunction(() => !!(window.__INIT_FLAGS__ && window.__INIT_FLAGS__.contacts_modal_guards), { timeout: 15000 });
  const modalState = await page.evaluate(async () => {
    const result = await window.renderContactModal?.(null);
    const dlg = document.getElementById('contact-modal');
    return {
      hasDialog: !!dlg,
      hasOpenAttr: !!(dlg && dlg.hasAttribute('open')),
      hasOpenProp: !!(dlg && typeof dlg.open === 'boolean' && dlg.open),
      buttonSelector: !!document.querySelector('#contact-modal button[aria-label="Add Contact"]'),
      buttonType: document.querySelector('#contact-modal button[aria-label="Add Contact"]')?.getAttribute('type') || null,
      buttonTitle: document.querySelector('#contact-modal button[aria-label="Add Contact"]')?.getAttribute('title') || null,
      resultType: typeof result
    };
  });
  if (!modalState.hasDialog || (!modalState.hasOpenAttr && !modalState.hasOpenProp)) {
    throw new Error(`Contact modal did not open (${JSON.stringify(modalState)})`);
  }
  if (!modalState.buttonSelector) {
    throw new Error('Contact modal add button missing');
  }
  const typeOk = (modalState.buttonType || '').toLowerCase() === 'button';
  const titleOk = (modalState.buttonTitle || '').trim().toLowerCase() === 'add contact';
  if (!typeOk || !titleOk) {
    throw new Error(`Contact modal add button missing required attributes (${JSON.stringify(modalState)})`);
  }
}

async function run() {
  const { server, readyPromise } = startServer();
  let exitCode = 0;
  let browser = null;
  try {
    const serverUrl = await readyPromise;
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const beaconMessages = [];
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        if (text.includes('[A_BEACON]')) {
          beaconMessages.push(text);
        }
      } catch (_) {}
    });

    await page.goto(serverUrl, { waitUntil: 'domcontentloaded' });
    await waitForReadyState(page);

    await page.waitForFunction(() => window.__SPLASH_SEEN__ === true, { timeout: 15000 });
    const splashSeen = await page.evaluate(() => !!window.__SPLASH_SEEN__);
    await ensureNewButton(page);
    await ensureAvatarInput(page);
    await ensureContactModal(page);

    const beaconCount = beaconMessages.length;
    console.log(`[FEATURE_CHECK] beacons=${beaconCount} splashSeen=${splashSeen} newBtn=ok avatar=ok contactAddBtn=ok`);
  } catch (err) {
    exitCode = 1;
    console.error(err && err.stack ? err.stack : err);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    server.kill();
    try {
      await once(server, 'exit');
    } catch (_) {}
  }
  process.exit(exitCode);
}

run();
