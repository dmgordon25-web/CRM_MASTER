import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEV_SERVER_PATH = path.join(REPO_ROOT, 'tools', 'dev_server.mjs');

function startDevServer() {
  const child = spawn(process.execPath, [DEV_SERVER_PATH], {
    env: { ...process.env, CRM_SKIP_AUTO_OPEN: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const onProcessExit = () => {
    if (child.exitCode == null) {
      try {
        child.kill('SIGTERM');
      } catch {}
    }
  };

  process.on('exit', onProcessExit);

  return new Promise((resolve, reject) => {
    let resolved = false;
    let buffer = '';

    const cleanup = (error, url) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
      process.off('exit', onProcessExit);
      if (error) {
        reject(error);
      } else {
        resolve({ child, url });
      }
    };

    const onStdout = (chunk) => {
      const text = chunk.toString();
      buffer += text;
      process.stdout.write(text);
      const match = buffer.match(/\[SERVER\] listening on (http:\/\/[^\s]+)/);
      if (match) {
        cleanup(null, match[1]);
      }
    };

    const onStderr = (chunk) => {
      process.stderr.write(chunk);
    };

    const onExit = (code) => {
      cleanup(new Error(`Dev server exited with code ${code ?? 0}`));
    };

    const timeout = setTimeout(() => {
      cleanup(new Error('Dev server start timeout'));
    }, 20000);

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('exit', onExit);
  });
}

function shutdownServer(child) {
  return new Promise((resolve) => {
    if (!child || child.exitCode != null) {
      resolve();
      return;
    }
    const onExit = () => {
      resolve();
    };
    child.once('exit', onExit);
    try {
      child.kill('SIGTERM');
    } catch {}
    setTimeout(() => {
      if (child.exitCode == null) {
        try {
          child.kill('SIGKILL');
        } catch {}
      }
    }, 2000).unref();
  });
}

async function runChecks(baseUrl) {
  const statuses = {
    beacons: 0,
    splashSeen: false,
    newBtn: 'fail',
    avatar: 'fail',
    contactAddBtn: 'fail'
  };
  const beaconMessages = [];
  let navigationOk = true;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[A_BEACON]')) {
        beaconMessages.push(text);
      }
      console.log(`[BROWSER:${msg.type()}] ${text}`);
    });

    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 });
      statuses.splashSeen = await page.evaluate(() => !!window.__SPLASH_SEEN__);
    } catch (err) {
      navigationOk = false;
      console.error('[FEATURE_CHECK] navigation error', err);
    }

    if (navigationOk) {
      try {
        await page.waitForFunction(() => {
          const el = document.getElementById('btn-header-new');
          if (!(el instanceof HTMLElement)) return false;
          const rect = el.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) return false;
          const style = window.getComputedStyle(el);
          if (!style) return false;
          return style.visibility !== 'hidden' && style.display !== 'none';
        }, { timeout: 10000 });
        statuses.newBtn = 'ok';
      } catch (err) {
        console.error('[FEATURE_CHECK] new button missing', err);
      }

      try {
        await page.evaluate(() => { window.location.hash = '#/settings/profiles'; });
        await page.waitForFunction(() => window.location.hash.includes('#/settings/profiles'), { timeout: 2000 }).catch(() => {});
        await page.waitForSelector('input[type="file"][accept="image/*"]', { timeout: 7000 });
        statuses.avatar = 'ok';
      } catch (err) {
        console.error('[FEATURE_CHECK] avatar input missing', err);
      }

      try {
        await page.waitForFunction(() => {
          const fn = window.renderContactModal;
          if (typeof fn !== 'function') return false;
          try {
            return !String(fn).includes('shim invoked');
          } catch (err) {
            return true;
          }
        }, { timeout: 10000 });
        await page.evaluate(async () => {
          const fn = window.renderContactModal;
          if (typeof fn === 'function') {
            await Promise.resolve(fn(null));
          }
        });
        await page.waitForSelector('#contact-modal[open]', { timeout: 10000 });
        await page.waitForSelector('button[aria-label="Add Contact"]', { timeout: 10000 });
        statuses.contactAddBtn = 'ok';
      } catch (err) {
        console.error('[FEATURE_CHECK] contact add button missing', err);
      }
    }

    if (beaconMessages.length === 0) {
      try {
        await page.waitForTimeout(5000);
      } catch {}
    }
  } finally {
    statuses.beacons = beaconMessages.length;
    await browser.close().catch(() => {});
  }

  const allOk = navigationOk
    && statuses.splashSeen
    && statuses.newBtn === 'ok'
    && statuses.avatar === 'ok'
    && statuses.contactAddBtn === 'ok';
  const exitCode = allOk ? 0 : 1;
  return { statuses, exitCode };
}

async function main() {
  let serverHandle = null;
  let result = {
    statuses: {
      beacons: 0,
      splashSeen: false,
      newBtn: 'fail',
      avatar: 'fail',
      contactAddBtn: 'fail'
    },
    exitCode: 1
  };

  try {
    serverHandle = await startDevServer();
    result = await runChecks(serverHandle.url);
  } catch (err) {
    console.error('[FEATURE_CHECK] fatal', err);
  } finally {
    console.log(`[FEATURE_CHECK] beacons=${result.statuses.beacons} splashSeen=${Boolean(result.statuses.splashSeen)} newBtn=${result.statuses.newBtn} avatar=${result.statuses.avatar} contactAddBtn=${result.statuses.contactAddBtn}`);
    if (serverHandle?.child) {
      await shutdownServer(serverHandle.child);
    }
    process.exitCode = result.exitCode;
  }
}

main().catch((err) => {
  console.error('[FEATURE_CHECK] unhandled', err);
  process.exitCode = 1;
});
