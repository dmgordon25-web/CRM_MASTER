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

async function runNotificationsToggleCheck() {
  let child;
  let browser;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
    await page.waitForFunction(() => {
      return !!(window.Notifier && typeof window.Notifier.replace === 'function');
    }, { timeout: 15000 });

    const beforeOrder = await page.evaluate(() => {
      try { window.localStorage?.clear(); }
      catch (_) {}
      const seed = [
        { id: 'notif-toggle-1', ts: Date.now(), type: 'info', title: 'Toggle Check One', state: 'unread', meta: {} },
        { id: 'notif-toggle-2', ts: Date.now() + 1, type: 'info', title: 'Toggle Check Two', state: 'unread', meta: {} }
      ];
      window.Notifier.replace(seed);
      const current = window.Notifier.list({ includeArchived: true }) || [];
      return current.map(item => item && item.id ? String(item.id) : '');
    });

    await page.click('#notif-bell');
    await page.waitForSelector('[data-qa="notif-mark-all-read"]', { timeout: 5000 });
    const toggleSelector = '[data-qa="notif-mark-all-read"]';
    await page.click(toggleSelector);
    await page.click(toggleSelector);
    await page.click(toggleSelector);

    await page.waitForFunction(() => {
      const list = window.Notifier?.list?.({ includeArchived: true });
      if (!Array.isArray(list) || !list.length) return false;
      return list.every(item => item && item.state === 'read');
    }, { timeout: 5000 });

    const result = await page.evaluate(() => {
      const list = window.Notifier?.list?.({ includeArchived: true }) || [];
      const stored = window.localStorage?.getItem('notifications:queue') || '';
      return {
        count: list.length,
        unread: list.filter(item => item && item.state !== 'read').length,
        order: list.map(item => item && item.id ? String(item.id) : ''),
        stored
      };
    });

    if (result.count !== beforeOrder.length) {
      throw new Error('Notification count changed after toggles');
    }
    if (result.unread !== 0) {
      throw new Error('Unread notifications remain after toggles');
    }
    if (JSON.stringify(result.order) !== JSON.stringify(beforeOrder)) {
      throw new Error('Notification order changed after toggles');
    }

    let parsed = [];
    try {
      parsed = JSON.parse(result.stored || '[]');
    } catch (_) {
      parsed = [];
    }
    if (!Array.isArray(parsed) || parsed.length !== beforeOrder.length) {
      throw new Error('Persisted notification queue malformed after toggles');
    }
    const unreadPersisted = parsed.some(item => item && item.state !== 'read');
    if (unreadPersisted) {
      throw new Error('Persisted queue contains unread entries after toggles');
    }

    console.log('[CHECK] notifications:toggle-3x ok');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (child) {
      try { child.kill('SIGTERM'); }
      catch (_) {}
      try { await once(child, 'exit'); }
      catch (_) {}
    }
  }
}

