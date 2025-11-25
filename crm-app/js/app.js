import { initDashboard } from './dashboard/index.js';
import './boot/splash_sequence.js';     // <--- Boot Fix
import './state/selectionStore.js';     // <--- Selection Fix
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
      const current = typeof globalThis.location.hash === 'string' ? globalThis.location.hash : '';
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

  const notificationsEnabled = flags?.notificationsMVP === true;
  const DEFAULT_ROUTE = 'dashboard';

  function getActionBarNode(){ return document.querySelector('[data-ui="action-bar"]') || document.getElementById('actionbar'); }

  function ensureActionBarIdleState(){
    const bar = getActionBarNode(); if(!bar) return;
    try { bar.classList.remove('has-selection'); } catch(_){}
    if(bar.dataset) { bar.dataset.count='0'; bar.dataset.idleVisible='1'; bar.dataset.visible='1'; }
    bar.setAttribute('data-visible','1');
    if(bar.style) bar.style.display='';
  }

  function applyActionBarIdleVisibility(route){
    const bar = getActionBarNode(); if(!bar) return;
    const rt = (route||'').toLowerCase();
    const show = ['dashboard','leads','longshots','pipeline','partners','contacts'].includes(rt);
    if(show){
       if(bar.dataset) { bar.dataset.idleVisible='1'; bar.dataset.visible='1'; }
       bar.setAttribute('data-visible','1');
       bar.style.display='';
    } else {
       if(bar.dataset) { bar.dataset.idleVisible='0'; delete bar.dataset.visible; }
       if(!bar.classList.contains('has-selection')) bar.removeAttribute('data-visible');
    }
  }

  function applyNotificationsNavVisibility(en){
    const btn = document.querySelector('#main-nav button[data-nav="notifications"]');
    if(!btn) return;
    if(en) { btn.style.display=''; btn.disabled=false; }
    else { btn.style.display='none'; btn.disabled=true; }
  }

  function applyUiModeNavigation(mode){
    const simple = mode === 'simple';
    ['reports','workbench','labs'].forEach(key => {
       const btn = document.querySelector(`#main-nav button[data-nav="${key}"]`);
       if(btn) { btn.style.display = simple ? 'none' : ''; btn.disabled = simple; }
    });
    ['view-workbench', 'view-reports', 'view-labs'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.classList.toggle('hidden', simple);
    });
  }

  function ensurePartnerModalClosed(){
    try {
      if(window.CRM_Modal?.close) window.CRM_Modal.close('partner-edit', { remove: true });
      else {
         const node = document.querySelector('[data-ui="partner-edit-modal"]');
         if(node) { node.style.display='none'; if(node.open) node.close(); }
      }
    } catch (_) {}
  }

  // --- CRITICAL FIX: Restored Missing Helper Function ---
  function clearAllSelectionScopes(){
    const store = window.SelectionStore;
    if(store){
      ['contacts','partners','pipeline','notifications'].forEach(scope => {
        try { if(store.count(scope)) store.clear(scope); } catch(_){}
      });
    }
    try {
      if (typeof window !== 'undefined' && window.Selection && typeof window.Selection.clear === 'function') {
         window.Selection.clear('app:scopes-reset');
      }
    } catch (_) {}
    try { window.__UPDATE_ACTION_BAR_VISIBLE__?.(); } catch (_) {}
  }
  // -------------------------------------------------------

  ensurePartnerModalClosed();
  ensureActionBarIdleState();
  applyActionBarIdleVisibility(DEFAULT_ROUTE);
  applyNotificationsNavVisibility(notificationsEnabled);
  applyUiModeNavigation(getUiMode());

  function ensureDefaultRoute(){
     if(!window.location.hash || window.location.hash==='#') window.location.hash = '#/' + DEFAULT_ROUTE;
  }
  ensureDefaultRoute();

  if(typeof document !== 'undefined' && document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => {
        ensurePartnerModalClosed();
        ensureActionBarIdleState();
        applyActionBarIdleVisibility(DEFAULT_ROUTE);
        applyNotificationsNavVisibility(notificationsEnabled);
        ensureDefaultRoute();
    }, {once:true});
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
    if(viewMap[key]){
      const root = document.getElementById(viewMap[key]);
      if(root && (root.hidden || root.style.display === 'none')){
        root.dataset.isStale = '1';
        return true;
      }
    }
    const hits = [];
    const push = (fn) => { try{ fn(); hits.push(true); } catch(e){ console.warn(e); hits.push(false); }};

    switch(key){
      case 'dashboard': push(renderDashboardView); break;
      case 'partners': push(renderPartnersView); break;
      case 'contacts':
      case 'longshots': push(renderContactsView); push(renderDashboardView); break;
      case 'pipeline': push(renderPipelineView); push(renderDashboardView); break;
      case 'notifications': push(window.renderNotifications); break;
      case 'settings': push(renderExtrasRegistry); break;
      case 'workbench': if(typeof window.renderWorkbench==='function') push(window.renderWorkbench); break;
    }
    return hits.some(Boolean);
  }
  window.__refreshByScope__ = refreshByScope;

  if(typeof document !== 'undefined'){
      document.addEventListener('app:data:changed', (evt) => {
          const detail = evt.detail || {};

          // Handle Delete All reload trigger
          if(detail.reason === 'deleteAll') {
             window.location.reload();
             return;
          }

          if(detail.scope && detail.scope !== 'selection'){
              if(!refreshByScope(detail.scope, detail.action)) setTimeout(scheduleAppRender, 50);
          }
      });
  }

  function activate(view){
    let normalized = (view||'').trim().toLowerCase();
    if(!normalized) return;
    const previous = window.__ACTIVE_VIEW__;

    // Close Modals
    try { if(typeof closeContactEditor==='function') closeContactEditor(); } catch(_){}
    try { if(typeof closePartnerEditModal==='function') closePartnerEditModal(); } catch(_){}
    try { closeSingletonModal('contact-edit', {remove:false}); } catch(_){}

    document.querySelectorAll('main[id^="view-"]').forEach(m => m.classList.toggle('hidden', m.id !== 'view-' + normalized));
    document.querySelectorAll('#main-nav button[data-nav]').forEach(b => b.classList.toggle('active', b.getAttribute('data-nav')===normalized));

    window.__ACTIVE_VIEW__ = normalized;

    // RESTORE STALE
    const currentRoot = document.getElementById('view-' + normalized);
    if(currentRoot && currentRoot.dataset.isStale === '1'){
      delete currentRoot.dataset.isStale;
      refreshByScope(normalized);
    }

    applyActionBarIdleVisibility(normalized);

    // Clear selection on nav to prevent zombie state
    clearAllSelectionScopes();

    if(normalized === 'dashboard') renderDashboardView();
    if(normalized === 'pipeline') renderPipelineView();
    if(normalized === 'partners') renderPartnersView();

    const detail = { view: normalized, previous, element: currentRoot };
    document.dispatchEvent(new CustomEvent('app:navigate', { detail }));
    document.dispatchEvent(new CustomEvent('app:view:changed', { detail }));
  }

  const nav = document.getElementById('main-nav');
  if(nav) nav.addEventListener('click', e => {
      const btn = e.target.closest('button[data-nav]');
      if(btn) { e.preventDefault(); activate(btn.getAttribute('data-nav')); }
  });
  window.addEventListener('hashchange', () => {
      const h = window.location.hash.replace(/^#\/?/, '');
      if(h) activate(h);
  });
  const settingsBtn = document.getElementById('btn-open-settings');
  if(settingsBtn) settingsBtn.addEventListener('click', (e) => { e.preventDefault(); activate('settings'); });

  // --- INIT FUNCTION ---
  (async function init(){
    await openDB();
    let partners = await dbGetAll('partners');

    if(!partners.find(p=> String(p.id)===window.NONE_PARTNER_ID || (p.name && p.name.toLowerCase()==='none'))){
      const noneRecord = { id: window.NONE_PARTNER_ID, name:'None', company:'', email:'', phone:'', tier:'Keep in Touch' };
      try { await dbPut('partners', Object.assign({updatedAt: Date.now()}, noneRecord)); } catch(e){}
      partners.push(noneRecord);
    }

    // FIX: Smart Seeding
    const isSuppressed = typeof localStorage !== 'undefined' && localStorage.getItem('crm:suppress-seed') === '1';
    if (!isSuppressed) {
       await ensureSeedData(partners);
    }

    await backfillUpdatedAt();
    scheduleAppRender();
    if(typeof renderExtrasRegistry==='function') await renderExtrasRegistry();

    // Signal Boot Done
    window.__BOOT_DONE__ = window.__BOOT_DONE__ || {};
    window.__BOOT_DONE__.fatal = false;
    window.__BOOT_DONE__.core = 1;
    window.__BOOT_DONE__.patches = 0;
    window.__BOOT_DONE__.safe = false;

    // Fallback Animation Signal
    if (!window.__BOOT_ANIMATION_COMPLETE__) {
        const globalBypass = (typeof window !== 'undefined' && window.__SKIP_BOOT_ANIMATION__ === true);
        window.__BOOT_ANIMATION_COMPLETE__ = { at: Date.now(), bypassed: globalBypass || true };
    }
  })();

  // Helpers
  function resolveWorkbenchRenderer(){ return window.renderWorkbench; }
  async function backfillUpdatedAt(){ }
  async function ensureSeedData(existing){
      if(typeof window.__SEED_DATA__ !== 'undefined' && !window.__SEED_RAN__){
         window.__SEED_RAN__ = true;
      }
  }
  function scheduleAppRender(){ if(window.RenderGuard) window.RenderGuard.requestRender(); }
  async function renderExtrasRegistry(){ }
})();
