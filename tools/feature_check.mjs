import { spawn } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const PORT = Number.parseInt(process.env.PORT || '8080', 10);
const ORIGIN = `http://127.0.0.1:${PORT}`;

function startServer() {
  const server = spawn(process.execPath, ['tools/dev_server.mjs'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const log = (stream, data) => {
    const text = String(data || '');
    if (!text) return;
    stream.write(text);
  };
  server.stdout.on('data', (chunk) => log(process.stdout, chunk));
  server.stderr.on('data', (chunk) => log(process.stderr, chunk));
  return server;
}

async function waitForServerReady(server) {
  const started = Date.now();
  const timeout = 30000;
  let buffer = '';
  return new Promise((resolve, reject) => {
    const onData = (data) => {
      buffer += String(data || '');
      if (buffer.includes('listening on http://127.0.0.1:8080/')) {
        cleanup();
        resolve();
      }
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`dev server exited with code ${code ?? 'null'}`));
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    let timerId = null;
    const cleanup = () => {
      server.stdout.off('data', onData);
      server.stderr.off('data', onData);
      server.off('exit', onExit);
      server.off('error', onError);
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };
    server.stdout.on('data', onData);
    server.stderr.on('data', onData);
    server.once('exit', onExit);
    server.once('error', onError);
    timerId = setInterval(() => {
      if (Date.now() - started > timeout) {
        cleanup();
        reject(new Error('dev server start timeout'));
      }
    }, 250);
  });
}

async function ensureSplash(page) {
  await page.waitForSelector('#boot-splash', { timeout: 5000 });
  await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
}

async function ensureNewButton(page) {
  await page.waitForFunction(() => {
    const nodes = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    return nodes.some((node) => {
      const text = (node.textContent || '').trim();
      return /(^|\b)New\b/i.test(text);
    });
  }, { timeout: 8000 });
}

async function ensureAvatarUpload(page) {
  await page.goto(`${ORIGIN}/#/settings/profiles`, { waitUntil: 'domcontentloaded' });
  const selector = 'input[type="file"][accept="image/*"]';
  await page.waitForSelector(selector, { timeout: 8000 });
  const buffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
    'base64'
  );
  await page.setInputFiles(selector, [{ name: 'avatar.png', mimeType: 'image/png', buffer }]);
  await page.waitForFunction(() => {
    const header = document.querySelector('.header-bar');
    if (!header) return false;
    return Array.from(header.querySelectorAll('img')).some((img) => {
      try {
        return /^data:/i.test(img.src || '');
      } catch (_) {
        return false;
      }
    });
  }, { timeout: 8000 });
}

async function ensureContactButton(page) {
  await page.evaluate(() => {
    if (typeof window.renderContactModal === 'function') {
      window.renderContactModal(null);
    }
  });
  await page.waitForSelector('#contact-modal[open]', { timeout: 8000 });
  await page.waitForSelector('button[aria-label="Add Contact"]', { timeout: 8000 });
}

async function run() {
  let server;
  let browser;
  try {
    server = startServer();
    await waitForServerReady(server);

    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });

    await ensureSplash(page);
    await ensureNewButton(page);
    await ensureAvatarUpload(page);
    await ensureContactButton(page);

    console.log('[FEATURE_CHECK] splash=ok newBtn=ok avatar=ok contactAdd=ok');
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      if (server.exitCode == null && server.signalCode == null) {
        server.kill('SIGTERM');
      }
      await new Promise((resolve) => {
        if (server.exitCode != null || server.signalCode != null) {
          resolve();
          return;
        }
        const timer = setTimeout(resolve, 5000);
        if (typeof timer.unref === 'function') {
          timer.unref();
        }
        server.once('exit', () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
