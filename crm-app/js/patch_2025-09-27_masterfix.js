// patch_2025-09-27_masterfix.js — master fixes for event symmetry, selections, automations, calendar, and UX polish
export const __esModule = true;
let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){

    const INIT_KEY = 'patch_2025_09_27_masterfix';
    if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
    if(window.__INIT_FLAGS__[INIT_KEY]) return;
    window.__INIT_FLAGS__[INIT_KEY] = true;
    if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_2025-09-27_masterfix.js')){
      window.__PATCHES_LOADED__.push('/js/patch_2025-09-27_masterfix.js');
    }

    const queueMicro = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : (fn)=>Promise.resolve().then(fn);

    // --- Event listener symmetry -------------------------------------------------
    (function installDocumentListenerWrappers(){
      const doc = document;
      if(!doc || doc.addEventListener.__masterfixWrapped) return;
      const originalAdd = doc.addEventListener.bind(doc);
      const originalRemove = doc.removeEventListener.bind(doc);
      const handlerMap = new WeakMap();

      function getWrapped(fn){
        if(typeof fn !== 'function') return fn;
        let wrapped = handlerMap.get(fn);
        if(!wrapped){
          wrapped = function(){
            return fn.apply(this, arguments);
          };
          handlerMap.set(fn, wrapped);
        }
        return wrapped;
      }

      doc.addEventListener = function(type, listener, options){
        const wrapped = (typeof listener === 'function') ? getWrapped(listener) : listener;
        return originalAdd(type, wrapped, options);
      };
      doc.addEventListener.__masterfixWrapped = true;

      doc.removeEventListener = function(type, listener, options){
        if(typeof listener === 'function'){
          const wrapped = handlerMap.get(listener);
          if(wrapped){
            return originalRemove(type, wrapped, options);
          }
        }
        return originalRemove(type, listener, options);
      };
    })();

    // --- Render guard ------------------------------------------------------------
    const RenderGuard = (function(){
      const existing = window.RenderGuard && typeof window.RenderGuard === 'object'
        ? window.RenderGuard
        : null;
      if(existing && typeof existing.enter === 'function'
        && typeof existing.exit === 'function'
        && typeof existing.isRendering === 'function'){
        return existing;
      }
      let depth = 0;
      const guard = {
        enter(){ depth += 1; },
        exit(){ if(depth>0) depth -= 1; },
        isRendering(){ return depth > 0; }
      };
      return Object.assign(existing || {}, guard);
    })();
    Object.defineProperty(window, 'RenderGuard', {
      configurable: true,
      enumerable: false,
      value: RenderGuard
    });

    (function patchDispatch(){
      const existing = typeof window.dispatchAppDataChanged === 'function'
        ? window.dispatchAppDataChanged
        : function(detail){
            document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
          };
      if(existing && existing.__masterfixWrapped) return;

      const base = existing;
      const wrapped = function(){
        if(RenderGuard.isRendering()){
          const ctx = this;
          const args = Array.from(arguments);
          queueMicro(()=>{
            if(RenderGuard.isRendering()){
              queueMicro(()=> wrapped.apply(ctx, args));
              return;
            }
            try{ base.apply(ctx, args); }
            catch (err) { console && console.warn && console.warn('dispatchAppDataChanged deferred', err); }
          });
          return;
        }
        return base.apply(this, arguments);
      };
      wrapped.__masterfixWrapped = true;
      window.dispatchAppDataChanged = wrapped;
    })();

    function wrapRenderer(name){
      const fn = window[name];
      if(typeof fn !== 'function' || fn.__masterfixWrapped) return;
      const wrapped = function(){
        RenderGuard.enter();
        let finished = false;
        const exit = ()=>{
          if(!finished){
            finished = true;
            RenderGuard.exit();
          }
        };
        try{
          const result = fn.apply(this, arguments);
          if(result && typeof result.then === 'function'){
            return result.then(value=>{ exit(); return value; }, err=>{ exit(); throw err; });
          }
          exit();
          return result;
        }catch (err) {
          exit();
          throw err;
        }
      };
      wrapped.__masterfixWrapped = true;
      window[name] = wrapped;
    }
    ['renderDashboard','renderKanban','renderCalendar'].forEach(wrapRenderer);

    // --- Stage canonicalization unification --------------------------------------
    (function patchDbGetAll(){
      const original = typeof window.dbGetAll === 'function' ? window.dbGetAll : null;
      if(!original || original.__masterfixWrapped) return;
      window.dbGetAll = async function(store){
        const result = await original.apply(this, arguments);
        if(store !== 'contacts' || !Array.isArray(result)) return result;
        const canonFn = typeof window.canonicalizeStage === 'function'
          ? window.canonicalizeStage
          : (val)=> String(val==null?'':val).trim().toLowerCase();
        return result.map(entry => {
          if(!entry || typeof entry !== 'object') return entry;
          const nextStage = canonFn(entry.stage);
          if(nextStage && entry.stage !== nextStage){
            const clone = Object.assign({}, entry, { stage: nextStage });
            if(clone.stageMap && typeof clone.stageMap === 'object' && !clone.stageMap[nextStage]){
              Object.keys(clone.stageMap).forEach(key => {
                const canonicalKey = canonFn(key);
                if(canonicalKey && canonicalKey !== key){
                  clone.stageMap[canonicalKey] = clone.stageMap[key];
                }
              });
            }
            return clone;
          }
          return entry;
        });
      };
      window.dbGetAll.__masterfixWrapped = true;
    })();

    function revealDashboardSections(){
      ['dashboard-filters','dashboard-kpis','dashboard-pipeline-overview','dashboard-today','referral-leaderboard','dashboard-stale']
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .forEach(node => {
          if(node.dataset.masterfixHidden){
            node.style.display = node.dataset.masterfixOriginalDisplay || '';
            delete node.dataset.masterfixHidden;
            delete node.dataset.masterfixOriginalDisplay;
          }
        });
    }

    (function hideLegacyDashboardShell(){
      ['dashboard-filters','dashboard-kpis','dashboard-pipeline-overview','dashboard-today','referral-leaderboard','dashboard-stale']
        .map(id => document.getElementById(id))
        .filter(Boolean)
        .forEach(node => {
          if(!node.dataset.masterfixHidden){
            node.dataset.masterfixHidden = '1';
            node.dataset.masterfixOriginalDisplay = node.style.display || '';
            node.style.display = 'none';
          }
        });
      wrapRenderer('renderDashboard');
      const original = window.renderDashboard;
      if(typeof original === 'function' && !original.__masterfixRevealWrapped){
        const wrapped = async function(){
          try{ return await original.apply(this, arguments); }
          finally{ revealDashboardSections(); }
        };
        wrapped.__masterfixWrapped = true;
        wrapped.__masterfixRevealWrapped = true;
        window.renderDashboard = wrapped;
      }
    })();

    // --- Selection storm coalescing ---------------------------------------------
    function detectTableType(table){
      if(!table) return 'contacts';
      const hints = [
        table.getAttribute('data-entity'),
        table.getAttribute('data-type'),
        table.getAttribute('aria-label'),
        table.dataset ? (table.dataset.scope || table.dataset.type) : null,
        table.id
      ].filter(Boolean).join(' ').toLowerCase();
      return hints.includes('partner') ? 'partners' : 'contacts';
    }

    function resolveCheckboxId(cb){
      if(!cb) return null;
      const attrId = cb.getAttribute('data-id') || cb.value;
      if(attrId) return String(attrId);
      const row = cb.closest('tr');
      if(row){
        return row.getAttribute('data-id') || row.dataset?.id || null;
      }
      return null;
    }

    function interceptSelectAll(cb){
      if(!cb || cb.__masterfixSelectAll) return;
      cb.__masterfixSelectAll = true;
      cb.addEventListener('change', evt => {
        const svc = window.SelectionService;
        if(!svc || !(svc.ids instanceof Set) || !(svc.items instanceof Map)) return;
        evt.stopImmediatePropagation();
        const shouldCheck = !!cb.checked;
        const table = cb.closest('table');
        const boxes = table ? Array.from(table.tBodies?.[0]?.querySelectorAll('input[type="checkbox"]') || []) : [];
        const ids = [];
        boxes.forEach(box => {
          box.checked = shouldCheck;
          const id = resolveCheckboxId(box);
          if(id) ids.push(id);
        });
        if(!ids.length){
          queueMicro(()=>{
            document.dispatchEvent(new CustomEvent('selection:changed', {
              detail: { type: svc.type || 'contacts', ids: Array.from(svc.getIds ? svc.getIds() : svc.ids) }
            }));
          });
          return;
        }
        const targetType = detectTableType(table);
        if(shouldCheck){
          if(svc.ids.size && svc.type !== targetType){
            svc.ids.clear();
            svc.items.clear();
          }
          svc.type = targetType;
          ids.forEach(id => {
            svc.ids.add(id);
            svc.items.set(id, { type: targetType });
          });
        } else {
          ids.forEach(id => {
            svc.ids.delete(id);
            svc.items.delete(id);
          });
          if(svc.ids.size === 0) svc.type = 'contacts';
        }
        if(typeof svc.syncChecks === 'function'){
          try{ svc.syncChecks(); }
          catch (err) { console && console.warn && console.warn('select-all sync', err); }
        }
        queueMicro(()=>{
          const detail = { type: svc.type || 'contacts', ids: Array.from(svc.ids) };
          try{ document.dispatchEvent(new CustomEvent('selection:changed', { detail })); }
          catch (err) { console && console.warn && console.warn('selection dispatch', err); }
        });
      }, { capture: true });
    }

    function installSelectAllInterceptors(){
      ['#inprog-all','#partners-all','#pipe-all','#clients-all','#ls-all','#status-active-all','#status-clients-all','#status-longshots-all']
        .map(sel => document.querySelector(sel))
        .filter(Boolean)
        .forEach(interceptSelectAll);
    }

    // --- Merge gating -----------------------------------------------------------
    function updateMergeButton(){
      const btn = document.querySelector('#actionbar [data-act="merge"]');
      if(!btn) return;
      const svc = window.SelectionService;
      const count = svc && typeof svc.count === 'function' ? svc.count() : (svc && svc.ids ? svc.ids.size : 0);
      const enabled = !!svc && (svc.type === 'contacts' || !svc.type) && count === 2;
      btn.disabled = !enabled;
      if(!enabled){
        btn.title = 'Select exactly two contacts to merge.';
      }else{
        btn.removeAttribute('title');
      }
    }

    function wireMergeGating(){
      document.addEventListener('selection:changed', updateMergeButton);
      queueMicro(updateMergeButton);
    }

    // --- Today card density -----------------------------------------------------
    function injectTodayDensity(){
      if(document.getElementById('masterfix-today-style')) return;
      const style = document.createElement('style');
      style.id = 'masterfix-today-style';
      style.textContent = `
        #dashboard-today .grid{max-height:420px;overflow:auto;padding-right:6px}
        #dashboard-today .grid .insight-list{font-size:13px}
        #dashboard-today .grid .insight-list li{font-size:13px}
      `;
      document.head.appendChild(style);
    }
    // --- Long Shots search ------------------------------------------------------
    const LONGSHOTS_SCOPE = 'longshots';
    const LONGSHOTS_TABLE = '#tbl-longshots';
    const HEADER_SEARCH_SELECTORS = [
      '[data-role="global-search"]',
      '[data-role="header-search"]',
      '[data-global-search]',
      '[data-search-scope]',
      '#global-search',
      '#header-search',
      '.header-search input[type="search"]'
    ];

    let longshotsActive = false;
    let longshotsLogSent = false;
    let longshotsObserver = null;

    function removeNode(node){
      if(!node) return;
      if(typeof node.remove === 'function'){ node.remove(); return; }
      if(node.parentNode){ node.parentNode.removeChild(node); }
    }

    function sendLongshotsLog(eventName){
      const body = JSON.stringify({ event: eventName });
      let delivered = false;
      try{
        const nav = typeof navigator !== 'undefined' ? navigator : null;
        if(nav && typeof nav.sendBeacon === 'function'){
          const blob = new Blob([body], { type:'application/json' });
          delivered = nav.sendBeacon('/__log', blob) === true;
        }
      }catch(_err){}
      if(delivered) return true;
      try{
        fetch('/__log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });
        return true;
      }catch(_err){}
      return false;
    }

    function noteLongshotsRemoval(){
      if(longshotsLogSent) return;
      longshotsLogSent = true;
      try{ console.info('[VIS] long-shots: advanced search removed'); }
      catch(_err){}
      sendLongshotsLog('longshots-adv-removed');
    }

    function findHeaderSearchInput(){
      if(typeof document === 'undefined') return null;
      for(const sel of HEADER_SEARCH_SELECTORS){
        let node = null;
        try{ node = document.querySelector(sel); }
        catch(_err){ node = null; }
        if(!node || !node.isConnected) continue;
        const input = node.matches && node.matches('input') ? node : node.querySelector && node.querySelector('input');
        if(input && input instanceof HTMLInputElement) return input;
      }
      return null;
    }

    function pruneLegacyLongshotsUi(){
      if(typeof document === 'undefined') return;
      const host = document.querySelector('#view-longshots');
      if(!host) return;
      const selectors = [
        '#btn-filters-longshots',
        '#btn-saveview-longshots',
        '#btn-delview-longshots',
        '#views-longshots',
        '.row.query-save-row',
        '.query-shell[data-query-scope="longshots"]',
        '.table-search input[data-table-search="#tbl-longshots"]',
        '.table-search'
      ];
      selectors.forEach(sel => {
        let node = null;
        try{ node = host.querySelector(sel); }
        catch(_err){ node = null; }
        if(!node) return;
        if(sel === '.table-search'){
          if(node.querySelector('input[data-table-search="#tbl-longshots"]')) removeNode(node);
          return;
        }
        removeNode(node);
      });
    }

    function stopLongshotsObserver(){
      if(longshotsObserver){
        try{ longshotsObserver.disconnect(); }
        catch(_err){}
        longshotsObserver = null;
      }
    }

    function applyHeaderSearchScope(){
      const input = findHeaderSearchInput();
      if(!input) return false;
      if(!input.__longshotsSearchSnapshot){
        input.__longshotsSearchSnapshot = {
          table: input.getAttribute('data-table-search'),
          scope: input.getAttribute('data-search-scope'),
          scopes: input.getAttribute('data-search-scopes'),
          target: input.getAttribute('data-search-target'),
          placeholder: input.getAttribute('placeholder'),
          aria: input.getAttribute('aria-label')
        };
      }
      input.setAttribute('data-table-search', LONGSHOTS_TABLE);
      input.dataset.tableSearch = LONGSHOTS_TABLE;
      input.setAttribute('data-search-scope', LONGSHOTS_SCOPE);
      input.dataset.searchScope = LONGSHOTS_SCOPE;
      input.setAttribute('data-search-scopes', LONGSHOTS_SCOPE);
      input.dataset.searchScopes = LONGSHOTS_SCOPE;
      input.setAttribute('data-search-target', LONGSHOTS_TABLE);
      input.dataset.searchTarget = LONGSHOTS_TABLE;
      input.setAttribute('placeholder', 'Search Long Shots');
      input.setAttribute('aria-label', 'Search Long Shots');
      try{ input.dispatchEvent(new Event('input', { bubbles: true })); }
      catch(_err){}
      noteLongshotsRemoval();
      return true;
    }

    function releaseHeaderSearchScope(){
      const input = findHeaderSearchInput();
      const snap = input && input.__longshotsSearchSnapshot ? input.__longshotsSearchSnapshot : null;
      if(!input || !snap) return;
      if(snap.table != null && snap.table !== undefined){
        input.setAttribute('data-table-search', snap.table);
        input.dataset.tableSearch = snap.table;
      }else{
        input.removeAttribute('data-table-search');
        try{ delete input.dataset.tableSearch; }
        catch(_err){}
      }
      if(snap.scope != null && snap.scope !== undefined){
        input.setAttribute('data-search-scope', snap.scope);
        input.dataset.searchScope = snap.scope;
      }else{
        input.removeAttribute('data-search-scope');
        try{ delete input.dataset.searchScope; }
        catch(_err){}
      }
      if(snap.scopes != null && snap.scopes !== undefined){
        input.setAttribute('data-search-scopes', snap.scopes);
        input.dataset.searchScopes = snap.scopes;
      }else{
        input.removeAttribute('data-search-scopes');
        try{ delete input.dataset.searchScopes; }
        catch(_err){}
      }
      if(snap.target != null && snap.target !== undefined){
        input.setAttribute('data-search-target', snap.target);
        input.dataset.searchTarget = snap.target;
      }else{
        input.removeAttribute('data-search-target');
        try{ delete input.dataset.searchTarget; }
        catch(_err){}
      }
      if(snap.placeholder != null && snap.placeholder !== undefined){
        input.setAttribute('placeholder', snap.placeholder);
      }else{
        input.removeAttribute('placeholder');
      }
      if(snap.aria != null && snap.aria !== undefined){
        input.setAttribute('aria-label', snap.aria);
      }else{
        input.removeAttribute('aria-label');
      }
      delete input.__longshotsSearchSnapshot;
    }

    function ensureLongshotsSearch(active){
      pruneLegacyLongshotsUi();
      if(!active){
        stopLongshotsObserver();
        releaseHeaderSearchScope();
        return;
      }
      if(applyHeaderSearchScope()){
        stopLongshotsObserver();
        return;
      }
      if(longshotsObserver || typeof MutationObserver !== 'function') return;
      const host = document.querySelector('.header-bar') || document.body;
      if(!host) return;
      longshotsObserver = new MutationObserver(()=>{
        if(applyHeaderSearchScope()){
          stopLongshotsObserver();
        }
      });
      try{ longshotsObserver.observe(host, { childList: true, subtree: true }); }
      catch(_err){ stopLongshotsObserver(); }
    }

    function handleLongshotsViewChange(view){
      const isActive = view === 'longshots';
      if(isActive === longshotsActive) return;
      longshotsActive = isActive;
      ensureLongshotsSearch(isActive);
    }

    if(typeof document !== 'undefined'){
      document.addEventListener('app:view:changed', (evt)=>{
        const detail = evt && evt.detail ? evt.detail : {};
        handleLongshotsViewChange(detail.view);
      });
      const bootstrap = ()=>{
        const main = document.getElementById('view-longshots');
        if(main && !main.classList.contains('hidden')){
          handleLongshotsViewChange('longshots');
        }
      };
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap, { once:true });
      else queueMicro(bootstrap);
    }

    function canonicalStageKey(value){
      if(typeof window.canonicalizeStage === 'function') return window.canonicalizeStage(value);
      const raw = String(value==null?'':value).trim().toLowerCase();
      if(!raw) return 'application';
      return raw.replace(/[\s_]+/g,'-');
    }

    function buildStageMap(source, stageKey, now){
      const map = {};
      if(source && typeof source === 'object' && !Array.isArray(source)){
        Object.keys(source).forEach(key => {
          const normalized = canonicalStageKey(key);
          const raw = source[key];
          const ts = typeof raw === 'number' ? raw : Date.parse(raw);
          if(!Number.isNaN(ts)) map[normalized] = ts;
        });
      }else if(source){
        const ts = typeof source === 'number' ? source : Date.parse(source);
        if(!Number.isNaN(ts)) map[stageKey] = ts;
      }
      if(!map[stageKey]) map[stageKey] = now;
      return map;
    }

    function laneKeyFromStage(stage){
      const canonical = canonicalStageKey(stage);
      switch(canonical){
        case 'lead':
        case 'long-shot':
          return 'long-shot';
        case 'preapproved':
          return 'preapproved';
        case 'application':
        case 'processing':
        case 'underwriting':
        case 'approved':
        case 'cleared-to-close':
        case 'funded':
        case 'post-close':
        case 'nurture':
        case 'lost':
        case 'denied':
          return canonical;
        case 'ctc':
          return 'cleared-to-close';
        default:
          return 'application';
      }
    }

    async function convertLongShotToPipeline(contactId){
      const id = String(contactId||'').trim();
      if(!id) throw new Error('convertLongShotToPipeline requires contactId');
      if(typeof openDB !== 'function' || typeof dbGet !== 'function' || typeof dbPut !== 'function'){
        throw new Error('convertLongShotToPipeline unavailable — database helpers missing');
      }
      await openDB();
      const existing = await dbGet('contacts', id);
      if(!existing) return { ok:false, reason:'missing' };
      const prevStage = canonicalStageKey(existing.stage || 'long-shot');
      const now = Date.now();
      const stageKey = canonicalStageKey('application');
      const status = 'inprogress';
      const stageMap = buildStageMap(existing.stageEnteredAt, stageKey, now);
      const pipelineMilestone = existing.pipelineMilestone || 'Intro Call';
      const updated = Object.assign({}, existing, {
        stage: stageKey,
        stageEnteredAt: stageMap,
        status,
        pipelineMilestone,
        updatedAt: now
      });
      if(updated.lossReason && stageKey!=='lost' && stageKey!=='denied') delete updated.lossReason;
      await dbPut('contacts', updated);

      let docsCreated = 0;
      let missingChanged = false;
      try{
        if(typeof window.ensureRequiredDocs === 'function'){
          const ensure = await window.ensureRequiredDocs(updated, { returnDetail:true });
          const docs = ensure && Array.isArray(ensure.docs) ? ensure.docs : null;
          docsCreated = ensure && typeof ensure.created === 'number' ? ensure.created : 0;
          if(typeof window.computeMissingDocsFrom === 'function'){
            let docList = docs;
            if(!Array.isArray(docList) && typeof window.dbGetAll === 'function'){
              const allDocs = await window.dbGetAll('documents').catch(()=>[]);
              docList = (allDocs||[]).filter(doc => doc && String(doc.contactId) === id);
            }
            if(Array.isArray(docList)){
              const missing = await window.computeMissingDocsFrom(docList, updated.loanType);
              const normalized = typeof missing === 'string' ? missing : '';
              if((updated.missingDocs || '') !== normalized){
                updated.missingDocs = normalized;
                updated.updatedAt = Date.now();
                await dbPut('contacts', updated);
                missingChanged = true;
              }
            }
          }
        }
      }catch (err) {
        console && console.warn && console.warn('convertLongShot docs', err);
      }

      const laneKey = laneKeyFromStage(stageKey);
      const detail = {
        source: 'longshots:convert',
        scope: 'contacts',
        contactId: id,
        id,
        action: 'stage',
        from: prevStage,
        to: stageKey,
        stage: stageKey,
        status,
        partial: { scope: 'pipeline', lane: laneKey ? `pipeline:${laneKey}` : 'pipeline:*' }
      };
      const actions = [];
      if(docsCreated){ actions.push({ action:'documents', contactId:id, created:docsCreated }); }
      if(missingChanged){ actions.push({ action:'contact', contactId:id, fields:['missingDocs'] }); }
      if(actions.length) detail.actions = actions;
      if(typeof window.dispatchAppDataChanged === 'function') window.dispatchAppDataChanged(detail);
      else document.dispatchEvent(new CustomEvent('app:data:changed', { detail }));
      return { ok:true, contact: updated, docsCreated, missingChanged };
    }

    window.convertLongShotToPipeline = convertLongShotToPipeline;

    // --- Calendar ICS export ----------------------------------------------------
    function toDateStrict(value){
      if(!value && value!==0) return null;
      if(value instanceof Date){
        return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
      }
      if(typeof value === 'number'){
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      if(typeof value === 'string'){
        const trimmed = value.trim();
        if(!trimmed) return null;
        if(/^\d{4}-\d{2}-\d{2}$/.test(trimmed)){
          const d = new Date(trimmed + 'T00:00:00');
          return Number.isNaN(d.getTime()) ? null : d;
        }
        const parsed = new Date(trimmed);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      return null;
    }

    let calendarExportsHooked = false;
    function ensureCalendarExports(){
      if (calendarExportsHooked) return;
      calendarExportsHooked = true;
      const apply = () => {
        if (window.CalendarExports && typeof window.CalendarExports.ensureButtons === 'function'){
          window.CalendarExports.ensureButtons();
        }
      };
      apply();
      document.addEventListener('calendar:exports:ready', apply, { once:true });
    }

    // --- Automation runner ------------------------------------------------------
    const MAX_AUTOMATIONS_PER_RUN = 25;
    const QUEUE_META_ID = 'automationsQueue';
    const RUN_LOCK = { busy: false };

    function toastSafe(message){
      try{
        if(typeof window.toast === 'function') window.toast(message);
        else console && console.log && console.log(message);
      }catch (_) { console && console.log && console.log(message); }
    }

    async function loadQueueRecord(){
      if(typeof openDB !== 'function' || typeof dbGet !== 'function') return { record: { id: QUEUE_META_ID, items: [] }, items: [] };
      await openDB();
      let record = null;
      try{ record = await dbGet('meta', QUEUE_META_ID); }
      catch (err) { console && console.warn && console.warn('automation queue load', err); }
      const items = Array.isArray(record?.items) ? record.items.slice() : [];
      return { record: record || { id: QUEUE_META_ID, items: items.slice() }, items };
    }

    async function persistQueue(record, items){
      if(typeof dbPut !== 'function') return;
      const payload = Object.assign({}, record || { id: QUEUE_META_ID }, { items });
      try{ await dbPut('meta', payload); }
      catch (err) { console && console.warn && console.warn('automation queue persist', err); }
    }

    const contactCache = new Map();
    async function ensureContact(contactId){
      const key = String(contactId||'');
      if(!key) return null;
      if(contactCache.has(key)) return contactCache.get(key);
      if(typeof openDB !== 'function' || typeof dbGet !== 'function') return null;
      await openDB();
      let record = null;
      try{ record = await dbGet('contacts', key); }
      catch (err) { console && console.warn && console.warn('automation contact load', err); }
      if(record && (!record.extras || typeof record.extras !== 'object')) record.extras = {};
      if(record && !Array.isArray(record.extras.timeline)) record.extras.timeline = [];
      contactCache.set(key, record || null);
      return record || null;
    }

    async function writeContact(contact){
      if(!contact || typeof dbPut !== 'function') return;
      try{ await dbPut('contacts', contact); }
      catch (err) { console && console.warn && console.warn('automation contact save', err); }
    }

    function ensureEmailModal(){
      let modal = document.getElementById('email-compose-modal');
      if(modal) return modal;
      modal = document.createElement('dialog');
      modal.id = 'email-compose-modal';
      modal.className = 'record-modal';
      modal.innerHTML = '<div class="dlg">\n      <div class="modal-header"><strong>Email Compose</strong><button type="button" class="btn" data-close>Close</button></div>\n      <div class="dialog-scroll"><div class="modal-body">\n        <label>To<input type="text" data-field="to" readonly></label>\n        <label>Subject<input type="text" data-field="subject"></label>\n        <label>Body<textarea data-field="body"></textarea></label>\n      </div></div>\n      <div class="modal-footer">\n        <button class="btn" type="button" data-open-mail>Open in default mail</button>\n        <button class="btn brand" type="button" data-copy>Copy to clipboard</button>\n      </div>\n    </div>';
      modal.addEventListener('click', evt => {
        if(evt.target && evt.target.closest('[data-close]')){
          evt.preventDefault();
          try{ modal.close(); }
          catch (_) { modal.removeAttribute('open'); modal.style.display='none'; }
        }
        if(evt.target && evt.target.closest('[data-open-mail]')){
          evt.preventDefault();
          const href = modal.dataset.mailto || '';
          if(!href) return;
          try{ window.location.href = href; }
          catch (_) { window.open(href, '_self'); }
        }
        if(evt.target && evt.target.closest('[data-copy]')){
          evt.preventDefault();
          const subj = modal.querySelector('[data-field="subject"]').value || '';
          const body = modal.querySelector('[data-field="body"]').value || '';
          const text = `Subject: ${subj}\n\n${body}`;
          try{
            if(navigator.clipboard && navigator.clipboard.writeText){
              navigator.clipboard.writeText(text).then(()=> toastSafe('Copied to clipboard'));
            }else{
              const ta = document.createElement('textarea');
              ta.value = text;
              document.body.appendChild(ta);
              ta.select();
              document.execCommand('copy');
              document.body.removeChild(ta);
              toastSafe('Copied to clipboard');
            }
          }catch (_) { toastSafe('Copy failed — select text manually.'); }
        }
      });
      modal.addEventListener('close', ()=>{ modal.removeAttribute('open'); modal.style.display='none'; });
      document.body.appendChild(modal);
      return modal;
    }

    function showEmailModal({to, subject, body, href}){
      const modal = ensureEmailModal();
      modal.dataset.mailto = href || '';
      const toField = modal.querySelector('[data-field="to"]');
      const subjField = modal.querySelector('[data-field="subject"]');
      const bodyField = modal.querySelector('[data-field="body"]');
      if(toField) toField.value = to || '';
      if(subjField) subjField.value = subject || '';
      if(bodyField) bodyField.value = body || '';
      modal.style.display = 'block';
      try{ modal.showModal(); }
      catch (_) { modal.setAttribute('open',''); }
    }

    function prepEmail(to, subject, body){
      const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);
      if(!recipients.length){ toastSafe('Missing email recipient'); return; }
      const toStr = recipients.join(',');
      const subj = subject || '';
      const content = body || '';
      const href = `mailto:${encodeURIComponent(toStr)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(content)}`;
      try{ window.open(href, '_self'); }
      catch (_) { window.location.href = href; }
      showEmailModal({ to: toStr, subject: subj, body: content, href });
    }

    async function createTask(contactId, payload){
      if(typeof openDB !== 'function' || typeof dbPut !== 'function') return null;
      await openDB();
      const now = Date.now();
      const due = payload && payload.due ? payload.due : '';
      const task = {
        id: payload && payload.id ? String(payload.id) : `auto-task-${contactId}-${now}`,
        contactId: String(contactId||''),
        title: payload && payload.title ? payload.title : 'Follow up',
        due: typeof due === 'string' ? due : (toDateStrict(due)?.toISOString().slice(0,10) || ''),
        status: 'open',
        createdAt: now,
        updatedAt: now,
        origin: 'automation'
      };
      await dbPut('tasks', task);
      if(typeof window.dispatchAppDataChanged === 'function'){
        window.dispatchAppDataChanged({ source:'automations', action:'task', contactId:String(contactId||'') });
      }
      return task;
    }

    async function logHistory(contactId, text, tag){
      const contact = await ensureContact(contactId);
      if(!contact) return null;
      if(!contact.extras || typeof contact.extras !== 'object') contact.extras = {};
      if(!Array.isArray(contact.extras.timeline)) contact.extras.timeline = [];
      const entry = {
        id: `hist:${Date.now()}:${Math.random().toString(16).slice(2,8)}`,
        when: new Date().toISOString(),
        text: text || 'Timeline entry',
        tag: tag || 'automation'
      };
      contact.extras.timeline.push(entry);
      contact.updatedAt = Date.now();
      await writeContact(contact);
      if(typeof window.dispatchAppDataChanged === 'function'){
        window.dispatchAppDataChanged({ source:'automations', action:'history', contactId:String(contactId||'') });
      }
      return entry;
    }

    async function processAutomationItem(item){
      if(!item || item.status !== 'queued') return { ok:false, skipped:true };
      const now = Date.now();
      try{
        if(item.type && item.type.startsWith('email:')){
          const payload = item.payload || {};
          prepEmail(payload.to || [], payload.subject || '', payload.body || '');
        }else if(item.type && item.type.startsWith('task:')){
          await createTask(item.contactId, item.payload || {});
        }else if(item.type && item.type.startsWith('log:')){
          const payload = item.payload || {};
          await logHistory(item.contactId, payload.text || 'Timeline entry', payload.tag || 'automation');
        }
        item.status = 'done';
        item.completedAt = now;
        document.dispatchEvent(new CustomEvent('automation:executed', { detail: { id: item.id, contactId: item.contactId } }));
        return { ok:true };
      }catch (err) {
        item.status = 'error';
        item.error = err && err.message ? err.message : String(err);
        item.completedAt = now;
        console && console.warn && console.warn('[soft] automation item', err);
        return { ok:false, error:err };
      }
    }

    async function runAutomationsDue(){
      if(RUN_LOCK.busy) return { processed:0, skipped:true };
      RUN_LOCK.busy = true;
      try{
        const { record, items } = await loadQueueRecord();
        if(!items.length) return { processed:0 };
        const now = Date.now();
        let success = 0;
        let failed = 0;
        while(true){
          const due = items
            .filter(item => item && item.status === 'queued' && Number(item.runAt||0) <= now)
            .sort((a,b)=> (a.runAt||0) - (b.runAt||0));
          if(!due.length) break;
          const batch = due.slice(0, MAX_AUTOMATIONS_PER_RUN);
          if(!batch.length) break;
          const hasMorePending = due.length > MAX_AUTOMATIONS_PER_RUN;
          for(const item of batch){
            const result = await processAutomationItem(item);
            if(result.ok) success += 1;
            else if(!result.skipped) failed += 1;
          }
          if(!hasMorePending) break;
        }
        if(!success && !failed) return { processed:0 };
        await persistQueue(record, items);
        if(success || failed){
          console && console.info && console.info(`[automations] processed ${success} item(s)${failed ? `, ${failed} error(s)` : ''}.`);
        }
        return { processed: success, failed };
      }finally{
        RUN_LOCK.busy = false;
      }
    }
    window.runAutomationsDue = runAutomationsDue;

    function scheduleAutomationRunner(){
      queueMicro(()=>{ runAutomationsDue(); });
    }

    (function installAutomationTriggers(){
      document.addEventListener('automation:enqueued', ()=> scheduleAutomationRunner());
      document.addEventListener('automation:catchup', ()=> scheduleAutomationRunner());
      let lastDaily = 0;
      const DAILY_KEY = 'automation:lastMasterfixDaily';
      try{ lastDaily = Number(localStorage.getItem(DAILY_KEY)||0); }
      catch (_) { lastDaily = 0; }
      function maybeDaily(force){
        const now = Date.now();
        if(force || !lastDaily || (now - lastDaily) > 86400000){
          lastDaily = now;
          try{ localStorage.setItem(DAILY_KEY, String(now)); }
          catch (_) { }
          scheduleAutomationRunner();
        }
      }
      document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) maybeDaily(false); });
      maybeDaily(true);
    })();

    // --- Automation bootstrap run ----------------------------------------------
    queueMicro(()=> runAutomationsDue());

    // --- DOMContentLoaded setup -------------------------------------------------
    function onReady(){
      installSelectAllInterceptors();
      wireMergeGating();
      injectTodayDensity();
      ensureCalendarExports();
      revealDashboardSections();
    }
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', onReady, { once:true });
    }else{
      onReady();
    }
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_2025-09-27_masterfix.init] already wired');
    window.CRM.health['patch_2025-09-27_masterfix'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-09-27_masterfix'] = 'ok';
    log('[patch_2025-09-27_masterfix.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-09-27_masterfix'] = 'error';
    error('[patch_2025-09-27_masterfix.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-09-27_masterfix'] = window.CRM.modules['patch_2025-09-27_masterfix'] || {};
window.CRM.modules['patch_2025-09-27_masterfix'].init = init;

