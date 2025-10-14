/* Headless boot verification: starts server, waits for health, loads app,
   asserts diagnostics splash is hidden and dashboard text is present. */
import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import http from 'node:http';
import puppeteer from 'puppeteer';
import { runContractLint } from './contract_lint.mjs';

const PORT = process.env.PORT || 8080;
const ORIGIN = `http://127.0.0.1:${PORT}`;

async function clickNth(page, selector, n = 0) {
  const ok = await page.evaluate((sel, idx) => {
    const nodes = Array.from(document.querySelectorAll(sel)).filter(el => el && el.isConnected);
    const el = nodes[idx];
    if (!el) return false;
    el.click();
    return true;
  }, selector, n);
  return ok;
}

async function waitSelCount(page, expected, timeout = 1500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const c = await page.evaluate(() => (window.__SEL_COUNT__|0));
    if (c >= expected) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}
async function waitCapsSelection(page, timeout = 2500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const ready = await page.evaluate(() => {
      const caps = window.__CAPS__;
      if (!caps || typeof caps !== 'object') return false;
      const sel = caps.selection;
      if (!sel || typeof sel !== 'object') return false;
      if (sel.ok === false) return false;
      if (sel.ok === true) return true;
      if (Array.isArray(sel.all)) return true;
      if (typeof sel.count === 'number') return true;
      return false;
    });
    if (ready) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

// Deep, resilient selector: searches top document, shadow DOM, and same-origin iframes; checks real visibility.
async function waitForVisible(page, selector, { timeout = 8000 } = {}) {
  const visibilityCounter = (sel) => {
    const isVisible = (el) => {
      if (!el || !el.isConnected) return false;
      const r = el.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const cs = getComputedStyle(el);
      if (!cs) return false;
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      const opacity = Number.parseFloat(cs.opacity || '1');
      if (Number.isFinite(opacity) && opacity === 0) return false;
      return true;
    };
    const collectDeep = (root, out) => {
      if (!root) return;
      try {
        const list = root.querySelectorAll(sel);
        for (const el of list) out.push(el);
      } catch (_) {}
      const walker = (node) => {
        if (!node) return;
        try {
          if (node.shadowRoot) collectDeep(node.shadowRoot, out);
        } catch (_) {}
        if (!node.children) return;
        for (const child of node.children) walker(child);
      };
      if (root.children) {
        for (const child of root.children) walker(child);
      }
    };
    const uniques = new Set();
    const found = [];
    collectDeep(document, found);
    for (const frame of Array.from(document.querySelectorAll('iframe'))) {
      try {
        const doc = frame.contentDocument;
        if (doc) collectDeep(doc, found);
      } catch (_) {}
    }
    let count = 0;
    for (const el of found) {
      if (uniques.has(el)) continue;
      uniques.add(el);
      if (isVisible(el)) count++;
    }
    return count;
  };

  await page.waitForFunction(visibilityCounter, { timeout }, selector);
  return page.evaluate(visibilityCounter, selector);
}


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

async function ensureNoConsoleErrors(errors, networkErrors = []) {
  if (networkErrors.length) {
    console.error('[SMOKE] 4xx/5xx network failures (first 5):', networkErrors.slice(0,5));
    throw new Error('network-4xx');
  }
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

async function navigateTab(page, slug, errors, networkErrors) {
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
  await ensureNoConsoleErrors(errors, networkErrors);
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
  const WARN_ALLOW = [/^Deprecation:/i, /userAgentData/i];
  let warnCount = 0;
  try {
    await runContractLint();
    server = startServerProc();
    await waitForHealth();

    const networkErrors = [];
    const IGNORE_404 = [/favicon\.ico$/i, /\.map$/i, /\/__log$/i];

    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    page.on('requestfailed', req => {
      try {
        const url = req.url();
        const method = req.method();
        const failure = req.failure() || {};
        const txt = String(failure.errorText || '');
        if ((/404|ERR_FAILED/i.test(txt)) && !IGNORE_404.some(rx => rx.test(url))) {
          networkErrors.push({ kind:'requestfailed', method, url, error: txt });
        }
      } catch {}
    });
    page.on('response', async res => {
      try {
        const status = res.status();
        const url = res.url();
        if (status >= 400 && !IGNORE_404.some(rx => rx.test(url))) {
          networkErrors.push({ kind:'response', status, url });
        }
      } catch {}
    });

    page.on('console', (msg) => {
      const text = msg.text();
      switch (msg.type()) {
        case 'error':
          consoleErrors.push(text);
          break;
        case 'warning':
          try {
            const t = text || '';
            if (!WARN_ALLOW.some(rx => rx.test(t))) warnCount++;
          } catch {}
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

    if (networkErrors.length) {
      console.error('[SMOKE] 4xx/5xx network failures (first 5):', networkErrors.slice(0,5));
      throw new Error('network-4xx');
    }

    await page.waitForFunction(() => window.__BOOT_DONE__?.fatal === false, { timeout: 60000 });
    await ensureNoConsoleErrors(consoleErrors, networkErrors);

    await assertSplashHidden(page);
    await ensureNoConsoleErrors(consoleErrors, networkErrors);

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
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
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
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    const uiRendered = await page.evaluate(() => {
      const txt = document.body.textContent || '';
      return /Dashboard|Pipeline|Partners/i.test(txt);
    });

    if (!uiRendered) throw new Error('Dashboard UI did not render');
    await assertSplashHidden(page);

    const routeNavBaseline = consoleErrors.length;
    const routes = [
      { hash: '#/dashboard', sel: '[data-ui="dashboard-root"]' },
      { hash: '#/long-shots', sel: '[data-ui="longshots-root"]' },
      { hash: '#/pipeline', sel: '.kanban-board, [data-ui="kanban-root"]' },
      { hash: '#/partners', sel: '[data-ui="partners-table"]' }
    ];
    for (const route of routes) {
      await page.evaluate((h) => { location.hash = h; }, route.hash);
      await page.waitForSelector(route.sel, { timeout: 1500 });
      await assertSplashHidden(page);
      await ensureNoConsoleErrors(consoleErrors, networkErrors);
    }
    if (consoleErrors.length !== routeNavBaseline) {
      throw new Error('Console error emitted during hash navigation sequence');
    }

    const tabs = [
      ['Dashboard', 'dashboard'],
      ['Long Shots', 'longshots'],
      ['Pipeline', 'pipeline'],
      ['Partners', 'partners']
    ];

    for (const [, slug] of tabs) {
      await navigateTab(page, slug, consoleErrors, networkErrors);
    }

    await navigateTab(page, 'calendar', consoleErrors, networkErrors);
    const icsButtons = await page.$$('[data-ui="calendar-export-ics"]');
    if (icsButtons.length !== 1) throw new Error('calendar-ics-multiple');
    const icsBaselineErrors = consoleErrors.length;
    await page.evaluate(() => {
      const btn = document.querySelector('[data-ui="calendar-export-ics"]');
      if (!btn || !btn.isConnected) throw new Error('calendar-ics-missing');
      btn.click();
    });
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    if (consoleErrors.length !== icsBaselineErrors) {
      throw new Error('calendar-ics-console');
    }
    const csvButtonExists = await page.$('[data-ui="calendar-export-csv"]');
    if (csvButtonExists) {
      const csvBaselineErrors = consoleErrors.length;
      await page.evaluate(() => {
        const btn = document.querySelector('[data-ui="calendar-export-csv"]');
        if (btn && btn.isConnected) btn.click();
      });
      await ensureNoConsoleErrors(consoleErrors, networkErrors);
      if (consoleErrors.length !== csvBaselineErrors) {
        throw new Error('calendar-csv-console');
      }
    }

    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    await navigateTab(page, 'pipeline', consoleErrors, networkErrors);
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    const kanbanBaseline = await page.evaluate(() => {
      const state = window.__KANBAN_HANDLERS__;
      if (!state || typeof state !== 'object') return null;
      return {
        added: Number(state.added || 0),
        columns: Number(state.columns || 0)
      };
    });
    if (!kanbanBaseline) {
      throw new Error('kanban-handlers-missing');
    }

    await navigateTab(page, 'dashboard', consoleErrors, networkErrors);
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    await navigateTab(page, 'pipeline', consoleErrors, networkErrors);
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    const kanbanAfter = await page.evaluate(() => {
      const state = window.__KANBAN_HANDLERS__;
      if (!state || typeof state !== 'object') return null;
      return {
        added: Number(state.added || 0),
        columns: Number(state.columns || 0)
      };
    });
    if (!kanbanAfter) {
      throw new Error('kanban-handlers-missing-after');
    }
    if (kanbanAfter.added !== kanbanBaseline.added) {
      throw new Error(`kanban-handlers-changed:${kanbanBaseline.added}->${kanbanAfter.added};cols:${kanbanBaseline.columns}->${kanbanAfter.columns}`);
    }

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
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    if (!await waitCapsSelection(page)) {
      throw new Error('caps-selection-timeout');
    }

    const selectionEnv = await page.evaluate(() => {
      const table = document.querySelector('#tbl-pipeline tbody');
      if (!table) return { ok: false, reason: 'no-table' };
      const checks = Array.from(table.querySelectorAll('[data-ui="row-check"]'));
      if (checks.length < 2) return { ok: false, reason: 'insufficient-checks', total: checks.length };
      const count = typeof window.SelectionService?.count === 'function'
        ? window.SelectionService.count()
        : null;
      return { ok: true, count, checks: checks.length };
    });
    if (!selectionEnv.ok) {
      throw new Error(`select-failed:${selectionEnv.reason}`);
    }
    await page.evaluate(() => {
      const next = typeof window.SelectionService?.count === 'function'
        ? window.SelectionService.count()
        : 0;
      window.__SEL_COUNT__ = next | 0;
    });
    if (!await clickNth(page, '#tbl-pipeline [data-ui="row-check"]', 0)) throw new Error('sel-click-0');
    if (!await waitSelCount(page, 1)) throw new Error('sel-count-timeout-1');
    if (!await clickNth(page, '#tbl-pipeline [data-ui="row-check"]', 1)) throw new Error('sel-click-1');
    if (!await waitSelCount(page, 2)) throw new Error('sel-count-timeout-2');

    await page.waitForSelector('[data-ui="action-bar"][data-visible="1"]', { timeout: 5000 });

    const ACTION_BTN_SELECTORS = [
      '[data-ui="action-bar"] [data-action="tag"]',
      '[data-ui="action-bar"] [data-action="noop"]',
      '[data-ui="action-bar"] [data-action]:not([data-action="merge"])',
      '[data-ui="action-bar"] [data-act="bulkLog"]',
      '[data-ui="action-bar"] [data-act="clear"]'
    ];
    let clickedSelector = null;
    for (const sel of ACTION_BTN_SELECTORS) {
      const didClick = await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (!el || !el.isConnected) return false;
        el.click();
        return true;
      }, sel);
      if (didClick) {
        clickedSelector = sel;
        break;
      }
    }
    console.log('smoke:action-selector', clickedSelector || 'none');
    if (!clickedSelector) {
      throw new Error('action-btn-missing');
    }

    const actionVisibleCount = await waitForVisible(page, clickedSelector, { timeout: 8000 });
    assert.ok(actionVisibleCount > 0, 'expected at least one visible non-merge action in the action bar');

    const sawToast = await page.evaluate(async () => {
      const hasDomToast = () => !!(document.querySelector('[data-ui="toast"], .toast-message'));
      if (hasDomToast()) return true;
      return await new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (!done) { done = true; resolve(v); } };
        const onEvt = (e) => finish(!!(e && e.detail && e.detail.msg));
        window.addEventListener('ui:toast', onEvt, { once: true });
        const iv = setInterval(() => {
          if (typeof window.__LAST_TOAST__ === 'string' && window.__LAST_TOAST__.length) {
            clearInterval(iv);
            finish(true);
          }
        }, 50);
        setTimeout(() => { clearInterval(iv); finish(false); }, 1500);
      });
    });
    if (!sawToast) throw new Error('no-toast');

    await navigateTab(page, 'partners', consoleErrors, networkErrors);
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);

    await page.evaluate(() => { window.__ROUTE__ = 'partners'; });

    const partnerChecks = await page.evaluate(() => {
      const table = document.querySelector('#tbl-partners tbody');
      if (!table) return 0;
      return Array.from(table.querySelectorAll('[data-ui="row-check"]')).length;
    });
    if (partnerChecks < 2) {
      throw new Error('partners-checks-insufficient');
    }

    const partnerSelectionOrder = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('#tbl-partners [data-ui="row-check"]'));
      return nodes.map((node, index) => {
        const id = (node.getAttribute('data-partner-id') || node.getAttribute('data-id') || '').toLowerCase();
        return { index, id };
      }).filter(meta => meta.id && !/none/.test(meta.id)).map(meta => meta.index);
    });
    if (!Array.isArray(partnerSelectionOrder) || partnerSelectionOrder.length < 2) {
      throw new Error('partners-valid-insufficient');
    }

    await page.evaluate(() => {
      if (typeof window.Selection?.clear === 'function') {
        window.Selection.clear('smoke-pre-merge');
      }
      const next = typeof window.SelectionService?.count === 'function'
        ? window.SelectionService.count()
        : 0;
      window.__SEL_COUNT__ = next | 0;
    });
    if (!await clickNth(page, '#tbl-partners [data-ui="row-check"]', partnerSelectionOrder[0])) throw new Error('sel-click-0');
    if (!await waitSelCount(page, 1)) throw new Error('sel-count-timeout-1');
    if (!await clickNth(page, '#tbl-partners [data-ui="row-check"]', partnerSelectionOrder[1])) throw new Error('sel-click-1');
    if (!await waitSelCount(page, 2)) throw new Error('sel-count-timeout-2');

    await page.waitForSelector('[data-ui="action-bar"][data-visible="1"]', { timeout: 5000 });

    const abVisible = await page.$('[data-ui="action-bar"][data-visible="1"]');
    if (!abVisible) throw new Error('action-bar-not-visible');

    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-ui="action-bar"] [data-action="merge"]');
      if (!btn || !btn.isConnected) return false;
      const attr = btn.getAttribute('data-disabled');
      const isDisabledAttr = attr === '1' || attr === 'true';
      return !isDisabledAttr && btn.disabled !== true;
    }, { timeout: 5000 });

    const didClickMerge = await page.evaluate(() => {
      const btn = document.querySelector('[data-ui="action-bar"] [data-action="merge"]');
      if (!btn || !btn.isConnected) return false;
      if (btn.getAttribute('data-disabled') === '1' || btn.getAttribute('data-disabled') === 'true') return false;
      if (btn.disabled === true) return false;
      btn.click();
      return true;
    });
    if (!didClickMerge) throw new Error('merge-disabled');

    await page.waitForSelector('[data-ui="merge-modal"]', { timeout: 5000 });

    const didConfirm = await page.evaluate(() => {
      const c = document.querySelector('[data-ui="merge-confirm"]');
      if (!c || !c.isConnected) return false;
      c.click();
      return true;
    });
    if (!didConfirm) throw new Error('merge-confirm-missing');

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
    await ensureNoConsoleErrors(consoleErrors, networkErrors);
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

    await ensureNoConsoleErrors(consoleErrors, networkErrors);
    await assertSplashHidden(page);
    if (warnCount > 5) {
      console.error('[SMOKE] warn cap exceeded:', warnCount);
      throw new Error('warn-cap');
    }
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
