import './dashboard/kpis.js';

// app.js
export function goto(hash){
  if(typeof hash !== 'string' || !hash) return;
  const target = hash.startsWith('#') ? hash : `#${hash}`;
  try{
    if(typeof globalThis.location === 'object' && globalThis.location){
      const current = typeof globalThis.location.hash === 'string'
        ? globalThis.location.hash
        : '';
      if(current === target) return;
      globalThis.location.hash = target;
    }
  }catch (_) {}
}

if(typeof globalThis.Router !== 'object' || !globalThis.Router){
  globalThis.Router = { goto };
}else if(typeof globalThis.Router.goto !== 'function'){
  globalThis.Router.goto = goto;
}

(function(){
  const NONE_PARTNER_ID = window.NONE_PARTNER_ID || '00000000-0000-none-partner-000000000000';
  if(!window.NONE_PARTNER_ID) window.NONE_PARTNER_ID = NONE_PARTNER_ID;

  const fromHere = (p) => new URL(p, import.meta.url).href;

  window.CRM = window.CRM || {};
  window.CRM.openPipelineWithFilter = function(stage){
    try {
      const raw = stage == null ? '' : String(stage).trim();
      const hash = raw ? '#/pipeline?stage=' + encodeURIComponent(raw) : '#/pipeline';
      if(typeof location !== 'undefined'){
        if(location.hash !== hash){
          location.hash = hash;
        }
      }
      const evt = new CustomEvent('pipeline:applyFilter', { detail: { stage: raw || null } });
      window.dispatchEvent(evt);
    } catch (e) {
      console.warn('pipeline filter nav failed', e);
    }
  };

  const isDebug = window.__ENV__ && window.__ENV__.DEBUG === true;
  if(window.__ENV__?.DEBUG === true){
    import(fromHere('./ui/debug_overlay.js'))
      .then((mod) => {
        try{
          if(mod && typeof mod.initDebugOverlay === 'function') mod.initDebugOverlay();
        }catch (_err) {}
        window.__DBG_OVERLAY__ = mod;
      })
      .catch(() => {});
  }

  (function wireKanbanEnhancer(){
    if (window.__KANBAN_ENH__) return; window.__KANBAN_ENH__ = true;
    function maybeLoad(){
      const hasBoard = document.querySelector('[data-kanban], #kanban, .kanban-board');
      if (!hasBoard) return;
      import(fromHere('./pipeline/kanban_dnd.js')).catch(()=>{});
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', maybeLoad, { once:true });
    } else {
      maybeLoad();
    }
    if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
      try { window.RenderGuard.registerHook(() => maybeLoad()); } catch (_) {}
    }
  })();

  (function wireDashboardDnD(){
    if (window.__DASH_DND__) return; window.__DASH_DND__ = true;

    function maybe(){
      const host = document.querySelector('[data-dashboard-widgets], #dashboard-widgets, .dashboard-widgets, #kpi-tiles, [data-kpis]');
      if (!host) return;
      import(fromHere('./dashboard/widgets_dnd.js')).catch(()=>{});
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', maybe, { once:true });
    } else {
      maybe();
    }

    if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
      try { window.RenderGuard.registerHook(() => maybe()); } catch (e) {}
    }
  })();

  (function wireNotifications(){
    if (window.__NOTIFY_WIRED__) return; window.__NOTIFY_WIRED__ = true;

    // Lazy-load service at boot (non-blocking)
    try { import(fromHere('./notifications/notifier.js')); } catch (_) { }

    // Simple router to notifications page
    async function goNotifications(evt){
      evt && evt.preventDefault && evt.preventDefault();
      const mod = await import(fromHere('./pages/notifications.js'));
      try { activate('notifications'); }
      catch (_) {
        const view = document.getElementById('view-notifications');
        if (view && typeof view.classList?.remove === 'function') {
          view.classList.remove('hidden');
        }
      }
      (mod.initNotifications || mod.renderNotifications || (()=>{}))();
      history.replaceState(null, '', '#notifications');
    }

    // Delegate clicks without touching HTML
    document.addEventListener('click', (evt) => {
      const a = evt.target.closest('[data-nav="notifications"], a[href="#notifications"], button[data-page="notifications"], button[data-nav="notifications"]');
      if (a) goNotifications(evt);
    });

    // Hash route
    if (typeof location !== 'undefined' && location.hash === '#notifications') goNotifications();

    // Badge: attach to a likely nav control labeled "Notifications" if no explicit data-nav exists
    import(fromHere('./notifications/notifier.js')).catch(()=>{});
  })();

  const automationScheduler = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (fn) => Promise.resolve().then(fn);

  function scheduleAutomationModule(renderModule, onComplete){
    const finish = typeof onComplete === 'function' ? onComplete : () => {};
    const run = () => {
      let loader;
      try {
        loader = import(fromHere('./pages/email_templates.js'));
      } catch (err) {
        console.info('automation module skipped', err?.message || err);
        finish();
        return;
      }
      loader
        .then((mod) => {
          if (typeof renderModule === 'function') {
            try {
              renderModule(mod);
            } catch (renderErr) {
              console.warn('automation render failed', renderErr);
            }
          }
        })
        .catch((err) => {
          console.info('automation module skipped', err?.message || err);
        })
        .finally(() => finish());
    };

    try {
      automationScheduler(run);
    } catch (err) {
      console.warn('automation module scheduling failed', err?.message || err);
      run();
    }
  }

  (function wireAutomationSurface(){
    if (window.__AUTOMATION_WIRED__) return; window.__AUTOMATION_WIRED__ = true;

    const ROUTES = new Set(['#settings/automation', '#automation', '#email-templates']);

    function currentHash(){
      if(typeof window !== 'undefined' && window.location && typeof window.location.hash === 'string'){
        return window.location.hash;
      }
      if(typeof location !== 'undefined' && location && typeof location.hash === 'string'){
        return location.hash;
      }
      return '';
    }

    function ensureAutomationLink(){
      const nav = document.getElementById('settings-nav');
      if(!nav) return;
      if(nav.querySelector('a[data-route="settings-automation"]')) return;
      const anchor = document.createElement('a');
      anchor.href = '#settings/automation';
      anchor.dataset.route = 'settings-automation';
      anchor.textContent = 'Automation';
      anchor.style.marginLeft = '8px';
      anchor.style.fontSize = '12px';
      anchor.style.alignSelf = 'center';
      anchor.style.textDecoration = 'none';
      anchor.style.color = 'var(--muted, #64748b)';
      nav.appendChild(anchor);
    }

    function activateSettingsView(){
      const settingsMain = document.getElementById('view-settings');
      const alreadyActive = settingsMain && !settingsMain.classList.contains('hidden');
      if(alreadyActive) return;
      const button = document.getElementById('btn-open-settings')
        || document.querySelector('#main-nav button[data-nav="settings"]');
      if(button && typeof button.click === 'function'){
        button.click();
        return;
      }
      if(settingsMain){
        const views = document.querySelectorAll('main[id^="view-"]');
        views.forEach(view => {
          view.classList.toggle('hidden', view !== settingsMain);
        });
      }
    }

    function showSettingsPanel(panel){
      const nav = document.getElementById('settings-nav');
      if(nav){
        Array.from(nav.querySelectorAll('button[data-panel]')).forEach(btn => {
          const target = btn.getAttribute('data-panel');
          btn.classList.toggle('active', target === panel);
        });
      }
      const sections = document.querySelectorAll('#view-settings .settings-panel');
      sections.forEach(section => {
        const target = section.getAttribute('data-panel');
        const active = target === panel;
        section.classList.toggle('active', active);
        if(active){
          section.removeAttribute('hidden');
        }
      });
    }

    function ensureAutomationMount(){
      let mount = document.getElementById('settings-automation-grid');
      if(!mount){
        const panel = document.querySelector('#view-settings .settings-panel[data-panel="automation"]');
        if(panel){
          mount = document.createElement('div');
          mount.id = 'settings-automation-grid';
          panel.appendChild(mount);
        }
      }
      return mount;
    }

    let rendering = false;
    function goAutomation(evt){
      if(evt && typeof evt.preventDefault === 'function') evt.preventDefault();
      if(rendering) return;
      rendering = true;
      let scheduled = false;
      try{
        ensureAutomationLink();
        activateSettingsView();
        showSettingsPanel('automation');
        const mount = ensureAutomationMount();
        if(!mount){ rendering = false; return; }
        scheduleAutomationModule((mod) => {
          if(typeof mod.render === 'function'){
            mod.render(mount);
          }else if(typeof mod.renderEmailTemplates === 'function'){
            mod.renderEmailTemplates(mount);
          }
        }, () => { rendering = false; });
        scheduled = true;
        try{
          if(history && typeof history.replaceState === 'function'){
            history.replaceState(null, '', '#settings/automation');
          }else{
            window.location.hash = '#settings/automation';
          }
        }catch (_err) { window.location.hash = '#settings/automation'; }
      }catch (err) {
        if(!scheduled) rendering = false;
        console.error('automation surface render failed', err);
      }
    }

    document.addEventListener('click', (evt) => {
      const link = evt.target && evt.target.closest('a[href="#settings/automation"], [data-nav="email-templates"], [data-route="settings-automation"]');
      if(link){
        goAutomation(evt);
        return;
      }
      const btn = evt.target && evt.target.closest('#settings-nav button[data-panel="automation"]');
      if(btn){
        try {
          automationScheduler(() => goAutomation());
        } catch (_err) {
          goAutomation();
        }
      }
    });

    window.addEventListener('hashchange', () => {
      if(ROUTES.has(currentHash())){
        goAutomation();
      }
    });

    if(ROUTES.has(currentHash())){
      goAutomation();
    }
  })();

  (function setupAutomationPanel(){
    function ensureGrid(panel){
      let grid = panel.querySelector('#settings-automation-grid');
      if (!grid) {
        grid = document.createElement('section');
        grid.id = 'settings-automation-grid';
        panel.appendChild(grid);
      }
      return grid;
    }
    function run(){
      const panel = document.querySelector('.settings-panel[data-panel="automation"]');
      if(!panel) return;
      const grid = ensureGrid(panel);
      scheduleAutomationModule((m) => {
        m?.renderEmailTemplates?.(grid);
      });
    }
    if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', run, {once:true}); else run();
    window.RenderGuard?.registerHook?.(run);
  })();

  (function wireDocCenter(){
    if (window.__DOC_CENTER_NAV__) return; window.__DOC_CENTER_NAV__ = true;

    function maybe(){
      // Load enhancer when the Doc Center surface is present or navigated to
      const has = document.querySelector('[data-doc-center], #doc-center, #settings-docs, .doc-center, [data-panel="doc-center"]');
      if (has) import(fromHere('./doc/doc_center_enhancer.js')).catch(()=>{});
    }

    // Delegate nav clicks (no HTML edits)
    document.addEventListener('click', (evt)=>{
      const a = evt.target.closest('[data-nav="doc-center"], a[href="#doc-center"], button[data-page="doc-center"], button[data-nav="doc-center"]');
      if (a) { evt.preventDefault?.(); maybe(); history.replaceState(null,'','#doc-center'); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', maybe, { once:true });
    else maybe();

    if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function'){
      try { window.RenderGuard.registerHook(() => maybe()); } catch (e) {}
    }
  })();
  const listenerRegistry = window.__LISTENERS__ = window.__LISTENERS__ || { __count: 0 };
  if(window.__AD_BRIDGE__ && !window.__appDataChangedWindowBridge__){
    window.__appDataChangedWindowBridge__ = window.__AD_BRIDGE__;
  }
  if(typeof window.__REPAINT_SCHEDULED__ !== 'boolean') window.__REPAINT_SCHEDULED__ = false;

  const requestFrame = typeof window.requestAnimationFrame === 'function'
    ? window.requestAnimationFrame.bind(window)
    : (cb) => setTimeout(cb, 16);

  const debugWarn = (...args) => {
    if(isDebug && typeof console !== 'undefined' && typeof console.warn === 'function'){
      console.warn(...args);
    }
  };

  function appRender(){
    if(typeof window.renderAll !== 'function'){
      if(!window.__RENDER_ALL_MISSING_LOGGED__ && console && typeof console.error === 'function'){
        window.__RENDER_ALL_MISSING_LOGGED__ = true;
        console.error('renderAll missing — module load failed or not executed');
      }
      return;
    }
    if(window.__RENDER_ALL_MISSING_LOGGED__){
      window.__RENDER_ALL_MISSING_LOGGED__ = false;
    }
    try{
      const result = window.renderAll();
      if(result && typeof result.then === 'function'){
        result.catch(err => console.error('[app] renderAll failed', err));
      }
    }catch (err) {
      console.error('[app] renderAll failed', err);
    }
  }

  const RenderGuard = window.RenderGuard || {};
  const hasScheduler = RenderGuard
    && typeof RenderGuard.subscribeRender === 'function'
    && typeof RenderGuard.requestRender === 'function'
    && typeof RenderGuard.registerHook === 'function'
    && typeof RenderGuard.unregisterHook === 'function';
  if(hasScheduler){
    RenderGuard.subscribeRender(appRender);
  }
  const getRenderGuard = () => {
    const guard = (typeof window.RenderGuard === 'object' && window.RenderGuard)
      ? window.RenderGuard
      : RenderGuard;
    return guard || {};
  };
  const scheduleAppRender = function scheduleAppRender(){
    if(window.__REPAINT_SCHEDULED__) return;
    window.__REPAINT_SCHEDULED__ = true;
    const guard = getRenderGuard();
    const guardHasScheduler = guard
      && typeof guard.subscribeRender === 'function'
      && typeof guard.requestRender === 'function'
      && typeof guard.registerHook === 'function'
      && typeof guard.unregisterHook === 'function';
    let guardRequested = false;
    if(guard && typeof guard.requestRender === 'function'){
      try{
        guard.requestRender();
        guardRequested = true;
        Promise.resolve().then(() => {
          const liveGuard = (typeof window.RenderGuard === 'object' && window.RenderGuard)
            ? window.RenderGuard
            : guard;
          if(liveGuard && typeof liveGuard.requestRender === 'function'){
            try{ liveGuard.requestRender(); }
            catch (err) { if(isDebug && console && typeof console.warn === 'function') console.warn('[app] requestRender microtask failed', err); }
          }
        });
      }catch (err) {
        if(isDebug && console && typeof console.warn === 'function'){
          console.warn('[app] requestRender immediate fallback failed', err);
        }
      }
    }
    requestFrame(() => {
      requestFrame(() => {
        const canMeasure = isDebug && typeof performance !== 'undefined';
        let startMarked = false;
        if(canMeasure && typeof performance.mark === 'function'){
          try{
            performance.mark('REPAINT:start');
            startMarked = true;
          }catch (_err) {}
        }
        const finalizeRepaint = () => {
          if(!startMarked || !canMeasure) return;
          try{
            if(typeof performance.mark === 'function') performance.mark('REPAINT:end');
          }catch (_err) {}
          let duration = null;
          let measure = null;
          try{
            if(typeof performance.measure === 'function'){
              measure = performance.measure('REPAINT', 'REPAINT:start', 'REPAINT:end');
            }
          }catch (_err) {}
          if(measure && typeof measure.duration === 'number'){
            duration = measure.duration;
          }else if(typeof performance.getEntriesByName === 'function'){
            try{
              const entries = performance.getEntriesByName('REPAINT');
              if(entries && entries.length){
                const last = entries[entries.length - 1];
                if(last && typeof last.duration === 'number') duration = last.duration;
              }
            }catch (_err) {}
          }
          if(duration != null && window.__ENV__?.DEBUG === true){
            const overlay = window.__DBG_OVERLAY__;
            if(overlay && typeof overlay.noteRepaint === 'function'){
              try{ overlay.noteRepaint(duration); }
              catch (_err) {}
            }
          }
          try{
            if(typeof performance.clearMarks === 'function'){
              performance.clearMarks('REPAINT:start');
              performance.clearMarks('REPAINT:end');
            }
            if(typeof performance.clearMeasures === 'function'){
              performance.clearMeasures('REPAINT');
            }
          }catch (_err) {}
        };
        const resetScheduled = () => {
          window.__REPAINT_SCHEDULED__ = false;
        };
        if(guardHasScheduler){
          const hook = () => {
            try{ finalizeRepaint(); }
            finally {
              resetScheduled();
              guard.unregisterHook(hook);
            }
          };
          guard.registerHook(hook);
          try{
            if(!guardRequested){
              guard.requestRender();
            }
          }catch (err) {
            try{ guard.unregisterHook(hook); }
            catch (_unregErr) {}
            finalizeRepaint();
            resetScheduled();
            throw err;
          }
        }else{
          try{
            if(!guardRequested && guard && typeof guard.requestRender === 'function'){
              try{ guard.requestRender(); }
              catch (err) { if(isDebug && console && typeof console.warn === 'function') console.warn('[app] requestRender fallback failed', err); }
            }
            appRender();
          }finally{
            finalizeRepaint();
            resetScheduled();
          }
        }
      });
    });
  };

  if(isDebug && typeof window.PerformanceObserver === 'function'){
    try{
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if(!entry || entry.duration <= 50) return;
          if(console && typeof console.info === 'function'){
            const name = entry.name && entry.name.trim() ? entry.name : 'task';
            const duration = Number(entry.duration || 0).toFixed(1);
            const start = Number(entry.startTime || 0).toFixed(1);
            console.info(`[LONGTASK] duration=${duration}ms name=${name} startTime=${start}`);
          }
        });
      });
      longTaskObserver.observe({ type:'longtask', buffered:true });
      const perfRegistry = window.__PERF_OBSERVERS__ = window.__PERF_OBSERVERS__ || [];
      perfRegistry.push({ type:'longtask', observer: longTaskObserver });
    }catch (_err) {}
  }

  function sampleMemoryTrend(){
    if(!isDebug || !document || typeof document.querySelectorAll !== 'function') return;
    try{
      const ids = document.querySelectorAll('[id]').length;
      const reg = window.__LISTENERS__ || listenerRegistry;
      const listenerCount = reg && typeof reg.__count === 'number' ? reg.__count : 0;
      const monitor = window.__LEAK_MONITOR__ = window.__LEAK_MONITOR__ || {
        baselineIds: ids,
        baselineListeners: listenerCount,
        samples: 0
      };
      if(typeof monitor.baselineIds !== 'number') monitor.baselineIds = ids;
      if(typeof monitor.baselineListeners !== 'number') monitor.baselineListeners = listenerCount;
      monitor.samples = (monitor.samples || 0) + 1;
      if(monitor.samples < 100) return;
      const baseIds = monitor.baselineIds || 1;
      const baseListeners = monitor.baselineListeners || 1;
      const idGrowth = baseIds ? (ids - monitor.baselineIds) / baseIds : (ids > monitor.baselineIds ? 1 : 0);
      const listenerGrowth = baseListeners ? (listenerCount - monitor.baselineListeners) / baseListeners : (listenerCount > monitor.baselineListeners ? 1 : 0);
      if((idGrowth > 0.05 || listenerGrowth > 0.05) && console && typeof console.info === 'function'){
        console.info(`[MEMORY] potential leak: ids=${ids} listeners=${listenerCount}`);
      }
      monitor.baselineIds = ids;
      monitor.baselineListeners = listenerCount;
      monitor.samples = 0;
    }catch (_err) {}
  }

  async function backfillUpdatedAt(){
    for(const s of DB_META.STORES){
      const rows = await dbGetAll(s);
      const missing = rows.filter(r => !r.updatedAt);
      if(missing.length){
        missing.forEach(r => r.updatedAt = Date.now());
        await dbBulkPut(s, missing);
      }
    }
  }

  async function ensureSeedData(existingPartners){
    if(ensureSeedData.__ran) return;
    const dataset = window.__SEED_DATA__;
    if(!dataset || typeof dataset !== 'object') { ensureSeedData.__ran = true; return; }
    const META_KEY = 'seed:inline:bootstrap';
    try{
      await openDB();
      let metaRec = null;
      try{ metaRec = await dbGet('meta', META_KEY); }
      catch (_) { metaRec = null; }
      if(metaRec && metaRec.done){ ensureSeedData.__ran = true; return; }

      const partnersSnapshot = Array.isArray(existingPartners) ? existingPartners : await dbGetAll('partners');
      const contactsSnapshot = await dbGetAll('contacts');
      const partnerCount = (partnersSnapshot||[]).filter(p => {
        if(!p) return false;
        const id = String(p.id||'');
        const name = String(p.name||'').trim().toLowerCase();
        if(id === NONE_PARTNER_ID || name === 'none') return false;
        return !!id || !!name;
      }).length;
      const hasExistingData = (Array.isArray(contactsSnapshot) && contactsSnapshot.length>0) || partnerCount>0;
      const now = Date.now();
      if(hasExistingData){
        await dbPut('meta', {id:META_KEY, done:true, at:now, reason:'existing-data'});
        ensureSeedData.__ran = true;
        return;
      }

      const idFactory = ()=>{
        if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        if(typeof window.uuid === 'function') return window.uuid();
        return String(Date.now()+Math.random());
      };
      const normalize = (list)=> (Array.isArray(list)?list:[]).map(item=>{
        const next = Object.assign({}, item||{});
        if(next.id == null) next.id = idFactory();
        next.id = String(next.id);
        if(!next.updatedAt) next.updatedAt = now;
        return next;
      });

      const partnersRows = normalize(dataset.partners);
      if(!partnersRows.some(row => String(row.id) === NONE_PARTNER_ID)){
        partnersRows.push({ id: NONE_PARTNER_ID, name:'None', company:'', email:'', phone:'', tier:'Keep in Touch', updatedAt: now });
      }

      await dbBulkPut('partners', partnersRows);
      await dbBulkPut('contacts', normalize(dataset.contacts));
      await dbBulkPut('tasks', normalize(dataset.tasks));
      await dbBulkPut('documents', normalize(dataset.documents));
      await dbBulkPut('deals', normalize(dataset.deals));
      await dbBulkPut('commissions', normalize(dataset.commissions));

      await dbPut('meta', {
        id: META_KEY,
        done: true,
        at: now,
        counts: {
          partners: partnersRows.length,
          contacts: Array.isArray(dataset.contacts) ? dataset.contacts.length : 0,
          tasks: Array.isArray(dataset.tasks) ? dataset.tasks.length : 0,
          documents: Array.isArray(dataset.documents) ? dataset.documents.length : 0,
          deals: Array.isArray(dataset.deals) ? dataset.deals.length : 0,
          commissions: Array.isArray(dataset.commissions) ? dataset.commissions.length : 0
        }
      });

      if(typeof window.dispatchAppDataChanged === 'function'){
        window.dispatchAppDataChanged({source:'seed:inline'});
      }else{
        document.dispatchEvent(new CustomEvent('app:data:changed',{detail:{source:'seed:inline'}}));
      }
    }catch (err) {
      debugWarn('ensureSeedData', err);
    }finally{
      ensureSeedData.__ran = true;
    }
  }

  async function renderExtrasRegistry(){
    const box = document.getElementById('extras-registry'); if(!box) return;
    const meta = await dbGetAll('meta');
    const rec = meta.find(m => m.id==='extrasRegistry');
    if(!rec){ box.textContent = 'No extras recorded yet.'; return; }
    function list(obj){
      const entries = Object.entries(obj||{}).sort((a,b)=> b[1]-a[1]).slice(0,20);
      if(!entries.length) return '<li class="muted">—</li>';
      return entries.map(([k,v])=> `<li><span class="tag">${k}</span> <span class="muted">(${v})</span></li>`).join('');
    }
    box.innerHTML = `<div><strong>Contacts:</strong><ul>${list(rec.contacts||{})}</ul></div><div style="margin-top:8px"><strong>Partners:</strong><ul>${list(rec.partners||{})}</ul></div>`;
  }

  const SELECTION_SCOPES = ['contacts','partners','pipeline'];

  function getSelectionStore(){
    return window.SelectionStore || null;
  }

  function selectionScopeFor(node){
    const host = node && typeof node.closest === 'function'
      ? node.closest('[data-selection-scope]')
      : null;
    const scope = host && host.getAttribute ? host.getAttribute('data-selection-scope') : null;
    return scope && scope.trim() ? scope.trim() : 'contacts';
  }

  function selectionIdFor(node){
    if(!node) return null;
    if(typeof node.getAttribute === 'function'){
      const direct = node.getAttribute('data-id');
      if(direct) return String(direct);
    }
    const row = typeof node.closest === 'function' ? node.closest('tr[data-id]') : null;
    if(row && typeof row.getAttribute === 'function'){
      const viaRow = row.getAttribute('data-id');
      if(viaRow) return String(viaRow);
    }
    return null;
  }

  function syncSelectionCheckboxes(scope, ids){
    const scopeKey = scope && scope.trim() ? scope.trim() : 'contacts';
    const idSet = ids instanceof Set
      ? ids
      : new Set(Array.isArray(ids) ? ids.map(String) : []);
    document.querySelectorAll(`[data-selection-scope="${scopeKey}"]`).forEach(table => {
      table.querySelectorAll('tbody tr[data-id]').forEach(row => {
        const id = row.getAttribute('data-id');
        if(!id) return;
        const checkbox = row.querySelector('[data-role="select"]');
        if(!checkbox) return;
        const shouldCheck = idSet.has(String(id));
        if(checkbox.checked !== shouldCheck){
          checkbox.checked = shouldCheck;
        }
      });
      const header = table.querySelector('thead input[data-role="select-all"]');
      if(header){
        const rowBoxes = Array.from(table.querySelectorAll('tbody [data-role="select"]'));
        const total = rowBoxes.length;
        const checkedCount = rowBoxes.filter(box => box.checked).length;
        header.indeterminate = total > 0 && checkedCount > 0 && checkedCount < total;
        header.checked = total > 0 && checkedCount === total;
        if(!total){
          header.indeterminate = false;
          header.checked = false;
        }
      }
    });
  }

  function updateActionBarGuards(count){
    const bar = document.getElementById('actionbar');
    if(!bar) return;
    const total = Number(count) || 0;
    const apply = typeof window.applyActionBarGuards === 'function'
      ? window.applyActionBarGuards
      : null;
    let guards = null;
    if(apply){
      guards = apply(bar, total);
    }else{
      const compute = typeof window.computeActionBarGuards === 'function'
        ? window.computeActionBarGuards
        : (()=>({}));
      guards = compute(total);
      const fallbackActs = {
        edit: 'edit',
        merge: 'merge',
        emailTogether: 'emailTogether',
        emailMass: 'emailMass',
        addTask: 'task',
        bulkLog: 'bulkLog',
        delete: 'delete',
        clear: 'clear'
      };
      Object.entries(fallbackActs).forEach(([key, act]) => {
        const btn = bar.querySelector(`[data-act="${act}"]`);
        if(!btn) return;
        const enabled = !!guards[key];
        btn.disabled = !enabled;
        btn.classList?.toggle('disabled', !enabled);
        const isPrimary = act === 'edit' || act === 'merge';
        btn.classList?.toggle('active', isPrimary && enabled);
      });
    }
    if(total > 0){
      bar.classList.add('has-selection');
      bar.setAttribute('data-visible', '1');
    }else{
      bar.classList.remove('has-selection');
      bar.setAttribute('data-visible', '0');
    }
  }

  function handleSelectionSnapshot(snapshot){
    if(!snapshot || typeof snapshot.scope !== 'string') return;
    const ids = snapshot.ids instanceof Set
      ? snapshot.ids
      : new Set(Array.from(snapshot.ids || [], value => String(value)));
    syncSelectionCheckboxes(snapshot.scope, ids);
    updateActionBarGuards(ids.size);
  }

  function clearAllSelectionScopes(){
    const store = getSelectionStore();
    if(!store) return;
    SELECTION_SCOPES.forEach(scope => {
      if(store.count(scope)) store.clear(scope);
    });
  }

  function initSelectionBindings(){
    if(initSelectionBindings.__wired) return;
    const store = getSelectionStore();
    if(!store) return;
    initSelectionBindings.__wired = true;
    store.subscribe(handleSelectionSnapshot);
    document.addEventListener('change', (event)=>{
      const target = event.target;
      if(!(target instanceof HTMLInputElement)) return;
      if(!target.dataset || target.dataset.role !== 'select') return;
      const scope = selectionScopeFor(target);
      const id = selectionIdFor(target);
      if(!id) return;
      const next = store.get(scope);
      if(target.checked) next.add(id);
      else next.delete(id);
      store.set(next, scope);
    });
    updateActionBarGuards(0);
  }

  const DEFAULT_ROUTE = 'dashboard';
  const VIEW_HASH = {
    dashboard: '#/dashboard',
    longshots: '#/long-shots',
    pipeline: '#/pipeline',
    partners: '#/partners'
  };
  const HASH_TO_VIEW = new Map();
  Object.entries(VIEW_HASH).forEach(([view, hash]) => {
    const canonical = String(hash || '').toLowerCase();
    if(canonical) HASH_TO_VIEW.set(canonical, view);
    const noSlash = canonical.replace('#/', '#');
    if(noSlash) HASH_TO_VIEW.set(noSlash, view);
  });
  HASH_TO_VIEW.set('#/longshots', 'longshots');
  HASH_TO_VIEW.set('#longshots', 'longshots');
  HASH_TO_VIEW.set('#/long-shots', 'longshots');
  HASH_TO_VIEW.set('#long-shots', 'longshots');

  const VIEW_LIFECYCLE = {
    dashboard: { id: 'view-dashboard', ui: 'dashboard-root' },
    longshots: { id: 'view-longshots', ui: 'longshots-root' },
    pipeline: { id: 'view-pipeline', ui: 'kanban-root' },
    partners: { id: 'view-partners', ui: 'partners-table' }
  };

  let activeView = null;
  let suppressHashUpdate = false;

  const PIPELINE_FILTER_VALUES = new Set(['new', 'qualified', 'won', 'lost']);
  const PIPELINE_FILTER_LABELS = {
    new: 'New',
    qualified: 'Qualified',
    won: 'Won',
    lost: 'Lost'
  };
  const PIPELINE_STAGE_LOOKUP = new Map();

  function pipelineToken(value){
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function registerPipelineAliases(group, aliases){
    aliases.forEach(alias => {
      const normalized = pipelineToken(alias);
      if(!normalized) return;
      PIPELINE_STAGE_LOOKUP.set(normalized, group);
      const compact = normalized.replace(/-/g, '');
      if(compact) PIPELINE_STAGE_LOOKUP.set(compact, group);
    });
  }

  registerPipelineAliases('new', ['new', 'lead', 'leads', 'long-shot', 'longshot', 'prospect', 'application', 'app']);
  registerPipelineAliases('qualified', ['qualified', 'preapproved', 'pre-approved', 'preapp', 'processing', 'underwriting', 'approved', 'nurture', 'active', 'pipeline', 'in-process']);
  registerPipelineAliases('won', ['won', 'ctc', 'clear-to-close', 'cleared-to-close', 'funded', 'post-close', 'postclose', 'client', 'clients']);
  registerPipelineAliases('lost', ['lost', 'denied', 'declined', 'dead', 'fallout', 'withdrawn', 'withdrew']);

  let currentPipelineStageFilter = null;

  function ensurePipelineFilterStyle(){
    if(typeof document === 'undefined') return;
    if(document.getElementById('pipeline-filter-style')) return;
    const style = document.createElement('style');
    style.id = 'pipeline-filter-style';
    style.textContent = '.pipeline-filter-hide{display:none !important;}';
    const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
    if(head && typeof head.appendChild === 'function') head.appendChild(style);
  }

  function groupForStageValue(value){
    const token = pipelineToken(value);
    if(!token) return null;
    return PIPELINE_STAGE_LOOKUP.get(token) || PIPELINE_STAGE_LOOKUP.get(token.replace(/-/g, '')) || null;
  }

  function normalizePipelineStage(stage){
    if(stage == null) return null;
    const token = pipelineToken(stage);
    if(!token) return null;
    return PIPELINE_FILTER_VALUES.has(token) ? token : null;
  }

  function renderPipelineFilterTag(stage){
    const view = document.getElementById('view-pipeline');
    if(!view) return;
    let bar = view.querySelector('[data-role="pipeline-filter-bar"]');
    if(!bar){
      bar = document.createElement('div');
      bar.dataset.role = 'pipeline-filter-bar';
      bar.className = 'row';
      bar.style.alignItems = 'center';
      bar.style.gap = '8px';
      bar.style.marginBottom = '12px';
      const firstSection = view.querySelector('section.card');
      if(firstSection){
        view.insertBefore(bar, firstSection);
      }else{
        view.appendChild(bar);
      }
    }
    bar.innerHTML = '';
    if(!stage){
      bar.hidden = true;
      bar.setAttribute('aria-hidden', 'true');
      return;
    }
    bar.hidden = false;
    bar.removeAttribute('aria-hidden');
    const label = document.createElement('span');
    label.className = 'muted';
    label.textContent = 'Stage filter';
    const chip = document.createElement('span');
    chip.className = 'badge-pill';
    chip.dataset.qa = `filter-stage-${stage}`;
    chip.textContent = PIPELINE_FILTER_LABELS[stage] || stage;
    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'btn';
    clearBtn.textContent = 'Clear';
    clearBtn.addEventListener('click', evt => {
      evt.preventDefault();
      clearPipelineStageFilter();
    });
    bar.append(label, chip, clearBtn);
  }

  function applyPipelineStageFilterToDom(stage){
    ensurePipelineFilterStyle();
    if(typeof document === 'undefined') return;
    const hideClass = 'pipeline-filter-hide';
    const targets = ['#tbl-pipeline tbody tr', '#tbl-clients tbody tr'];
    targets.forEach(selector => {
      document.querySelectorAll(selector).forEach(row => {
        const stageValue = row.dataset?.stage || '';
        const group = groupForStageValue(stageValue);
        const shouldShow = !stage || group === stage;
        row.classList.toggle(hideClass, !shouldShow);
      });
    });
    renderPipelineFilterTag(stage);
  }

  function setPipelineStageFilter(stage){
    const normalized = normalizePipelineStage(stage);
    currentPipelineStageFilter = normalized;
    if(activeView === 'pipeline'){
      applyPipelineStageFilterToDom(normalized);
    }
  }

  function clearPipelineStageFilter(){
    setPipelineStageFilter(null);
    try {
      const baseHash = '#/pipeline';
      if(typeof window !== 'undefined' && window.location){
        if(window.location.hash !== baseHash){
          if(window.Router && typeof window.Router.goto === 'function'){
            window.Router.goto(baseHash);
          }else{
            window.location.hash = baseHash;
          }
        }
      }
    }catch (_err) {}
    try {
      const evt = new CustomEvent('pipeline:applyFilter', { detail: { stage: null } });
      window.dispatchEvent(evt);
    }catch (_err) {}
  }

  function parsePipelineStageFromHash(){
    if(typeof window === 'undefined' || !window.location) return null;
    const raw = String(window.location.hash || '');
    const lowered = raw.toLowerCase();
    if(!lowered.startsWith('#/pipeline')) return null;
    const idx = raw.indexOf('?');
    if(idx === -1) return null;
    const query = raw.slice(idx + 1);
    try {
      const params = new URLSearchParams(query);
      const value = params.get('stage') || params.get('pipeline');
      return normalizePipelineStage(value);
    }catch (_err) {
      return null;
    }
  }

  function applyPipelineStageFilterFromHash(){
    const stage = parsePipelineStageFromHash();
    setPipelineStageFilter(stage);
  }

  function handlePipelineFilterEvent(evt){
    const detail = evt && evt.detail ? evt.detail : {};
    if(Object.prototype.hasOwnProperty.call(detail, 'stage')){
      setPipelineStageFilter(detail.stage);
    }else if(activeView === 'pipeline'){
      applyPipelineStageFilterToDom(currentPipelineStageFilter);
    }
  }

  function handlePipelineHashChange(){
    if(activeView !== 'pipeline') return;
    applyPipelineStageFilterFromHash();
  }

  function reapplyPipelineFilterIfActive(){
    if(activeView !== 'pipeline') return;
    applyPipelineStageFilterToDom(currentPipelineStageFilter);
  }

  window.addEventListener('pipeline:applyFilter', handlePipelineFilterEvent);
  window.addEventListener('hashchange', handlePipelineHashChange);
  if(window.RenderGuard && typeof window.RenderGuard.registerHook === 'function'){
    try { window.RenderGuard.registerHook(reapplyPipelineFilterIfActive); }
    catch (_err) {}
  }
  if(typeof document !== 'undefined'){
    document.addEventListener('app:data:changed', () => {
      if(activeView === 'pipeline') applyPipelineStageFilterToDom(currentPipelineStageFilter);
    });
  }

  currentPipelineStageFilter = parsePipelineStageFromHash();

  function normalizeView(value){
    return String(value || '').trim().toLowerCase();
  }

  function normalizedHash(){
    try{
      if(typeof window !== 'undefined' && window.location){
        return String(window.location.hash || '').trim().toLowerCase();
      }
    }catch (_) {}
    return '';
  }

  function viewFromHash(hash){
    const normalized = String(hash || '').trim().toLowerCase();
    if(!normalized) return null;
    if(normalized === '#workbench' || normalized === '#/workbench') return 'workbench';
    return HASH_TO_VIEW.get(normalized) || null;
  }

  function syncHashForView(view){
    if(suppressHashUpdate) return;
    const targetHash = VIEW_HASH[view];
    if(!targetHash) return;
    const current = normalizedHash();
    if(view === 'pipeline' && current.startsWith('#/pipeline?')) return;
    if(current === String(targetHash).trim().toLowerCase()) return;
    goto(targetHash);
  }

  function ensureViewMounted(view){
    const entry = VIEW_LIFECYCLE[view];
    if(!entry) return;
    const root = document.getElementById(entry.id);
    if(!root) return;
    if(root.getAttribute('data-mounted') === '1') return;
    root.setAttribute('data-mounted', '1');
    if(entry.ui && !root.getAttribute('data-ui')){
      root.setAttribute('data-ui', entry.ui);
    }
    if(typeof entry.mount === 'function'){
      try{ entry.mount(root); }
      catch (err) {
        if(isDebug && console && typeof console.warn === 'function'){
          console.warn(`[view:${view}] mount failed`, err);
        }
      }
    }
  }

  function handleHashChange(){
    const currentView = viewFromHash(normalizedHash());
    if(!currentView || currentView === 'workbench') return;
    if(currentView === activeView) return;
    suppressHashUpdate = true;
    try{ activate(currentView); }
    finally{ suppressHashUpdate = false; }
  }

  const settingsButton = document.getElementById('btn-open-settings');
  const titleLink = document.getElementById('app-title-link');

  function activate(view){
    const normalized = normalizeView(view);
    if(!normalized) return;
    $all('main[id^="view-"]').forEach(m => m.classList.toggle('hidden', m.id !== 'view-' + normalized));
    $all('#main-nav button[data-nav]').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav')===normalized));
    if(settingsButton){
      settingsButton.classList.toggle('active', normalized==='settings');
    }
    activeView = normalized;
    clearAllSelectionScopes();
    ensureViewMounted(normalized);
    if(normalized === 'pipeline'){
      applyPipelineStageFilterFromHash();
    }
    if(normalized !== 'workbench'){ syncHashForView(normalized); }
    scheduleAppRender();
    if(normalized==='settings') renderExtrasRegistry();
  }

  function enforceDefaultRoute(){
    const canonicalHash = VIEW_HASH[DEFAULT_ROUTE] || `#/${DEFAULT_ROUTE}`;
    let bypass = false;
    try{
      if(window.location){
        const currentHash = typeof window.location.hash === 'string'
          ? window.location.hash
          : '';
        const mappedView = viewFromHash(currentHash);
        if(mappedView === 'workbench'){
          bypass = true;
        }else if(mappedView){
          suppressHashUpdate = true;
          try{ activate(mappedView); }
          finally{ suppressHashUpdate = false; }
          return;
        }else if(currentHash && currentHash !== canonicalHash){
          if(window.history && typeof window.history.replaceState === 'function'){
            window.history.replaceState(null, document.title, canonicalHash);
          }else{
            window.location.hash = canonicalHash;
          }
        }
      }
    }catch (_) {
      if(!bypass){
        try{ window.location.hash = canonicalHash; }
        catch (__) { /* noop */ }
      }
    }
    if(bypass) return;
    activate(DEFAULT_ROUTE);
  }

  enforceDefaultRoute();
  window.addEventListener('hashchange', handleHashChange);
  $('#main-nav').addEventListener('click', (e)=>{
    const btn = e.target.closest('button[data-nav]'); if(!btn) return;
    const navTarget = btn.getAttribute('data-nav');
    if(navTarget === 'workbench') return;
    e.preventDefault();
    activate(navTarget);
  });

  (function wireWorkbenchNav(){
    if (window.__WB_NAV__) return;
    window.__WB_NAV__ = true;

    const ensureWorkbenchMount = () => {
      let mount = document.getElementById('view-workbench');
      if(!mount){
        mount = document.createElement('main');
        mount.id = 'view-workbench';
        mount.classList.add('hidden');
        mount.setAttribute('data-view', 'workbench');
        const container = document.querySelector('.container');
        if(container){
          container.appendChild(mount);
        }else{
          document.body.appendChild(mount);
        }
      }
      return mount;
    };

    const updateHash = () => {
      try{
        if(history && typeof history.replaceState === 'function'){
          history.replaceState(null, '', '#workbench');
        }else if(window.location){
          window.location.hash = '#workbench';
        }
      }catch (_) { }
    };

    async function goWB(evt){
      if(evt && typeof evt.preventDefault === 'function') evt.preventDefault();
      const mount = ensureWorkbenchMount();
      activate('workbench');
      try{
        const [mod, selftest] = await Promise.all([
          import(fromHere('./pages/workbench.js')),
          import(fromHere('./selftest.js')).catch(() => ({}))
        ]);
        const renderFn = mod.initWorkbench || mod.renderWorkbench || (()=>{});
        const options = {};
        if(selftest && typeof selftest.runSelfTest === 'function'){
          options.onRunSelfTest = selftest.runSelfTest;
        }
        const outcome = renderFn(mount, options);
        if(outcome && typeof outcome.then === 'function'){
          await outcome;
        }
      }catch (err) {
        console.error('[workbench] render failed', err);
      }
      updateHash();
    }

    document.addEventListener('click', (evt) => {
      const target = evt.target && evt.target.closest('[data-nav="workbench"], a[href="#workbench"], button[data-page="workbench"], button[data-nav="workbench"]');
      if(!target) return;
      goWB(evt);
    });

    const initialHash = window.location && typeof window.location.hash === 'string'
      ? window.location.hash
      : '';
    if(initialHash === '#workbench' || initialHash === '#/workbench'){
      goWB();
    }
  })();

  initSelectionBindings();

  if(settingsButton && !settingsButton.__wired){
    settingsButton.__wired = true;
    settingsButton.addEventListener('click', (e)=>{
      e.preventDefault();
      activate('settings');
    });
  }

  if(titleLink && !titleLink.__wired){
    titleLink.__wired = true;
    titleLink.addEventListener('click', (e)=>{
      e.preventDefault();
      activate('dashboard');
      try{ window.scrollTo({top:0, behavior:'smooth'}); }
      catch (_) { window.scrollTo(0,0); }
    });
  }

  function initSettingsNav(){
    const nav = document.getElementById('settings-nav');
    if(!nav || nav.__wired) return;
    nav.__wired = true;
    nav.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-panel]');
      if(!btn) return;
      e.preventDefault();
      const target = btn.getAttribute('data-panel');
      nav.querySelectorAll('button[data-panel]').forEach(b=>{
        b.classList.toggle('active', b===btn);
      });
      document.querySelectorAll('#view-settings .settings-panel').forEach(section=>{
        section.classList.toggle('active', section.getAttribute('data-panel')===target);
      });
    });
  }
  initSettingsNav();
  document.addEventListener('DOMContentLoaded', initSettingsNav);

  function applyTableSearch(input){
    const selector = input.dataset.tableSearch;
    const table = selector ? document.querySelector(selector) : input.closest('table');
    if(!table) return;
    const body = table.tBodies ? table.tBodies[0] : null;
    if(!body) return;
    const q = (input.value||'').toLowerCase();
    Array.from(body.rows).forEach(row => {
      const txt = (row.textContent||'').toLowerCase();
      row.style.display = txt.includes(q) ? '' : 'none';
    });
  }
  document.addEventListener('input', evt => {
    const target = evt.target;
    if(!(target instanceof HTMLInputElement)) return;
    if(!target.matches('[data-table-search]')) return;
    applyTableSearch(target);
  });
  document.addEventListener('DOMContentLoaded', ()=>{
    document.querySelectorAll('[data-table-search]').forEach(input=> applyTableSearch(input));
  });

  function wireSelectAll(cbId){
    const cb = $(cbId); if(!cb) return;
    if(cb.__selectionWired) return; cb.__selectionWired = true;
    cb.addEventListener('change', ()=>{
      const store = getSelectionStore();
      if(!store) return;
      const scope = selectionScopeFor(cb);
      const host = cb.closest('[data-selection-scope]');
      const ids = host
        ? Array.from(host.querySelectorAll('tbody tr[data-id]'))
            .map(row => row.getAttribute('data-id'))
            .filter(Boolean)
            .map(String)
        : [];
      cb.indeterminate = false;
      if(cb.checked){
        store.set(ids, scope);
      }else{
        store.clear(scope);
      }
    });
  }
  ['#inprog-all','#partners-all','#pipe-all','#clients-all','#ls-all','#status-active-all','#status-clients-all','#status-longshots-all'].forEach(wireSelectAll);

  const SORT_STATE = {};
  function compareValues(a, b, type){
    if(type==='number'){
      const av = Number(a||0);
      const bv = Number(b||0);
      return av - bv;
    }
    const av = String(a||'');
    const bv = String(b||'');
    return av.localeCompare(bv, undefined, {numeric:true, sensitivity:'base'});
  }
  function applySort(table, key, type, dir){
    const body = table.tBodies[0]; if(!body) return;
    const rows = Array.from(body.rows);
    rows.sort((a,b)=>{
      const result = compareValues(a.dataset[key], b.dataset[key], type);
      return dir==='desc' ? -result : result;
    });
    rows.forEach(row => body.appendChild(row));
  }
  function updateSortIcons(tableId){
    const table = document.getElementById(tableId); if(!table) return;
    const state = SORT_STATE[tableId] || {};
    table.querySelectorAll('th .sort-btn .sort-icon').forEach(icon => {
      const btn = icon.closest('.sort-btn');
      if(!btn) return;
      if(state.key === btn.dataset.key){
        icon.textContent = state.dir==='desc' ? '▼' : '▲';
      }else{
        icon.textContent = '↕';
      }
    });
  }
  function ensureSortable(tableId){
    const table = document.getElementById(tableId); if(!table) return;
    const headers = table.querySelectorAll('th .sort-btn');
    headers.forEach(btn=>{
      if(btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', ()=>{
        const key = btn.dataset.key; if(!key) return;
        const type = btn.dataset.type || 'string';
        const current = SORT_STATE[tableId] || {};
        const dir = current.key===key && current.dir==='asc' ? 'desc' : 'asc';
        SORT_STATE[tableId] = {key, type, dir};
        applySort(table, key, type, dir);
        updateSortIcons(tableId);
      });
    });
    const state = SORT_STATE[tableId];
    if(state && state.key){
      applySort(table, state.key, state.type||'string', state.dir||'asc');
    }
    updateSortIcons(tableId);
  }
  window.ensureSortable = ensureSortable;
  window.addEventListener('status-table-updated', (e)=>{
    const id = e.detail?.id; if(id) ensureSortable(id);
  });

  const exportBtn = $('#btn-export-json');
  if(exportBtn && !exportBtn.__wired){
    exportBtn.__wired = true;
    exportBtn.addEventListener('click', async ()=>{
      try{
        const snapshot = await dbExportAll();
        const blob = new Blob([JSON.stringify(snapshot, null, 2)], {type:'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'crm_workspace_' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
      }catch (err) {
        toast('Export failed');
        debugWarn('export', err);
      }
    });
  }
  const importBtn = $('#btn-import-json');
  const importDialog = $('#import-workspace-dialog');
  const importInput = $('#import-json-input');
  const importFilename = $('#import-dialog-filename');
  const importChoose = $('#import-dialog-choose');
  const importCancel = $('#import-dialog-cancel');
  const importClose = $('#import-dialog-close');
  const importConfirm = $('#import-dialog-import');
  let pendingImportFile = null;

  async function handleWorkspaceImport(mode){
    if(!pendingImportFile) throw new Error('No file selected');
    const text = await pendingImportFile.text();
    const payload = JSON.parse(text);
    await dbRestoreAll(payload, mode);
    toast(`Import complete (${mode})`);
    scheduleAppRender();
    if(typeof renderExtrasRegistry === 'function') await renderExtrasRegistry();
  }

  function resetImportDialog(){
    pendingImportFile = null;
    if(importInput) importInput.value = '';
    if(importFilename) importFilename.textContent = 'No file selected.';
    if(importDialog){
      const radios = importDialog.querySelectorAll('input[name="import-mode"]');
      let hasChecked=false;
      radios.forEach(radio=>{
        if(radio.value==='merge'){ radio.checked=true; hasChecked=true; }
      });
      if(!hasChecked && radios[0]) radios[0].checked = true;
    }
  }

  if(importBtn && !importBtn.__wired){
    importBtn.__wired = true;
    importBtn.addEventListener('click', ()=>{
      if(importDialog){
        resetImportDialog();
        importDialog.showModal();
      }else if(importInput){
        importInput.click();
      }
    });
  }

  if(importDialog && !importDialog.__wired){
    importDialog.__wired = true;
    importDialog.addEventListener('close', resetImportDialog);
  }

  if(importClose && !importClose.__wired){
    importClose.__wired = true;
    importClose.addEventListener('click', ()=> importDialog?.close());
  }
  if(importCancel && !importCancel.__wired){
    importCancel.__wired = true;
    importCancel.addEventListener('click', ()=> importDialog?.close());
  }
  if(importChoose && !importChoose.__wired){
    importChoose.__wired = true;
    importChoose.addEventListener('click', ()=> importInput?.click());
  }

  if(importInput && !importInput.__wired){
    importInput.__wired = true;
    importInput.addEventListener('change', async (e)=>{
      pendingImportFile = e.target.files?.[0] || null;
      if(importFilename){
        importFilename.textContent = pendingImportFile ? pendingImportFile.name : 'No file selected.';
      }
      if(!importDialog && pendingImportFile){
        try{
          await handleWorkspaceImport('merge');
        }catch (err) {
          debugWarn('import error', err);
          alert('Import failed: ' + (err && err.message ? err.message : err));
        }finally{
          pendingImportFile = null;
          e.target.value = '';
        }
      }
    });
  }

  if(importConfirm && !importConfirm.__wired){
    importConfirm.__wired = true;
    importConfirm.addEventListener('click', async ()=>{
      if(!pendingImportFile){
        if(importFilename) importFilename.textContent = 'Please choose a JSON snapshot.';
        importInput?.click();
        return;
      }
      const mode = importDialog?.querySelector('input[name="import-mode"]:checked')?.value || 'merge';
      importConfirm.disabled = true;
      try{
        await handleWorkspaceImport(mode);
        importDialog?.close();
      }catch (err) {
        debugWarn('import error', err);
        alert('Import failed: ' + (err && err.message ? err.message : err));
      }finally{
        importConfirm.disabled = false;
      }
    });
  }
  const dashIcsBtn = $('#btn-export-ics-dashboard');
  if(dashIcsBtn && !dashIcsBtn.__wired){
    dashIcsBtn.__wired = true;
    dashIcsBtn.addEventListener('click', async ()=>{
      if(typeof window.exportToIcalFile === 'function'){
        try{ await window.exportToIcalFile(); }
        catch (err) { toast('ICS export failed'); debugWarn('ics export', err); }
      }else{
        toast('ICS export unavailable');
      }
    });
  }

  const seedForm = $('#seed-demo-form');
  const seedRunBtn = $('#btn-seed-data');
  if(seedForm && !seedForm.__wired){
    seedForm.__wired = true;
    const notify = (message)=>{
      if(typeof window.toast === 'function'){ window.toast(message); }
      else if(typeof alert === 'function'){ alert(message); }
    };
    seedForm.addEventListener('submit', async (event)=>{
      event.preventDefault();
      if(typeof window.seedTestData !== 'function'){
        notify('Seeding utility unavailable');
        return;
      }

      const countInput = seedForm.querySelector('#seed-count');
      const includeCelebrations = !!seedForm.querySelector('#seed-include-celebrations')?.checked;
      const stageValues = Array.from(seedForm.querySelectorAll('input[name="seed-stage"]:checked')).map(el => el.value);
      const loanValues = Array.from(seedForm.querySelectorAll('input[name="seed-loan"]:checked')).map(el => el.value);
      const includeBuyer = seedForm.querySelector('#seed-partner-buyer')?.checked !== false;
      const includeListing = seedForm.querySelector('#seed-partner-listing')?.checked !== false;

      if(!stageValues.length){
        notify('Select at least one stage.');
        return;
      }
      if(!loanValues.length){
        notify('Select at least one loan type.');
        return;
      }

      const countValue = countInput ? Number(countInput.value) : NaN;
      const options = {
        count: countValue,
        includeCelebrations,
        stages: stageValues,
        loanTypes: loanValues,
        partners: {
          buyer: includeBuyer,
          listing: includeListing
        }
      };

      if(seedRunBtn) seedRunBtn.disabled = true;
      seedForm.classList.add('is-seeding');
      try{
        await window.seedTestData(options);
      }catch (error) {
        debugWarn('seed run failed', error);
      }finally{
        seedForm.classList.remove('is-seeding');
        if(seedRunBtn) seedRunBtn.disabled = false;
      }
    });
  }
  $('#toggle-dark').addEventListener('change', (e)=>{
    document.documentElement.style.filter = e.target.checked ? 'invert(1) hue-rotate(180deg)' : 'none';
  });

  window.addEventListener('beforeunload', async ()=>{
    const enabled = $('#toggle-autobackup')?.checked;
    if(!enabled) return;
    try{
      const snapshot = await dbExportAll();
      const rec = { id: 'lastBackup', at: new Date().toISOString(), snapshot };
      await dbPut('meta', rec);
    }catch (_) {}
  });

  (async function init(){
    await openDB();
    let partners = await dbGetAll('partners');
    if(!partners.find(p=> String(p.id)===NONE_PARTNER_ID || lc(p.name)==='none')){
      const noneRecord = { id: NONE_PARTNER_ID, name:'None', company:'', email:'', phone:'', tier:'Keep in Touch' };
      await dbPut('partners', Object.assign({updatedAt: Date.now()}, noneRecord));
      partners.push(noneRecord);
    }
    await ensureSeedData(partners);
    await backfillUpdatedAt();
    scheduleAppRender();
    await renderExtrasRegistry();
  })();

  function resolveWorkbenchRenderer(){
    if(typeof window.renderWorkbench === 'function') return window.renderWorkbench;
    if(window.workbench && typeof window.workbench.render === 'function'){
      return window.workbench.render.bind(window.workbench);
    }
    if(window.Workbench && typeof window.Workbench.render === 'function'){
      return window.Workbench.render.bind(window.Workbench);
    }
    return null;
  }

  function invokeRenderer(label, fn){
    if(typeof fn !== 'function') return false;
    try{
      const result = fn();
      if(result && typeof result.then === 'function'){
        result.catch(err => console.error(`[app] ${label} repaint failed`, err));
      }
    }catch (err) {
      console.error(`[app] ${label} repaint failed`, err);
    }
    return true;
  }

  function refreshByScope(scope, action){
    const key = String(scope || '').toLowerCase();
    if(!key) return false;
    const hits = [];
    const push = (label, fn) => {
      const handled = invokeRenderer(label, fn);
      hits.push(handled);
      return handled;
    };
    switch(key){
      case 'dashboard':
        push('renderDashboard', window.renderDashboard);
        break;
      case 'partners':
        push('renderPartners', window.renderPartners);
        break;
      case 'contacts':
        push('renderDashboard', window.renderDashboard);
        break;
      case 'notifications':
        push('renderNotifications', window.renderNotifications);
        break;
      case 'tasks':
        push('renderDashboard', window.renderDashboard);
        push('renderNotifications', window.renderNotifications);
        break;
      case 'commissions':
        push('renderCommissions', window.renderCommissions);
        push('renderLedger', window.renderLedger);
        break;
      case 'calendar':
        push('renderCalendar', window.renderCalendar);
        break;
      case 'settings':
        push('renderExtrasRegistry', renderExtrasRegistry);
        break;
      case 'workbench':
        push('renderWorkbench', resolveWorkbenchRenderer());
        break;
      default:
        break;
    }
    return hits.some(Boolean);
  }

  (function installAppDataChangedHandler(){
    if(window.__APP_DATA_REFRESH_WIRED__ || listenerRegistry.appDataChanged){
      window.__APP_DATA_REFRESH_WIRED__ = true;
      if(isDebug && listenerRegistry.appDataChanged && console && typeof console.info === 'function'){
        console.info('[DEBUG] app:data:changed listener already registered');
      }
      return;
    }
    window.__APP_DATA_REFRESH_WIRED__ = true;
    let burstCount = 0;
    let burstStart = 0;
    let burstWarned = false;
    const BURST_WINDOW = 600;
    const handler = function(evt){
      const detail = evt && evt.detail ? evt.detail : {};
      const now = Date.now();
      if(!burstStart || (now - burstStart) > BURST_WINDOW){
        burstStart = now;
        burstCount = 1;
        burstWarned = false;
      }else{
        burstCount += 1;
        if(!burstWarned && burstCount > 1 && console && typeof console.warn === 'function'){
          burstWarned = true;
          console.warn('[WARN] Multiple app:data:changed events detected', {
            count: burstCount,
            windowMs: now - burstStart,
            detail
          });
        }
      }
      if(isDebug) sampleMemoryTrend();
      const partial = detail ? detail.partial : null;
      const detailScope = typeof detail.scope === 'string' ? detail.scope : null;
      const partialScope = partial && typeof partial === 'object' && typeof partial.scope === 'string' ? partial.scope : null;
      if(detailScope !== 'selection' && partialScope !== 'selection'){
        clearAllSelectionScopes();
      }
      if(partial){
        const lanes = [];
        if(typeof partial === 'string'){ lanes.push(partial); }
        else if(Array.isArray(partial)){ partial.forEach(value => { if(typeof value === 'string') lanes.push(value); }); }
        else if(typeof partial === 'object'){
          if(typeof partial.lane === 'string') lanes.push(partial.lane);
          if(Array.isArray(partial.lanes)) partial.lanes.forEach(value => { if(typeof value === 'string') lanes.push(value); });
        }
        if(lanes.some(token => typeof token === 'string' && token.startsWith('pipeline:'))){
          return;
        }
        const scopeSource = detailScope || partialScope;
        if(scopeSource && refreshByScope(scopeSource, detail.action)) return;
      }
      if(window.RenderGuard && typeof window.RenderGuard.requestRender === 'function'){
        try{ window.RenderGuard.requestRender(); }
        catch (err) { if(isDebug && console && typeof console.warn === 'function') console.warn('[app] requestRender preflight failed', err); }
      }
      scheduleAppRender();
    };
    if(document && typeof document.addEventListener === 'function'){
      document.addEventListener('app:data:changed', handler, { passive: true });
      listenerRegistry.appDataChanged = { handler, target: document };
      listenerRegistry.__count = (listenerRegistry.__count || 0) + 1;
    }
  })();

  window.__refreshByScope__ = refreshByScope;

  (function registerTestHooks(){
    const testApi = window.__test = window.__test || {};
    if(typeof testApi.waitForSettingsChange !== 'function'){
      testApi.waitForSettingsChange = () => new Promise(res => {
        const h = (evt) => {
          const scope = evt && evt.detail ? evt.detail.scope : undefined;
          if(scope === 'settings'){
            document.removeEventListener('app:data:changed', h);
            requestAnimationFrame(() => requestAnimationFrame(res));
          }
        };
        document.addEventListener('app:data:changed', h, { once:true });
      });
    }
    if(typeof testApi.nextPaint !== 'function'){
      testApi.nextPaint = () => new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
    }
  })();
})();

