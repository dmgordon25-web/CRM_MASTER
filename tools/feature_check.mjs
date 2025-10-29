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

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() {
      return store.size;
    },
    key(index) {
      if (!Number.isInteger(index) || index < 0 || index >= store.size) return null;
      return Array.from(store.keys())[index] ?? null;
    },
    getItem(key) {
      if (key == null) return null;
      const value = store.get(String(key));
      return value === undefined ? null : value;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    }
  };
}

async function loadDashboardLayoutModule() {
  const modulePath = new URL('../crm-app/js/ui/dashboard_layout.js', import.meta.url);
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return import(`${modulePath.href}?t=${cacheBuster}`);
}

async function runDashboardPersistenceResetCheck() {
  globalThis.localStorage = createMemoryStorage();
  globalThis.window = undefined;
  globalThis.document = undefined;
  try {
    const loadModule = () => loadDashboardLayoutModule();
    const first = await loadModule();
    first.setDashboardLayoutMode(true);
    if (globalThis.localStorage.getItem('dash:layoutMode:v1') !== '1') {
      throw new Error('layout mode did not persist to storage');
    }
    first.applyDashboardHidden(new Set(['goal-progress-card']));
    const hiddenRaw = globalThis.localStorage.getItem('dash:layout:hidden:v1');
    if (!hiddenRaw || !hiddenRaw.includes('goal-progress-card')) {
      throw new Error('hidden ids did not persist to storage');
    }
    const second = await loadModule();
    if (!second.readStoredLayoutMode()) {
      throw new Error('stored layout mode not restored');
    }
    const hiddenIds = second.readStoredHiddenIds();
    if (!Array.isArray(hiddenIds) || hiddenIds.indexOf('goal-progress-card') === -1) {
      throw new Error('stored hidden ids missing expected value');
    }
    const result = second.resetDashboardLayoutState({ skipLayoutPass: true });
    if (!result || !Array.isArray(result.removedKeys)) {
      throw new Error('reset did not report removed keys');
    }
    if (globalThis.localStorage.getItem('dash:layoutMode:v1') !== null) {
      throw new Error('layout mode key not cleared');
    }
    if (globalThis.localStorage.getItem('dash:layout:hidden:v1') !== null) {
      throw new Error('hidden key not cleared');
    }
    const third = await loadModule();
    if (third.readStoredLayoutMode()) {
      throw new Error('layout mode persisted after reset');
    }
    if (third.readStoredHiddenIds().length !== 0) {
      throw new Error('hidden ids persisted after reset');
    }
    console.log('[CHECK] dashboard:persistence-reset ok');
  } finally {
    delete globalThis.localStorage;
    delete globalThis.window;
    delete globalThis.document;
  }
}

const CHECKS = {
  'feature:avatar-persist': runDefaultFeatureCheck,
  'dashboard:persistence-reset': runDashboardPersistenceResetCheck
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
  const args = process.argv.slice(2);
  let checkName = DEFAULT_CHECK;
  const flagIndex = args.indexOf('--check');
  if (flagIndex !== -1 && args[flagIndex + 1]) {
    checkName = args[flagIndex + 1];
  } else if (args.length > 0) {
    checkName = args[0];
  }
  try {
    await runCheck(checkName);
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  }
}