async function runCommsMissingHandlerCheck() {
  let child;
  let browser;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    await page.evaluate(() => {
      window.__TOAST_LOG__ = [];
      const record = (msg) => {
        if(!Array.isArray(window.__TOAST_LOG__)){
          window.__TOAST_LOG__ = [];
        }
        window.__TOAST_LOG__.push(String(msg ?? ''));
      };
      const patchToastApi = (api) => {
        if(!api || typeof api !== 'object') return;
        for(const key of ['info', 'show', 'success', 'warning']){
          const original = api[key];
          api[key] = function patchedToast(){
            record(arguments[0]);
            if(typeof original === 'function'){
              try{ return original.apply(this, arguments); }
              catch(_err){ }
            }
            return undefined;
          };
        }
      };
      if(!window.Toast){
        window.Toast = {};
      }
      patchToastApi(window.Toast);
      const originalToast = window.toast;
      window.toast = function patchedToast(msg){
        record(msg);
        if(typeof originalToast === 'function'){
          try{ return originalToast.apply(this, arguments); }
          catch(_err){ }
        }
        return undefined;
      };
    });

    const meta = await page.evaluate(async () => {
      try {
        await window.openDB();
        const list = await window.dbGetAll('contacts');
        const first = Array.isArray(list) ? list[0] : null;
        if(!first || !first.id){
          return { error: 'no contact records' };
        }
        await window.renderContactModal(first.id);
        return { id: first.id };
      } catch (err) {
        return { error: err && err.message ? err.message : String(err) };
      }
    });
    if(meta.error){
      throw new Error(`Unable to open contact modal: ${meta.error}`);
    }

    await page.waitForSelector('[data-qa="modal-action-email"]', { timeout: 10000 });
    await page.evaluate(() => {
      if(window.CRM && typeof window.CRM === 'object'){
        try{ delete window.CRM.resolveEmailHandler; }
        catch(_err){ }
        try{ delete window.CRM.resolveSmsHandler; }
        catch(_err){ }
      }
    });

    await page.click('[data-qa="modal-action-email"]');
    await page.waitForFunction(() => Array.isArray(window.__TOAST_LOG__) && window.__TOAST_LOG__.length >= 1, { timeout: 5000 });

    await page.click('[data-qa="modal-action-sms"]');
    await page.waitForFunction(() => Array.isArray(window.__TOAST_LOG__) && window.__TOAST_LOG__.length >= 2, { timeout: 5000 });

    const messages = await page.evaluate(() => Array.isArray(window.__TOAST_LOG__) ? window.__TOAST_LOG__.slice() : []);
    if(messages.length < 2){
      throw new Error('Toast log did not capture both messages');
    }
    const emailMessage = messages[0] || '';
    const smsMessage = messages[1] || '';
    const actionableRe = /Settings\s*→\s*Integrations/;
    if(!/Email/i.test(emailMessage) || !actionableRe.test(emailMessage)){
      throw new Error(`Email toast not actionable: ${emailMessage}`);
    }
    if(!/SMS/i.test(smsMessage) || !actionableRe.test(smsMessage)){
      throw new Error(`SMS toast not actionable: ${smsMessage}`);
    }

    console.log('[CHECK] comms:missing-handler ok');
  } finally {
    if(browser){
      await browser.close().catch(() => {});
    }
    if(child){
      try { child.kill('SIGTERM'); }
      catch(_err){ }
      try { await once(child, 'exit'); }
      catch(_err){ }
    }
  }
}

async function runPartnersReferralSortCheck() {
  let child;
  let browser;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    await page.evaluate(async () => {
      if (typeof window.openDB !== 'function') {
        throw new Error('openDB not available');
      }
      await window.openDB();
      if (typeof window.dbClear === 'function') {
        await window.dbClear('partners');
        await window.dbClear('contacts');
      }
      const partners = [
        { id: 'p-alpha', name: 'Alpha Realty', company: 'Alpha Co', email: 'alpha@example.com', phone: '555-1001', tier: 'Core' },
        { id: 'p-beta', name: 'Beta Homes', company: 'Beta Collective', email: 'beta@example.com', phone: '555-1002', tier: 'Preferred' },
        { id: 'p-gamma', name: 'Gamma Group', company: 'Gamma Group', email: 'gamma@example.com', phone: '555-1003', tier: 'Developing' }
      ];
      for (const partner of partners) {
        if (typeof window.dbPut === 'function') {
          await window.dbPut('partners', partner);
        }
      }
      const contacts = [
        { id: 'c-1', first: 'Avery', last: 'Funded', stage: 'Funded', status: 'client', loanAmount: 510000, buyerPartnerId: 'p-alpha' },
        { id: 'c-2', first: 'Bailey', last: 'Active', stage: 'Processing', status: 'inprogress', loanAmount: 260000, buyerPartnerId: 'p-alpha' },
        { id: 'c-3', first: 'Cameron', last: 'Funded', stage: 'Funded', status: 'client', loanAmount: 330000, buyerPartnerId: 'p-beta' },
        { id: 'c-4', first: 'Dakota', last: 'Lost', stage: 'Lost', status: 'lost', loanAmount: 190000, buyerPartnerId: 'p-beta' },
        { id: 'c-5', first: 'Emerson', last: 'Prospect', stage: 'Processing', status: 'inprogress', loanAmount: 420000, buyerPartnerId: 'p-gamma' }
      ];
      for (const contact of contacts) {
        if (typeof window.dbPut === 'function') {
          await window.dbPut('contacts', contact);
        }
      }
      if (typeof window.renderPartners === 'function') {
        await window.renderPartners();
      }
    });

    const partnersUrl = new URL('#/partners', origin).toString();
    await page.goto(partnersUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });
    await page.waitForSelector('#tbl-partners tbody tr[data-partner-id]', { timeout: 5000 });

    const rowCount = await page.$$eval('#tbl-partners tbody tr[data-partner-id]', (rows) => rows.length);
    if (rowCount < 3) {
      throw new Error('partners table did not render seeded rows');
    }

    await page.click('#tbl-partners thead button[data-key="volume"]');

    await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll('#tbl-partners tbody tr[data-partner-id]'));
      if (rows.length < 2) return false;
      const first = Number(rows[0].dataset.volume || 0);
      const second = Number(rows[1].dataset.volume || 0);
      return first >= second;
    }, { timeout: 5000 });

    const audit = await page.$$eval('#tbl-partners tbody tr[data-partner-id]', (rows) => rows.map((row) => ({
      name: row.querySelector('[data-column="name"] .name-text')?.textContent?.trim() || '',
      volume: Number(row.dataset.volume || 0),
      volumeText: row.querySelector('[data-column="volume"]')?.textContent?.trim() || '',
      conversionText: row.querySelector('[data-column="conversion"]')?.textContent?.trim() || ''
    })));

    if (!audit.length) {
      throw new Error('no rows available for audit');
    }

    const firstVolume = audit[0].volume;
    const lastVolume = audit[audit.length - 1].volume;
    if (firstVolume < lastVolume) {
      throw new Error('volume sort did not produce descending order');
    }

    const hasCurrency = audit.some((entry) => entry.volume > 0 && /^\$[0-9,.]+$/.test(entry.volumeText));
    if (!hasCurrency) {
      throw new Error('volume column missing currency formatting');
    }

    const hasPercent = audit.some((entry) => entry.volume > 0 && /%$/.test(entry.conversionText));
    if (!hasPercent) {
      throw new Error('conversion column missing percent formatting');
    }

    console.log('[CHECK] partners:referral-sort ok');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (child) {
      try { child.kill('SIGTERM'); }
      catch (_) {}
      try { await once(child, 'exit'); }
      catch (_) {}
    }
  }
}

