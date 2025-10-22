import { spawn } from 'node:child_process';
import process from 'node:process';
import puppeteer from 'puppeteer';

const BASE_PORT = Number.parseInt(process.env.PORT || '8080', 10);
const SERVER_READY_RE = /\[SERVER\] listening on (http:\/\/127\.0\.0\.1:(\d+)\/) \(root: ([^)]+)\)/;

function startServer() {
  const server = spawn(process.execPath, ['tools/dev_server.mjs'], {
    env: { ...process.env, PORT: String(BASE_PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const forward = (stream, chunk) => {
    const text = String(chunk || '');
    if (!text) return;
    stream.write(text);
  };
  server.stdout.on('data', (chunk) => forward(process.stdout, chunk));
  server.stderr.on('data', (chunk) => forward(process.stderr, chunk));
  return server;
}

async function waitForServerReady(server) {
  const started = Date.now();
  const timeout = 30000;
  let buffer = '';
  return new Promise((resolve, reject) => {
    const handleData = (chunk) => {
      buffer += String(chunk || '');
      const match = buffer.match(SERVER_READY_RE);
      if (match) {
        cleanup();
        const port = Number.parseInt(match[2], 10);
        const url = match[1];
        const root = match[3];
        resolve({ port, url, root });
      }
    };
    const handleExit = (code) => {
      cleanup();
      reject(new Error(`dev server exited with code ${code ?? 'null'}`));
    };
    const handleError = (err) => {
      cleanup();
      reject(err);
    };
    let timer = null;
    const cleanup = () => {
      server.stdout.off('data', handleData);
      server.stderr.off('data', handleData);
      server.off('exit', handleExit);
      server.off('error', handleError);
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    server.stdout.on('data', handleData);
    server.stderr.on('data', handleData);
    server.once('exit', handleExit);
    server.once('error', handleError);
    timer = setInterval(() => {
      if (Date.now() - started > timeout) {
        cleanup();
        reject(new Error('dev server start timeout'));
      }
    }, 250);
  });
}

async function fetchWhoAmI(origin) {
  const res = await fetch(`${origin}/__whoami`, {
    headers: { 'cache-control': 'no-cache' }
  });
  if (!res.ok) {
    throw new Error(`whoami request failed with status ${res.status}`);
  }
  return res.json();
}

async function ensureSplash(page) {
  await page.waitForSelector('#boot-splash', { timeout: 5000 });
  await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
}

async function ensureNewButton(page) {
  await page.waitForFunction(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .some((node) => /(^|\b)New\b/i.test((node.textContent || '').trim()));
  }, { timeout: 8000 });
}

async function ensureAvatarUpload(page, origin) {
  await page.goto(`${origin}/#/settings/profiles`, { waitUntil: 'domcontentloaded' });
  const selector = 'input[type="file"][accept="image/*"]';
  await page.waitForSelector(selector, { timeout: 8000 });
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
  await page.evaluate((sel, base64) => {
    const input = document.querySelector(sel);
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('avatar input not found');
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const file = new File([bytes], 'avatar.png', { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(input, 'files', {
      configurable: true,
      get() { return transfer.files; }
    });
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector, pngBase64);
  await page.waitForFunction(() => {
    const img = document.querySelector('.header-bar img[data-role="lo-photo"]');
    if (!img) return false;
    try {
      return /^data:/i.test(img.src || '');
    } catch (_) {
      return false;
    }
  }, { timeout: 8000 });
}

async function ensureContactButton(page) {
  await page.evaluate(() => {
    if (typeof window.renderContactModal === 'function') {
      window.renderContactModal(null);
    }
  });
  await page.waitForSelector('#contact-modal[open]', { timeout: 8000 });
  await page.waitForSelector('button[aria-label="Add Contact"][title="Add Contact"]', { timeout: 8000 });
}

async function ensureRouteToast(page) {
  const waitForToast = async (hash) => {
    await page.waitForFunction((expected) => {
      const el = document.getElementById('dev-route-toast');
      if (!el) return false;
      const text = (el.textContent || '').trim();
      return text.includes(expected);
    }, { timeout: 5000 }, `Switched to: ${hash}`);
  };

  await page.evaluate(() => { window.location.hash = '#/partners'; });
  await waitForToast('#/partners');

  await page.evaluate(() => { window.location.hash = '#/dashboard'; });
  await waitForToast('#/dashboard');
}

async function closeServer(server) {
  if (!server) return;
  if (server.exitCode == null && server.signalCode == null) {
    server.kill('SIGTERM');
  }
  await new Promise((resolve) => {
    if (server.exitCode != null || server.signalCode != null) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 5000);
    if (typeof timer.unref === 'function') timer.unref();
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function run() {
  let server;
  let browser;
  try {
    server = startServer();
    const ready = await waitForServerReady(server);
    const origin = `http://127.0.0.1:${ready.port}`;

    const whoami = await fetchWhoAmI(origin);
    if (!whoami || whoami.indexContainsBootStamp !== true) {
      const path = whoami && whoami.indexPath ? whoami.indexPath : '<unknown>';
      const root = whoami && whoami.servedRoot ? whoami.servedRoot : '<unknown>';
      const sha = whoami && whoami.indexSha1 ? whoami.indexSha1 : '<unknown>';
      throw new Error(`index missing boot stamp (root=${root}, index=${path}, sha=${sha})`);
    }
    console.log('[WHOAMI]', JSON.stringify(whoami));

    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });

    await ensureSplash(page);
    await ensureNewButton(page);
    await ensureAvatarUpload(page, origin);
    await ensureContactButton(page);
    await ensureRouteToast(page);

    console.log('[FEATURE_CHECK] whoami=ok splash=ok newBtn=ok avatar=ok contactAdd=ok routeToast=ok');
  } finally {
    if (browser) {
      await browser.close();
    }
    await closeServer(server);
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
