import { spawn } from 'node:child_process';
import { once } from 'node:events';
import process from 'node:process';
import puppeteer from 'puppeteer';

function startDevServer() {
  const child = spawn(process.execPath, ['tools/dev_server.mjs'], {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return child;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const handleData = (chunk) => {
      const text = String(chunk);
      buffer += text;
      const match = text.match(/\[SERVER\] listening on (http:\/\/127\.0\.0\.1:(\d+)\/) \(root: ([^)]+)\)/);
      if (match) {
        cleanup();
        resolve({ origin: match[1], port: Number(match[2]), root: match[3], logs: buffer });
      }
    };
    const handleErr = (chunk) => {
      buffer += String(chunk);
    };
    const handleExit = (code) => {
      cleanup();
      reject(new Error(`Dev server exited early (code=${code ?? 'null'}). Output:\n${buffer}`));
    };
    const cleanup = () => {
      child.stdout.off('data', handleData);
      child.stderr.off('data', handleErr);
      child.off('exit', handleExit);
    };
    child.stdout.on('data', handleData);
    child.stderr.on('data', handleErr);
    child.once('exit', handleExit);
  });
}

async function ensureFeatureGate(origin) {
  const whoamiRes = await fetch(new URL('__whoami', origin));
  if (!whoamiRes.ok) {
    throw new Error(`__whoami request failed with status ${whoamiRes.status}`);
  }
  const whoami = await whoamiRes.json();
  if (!whoami.indexContainsBootStamp) {
    throw new Error(`index missing boot stamp (servedRoot=${whoami.servedRoot}, index=${whoami.indexPath})`);
  }

  globalThis.__HELLO_DIALOG__ = false;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const page = await browser.newPage();
    page.on('dialog', (dialog) => {
      try {
        if (/^Hello/.test(dialog.message())) {
          globalThis.__HELLO_DIALOG__ = true;
          return dialog.accept();
        }
      } catch {}
      return dialog.dismiss();
    });

    await page.goto(origin, { waitUntil: 'domcontentloaded' });

    if (!globalThis.__HELLO_DIALOG__) {
      throw new Error('Hello confirm dialog did not appear');
    }

    const ack = await page.evaluate(() => window.__HELLO_ACK__ === true);
    if (!ack) {
      throw new Error('Hello confirm acknowledgement missing');
    }

    await page.waitForSelector('#boot-splash');
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__);

    await page.evaluate(() => { location.hash = '#/partners'; });
    await page.waitForFunction(() => {
      const el = document.getElementById('dev-route-toast');
      return !!(el && el.getAttribute('data-ui') === 'route-toast' && (el.textContent || '').includes('partners'));
    });

    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await page.waitForFunction(() => {
      const el = document.getElementById('dev-route-toast');
      return !!(el && (el.textContent || '').includes('dashboard'));
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  let child;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    await ensureFeatureGate(origin);
    console.log('[FEATURE_CHECK] hello=ok splash=ok toast=ok');
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  } finally {
    if (child) {
      try {
        child.kill('SIGTERM');
      } catch {}
      try {
        await once(child, 'exit');
      } catch {}
    }
  }
}

await main();
