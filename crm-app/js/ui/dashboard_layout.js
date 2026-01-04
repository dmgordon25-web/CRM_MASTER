import { makeDraggableGrid, applyOrder as applyGridOrder, attachOnce, listenerCount as dragListenerCount } from './drag_core.js';
import { getSettingsApi } from '../app_context.js';
import { DEFAULT_WIDGET_SET, PREVIEW_WIDGET_SET } from '../dashboard/config.js';

const ORDER_STORAGE_KEY = 'dash:layout:order:v1';
const HIDDEN_STORAGE_KEY = 'dash:layout:hidden:v1';
const MODE_STORAGE_KEY = 'dash:layoutMode:v1';
const LEGACY_ORDER_KEYS = ['dash:layout:1'];
const LEGACY_WIDGET_ORDER_KEY = 'dashboard.widgets.order';
const LEGACY_HIDDEN_KEYS = ['dash:hidden:1'];
const LEGACY_MODE_KEYS = ['dash:layoutMode:1'];
const ITEM_SELECTOR = ':scope > section.card, :scope > section.grid, :scope > div.card';
const GROUP_WIDGET_SELECTOR = '#dashboard-insights > .card, #dashboard-insights > section.card, #dashboard-opportunities > .card, #dashboard-opportunities > section.card';
const HANDLE_SELECTOR = '[data-ui="card-title"], .insight-head, .row > strong:first-child, header, h2, h3, h4';
const STYLE_ID = 'dash-layout-mode-style';
const STYLE_ORIGIN = 'crm:dashboard:layout-mode';
const STYLE_TEXT = `
[data-dash-layout-mode="on"] [data-ui="card-title"],
[data-dash-layout-mode="on"] .insight-head,
[data-dash-layout-mode="on"] header,
[data-dash-layout-mode="on"] h2,
[data-dash-layout-mode="on"] h3,
[data-dash-layout-mode="on"] h4 {
  cursor: grab;
  transition: opacity 0.2s ease;
}
[data-dash-layout-mode="on"] [data-ui="card-title"]:hover,
[data-dash-layout-mode="on"] .insight-head:hover,
[data-dash-layout-mode="on"] header:hover,
[data-dash-layout-mode="on"] h2:hover,
[data-dash-layout-mode="on"] h3:hover,
[data-dash-layout-mode="on"] h4:hover {
  opacity: 0.8;
}
[data-dash-layout-mode="on"] .dash-drag-placeholder {
  border: 2px dashed var(--primary, #3b82f6);
  background: linear-gradient(135deg, rgba(59,130,246,0.12) 25%, rgba(59,130,246,0.06) 25%, rgba(59,130,246,0.06) 50%, rgba(59,130,246,0.12) 50%);
  background-size: 20px 20px;
  border-radius: 12px;
  animation: dash-placeholder-pulse 1.5s ease-in-out infinite;
}
[data-dash-layout-mode="on"] .dash-drag-placeholder::before {
  content: 'Drop here';
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary, #3b82f6);
  font-weight: 600;
  font-size: 14px;
  opacity: 0.7;
}
[data-dash-layout-mode="on"] .dash-gridlines {
  border: 2px dashed var(--border-medium, #94a3b8);
  border-radius: 14px;
  opacity: 0.5;
  background-image:
    repeating-linear-gradient(0deg, rgba(148,163,184,0.2) 0, rgba(148,163,184,0.2) 1px, transparent 1px, transparent 40px),
    repeating-linear-gradient(90deg, rgba(148,163,184,0.2) 0, rgba(148,163,184,0.2) 1px, transparent 1px, transparent 40px);
  background-size: cover;
  transition: opacity 0.2s ease;
}
[data-dash-layout-mode="on"] .dash-gridlines:hover {
  opacity: 0.7;
}
@keyframes dash-placeholder-pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
}
[data-dash-layout-mode="on"] section.card,
[data-dash-layout-mode="on"] section.grid,
[data-dash-layout-mode="on"] div.card {
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
[data-dash-layout-mode="on"] section.card:hover,
[data-dash-layout-mode="on"] section.grid:hover,
[data-dash-layout-mode="on"] div.card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}
[data-dash-layout-mode="on"] .dash-resize-handle {
  opacity: 0.6;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}
[data-dash-layout-mode="on"] .dash-resize-handle:hover {
  opacity: 1;
  background-color: var(--primary, #3b82f6);
}
`;
const DASHBOARD_ROOT_SELECTOR = 'main[data-ui="dashboard-root"]';
const DASH_LAYOUT_PREFIX = 'dash:layout';
const RESET_STORAGE_KEYS = [ORDER_STORAGE_KEY, HIDDEN_STORAGE_KEY, MODE_STORAGE_KEY, ...LEGACY_ORDER_KEYS, ...LEGACY_HIDDEN_KEYS, ...LEGACY_MODE_KEYS];
const DASHBOARD_ORDER_CACHE_KEY = 'crm:dashboard:widget-order';
const RESET_OPTIONAL_KEYS = [LEGACY_WIDGET_ORDER_KEY, DASHBOARD_ORDER_CACHE_KEY];

