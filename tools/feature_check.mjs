import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const BOOT_STAMP = '<!-- BOOT_STAMP: crm-app-index -->';

function startDevServer() {
  const child = spawn(process.execPath, ['tools/dev_server.mjs'], {
    env: { ...process.env, CRM_SKIP_AUTO_OPEN: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return child;
}

function waitForServer(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onStdout = (chunk) => {
      const text = String(chunk);
      buffer += text;
      const match = text.match(/\[SERVER\] listening on (http:\/\/127\.0\.0\.1:(\d+)\/) \(root: ([^)]+)\)/);
      if (match) {
        cleanup();
        resolve({ origin: match[1], port: Number(match[2]), root: match[3], logs: buffer });
      }
    };
    const onStderr = (chunk) => {
      buffer += String(chunk);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`Dev server exited early (code=${code ?? 'null'}). Output:\n${buffer}`));
    };
    const cleanup = () => {
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
    };
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('exit', onExit);
  });
}

function sanitizeExcerpt(html) {
  return html.replace(/\s+/g, ' ').slice(0, 200).trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} responded with ${res.status}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} responded with ${res.status}`);
  }
  return res.text();
}

async function runFeatureCheck(origin) {
  const whoamiUrl = new URL('__whoami', origin);
  const whoami = await fetchJson(whoamiUrl);
  console.log(JSON.stringify(whoami));

  const rawUrl = new URL('__raw_root', origin);
  const rawHtml = await fetchText(rawUrl);
  if (!rawHtml.includes(BOOT_STAMP)) {
    const excerpt = sanitizeExcerpt(rawHtml);
    throw new Error(`Root HTML missing BOOT_STAMP. Excerpt: ${excerpt}`);
  }

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let cleanupTemp;
  try {
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    const settingsUrl = new URL('#/settings/profiles', origin).toString();
    await page.goto(settingsUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    const inputSelector = 'input[type="file"][accept="image/*"]';
    await page.waitForSelector(inputSelector, { timeout: 15000 });
    const input = await page.$(inputSelector);
    if (!input) {
      throw new Error('Avatar input not found');
    }

    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAusB9Yw7lXkAAAAASUVORK5CYII=', 'base64');
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-avatar-'));
    const filePath = path.join(tmpDir, 'avatar.png');
    await fs.writeFile(filePath, pngBuffer);
    cleanupTemp = async () => {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    };

    await input.uploadFile(filePath);

    const avatarVisible = () => {
      const img = document.querySelector('#lo-profile-chip img[data-role="lo-photo"]');
      return !!(img && typeof img.src === 'string' && img.src.startsWith('data:'));
    };

    await page.waitForFunction(avatarVisible, { timeout: 15000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
    await page.waitForFunction(avatarVisible, { timeout: 15000 });

    const screenshotRelative = path.join('proofs', 'cleanup.png');
    const screenshotAbsolute = path.join(process.cwd(), screenshotRelative);
    await fs.mkdir(path.dirname(screenshotAbsolute), { recursive: true });
    await page.screenshot({ path: screenshotAbsolute, fullPage: true });

    return { screenshotPath: screenshotRelative };
  } finally {
    await browser.close().catch(() => {});
    if (cleanupTemp) {
      await cleanupTemp();
    }
  }
}

async function runDefaultFeatureCheck() {
  let child;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    const { screenshotPath } = await runFeatureCheck(origin);
    console.log(`[FEATURE_CHECK] cleanup=ok splash=ok avatarPersist=ok screenshot=${screenshotPath}`);
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

const CHECKS = {
  'feature:avatar-persist': runDefaultFeatureCheck
};

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export async function hasCheck(name) {
  return hasOwn(CHECKS, name);
}

export async function runCheck(name) {
  if (!(await hasCheck(name))) {
    throw new Error(`Unknown check: ${name}`);
  }
  return CHECKS[name]();
}

const DEFAULT_CHECK = 'feature:avatar-persist';
const modulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedPath === modulePath) {
  try {
    await runCheck(DEFAULT_CHECK);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}
