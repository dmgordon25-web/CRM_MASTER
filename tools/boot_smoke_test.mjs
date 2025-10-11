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

    await navigateTab(page, 'partners', consoleErrors);
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    await page.evaluate(() => {
      try {
        if (!window.__MERGE_CALLS__) window.__MERGE_CALLS__ = [];
        if (!window.__MERGE_STUB_ORIGINAL__) {
          window.__MERGE_STUB_ORIGINAL__ = window.openPartnersMergeByIds;
          window.openPartnersMergeByIds = async (a, b) => {
            try { window.__MERGE_CALLS__.push([String(a), String(b)]); }
            catch (_) {}
            try { window.SelectionService?.clear?.('merge:test'); }
            catch (_) {}
            try { window.toast?.('Merge complete'); }
            catch (_) {}
            return { status: 'ok', merged: [String(a), String(b)] };
          };
        }
      } catch (_) {}
      try {
        if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
          const clip = { writeText: async () => true };
          Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => clip });
        }
      } catch (_) {
        try { window.navigator.clipboard = { writeText: async () => true }; }
        catch (__err) {}
      }
    });

    const selectionCheck = await page.evaluate(() => new Promise((resolve) => {
      const svc = window.SelectionService;
      const table = document.querySelector('#tbl-partners tbody');
      const rows = table ? Array.from(table.querySelectorAll('tr')) : [];
      const checkboxes = rows.map(row => row.querySelector('input[type="checkbox"],input[data-role="select"]')).filter(Boolean);
      if (!svc || typeof svc.clear !== 'function') { resolve({ ok: false, reason: 'service-missing' }); return; }
      if (checkboxes.length < 2) { resolve({ ok: false, reason: 'insufficient-rows' }); return; }
      try { svc.clear('smoke'); }
      catch (_) {}
      checkboxes.slice(0, 2).forEach(cb => { if (!cb.disabled) cb.click(); });
      requestAnimationFrame(() => {
        const selectedRows = rows.slice(0, 2).map(row => ({
          id: row.getAttribute('data-partner-id') || row.getAttribute('data-id') || '',
          selected: row.classList.contains('selected')
            || row.classList.contains('is-selected')
            || row.getAttribute('data-selected') === 'true'
            || row.getAttribute('aria-selected') === 'true'
        }));
        const bar = document.getElementById('actionbar');
        const style = bar ? getComputedStyle(bar) : null;
        const barVisible = !!(bar && style && style.display !== 'none' && bar.classList.contains('has-selection'));
        const mergeBtn = document.querySelector('#actionbar [data-act="merge"]');
        const count = window.__SEL_COUNT__ != null
          ? Number(window.__SEL_COUNT__)
          : (typeof svc.count === 'function' ? Number(svc.count()) : 0);
        let ids = Array.isArray(window.__SEL_KEYS__) ? window.__SEL_KEYS__ : [];
        if (!Array.isArray(ids) && typeof svc.getIds === 'function') {
          try { ids = Array.from(svc.getIds() || []); }
          catch (_) { ids = []; }
        }
        resolve({
          ok: true,
          count,
          idsLength: Array.isArray(ids) ? ids.length : 0,
          selectedRows,
          barVisible,
          mergeEnabled: mergeBtn ? mergeBtn.disabled === false : null
        });
      });
    }));
    if (!selectionCheck.ok) {
      throw new Error(`Selection smoke failed: ${selectionCheck.reason || 'unknown'}`);
    }
    if (selectionCheck.count < 2 || selectionCheck.idsLength < 2) {
      throw new Error('Selection service did not report two selected rows');
    }
    if (selectionCheck.selectedRows.some(row => !row.selected)) {
      throw new Error('Selected rows missing DOM state');
    }
    if (!selectionCheck.barVisible) {
      throw new Error('Action bar did not become visible for multi-select');
    }
    if (selectionCheck.mergeEnabled !== true) {
      throw new Error('Merge action not enabled for two selections');
    }

    const actionCheck = await page.evaluate(() => new Promise((resolve) => {
      const btn = document.querySelector('#actionbar [data-act="emailMass"]')
        || document.querySelector('#actionbar [data-act="emailTogether"]');
      if (!btn) { resolve({ ok: false, reason: 'action-missing' }); return; }
      const host = document.querySelector('[data-toast-host="true"]');
      const before = host ? host.textContent || '' : '';
      btn.click();
      requestAnimationFrame(() => {
        const afterHost = document.querySelector('[data-toast-host="true"]');
        const after = afterHost ? afterHost.textContent || '' : '';
        resolve({ ok: true, toastChanged: !!after && after !== before, count: window.__SEL_COUNT__ || 0 });
      });
    }));
    if (!actionCheck.ok) {
      throw new Error(`Action bar smoke failed: ${actionCheck.reason || 'unknown'}`);
    }
    if (!actionCheck.toastChanged) {
      throw new Error('Action bar command did not surface a toast/info message');
    }
    if (actionCheck.count < 2) {
      throw new Error('Selection unexpectedly cleared during action execution');
    }

    const mergeCheck = await page.evaluate(() => new Promise((resolve) => {
      const btn = document.querySelector('#actionbar [data-act="merge"]');
      if (!btn) { resolve({ ok: false, reason: 'merge-missing' }); return; }
      btn.click();
      requestAnimationFrame(() => {
        const remaining = window.__SEL_COUNT__ != null ? Number(window.__SEL_COUNT__) : 0;
        const calls = Array.isArray(window.__MERGE_CALLS__) ? window.__MERGE_CALLS__.length : 0;
        resolve({ ok: true, remaining, calls });
      });
    }));
    if (!mergeCheck.ok) {
      throw new Error(`Merge smoke failed: ${mergeCheck.reason || 'unknown'}`);
    }
    if (mergeCheck.calls < 1) {
      throw new Error('Merge orchestrator did not receive invocation');
    }
    if (mergeCheck.remaining !== 0) {
      throw new Error('Selection not cleared after merge confirmation');
    }

    await page.evaluate(() => {
      try {
        if (window.__MERGE_STUB_ORIGINAL__) {
          window.openPartnersMergeByIds = window.__MERGE_STUB_ORIGINAL__;
          delete window.__MERGE_STUB_ORIGINAL__;
        }
      } catch (_) {}
    });

    const kanbanBefore = await page.evaluate(() => {
      const metrics = window.__KANBAN_HANDLERS__;
      if (!metrics) return null;
      return { attach: Number(metrics.attach || 0), detach: Number(metrics.detach || 0) };
    });

    await navigateTab(page, 'dashboard', consoleErrors);
    await navigateTab(page, 'pipeline', consoleErrors);
    await navigateTab(page, 'dashboard', consoleErrors);
    await navigateTab(page, 'pipeline', consoleErrors);

    const kanbanAfter = await page.evaluate(() => {
      const metrics = window.__KANBAN_HANDLERS__;
      if (!metrics) return null;
      return { attach: Number(metrics.attach || 0), detach: Number(metrics.detach || 0) };
    });
    if (!kanbanBefore || !kanbanAfter) {
      throw new Error('Kanban handler metrics unavailable');
    }
    if (kanbanBefore.attach !== kanbanAfter.attach || kanbanBefore.detach !== kanbanAfter.detach) {
      throw new Error('Kanban handler counts changed during navigation');
    }
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    await navigateTab(page, 'calendar', consoleErrors);
    await ensureNoConsoleErrors(consoleErrors);
    await assertSplashHidden(page);

    const calendarCheck = await page.evaluate(async () => {
      const view = document.getElementById('view-calendar') || document.querySelector('[data-view="calendar"]');
      if (!view) return { ok: false, reason: 'view-missing' };
      const icsButtons = Array.from(view.querySelectorAll('#cal-export-ics,[data-act="calendar:export:ics"],[data-ics-export]'));
      const csvBtn = view.querySelector('#cal-export,[data-act="calendar:export:csv"]');
      const exportsApi = window.CalendarExports || {};
      const csvCallable = typeof exportsApi.exportVisibleCsv === 'function';
      const icsCallable = typeof exportsApi.exportVisibleIcs === 'function';
      let csvDetail = null;
      let icsDetail = null;
      if (csvCallable) {
        try { csvDetail = await exportsApi.exportVisibleCsv(); }
        catch (_) { csvDetail = null; }
      }
      if (icsCallable) {
        try { icsDetail = await exportsApi.exportVisibleIcs(); }
        catch (_) { icsDetail = null; }
      }
      return {
        ok: true,
        icsButtonCount: icsButtons.length,
        icsDataset: icsButtons[0]?.dataset.act || '',
        csvButtonPresent: !!csvBtn,
        csvHeaders: csvDetail?.headers?.length || 0,
        csvRows: csvDetail?.rows?.length || 0,
        icsCount: icsDetail?.count ?? window.__CALENDAR_LAST_ICS__?.count ?? null
      };
    });
    if (!calendarCheck.ok) {
      throw new Error(`Calendar export smoke failed: ${calendarCheck.reason || 'unknown'}`);
    }
    if (calendarCheck.icsButtonCount !== 1) {
      throw new Error(`Expected one ICS export control, found ${calendarCheck.icsButtonCount}`);
    }
    if (calendarCheck.icsDataset !== 'calendar:export:ics') {
      throw new Error('ICS export control missing canonical data-act');
    }
    if (!calendarCheck.csvButtonPresent) {
      throw new Error('Calendar CSV export control missing');
    }
    if (calendarCheck.csvHeaders < 1) {
      throw new Error('Calendar CSV export returned no headers');
    }
    if (calendarCheck.icsCount == null) {
      throw new Error('Calendar ICS export did not report a result');
    }

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