(function(){
  try {
    window.CRM = window.CRM || {};
    window.CRM.canaries = window.CRM.canaries || {};

    function markConsoleHideRequested(){
      window.CRM.canaries.consoleHideRequested = true;

      var el = document.querySelector('[data-ui="console-hide-requested"]');
      if (!el) {
        el = document.createElement('div');
        el.setAttribute('data-ui', 'console-hide-requested');
        el.style.display = 'none';
        document.body.appendChild(el);
      }
      try { window.dispatchEvent(new CustomEvent('native:hideConsole')); } catch(_){ }
    }

    const isHome = () => location.hash === '' || location.hash === '#/' || location.hash.startsWith('#/home');

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      if (isHome()) markConsoleHideRequested();
    } else {
      document.addEventListener('DOMContentLoaded', () => { if (isHome()) markConsoleHideRequested(); }, { once:true });
    }
    window.addEventListener('hashchange', () => { if (isHome()) markConsoleHideRequested(); });
  } catch(_) { /* policy: no console.error */ }
})();

// Honestify: automatically hide obviously unwired action controls, and unhide once wired
(function(){
  if (window.__HONESTIFY__) return; window.__HONESTIFY__ = true;

  function hasHandler(el){
    // Conservative: honor our standard wiring flags and inline onclick;
    // avoid DevTools-only APIs like getEventListeners.
    return !!(el.__wired || el.onclick || el.dataset.wired === '1');
  }
  function isNav(el){
    return el.tagName === 'A' && !!el.getAttribute('href');
  }
  function roleOf(el){
    return (el.getAttribute('data-action') || el.getAttribute('data-role') || '').trim();
  }

  const ACTION_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA']);
  const ACTION_ROLES = new Set([
    'button', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
    'tab', 'switch', 'checkbox', 'radio', 'combobox', 'listbox', 'link'
  ]);

  function isActionCandidate(el){
    if(el.hasAttribute('data-action')) return true;
    if(!el.hasAttribute('data-role')) return false;
    if(ACTION_TAGS.has(el.tagName)) return true;
    const explicitRole = (el.getAttribute('role') || '').trim().toLowerCase();
    if(explicitRole && ACTION_ROLES.has(explicitRole)) return true;
    if(typeof el.tabIndex === 'number' && el.tabIndex >= 0) return true;
    return false;
  }

  function sweep(){
    const nodes = document.querySelectorAll('button[data-action],a[data-action],[data-role]');
    nodes.forEach(el => {
      const autoHidden = el.dataset.autoHidden === '1';
      if(!isActionCandidate(el)){
        if(autoHidden){
          el.hidden = false; el.removeAttribute('aria-hidden'); delete el.dataset.autoHidden;
        }
        return;
      }
      const role = roleOf(el);
      if (!role) return;           // nothing to judge
      if (isNav(el)) return;       // real links stay visible
      if (hasHandler(el)) {
        // If we previously auto-hid this and it became wired, unhide.
        if (autoHidden) {
          el.hidden = false; el.removeAttribute('aria-hidden'); delete el.dataset.autoHidden;
        }
        return;
      }
      // Unwired & not a link → hide but reversible once wired later.
      if (!el.hidden) {
        el.hidden = true; el.setAttribute('aria-hidden','true'); el.dataset.autoHidden = '1';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sweep, { once:true });
  } else {
    sweep();
  }
  if (window.RenderGuard && typeof window.RenderGuard.registerHook === 'function') {
    try { window.RenderGuard.registerHook(() => { setTimeout(sweep, 0); }); } catch (_) {}
  }
})();

// Load SVG sanitizer (no-op if already loaded)
try{
  import(fromHere('./ux/svg_sanitizer.js')).catch(() => {});
}catch (_) { }

// Inject a tiny data-URL favicon to stop 404 noise without touching HTML
(function(){
  try {
    if (!document.querySelector('link[rel="icon"]')) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      // simple neutral dot icon
      link.href = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="%23555"/></svg>';
      document.head.appendChild(link);
    }
  } catch (_) {}
})();
