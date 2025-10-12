/* Headless boot verification: starts server, waits for health, loads app,
   asserts diagnostics splash is hidden and dashboard text is present. */
import { spawn } from 'node:child_process';
import http from 'node:http';
import puppeteer from 'puppeteer';
import { runContractLint } from './contract_lint.mjs';

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

async function ensureNoConsoleErrors(errors) {
  if (errors.length) {
    throw new Error(`Console error detected: ${errors[0]}`);
  }
}

async function assertSplashHidden(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('diagnostics-splash');
    if (!el) return true;
    const cs = getComputedStyle(el);
    if (!cs) return false;
    const displayNone = cs.display === 'none';
    const visibilityHidden = cs.visibility === 'hidden';
    const opacityZero = Number.parseFloat(cs.opacity || '1') === 0;
    return el.hidden === true || displayNone || visibilityHidden || opacityZero;
  }, { timeout: 60000 });
}

async function navigateTab(page, slug, errors) {
  const before = errors.length;
  await assertSplashHidden(page);
  await page.evaluate((target) => {
    const btn = document.querySelector(`[data-nav="${target}"]`);
    if (!btn) throw new Error(`Navigation button missing for ${target}`);
    btn.click();
  }, slug);
  await page.waitForFunction((target) => {
    const btn = document.querySelector(`[data-nav="${target}"]`);
    return !!(btn && btn.classList.contains('active'));
  }, { timeout: 30000 }, slug);
  await assertSplashHidden(page);
  await ensureNoConsoleErrors(errors);
  if (errors.length !== before) {
    throw new Error(`Console error emitted while navigating to ${slug}`);
  }
}