const DASHBOARD_WIDGETS = [
  { id: 'dashboard-focus', key: 'focus', label: 'Focus Summary' },
  { id: 'dashboard-filters', key: 'filters', label: 'Filters' },
  { id: 'dashboard-kpis', key: 'kpis', label: 'KPIs' },
  { id: 'dashboard-pipeline-overview', key: 'pipeline', label: 'Pipeline Overview' },
  { id: 'dashboard-today', key: 'today', label: "Today's Work" },
  { id: 'dashboard-todo', key: 'todo', label: 'To-Do' },
  { id: 'priority-actions-card', key: 'priorityActions', label: 'Priority Actions' },
  { id: 'dashboard-stale', key: 'stale', label: 'Stale Deals' },
  { id: 'referral-leaderboard', key: 'leaderboard', label: 'Referral Leaderboard', defaultEnabled: false },
  { id: 'favorites-card', key: 'favorites', label: 'Favorites', defaultEnabled: false },
  { id: 'goal-progress-card', key: 'goalProgress', label: 'Production Goals', defaultEnabled: false },
  { id: 'numbers-portfolio-card', key: 'numbersPortfolio', label: 'Partner Portfolio', defaultEnabled: false },
  { id: 'numbers-referrals-card', key: 'numbersReferrals', label: 'Referral Leaders', defaultEnabled: false },
  { id: 'numbers-momentum-card', key: 'numbersMomentum', label: 'Pipeline Momentum', defaultEnabled: false },
  { id: 'pipeline-calendar-card', key: 'pipelineCalendar', label: 'Pipeline Calendar', defaultEnabled: false },
  { id: 'milestones-card', key: 'milestones', label: 'Milestones Ahead', defaultEnabled: false },
  { id: 'doc-pulse-card', key: 'docPulse', label: 'Document Pulse', defaultEnabled: false },
  { id: 'rel-opps-card', key: 'relationshipOpportunities', label: 'Relationship Opportunities', defaultEnabled: false },
  { id: 'nurture-card', key: 'clientCareRadar', label: 'Client Care Radar', defaultEnabled: false },
  { id: 'closing-watch-card', key: 'closingWatch', label: 'Closing Watchlist', defaultEnabled: false },
  { id: 'dashboard-celebrations', key: 'upcomingCelebrations', label: 'Upcoming Birthdays & Anniversaries (7 days)', defaultEnabled: false },
  { id: 'doc-center-card', key: 'docCenter', label: 'Document Center', defaultEnabled: false }
];

const LEGACY_WIDGET_REDIRECT = (() => {
  const entries = [
    ['numbers-glance-card', ['numbers-portfolio-card', 'numbers-referrals-card', 'numbers-momentum-card']],
    ['numbersGlance', ['numbers-portfolio-card', 'numbers-referrals-card', 'numbers-momentum-card']],
    ['dashboard-insights', ['goal-progress-card', 'numbers-portfolio-card', 'numbers-referrals-card', 'numbers-momentum-card', 'pipeline-calendar-card', 'priority-actions-card', 'milestones-card', 'doc-pulse-card']],
    ['insights', ['goal-progress-card', 'numbers-portfolio-card', 'numbers-referrals-card', 'numbers-momentum-card', 'pipeline-calendar-card', 'priority-actions-card', 'milestones-card', 'doc-pulse-card']],
    ['dashboard-opportunities', ['rel-opps-card', 'nurture-card', 'closing-watch-card']],
    ['opportunities', ['rel-opps-card', 'nurture-card', 'closing-watch-card']]
  ];
  const map = new Map();
  entries.forEach(([alias, ids]) => {
    if(!alias || !ids || !ids.length) return;
    const primary = String(alias).trim();
    if(!primary) return;
    const value = ids.filter(Boolean).map(id => String(id).trim()).filter(Boolean);
    if(!value.length) return;
    map.set(primary, value.slice());
    map.set(primary.toLowerCase(), value.slice());
    map.set(normalizeId(primary), value.slice());
  });
  return map;
})();

const KEY_TO_ID = new Map();
const ID_TO_KEY = new Map();
DASHBOARD_WIDGETS.forEach(widget => {
  if(!widget || typeof widget !== 'object') return;
  const key = typeof widget.key === 'string' ? widget.key : String(widget.key || '');
  const id = typeof widget.id === 'string' ? widget.id : String(widget.id || '');
  if(!key || !id) return;
  KEY_TO_ID.set(key, id);
  KEY_TO_ID.set(key.toLowerCase(), id);
  ID_TO_KEY.set(id, key);
  ID_TO_KEY.set(id.toLowerCase(), key);
});

const DEFAULT_LAYOUT_COLUMNS = 3;
const DEFAULT_LAYOUT_MODE = 'today';
const DEFAULT_ALLOWED_SET = new Set(DEFAULT_WIDGET_SET);
const PREVIEW_ALLOWED_SET = new Set(PREVIEW_WIDGET_SET);
const CANONICAL_WIDGET_IDS = {
  default: buildCanonicalIds(DEFAULT_ALLOWED_SET),
  preview: buildCanonicalIds(PREVIEW_ALLOWED_SET),
  customized: buildCanonicalIds(DEFAULT_ALLOWED_SET)
};
const CANONICAL_HIDDEN_IDS = {
  default: buildCanonicalHiddenIds(DEFAULT_ALLOWED_SET),
  preview: buildCanonicalHiddenIds(PREVIEW_ALLOWED_SET),
  customized: buildCanonicalHiddenIds(DEFAULT_ALLOWED_SET)
};