async function runCalendarDndCheck() {
  const vitestPath = path.join(process.cwd(), 'node_modules', 'vitest', 'vitest.mjs');
  const child = spawn(process.execPath, [vitestPath, 'run', 'tests/unit/calendar_dnd.spec.ts'], {
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'test' },
    stdio: 'inherit'
  });
  const [code, signal] = await once(child, 'exit');
  if(code !== 0){
    const reason = signal ? `signal=${signal}` : `code=${code}`;
    throw new Error(`calendar:dnd check failed (${reason})`);
  }
  console.log('[CHECK] calendar:dnd ok');
}

async function runPipelineStatusMilestoneCheck() {
  const moduleUrl = new URL('../crm-app/js/pipeline/constants.js', import.meta.url);
  const constants = await import(moduleUrl.href);
  const statuses = Array.isArray(constants.PIPELINE_STATUS_KEYS) ? constants.PIPELINE_STATUS_KEYS : [];
  const milestones = Array.isArray(constants.PIPELINE_MILESTONES) ? constants.PIPELINE_MILESTONES : [];
  if(!statuses.length || !milestones.length){
    throw new Error('pipeline constants unavailable');
  }
  const errors = [];
  for(const status of statuses){
    const range = constants.milestoneRangeForStatus(status);
    const min = Number.isFinite(range?.min) ? range.min : 0;
    const max = Number.isFinite(range?.max) ? range.max : milestones.length - 1;
    const belowIndex = Math.max(0, min - 1);
    const aboveIndex = Math.min(milestones.length - 1, max + 1);
    const samples = [
      { label: milestones[belowIndex], guard: (idx) => idx >= min },
      { label: milestones[aboveIndex], guard: (idx) => idx <= max },
      { label: 'Not a real milestone', guard: (idx) => idx >= min && idx <= max }
    ];
    for(const sample of samples){
      if(!sample.label) continue;
      const normalized = constants.normalizeMilestoneForStatus(sample.label, status);
      const idx = typeof constants.milestoneIndex === 'function'
        ? constants.milestoneIndex(normalized)
        : milestones.indexOf(normalized);
      if(idx < 0 || !sample.guard(idx)){
        errors.push(`status ${status} normalized ${JSON.stringify(sample.label)} to out-of-range milestone ${normalized}`);
      }
    }
  }
  if(errors.length){
    throw new Error(`[pipeline:status-milestone] ${errors.join('; ')}`);
  }
  console.log('[CHECK] pipeline:status-milestone ok');
}

const CHECKS = {
  'feature:avatar-persist': runDefaultFeatureCheck,
  'dashboard:persistence-reset': runDashboardPersistenceResetCheck,
  'notifications:toggle-3x': runNotificationsToggleCheck,
  'comms:missing-handler': runCommsMissingHandlerCheck,
  'partners:referral-sort': runPartnersReferralSortCheck,
  'calendar:dnd': runCalendarDndCheck,
  'pipeline:status-milestone': runPipelineStatusMilestoneCheck
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
