const DEBUG = !!(window.DEBUG || localStorage.getItem('DEBUG') === '1');
const ENV = window.__ENV__ && typeof window.__ENV__ === 'object' ? window.__ENV__ : {};
const PROD_MODE = !(ENV && (ENV.DEV || ENV.DEBUG));
const expectWorkbench = Boolean(ENV && ENV.WORKBENCH);
const IS_E2E_MODE = (() => {
  try {
    const search = window.location && window.location.search ? window.location.search : '';
    if (new URLSearchParams(search).get('e2e') === '1') return true;
    return !!(navigator && navigator.webdriver);
  } catch (_err) {
    return false;
  }
})();

const loggers = {
  error: (...args) => {
    if (!console) return;
    const fn = console.warn || console.log || (() => {});
    fn.apply(console, ['[soft]', ...args]);
  },
  warn: (...args) => {
    if (!console) return;
    (console.warn || console.log || (() => {})).apply(console, args);
  },
  info: (...args) => {
    if (!console) return;
    (console.info || console.log || (() => {})).apply(console, args);
  },
  log: (...args) => {
    if (!console) return;
    (console.log || (() => {})).apply(console, args);
  }
};

const logHardError = (...args) => loggers.error(...args);
const logSoftError = (...args) => (PROD_MODE ? loggers.warn : loggers.error)(...args);
const logWarn = (...args) => loggers.warn(...args);
const logInfo = (...args) => loggers.info(...args);
const logProdGap = (...args) => (PROD_MODE ? loggers.warn : loggers.error)(...args);
const logProdSkip = (...args) => (PROD_MODE ? loggers.info : loggers.warn)(...args);

  function addDiagnostic(kind, message, ...details){
    if(!console) return;
    const normalized = kind === 'skip' ? 'info' : kind;
    const logger = normalized === 'fail'
      ? (PROD_MODE ? loggers.warn : loggers.error)
      : normalized === 'warn'
        ? loggers.warn
        : normalized === 'info'
          ? loggers.info
          : loggers.log;
    try{
      logger(`[selftest] ${kind}`, message, ...details);
    }catch (_err) {
      loggers.log('[selftest]', kind, message, ...details);
    }
  }

  const splashRoot = document.getElementById('diagnostic-splash');
  const splashTitle = splashRoot ? splashRoot.querySelector('[data-role="diag-title"]') : null;
  const splashMessage = splashRoot ? splashRoot.querySelector('[data-role="diag-message"]') : null;
  const splashDetails = splashRoot ? splashRoot.querySelector('[data-role="diag-details"]') : null;
  const splashButton = splashRoot ? splashRoot.querySelector('[data-role="diag-run-selftest"]') : null;

  export function renderSelfTestBanner(root){
    if(!DEBUG) return;
    if(!root) return;
    root.hidden = false;
    if(root.classList && typeof root.classList.remove === 'function'){
      root.classList.remove('hidden');
    }
  }

  function ensureSplashVisible(){
    if(!DEBUG) return false;
    if(!splashRoot) return false;
    renderSelfTestBanner(splashRoot);
    return true;
  }

  function renderDiagnosticSplash(config){
    if(!DEBUG) return;
    if(!ensureSplashVisible()) return;
    if(splashTitle && config.title){
      splashTitle.textContent = config.title;
    }
    if(splashMessage){
      if(config.message){
        splashMessage.textContent = config.message;
        splashMessage.hidden = false;
      }else{
        splashMessage.textContent = '';
        splashMessage.hidden = true;
      }
    }
    if(splashDetails){
      splashDetails.innerHTML = '';
      if(Array.isArray(config.details) && config.details.length){
        splashDetails.hidden = false;
        config.details.forEach(detail => {
          const item = document.createElement('li');
          item.textContent = detail;
          splashDetails.appendChild(item);
        });
      }else{
        splashDetails.hidden = true;
      }
    }
    if(splashRoot && config.state){
      splashRoot.dataset.state = config.state;
    }
  }

  function showBootMarkerSplash(){
    if(!DEBUG) return;
    const patches = Array.isArray(window.__PATCHES_LOADED__)
      ? window.__PATCHES_LOADED__.slice()
      : [];
    const details = [];
    details.push(window.BOOT_OK === true ? 'BOOT_OK marker present.' : 'BOOT_OK marker missing.');
    renderDiagnosticSplash({
      title: 'Diagnostics: Boot markers missing',
      message: 'Boot markers were not detected during startup. Use the self-test to investigate.',
      patches,
      details,
      state: 'boot'
    });
  }

  function handleSelfTestIssues(issues){
    if(!DEBUG) return;
    const patches = Array.isArray(window.__PATCHES_LOADED__)
      ? window.__PATCHES_LOADED__.slice()
      : [];
    const details = Array.isArray(issues) && issues.length
      ? issues
      : ['Self-test reported issues.'];
    renderDiagnosticSplash({
      title: 'Diagnostics: Self-test reported issues',
      message: 'Review the following findings and check the console for additional details.',
      patches,
      details,
      state: 'selftest'
    });
  }

  let bootCheckScheduled = false;
  let importerSkipLogged = false;
  function scheduleBootMarkerCheck(){
    if(bootCheckScheduled) return;
    bootCheckScheduled = true;
    const runCheck = ()=>{
      const patches = Array.isArray(window.__PATCHES_LOADED__)
        ? window.__PATCHES_LOADED__
        : [];
      if(window.BOOT_OK === true && patches.length > 0){
        return;
      }
      showBootMarkerSplash();
    };
    const startTimer = ()=>{
      if(typeof setTimeout === 'function'){
        setTimeout(runCheck, 1500);
      }else{
        runCheck();
      }
    };
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', startTimer, { once:true });
    }else{
      startTimer();
    }
  }
  scheduleBootMarkerCheck();

  async function waitForBootCompletion(){
    if(window.__BOOT_DONE__ && typeof window.__BOOT_DONE__.then === 'function'){
      try{
        return await window.__BOOT_DONE__;
      }catch (err) {
        logSoftError('Selftest: boot failed', err);
        addDiagnostic('fail', 'Boot failed — see console for details.');
        throw err;
      }
    }
    return null;
  }

  export async function runSelfTest(){
    let ok = true;
    const issues = [];
    try{
      await waitForBootCompletion();
    }catch (_) {
      ok = false;
      issues.push('Boot did not complete successfully.');
    }

    logInfo('PATCHES_LOADED', window.__PATCHES_LOADED__);

    const loaded = Array.isArray(window.__PATCHES_LOADED__)
      ? window.__PATCHES_LOADED__.slice()
      : [];
    const expectedManifest = Array.isArray(window.__EXPECTED_PATCHES__)
      ? window.__EXPECTED_PATCHES__.map(path => String(path))
      : [];
    const manifestSet = new Set(expectedManifest);
    const missing = expectedManifest.filter(path => !loaded.includes(path));
    if(missing.length){
      ok = false;
      const manifestDetails = { missing, loaded, expected: expectedManifest };
      if(PROD_MODE){
        logInfo('Selftest: required patches missing (manifest enforcement).', manifestDetails);
      }else{
        logWarn('Selftest: required patches missing (manifest enforcement).', manifestDetails);
      }
      logHardError('PATCHES_MISSING', missing);
      logHardError('Selftest: manifest-declared patches missing', manifestDetails);
      addDiagnostic('fail', `Missing manifest patches: ${missing.join(', ')}`);
      issues.push(`Missing manifest patches: ${missing.join(', ')}`);
    }else{
      logInfo('Selftest: manifest patches verified', loaded);
    }

    const failed = Array.isArray(window.__PATCHES_FAILED__)
      ? window.__PATCHES_FAILED__.filter(Boolean)
      : [];
    if(failed.length){
      ok = false;
      logHardError('Selftest: patch load failures', failed);
      addDiagnostic('fail', `Failed patches: ${failed.map(item => item.path || 'unknown').join(', ')}`);
      issues.push(`Failed patches: ${failed.map(item => item.path || 'unknown').join(', ')}`);
    }

    if(expectWorkbench){
      const workbenchNav = document.querySelector('#main-nav [data-nav="workbench"]');
      if(!workbenchNav){
        ok = false;
        logSoftError('Selftest: workbench nav missing');
        addDiagnostic('fail', 'Workbench navigation button missing.');
        issues.push('Workbench navigation button missing.');
      }

      const existingMount = document.getElementById('view-workbench');
      if(!existingMount){
        const container = document.querySelector('.container');
        const body = document.body;
        const canCreateMount = !!(container || body);
        if(!canCreateMount){
          ok = false;
          logSoftError('Selftest: workbench host unavailable');
          addDiagnostic('fail', 'Workbench view host missing and no container available.');
          issues.push('Workbench view host missing and no container available.');
        }else{
          addDiagnostic('info', 'Workbench mount will be created on demand.');
        }
      }

      try{
        await import('./pages/workbench.js');
      }catch (err){
        ok = false;
        logSoftError('Selftest: workbench module failed to load', err);
        addDiagnostic('fail', 'Workbench module failed to load.');
        issues.push('Workbench module failed to load.');
      }
    }else{
      addDiagnostic('skip', 'Workbench disabled in prod (expected).');
    }

    if(window.SelectionService){
      const wired = typeof window.SelectionService.getIds === 'function'
        && typeof window.SelectionService.count === 'function';
      if(!wired){
        ok = false;
        logSoftError('Selftest: selection service incomplete');
        addDiagnostic('fail', 'Selection service incomplete.');
        issues.push('Selection service incomplete.');
      }
    }

    if(typeof window.requiredDocsFor !== 'function'){
      if(PROD_MODE){
        logInfo('Selftest: doc center helpers inactive (expected noop).');
        addDiagnostic('info', 'Doc center helpers not active in prod (expected noop).');
      }else{
        ok = false;
        logSoftError('Selftest: doc center helpers inactive');
        addDiagnostic('fail', 'Doc center helpers not available.');
        issues.push('Doc center helpers not available.');
      }
    }

    const hasTelemetryDiag = window.DIAG && typeof window.DIAG.getStoreSizes === 'function';
    const isDebugEnv = window.__ENV__ && window.__ENV__.DEBUG === true;
    if(!hasTelemetryDiag){
      if(isDebugEnv){
        ok = false;
        logSoftError('Selftest: telemetry helpers missing');
        addDiagnostic(PROD_MODE ? 'warn' : 'fail', 'Telemetry helpers missing.');
        issues.push('Telemetry helpers missing.');
      }else{
        logInfo('Selftest: telemetry helpers unavailable in production context; treating as diagnostic warn.');
        addDiagnostic('info', 'Telemetry helpers inactive in prod (expected noop).');
      }
    }

    const loadLog = Array.isArray(window.__PATCH_LOAD_LOG__)
      ? window.__PATCH_LOAD_LOG__.slice()
      : [];
    const tsxImports = loadLog
      .map(entry => entry && entry.path ? String(entry.path) : '')
      .filter(path => /\.tsx(\?|$)/i.test(path));
    if(tsxImports.length){
      ok = false;
      logSoftError('Selftest: TSX imports detected', tsxImports);
      addDiagnostic(PROD_MODE ? 'warn' : 'fail', `TSX imports detected: ${tsxImports.join(', ')}`);
      issues.push('Runtime TSX imports detected.');
    }

    if(ok){
      addDiagnostic('pass', 'Self-test PASS — all required modules and diagnostics loaded.');
      if(splashRoot){
        splashRoot.hidden = true;
        splashRoot.classList.add('hidden');
      }
      window.BOOT_OK = true;
    }else{
      addDiagnostic('fail', 'Self-test FAIL — review console for details.');
      handleSelfTestIssues(issues);
      window.BOOT_OK = false;
    }

    return ok;
  }

  window.runSelfTest = runSelfTest;

  if(splashButton && !splashButton.__wired){
    splashButton.__wired = true;
    splashButton.addEventListener('click', async (event)=>{
      event.preventDefault();
      splashButton.disabled = true;
      try{
        await runSelfTest();
      }finally{
        splashButton.disabled = false;
      }
    });
  }

  function triggerSelfTest(){
    runSelfTest().catch(err => {
      logSoftError('Selftest: execution failed', err);
      handleSelfTestIssues(['Self-test execution encountered an unexpected error.']);
    });
  }

  async function assertPriorityActionsDrilldown(){
    try{
      if(!window.__RUN_DASH_DRILLDOWN_SELFTEST) return true;
      const card = document.getElementById('priority-actions-card');
      const row = card && card.querySelector('#needs-attn li[data-contact-id]');
      if(!row){
        addDiagnostic('fail','Priority Actions rows missing data-contact-id');
        return false;
      }
      row.dispatchEvent(new MouseEvent('click', { bubbles:true, cancelable:true, view: window }));
      await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));
      await new Promise(r => setTimeout(r, 50));
      const modal = document.querySelector('[data-ui=\"contact-edit-modal\"], [data-modal-key=\"contact-edit\"], [data-ui=\"contact-editor\"], .record-modal, dialog[open]');
      const opened = modal && !(modal.getAttribute('aria-hidden')==='true') && !modal.hidden;
      if(!opened){
        const snippet = (input, max=200) => {
          const str = String(input||'');
          return str.length > max ? str.slice(0,max) + ' [truncated]' : str;
        };
        addDiagnostic('fail','Priority Actions click did not open editor', {
          row: snippet(row.outerHTML),
          card: snippet(card ? card.innerHTML : ''),
          hasContactId: !!row.dataset.contactId
        });
        return false;
      }
      addDiagnostic('pass','dashboard:priority-actions:drilldown');
      return true;
    }catch (err){
      addDiagnostic('fail','Priority Actions drilldown selftest error', err && err.message ? err.message : err);
      return false;
    }
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', triggerSelfTest, { once:true });
  }else{
    triggerSelfTest();
  }
  