const state = {
  wired: false,
  container: null,
  drag: null,
  layoutMode: false,
  hidden: new Set(),
  readyLogged: false,
  stableLogged: false,
  idMemo: new WeakMap(),
  slugCounts: new Map(),
  late: { raf: null, timeout: null, observer: null },
  hiddenSignature: null,
  orderSignature: null,
  suppressOrderPersist: false,
  settingsListenerWired: false,
  layoutProfile: 'default'
};

function normalizeLayoutProfile(mode){
  if(mode === 'customized') return 'customized';
  if(mode === 'preview') return 'preview';
  return 'default';
}

function buildCanonicalIds(allowedSet){
  const prioritized = [];
  const trailing = [];
  DASHBOARD_WIDGETS.forEach(widget => {
    if(!widget || !widget.id) return;
    const bucket = allowedSet.has(widget.key) ? prioritized : trailing;
    bucket.push(normalizeId(widget.id));
  });
  return prioritized.concat(trailing).filter(Boolean);
}

function buildCanonicalHiddenIds(allowedSet){
  const hidden = [];
  DASHBOARD_WIDGETS.forEach(widget => {
    const id = normalizeId(widget && widget.id);
    if(!id || !widget || !widget.key) return;
    if(!allowedSet.has(widget.key)) hidden.push(id);
  });
  return hidden;
}

function getCanonicalIds(profile){
  return CANONICAL_WIDGET_IDS[normalizeLayoutProfile(profile)] || CANONICAL_WIDGET_IDS.default;
}

function getCanonicalHidden(profile){
  return CANONICAL_HIDDEN_IDS[normalizeLayoutProfile(profile)] || CANONICAL_HIDDEN_IDS.default;
}

function getSettingsService(){
  return getSettingsApi();
}

function postLog(event, data){
  const payload = JSON.stringify(Object.assign({ event }, data || {}));
  if(typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'){
    try{
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/__log', blob);
      return;
    }catch (_err){}
  }
  if(typeof fetch === 'function'){
    try{ fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }); }
    catch (_err){}
  }
}

function ensureStyleNode(){
  if(typeof document === 'undefined') return null;
  const head = document.head || document.getElementsByTagName('head')[0] || document.documentElement;
  if(!head || typeof head.appendChild !== 'function') return null;
  const selector = `style[data-origin="${STYLE_ORIGIN}"]`;
  let style = typeof document.querySelector === 'function' ? document.querySelector(selector) : null;
  if(!style && typeof document.getElementById === 'function'){
    style = document.getElementById(STYLE_ID);
  }
  if(style){
    if(style.getAttribute && style.getAttribute('data-origin') !== STYLE_ORIGIN){
      try{ style.setAttribute('data-origin', STYLE_ORIGIN); }
      catch(_err){}
    }
    return style;
  }
  style = document.createElement('style');
  style.id = STYLE_ID;
  style.setAttribute('data-origin', STYLE_ORIGIN);
  return head.appendChild(style);
}

function ensureStyle(){
  const style = ensureStyleNode();
  if(!style) return;
  if(style.textContent !== STYLE_TEXT){
    style.textContent = STYLE_TEXT;
  }
}

function normalizeId(value){
  if(value == null) return '';
  return String(value).trim();
}

function readJson(key){
  if(typeof localStorage === 'undefined') return null;
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch (_err){
    return null;
  }
}

function readOrderIds(){
  const stored = readJson(ORDER_STORAGE_KEY);
  if(Array.isArray(stored) && stored.length){
    return stored.map(normalizeId).filter(Boolean);
  }
  for(const key of LEGACY_ORDER_KEYS){
    const legacy = readJson(key);
    if(Array.isArray(legacy) && legacy.length){
      return legacy.map(normalizeId).filter(Boolean);
    }
  }
  const legacyKeys = readJson(LEGACY_WIDGET_ORDER_KEY);
  if(Array.isArray(legacyKeys) && legacyKeys.length){
    return convertKeysToIds(legacyKeys.map(normalizeId));
  }
  return [];
}

function writeOrderIds(orderIds){
  if(state.layoutProfile !== 'customized') return;
  const normalized = Array.isArray(orderIds) ? orderIds.map(normalizeId).filter(Boolean) : [];
  if(typeof localStorage === 'undefined') return;
  try{
    if(normalized.length){
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(normalized));
    }else{
      localStorage.removeItem(ORDER_STORAGE_KEY);
    }
    for(const key of LEGACY_ORDER_KEYS){
      localStorage.removeItem(key);
    }
    const legacy = convertIdsToKeys(normalized);
    if(legacy.length){
      localStorage.setItem(LEGACY_WIDGET_ORDER_KEY, JSON.stringify(legacy));
    }else{
      localStorage.removeItem(LEGACY_WIDGET_ORDER_KEY);
    }
  }catch (_err){}
}

function readHiddenIds(){
  const stored = readJson(HIDDEN_STORAGE_KEY);
  if(Array.isArray(stored) && stored.length){
    return stored.map(normalizeId).filter(Boolean);
  }
  for(const key of LEGACY_HIDDEN_KEYS){
    const legacy = readJson(key);
    if(Array.isArray(legacy) && legacy.length){
      return legacy.map(normalizeId).filter(Boolean);
    }
  }
  return [];
}

