import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const PROOFS_DIR = path.join(REPO_ROOT, 'proofs');
const SCREENSHOT_PATH = path.join(PROOFS_DIR, 'cleanup.png');
const BACKOFF_MS = [0, 2000, 5000, 10000, 15000];
const SPLASH_MARKER_RE = /id\s*=\s*['"]boot-splash['"]/i;

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function startServer(envOverrides = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/dev_server.mjs'], {
      cwd: REPO_ROOT,
      env: { ...process.env, CRM_SKIP_AUTO_OPEN: '1', ...envOverrides },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let resolved = false;
    let capturedStdout = '';

    const cleanup = () => {
      child.stdout?.removeAllListeners();
      child.stderr?.removeAllListeners();
    };

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      capturedStdout += text;
      const match = capturedStdout.match(/\[SERVER\] listening on (http:\/\/[^\s]+) \(root:/);
      if (!resolved && match) {
        resolved = true;
        resolve({ child, url: match[1] });
      }
    });

    child.stderr.on('data', () => {});

    child.once('error', (err) => {
      cleanup();
      if (!resolved) {
        reject(err);
      }
    });

    child.once('exit', (code) => {
      cleanup();
      if (resolved) return;
      const error = new Error(code === 3 ? 'BOOT_GUARD_FAIL' : 'DEV_SERVER_EXIT');
      error.code = code;
      reject(error);
    });
  });
}

async function stopServer(child) {
  if (!child) return;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 2000);
    timeout.unref();
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function ensureProofDir() {
  await fsp.mkdir(PROOFS_DIR, { recursive: true });
}

function assertBootStamp(rawHtml) {
  if (!rawHtml.includes('<!-- BOOT_STAMP: crm-app-index -->')) {
    throw new Error('BOOT_STAMP missing from served index');
  }
}

function assertSplash(rawHtml) {
  if (!SPLASH_MARKER_RE.test(rawHtml)) {
    throw new Error('Splash block missing from served index');
  }
}

async function uploadAvatar(page) {
  const selector = 'input[type="file"][accept="image/*"]';
  const handle = await page.waitForSelector(selector, { timeout: 15000 });
  const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8AARQMGgWGsHwAAAABJRU5ErkJggg==', 'base64');
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'crm-avatar-'));
  const tempFile = path.join(tempDir, 'avatar.png');
  await fsp.writeFile(tempFile, pngBuffer);
  try {
    await handle.uploadFile(tempFile);
  } finally {
    await fsp.unlink(tempFile).catch(() => {});
    await fsp.rmdir(tempDir).catch(() => {});
  }
  await page.waitForFunction(() => {
    const img = document.querySelector('#lo-profile-chip img[data-role="lo-photo"]');
    return !!img && /^data:/.test(img.src);
  }, { timeout: 15000 });
}

async function ensureAvatarPersists(page) {
  await page.waitForFunction(() => {
    const img = document.querySelector('#lo-profile-chip img[data-role="lo-photo"]');
    return !!img && /^data:/.test(img.src);
  }, { timeout: 15000 });
}

async function runBrowserFlow(baseUrl, label, screenshotPath) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const page = await browser.newPage();

    await page.goto(baseUrl, { waitUntil: 'networkidle2' });
    log(`[FEATURE_GATE] ${label} root loaded`);

    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
    log(`[FEATURE_GATE] ${label} splash hidden`);

    const settingsUrl = new URL('#/settings/profiles', baseUrl).toString();
    await page.goto(settingsUrl, { waitUntil: 'networkidle2' });
    log(`[FEATURE_GATE] ${label} navigated to settings`);

    await uploadAvatar(page);
    await ensureAvatarPersists(page);
    log(`[FEATURE_GATE] ${label} avatar uploaded`);

    await page.reload({ waitUntil: 'networkidle2' });
    await ensureAvatarPersists(page);
    log(`[FEATURE_GATE] ${label} avatar persisted after reload`);

    await ensureProofDir();
    await page.screenshot({ path: screenshotPath, fullPage: true });
    log(`[FEATURE_GATE] ${label} screenshot saved ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.text();
}

function snippet(html) {
  const target = '<!-- BOOT_STAMP: crm-app-index -->';
  const idx = html.indexOf(target);
  if (idx === -1) {
    return html.slice(0, 120);
  }
  return html.slice(Math.max(0, idx - 20), idx + target.length + 80).replace(/\s+/g, ' ').slice(0, 120);
}

async function runOnce(baseUrl) {
  const whoamiUrl = new URL('__whoami', baseUrl).toString();
  const rawUrl = new URL('__raw_root', baseUrl).toString();

  const whoami = await fetchJson(whoamiUrl);
  const rawHtml = await fetchText(rawUrl);

  assertBootStamp(rawHtml);
  assertSplash(rawHtml);

  const screenshotPath = SCREENSHOT_PATH;
  await runBrowserFlow(baseUrl, 'cleanup', screenshotPath);

  return { whoami, rawHtmlSnippet: snippet(rawHtml) };
}

async function attemptRun() {
  let lastError = null;
  for (let i = 0; i < BACKOFF_MS.length; i += 1) {
    const waitMs = BACKOFF_MS[i];
    if (waitMs) {
      await delay(waitMs);
    }
    let server;
    try {
      server = await startServer();
    } catch (err) {
      if (err && err.code === 3) {
        throw err;
      }
      lastError = err;
      continue;
    }
    try {
      const result = await runOnce(server.url);
      await stopServer(server.child);
      return result;
    } catch (err) {
      lastError = err;
      log(`[FEATURE_GATE] attempt ${i + 1} failed: ${(err && err.message) || err}`);
      await stopServer(server.child);
    }
  }
  throw lastError || new Error('Feature gate flow failed');
}

async function main() {
  try {
    const result = await attemptRun();
    log('[FEATURE_GATE] cleanup=ok splash=ok avatarPersist=ok screenshot=proofs/cleanup.png');
    log(`[FEATURE_GATE] whoami=${JSON.stringify(result.whoami)}`);
    log(`[FEATURE_GATE] raw=${result.rawHtmlSnippet}`);
    process.exit(0);
  } catch (err) {
    log(`[FEATURE_GATE] failure ${(err && err.message) || err}`);
    process.exit(1);
  }
}

main();