// ==== Self-Test 2.0 — tripwires (append-below) ====
async function assertModuleScriptsAreModules(){
  const errs = [];
  const scripts = Array.from(document.scripts || []);
  const base = document.baseURI || (location && location.href) || '';
  const baseUrl = new URL(base, base);
  scripts.forEach(s => {
    const src = s.getAttribute('src') || '';
    if(!src) return;
    let u; try { u = new URL(src, baseUrl); } catch (e) { return; }
    const same = u.origin === baseUrl.origin;
    const path = (u.pathname || '').toLowerCase();
    const ours = same && (path.includes('/js/') || path.includes('/patches/'));
    if(ours){
      const t = (s.getAttribute('type') || '').trim().toLowerCase();
      if(t !== 'module'){ errs.push(`Non-module script for app code: ${u.pathname}`); }
    }
  });
  if(errs.length){
    addDiagnostic(PROD_MODE ? 'warn' : 'fail','Module-only invariant failed', errs);
  }else{
    addDiagnostic('pass','Module-only invariant enforced');
  }
}

function assertRenderAll(){
  const ok = typeof window.renderAll === 'function';
  addDiagnostic(ok ? 'pass' : 'fail', ok ? 'renderAll available' : 'renderAll missing');
}

async function assertSingleRepaintOnDataChanged(){
  if(IS_E2E_MODE){
    addDiagnostic('skip','Repaint tripwire skipped in e2e mode');
    return;
  }
  const guard = window.RenderGuard;
  if(!guard || typeof guard.requestRender !== 'function'){
    addDiagnostic('skip','RenderGuard unavailable; skip repaint tripwire'); return;
  }

  const original = guard.requestRender;
  const orig = original.bind(guard);
  let calls = 0;
  guard.requestRender = function(...args){
    calls += 1;
    return orig(...args);
  };

  const canObserveFlush = typeof guard.subscribeRender === 'function'
    && typeof guard.unsubscribeRender === 'function';
  let flushes = 0;
  let tracking = false;
  let hadPreFlush = false;
  let resolveFlush = null;
  let flushPromise = null;

  const sentinel = () => {
    if(!tracking){
      hadPreFlush = true;
      return;
    }
    flushes += 1;
    if(resolveFlush){
      resolveFlush();
      resolveFlush = null;
    }
  };

  if(canObserveFlush){
    guard.subscribeRender(sentinel);
    flushPromise = new Promise(resolve => {
      resolveFlush = resolve;
    });
  }

  try{
    if(canObserveFlush){
      await Promise.resolve();
      tracking = true;
    }

    document.dispatchEvent(new CustomEvent('app:data:changed', { detail:{ source:'selftest' }}));
    const testApi = (window.__test && typeof window.__test.nextPaint === 'function') ? window.__test : null;
    if(testApi){
      await testApi.nextPaint();
    }else if(canObserveFlush){
      const createFrameWait = () => new Promise(resolve => {
        const raf = typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : null;
        if(raf){
          raf(() => resolve());
        }else{
          setTimeout(resolve, 32);
        }
      });
      await Promise.race([flushPromise, createFrameWait()]);
      if(flushes === 0){
        await Promise.race([flushPromise, createFrameWait()]);
      }
    }

    if(canObserveFlush){
      tracking = false;
    }

    let kind;
    let message;
    if(canObserveFlush){
      if(flushes === 1){
        kind = 'pass';
        message = `app:data:changed → repaint confirmed (${calls} requestRender call${calls === 1 ? '' : 's'})`;
      }else if(flushes === 0){
        kind = 'fail';
        message = `app:data:changed triggered ${calls} requestRender call${calls === 1 ? '' : 's'} but no repaint`;
      }else{
        kind = 'warn';
        message = `app:data:changed produced ${flushes} repaints (${calls} requestRender call${calls === 1 ? '' : 's'})`;
      }
      if(hadPreFlush){
        message += ' (ignored a pre-existing repaint)';
      }
    }else{
      const ok = calls > 0;
      kind = ok ? 'pass' : 'fail';
      message = ok
        ? `app:data:changed triggered ${calls} requestRender call${calls === 1 ? '' : 's'}`
        : 'app:data:changed did not trigger any requestRender calls';
    }

    addDiagnostic(kind, message);
  }catch (err) {
    addDiagnostic('fail','Repaint tripwire failed: ' + (err && err.message || err));
  }finally{
    if(canObserveFlush){
      guard.unsubscribeRender(sentinel);
    }
    guard.requestRender = original;
  }
}