function writeHiddenIds(ids){
  if(state.layoutProfile !== 'customized') return;
  const normalized = Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : [];
  if(typeof localStorage === 'undefined') return;
  try{
    if(normalized.length){
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(normalized));
    }else{
      localStorage.removeItem(HIDDEN_STORAGE_KEY);
    }
    for(const key of LEGACY_HIDDEN_KEYS){
      localStorage.removeItem(key);
    }
  }catch (_err){}
}

function computeHiddenSignature(hiddenSet){
  if(!(hiddenSet instanceof Set)) return '';
  const parts = [];
  DASHBOARD_WIDGETS.forEach(widget => {
    if(!widget || !widget.key) return;
    const id = normalizeId(widget.id);
    if(!id) return;
    const hidden = hiddenSet.has(id);
    parts.push(`${widget.key}:${hidden ? '0' : '1'}`);
  });
  return parts.join('|');
}

function computeOrderSignature(orderIds){
  const keys = convertIdsToKeys(orderIds);
  return keys.join('|');
}

function collectDashLayoutKeys(){
  const keys = new Set(RESET_STORAGE_KEYS.concat(RESET_OPTIONAL_KEYS));
  if(typeof localStorage === 'undefined'){
    return Array.from(keys);
  }
  try{
    for(let index = 0; index < localStorage.length; index += 1){
      const key = localStorage.key(index);
      if(typeof key === 'string' && key.startsWith(DASH_LAYOUT_PREFIX)){
        keys.add(key);
      }
    }
  }catch (_err){}
  return Array.from(keys);
}

function clearDashLayoutStorage(){
  if(typeof localStorage === 'undefined') return [];
  const removed = [];
  const seen = new Set();
  const keys = collectDashLayoutKeys();
  keys.forEach(key => {
    if(!key || seen.has(key)) return;
    seen.add(key);
    try{
      const existing = localStorage.getItem(key);
      if(existing !== null){
        removed.push(key);
      }
    }catch (_err){}
    try{ localStorage.removeItem(key); }
    catch (_err2){}
  });
  return removed;
}

function buildCanonicalWidgetPrefs(){
  const prefs = {};
  DASHBOARD_WIDGETS.forEach(widget => {
    if(!widget || typeof widget !== 'object') return;
    const key = widget.key == null ? '' : String(widget.key).trim();
    if(!key) return;
    prefs[key] = widget.defaultEnabled !== false;
  });
  return prefs;
}

function persistHiddenToSettings(hiddenSet){
  const settingsApi = getSettingsService();
  if(!settingsApi || typeof settingsApi.save !== 'function') return;
  const signature = computeHiddenSignature(hiddenSet);
  if(signature === state.hiddenSignature) return;
  const widgets = {};
  DASHBOARD_WIDGETS.forEach(widget => {
    if(!widget || !widget.key) return;
    const id = normalizeId(widget.id);
    if(!id) return;
    widgets[widget.key] = !hiddenSet.has(id);
  });
  const payload = { dashboard: { widgets } };
  Promise.resolve(settingsApi.save(payload))
    .then(result => {
      if(result === false) return;
      state.hiddenSignature = signature;
    })
    .catch(err => {
      if(console && console.warn) console.warn('[dashboard-layout] settings save (hidden) failed', err);
    });
}

function persistOrderToSettings(orderIds){
  const settingsApi = getSettingsService();
  if(!settingsApi || typeof settingsApi.save !== 'function') return;
  const signature = computeOrderSignature(orderIds);
  if(signature === state.orderSignature) return;
  const keys = convertIdsToKeys(orderIds);
  const payload = { dashboardOrder: keys };
  Promise.resolve(settingsApi.save(payload))
    .then(result => {
      if(result === false) return;
      state.orderSignature = signature;
    })
    .catch(err => {
      if(console && console.warn) console.warn('[dashboard-layout] settings save (order) failed', err);
    });
}

function readLayoutModeFlag(){
  if(typeof localStorage === 'undefined') return false;
  try{
    const raw = localStorage.getItem(MODE_STORAGE_KEY);
    if(raw === '1' || raw === 'true') return true;
    if(raw === '0' || raw === 'false') return false;
    for(const key of LEGACY_MODE_KEYS){
      const legacy = localStorage.getItem(key);
      if(legacy === '1' || legacy === 'true') return true;
      if(legacy === '0' || legacy === 'false') return false;
    }
  }catch (_err){}
  return false;
}

function writeLayoutModeFlag(enabled){
  if(typeof localStorage === 'undefined') return;
  try{
    localStorage.setItem(MODE_STORAGE_KEY, enabled ? '1' : '0');
    for(const key of LEGACY_MODE_KEYS){
      localStorage.removeItem(key);
    }
  }catch (_err){}
}

function convertKeysToIds(keys){
  const results = [];
  if(!Array.isArray(keys)) return results;
  keys.forEach(raw => {
    const value = raw == null ? '' : String(raw).trim();
    if(!value) return;
    const redirect = LEGACY_WIDGET_REDIRECT.get(value) || LEGACY_WIDGET_REDIRECT.get(value.toLowerCase()) || LEGACY_WIDGET_REDIRECT.get(normalizeId(value));
    if(Array.isArray(redirect) && redirect.length){
      redirect.forEach(id => {
        const normalized = normalizeId(id);
        if(normalized) results.push(normalized);
      });
      return;
    }
    const mapped = KEY_TO_ID.get(value) || KEY_TO_ID.get(value.toLowerCase()) || value;
    const normalized = normalizeId(mapped);
    if(normalized) results.push(normalized);
  });
  return results;
}