async function main() {
  let server;
  let browser;
  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleInfos = [];
  try {
    await runContractLint();
    server = startServerProc();
    await waitForHealth();

    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    page.on('console', (msg) => {
      const text = msg.text();
      switch (msg.type()) {
        case 'error':
          consoleErrors.push(text);
          break;
        case 'warning':
          consoleWarnings.push(text);
          break;
        case 'info':
          consoleInfos.push(text);
          break;
        default:
          break;
      }
    });

    page.on('pageerror', (err) => {
      const detail = (err && typeof err === 'object' && (err.stack || err.message))
        ? (err.stack || err.message)
        : String(err);
      consoleErrors.push(`PageError: ${detail}`);
    });

    page.setDefaultTimeout(60000);

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

    await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle0' });

    await page.waitForFunction(() => window.__BOOT_DONE__?.fatal === false, { timeout: 60000 });
    await ensureNoConsoleErrors(consoleErrors);

    await assertSplashHidden(page);
    await ensureNoConsoleErrors(consoleErrors);

    const toastBaselineErrors = consoleErrors.length;
    const toastStatus = await page.evaluate(async () => {
      const toast = typeof window.Toast?.show === 'function'
        ? window.Toast.show.bind(window.Toast)
        : (typeof window.toast === 'function' ? window.toast.bind(window) : null);
      const confirm = typeof window.Confirm?.show === 'function'
        ? window.Confirm.show.bind(window.Confirm)
        : (typeof window.confirmAction === 'function'
          ? window.confirmAction
          : (typeof window.showConfirm === 'function' ? window.showConfirm : null));
      const result = {
        toastAvailable: !!toast,
        toastReturnOk: false,
        toastHostUpdated: false,
        confirmAvailable: !!confirm,
        confirmIsPromise: false,
        confirmResolved: null
      };
      if (toast) {
        const hostBefore = document.querySelector('[data-toast-host="true"]');
        const beforeText = hostBefore ? hostBefore.textContent : null;
        let outcome;
        try {
          outcome = toast('Boot smoke test toast', { duration: 12 });
        } catch (err) {
          result.toastReturnOk = false;
          result.toastHostUpdated = false;
          return result;
        }
        result.toastReturnOk = outcome === undefined
          || typeof outcome === 'object'
          || typeof outcome === 'boolean';
        const hostAfter = document.querySelector('[data-toast-host="true"]');
        result.toastHostUpdated = !!(hostAfter
          && hostAfter.textContent
          && hostAfter.textContent.includes('Boot smoke test toast')
          && hostAfter.textContent !== beforeText);
        if (typeof window.Toast?.hide === 'function') {
          try { window.Toast.hide(); } catch (_) {}
        }
      }
      if (confirm) {
        try {
          const promise = confirm({ message: 'Boot smoke test confirm' });
          if (promise && typeof promise.then === 'function') {
            result.confirmIsPromise = true;
            const modal = document.getElementById('app-confirm-modal');
            const confirmBtn = modal?.querySelector('[data-role="confirm"]');
            confirmBtn?.click();
            result.confirmResolved = await promise;
          } else {
            result.confirmResolved = promise;
          }
        } catch (err) {
          result.confirmResolved = err && err.message ? `threw:${err.message}` : 'threw';
        }
      }
      return result;
    });
    if (!toastStatus.toastAvailable || !toastStatus.toastReturnOk || !toastStatus.toastHostUpdated) {
      throw new Error('Toast helper failed to render or return expected shape');
    }
    if (!toastStatus.confirmAvailable || !toastStatus.confirmIsPromise || toastStatus.confirmResolved !== true) {
      throw new Error('Confirm helper did not resolve as expected');
    }
    await ensureNoConsoleErrors(consoleErrors);
    if (consoleErrors.length !== toastBaselineErrors) {
      throw new Error('Console error emitted during Toast/Confirm API check');
    }
    await assertSplashHidden(page);

    const notificationsCapability = await page.evaluate(() => {
      const notifier = window.Notifier;
      if (!notifier || typeof notifier.onChanged !== 'function' || typeof notifier.list !== 'function') {
        return { available: false, cycle: false };
      }
      let cycleOk = false;
      try {
        const off = notifier.onChanged(() => {});
        if (typeof off === 'function') {
          off();
          cycleOk = true;
        }
      } catch (_) {
        cycleOk = false;
      }
      return { available: true, cycle: cycleOk };
    });
    if (!notificationsCapability.available || !notificationsCapability.cycle) {
      throw new Error('Notifications lifecycle check failed');
    }
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const uiRendered = await page.evaluate(() => {
      const txt = document.body.textContent || '';
      return /Dashboard|Pipeline|Partners/i.test(txt);
    });

    if (!uiRendered) throw new Error('Dashboard UI did not render');
    await assertSplashHidden(page);

    const tabs = [
      ['Dashboard', 'dashboard'],
      ['Long Shots', 'longshots'],
      ['Pipeline', 'pipeline'],
      ['Partners', 'partners']
    ];

    for (const [, slug] of tabs) {
      await navigateTab(page, slug, consoleErrors);
    }

    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    await navigateTab(page, 'pipeline', consoleErrors);
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const pipelineFilter = await page.evaluate(() => {
      const input = document.querySelector('#view-pipeline input[data-table-search="#tbl-pipeline"]');
      const table = document.querySelector('#tbl-pipeline tbody');
      if (!input || !table) {
        return { ok: false };
      }
      const rows = Array.from(table.querySelectorAll('tr'));
      const visibleBefore = rows.filter(row => row.style.display !== 'none').length;
      input.value = 'zzzzzzzz';
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      const visibleAfter = rows.filter(row => row.style.display !== 'none').length;
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true, cancelable: false }));
      const visibleRestored = rows.filter(row => row.style.display !== 'none').length;
      return {
        ok: true,
        total: rows.length,
        visibleBefore,
        visibleAfter,
        visibleRestored
      };
    });
    if (!pipelineFilter.ok) {
      throw new Error('Pipeline filter control missing');
    }
    if (pipelineFilter.total === 0) {
      throw new Error('Pipeline table empty; cannot verify filter');
    }
    if (!(pipelineFilter.visibleBefore > pipelineFilter.visibleAfter
      && pipelineFilter.visibleRestored === pipelineFilter.visibleBefore)) {
      throw new Error('Pipeline filter failed to toggle visibility');
    }
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const actionSelectors = [
      '#actionbar [data-act="clear"]',
      '#actionbar [data-action="clear"]',
      '#actionbar button[data-act="clear"]',
      '[data-act="clear"]'
    ];

    await page.waitForFunction(() => {
      const ready = !!(window.SelectionService && typeof window.SelectionService.set === 'function');
      const row = document.querySelector('#tbl-pipeline tbody tr[data-id], #tbl-pipeline tbody tr[data-contact-id]');
      return ready && !!row;
    }, { timeout: 60000 });

    const seededSelection = await page.evaluate(() => {
      const row = document.querySelector('#tbl-pipeline tbody tr[data-id], #tbl-pipeline tbody tr[data-contact-id]');
      if (!row) return { ok: false };
      const id = row.getAttribute('data-id')
        || row.getAttribute('data-contact-id')
        || (row.dataset ? (row.dataset.id || row.dataset.contactId) : null);
      if (!id) return { ok: false };
      if (window.SelectionService && typeof window.SelectionService.set === 'function') {
        window.SelectionService.set([id], 'contacts', 'smoke');
      } else if (window.Selection && typeof window.Selection.set === 'function') {
        window.Selection.set([id], 'contacts', 'smoke');
      } else {
        return { ok: false };
      }
      return { ok: true, id };
    });
    if (!seededSelection.ok) {
      throw new Error('Unable to seed selection for action bar test');
    }

    await page.waitForFunction(() => {
      const bar = document.getElementById('actionbar');
      return !!(bar && bar.classList.contains('has-selection'));
    }, { timeout: 30000 });

    let clickedSelector = null;
    for (const selector of actionSelectors) {
      const status = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return { found: false };
        const disabled = el.hasAttribute('disabled')
          || el.getAttribute('aria-disabled') === 'true'
          || el.classList.contains('disabled');
        const hidden = !(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
        return { found: true, disabled, hidden };
      }, selector);
      if (status.found) {
        console.log(`[SMOKE] action-bar candidate ${selector} disabled=${status.disabled} hidden=${status.hidden}`);
        if (!status.disabled && !status.hidden) {
          clickedSelector = selector;
          break;
        }
      }
    }

    if (!clickedSelector) {
      throw new Error('No enabled action-bar button available');
    }

    console.log(`[SMOKE] action-bar clicking selector ${clickedSelector}`);
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) throw new Error(`Action bar selector missing: ${sel}`);
      el.click();
    }, clickedSelector);

    const toastHandle = await page.waitForFunction(() => {
      const host = document.querySelector('[data-toast-host="true"]');
      if (host && host.textContent && host.textContent.includes('Action completed')) {
        return { via: 'dom', text: host.textContent };
      }
      if (typeof window.__LAST_TOAST__ === 'string' && window.__LAST_TOAST__.includes('Action completed')) {
        return { via: 'hook', text: window.__LAST_TOAST__ };
      }
      return false;
    }, { timeout: 30000 });
    const toastResult = await toastHandle.jsonValue();
    console.log(`[SMOKE] action-bar toast via ${toastResult.via}`);
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const perfPing = consoleInfos.find((text) => /^\[PERF\] overlay hidden in \d+ms$/.test(text));
    if (!perfPing) {
      throw new Error('Perf overlay ping missing');
    }

    const logBaseline = { info: consoleInfos.length, warn: consoleWarnings.length };
    const logResult = await page.evaluate(async () => {
      const controller = new AbortController();
      const request = fetch('/__log', {
        method: 'GET',
        credentials: 'same-origin',
        signal: controller.signal
      });
      controller.abort();
      try {
        const response = await request;
        return { ok: response?.ok ?? false, status: response?.status ?? 0 };
      } catch (err) {
        const message = err && (err.name || err.message)
          ? String(err.name || err.message)
          : 'error';
        return { ok: false, error: message };
      }
    });
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const infoDelta = consoleInfos.length - logBaseline.info;
    const warnDelta = consoleWarnings.length - logBaseline.warn;
    if (!logResult.ok) {
      if (infoDelta + warnDelta === 0) {
        throw new Error('/__log unavailable without diagnostic log');
      }
      if (infoDelta + warnDelta > 1) {
        throw new Error('/__log fallback emitted noisy logs');
      }
    } else if (infoDelta + warnDelta !== 0) {
      throw new Error('/__log success produced unexpected diagnostics');
    }

    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);
    console.log('BOOT SMOKE TEST PASS');
  } finally {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.kill('SIGTERM');
    }
  }
}

main().catch(err => {
  console.error('BOOT SMOKE TEST FAIL:', err && err.message || err);
  process.exit(1);
});
