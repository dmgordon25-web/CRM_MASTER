import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import puppeteer from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const INDEX_FILES = [path.join(REPO_ROOT, 'crm-app', 'index.html')];
const PROOFS_DIR = path.join(REPO_ROOT, 'proofs');

const BOOT_STAMP = '<!-- BOOT_STAMP: crm-app-index -->';
const HELLO_SCRIPT = "<script>try{if(!window.__HELLO_SEEN__){window.__HELLO_SEEN__=true;window.__HELLO_ACK__=!!confirm('Hello, click OK');console.info('[A_BEACON] hello',window.__HELLO_ACK__);}}catch(e){console.info('[A_BEACON] hello failed',e&&e.message);}</script>";
const SPLASH_SNIPPET = '<div id="boot-splash" role="status" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#fff;z-index:99999"><div>Loading CRM…</div></div>';
const RETRY_DELAYS = [0, 2000, 5000, 10000, 15000];
const SERVER_START_RE = /\[SERVER\] listening on (http:\/\/127\.0\.0\.1:(\d+)\/) \(root: ([^)]+)\)/;

function sanitizeExcerpt(html) {
  return html.replace(/\s+/g, ' ').trim();
}

function buildSnippet(html, { expectHello }) {
  const bodyIndex = html.indexOf('<body');
  const stampIndex = html.indexOf('<!-- BOOT_STAMP: crm-app-index -->', bodyIndex === -1 ? 0 : bodyIndex);
  if (stampIndex !== -1) {
    const end = Math.min(html.length, stampIndex + 240);
    return sanitizeExcerpt(html.slice(stampIndex, end));
  }
  if (expectHello) {
    const helloIndex = html.indexOf('Hello, click OK');
    if (helloIndex !== -1) {
      const start = Math.max(0, helloIndex - 60);
      const end = Math.min(html.length, helloIndex + 60);
      return sanitizeExcerpt(html.slice(start, end));
    }
  }
  return sanitizeExcerpt(html);
}

async function ensurePhase1Html() {
  await Promise.all(INDEX_FILES.map(async (filePath) => {
    let html = await fs.readFile(filePath, 'utf8');
    if (!html.includes(BOOT_STAMP)) {
      throw new Error(`Index at ${filePath} missing BOOT_STAMP`);
    }
    if (!html.includes(SPLASH_SNIPPET)) {
      throw new Error(`Index at ${filePath} missing splash snippet`);
    }
    if (html.includes(HELLO_SCRIPT)) {
      return;
    }
    const bodyMatch = html.match(/<body[^>]*>/i);
    if (!bodyMatch || typeof bodyMatch.index !== 'number') {
      throw new Error(`Index at ${filePath} missing <body>`);
    }
    const bodyStart = bodyMatch.index + bodyMatch[0].length;
    const stampIndex = html.indexOf(BOOT_STAMP, bodyStart);
    if (stampIndex === -1) {
      throw new Error(`Index at ${filePath} missing BOOT_STAMP within <body>`);
    }
    const insertPos = stampIndex + BOOT_STAMP.length;
    const before = html.slice(0, insertPos);
    const after = html.slice(insertPos);
    html = `${before}\n ${HELLO_SCRIPT}${after}`;
    await fs.writeFile(filePath, html);
  }));
}

async function ensurePhase2Html() {
  await Promise.all(INDEX_FILES.map(async (filePath) => {
    let html = await fs.readFile(filePath, 'utf8');
    const removal = `\n ${HELLO_SCRIPT}`;
    if (!html.includes(removal)) {
      return;
    }
    while (html.includes(removal)) {
      html = html.replace(removal, '');
    }
    await fs.writeFile(filePath, html);
  }));
}

function startDevServer() {
  const child = spawn(process.execPath, ['tools/dev_server.mjs'], {
    cwd: REPO_ROOT,
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
    const handleStdout = (chunk) => {
      const text = String(chunk);
      buffer += text;
      const match = SERVER_START_RE.exec(text);
      if (match) {
        cleanup();
        resolve({ origin: match[1], port: Number(match[2]), root: match[3], logs: buffer });
      }
    };
    const handleStderr = (chunk) => {
      buffer += String(chunk);
    };
    const handleExit = (code) => {
      cleanup();
      if (code === 3) {
        reject(new Error('Dev server guard blocked startup (index missing BOOT_STAMP).'));
        return;
      }
      reject(new Error(`Dev server exited early (code=${code ?? 'null'}). Output:\n${buffer}`));
    };
    const cleanup = () => {
      child.stdout.off('data', handleStdout);
      child.stderr.off('data', handleStderr);
      child.off('exit', handleExit);
    };
    child.stdout.on('data', handleStdout);
    child.stderr.on('data', handleStderr);
    child.once('exit', handleExit);
  });
}

async function stopDevServer(child) {
  if (!child) return;
  try {
    child.kill('SIGTERM');
  } catch {}
  try {
    await once(child, 'exit');
  } catch {}
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} failed with status ${res.status}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`${url} failed with status ${res.status}`);
  }
  return res.text();
}