function convertIdsToKeys(ids){
  if(!Array.isArray(ids)) return [];
  return ids
    .map(id => {
      const value = id == null ? '' : String(id).trim();
      if(!value) return '';
      const mapped = ID_TO_KEY.get(value) || ID_TO_KEY.get(value.toLowerCase()) || ID_TO_KEY.get(normalizeId(value));
      return mapped || value;
    })
    .map(normalizeId)
    .filter(Boolean);
}

function slugify(text){
  if(!text) return '';
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function resolveTitleText(node){
  if(!node) return '';
  const label = node.getAttribute ? node.getAttribute('data-widget-label') : null;
  if(label) return label.trim();
  try{
    const handle = node.querySelector(HANDLE_SELECTOR);
    if(handle && typeof handle.textContent === 'string'){
      return handle.textContent.trim();
    }
  }catch (_err){}
  return '';
}

function getDashboardContainer(){
  if(typeof document === 'undefined') return null;
  return document.querySelector(DASHBOARD_ROOT_SELECTOR)
    || document.getElementById('view-dashboard')
    || null;
}

function ensureContainer(){
  if(typeof document === 'undefined') return null;
  if(state.container && document.contains(state.container)) return state.container;
  const next = getDashboardContainer();
  if(next) state.container = next;
  return state.container;
}

function shouldSkipWidget(node){
  if(!node || node.nodeType !== 1) return true;
  if(node.dataset && node.dataset.role === 'dash-empty-state') return true;
  return false;
}

function collectWidgets(container){
  if(!container) return [];
  try{
    return Array.from(container.querySelectorAll(ITEM_SELECTOR))
      .filter(node => node && node.nodeType === 1 && !shouldSkipWidget(node));
  }catch (_err){
    return [];
  }
}

function collectGroupWidgets(container){
  if(!container) return [];
  try{
    return Array.from(container.querySelectorAll(GROUP_WIDGET_SELECTOR))
      .filter(node => node && node.nodeType === 1 && !shouldSkipWidget(node));
  }catch (_err){
    return [];
  }
}

function collectAllWidgets(container){
  if(!container) return [];
  const list = [];
  const seen = new Set();
  const push = (node) => {
    if(!node || node.nodeType !== 1) return;
    if(seen.has(node)) return;
    seen.add(node);
    list.push(node);
  };
  collectWidgets(container).forEach(push);
  collectGroupWidgets(container).forEach(push);
  return list;
}

function ensureWidgetId(node, seen){
  if(!node) return '';
  const dataset = node.dataset || {};
  const memo = state.idMemo.get(node);
  let candidate = normalizeId(dataset.widgetId || dataset.widget || dataset.widgetKey || memo || node.id);
  if(!candidate){
    const title = resolveTitleText(node);
    candidate = slugify(title);
  }
  if(!candidate){
    candidate = 'widget';
  }else{
    candidate = slugify(candidate) || 'widget';
  }
  let finalId = candidate;
  if(seen.has(finalId)){
    let index = state.slugCounts.get(candidate) || 1;
    finalId = `${candidate}-${index}`;
    while(seen.has(finalId)){
      index += 1;
      finalId = `${candidate}-${index}`;
    }
    state.slugCounts.set(candidate, index + 1);
  }else{
    state.slugCounts.set(candidate, Math.max(1, state.slugCounts.get(candidate) || 1));
  }
  node.dataset.widgetId = finalId;
  state.idMemo.set(node, finalId);
  seen.add(finalId);
  return finalId;
}

function expandHiddenIds(values){
  const result = new Set();
  if(!values) return result;
  const add = (id) => {
    const normalized = normalizeId(id);
    if(normalized) result.add(normalized);
  };
  if(values instanceof Set){
    values.forEach(value => {
      const raw = value == null ? '' : String(value).trim();
      if(!raw) return;
      const redirect = LEGACY_WIDGET_REDIRECT.get(raw) || LEGACY_WIDGET_REDIRECT.get(raw.toLowerCase()) || LEGACY_WIDGET_REDIRECT.get(normalizeId(raw));
      if(Array.isArray(redirect) && redirect.length){
        redirect.forEach(add);
        return;
      }
      add(raw);
    });
    return result;
  }
  if(Array.isArray(values)){
    values.forEach(value => {
      const raw = value == null ? '' : String(value).trim();
      if(!raw) return;
      const redirect = LEGACY_WIDGET_REDIRECT.get(raw) || LEGACY_WIDGET_REDIRECT.get(raw.toLowerCase()) || LEGACY_WIDGET_REDIRECT.get(normalizeId(raw));
      if(Array.isArray(redirect) && redirect.length){
        redirect.forEach(add);
        return;
      }
      add(raw);
    });
  }
  return result;
}

function prepareWidgets(container){
  const items = collectAllWidgets(container);
  if(!items.length) return items;
  state.slugCounts = new Map();
  const seen = new Set();
  items.forEach(item => ensureWidgetId(item, seen));
  return items;
}

function getWidgetId(node){
  if(!node) return '';
  const dataset = node.dataset || {};
  const value = dataset.widgetId || state.idMemo.get(node) || '';
  return normalizeId(value);
}

function updateEmptyStateVisibility(target, visibleCount){
  if(!target || typeof target.querySelector !== 'function') return;
  const emptyState = target.querySelector('[data-role="dash-empty-state"]');
  const isEmpty = visibleCount === 0;
  if(isEmpty){
    if(target.setAttribute) target.setAttribute('data-dash-empty', 'true');
    if(emptyState){
      emptyState.hidden = false;
      emptyState.removeAttribute('aria-hidden');
    }
  }else{
    if(target.removeAttribute) target.removeAttribute('data-dash-empty');
    if(emptyState){
      emptyState.hidden = true;
      emptyState.setAttribute('aria-hidden', 'true');
    }
  }
}

function applyVisibility(container){
  const target = container || ensureContainer();
  if(!target) return;
  const items = collectAllWidgets(target);
  if(!items.length) return;
  let visibleCount = 0;
  const seen = new Set();
  items.forEach(item => {
    const widgetId = ensureWidgetId(item, seen);
    const hide = state.hidden.has(widgetId);
    if(hide){
      if(item.dataset.dashPrevDisplay === undefined){
        item.dataset.dashPrevDisplay = item.style.display || '';
      }
      item.style.display = 'none';
      item.setAttribute('aria-hidden', 'true');
      item.dataset.dashHidden = 'true';
    }else{
      if(item.dataset.dashPrevDisplay !== undefined){
        item.style.display = item.dataset.dashPrevDisplay;
        delete item.dataset.dashPrevDisplay;
      }else{
        item.style.display = '';
      }
      item.removeAttribute('aria-hidden');
      if(item.dataset.dashHidden) delete item.dataset.dashHidden;
      visibleCount += 1;
    }
  });
  updateEmptyStateVisibility(target, visibleCount);
}

function applyLayoutFromStorage(reason){
  const container = ensureContainer();
  if(!container) return false;
  const profile = normalizeLayoutProfile(state.layoutProfile);
  const useStoredLayout = profile === 'customized';
  const hiddenSource = useStoredLayout ? readHiddenIds() : getCanonicalHidden(profile);
  state.hidden = expandHiddenIds(hiddenSource);
  prepareWidgets(container);
  const order = useStoredLayout ? readOrderIds() : getCanonicalIds(profile);
  if(order.length){
    applyGridOrder(container, order, ITEM_SELECTOR, getWidgetId);
  }
  applyVisibility(container);
  return true;
}

function lateApply(reason){
  const applied = applyLayoutFromStorage(reason);
  if(applied && !state.stableLogged){
    state.stableLogged = true;
    try{ console.info('[VIS] dash layout applied (stable)'); }
    catch (_err){}
    postLog('dash-layout-applied', reason ? { reason } : undefined);
  }
}

function cancelLatePass(){
  if(state.late.raf !== null && typeof cancelAnimationFrame === 'function'){
    try{ cancelAnimationFrame(state.late.raf); }
    catch (_err){}
  }
  state.late.raf = null;
  if(state.late.timeout !== null){
    try{ clearTimeout(state.late.timeout); }
    catch (_err){}
  }
  state.late.timeout = null;
  if(state.late.observer){
    try{ state.late.observer.disconnect(); }
    catch (_err){}
    state.late.observer = null;
  }
}

function scheduleLatePass(reason){
  const container = ensureContainer();
  cancelLatePass();
  const apply = () => lateApply(reason);
  if(typeof requestAnimationFrame === 'function'){
    state.late.raf = requestAnimationFrame(() => {
      state.late.raf = null;
      apply();
    });
  }
  if(typeof setTimeout === 'function'){
    state.late.timeout = setTimeout(() => {
      state.late.timeout = null;
      apply();
    }, 0);
  }
  if(container && typeof MutationObserver === 'function'){
    const observer = new MutationObserver(() => {
      observer.disconnect();
      if(state.late.observer === observer){
        state.late.observer = null;
      }
      apply();
    });
    try{ observer.observe(container, { childList: true }); state.late.observer = observer; }
    catch (_err){ observer.disconnect(); }
  }
}

function computeGridMetrics(container){
  const first = container ? container.querySelector(ITEM_SELECTOR) : null;
  if(!first || typeof first.getBoundingClientRect !== 'function'){
    return { colWidth: 320, rowHeight: 260, gap: 16 };
  }
  const rect = first.getBoundingClientRect();
  let gap = 16;
  if(typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'){
    try{
      const style = window.getComputedStyle(first);
      const values = [style.marginRight, style.marginBottom, style.columnGap, style.rowGap, style.gap]
        .map(val => parseFloat(val || '0'))
        .filter(num => Number.isFinite(num) && num >= 0);
      if(values.length){
        gap = Math.max(gap, ...values);
      }
    }catch (_err){}
  }
  return {
    colWidth: Math.max(1, rect.width),
    rowHeight: Math.max(1, rect.height),
    gap: Math.max(0, gap)
  };
}

function handleOrderChange(orderIds){
  const normalized = Array.isArray(orderIds) ? orderIds.map(normalizeId).filter(Boolean) : [];
  writeOrderIds(normalized);
  if(state.suppressOrderPersist){
    state.orderSignature = computeOrderSignature(normalized);
  }else{
    persistOrderToSettings(normalized);
  }
  scheduleLatePass('order-change');
}

function ensureDrag(){
  const container = ensureContainer();
  if(!container) return null;
  const metrics = computeGridMetrics(container);
  if(!state.drag){
    state.drag = makeDraggableGrid({
      container,
      itemSel: ITEM_SELECTOR,
      handleSel: HANDLE_SELECTOR,
      storageKey: ORDER_STORAGE_KEY,
      grid: metrics,
      idGetter: getWidgetId,
      enabled: state.layoutMode,
      onOrderChange: handleOrderChange
    });
    if(state.drag && typeof state.drag.setGrid === 'function'){
      state.drag.setGrid(metrics);
    }
    if(state.drag && typeof state.drag.setEditMode === 'function'){
      state.drag.setEditMode(state.layoutMode);
    }
    if(!state.readyLogged){
      state.readyLogged = true;
      try{ console.info('[VIS] dash drag ready (direct)'); }
      catch (_err){}
      postLog('dash-drag-direct');
    }
  }else{
    if(state.layoutMode) state.drag.enable();
    else state.drag.disable();
    if(state.drag && typeof state.drag.setGrid === 'function'){
      state.drag.setGrid(metrics);
    }
    if(state.drag && typeof state.drag.setEditMode === 'function'){
      state.drag.setEditMode(state.layoutMode);
    }
    state.drag.refresh();
  }
  return state.drag;
}

function updateLayoutModeAttr(){
  const container = ensureContainer();
  if(!container) return;
  container.setAttribute('data-dash-layout-mode', state.layoutMode ? 'on' : 'off');
}

function onStorage(evt){
  if(!evt || typeof evt.key !== 'string') return;
  if(evt.key === MODE_STORAGE_KEY || LEGACY_MODE_KEYS.includes(evt.key)){
    const next = readLayoutModeFlag();
    setDashboardLayoutMode(next, { persist: false, force: true, silent: true });
    return;
  }
  if(evt.key === HIDDEN_STORAGE_KEY || LEGACY_HIDDEN_KEYS.includes(evt.key)){
    state.hidden = new Set(readHiddenIds());
    requestDashboardLayoutPass({ reason: 'storage-hidden' });
    return;
  }
  if(evt.key === ORDER_STORAGE_KEY || LEGACY_ORDER_KEYS.includes(evt.key) || evt.key === LEGACY_WIDGET_ORDER_KEY){
    requestDashboardLayoutPass({ reason: 'storage-order', skipImmediate: true });
  }
}

function toIdSet(input){
  const result = new Set();
  if(input instanceof Set){
    input.forEach(value => {
      const id = normalizeId(value);
      if(id) result.add(id);
    });
    return result;
  }
  if(Array.isArray(input)){
    input.forEach(value => {
      const id = normalizeId(value);
      if(id) result.add(id);
    });
  }
  return result;
}

export function setDashboardLayoutMode(enabled, options = {}){
  const next = !!enabled;
  const force = !!options.force;
  if(!force && state.layoutMode === next) return;
  state.layoutMode = next;
  if(options.persist !== false){
    writeLayoutModeFlag(next);
  }
  ensureDrag();
  if(state.drag){
    if(next) state.drag.enable();
    else state.drag.disable();
    if(typeof state.drag.setEditMode === 'function'){
      state.drag.setEditMode(next);
    }
  }
  updateLayoutModeAttr();
  if(!options.silent){
    requestDashboardLayoutPass({ reason: 'layout-mode', skipImmediate: true });
  }
}

export function applyDashboardHidden(input, options = {}){
  const nextSet = toIdSet(input);
  const expanded = expandHiddenIds(nextSet);
  let changed = expanded.size !== state.hidden.size;
  if(!changed){
    for(const id of expanded){
      if(!state.hidden.has(id)){ changed = true; break; }
    }
  }
  if(!changed) return;
  state.hidden = expanded;
  const signature = computeHiddenSignature(expanded);
  if(options.persist !== false){
    writeHiddenIds(Array.from(expanded).sort());
    if(options.skipSettings){
      state.hiddenSignature = signature;
    }else{
      persistHiddenToSettings(expanded);
    }
  }else if(options.skipSettings){
    state.hiddenSignature = signature;
  }
  applyVisibility();
  if(options.persist === false && !options.skipSettings){
    state.hiddenSignature = signature;
  }
}

export function setDashboardLayoutProfile(mode){
  const normalized = normalizeLayoutProfile(mode);
  if(state.layoutProfile === normalized) return normalized;
  state.layoutProfile = normalized;
  requestDashboardLayoutPass({ reason: 'profile-change' });
  return normalized;
}

export function readStoredLayoutMode(){
  return readLayoutModeFlag();
}

export function readStoredHiddenIds(){
  return readHiddenIds();
}

export function getDashboardWidgets(){
  return DASHBOARD_WIDGETS.map(widget => ({ ...widget }));
}

export function reapplyDashboardLayout(reason){
  requestDashboardLayoutPass({ reason: reason || 'reapply' });
}

export function getDashboardListenerCount(){
  return dragListenerCount();
}

export function requestDashboardLayoutPass(input){
  const opts = typeof input === 'string' ? { reason: input } : (input || {});
  const reason = opts.reason || null;
  if(!opts.skipImmediate){
    lateApply(reason);
  }
  scheduleLatePass(reason);
}

export function resetDashboardLayoutState(options = {}){
  const removedKeys = clearDashLayoutStorage();
  setDashboardLayoutMode(false, { persist: false, force: true, silent: true });
  const profile = normalizeLayoutProfile(state.layoutProfile);
  const hiddenDefaults = profile === 'customized' ? [] : getCanonicalHidden(profile);
  state.hidden = new Set(hiddenDefaults);
  state.hiddenSignature = null;
  state.orderSignature = null;
  state.suppressOrderPersist = false;
  applyDashboardHidden(hiddenDefaults, { persist: false, skipSettings: true });
  if(options.skipLayoutPass !== true){
    const reason = options.reason || 'layout-reset';
    requestDashboardLayoutPass({ reason });
  }
  return { removedKeys };
}

export async function resetLayout(options = {}){
  const reason = options.reason || 'layout-reset';
  const wasEditing = !!state.layoutMode;
  const removedKeys = clearDashLayoutStorage();
  const profile = normalizeLayoutProfile(state.layoutProfile);
  const hiddenSet = new Set(getCanonicalHidden(profile));
  applyDashboardHidden(hiddenSet, { persist: false, skipSettings: true });
  const container = ensureContainer();
  if(container){
    prepareWidgets(container);
    const canonicalOrder = getCanonicalIds(profile);
    if(canonicalOrder.length){
      applyGridOrder(container, canonicalOrder, ITEM_SELECTOR, getWidgetId);
    }
    applyVisibility(container);
  }
  const canonicalOrder = getCanonicalIds(profile);
  state.orderSignature = computeOrderSignature(canonicalOrder);
  updateLayoutModeAttr();
  ensureDrag();
  if(state.drag && typeof state.drag.refresh === 'function'){
    try{ state.drag.refresh(); }
    catch (_err){}
  }
  try{ postLog('dash-layout-reset', { reason }); }
  catch (_err){}
  let settingsResult = null;
  const settingsApi = getSettingsService();
  if(settingsApi && typeof settingsApi.save === 'function'){
    const widgetPrefs = buildCanonicalWidgetPrefs();
    const payload = {
      dashboard: {
        mode: DEFAULT_LAYOUT_MODE,
        widgets: widgetPrefs,
        layout: { columns: DEFAULT_LAYOUT_COLUMNS, widths: {} }
      },
      dashboardOrder: convertIdsToKeys(canonicalOrder)
    };
    try{
      settingsResult = await settingsApi.save(payload, { silent: true });
    }catch (err){
      if(console && console.warn) console.warn('[dashboard-layout] settings reset failed', err);
    }
  }
  if(state.layoutMode !== wasEditing){
    setDashboardLayoutMode(wasEditing, { persist: false, force: true, silent: true });
  }else{
    updateLayoutModeAttr();
  }
  return { removedKeys, settingsResult };
}

async function syncDashboardPrefsFromSettings(reason){
  if(normalizeLayoutProfile(state.layoutProfile) !== 'customized') return;
  const settingsApi = getSettingsService();
  if(!settingsApi || typeof settingsApi.get !== 'function') return;
  try{
    const settings = await settingsApi.get();
    if(!settings) return;
    const dash = settings.dashboard && typeof settings.dashboard === 'object' ? settings.dashboard : {};
    const widgetsConfig = dash.widgets && typeof dash.widgets === 'object' ? dash.widgets : {};
    const hiddenIds = [];
    DASHBOARD_WIDGETS.forEach(widget => {
      if(!widget || !widget.key) return;
      if(widgetsConfig[widget.key] === false){
        hiddenIds.push(widget.id);
      }
    });
    applyDashboardHidden(hiddenIds, { skipSettings: true });
    state.hiddenSignature = computeHiddenSignature(state.hidden);
    const orderKeys = Array.isArray(settings.dashboardOrder) ? settings.dashboardOrder : [];
    const orderIds = convertKeysToIds(orderKeys);
    state.suppressOrderPersist = true;
    writeOrderIds(orderIds);
    const container = ensureContainer();
    if(container && orderIds.length){
      applyGridOrder(container, orderIds, ITEM_SELECTOR, getWidgetId);
    }
    state.suppressOrderPersist = false;
    state.orderSignature = computeOrderSignature(orderIds);
    scheduleLatePass(reason || 'settings-sync');
  }catch (err){
    if(console && console.warn) console.warn('[dashboard-layout] sync from settings failed', err);
  }
}

export function initDashboardLayout(){
  if(state.wired){
    applyLayoutFromStorage('reinit');
    ensureDrag();
    updateLayoutModeAttr();
    scheduleLatePass('reinit');
    syncDashboardPrefsFromSettings('reinit');
    return state;
  }
  state.layoutMode = readLayoutModeFlag();
  state.hidden = new Set(readHiddenIds());
  ensureStyle();
  applyLayoutFromStorage('init');
  ensureDrag();
  updateLayoutModeAttr();
  scheduleLatePass('init');
  syncDashboardPrefsFromSettings('init');
  if(typeof window !== 'undefined'){
    attachOnce(window, 'storage', onStorage, 'dash-layout:storage');
  }
  if(typeof window !== 'undefined'){
    window.RenderGuard?.registerHook?.(() => requestDashboardLayoutPass({ reason: 'render-guard', skipImmediate: true }));
  }
  if(!state.settingsListenerWired && typeof document !== 'undefined'){
    state.settingsListenerWired = true;
    document.addEventListener('app:data:changed', evt => {
      const scope = evt && evt.detail && evt.detail.scope;
      if(scope && scope !== 'settings') return;
      syncDashboardPrefsFromSettings('settings-change');
    });
  }
  state.wired = true;
  return state;
}

export default initDashboardLayout;
