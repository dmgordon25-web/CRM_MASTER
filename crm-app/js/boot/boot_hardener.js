/* eslint-disable no-console */

const baseUrl = new URL('.', import.meta.url);
const toUrl = p => new URL(p, baseUrl).href;

function isSafeMode() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('safe') === '1' || window.localStorage.getItem('SAFE') === '1';
  } catch (_) {
    return false;
  }
}

function listMissingPrereqs(kind = 'strict') {
  const w = window;
  const missing = [];
  if (typeof w.openDB !== 'function') missing.push('openDB');
  if (typeof w.renderAll !== 'function') missing.push('renderAll');
  if (typeof w.$ !== 'function') missing.push('$');
  if (kind === 'strict') {
    if (!(w.Selection || w.SelectionService)) missing.push('Selection/SelectionService');
    if (!(w.Toast && typeof w.Toast.show === 'function')) missing.push('Toast.show');
    if (!(w.Confirm && typeof w.Confirm.show === 'function')) missing.push('Confirm.show');
  }
  return missing;
}

function corePrereqsReady(kind = 'minimal') {
  return listMissingPrereqs(kind).length === 0;
}

function showDiagnostics(reason) {
  try {
    const evt = new CustomEvent('crm:boot:fatal', { detail: { reason } });
    window.dispatchEvent(evt);
  } catch (_) {}
  const splash = document.getElementById('diagnostics-splash');
  if (splash) splash.style.display = 'block';
  try {
    fetch('/__log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        reason,
        logs: Array.isArray(window.__BOOT_LOGS__) ? window.__BOOT_LOGS__ : [],
      }),
      keepalive: true
    }).catch(() => {});
  } catch (_) {}
}

async function importOne(p, out, kind = 'core') {
  if (!p || typeof p !== 'string') return;
  const spec = toUrl(p);
  try {
    await import(spec);
    out.loaded.push(p);
    if (!window.__PATCHES_LOADED__.includes(p)) window.__PATCHES_LOADED__.push(p);
  } catch (err) {
    const msg = String((err && err.stack) || err);
    out.failed.push({ p, err: msg });
    try {
      window.__BOOT_LOGS__ = window.__BOOT_LOGS__ || [];
      window.__BOOT_LOGS__.push({ t: Date.now(), kind: 'import-fail', phase: kind, module: p, error: msg });
    } catch (_) {}
    if (kind === 'patch') {
      try {
        window.__PATCHES_FAILED__ = window.__PATCHES_FAILED__ || [];
        window.__PATCHES_FAILED__.push({ module: p, error: msg });
      } catch (_) {}
    }
  }
}

function normaliseTelemetryArrays() {
  const tl = window.__PATCHES_LOADED__;
  const tf = window.__PATCHES_FAILED__;
  window.__PATCHES_LOADED__ = Array.isArray(tl) ? tl.slice()
    : (tl && typeof tl === 'object' && Array.isArray(tl.ok)) ? tl.ok.slice() : [];
  window.__PATCHES_FAILED__ = Array.isArray(tf) ? tf.slice()
    : (tf && typeof tf === 'object' && Array.isArray(tf.fail)) ? tf.fail.slice() : [];
}

function summarise(out, reason) {
  return {
    loaded: Array.from(new Set(out.loaded)),
    failed: Array.from(new Set(out.failed.map(f => f.p))),
    detail: out,
    reason
  };
}

export async function ensureCoreThenPatches(manifest = {}) {
  if (window.__BOOT_HARDENER_PROMISE__) return window.__BOOT_HARDENER_PROMISE__;
  window.__BOOT_HARDENER_PROMISE__ = (async () => {
    normaliseTelemetryArrays();

    const CORE = Array.isArray(manifest.CORE) ? manifest.CORE : [];
    const PATCHES = Array.isArray(manifest.PATCHES) ? manifest.PATCHES : [];
    const REQUIRED = manifest.REQUIRED instanceof Set ? manifest.REQUIRED : new Set();

    const out = { loaded: [], failed: [] };

    for (const p of CORE) {
      // eslint-disable-next-line no-await-in-loop
      await importOne(p, out, 'core');
    }

    if (!corePrereqsReady('minimal') && CORE.length) {
      console.warn('[boot] core prereqs missing after pass 1; retrying CORE once');
      for (const p of CORE) {
        // eslint-disable-next-line no-await-in-loop
        await importOne(p, out, 'core');
      }
    }

    const missingMinimal = listMissingPrereqs('minimal');
    const prereqsOk = missingMinimal.length === 0;
    const requiredOk = out.failed.every(f => !REQUIRED.has(f.p));
    const fatal = !prereqsOk || !requiredOk;

    if (fatal) {
      const reason = prereqsOk ? 'required-module' : 'core-prereqs';
      const summary = summarise(out, reason);
      window.__BOOT_DONE__ = summary;
      if (!prereqsOk) {
        try {
          window.__BOOT_LOGS__ = window.__BOOT_LOGS__ || [];
          window.__BOOT_LOGS__.push({ t: Date.now(), kind: 'core-prereq-missing', missing: missingMinimal });
        } catch (_) {}
        showDiagnostics('core-prereqs:' + missingMinimal.join(','));
      } else {
        showDiagnostics(reason);
      }
      return summary;
    }

    if (!isSafeMode()) {
      for (const p of PATCHES) {
        // eslint-disable-next-line no-await-in-loop
        await importOne(p, out, 'patch');
      }
    }

    const summary = summarise(out, 'ok');
    window.__BOOT_DONE__ = summary;
    window.__BOOT_HARDENER__ = Object.assign(window.__BOOT_HARDENER__ || {}, { corePrereqsReady });

    if (typeof window.requestAnimationFrame === 'function' && typeof window.renderAll === 'function') {
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.renderAll()));
    } else if (typeof window.renderAll === 'function') {
      window.renderAll();
    }

    if (summary.failed.length) {
      console.warn('[boot] completed with failures:', summary.failed);
    } else {
      console.log('[boot] ok:', summary.loaded.length, 'fail:0');
    }

    return summary;
  })();
  return window.__BOOT_HARDENER_PROMISE__;
}
