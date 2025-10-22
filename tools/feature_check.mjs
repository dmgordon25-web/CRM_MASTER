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
    splashSeen: false,
    newBtn: 'fail',
    avatarInput: 'fail',
    contactAddBtn: 'fail'
  };
  let exitCode = 0;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.readyState === 'complete', { timeout: 15000 });
      statuses.splashSeen = await page.evaluate(() => window.__SPLASH_SEEN__ || false);
    } catch (err) {
      exitCode = 1;
      console.error('[FEATURE_CHECK] navigation error', err);
      return { statuses, exitCode };
    }

    try {
      await page.waitForFunction(() => {
        const nodes = Array.from(document.querySelectorAll('button, a'));
        return nodes.some((el) => {
          const text = (el.textContent || '').trim();
          if (!text) return false;
          return text === '+ New' || text.includes('New');
        });
      }, { timeout: 5000 });
      statuses.newBtn = 'ok';
    } catch (err) {
      exitCode = 1;
      statuses.newBtn = 'fail';
      console.error('[FEATURE_CHECK] new button missing', err);
    }

    try {
      await page.evaluate(() => { window.location.hash = '#/settings/profiles'; });
      await page.waitForFunction(() => window.location.hash.includes('#/settings/profiles'), { timeout: 2000 }).catch(() => {});
      await page.waitForSelector('input[type="file"][accept="image/*"]', { timeout: 5000 });
      statuses.avatarInput = 'ok';
    } catch (err) {
      exitCode = 1;
      statuses.avatarInput = 'fail';
      console.error('[FEATURE_CHECK] avatar input missing', err);
    }

    try {
      await page.evaluate(() => window.renderContactModal?.(null));
      await page.waitForSelector('#contact-modal[open]', { timeout: 5000 });
      await page.waitForSelector('button[aria-label="Add Contact"]', { timeout: 5000 });
      statuses.contactAddBtn = 'ok';
    } catch (err) {
      exitCode = 1;
      statuses.contactAddBtn = 'fail';
      console.error('[FEATURE_CHECK] contact add button missing', err);
    }
  } finally {
    await browser.close().catch(() => {});
  }

  if (statuses.newBtn !== 'ok' || statuses.avatarInput !== 'ok' || statuses.contactAddBtn !== 'ok') {
    exitCode = 1;
  }

  return { statuses, exitCode };
}

async function main() {
  const statuses = {
    splashSeen: false,
    newBtn: 'fail',
    avatarInput: 'fail',
    contactAddBtn: 'fail'
  };
  let exitCode = 1;
  let serverHandle = null;

  try {
    serverHandle = await startDevServer();
    const result = await runChecks(serverHandle.url);
    Object.assign(statuses, result.statuses);
    exitCode = result.exitCode;
  } catch (err) {
    console.error('[FEATURE_CHECK] fatal', err);
  } finally {
    console.log(`[FEATURE_CHECK] splashSeen=${Boolean(statuses.splashSeen)} newBtn=${statuses.newBtn} avatarInput=${statuses.avatarInput} contactAddBtn=${statuses.contactAddBtn}`);
    if (serverHandle?.child) {
      await shutdownServer(serverHandle.child);
    }
    process.exitCode = exitCode;
  }
}

main().catch((err) => {
  console.error('[FEATURE_CHECK] unhandled', err);
  process.exitCode = 1;
});
