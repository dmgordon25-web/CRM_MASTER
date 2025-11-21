import { initDashboard } from './dashboard/index.js';
import './boot/splash_sequence.js';
import './state/selectionStore.js';
import './dashboard/kpis.js';
import './relationships/index.js';
import { openPartnerEditModal, closePartnerEditModal } from './ui/modals/partner_edit/index.js';
import { closeSingletonModal } from './ui/modal_singleton.js';
import { ensureActionBarPostPaintRefresh } from './ui/action_bar.js';
import { normalizeStatus } from './pipeline/constants.js';
import { createInlineLoader } from '../components/Loaders/InlineLoader.js';
import { attachLoadingBlock, detachLoadingBlock } from './ui/loading_block.js';
import flags from './settings/flags.js';
import { initColumnsSettingsPanel } from './settings/columns_tab.js';
import { getUiMode, isSimpleMode, onUiModeChanged } from './ui/ui_mode.js';
import { closeContactEditor } from './editors/contact_entry.js';
import { getRenderer } from './app_services.js';
import { initAppContext, getSettingsApi } from './app_context.js';
import { renderDashboardView, renderContactsView, renderPipelineView, renderPartnersView } from './render.js';

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
  initAppContext({ settings: typeof window !== 'undefined' ? window.Settings : null });
  window.CRM.getSettings = getSettingsApi;

  const featureFlags = flags || {};
  const notificationsEnabled = featureFlags.notificationsMVP === true;

  let labsBundlePromise = null;

  function loadLabsBundle(){
    if(!labsBundlePromise){
      try { console.info('[labs] requesting bundle'); }
      catch (_) {}
      labsBundlePromise = import(fromHere('./labs/entry.js'))
        .then((mod) => {
          try { console.info('[labs] bundle ready'); }
          catch (_) {}
          return mod;
        })
        .catch((error) => {
          labsBundlePromise = null;
          throw error;
        });
    }
    return labsBundlePromise;
  }

  function bootLabs(root){
    if(!root || root.__labsLoaderPromise) return;
    if(root.dataset) delete root.dataset.labsReady;
    root.innerHTML = '';
    const loadingCard = document.createElement('section');
    loadingCard.className = 'card';
    loadingCard.dataset.qa = 'labs-loading';
    loadingCard.innerHTML = '<strong>Loading Labs...</strong><p class="muted">Fetching experimental widgets.</p>';
    root.appendChild(loadingCard);
    root.setAttribute('aria-busy', 'true');

    root.__labsLoaderPromise = loadLabsBundle()
      .then((mod) => {
        const init = typeof mod?.initLabs === 'function'
          ? mod.initLabs
          : typeof mod?.default === 'function'
            ? mod.default
            : null;
        if(!init){
          throw new Error('Labs module missing initLabs export');
        }
        return init(root);
      })
      .then(() => {
        if(root.dataset) root.dataset.labsReady = '1';
      })
      .catch((error) => {
        if(root.dataset) root.dataset.labsReady = 'error';
        root.innerHTML = '';
        const errorCard = document.createElement('section');
        errorCard.className = 'card';
        errorCard.dataset.qa = 'labs-error';
        errorCard.innerHTML = '<h2>Labs unavailable</h2><p class="muted">Labs are not available in this build. This does <strong>not</strong> affect your main CRM data.</p>';
        const retryRow = document.createElement('div');
        retryRow.className = 'row';
        retryRow.style.gap = '8px';
        retryRow.style.marginTop = '12px';
        const retryBtn = document.createElement('button');
        retryBtn.type = 'button';
        retryBtn.className = 'btn';
        retryBtn.dataset.qa = 'labs-retry';
        retryBtn.textContent = 'Retry';
        retryBtn.addEventListener('click', () => {
          if(root.dataset) delete root.dataset.labsReady;
          if(root.__labsLoaderPromise) return;
          bootLabs(root);
        });
        retryRow.appendChild(retryBtn);
        errorCard.appendChild(retryRow);
        root.appendChild(errorCard);
        try { console.warn('[labs] bootstrap failed', error); }
        catch (_) {}
        try { root.removeAttribute('data-mounted'); }
        catch (_) {}
      })
      .finally(() => {
        root.removeAttribute('aria-busy');
        root.__labsLoaderPromise = null;
      });
  }

  function getActionBarNode(){
    if(typeof document === 'undefined') return null;
    return document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar');
  }

  function ensureActionBarIdleState(){
    const bar = getActionBarNode();
    if(!bar) return;
    try { bar.classList.remove('has-selection'); }
    catch (_) {}
    if(bar.dataset){
      if(!bar.dataset.count) bar.dataset.count = '0';
      bar.dataset.idleVisible = '1';
      bar.dataset.visible = '1';
    }
    try { bar.setAttribute('data-visible', '1'); }
    catch (_) {}
    if(bar.style && bar.style.display === 'none'){
      bar.style.display = '';
    }
  }

  const ACTION_BAR_VISIBLE_ROUTES = new Set(['dashboard','leads','longshots','pipeline','partners','contacts']);
  if(notificationsEnabled){
    ACTION_BAR_VISIBLE_ROUTES.add('notifications');
  }

  const DEFAULT_ROUTE = 'dashboard';
  const ADVANCED_VIEWS = new Set(['reports', 'workbench', 'labs']);

  function applyActionBarIdleVisibility(route){
    const bar = getActionBarNode();
    if(!bar) return;
    const normalized = typeof route === 'string' ? route.trim().toLowerCase() : '';
    const shouldShow = ACTION_BAR_VISIBLE_ROUTES.has(normalized);
    if(shouldShow){
      if(bar.dataset){
        bar.dataset.idleVisible = '1';
        bar.dataset.visible = '1';
      }
      try { bar.setAttribute('data-visible', '1'); }
      catch (_) {}
      if(bar.style && bar.style.display === 'none'){
        bar.style.display = '';
      }
    }else{
      if(bar.dataset){
        bar.dataset.idleVisible = '0';
        delete bar.dataset.visible;
      }
      if(!bar.classList.contains('has-selection')){
        try { bar.removeAttribute('data-visible'); }
        catch (_) {}
      }
    }
    try { window.__UPDATE_ACTION_BAR_VISIBLE__?.(); }
    catch (_) {}
  }

  function applyNotificationsNavVisibility(enabled){
    if(typeof document === 'undefined') return;
    const btn = document.querySelector('#main-nav button[data-nav="notifications"]');
    if(!btn) return;
    const show = !!enabled;
    if(show){
      btn.style.display = '';
      btn.removeAttribute('aria-hidden');
      if(btn.hasAttribute('tabindex')) btn.removeAttribute('tabindex');
      btn.disabled = false;
    }else{
      btn.style.display = 'none';
      btn.setAttribute('aria-hidden', 'true');
      btn.setAttribute('tabindex', '-1');
      btn.disabled = true;
    }
  }

  function applyUiModeNavigation(mode){
    const simple = mode === 'simple';
    const navKeys = ['reports', 'workbench', 'labs'];
    navKeys.forEach((key) => {
      const btn = document.querySelector(`#main-nav button[data-nav="${key}"]`);
      if(!btn) return;
      btn.style.display = simple ? 'none' : '';
      btn.setAttribute('aria-hidden', simple ? 'true' : 'false');
      btn.disabled = simple;
      if(simple){
        btn.setAttribute('tabindex', '-1');
      }else if(btn.hasAttribute('tabindex')){
        btn.removeAttribute('tabindex');
      }
    });
    const workbenchView = document.getElementById('view-workbench');
    if(workbenchView){
      workbenchView.classList.toggle('hidden', simple);
      if(simple){
        workbenchView.setAttribute('aria-hidden', 'true');
      }else{
        workbenchView.removeAttribute('aria-hidden');
      }
    }
    const reportsView = document.getElementById('view-reports');
    if(reportsView){
      reportsView.classList.toggle('hidden', simple);
      if(simple){
        reportsView.setAttribute('aria-hidden', 'true');
      }else{
        reportsView.removeAttribute('aria-hidden');
      }
    }
    const labsView = document.getElementById('view-labs');
    if(labsView){
      labsView.classList.toggle('hidden', simple);
      if(simple){
        labsView.setAttribute('aria-hidden', 'true');
      }else{
        labsView.removeAttribute('aria-hidden');
      }
    }
  }

  const bootSplash = createBootSplashController();
  const listLoadingController = createListLoadingController();

  function createBootSplashController(){
    const doc = typeof document === 'undefined' ? null : document;
    let splash = null;
    let ensured = false;
    let hidden = false;

    const resolve = () => {
      if(!doc) return null;
      if(splash && splash.isConnected) return splash;
      splash = doc.getElementById('boot-splash');
      return splash;
    };

    const ensure = () => {
      const node = resolve();
      if(!node || ensured) return;
      if(node.classList && !node.classList.contains('boot-splash')){
        node.classList.add('boot-splash');
      }
      node.setAttribute('role', 'status');
      node.setAttribute('aria-live', 'polite');
      node.removeAttribute('aria-hidden');
      if(node.style && node.style.cssText){
        node.removeAttribute('style');
      }
      const loader = createInlineLoader({ document: doc, message: 'Loading CRM…', size: 'lg', inline: false });
      if(loader){
        loader.classList.add('boot-splash-loader');
        node.textContent = '';
        node.appendChild(loader);
      }else{
        node.textContent = 'Loading CRM…';
      }
      ensured = true;
    };

    const hide = () => {
      const node = resolve();
      if(!node || hidden) return;
      hidden = true;
      node.classList.add('is-hidden');
      node.setAttribute('aria-hidden', 'true');
    };

    return { ensure, hide };
  }

  function createListLoadingController(){
    const doc = typeof document === 'undefined' ? null : document;
    const TABLE_IDS_BY_VIEW = {
      dashboard: [
        'tbl-inprog',
        'tbl-status-active',
        'tbl-status-clients',
        'tbl-status-longshots',
        'tbl-longshots',
        'tbl-funded'
      ],
      contacts: [
        'tbl-clients',
        'tbl-status-active',
        'tbl-status-clients',
        'tbl-status-longshots'
      ],
      partners: ['tbl-partners'],
      pipeline: ['tbl-pipeline'],
      commissions: ['tbl-ledger-received', 'tbl-ledger-projected'],
      settings: ['tbl-doc-templates', 'tbl-msg-templates']
    };
    const DEFAULT_OPTIONS = Object.freeze({ lines: 6, reserve: 'table', minHeight: 280 });
    let depth = 0;
    let activeReleases = [];

    const findHost = (table) => {
      if(!table) return null;
      if(typeof table.closest === 'function'){
        const selectors = ['[data-loading-host]', '.card', '.table-card', '.status-table-wrap'];
        for(const selector of selectors){
          const candidate = table.closest(selector);
          if(candidate && candidate !== table) return candidate;
        }
      }
      const parent = table.parentElement;
      if(parent && parent !== table){
        if(!doc) return parent;
        if(parent !== doc.body && parent !== doc.documentElement){
          return parent;
        }
      }
      return null;
    };

    const collectHosts = () => {
      if(!doc) return [];
      const resolveView = () => {
        if(activeView) return activeView;
        try{ return viewFromHash(normalizedHash()); }
        catch (_err){ return null; }
      };
      const currentView = resolveView();
      const tableIds = TABLE_IDS_BY_VIEW[currentView] || TABLE_IDS_BY_VIEW.dashboard || [];
      const hosts = new Set();
      tableIds.forEach(id => {
        const table = doc.getElementById(id);
        if(!table) return;
        const host = findHost(table);
        if(host) hosts.add(host);
      });
      return Array.from(hosts);
    };

    return {
      begin(){
        if(!doc) return () => {};
        depth += 1;
        if(depth === 1){
          const hosts = collectHosts();
          activeReleases = hosts
            .map(host => {
              try{
                attachLoadingBlock(host, Object.assign({}, DEFAULT_OPTIONS));
                return () => detachLoadingBlock(host);
              }catch (_err){
                return null;
              }
            })
            .filter(fn => typeof fn === 'function');
          if(doc.body && hosts.length){
            doc.body.dataset.listLoading = '1';
          }
        }
        let released = false;
        return () => {
          if(released) return;
          released = true;
          if(depth > 0) depth -= 1;
          if(depth === 0){
            activeReleases.reverse().forEach(fn => {
              try{ fn(); }
              catch (_err){}
            });
            activeReleases = [];
            if(doc && doc.body){
              delete doc.body.dataset.listLoading;
            }
          }
        };
      }
    };
  }

  function onDomReady(fn){
    if(typeof document === 'undefined' || typeof fn !== 'function') return;
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    }else{
      fn();
    }
  }

  function ensurePartnerModalClosed(){
    try {
      // FIX: Use the correct key 'partner-edit'
      if(window.CRM_Modal && window.CRM_Modal.close){
         window.CRM_Modal.close('partner-edit', { remove: true });
      } else {
         // Legacy fallback
         const node = document.querySelector('[data-ui="partner-edit-modal"]');
         if(node) {
           node.classList.add('hidden');
           node.style.display = 'none';
           if(node.tagName==='DIALOG' && node.open) node.close();
         }
      }
    } catch (_) {}
  }

  ensurePartnerModalClosed();
  ensureActionBarIdleState();
  applyActionBarIdleVisibility(DEFAULT_ROUTE);
  applyNotificationsNavVisibility(notificationsEnabled);
  applyUiModeNavigation(getUiMode());

  function ensureDefaultRoute(){
    if(typeof window === 'undefined' || !window?.location) return;
    const hash = typeof window.location.hash === 'string' ? window.location.hash.trim() : '';
    if(!notificationsEnabled && hash === '#notifications'){
      const targetHash = `#/${DEFAULT_ROUTE}`;
      try {
        window.location.hash = targetHash;
      } catch (_) {}
      return;
    }
    if(hash && hash !== '#') return;
    const targetHash = `#/${DEFAULT_ROUTE}`;
    try {
      window.location.hash = targetHash;
      return;
    } catch (_err) {}
    try {
      const { pathname = '', search = '' } = window.location;
      if(window.history && typeof window.history.replaceState === 'function'){
        window.history.replaceState(null, '', `${pathname}${search}${targetHash}`);
      }
    } catch (__err) {}
  }

  ensureDefaultRoute();

  onDomReady(() => {
    ensurePartnerModalClosed();
    ensureActionBarIdleState();
    applyActionBarIdleVisibility(DEFAULT_ROUTE);
    applyNotificationsNavVisibility(notificationsEnabled);
    ensureDefaultRoute();
    bootSplash.ensure();
  });

  try {
    window.Selection?.clear?.('app:boot');
  } catch (_) {}
  try {
    window.SelectionService?.clear?.('app:boot');
  } catch (_) {}
  try {
    window.SelectionStore?.clear?.('partners');
  } catch (_) {}
  ensureActionBarIdleState();
  applyActionBarIdleVisibility(DEFAULT_ROUTE);
  applyNotificationsNavVisibility(notificationsEnabled);
  try {
    window.Selection?.clear?.('app:boot');
  } catch (_) {}
  try {
    window.SelectionService?.clear?.('app:boot');
  } catch (_) {}
  try {
    window.SelectionStore?.clear?.('partners');
  } catch (_) {}
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
    import(fromHere('./debug/overlay.js'))
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

  (function wireNotifications(){
    if (window.__NOTIFY_WIRED__) return; window.__NOTIFY_WIRED__ = true;

    if (!notificationsEnabled) {
      applyNotificationsNavVisibility(false);
      try {
        if (typeof location !== 'undefined' && location.hash === '#notifications') {
          goto(`#/${DEFAULT_ROUTE}`);
        }
      } catch (_) {}
      return;
    }

    try { import(fromHere('./notifications/notifier.js')); } catch (_) { }

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
      const targetHash = VIEW_HASH.notifications || '#notifications';
      try {
        history.replaceState(null, '', targetHash);
      } catch (_) {
        try { window.location.hash = targetHash; }
        catch (__) {}
      }
    }

    document.addEventListener('click', (evt) => {
      const a = evt.target.closest('[data-nav="notifications"], a[href="#notifications"], button[data-page="notifications"], button[data-nav="notifications"]');
      if (a) goNotifications(evt);
    });

    if (typeof location !== 'undefined' && location.hash === '#notifications') goNotifications();

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
        console.warn('[soft] automation surface render failed', err);
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
      const has = document.querySelector('[data-doc-center], #doc-center, #settings-docs, .doc-center, [data-panel="doc-center"]');
      if (has) import(fromHere('./doc/doc_center_enhancer.js')).catch(()=>{});
    }

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
    const perfEnabled = typeof performance !== 'undefined'
      && typeof performance.now === 'function'
      && window.__CRM_DEBUG_PERF;
    const perfStart = perfEnabled ? performance.now() : 0;
    const renderer = getRenderer();
    const hasRenderAll = typeof renderer === 'function';
    if(!hasRenderAll){
      if(!window.__RENDER_ALL_MISSING_LOGGED__ && console && typeof console.warn === 'function'){
        window.__RENDER_ALL_MISSING_LOGGED__ = true;
        console.warn('[soft] renderAll missing — module load failed or not executed');
      }
      bootSplash.hide();
      return;
    }
    if(window.__RENDER_ALL_MISSING_LOGGED__){
      window.__RENDER_ALL_MISSING_LOGGED__ = false;
    }
    bootSplash.ensure();
    let releaseListLoading = null;
    if(listLoadingController && typeof listLoadingController.begin === 'function'){
      try { releaseListLoading = listLoadingController.begin(); }
      catch (_err) { releaseListLoading = null; }
    }
    const release = () => {
      if(!releaseListLoading) return;
      try { releaseListLoading(); }
      catch (_err) {}
      releaseListLoading = null;
    };
    try{
      const result = renderer();
      if(result && typeof result.then === 'function'){
        result.catch(err => console.warn('[soft] [app] renderAll failed', err))
          .finally(() => {
            bootSplash.hide();
            release();
            if(perfEnabled){
              try { console.log('[PERF] renderAll', (performance.now() - perfStart).toFixed(1), 'ms'); }
              catch (_) {}
            }
          });
        return;
      }
      bootSplash.hide();
      release();
      if(perfEnabled){
        try { console.log('[PERF] renderAll', (performance.now() - perfStart).toFixed(1), 'ms'); }
        catch (_) {}
      }
    }catch (err) {
      console.warn('[soft] [app] renderAll failed', err);
      bootSplash.hide();
      release();
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
        result.catch(err => console.warn('[soft] [app] ' + label + ' repaint failed', err));
      }
    }catch (err) {
      console.warn('[soft] [app] ' + label + ' repaint failed', err);
    }
    return true;
  }

  function refreshByScope(scope, action){
    const key = String(scope || '').toLowerCase();
    if(!key) return false;

    // Map scopes to their container IDs
    const viewMap = {
      'workbench': 'view-workbench',
      'pipeline': 'view-pipeline',
      'dashboard': 'view-dashboard',
      'partners': 'view-partners',
      'contacts': 'view-contacts'
    };

    // FIX: Check visibility defensively (works in browsers AND test stubs)
    if(viewMap[key]){
      const root = document.getElementById(viewMap[key]);
      let isHidden = false;
      if(root){
         if(root.hidden) isHidden = true;
         else if(root.style && root.style.display === 'none') isHidden = true;
         else if(root.classList && typeof root.classList.contains === 'function' && root.classList.contains('hidden')) isHidden = true;
      }

      if(isHidden){
        // Mark stale and return TRUE to prevent full re-render fallback
        if(root) root.dataset.isStale = '1';
        return true;
      }
    }

    const hits = [];
    const push = (label, fn) => {
      const handled = invokeRenderer(label, fn);
      hits.push(handled);
      return handled;
    };

    switch(key){
      case 'dashboard':
        push('renderDashboardView', renderDashboardView);
        break;
      case 'partners':
        push('renderPartnersView', renderPartnersView);
        break;
      case 'contacts':
      case 'longshots':
        push('renderContactsView', renderContactsView);
        push('renderDashboardView', renderDashboardView);
        break;
      case 'pipeline':
        push('renderPipelineView', renderPipelineView);
        push('renderDashboardView', renderDashboardView);
        break;
      case 'notifications':
        push('renderNotifications', window.renderNotifications);
        break;
      case 'tasks':
        push('renderDashboardView', renderDashboardView);
        push('renderNotifications', window.renderNotifications);
        break;
      case 'documents':
        push('renderDashboardView', renderDashboardView);
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
    const KNOWN_SCOPES = new Set([
      'dashboard','partners','contacts','notifications','tasks','pipeline','longshots','commissions','calendar','settings','workbench','documents'
    ]);
    const DASHBOARD_DATA_SCOPES = new Set(['contacts','partners','pipeline','tasks','documents']);
    const notifyDashboardInvalidation = (scopes) => {
      const list = Array.isArray(scopes) ? scopes : [scopes];
      const dataApi = typeof window.invalidateDashboardData === 'function' ? window.invalidateDashboardData : null;
      const settingsApi = typeof window.invalidateDashboardSettings === 'function' ? window.invalidateDashboardSettings : null;
      if(dataApi){
        try{ dataApi(list); }
        catch (_err){}
      }
      if(settingsApi && list.some(scope => String(scope||'').toLowerCase() === 'settings')){
        try{ settingsApi(list); }
        catch (_err){}
      }
    };
    const APP_DATA_RENDER_DEBOUNCE_MS = 75;
    let pendingAppRenderScope = '';
    let appDataRenderTimer = null;
    const queueAppDataRender = (scopeLabel = 'full') => {
      const normalizedLabel = scopeLabel || 'full';
      if(normalizedLabel === 'full' || !pendingAppRenderScope){
        pendingAppRenderScope = normalizedLabel;
      }else if(pendingAppRenderScope !== 'full' && !pendingAppRenderScope.includes(normalizedLabel)){
        pendingAppRenderScope = `${pendingAppRenderScope},${normalizedLabel}`;
      }
      if(appDataRenderTimer) return;
      appDataRenderTimer = setTimeout(() => {
        const label = pendingAppRenderScope || 'full';
        pendingAppRenderScope = '';
        appDataRenderTimer = null;
        try{
          if(console && typeof console.log === 'function'){
            console.log('[APP_RENDER]', label, Date.now());
          }
        }catch (_) {}
        if(window.RenderGuard && typeof window.RenderGuard.requestRender === 'function'){
          try{ window.RenderGuard.requestRender(); }
          catch (err) { if(isDebug && console && typeof console.warn === 'function') console.warn('[app] requestRender preflight failed', err); }
        }
        scheduleAppRender();
      }, APP_DATA_RENDER_DEBOUNCE_MS);
    };
    const handler = function(evt){
      const detail = evt && evt.detail ? evt.detail : {};

      // FIX: Handle Delete All reload trigger
      if(detail.reason === 'deleteAll') {
         window.location.reload();
         return;
      }

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
      const normalizedDetailScope = detailScope ? detailScope.toLowerCase() : null;
      const normalizedPartialScope = partialScope ? partialScope.toLowerCase() : null;
      const selectionOnly = normalizedDetailScope === 'selection' || normalizedPartialScope === 'selection';
      if(!selectionOnly){
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
        if(scopeSource){
          const scopeKey = String(scopeSource || '').toLowerCase();
          if(DASHBOARD_DATA_SCOPES.has(scopeKey) || scopeKey === 'settings'){
            notifyDashboardInvalidation(scopeKey);
          }
          if(scopeKey === 'selection') return;
          if(scopeKey === 'pipeline' && lanes.some(token => typeof token === 'string' && token.startsWith('pipeline:'))){
            return;
          }
          if(KNOWN_SCOPES.has(scopeKey)){
            const handled = refreshByScope(scopeKey, detail.action);
            if(handled) return;
          }
        }
      }
      if(selectionOnly){
        return;
      }
      const scopeCandidates = [];
      if(detailScope) scopeCandidates.push(detailScope);
      if(partialScope && partialScope !== detailScope) scopeCandidates.push(partialScope);
      scopeCandidates.forEach(scope => {
        const key = String(scope||'').toLowerCase();
        if(DASHBOARD_DATA_SCOPES.has(key) || key === 'settings') notifyDashboardInvalidation(key);
      });
      const hasScope = scopeCandidates.length > 0;
      const unknownScope = scopeCandidates.some(scope => !KNOWN_SCOPES.has(String(scope||'').toLowerCase()));
      if(!hasScope){
        try{ console && console.warn && console.warn('[app] app:data:changed missing scope', detail); }
        catch (_warn){}
      }else if(unknownScope){
        try{ console && console.warn && console.warn('[app] app:data:changed unknown scope', scopeCandidates, detail); }
        catch (_warn){}
      }
      const forceFull = detail && detail.mode === 'full-repaint';
      const shouldFullRender = forceFull || !hasScope || unknownScope;
      if(!shouldFullRender){
        let scopedHandled = false;
        scopeCandidates.forEach(scope => {
          const key = String(scope||'').toLowerCase();
          if(key === 'selection') return;
          scopedHandled = refreshByScope(key, detail.action) || scopedHandled;
        });
        if(scopedHandled) return;
      }
      const renderScopeLabel = shouldFullRender
        ? 'full'
        : (scopeCandidates
          .map(scope => String(scope || '').toLowerCase())
          .filter(label => label && label !== 'selection')
          .join(',') || 'full');
      queueAppDataRender(renderScopeLabel);
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
  
  // --- INIT FUNCTION REPLACEMENT ---
  (async function init(){
    await openDB();
    let partners = await dbGetAll('partners');
    
    if(!partners.find(p=> String(p.id)===NONE_PARTNER_ID || (p.name && p.name.toLowerCase()==='none'))){
      const noneRecord = { id: NONE_PARTNER_ID, name:'None', company:'', email:'', phone:'', tier:'Keep in Touch' };
      try { await dbPut('partners', Object.assign({updatedAt: Date.now()}, noneRecord)); } catch(e){}
      partners.push(noneRecord);
    }

    // FIX: Smart Seeding (Seeds for CI, Respects User Delete)
    const isSuppressed = typeof localStorage !== 'undefined' && localStorage.getItem('crm:suppress-seed') === '1';
    if (!isSuppressed) {
       await ensureSeedData(partners); 
    }

    await backfillUpdatedAt();
    scheduleAppRender();
    await renderExtrasRegistry();
    
    // Signal Boot Done
    window.__BOOT_DONE__ = window.__BOOT_DONE__ || {};
    window.__BOOT_DONE__.fatal = false;
    window.__BOOT_DONE__.core = 1;
    window.__BOOT_DONE__.patches = 0;
    window.__BOOT_DONE__.safe = false;

    // Fallback Animation Signal (Checks index.html global capture)
    if (!window.__BOOT_ANIMATION_COMPLETE__) {
        const globalBypass = (typeof window !== 'undefined' && window.__SKIP_BOOT_ANIMATION__ === true);
        window.__BOOT_ANIMATION_COMPLETE__ = { at: Date.now(), bypassed: globalBypass || true };
    }
  })();
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
      // Unwired & not a link ? hide but reversible once wired later.
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