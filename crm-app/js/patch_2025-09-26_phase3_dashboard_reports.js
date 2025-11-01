// patch_2025-09-26_phase3_dashboard_reports.js — Phase 3 dashboard + reports
import { PIPELINE_STAGE_KEYS, stageKeyFromLabel as canonicalStageKey, stageLabelFromKey as canonicalStageLabel } from './pipeline/stages.js';
import { openContactModal } from './contacts.js';
import { openPartnerEditModal } from './ui/modals/partner_edit/index.js';
import { attachLoadingBlock, detachLoadingBlock } from './ui/loading_block.js';

const MODULE_LABEL = typeof __filename === 'string'
  ? __filename
  : 'crm-app/js/patch_2025-09-26_phase3_dashboard_reports.js';

let __wired = false;
function domReady(){ if(['complete','interactive'].includes(document.readyState)) return Promise.resolve(); return new Promise(r=>document.addEventListener('DOMContentLoaded', r, {once:true})); }
function ensureCRM(){ window.CRM = window.CRM || {}; window.CRM.health = window.CRM.health || {}; window.CRM.modules = window.CRM.modules || {}; }

function runPatch(){

    if(!window.__INIT_FLAGS__) window.__INIT_FLAGS__ = {};
    if(window.__INIT_FLAGS__.patch_2025_09_26_phase3_dashboard_reports) return;
    window.__INIT_FLAGS__.patch_2025_09_26_phase3_dashboard_reports = true;
    if(Array.isArray(window.__PATCHES_LOADED__) && !window.__PATCHES_LOADED__.includes('/js/patch_2025-09-26_phase3_dashboard_reports.js')){
      window.__PATCHES_LOADED__.push('/js/patch_2025-09-26_phase3_dashboard_reports.js');
    }

    const DAY_MS = 86400000;
    const PARTNER_NONE_ID = window.PARTNER_NONE_ID || window.NONE_PARTNER_ID || '00000000-0000-none-partner-000000000000';
    const BASE_PIPELINE_KEYS = PIPELINE_STAGE_KEYS.slice();
    const LANE_ORDER = BASE_PIPELINE_KEYS.concat(['post-close','nurture','lost','denied']);
    const PIPELINE_LANES = BASE_PIPELINE_KEYS.filter(key => key !== 'funded');
    const STAGE_LABELS = Object.assign(
      Object.fromEntries(BASE_PIPELINE_KEYS.map(key => [key, canonicalStageLabel(key)])),
      {
        'post-close': 'Post-Close',
        'nurture': 'Nurture',
        'lost': 'Lost',
        'denied': 'Denied'
      }
    );
    const LOSS_REASON_LABELS = {
      'no-docs':'Missing Documents',
      'rate':'Rate / Terms',
      'competitor':'Went with Competitor',
      'credit':'Credit',
      'withdrew':'Client Withdrew',
      'other':'Other',
      'timeline':'Timeline',
      'pricing':'Pricing',
      'uncategorized':'Unspecified'
    };

    const DASHBOARD_WIDGET_KEYS = [
      'focus',
      'filters',
      'kpis',
      'pipeline',
      'today',
      'leaderboard',
      'stale',
      'goalProgress',
      'numbersPortfolio',
      'numbersReferrals',
      'numbersMomentum',
      'pipelineCalendar',
      'priorityActions',
      'milestones',
      'docPulse',
      'relationshipOpportunities',
      'clientCareRadar',
      'closingWatch',
      'docCenter',
      'statusStack'
    ];
    const DASHBOARD_GRAPH_KEYS = ['goalProgress','numbersPortfolio','numbersMomentum','pipelineCalendar'];
    const DASHBOARD_WIDGET_CARD_KEYS = ['priorityActions','milestones','docPulse','relationshipOpportunities','clientCareRadar','closingWatch'];
    const DASHBOARD_KPI_KEYS = ['kpiNewLeads7d','kpiActivePipeline','kpiFundedYTD','kpiFundedVolumeYTD','kpiAvgCycleLeadToFunded','kpiTasksToday','kpiTasksOverdue','kpiReferralsYTD'];

    function buildDefaultToggleMap(keys){
      const map = {};
      keys.forEach(key => { map[key] = true; });
      return map;
    }

    const widgetDefaults = buildDefaultToggleMap(DASHBOARD_WIDGET_KEYS);
    widgetDefaults.pipeline = false;
    widgetDefaults.leaderboard = false;
    widgetDefaults.stale = false;
    const DASHBOARD_WIDGET_DEFAULTS = {
      mode: 'today',
      widgets: widgetDefaults,
      graphs: buildDefaultToggleMap(DASHBOARD_GRAPH_KEYS),
      widgetCards: buildDefaultToggleMap(DASHBOARD_WIDGET_CARD_KEYS),
      kpis: buildDefaultToggleMap(DASHBOARD_KPI_KEYS),
      order: DASHBOARD_WIDGET_KEYS.slice()
    };

    const WIDGET_SECTION_IDS = {
      focus: 'dashboard-focus',
      filters: 'dashboard-filters',
      kpis: 'dashboard-kpis',
      pipeline: 'dashboard-pipeline-overview',
      today: 'dashboard-today',
      leaderboard: 'referral-leaderboard',
      stale: 'dashboard-stale',
      goalProgress: 'goal-progress-card',
      numbersPortfolio: 'numbers-portfolio-card',
      numbersReferrals: 'numbers-referrals-card',
      numbersMomentum: 'numbers-momentum-card',
      pipelineCalendar: 'pipeline-calendar-card',
      priorityActions: 'priority-actions-card',
      milestones: 'milestones-card',
      docPulse: 'doc-pulse-card',
      relationshipOpportunities: 'rel-opps-card',
      clientCareRadar: 'nurture-card',
      closingWatch: 'closing-watch-card',
      docCenter: 'doc-center-card',
      statusStack: 'dashboard-status-stack'
    };

    const DASHBOARD_WIDGET_KEY_SET = new Set([].concat(DASHBOARD_WIDGET_KEYS, DASHBOARD_WIDGET_KEYS.map(key => key.toLowerCase())));
    const DASHBOARD_WIDGET_KEY_LOOKUP = new Map(DASHBOARD_WIDGET_KEYS.map(key => [key.toLowerCase(), key]));
    const DASHBOARD_ORDER_STORAGE_KEY = 'dashboard.widgets.order';
    const WIDGET_ID_TO_KEY = new Map(Object.entries(WIDGET_SECTION_IDS).flatMap(([key, id]) => {
      const value = String(id || '').trim();
      if(!value) return [];
      return [[value.toLowerCase(), key], [value, key]];
    }));
    const LEADERBOARD_SORT_STORAGE_KEY = 'referral.leaderboard.sort';
    const LEADERBOARD_FILTER_STORAGE_KEY = 'referral.leaderboard.filter';
    const LEADERBOARD_SORT_OPTIONS = new Set(['volume','active','conversion']);
    const LEADERBOARD_FILTER_OPTIONS = new Set(['all','active','funded']);

    function readStoredDashboardMode(){
      if(typeof localStorage === 'undefined') return null;
      try{
        const value = localStorage.getItem('dashboard:mode');
        return value === 'all' ? 'all' : (value === 'today' ? 'today' : null);
      }catch (_err) {
        return null;
      }
    }

    function writeStoredDashboardMode(mode){
      if(typeof localStorage === 'undefined') return;
      try{
        if(mode) localStorage.setItem('dashboard:mode', mode);
      }catch (_err) {}
    }

    function canonicalWidgetKey(input){
      if(input == null) return null;
      const str = String(input).trim();
      if(!str) return null;
      const lower = str.toLowerCase();
      if(DASHBOARD_WIDGET_KEY_LOOKUP.has(lower)) return DASHBOARD_WIDGET_KEY_LOOKUP.get(lower);
      if(WIDGET_ID_TO_KEY.has(lower)) return WIDGET_ID_TO_KEY.get(lower);
      return null;
    }

    function normalizeWidgetOrder(orderLike){
      const source = Array.isArray(orderLike) ? orderLike : [];
      const next = [];
      const seen = new Set();
      source.forEach(item => {
        const key = canonicalWidgetKey(item);
        if(key && !seen.has(key)){
          seen.add(key);
          next.push(key);
        }
      });
      DASHBOARD_WIDGET_KEYS.forEach(key => {
        if(!seen.has(key)){
          seen.add(key);
          next.push(key);
        }
      });
      return next;
    }

    function readStoredWidgetOrder(){
      if(typeof localStorage === 'undefined') return null;
      try{
        const raw = localStorage.getItem(DASHBOARD_ORDER_STORAGE_KEY);
        if(!raw) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : null;
      }catch (_err) {
        return null;
      }
    }

    function writeStoredWidgetOrder(order){
      if(typeof localStorage === 'undefined') return;
      try{
        if(order && order.length){
          localStorage.setItem(DASHBOARD_ORDER_STORAGE_KEY, JSON.stringify(order));
        }else{
          localStorage.removeItem(DASHBOARD_ORDER_STORAGE_KEY);
        }
      }catch (_err) {}
    }

    function readStoredLeaderboardPref(key){
      if(typeof localStorage === 'undefined') return '';
      try{
        return localStorage.getItem(key) || '';
      }catch(_err){
        return '';
      }
    }

    function writeStoredLeaderboardPref(key, value){
      if(typeof localStorage === 'undefined') return;
      try{
        if(value){
          localStorage.setItem(key, value);
        }else{
          localStorage.removeItem(key);
        }
      }catch(_err){}
    }

    function sanitizeLeaderboardSort(value){
      const key = String(value||'').toLowerCase();
      return LEADERBOARD_SORT_OPTIONS.has(key) ? key : 'volume';
    }

    function sanitizeLeaderboardFilter(value){
      const key = String(value||'').toLowerCase();
      return LEADERBOARD_FILTER_OPTIONS.has(key) ? key : 'all';
    }

    const state = {
      contacts: [],
      partners: [],
      tasks: [],
      contactMap: new Map(),
      partnerMap: new Map(),
      filters: {stage:'all', loanType:'all', partner:'all'},
      leaderboardPrefs: {
        sort: sanitizeLeaderboardSort(readStoredLeaderboardPref(LEADERBOARD_SORT_STORAGE_KEY)),
        filter: sanitizeLeaderboardFilter(readStoredLeaderboardPref(LEADERBOARD_FILTER_STORAGE_KEY))
      },
      reportView: 'stage',
      reportData: {},
      dataLoaded: false,
      lastLoad: 0,
      loadingPromise: null,
      pendingRender: null,
      dashboard: JSON.parse(JSON.stringify(DASHBOARD_WIDGET_DEFAULTS)),
      dashboardLoaded: false,
      dashboardPromise: null,
      lastAggregates: null
    };
    state.dashboard.order = normalizeWidgetOrder(state.dashboard.order);

    const dashboardLoadingCounts = new WeakMap();

    function beginLoadingForHost(host, options = {}){
      if(!host || typeof host !== 'object') return () => {};
      const previous = dashboardLoadingCounts.get(host) || 0;
      if(previous === 0){
        try{ attachLoadingBlock(host, options); }
        catch (_err){}
      }
      dashboardLoadingCounts.set(host, previous + 1);
      let released = false;
      return () => {
        if(released) return;
        released = true;
        const current = dashboardLoadingCounts.get(host) || 0;
        const next = Math.max(0, current - 1);
        if(next === 0){
          dashboardLoadingCounts.delete(host);
          try{ detachLoadingBlock(host); }
          catch (_err){}
        }else{
          dashboardLoadingCounts.set(host, next);
        }
      };
    }

    function beginDashboardLoading(hostOverride){
      const host = hostOverride || getDashboardContainer();
      if(!host) return () => {};
      return beginLoadingForHost(host, { lines: 6 });
    }

    const widgetDnD = {
      container: null,
      handlers: 0,
      pointerId: null,
      dragEl: null,
      dragKey: null,
      startIndex: -1,
      originX: 0,
      originY: 0,
      dragging: false,
      userSelectBackup: '',
      onPointerDown: null,
      onPointerMove: null,
      onPointerUp: null
    };

    function getDashboardContainer(){
      if(typeof document === 'undefined') return null;
      return document.querySelector('main[data-ui="dashboard-root"]')
        || document.getElementById('view-dashboard')
        || null;
    }

    function ensureWidgetAttributes(){
      const container = getDashboardContainer();
      if(!container) return;
      DASHBOARD_WIDGET_KEYS.forEach(key => {
        const id = WIDGET_SECTION_IDS[key];
        if(!id) return;
        const el = typeof id === 'string' ? document.getElementById(id) : null;
        if(el && container.contains(el)){
          el.setAttribute('data-dash-widget', key);
        }
      });
    }

    function applyWidgetOrderToDom(orderLike){
      const container = getDashboardContainer();
      if(!container) return DASHBOARD_WIDGET_KEYS.slice();
      ensureWidgetAttributes();
      const order = normalizeWidgetOrder(orderLike);
      order.forEach(key => {
        const id = WIDGET_SECTION_IDS[key];
        if(!id) return;
        const el = typeof id === 'string' ? document.getElementById(id) : null;
        if(el && container.contains(el)){
          container.appendChild(el);
        }
      });
      state.dashboard.order = order;
      return order;
    }

    function currentDomWidgetOrder(){
      const container = getDashboardContainer();
      if(!container) return normalizeWidgetOrder([]);
      const nodes = Array.from(container.children || []).filter(node => node && node.nodeType === 1 && node.hasAttribute('data-dash-widget'));
      const order = nodes.map(node => node.getAttribute('data-dash-widget'));
      return normalizeWidgetOrder(order);
    }

    function widgetFromPoint(x, y){
      if(typeof document === 'undefined') return null;
      const el = document.elementFromPoint(x, y);
      if(!el) return null;
      const tile = el.closest('[data-dash-widget]');
      if(!tile) return null;
      if(!widgetDnD.container || !widgetDnD.container.contains(tile)) return null;
      return tile;
    }

    function persistWidgetOrder(order){
      const normalized = normalizeWidgetOrder(order);
      state.dashboard.order = normalized;
      writeStoredWidgetOrder(normalized);
      if(window.Settings && typeof window.Settings.save === 'function'){
        Promise.resolve(window.Settings.save({ dashboardOrder: normalized })).catch(err => {
          if(console && console.warn) console.warn('dashboard order save failed', err);
        });
      }else{
        (async ()=>{
          try{
            await openDB();
            const record = await dbGet('settings', 'app:settings').catch(()=>null) || { id: 'app:settings' };
            const payload = Object.assign({}, record, { dashboardOrder: normalized });
            await dbPut('settings', payload);
          }catch (err) {
            if(console && console.warn) console.warn('dashboard order persist failed', err);
          }
        })();
      }
      return normalized;
    }

    function teardownWidgetDnD(){
      if(!widgetDnD.container) return;
      widgetDnD.container.removeEventListener('pointerdown', widgetDnD.onPointerDown);
      widgetDnD.container.removeEventListener('pointermove', widgetDnD.onPointerMove);
      widgetDnD.container.removeEventListener('pointerup', widgetDnD.onPointerUp);
      widgetDnD.container.removeEventListener('pointercancel', widgetDnD.onPointerUp);
      widgetDnD.container = null;
      widgetDnD.handlers = 0;
      widgetDnD.pointerId = null;
      widgetDnD.dragEl = null;
      widgetDnD.dragKey = null;
      widgetDnD.startIndex = -1;
      widgetDnD.dragging = false;
      widgetDnD.userSelectBackup = '';
    }

    function ensureWidgetDnDWired(){
      const container = getDashboardContainer();
      if(!container) return;
      if(widgetDnD.container === container) return;
      teardownWidgetDnD();

      widgetDnD.container = container;

      const handlePointerDown = (evt) => {
        if(widgetDnD.dragEl) return;
        if(evt.button !== 0 && evt.pointerType !== 'touch' && evt.pointerType !== 'pen') return;
        const tile = evt.target && evt.target.closest('[data-dash-widget]');
        if(!tile || !widgetDnD.container.contains(tile)) return;
        if(evt.target && evt.target.closest('button, a, input, textarea, select, [data-no-drag]')) return;
        const key = canonicalWidgetKey(tile.getAttribute('data-dash-widget') || tile.id);
        if(!key) return;
        widgetDnD.pointerId = evt.pointerId;
        widgetDnD.dragEl = tile;
        widgetDnD.dragKey = key;
        const order = currentDomWidgetOrder();
        widgetDnD.startIndex = order.indexOf(key);
        widgetDnD.originX = evt.clientX;
        widgetDnD.originY = evt.clientY;
        widgetDnD.dragging = false;
        widgetDnD.userSelectBackup = document.body ? document.body.style.userSelect : '';
        try{ tile.setPointerCapture(evt.pointerId); }
        catch (_err) {}
      };

      const handlePointerMove = (evt) => {
        if(!widgetDnD.dragEl || (widgetDnD.pointerId != null && evt.pointerId !== widgetDnD.pointerId)) return;
        if(!widgetDnD.dragging){
          const dx = evt.clientX - widgetDnD.originX;
          const dy = evt.clientY - widgetDnD.originY;
          if(Math.abs(dx) + Math.abs(dy) < 6) return;
          widgetDnD.dragging = true;
          if(document.body) document.body.style.userSelect = 'none';
          widgetDnD.dragEl.style.pointerEvents = 'none';
          widgetDnD.dragEl.style.opacity = '0.65';
          widgetDnD.dragEl.style.transition = 'none';
          console.info('[A_BEACON] dnd:widgets:drag-start', { id: widgetDnD.dragKey });
        }
        evt.preventDefault();
        const target = widgetFromPoint(evt.clientX, evt.clientY);
        if(!target || target === widgetDnD.dragEl) return;
        const rect = target.getBoundingClientRect();
        const before = evt.clientY < rect.top + rect.height / 2;
        if(before){
          if(target.previousElementSibling === widgetDnD.dragEl) return;
          widgetDnD.container.insertBefore(widgetDnD.dragEl, target);
        }else{
          if(target.nextElementSibling === widgetDnD.dragEl) return;
          widgetDnD.container.insertBefore(widgetDnD.dragEl, target.nextElementSibling);
        }
      };

      const handlePointerUp = (evt) => {
        if(!widgetDnD.dragEl) return;
        if(widgetDnD.pointerId != null && evt.pointerId != null && evt.pointerId !== widgetDnD.pointerId && evt.type !== 'pointercancel') return;
        const dragEl = widgetDnD.dragEl;
        const started = widgetDnD.dragging;
        const fromIndex = widgetDnD.startIndex;
        const key = widgetDnD.dragKey;
        if(widgetDnD.pointerId != null){
          try{ dragEl.releasePointerCapture(widgetDnD.pointerId); }
          catch (_err) {}
        }
        if(document.body) document.body.style.userSelect = widgetDnD.userSelectBackup || '';
        dragEl.style.pointerEvents = '';
        dragEl.style.opacity = '';
        dragEl.style.transition = '';
        widgetDnD.pointerId = null;
        widgetDnD.dragEl = null;
        widgetDnD.dragKey = null;
        widgetDnD.startIndex = -1;
        widgetDnD.dragging = false;
        widgetDnD.userSelectBackup = '';
        if(!started) return;
        evt.preventDefault();
        const order = currentDomWidgetOrder();
        const toIndex = order.indexOf(key);
        console.info('[A_BEACON] dnd:widgets:drop', { from: fromIndex, to: toIndex });
        if(fromIndex !== toIndex){
          persistWidgetOrder(order);
          queueDashboardRender({});
        }
      };

      widgetDnD.onPointerDown = handlePointerDown;
      widgetDnD.onPointerMove = handlePointerMove;
      widgetDnD.onPointerUp = handlePointerUp;

      console.info('[A_BEACON] dnd:widgets:handlers', { count: widgetDnD.handlers });
      container.addEventListener('pointerdown', handlePointerDown);
      container.addEventListener('pointermove', handlePointerMove);
      container.addEventListener('pointerup', handlePointerUp);
      container.addEventListener('pointercancel', handlePointerUp);
      widgetDnD.handlers = 4;
      console.info('[A_BEACON] dnd:widgets:handlers', { count: widgetDnD.handlers });
    }

    if(typeof document !== 'undefined'){
      document.addEventListener('app:view:changed', (evt) => {
        const detail = evt && evt.detail ? evt.detail : {};
        if(detail.view === 'dashboard'){
          applyWidgetOrderToDom(state.dashboard.order);
          ensureWidgetDnDWired();
        }else{
          teardownWidgetDnD();
        }
      });
    }

    const storedInitialMode = readStoredDashboardMode();
    if(storedInitialMode) state.dashboard.mode = storedInitialMode;

    function canonicalStage(value){
      if(typeof window.canonicalizeStage === 'function'){
        return window.canonicalizeStage(value);
      }
      return canonicalStageKey(value);
    }

    function laneKeyFromStage(stage){
      const canonical = canonicalStage(stage);
      if(LANE_ORDER.includes(canonical)) return canonical;
      if(canonical === 'ctc' || canonical === 'clear-to-close') return 'cleared-to-close';
      if(canonical === 'pre-app' || canonical === 'preapp') return 'preapproved';
      if(canonical === 'lead') return 'long-shot';
      return canonical;
    }

    function parseDate(value){
      if(!value && value!==0) return null;
      if(value instanceof Date){
        return Number.isNaN(value.getTime()) ? null : value;
      }
      if(typeof value === 'number'){
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(value);
      if(!Number.isNaN(d.getTime())) return d;
      if(typeof value === 'string' && value.length === 10){
        const iso = new Date(value + 'T00:00:00');
        if(!Number.isNaN(iso.getTime())) return iso;
      }
      return null;
    }

    function toTimestamp(value){
      const d = parseDate(value);
      return d ? d.getTime() : null;
    }

    function startOfDay(date){
      const d = date instanceof Date ? date : parseDate(date);
      if(!d) return null;
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function formatMoney(value){
      try{
        return new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value||0));
      }catch (_) {
        return '$' + Number(value||0).toFixed(0);
      }
    }

    function formatNumber(value){
      return Number(value||0).toLocaleString();
    }

    function formatPercent(value){
      return Number(value||0).toLocaleString(undefined,{maximumFractionDigits:1});
    }

    function displayName(contact){
      if(!contact) return '—';
      if(contact.name) return contact.name;
      if(contact.first || contact.last){
        return [contact.first, contact.last].filter(Boolean).join(' ').trim();
      }
      if(typeof window.fullName === 'function'){
        const n = window.fullName(contact);
        if(n) return n;
      }
      return contact.email || contact.phone || contact.id || 'Contact';
    }

    function escapeHtml(value){
      return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
      })[ch]);
    }

    function normalizeDashboardSettings(raw){
      const base = raw && typeof raw === 'object' ? raw : {};
      const source = base.dashboard && typeof base.dashboard === 'object' ? base.dashboard : base;
      const widgets = Object.assign({}, DASHBOARD_WIDGET_DEFAULTS.widgets);
      if(source.widgets && typeof source.widgets === 'object'){
        Object.keys(widgets).forEach(key => {
          if(typeof source.widgets[key] === 'boolean') widgets[key] = source.widgets[key];
        });
      }
      const graphs = Object.assign({}, DASHBOARD_WIDGET_DEFAULTS.graphs);
      if(source.graphs && typeof source.graphs === 'object'){
        Object.keys(graphs).forEach(key => {
          if(typeof source.graphs[key] === 'boolean') graphs[key] = source.graphs[key];
        });
      }
      const widgetCards = Object.assign({}, DASHBOARD_WIDGET_DEFAULTS.widgetCards);
      if(source.widgetCards && typeof source.widgetCards === 'object'){
        Object.keys(widgetCards).forEach(key => {
          if(typeof source.widgetCards[key] === 'boolean') widgetCards[key] = source.widgetCards[key];
        });
      }
      const kpis = Object.assign({}, DASHBOARD_WIDGET_DEFAULTS.kpis);
      if(source.kpis && typeof source.kpis === 'object'){
        Object.keys(kpis).forEach(key => {
          if(typeof source.kpis[key] === 'boolean') kpis[key] = source.kpis[key];
        });
      }
      const storedMode = readStoredDashboardMode();
      const hasExplicitMode = Object.prototype.hasOwnProperty.call(source, 'mode');
      let mode;
      if(hasExplicitMode && source.mode === 'all') mode = 'all';
      else if(hasExplicitMode && source.mode === 'today') mode = 'today';
      else if(storedMode) mode = storedMode;
      else mode = 'today';
      const rawOrder = Array.isArray(base.order) ? base.order
        : Array.isArray(base.dashboardOrder) ? base.dashboardOrder
        : readStoredWidgetOrder();
      const order = normalizeWidgetOrder(rawOrder);
      writeStoredDashboardMode(mode);
      writeStoredWidgetOrder(order);
      return { mode, widgets, graphs, widgetCards, kpis, order };
    }

    async function loadDashboardSettings(force){
      if(force){
        state.dashboardLoaded = false;
        state.dashboardPromise = null;
      }
      if(state.dashboardLoaded) return state.dashboard;
      if(state.dashboardPromise) return state.dashboardPromise;
      state.dashboardPromise = (async ()=>{
        try{
          if(window.Settings && typeof window.Settings.get === 'function'){
            const data = await window.Settings.get();
            const payload = data && typeof data === 'object'
              ? { dashboard: data.dashboard, dashboardOrder: data.dashboardOrder }
              : null;
            state.dashboard = normalizeDashboardSettings(payload);
          }else{
            await openDB();
            const record = await dbGet('settings', 'app:settings');
            const payload = record && typeof record === 'object'
              ? { dashboard: record.dashboard, dashboardOrder: record.dashboardOrder }
              : null;
            state.dashboard = normalizeDashboardSettings(payload);
          }
        }catch (err) {
          console && console.warn && console.warn('dashboard settings load failed', err);
          state.dashboard = normalizeDashboardSettings(null);
        }
        state.dashboardLoaded = true;
        state.dashboardPromise = null;
        return state.dashboard;
      })();
      return state.dashboardPromise;
    }

    function updateDashboardModeControls(){
      const caption = document.getElementById('dashboard-mode-caption');
      if(caption){
        caption.textContent = state.dashboard.mode === 'all'
          ? 'Viewing all dashboard widgets.'
          : 'Focus on today\'s priorities.';
      }
      if(typeof document.querySelectorAll === 'function'){
        const buttons = document.querySelectorAll('[data-dashboard-mode]');
        buttons.forEach(btn => {
          const mode = btn.getAttribute('data-dashboard-mode');
          btn.classList.toggle('active', mode === state.dashboard.mode);
        });
      }
    }

    function toggleSectionVisibility(id, show){
      const node = document.getElementById(id);
      if(!node) return;
      node.classList.toggle('hidden', !show);
    }

    function uniquePartners(raw){
      const ids = new Set();
      const list = [raw.buyerPartnerId, raw.listingPartnerId, raw.partnerId, raw.referralPartnerId];
      list.forEach(val=>{
        if(!val && val!==0) return;
        const key = String(val);
        if(!key || key === PARTNER_NONE_ID) return;
        ids.add(key);
      });
      if(Array.isArray(raw.partnerIds)){
        raw.partnerIds.forEach(val=>{
          if(!val && val!==0) return;
          const key = String(val);
          if(!key || key === PARTNER_NONE_ID) return;
          ids.add(key);
        });
      }
      return Array.from(ids);
    }

    function normalizeStageMap(value, currentStage, createdTs){
      const map = {};
      if(value && typeof value === 'object' && !Array.isArray(value)){
        Object.keys(value).forEach(key => {
          const norm = canonicalStage(key);
          const raw = value[key];
          const ts = typeof raw === 'number' ? raw : Date.parse(raw);
          if(!Number.isNaN(ts)) map[norm] = ts;
        });
      }else if(value){
        const ts = typeof value === 'number' ? value : Date.parse(value);
        if(!Number.isNaN(ts)) map[canonicalStage(currentStage)] = ts;
      }
      if(!map[currentStage]){
        const fallback = createdTs || Date.now();
        map[currentStage] = fallback;
      }
      return map;
    }

    function normalizeContact(raw){
      if(!raw || raw.id==null) return null;
      const id = String(raw.id);
      const stage = laneKeyFromStage(raw.stage || 'application');
      const canonicalStageKey = canonicalStage(raw.stage || stage);
      const createdTs = toTimestamp(raw.createdAt) || toTimestamp(raw.created) || toTimestamp(raw.addedAt);
      const fundedDate = parseDate(raw.fundedDate || raw.closedDate || raw.closingDate);
      const fundedTs = fundedDate ? fundedDate.getTime() : null;
      const stageMap = normalizeStageMap(raw.stageEnteredAt, canonicalStageKey, createdTs);
      if(raw.stageUpdatedAt && !stageMap[canonicalStageKey]){
        const stageUpdated = toTimestamp(raw.stageUpdatedAt);
        if(stageUpdated) stageMap[canonicalStageKey] = stageUpdated;
      }
      const partners = uniquePartners(raw);
      return {
        id,
        name: raw.name || '',
        first: raw.first || '',
        last: raw.last || '',
        email: raw.email || '',
        stage: canonicalStageKey,
        lane: laneKeyFromStage(raw.stage || stage),
        createdTs: createdTs || null,
        loanAmount: Number(raw.loanAmount || raw.amount || 0) || 0,
        loanType: raw.loanType || raw.loanProgram || '',
        fundedDate,
        fundedTs,
        stageMap,
        partners,
        buyerPartnerId: raw.buyerPartnerId ? String(raw.buyerPartnerId) : null,
        listingPartnerId: raw.listingPartnerId ? String(raw.listingPartnerId) : null,
        partnerId: raw.partnerId ? String(raw.partnerId) : null,
        lossReason: raw.lossReason || raw.deniedReason || raw.lostReason || raw.reason || '',
        extras: raw.extras && typeof raw.extras === 'object' ? raw.extras : {},
        deleted: !!raw.deletedAt
      };
    }

    function normalizePartner(raw){
      if(!raw || raw.id==null) return null;
      const id = String(raw.id);
      return {
        id,
        name: raw.name || raw.company || 'Partner',
        company: raw.company || '',
        tier: raw.tier || '',
        email: raw.email || '',
        phone: raw.phone || ''
      };
    }

    function normalizeTask(raw){
      if(!raw || raw.id==null) return null;
      const id = String(raw.id);
      const contactId = raw.contactId!=null ? String(raw.contactId) : null;
      const due = parseDate(raw.due || raw.dueDate || raw.when || raw.date);
      return {
        id,
        contactId,
        title: raw.title || raw.name || raw.summary || 'Task',
        due,
        dueTs: due ? due.getTime() : null,
        done: !!raw.done,
        updatedAt: toTimestamp(raw.updatedAt) || Date.now(),
        raw
      };
    }

    async function loadData(force){
      if(state.loadingPromise) return state.loadingPromise;
      const now = Date.now();
      if(!force && state.dataLoaded && now - state.lastLoad < 400) return state;
      state.loadingPromise = (async ()=>{
        await openDB();
        const contactsRaw = typeof window.getAllContacts === 'function' ? await window.getAllContacts() : await dbGetAll('contacts');
        const partnersRaw = typeof window.getAllPartners === 'function' ? await window.getAllPartners() : await dbGetAll('partners');
        const tasksRaw = await dbGetAll('tasks');
        state.contacts = (contactsRaw||[]).map(normalizeContact).filter(Boolean);
        state.contactMap = new Map(state.contacts.map(c=>[c.id, c]));
        state.partners = (partnersRaw||[]).map(normalizePartner).filter(Boolean);
        state.partnerMap = new Map(state.partners.map(p=>[p.id, p]));
        state.tasks = (tasksRaw||[]).map(normalizeTask).filter(Boolean);
        state.dataLoaded = true;
        state.lastLoad = Date.now();
        state.loadingPromise = null;
        return state;
      })();
      return state.loadingPromise;
    }

    function filteredContacts(){
      const stageFilter = state.filters.stage;
      const loanTypeFilter = state.filters.loanType;
      const partnerFilter = state.filters.partner;
      return state.contacts.filter(contact => {
        if(!contact || contact.deleted) return false;
        if(stageFilter !== 'all'){
          if(stageFilter === 'pipeline'){
            if(!PIPELINE_LANES.includes(contact.lane)) return false;
          }else if(contact.lane !== stageFilter){
            return false;
          }
        }
        if(loanTypeFilter !== 'all'){
          if(String(contact.loanType||'').toLowerCase() !== String(loanTypeFilter||'').toLowerCase()) return false;
        }
        if(partnerFilter !== 'all'){
          if(!contact.partners.includes(partnerFilter)) return false;
        }
        return true;
      });
    }

    function filteredTasks(contactIds){
      const allowed = new Set(contactIds);
      return state.tasks.filter(task => {
        if(!task || task.done) return false;
        if(!task.contactId) return false;
        return allowed.has(task.contactId);
      });
    }

    function getStageTimestamp(contact, stages){
      if(!contact) return null;
      const map = contact.stageMap || {};
      for(const stage of stages){
        const key = canonicalStage(stage);
        const ts = map[key];
        if(ts) return ts;
      }
      return contact.createdTs || null;
    }

    function groupTasks(tasks){
      const groups = new Map();
      tasks.forEach(task => {
        if(!task.contactId) return;
        if(!groups.has(task.contactId)){
          const contact = state.contactMap.get(task.contactId) || null;
          groups.set(task.contactId, {contact, tasks: []});
        }
        const group = groups.get(task.contactId);
        group.tasks.push(task);
      });
      return Array.from(groups.values()).map(group => {
        group.tasks.sort((a,b)=> (a.dueTs||0) - (b.dueTs||0) || a.title.localeCompare(b.title));
        return group;
      }).sort((a,b)=>{
        const nameA = displayName(a.contact).toLowerCase();
        const nameB = displayName(b.contact).toLowerCase();
        return nameA.localeCompare(nameB, undefined, {numeric:true, sensitivity:'base'});
      });
    }

    function isAppointmentTask(task){
      if(!task) return false;
      const raw = task.raw || {};
      const fields = [raw.type, raw.kind, raw.category, raw.appointmentType, raw.template];
      for(const field of fields){
        if(typeof field === 'string'){
          const lower = field.toLowerCase();
          if(lower.includes('appointment') || lower.includes('meeting') || lower.includes('consult') || lower.includes('review') || lower.includes('call')){
            return true;
          }
        }
      }
      const title = String(task.title || raw.title || raw.name || '').toLowerCase();
      return /(appointment|meeting|consult|review|call)/.test(title);
    }

    function buildDashboardAggregates(){
      const contacts = filteredContacts();
      const contactIds = contacts.map(c=>c.id);
      const tasks = filteredTasks(contactIds);
      const now = new Date();
      const today = startOfDay(now);
      const todayTs = today ? today.getTime() : Date.now();
      const yearStart = new Date(now.getFullYear(),0,1).getTime();
      const sevenDaysAgo = now.getTime() - (7*DAY_MS);

      let kpiNewLeads7d = 0;
      let kpiActivePipeline = 0;
      const pipelineCounts = Object.fromEntries(LANE_ORDER.map(stage => [stage, 0]));
      const ytdFunded = [];
      const staleDeals = [];
      const partnerStats = new Map();

      contacts.forEach(contact => {
        if(!contact) return;
        const created = contact.createdTs || 0;
        if(created && created >= sevenDaysAgo) kpiNewLeads7d += 1;
        const lane = contact.lane;
        if(pipelineCounts.hasOwnProperty(lane)) pipelineCounts[lane] += 1;
        if(PIPELINE_LANES.includes(lane)) kpiActivePipeline += 1;
        if(contact.fundedTs && contact.fundedTs >= yearStart) ytdFunded.push(contact);
        if(PIPELINE_LANES.includes(lane)){
          const stageTs = contact.stageMap ? contact.stageMap[canonicalStage(contact.stage)] : null;
          const entered = stageTs || contact.stageMap?.[laneKeyFromStage(contact.stage)] || contact.stageMap?.[contact.stage] || contact.createdTs;
          if(entered){
            const days = Math.floor((todayTs - entered) / DAY_MS);
            if(days > 14){
              staleDeals.push({contact, days});
            }
          }
        }
        const partnerIds = Array.isArray(contact.partners) ? contact.partners : [];
        if(partnerIds.length){
          const isActive = PIPELINE_LANES.includes(lane);
          const isLost = contact.lane === 'lost' || contact.lane === 'denied';
          const isFundedYtd = contact.fundedTs && contact.fundedTs >= yearStart;
          const amount = Number(contact.loanAmount||0) || 0;
          partnerIds.forEach(pid => {
            if(!pid || pid === PARTNER_NONE_ID) return;
            const stat = partnerStats.get(pid) || { id: pid, total: 0, active: 0, funded: 0, lost: 0, volume: 0 };
            stat.total += 1;
            if(isActive) stat.active += 1;
            if(isLost) stat.lost += 1;
            if(isFundedYtd){
              stat.funded += 1;
              stat.volume += amount;
            }
            partnerStats.set(pid, stat);
          });
        }
      });

      const fundedVolumeYtd = ytdFunded.reduce((sum, contact)=> sum + Number(contact.loanAmount||0), 0);
      const cycleDurations = [];
      ytdFunded.forEach(contact => {
        const fundedTs = contact.fundedTs;
        const startTs = getStageTimestamp(contact, ['long-shot','application','preapproved']);
        if(fundedTs && startTs){
          cycleDurations.push(Math.max(0, (fundedTs - startTs) / DAY_MS));
        }
      });
      const avgCycle = cycleDurations.length ? cycleDurations.reduce((a,b)=> a+b, 0) / cycleDurations.length : 0;

      const dueToday = [];
      const overdue = [];
      tasks.forEach(task => {
        if(!task.due) return;
        const dueStart = startOfDay(task.due);
        if(!dueStart) return;
        const diff = Math.floor((dueStart.getTime() - todayTs) / DAY_MS);
        if(diff === 0) dueToday.push(task);
        else if(diff < 0) overdue.push(task);
      });

      const dueTodaySorted = dueToday.slice().sort((a,b)=>{
        const diff = (a.dueTs||0) - (b.dueTs||0);
        if(diff !== 0) return diff;
        return String(a.title||'').localeCompare(String(b.title||''), undefined, {numeric:true, sensitivity:'base'});
      });

      const appointments = state.tasks.filter(task => {
        if(!task || !task.dueTs) return false;
        if(task.dueTs < todayTs) return false;
        return isAppointmentTask(task);
      }).sort((a,b)=> (a.dueTs||0) - (b.dueTs||0) || String(a.title||'').localeCompare(String(b.title||''))).slice(0,5);

      const recentLeads = contacts.filter(contact => {
        if(!contact || contact.deleted) return false;
        if(!contact.createdTs) return false;
        if(PIPELINE_LANES.includes(contact.lane)) return true;
        return contact.lane === 'long-shot';
      }).sort((a,b)=> (b.createdTs||0) - (a.createdTs||0)).slice(0,5);

      const referralsYtd = ytdFunded.filter(contact => contact.partners.length > 0).length;

      const leaderboard = Array.from(partnerStats.values()).map(stat => {
        const partner = state.partnerMap.get(stat.id) || {name:'Partner', tier:'', company:''};
        return {
          id: stat.id,
          name: partner.name || partner.company || 'Partner',
          tier: partner.tier || '',
          volume: stat.volume,
          fundedCount: stat.funded,
          activeCount: stat.active,
          totalCount: stat.total,
          lostCount: stat.lost,
          conversion: stat.total ? stat.funded / stat.total : 0
        };
      });

      staleDeals.sort((a,b)=> b.days - a.days);

      return {
        contacts,
        tasks,
        pipelineCounts,
        ytdFunded,
        staleDeals,
        leaderboard,
        focus: {
          tasksToday: dueTodaySorted.slice(0,5),
          nextAppointments: appointments,
          recentLeads
        },
        dueGroups: {
          today: groupTasks(dueToday),
          overdue: groupTasks(overdue)
        },
        kpis: {
          kpiNewLeads7d,
          kpiActivePipeline,
          kpiFundedYTD: ytdFunded.length,
          kpiFundedVolumeYTD: fundedVolumeYtd,
          kpiAvgCycleLeadToFunded: avgCycle,
          kpiTasksToday: dueToday.length,
          kpiTasksOverdue: overdue.length,
          kpiReferralsYTD: referralsYtd
        }
      };
    }

    function renderFilters(){
      const host = document.getElementById('dashboard-filters');
      if(!host) return;
      const stageOptions = ['all','pipeline'].concat(LANE_ORDER);
      const loanTypes = Array.from(new Set(state.contacts.map(contact => String(contact.loanType||'').trim()).filter(Boolean))).sort((a,b)=> a.localeCompare(b, undefined, {numeric:true, sensitivity:'base'}));
      const partnerOptions = state.partners.filter(p => p && p.id && p.id !== PARTNER_NONE_ID).sort((a,b)=> (a.name||'').localeCompare(b.name||'', undefined, {numeric:true, sensitivity:'base'}));
      host.innerHTML = `
        <div class="row" style="align-items:flex-end;gap:12px;flex-wrap:wrap">
          <div>
            <label class="muted" style="display:block;font-size:12px">Stage</label>
            <select data-role="dashboard-filter" data-filter-key="stage">
              ${stageOptions.map(value => {
                const label = value==='all'?'All Stages': value==='pipeline'?'Active Pipeline': (STAGE_LABELS[value] || value.replace(/-/g,' ')).replace(/\b\w/g,c=>c.toUpperCase());
                const selected = state.filters.stage === value ? ' selected' : '';
                return `<option value="${value}"${selected}>${label}</option>`;
              }).join('')}
            </select>
          </div>
          <div>
            <label class="muted" style="display:block;font-size:12px">Loan Type</label>
            <select data-role="dashboard-filter" data-filter-key="loanType">
              <option value="all"${state.filters.loanType==='all'?' selected':''}>All Loan Types</option>
              ${loanTypes.map(type => `<option value="${type}"${state.filters.loanType===type?' selected':''}>${type}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="muted" style="display:block;font-size:12px">Partner</label>
            <select data-role="dashboard-filter" data-filter-key="partner">
              <option value="all"${state.filters.partner==='all'?' selected':''}>All Partners</option>
              ${partnerOptions.map(p => `<option value="${p.id}"${state.filters.partner===p.id?' selected':''}>${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
      if(!host.__wired){
        host.__wired = true;
        host.addEventListener('change', evt => {
          const select = evt.target.closest('select[data-role="dashboard-filter"]');
          if(!select) return;
          const key = select.getAttribute('data-filter-key');
          if(!key) return;
          const value = select.value || 'all';
          state.filters[key] = value;
          queueDashboardRender({sections:['filters','kpis','pipeline','today','leaderboard','stale','focus']});
        });
      }
    }

    function renderKpis(data){
      const host = document.getElementById('dashboard-kpis');
      if(!host) return;
      const tiles = [
        {key:'kpiNewLeads7d', label:'New Leads (7d)', value: formatNumber(data.kpis.kpiNewLeads7d)},
        {key:'kpiActivePipeline', label:'Active Pipeline', value: formatNumber(data.kpis.kpiActivePipeline)},
        {key:'kpiFundedYTD', label:'Funded YTD', value: formatNumber(data.kpis.kpiFundedYTD)},
        {key:'kpiFundedVolumeYTD', label:'Funded Volume YTD', value: formatMoney(data.kpis.kpiFundedVolumeYTD)},
        {key:'kpiAvgCycleLeadToFunded', label:'Avg Days Lead → Funded', value: data.kpis.kpiAvgCycleLeadToFunded ? Math.round(data.kpis.kpiAvgCycleLeadToFunded) + ' days' : '—'},
        {key:'kpiTasksToday', label:'Tasks Due Today', value: formatNumber(data.kpis.kpiTasksToday)},
        {key:'kpiTasksOverdue', label:'Tasks Overdue', value: formatNumber(data.kpis.kpiTasksOverdue)},
        {key:'kpiReferralsYTD', label:'Referrals YTD', value: formatNumber(data.kpis.kpiReferralsYTD)}
      ];
      host.innerHTML = `
        <div class="grid kpi">
          ${tiles.map(tile => `
            <div class="card">
              <div class="kval">${tile.value}</div>
              <div class="muted">${tile.label}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    function renderPipelineOverview(data){
      const host = document.getElementById('dashboard-pipeline-overview');
      if(!host) return;
      const items = PIPELINE_LANES.map(stage => {
        const label = STAGE_LABELS[stage] || stage.replace(/-/g,' ');
        const count = data.pipelineCounts[stage] || 0;
        return `<div class="row" style="align-items:center;gap:8px"><span class="badge-pill">${label}</span><strong>${formatNumber(count)}</strong></div>`;
      }).join('');
      host.innerHTML = `
        <div>
          <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
            <strong>Pipeline Overview</strong>
            <span class="muted">Counts across active stages</span>
          </div>
          <div class="grid cols-2" style="gap:8px">${items}</div>
        </div>
      `;
    }

    function renderTaskGroupColumn(title, groups, emptyMessage){
      if(!groups.length){
        return `<div><h4>${title}</h4><p class="muted">${emptyMessage}</p></div>`;
      }
      return `<div><h4>${title}</h4><ul class="insight-list">${groups.map(group => {
        const name = displayName(group.contact);
        const contactId = group.contact ? group.contact.id : '';
        const tasks = group.tasks.map(task => {
          const due = task.due ? task.due.toLocaleDateString() : '—';
          return `<li data-task-id="${task.id}">
            <div class="row" style="align-items:center;gap:8px">
              <div class="grow">
                <div><strong>${task.title}</strong></div>
                <div class="muted" style="font-size:12px">Due ${due}</div>
              </div>
              <button class="btn" data-role="open-contact" data-contact-id="${contactId}">Open</button>
              <button class="btn brand" data-act="task-done" data-task-id="${task.id}">Mark done</button>
            </div>
          </li>`;
        }).join('');
        return `<li class="card" style="padding:8px">
          <div class="row" style="align-items:center;gap:8px;margin-bottom:4px">
            <strong>${name}</strong>
          </div>
          <ul class="insight-list">${tasks}</ul>
        </li>`;
      }).join('')}</ul></div>`;
    }

    function formatFocusTime(date){
      if(!(date instanceof Date)) return 'Anytime';
      try{
        return date.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
      }catch (_err) {
        return date.toISOString().slice(11,16);
      }
    }

    function formatFocusDate(date){
      if(!(date instanceof Date)) return '—';
      try{
        return date.toLocaleDateString();
      }catch (_err) {
        return date.toISOString().slice(0,10);
      }
    }

    function renderFocusList(title, items, emptyMessage, renderer){
      const content = items.length ? items.map(renderer).join('') : `<li class="empty">${emptyMessage}</li>`;
      return `<div>
        <h4 style="margin:0 0 8px;font-size:15px">${escapeHtml(title)}</h4>
        <ul class="insight-list">${content}</ul>
      </div>`;
    }

    function renderFocusTaskItem(task){
      const contact = state.contactMap.get(task.contactId) || null;
      const name = displayName(contact);
      const time = formatFocusTime(task.due);
      return `<li>
        <div><strong>${escapeHtml(task.title || 'Task')}</strong></div>
        <div class="muted" style="font-size:12px">${escapeHtml(name)} • ${escapeHtml(time)}</div>
      </li>`;
    }

    function renderFocusAppointmentItem(task){
      const contact = state.contactMap.get(task.contactId) || null;
      const name = displayName(contact);
      const date = formatFocusDate(task.due);
      const time = formatFocusTime(task.due);
      return `<li>
        <div><strong>${escapeHtml(task.title || 'Appointment')}</strong></div>
        <div class="muted" style="font-size:12px">${escapeHtml(name)} • ${escapeHtml(date)} ${escapeHtml(time)}</div>
      </li>`;
    }

    function renderFocusLeadItem(contact){
      const created = contact.createdTs ? formatFocusDate(new Date(contact.createdTs)) : '—';
      const stage = STAGE_LABELS[contact.lane] || contact.lane;
      return `<li>
        <div><strong>${escapeHtml(displayName(contact))}</strong></div>
        <div class="muted" style="font-size:12px">${escapeHtml(stage || 'Stage')} • Added ${escapeHtml(created)}</div>
      </li>`;
    }

    function renderDashboardFocus(data){
      const host = document.getElementById('dashboard-focus');
      if(!host) return;
      const focus = data && data.focus ? data.focus : {tasksToday:[], nextAppointments:[], recentLeads:[]};
      host.innerHTML = `
        <div>
          <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
            <strong>Today</strong>
            <span class="muted">Keep your day focused on the most important follow-ups.</span>
          </div>
          <div class="grid cols-3" style="gap:12px;align-items:start">
            ${renderFocusList('Due Today', focus.tasksToday, 'No tasks due today.', renderFocusTaskItem)}
            ${renderFocusList('Next Appointments', focus.nextAppointments, 'No upcoming appointments.', renderFocusAppointmentItem)}
            ${renderFocusList('Recently Added Leads', focus.recentLeads, 'No recent leads added.', renderFocusLeadItem)}
          </div>
        </div>
      `;
    }

    function renderTodayPanel(data){
      const host = document.getElementById('dashboard-today');
      if(!host) return;
      const todayColumn = renderTaskGroupColumn('Due Today', data.dueGroups.today, 'Nothing due today.');
      const overdueColumn = renderTaskGroupColumn('Overdue', data.dueGroups.overdue, 'All caught up.');
      host.innerHTML = `
        <div>
          <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
            <strong>Today's Work</strong>
            <span class="muted">Stay ahead of due and overdue tasks.</span>
          </div>
          <div class="grid cols-2" style="gap:12px;align-items:start">
            ${todayColumn}
            ${overdueColumn}
          </div>
        </div>
      `;
    }

    function renderLeaderboard(data){
      const host = document.getElementById('referral-leaderboard');
      if(!host) return;
      const dataset = data && Array.isArray(data.leaderboard)
        ? data.leaderboard
        : (state.lastAggregates && Array.isArray(state.lastAggregates.leaderboard) ? state.lastAggregates.leaderboard : []);
      const percentFmt = new Intl.NumberFormat('en-US',{style:'percent',maximumFractionDigits:0});
      const prefs = state.leaderboardPrefs || {};
      const sort = sanitizeLeaderboardSort(prefs.sort);
      const filter = sanitizeLeaderboardFilter(prefs.filter);
      state.leaderboardPrefs = { sort, filter };
      const filtered = dataset.filter(row => {
        if(filter === 'active') return Number(row.activeCount||0) > 0;
        if(filter === 'funded') return Number(row.fundedCount||0) > 0;
        return true;
      });
      const sorted = filtered.slice().sort((a,b) => {
        const aName = String(a.name||'').toLowerCase();
        const bName = String(b.name||'').toLowerCase();
        const aVolume = Number(a.volume||0);
        const bVolume = Number(b.volume||0);
        const aFunded = Number(a.fundedCount||0);
        const bFunded = Number(b.fundedCount||0);
        if(sort === 'active'){
          const aActive = Number(a.activeCount||0);
          const bActive = Number(b.activeCount||0);
          if(bActive !== aActive) return bActive - aActive;
          if(bVolume !== aVolume) return bVolume - aVolume;
          return aName.localeCompare(bName, undefined, { sensitivity:'base', numeric:true });
        }
        if(sort === 'conversion'){
          const aConv = Number(a.conversion||0);
          const bConv = Number(b.conversion||0);
          if(bConv !== aConv) return bConv - aConv;
          if(bFunded !== aFunded) return bFunded - aFunded;
          return aName.localeCompare(bName, undefined, { sensitivity:'base', numeric:true });
        }
        if(bVolume !== aVolume) return bVolume - aVolume;
        if(bFunded !== aFunded) return bFunded - aFunded;
        return aName.localeCompare(bName, undefined, { sensitivity:'base', numeric:true });
      });
      const limited = sorted.slice(0, 10);
      host.innerHTML = '';
      const head = document.createElement('div');
      head.className = 'leaderboard-head';
      const title = document.createElement('strong');
      title.textContent = 'Referral Leaderboard';
      const caption = document.createElement('span');
      caption.className = 'muted';
      const sortLabel = { volume:'Funded volume YTD', active:'Active pipeline count', conversion:'Conversion rate' }[sort] || 'Funded volume YTD';
      const filterLabel = { all:'All partners', active:'Partners with active pipeline', funded:'Partners with funded deals YTD' }[filter] || 'All partners';
      caption.textContent = `${filterLabel} • Sorted by ${sortLabel}`;
      head.append(title, caption);
      const controls = document.createElement('div');
      controls.className = 'leaderboard-controls';
      const sortLabelEl = document.createElement('label');
      sortLabelEl.append('Sort by ');
      const sortSelect = document.createElement('select');
      sortSelect.setAttribute('data-role', 'leaderboard-sort');
      [
        { value:'volume', label:'Funded volume' },
        { value:'active', label:'Active pipeline' },
        { value:'conversion', label:'Conversion rate' }
      ].forEach(optionMeta => {
        const option = document.createElement('option');
        option.value = optionMeta.value;
        option.textContent = optionMeta.label;
        if(optionMeta.value === sort) option.selected = true;
        sortSelect.appendChild(option);
      });
      sortLabelEl.appendChild(sortSelect);
      const filterLabelEl = document.createElement('label');
      filterLabelEl.append('Show ');
      const filterSelect = document.createElement('select');
      filterSelect.setAttribute('data-role', 'leaderboard-filter');
      [
        { value:'all', label:'All partners' },
        { value:'active', label:'Active pipeline' },
        { value:'funded', label:'Funded YTD' }
      ].forEach(optionMeta => {
        const option = document.createElement('option');
        option.value = optionMeta.value;
        option.textContent = optionMeta.label;
        if(optionMeta.value === filter) option.selected = true;
        filterSelect.appendChild(option);
      });
      filterLabelEl.appendChild(filterSelect);
      controls.append(sortLabelEl, filterLabelEl);
      host.append(head, controls);
      if(!limited.length){
        const empty = document.createElement('div');
        empty.className = 'muted';
        empty.textContent = filter === 'all'
          ? 'No funded referrals yet.'
          : 'No partners match the selected filters.';
        host.appendChild(empty);
      }else{
        const list = document.createElement('ol');
        list.className = 'leaderboard-list';
        limited.forEach((row, idx) => {
          const item = document.createElement('li');
          item.className = 'leaderboard-item';
          item.setAttribute('data-partner-id', row.id);
          const rank = document.createElement('span');
          rank.className = 'leaderboard-rank';
          rank.textContent = String(idx + 1);
          const nameWrap = document.createElement('div');
          nameWrap.className = 'leaderboard-name';
          const nameRow = document.createElement('div');
          nameRow.className = 'leaderboard-name-main';
          const nameStrong = document.createElement('strong');
          nameStrong.textContent = row.name || 'Partner';
          nameRow.appendChild(nameStrong);
          if(row.tier){
            const tier = document.createElement('span');
            tier.className = 'leaderboard-tier badge-pill';
            tier.textContent = row.tier;
            nameRow.appendChild(tier);
          }
          nameWrap.appendChild(nameRow);
          const sub = document.createElement('div');
          sub.className = 'muted';
          const fundedCount = Number(row.fundedCount||0).toLocaleString();
          const activeCount = Number(row.activeCount||0).toLocaleString();
          const totalCount = Number(row.totalCount||0).toLocaleString();
          sub.textContent = `${fundedCount} funded • ${activeCount} active • ${totalCount} referrals`;
          nameWrap.appendChild(sub);
          const metrics = document.createElement('div');
          metrics.className = 'leaderboard-metrics';
          const volumeMetric = document.createElement('div');
          volumeMetric.className = 'leaderboard-metric';
          const volumeLabel = document.createElement('span');
          volumeLabel.className = 'label';
          volumeLabel.textContent = 'Volume';
          const volumeValue = document.createElement('span');
          volumeValue.className = 'value';
          volumeValue.textContent = formatMoney(row.volume || 0);
          volumeMetric.append(volumeLabel, volumeValue);
          const activeMetric = document.createElement('div');
          activeMetric.className = 'leaderboard-metric';
          const activeLabel = document.createElement('span');
          activeLabel.className = 'label';
          activeLabel.textContent = 'Active';
          const activeValue = document.createElement('span');
          activeValue.className = 'value';
          activeValue.textContent = Number(row.activeCount||0).toLocaleString();
          activeMetric.append(activeLabel, activeValue);
          const conversionMetric = document.createElement('div');
          conversionMetric.className = 'leaderboard-metric';
          const conversionLabel = document.createElement('span');
          conversionLabel.className = 'label';
          conversionLabel.textContent = 'Conversion';
          const conversionValue = document.createElement('span');
          conversionValue.className = 'value';
          conversionValue.textContent = percentFmt.format(Number(row.conversion||0));
          conversionMetric.append(conversionLabel, conversionValue);
          metrics.append(volumeMetric, activeMetric, conversionMetric);
          item.append(rank, nameWrap, metrics);
          list.appendChild(item);
        });
        host.appendChild(list);
      }
      if(!host.__leaderboardPrefHandler){
        host.addEventListener('change', event => {
          const sortSelectEl = event.target && event.target.closest('[data-role="leaderboard-sort"]');
          if(sortSelectEl){
            const value = sanitizeLeaderboardSort(sortSelectEl.value);
            if(state.leaderboardPrefs.sort !== value){
              state.leaderboardPrefs.sort = value;
              writeStoredLeaderboardPref(LEADERBOARD_SORT_STORAGE_KEY, value);
              renderLeaderboard(state.lastAggregates);
            }
            return;
          }
          const filterSelectEl = event.target && event.target.closest('[data-role="leaderboard-filter"]');
          if(filterSelectEl){
            const value = sanitizeLeaderboardFilter(filterSelectEl.value);
            if(state.leaderboardPrefs.filter !== value){
              state.leaderboardPrefs.filter = value;
              writeStoredLeaderboardPref(LEADERBOARD_FILTER_STORAGE_KEY, value);
              renderLeaderboard(state.lastAggregates);
            }
          }
        });
        host.__leaderboardPrefHandler = true;
      }
    }

    function renderStaleDeals(data){
      const host = document.getElementById('dashboard-stale');
      if(!host) return;
      if(!data.staleDeals.length){
        host.innerHTML = '<div><strong>Stale Deals</strong><p class="muted">No deals have exceeded the 14 day threshold.</p></div>';
        return;
      }
      const rows = data.staleDeals.map(item => {
        const contact = item.contact;
        const name = displayName(contact);
        const stage = STAGE_LABELS[contact.lane] || contact.lane;
        const partners = contact.partners.map(pid => state.partnerMap.get(pid)?.name || 'Partner').join(', ') || '—';
        const badge = item.days >= 21 ? '21+' : item.days >= 14 ? '14+' : '7+';
        return `<tr>
          <td><a href="#" data-role="open-contact" data-contact-id="${contact.id}">${name}</a></td>
          <td>${stage}</td>
          <td><span class="badge-pill">${badge}</span> ${item.days}d</td>
          <td>${partners}</td>
        </tr>`;
      }).join('');
      host.innerHTML = `
        <div>
          <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
            <strong>Stale Deals</strong>
            <span class="muted">Contacts in stage longer than 14 days.</span>
          </div>
          <div class="status-table-wrap">
            <table class="status-table table">
              <thead>
                <tr><th>Borrower</th><th>Stage</th><th>Days in Stage</th><th>Partner(s)</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      `;
    }

    async function renderDashboard(options){
      const releaseLoading = beginDashboardLoading();
      try {
        await loadData(options && options.forceReload);
        await loadDashboardSettings(options && options.forceReload);
        const sections = options && options.sections instanceof Set ? options.sections : null;
        const all = !sections || sections.size === 0;
        const aggregates = buildDashboardAggregates();
        state.lastAggregates = aggregates;
        updateDashboardModeControls();

        const showFocus = state.dashboard.mode === 'today';
        const focusNeedsRender = showFocus && (all || (sections && (sections.has('today') || sections.has('focus'))));
        if(focusNeedsRender){
          renderDashboardFocus(aggregates);
        }
        toggleSectionVisibility('dashboard-focus', showFocus);

        const widgetVisible = key => state.dashboard.mode === 'all' && state.dashboard.widgets[key] !== false;
        const shouldRenderWidget = key => {
          if(!widgetVisible(key)) return false;
          if(all) return true;
          return sections ? sections.has(key) : true;
        };

        if(shouldRenderWidget('filters')){
          renderFilters();
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.filters, widgetVisible('filters'));

        if(shouldRenderWidget('kpis')){
          renderKpis(aggregates);
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.kpis, widgetVisible('kpis'));

        if(shouldRenderWidget('pipeline')){
          renderPipelineOverview(aggregates);
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.pipeline, widgetVisible('pipeline'));

        if(shouldRenderWidget('today')){
          renderTodayPanel(aggregates);
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.today, widgetVisible('today'));

        if(shouldRenderWidget('leaderboard')){
          renderLeaderboard(aggregates);
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.leaderboard, widgetVisible('leaderboard'));

        if(shouldRenderWidget('stale')){
          renderStaleDeals(aggregates);
        }
        toggleSectionVisibility(WIDGET_SECTION_IDS.stale, widgetVisible('stale'));

        const insightWidgetKeys = ['goalProgress','numbersPortfolio','numbersReferrals','numbersMomentum','pipelineCalendar','priorityActions','milestones','docPulse'];
        const opportunityWidgetKeys = ['relationshipOpportunities','clientCareRadar','closingWatch'];
        const showInsights = state.dashboard.mode === 'all' && insightWidgetKeys.some(widgetVisible);
        const showOpportunities = state.dashboard.mode === 'all' && opportunityWidgetKeys.some(widgetVisible);
        toggleSectionVisibility('dashboard-insights', showInsights);
        toggleSectionVisibility('dashboard-opportunities', showOpportunities);

        applyWidgetOrderToDom(state.dashboard.order);
        ensureWidgetDnDWired();
      } finally {
        releaseLoading();
      }
    }

    function canonicalLossReason(reason){
      const raw = String(reason||'').trim().toLowerCase();
      if(!raw) return 'uncategorized';
      if(raw.includes('doc')) return 'no-docs';
      if(raw.includes('rate')) return 'rate';
      if(raw.includes('compet')) return 'competitor';
      if(raw.includes('credit')) return 'credit';
      if(raw.includes('withdrew') || raw.includes('withdraw')) return 'withdrew';
      if(raw.includes('time') || raw.includes('delay')) return 'timeline';
      if(raw.includes('price')) return 'pricing';
      return LOSS_REASON_LABELS[raw] ? raw : 'other';
    }

    function polishBeacon(area){
      try{
        if(!window.__VIS_POLISH__) window.__VIS_POLISH__ = {};
        if(window.__VIS_POLISH__[area]) return;
        window.__VIS_POLISH__[area] = true;
        console.info(`[VIS] polish applied:${area}`);
        if(typeof fetch === 'function'){
          fetch('/__log', {
            method: 'POST',
            headers: {'content-type':'application/json'},
            body: JSON.stringify({event:`polish:${area}`})
          }).catch(()=>{});
        }
      }catch (_err) {}
    }

    function ensureReportsShell(){
      const root = document.getElementById('reports-root');
      if(!root) return null;
      if(!root.__built){
        root.innerHTML = `
          <div class="row" style="align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
            <strong style="display:flex;align-items:center;gap:6px">
              <span aria-hidden="true">📈</span>
              <span>Reports</span>
            </strong>
            <span class="muted" style="font-size:12px">Ready-made snapshots with exportable CSVs.</span>
            <span class="grow"></span>
            <div class="btn-group" role="group" aria-label="Report tabs">
              <button class="btn pill" data-report-tab="stage">Contacts by Stage</button>
              <button class="btn pill" data-report-tab="partner">Partner Performance</button>
              <button class="btn pill" data-report-tab="past-clients">Past Clients</button>
              <button class="btn pill" data-report-tab="fallout">Loan Fallout</button>
            </div>
          </div>
          <div data-report="stage"></div>
          <div data-report="partner" class="hidden"></div>
          <div data-report="past-clients" class="hidden"></div>
          <div data-report="fallout" class="hidden"></div>
        `;
        root.__built = true;
        polishBeacon('reports-icons');
      }
      return root;
    }

    function computeReports(){
      const now = new Date();
      const yearStart = new Date(now.getFullYear(),0,1).getTime();
      const threeYearsAgo = new Date(now.getFullYear()-3, now.getMonth(), now.getDate()).getTime();
      const activePipeline = state.contacts.filter(contact => contact && !contact.deleted && PIPELINE_LANES.includes(contact.lane));
      const pipelineTotal = activePipeline.length;
      const stageRows = PIPELINE_LANES.map(stage => {
        const label = STAGE_LABELS[stage] || stage;
        const count = activePipeline.filter(contact => contact.lane === stage).length;
        const percent = pipelineTotal ? (count / pipelineTotal) * 100 : 0;
        return {Stage: label, Count: count, PercentOfPipeline: Math.round(percent)};
      });

      const partnerStats = new Map();
      state.contacts.forEach(contact => {
        if(!contact || contact.deleted) return;
        const fundedTs = contact.fundedTs || null;
        const ctcTs = contact.stageMap?.[canonicalStage('cleared-to-close')] || null;
        const startTs = getStageTimestamp(contact, ['application','preapproved','long-shot']);
        contact.partners.forEach(pid => {
          if(!pid || pid === PARTNER_NONE_ID) return;
          let stat = partnerStats.get(pid);
          if(!stat){
            const partner = state.partnerMap.get(pid) || {name:'Partner', company:'', tier:''};
            stat = {partner, referrals:0, funded:0, volume:0, cycles:[]};
            partnerStats.set(pid, stat);
          }
          stat.referrals += 1;
          if(fundedTs && fundedTs >= yearStart){
            stat.funded += 1;
            stat.volume += Number(contact.loanAmount||0) || 0;
          }
          if(ctcTs && ctcTs >= yearStart && startTs){
            stat.cycles.push(Math.max(0, (ctcTs - startTs)/DAY_MS));
          }
        });
      });
      const partnerRows = Array.from(partnerStats.values()).map(stat => {
        const avg = stat.cycles.length ? stat.cycles.reduce((a,b)=>a+b,0)/stat.cycles.length : 0;
        return {
          Partner: stat.partner.name || stat.partner.company || 'Partner',
          Referrals: stat.referrals,
          Funded: stat.funded,
          FundedVolume: Math.round(stat.volume),
          AvgDaysToCTC: Math.round(avg)
        };
      }).sort((a,b)=> b.FundedVolume - a.FundedVolume || b.Funded - a.Funded || a.Partner.localeCompare(b.Partner));

      const pastClientRows = state.contacts.filter(contact => contact && !contact.deleted && contact.fundedTs && contact.fundedTs >= threeYearsAgo)
        .sort((a,b)=> (b.fundedTs||0) - (a.fundedTs||0))
        .map(contact => {
          const nextReview = deriveNextReview(contact);
          return {
            Name: displayName(contact),
            FundedDate: contact.fundedDate ? contact.fundedDate.toLocaleDateString() : '—',
            LoanAmount: Math.round(Number(contact.loanAmount||0) || 0),
            NextReview: nextReview ? nextReview.toLocaleDateString() : '—'
          };
        });

      const fallout = state.contacts.filter(contact => contact && !contact.deleted && (contact.lane === 'lost' || contact.lane === 'denied'));
      const falloutTotal = fallout.length;
      const falloutCounts = new Map();
      fallout.forEach(contact => {
        const key = canonicalLossReason(contact.lossReason || contact.status || contact.stage);
        falloutCounts.set(key, (falloutCounts.get(key)||0)+1);
      });
      const falloutRows = Array.from(falloutCounts.entries()).map(([key, count]) => {
        const label = LOSS_REASON_LABELS[key] || key.replace(/\b\w/g,c=>c.toUpperCase());
        const percent = falloutTotal ? Math.round((count / falloutTotal) * 100) : 0;
        return {Reason: label, Count: count, Percent: percent};
      }).sort((a,b)=> b.Count - a.Count);

      state.reportData = {
        stage: {headers:['Stage','Count','PercentOfPipeline'], rows: stageRows},
        partner: {headers:['Partner','Referrals','Funded','FundedVolume','AvgDaysToCTC'], rows: partnerRows},
        'past-clients': {headers:['Name','FundedDate','LoanAmount','NextReview'], rows: pastClientRows},
        fallout: {headers:['Reason','Count','Percent'], rows: falloutRows}
      };
      return state.reportData;
    }

    function deriveNextReview(contact){
      const candidates = [];
      const extras = contact.extras || {};
      if(contact.nextReview) candidates.push(contact.nextReview);
      if(contact.nextReviewDate) candidates.push(contact.nextReviewDate);
      if(extras.nextReviewAt) candidates.push(extras.nextReviewAt);
      if(extras.nextReviewDate) candidates.push(extras.nextReviewDate);
      if(extras.nextReview) candidates.push(extras.nextReview);
      const automation = extras.automation || extras.automations || {};
      if(automation.nextReview) candidates.push(automation.nextReview.date || automation.nextReview.when || automation.nextReview);
      const valid = candidates.map(parseDate).filter(Boolean);
      if(valid.length){
        valid.sort((a,b)=> a.getTime() - b.getTime());
        const future = valid.find(date => date.getTime() >= Date.now());
        return future || valid[0];
      }
      if(contact.fundedDate instanceof Date) return new Date(contact.fundedDate.getTime() + 365*DAY_MS);
      return null;
    }

    function renderReportTable(root, key, data){
      const container = root.querySelector(`[data-report="${key}"]`);
      if(!container) return;
      const meta = data[key];
      const headers = meta.headers;
      const rows = meta.rows;
      container.classList.toggle('hidden', state.reportView !== key);
      if(state.reportView !== key) return;
      const headerHtml = headers.map(label => `<th>${label.replace(/([A-Z])/g,' $1').trim()}</th>`).join('');
      const hasRows = rows.length > 0;
      const bodyHtml = hasRows ? rows.map(row => {
        return `<tr>${headers.map(h => {
          const value = row[h];
          if(h === 'FundedVolume' || h === 'LoanAmount') return `<td>${formatMoney(value)}</td>`;
          if(h === 'PercentOfPipeline' || h === 'Percent') return `<td>${value == null ? '—' : `${Math.round(Number(value)||0)}%`}</td>`;
          if(h === 'AvgDaysToCTC') return `<td>${value ? `${formatNumber(value)} days` : '—'}</td>`;
          if(typeof value === 'number') return `<td>${formatNumber(value)}</td>`;
          return `<td>${value == null ? '—' : value}</td>`;
        }).join('')}</tr>`;
      }).join('') : `<tr><td colspan="${headers.length}" class="muted" style="text-align:center;padding:24px 12px;">
          <div><strong>No items yet</strong></div>
          <div class="fine-print" style="margin-top:4px">Run activity in this report to unlock insights.</div>
        </td></tr>`;
      if(!hasRows) polishBeacon('reports-empty');
      container.innerHTML = `
        <div class="row" style="align-items:center;gap:8px;margin-bottom:8px">
          <strong style="display:flex;align-items:center;gap:6px">
            <span aria-hidden="true">${iconForReport(key)}</span>
            <span>${titleForReport(key)}</span>
          </strong>
          <span class="grow"></span>
          <button class="btn" data-act="export-csv" data-report-key="${key}" title="Export this report to CSV" aria-label="Export this report to CSV">Export CSV</button>
        </div>
        <div class="status-table-wrap">
          <table class="status-table table">
            <thead><tr>${headerHtml}</tr></thead>
            <tbody>${bodyHtml}</tbody>
          </table>
        </div>
      `;
    }

    function titleForReport(key){
      switch(key){
        case 'stage': return 'Contacts by Stage';
        case 'partner': return 'Partner Performance (YTD)';
        case 'past-clients': return 'Past Clients (3 Years)';
        case 'fallout': return 'Loan Fallout';
        default: return 'Report';
      }
    }

    function iconForReport(key){
      switch(key){
        case 'stage': return '📊';
        case 'partner': return '🤝';
        case 'past-clients': return '🏡';
        case 'fallout': return '⚠️';
        default: return '📈';
      }
    }

    async function renderReports(){
      const root = ensureReportsShell();
      if(!root) return;
      const releaseLoading = beginDashboardLoading(root);
      try {
        await loadData();
        const data = computeReports();
        ['stage','partner','past-clients','fallout'].forEach(key => renderReportTable(root, key, data));
        const buttons = root.querySelectorAll('[data-report-tab]');
        buttons.forEach(btn => {
          const key = btn.getAttribute('data-report-tab');
          btn.classList.toggle('brand', state.reportView === key);
        });
      } finally {
        releaseLoading();
      }
    }

    function csvEscape(value){
      const str = value==null ? '' : String(value);
      if(str.includes('"') || str.includes(',') || str.includes('\n')){
        return '"' + str.replace(/"/g,'""') + '"';
      }
      return str;
    }

    function exportCSV(filename, headers, rows){
      const cols = Array.isArray(headers) && headers.length ? headers : (rows.length ? Object.keys(rows[0]) : []);
      const headerLine = cols.join(',');
      const lines = rows.map(row => cols.map(col => csvEscape(row[col])).join(','));
      const csv = [headerLine].concat(lines).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
    window.exportCSV = exportCSV;

    function handleExport(reportKey){
      const data = state.reportData[reportKey];
      if(!data){
        if(typeof window.toast === 'function') window.toast('No rows to export');
        return;
      }
      const filename = `${reportKey.replace(/[^a-z0-9]+/gi,'_').toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`;
      exportCSV(filename, data.headers, data.rows);
    }

    function queueDashboardRender(options){
      if(state.pendingRender){
        state.pendingRender.forceReload = state.pendingRender.forceReload || !!(options && options.forceReload);
        if(options && Array.isArray(options.sections)){
          options.sections.forEach(section => state.pendingRender.sections.add(section));
        }
        state.pendingRender.includeReports = state.pendingRender.includeReports || !!options?.includeReports;
        return;
      }
      const sectionsSet = new Set(options && Array.isArray(options.sections) ? options.sections : []);
      state.pendingRender = {
        forceReload: !!(options && options.forceReload),
        sections: sectionsSet,
        includeReports: !!(options && options.includeReports)
      };
      Promise.resolve().then(async ()=>{
        const payload = state.pendingRender;
        state.pendingRender = null;
        const releaseLoading = beginDashboardLoading();
        try {
          await renderDashboard({forceReload: payload.forceReload, sections: payload.sections});
          if(payload.includeReports) await renderReports();
        } finally {
          releaseLoading();
        }
      });
    }

    async function markTaskDone(taskId){
      if(!taskId) return;
      await loadData();
      const task = state.tasks.find(t => t.id === taskId);
      if(!task) return;
      try{
        const record = Object.assign({}, task.raw || {}, {id: task.id, contactId: task.contactId});
        record.done = true;
        record.completedAt = Date.now();
        record.updatedAt = Date.now();
        await dbPut('tasks', record);
        task.done = true;
        task.raw = record;
        queueDashboardRender({forceReload:false, sections:['kpis','today','focus'], includeReports:false});
        document.dispatchEvent(new CustomEvent('task:updated',{detail:{id:taskId,status:'done',source:'dashboard'}}));
        if(typeof window.dispatchAppDataChanged === 'function'){
          window.dispatchAppDataChanged({source:'dashboard', action:'task-done', taskId});
        }
      }catch (err) {
        console && console.warn && console.warn('task done', err);
        if(typeof window.toast === 'function') window.toast('Unable to update task');
      }
    }

    async function setDashboardMode(mode){
      const normalized = mode === 'all' ? 'all' : 'today';
      if(state.dashboard.mode === normalized){
        updateDashboardModeControls();
        return;
      }
      const widgets = Object.assign({}, state.dashboard.widgets);
      state.dashboard = normalizeDashboardSettings({ mode: normalized, widgets, order: state.dashboard.order });
      state.dashboardLoaded = true;
      updateDashboardModeControls();
      queueDashboardRender({forceReload:false, sections:['filters','kpis','pipeline','today','leaderboard','stale','focus']});
      try{
        if(window.Settings && typeof window.Settings.save === 'function'){
          await window.Settings.save({ dashboard: { mode: normalized } });
        }
      }catch (err) {
        console && console.warn && console.warn('dashboard mode save failed', err);
      }
    }

    function setReportView(view){
      state.reportView = view;
      renderReports();
    }

    document.addEventListener('click', evt => {
      const modeBtn = evt.target.closest('[data-dashboard-mode]');
      if(modeBtn){
        evt.preventDefault();
        const mode = modeBtn.getAttribute('data-dashboard-mode');
        setDashboardMode(mode);
        return;
      }
      const doneBtn = evt.target.closest('[data-act="task-done"]');
      if(doneBtn){
        evt.preventDefault();
        const id = doneBtn.getAttribute('data-task-id');
        markTaskDone(id);
        return;
      }
      const contactBtn = evt.target.closest('[data-role="open-contact"]');
      if(contactBtn){
        evt.preventDefault();
        const id = contactBtn.getAttribute('data-contact-id');
        if(!id || typeof openContactModal !== 'function') return;
        try{
          openContactModal(id, { sourceHint: 'dashboard:reports', trigger: contactBtn });
        }catch(err){
          try{ console && console.warn && console.warn('[dashboard:reports] openContactModal failed', err); }
          catch(_warn){}
        }
        return;
      }
      const row = evt.target.closest('#referral-leaderboard [data-partner-id]');
      if(row){
        evt.preventDefault();
        if(typeof evt.stopPropagation === 'function') evt.stopPropagation();
        if(typeof evt.stopImmediatePropagation === 'function') evt.stopImmediatePropagation();
        const pid = row.getAttribute('data-partner-id');
        if(!pid) return;
        const openOpts = { trigger: row, sourceHint: 'dashboard:leaderboard-click' };
        let result = null;
        try{
          if(typeof openPartnerEditModal === 'function'){
            result = openPartnerEditModal(pid, openOpts);
          }else if(typeof window.requestPartnerModal === 'function'){
            result = window.requestPartnerModal(pid, openOpts);
          }
        }catch(err){
          try{ console && console.warn && console.warn('openPartnerEditModal failed', err); }
          catch(_err){}
          try{
            if(typeof window.requestPartnerModal === 'function'){
              window.requestPartnerModal(pid, openOpts);
            }
          }catch(_err2){}
        }
        if(result && typeof result.catch === 'function'){
          result.catch(err => {
            try{ console && console.warn && console.warn('openPartnerEditModal failed', err); }
            catch(_err){}
          });
        }
        return;
      }
      const tab = evt.target.closest('[data-report-tab]');
      if(tab){
        evt.preventDefault();
        const key = tab.getAttribute('data-report-tab');
        setReportView(key);
        return;
      }
      const exportBtn = evt.target.closest('[data-act="export-csv"]');
      if(exportBtn){
        evt.preventDefault();
        const key = exportBtn.getAttribute('data-report-key');
        handleExport(key);
      }
    });

    const watchedEvents = ['contact:updated','stage:changed','automation:executed','task:updated'];
    watchedEvents.forEach(evtName => {
      document.addEventListener(evtName, evt => {
        const detail = evt?.detail || {};
        if(evtName === 'task:updated'){
          queueDashboardRender({forceReload:true, sections:['kpis','today','focus']});
        }else{
          queueDashboardRender({forceReload:true, sections:['filters','kpis','pipeline','today','leaderboard','stale','focus'], includeReports:true});
        }
      });
    });

    function extractPartialLaneTokens(partial){
      const tokens = [];
      if(!partial) return tokens;
      if(typeof partial === 'string'){ tokens.push(partial); return tokens; }
      if(Array.isArray(partial)){ partial.forEach(value => { if(typeof value === 'string') tokens.push(value); }); return tokens; }
      if(typeof partial === 'object'){
        if(typeof partial.lane === 'string') tokens.push(partial.lane);
        if(Array.isArray(partial.lanes)) partial.lanes.forEach(value => { if(typeof value === 'string') tokens.push(value); });
      }
      return tokens;
    }

    function isPipelineLaneToken(token){
      if(typeof token !== 'string') return false;
      const normalized = token.trim().toLowerCase();
      if(!normalized.startsWith('pipeline:')) return false;
      const suffix = normalized.slice('pipeline:'.length);
      if(!suffix || suffix === '*' || suffix === 'all') return true;
      return PIPELINE_LANES.includes(suffix);
    }

    document.addEventListener('app:data:changed', evt => {
      const detail = evt && evt.detail ? evt.detail : {};
      const lanes = extractPartialLaneTokens(detail.partial);
      if(lanes.length){
        if(lanes.some(isPipelineLaneToken)){
          queueDashboardRender({forceReload:true, sections:['pipeline']});
        }
        return;
      }
      const scope = detail.scope;
      if(scope && scope !== 'settings') return;
      state.dashboardLoaded = false;
      queueDashboardRender({forceReload:false, sections:['filters','kpis','pipeline','today','leaderboard','stale','focus']});
    });

    if(typeof window.registerRenderHook === 'function'){
      window.registerRenderHook(async ()=>{
        await renderDashboard();
        await renderReports();
      });
    }else{
      const boot = ()=>{
        renderDashboard();
        renderReports();
      };
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
      else boot();
    }
}

export async function init(ctx){
  ensureCRM();
  const log = (ctx?.logger?.log)||console.log;
  const error = (ctx?.logger?.error) || ((...args) => console.warn('[soft]', ...args));

  if(__wired){
    log('[patch_2025-09-26_phase3_dashboard_reports.init] already wired');
    window.CRM.health['patch_2025-09-26_phase3_dashboard_reports'] ??= 'ok';
    return;
  }
  __wired = true;

  try {
    await domReady();
    runPatch();
    window.CRM.health['patch_2025-09-26_phase3_dashboard_reports'] = 'ok';
    log('[patch_2025-09-26_phase3_dashboard_reports.init] complete');
  } catch (e) {
    window.CRM.health['patch_2025-09-26_phase3_dashboard_reports'] = 'error';
    error('[patch_2025-09-26_phase3_dashboard_reports.init] failed', e);
  }
}

ensureCRM();
window.CRM.modules['patch_2025-09-26_phase3_dashboard_reports'] = window.CRM.modules['patch_2025-09-26_phase3_dashboard_reports'] || {};
window.CRM.modules['patch_2025-09-26_phase3_dashboard_reports'].init = init;

