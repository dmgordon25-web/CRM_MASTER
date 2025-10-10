/* Headless boot verification: starts server, waits for health, loads app,
   asserts diagnostics splash is hidden and dashboard text is present. */
import { spawn } from 'node:child_process';
import http from 'node:http';
import puppeteer from 'puppeteer';

const PORT = process.env.PORT || 8080;
const ORIGIN = `http://127.0.0.1:${PORT}`;

function waitForHealth(timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`${ORIGIN}/health`, res => {
        if (res.statusCode === 200) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error('health timeout'));
        setTimeout(tick, 200);
      }).on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('health error'));
        setTimeout(tick, 200);
      });
    };
    tick();
  });
}

function startServerProc() {
  const ps = spawn(process.execPath, ['tools/node_static_server.js', 'crm-app'], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  ps.stdout.on('data', d => process.stdout.write(String(d)));
  ps.stderr.on('data', d => process.stderr.write(String(d)));
  return ps;
}

async function main() {
  const server = startServerProc();
  try {
    await waitForHealth();

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.evaluateOnNewDocument(() => {
      if (!window.Confirm) {
        window.Confirm = {
          show: (...args) => {
            if (typeof window.confirmAction === 'function') {
              return window.confirmAction(...args);
            }
            if (typeof window.showConfirm === 'function') {
              return window.showConfirm(...args);
            }
            return Promise.resolve(true);
          }
        };
      }
    });

    // Use safe mode for deterministic boot (patches skipped on purpose)
    await page.goto(`${ORIGIN}/?safe=1`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => typeof window.__BOOT_DONE__ === 'object' && window.__BOOT_DONE__ !== null, { timeout: 60000 });

    const bootState = await page.evaluate(() => window.__BOOT_DONE__ || null);
    if (bootState && bootState.fatal) {
      throw new Error(`Boot marked fatal in __BOOT_DONE__: ${bootState.why || 'unknown'}`);
    }

    await page.waitForFunction(() => {
      const el = document.getElementById('diagnostics-splash');
      if (!el) return true;
      const cs = getComputedStyle(el);
      return cs && cs.display === 'none';
    }, { timeout: 60000 });

    const splashVisible = await page.evaluate(() => {
      const el = document.getElementById('diagnostics-splash');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs && cs.display !== 'none';
    });

    if (splashVisible) throw new Error('Diagnostics splash is visible after boot');

    const uiRendered = await page.evaluate(() => {
      const txt = document.body.textContent || '';
      return /Dashboard|Pipeline|Partners/i.test(txt);
    });

    if (!uiRendered) throw new Error('Dashboard UI did not render');

    console.log('BOOT SMOKE TEST PASS');
    await browser.close();
  } finally {
    // tear down
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('BOOT SMOKE TEST FAIL:', err && err.message || err);
  process.exit(1);
});
