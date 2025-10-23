import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
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
      if (code === 3) {
        reject(new Error('Dev server guard blocked startup (index missing BOOT_STAMP).'));
        return;
      }
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

function sanitizeExcerpt(html) {
  return html.replace(/\s+/g, ' ').slice(0, 200).trim();
}

async function runFeatureCheck(origin) {
  const whoamiRes = await fetch(new URL('__whoami', origin));
  if (!whoamiRes.ok) {
    throw new Error(`__whoami request failed with status ${whoamiRes.status}`);
  }
  const whoami = await whoamiRes.json();
  console.log(JSON.stringify(whoami));

  const rawRes = await fetch(new URL('__raw_root', origin));
  if (!rawRes.ok) {
    throw new Error(`__raw_root request failed with status ${rawRes.status}`);
  }
  const rawHtml = await rawRes.text();
  if (!rawHtml.includes('BOOT_STAMP: crm-app-index') || !rawHtml.includes('Hello, click OK')) {
    const excerpt = sanitizeExcerpt(rawHtml);
    const servedRoot = whoami?.servedRoot ?? '<unknown>';
    const indexPath = whoami?.indexPath ?? '<unknown>';
    throw new Error(`Root HTML missing markers (servedRoot=${servedRoot}, indexPath=${indexPath}). Excerpt: ${excerpt}`);
  }

  globalThis.__HELLO_DIALOG__ = false;
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let cleanupTemp = null;
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

    await page.waitForFunction(() => window.__HELLO_ACK__ === true, { timeout: 5000 });

    await page.waitForFunction(() => !!window.__SPLASH_HIDDEN__, { timeout: 15000 });

    await page.evaluate(() => { location.hash = '#/settings/profiles'; });

    await page.waitForSelector('input[type="file"][accept="image/*"]', { timeout: 10000 });
    const input = await page.$('input[type="file"][accept="image/*"]');
    if (!input) {
      throw new Error('Avatar input not found');
    }

    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/wcAAusB9Yw7lXkAAAAASUVORK5CYII=',
      'base64'
    );
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-avatar-'));
    const filePath = path.join(tmpDir, 'avatar.png');
    await fs.writeFile(filePath, pngBuffer);
    cleanupTemp = async () => {
      try {
        await fs.rm(tmpDir, { recursive: true, force: true });
      } catch {}
    };
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

    const screenshotRelative = path.join('proofs', 'feature-proof.png');
    const screenshotAbsolute = path.join(process.cwd(), screenshotRelative);
    await fs.mkdir(path.dirname(screenshotAbsolute), { recursive: true });
    await page.screenshot({ path: screenshotAbsolute, fullPage: true });

    return { whoami, rawHtml, screenshotPath: screenshotRelative };
  } finally {
    await browser.close().catch(() => {});
    if (cleanupTemp) {
      await cleanupTemp();
    }
  }
}

async function main() {
  let child;
  try {
    child = startDevServer();
    const { origin } = await waitForServer(child);
    const { whoami, rawHtml, screenshotPath } = await runFeatureCheck(origin);
    console.log('[FEATURE_CHECK] whoami=ok html=ok hello=ok splash=ok avatarPersist=ok screenshot=' + screenshotPath);
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