async function runBrowserPhase(origin, screenshotName, { expectHello }) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let tmpDir = null;
  let helloDialogSeen = false;
  let unexpectedDialog = null;
  try {
    const page = await browser.newPage();
    page.on('dialog', async (dialog) => {
      try {
        if (expectHello) {
          if (dialog.message().includes('Hello, click OK')) {
            helloDialogSeen = true;
            await dialog.accept();
            return;
          }
          unexpectedDialog = dialog.message();
          await dialog.dismiss();
          return;
        }
        unexpectedDialog = dialog.message();
        await dialog.dismiss();
      } catch (error) {
        unexpectedDialog = error && error.message ? error.message : String(error);
        try { await dialog.dismiss(); } catch {}
      }
    });

    await page.goto(origin, { waitUntil: 'domcontentloaded' });

    if (expectHello) {
      if (!helloDialogSeen) {
        throw new Error('Hello confirm dialog did not appear');
      }
      await page.waitForFunction(() => window.__HELLO_ACK__ === true, { timeout: 5000 });
    } else if (unexpectedDialog) {
      throw new Error(`Unexpected dialog encountered: ${unexpectedDialog}`);
    }

    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    await page.evaluate(() => {
      window.location.hash = '#/settings/profiles';
    });

    await page.waitForSelector('input[type="file"][accept="image/*"]', { timeout: 10000 });
    const input = await page.$('input[type="file"][accept="image/*"]');
    if (!input) {
      throw new Error('Avatar input not found');
    }

    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAusB9Yw7lXkAAAAASUVORK5CYII=', 'base64');
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-avatar-'));
    const filePath = path.join(tmpDir, 'avatar.png');
    await fs.writeFile(filePath, pngBuffer);
    await input.uploadFile(filePath);

    await page.waitForFunction(() => {
      const img = document.querySelector('#lo-profile-chip [data-role="lo-photo"]');
      return !!(img && typeof img.src === 'string' && img.src.startsWith('data:'));
    }, { timeout: 10000 });

    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      const img = document.querySelector('#lo-profile-chip [data-role="lo-photo"]');
      return !!(img && typeof img.src === 'string' && img.src.startsWith('data:'));
    }, { timeout: 10000 });

    await fs.mkdir(PROOFS_DIR, { recursive: true });
    const screenshotPath = path.join(PROOFS_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return { screenshotPath: path.relative(REPO_ROOT, screenshotPath) };
  } finally {
    await browser.close().catch(() => {});
    if (tmpDir) {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}

async function runPhase(label, { expectHello, screenshot }) {
  if (expectHello) {
    await ensurePhase1Html();
  } else {
    await ensurePhase2Html();
  }

  const child = startDevServer();
  try {
    const { origin } = await waitForServer(child);
    const whoamiUrl = new URL('__whoami', origin);
    const rawUrl = new URL('__raw_root', origin);
    const whoami = await fetchJson(whoamiUrl);
    const rawHtml = await fetchText(rawUrl);

    if (!rawHtml.includes('BOOT_STAMP: crm-app-index')) {
      const servedRoot = whoami?.servedRoot ?? '<unknown>';
      const indexPath = whoami?.indexPath ?? '<unknown>';
      const excerpt = sanitizeExcerpt(rawHtml);
      throw new Error(`[${label}] /__raw_root missing BOOT_STAMP servedRoot=${servedRoot} indexPath=${indexPath} excerpt=${excerpt}`);
    }

    if (expectHello && !rawHtml.includes('Hello, click OK')) {
      const servedRoot = whoami?.servedRoot ?? '<unknown>';
      const indexPath = whoami?.indexPath ?? '<unknown>';
      const excerpt = sanitizeExcerpt(rawHtml);
      throw new Error(`[${label}] /__raw_root missing Hello prompt servedRoot=${servedRoot} indexPath=${indexPath} excerpt=${excerpt}`);
    }

    if (!expectHello && rawHtml.includes('Hello, click OK')) {
      throw new Error(`[${label}] Hello prompt still present after cleanup`);
    }

    console.log(`[FEATURE_GATE] ${label} __whoami ${JSON.stringify(whoami)}`);
    console.log(`[FEATURE_GATE] ${label} __raw_root ${buildSnippet(rawHtml, { expectHello })}`);

    const { screenshotPath } = await runBrowserPhase(origin, screenshot, { expectHello });
    return { whoami, rawHtml, screenshotPath };
  } finally {
    await stopDevServer(child);
  }
}

async function main() {
  let lastError = null;
  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    const delayMs = RETRY_DELAYS[attempt];
    if (delayMs) {
      await delay(delayMs);
    }
    try {
      const phase1 = await runPhase('phase1', { expectHello: true, screenshot: 'phase1.png' });
      await ensurePhase2Html();
      const phase2 = await runPhase('phase2', { expectHello: false, screenshot: 'phase2.png' });
      await ensurePhase2Html();
      console.log(`[FEATURE_GATE] phase1=ok phase2=ok screenshots=${phase1.screenshotPath},${phase2.screenshotPath}`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`[FEATURE_GATE] attempt ${attempt + 1} failed: ${error && error.stack ? error.stack : String(error)}`);
      await ensurePhase2Html();
    }
  }
  if (lastError) {
    console.error(lastError && lastError.stack ? lastError.stack : String(lastError));
  }
  console.error('[FEATURE_GATE] phase gate failed');
  process.exitCode = 1;
}

await ensurePhase2Html();
await main();