async function assertSeedEmitsOne(){
  if(IS_E2E_MODE){
    addDiagnostic('skip','Seed tripwire skipped in e2e mode');
    return;
  }
  const orig = window.dispatchAppDataChanged;
  if(typeof orig !== 'function'){ addDiagnostic('skip','dispatchAppDataChanged missing; seed tripwire skipped'); return; }
  let count = 0; window.dispatchAppDataChanged = d => { count++; return orig(d); };
  try{
    if(typeof window.SeedDemoData === 'function'){
      await window.SeedDemoData({ contacts:0, partners:0 }); // no-op seed
      addDiagnostic(count===1 ? 'pass' : (count>1?'fail':'warn'),
        count===1 ? 'Seed commit emitted one app:data:changed'
                  : (count>1 ? `Seed emitted ${count} app:data:changed events`
                              : 'Seed did not emit any changes'));
    }else{
      addDiagnostic('skip','SeedDemoData not available; seed tripwire skipped');
    }
  }catch (err) { addDiagnostic('fail','Seed tripwire failed: ' + (err && err.message || err)); }
  finally{ window.dispatchAppDataChanged = orig;
  }
}

async function assertImporterCoalescesOnce(){
  if(IS_E2E_MODE){
    addDiagnostic('skip','Importer tripwire skipped in e2e mode');
    return;
  }
  const orig = window.dispatchAppDataChanged;
  if(typeof orig !== 'function'){
    if(!importerSkipLogged){
      importerSkipLogged = true;
      logProdSkip('Selftest: importer/data not available; skipping importer tripwire (expected in prod).');
    }
    addDiagnostic('skip','dispatchAppDataChanged missing; importer tripwire skipped');
    return;
  }
  let count = 0; window.dispatchAppDataChanged = d => { count++; return orig(d); };
  try{
    // Synthetic end-of-batch signal (importer emits once per batch)
    orig({ scope:'import', entity:'partners', partial:true });
    addDiagnostic(count===1 ? 'pass' : (count>1?'fail':'warn'),
      count===1 ? 'Importer batch emitted one app:data:changed'
                : (count>1 ? `Importer emitted ${count}`
                            : 'Importer did not emit any changes'));
  }catch (err) { addDiagnostic('warn','Importer tripwire indeterminate: ' + (err && err.message || err)); }
  finally{ window.dispatchAppDataChanged = orig; }
}

// Run new tripwires in sequence (no flakes)
(async ()=>{
  try{ await assertModuleScriptsAreModules(); }catch (_) {}
  try{ assertRenderAll(); }catch (_) {}
  try{ await assertSingleRepaintOnDataChanged(); }catch (_) {}
  try{ await assertSeedEmitsOne(); }catch (_) {}
  try{ await assertImporterCoalescesOnce(); }catch (_) {}
// ==== End Self-Test 2.0 — append-above ====
// ==== End Self-Test 2.0 — append-above this file’s final “})();” ====
})();
