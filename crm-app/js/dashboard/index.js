import { makeDraggableGrid } from '../ui/drag_core.js';
import { openContactModal } from '../contacts.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';
import { createLegendPopover, STAGE_LEGEND_ENTRIES } from '../ui/legend_popover.js';

const doc = typeof document === 'undefined' ? null : document;
const win = typeof window === 'undefined' ? null : window;

const DASHBOARD_CONTAINER_SELECTOR = 'main[data-ui="dashboard-root"]';
const DASHBOARD_ITEM_SELECTOR = ':scope > [data-dash-widget]';
const DASHBOARD_WIDGET_NODE_SELECTOR = 'section.card, section.grid, div.card, section.status-stack';
const DASHBOARD_ORDER_STORAGE_KEY = 'crm:dashboard:widget-order';
const DASHBOARD_STYLE_ID = 'dashboard-dnd-style';
const DASHBOARD_CLICK_THRESHOLD = 5;

const KPI_KEYS = [
  'kpiNewLeads7d',
  'kpiActivePipeline',
  'kpiFundedYTD',
  'kpiFundedVolumeYTD',
  'kpiAvgCycleLeadToFunded',
  'kpiTasksToday',
  'kpiTasksOverdue',
  'kpiReferralsYTD'
];

const GRAPH_RESOLVERS = {
  goalProgress: () => doc ? doc.getElementById('goal-progress-card') : null,
  numbersPortfolio: () => doc ? doc.getElementById('numbers-portfolio-card') : null,
  numbersMomentum: () => doc ? doc.getElementById('numbers-momentum-card') : null,
  pipelineCalendar: () => doc ? doc.getElementById('pipeline-calendar-card') : null
};

const WIDGET_RESOLVERS = {
  focus: () => doc ? doc.getElementById('dashboard-focus') : null,
  filters: () => doc ? doc.getElementById('dashboard-filters') : null,
  kpis: () => doc ? doc.getElementById('dashboard-kpis') : null,
  pipeline: () => doc ? doc.getElementById('dashboard-pipeline-overview') : null,
  today: () => doc ? doc.getElementById('dashboard-today') : null,
  leaderboard: () => doc ? doc.getElementById('referral-leaderboard') : null,
  stale: () => doc ? doc.getElementById('dashboard-stale') : null,
  goalProgress: () => doc ? doc.getElementById('goal-progress-card') : null,
  numbersPortfolio: () => doc ? doc.getElementById('numbers-portfolio-card') : null,
  numbersReferrals: () => doc ? doc.getElementById('numbers-referrals-card') : null,
  numbersMomentum: () => doc ? doc.getElementById('numbers-momentum-card') : null,
  pipelineCalendar: () => doc ? doc.getElementById('pipeline-calendar-card') : null,
  priorityActions: () => doc ? doc.getElementById('priority-actions-card') : null,
  milestones: () => doc ? doc.getElementById('milestones-card') : null,
  docPulse: () => doc ? doc.getElementById('doc-pulse-card') : null,
  relationshipOpportunities: () => doc ? doc.getElementById('rel-opps-card') : null,
  clientCareRadar: () => doc ? doc.getElementById('nurture-card') : null,
  closingWatch: () => doc ? doc.getElementById('closing-watch-card') : null,
  docCenter: () => doc ? doc.getElementById('doc-center-card') : null,
  statusStack: () => doc ? doc.getElementById('dashboard-status-stack') : null
};

const WIDGET_CARD_RESOLVERS = {
  priorityActions: () => {
    if(!doc) return null;
    const node = doc.getElementById('needs-attn');
    return node ? node.closest('.insight-card') : null;
  },
  milestones: () => {
    if(!doc) return null;
    const node = doc.getElementById('upcoming');
    return node ? node.closest('.insight-card') : null;
  },
  docPulse: () => {
    if(!doc) return null;
    const node = doc.getElementById('doc-status-summary');
    return node ? node.closest('.insight-card') : null;
  },
  relationshipOpportunities: () => doc ? doc.getElementById('rel-opps-card') : null,
  clientCareRadar: () => doc ? doc.getElementById('nurture-card') : null,
  closingWatch: () => doc ? doc.getElementById('closing-watch-card') : null
};

const WIDGET_DOM_ID_MAP = {
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

const WIDGET_ID_LOOKUP = new Map();

function registerWidgetLookupId(value, key) {
  if (!value || !key) return;
  const normalized = String(value).trim();
  if (!normalized) return;
  if (!WIDGET_ID_LOOKUP.has(normalized)) {
    WIDGET_ID_LOOKUP.set(normalized, key);
  }
  const lower = normalized.toLowerCase();
  if (!WIDGET_ID_LOOKUP.has(lower)) {
    WIDGET_ID_LOOKUP.set(lower, key);
  }
}

Object.entries(WIDGET_DOM_ID_MAP).forEach(([key, domId]) => {
  registerWidgetLookupId(domId, key);
});

function refreshWidgetIdLookup() {
  if (!doc) return;
  Object.entries(WIDGET_RESOLVERS).forEach(([key, resolver]) => {
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    if (!node) return;
    registerWidgetLookupId(node.id, key);
    const dataset = node.dataset || {};
    ['dashWidget', 'widgetId', 'widget', 'widgetKey'].forEach(attr => {
      if (!dataset[attr]) return;
      registerWidgetLookupId(dataset[attr], key);
    });
  });
}

function resolveWidgetKeyFromId(rawId) {
  if (rawId == null) return '';
  const normalized = String(rawId).trim();
  if (!normalized) return '';
  const direct = WIDGET_ID_LOOKUP.get(normalized) || WIDGET_ID_LOOKUP.get(normalized.toLowerCase());
  if (direct) return direct;
  refreshWidgetIdLookup();
  return WIDGET_ID_LOOKUP.get(normalized) || WIDGET_ID_LOOKUP.get(normalized.toLowerCase()) || '';
}

const GRAPH_KEYS = new Set(Object.keys(GRAPH_RESOLVERS));
const WIDGET_CARD_KEYS = new Set(Object.keys(WIDGET_CARD_RESOLVERS));

const prefCache = { value: null, loading: null };

const dashDnDState = {
  controller: null,
  container: null,
  orderSignature: '',
  pointerHandlers: null
};

const pointerTapState = new Map();
const DASHBOARD_SKIP_CLICK_KEY = '__dashSkipClickUntil';
const DASHBOARD_HANDLED_CLICK_KEY = '__dashLastHandledAt';
const DASHBOARD_SKIP_CLICK_WINDOW = 350;

function ensureDashboardLegend(){
  if(!doc) return;
  const header = doc.getElementById('dashboard-header');
  if(!header || header.__legendAttached) return;
  if(typeof header.querySelector !== 'function' || typeof header.appendChild !== 'function'){
    header.__legendAttached = true;
    return;
  }
  const legend = createLegendPopover({
    id: 'dashboard-stage-legend',
    summaryLabel: 'Legend',
    summaryAriaLabel: 'Dashboard color legend',
    title: 'Stage colors',
    entries: STAGE_LEGEND_ENTRIES,
    note: 'Status pills reuse these tones for Active, Client, Lost, and Paused states.'
  });
  if(!legend) return;
  const canInsertBefore = typeof header.insertBefore === 'function';
  const scopeGroup = typeof header.querySelector === 'function' ? header.querySelector('[role="group"][aria-label]') : null;
  if(scopeGroup && canInsertBefore){
    header.insertBefore(legend, scopeGroup);
  }else{
    const grow = typeof header.querySelector === 'function' ? header.querySelector('.grow') : null;
    if(grow && grow.parentElement === header && canInsertBefore){
      header.insertBefore(legend, grow.nextSibling);
    }else{
      header.appendChild(legend);
    }
  }
  header.__legendAttached = true;
}

function normalizeOrderList(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map(value => {
      if (value == null) return '';
      return String(value).trim();
    })
    .filter(Boolean);
}

function syncStoredDashboardOrder(orderLike) {
  if (typeof localStorage === 'undefined') return;
  const normalized = normalizeOrderList(orderLike);
  try {
    if (!normalized.length) {
      localStorage.removeItem(DASHBOARD_ORDER_STORAGE_KEY);
      dashDnDState.orderSignature = '';
      return;
    }
    const raw = localStorage.getItem(DASHBOARD_ORDER_STORAGE_KEY);
    let current = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          current = parsed.map(value => (value == null ? '' : String(value))).filter(Boolean);
        }
      } catch (_err) {}
    }
    const sameLength = normalized.length === current.length;
    const matches = sameLength && normalized.every((value, index) => value === current[index]);
    if (!matches) {
      localStorage.setItem(DASHBOARD_ORDER_STORAGE_KEY, JSON.stringify(normalized));
    }
    dashDnDState.orderSignature = normalized.join('|');
  } catch (_err) {}
}

function ensureDashboardDragStyles() {
  if (!doc) return;
  if (doc.getElementById(DASHBOARD_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = DASHBOARD_STYLE_ID;
  style.textContent = `
[data-ui="dashboard-root"].dash-grid-host {
  display: grid;
  gap: 24px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: stretch;
}

@media (min-width: 64rem) {
  [data-ui="dashboard-root"].dash-grid-host {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 90rem) {
  [data-ui="dashboard-root"].dash-grid-host {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

[data-ui="dashboard-root"].dash-grid-host > #dashboard-header,
[data-ui="dashboard-root"].dash-grid-host > .dash-full-width {
  grid-column: 1 / -1;
}

[data-ui="dashboard-root"].dash-grid-host > section.grid,
[data-ui="dashboard-root"].dash-grid-host > section.status-stack {
  grid-column: 1 / -1;
}

[data-ui="dashboard-root"].dash-grid-host > [data-dash-widget] {
  position: relative;
  min-width: 0;
  height: 100%;
}

.dash-drag-handle {
  position: absolute;
  top: 12px;
  left: 12px;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(226, 232, 240, 0.9));
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.18);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(51, 65, 85, 0.88);
  font-size: 18px;
  line-height: 1;
  cursor: grab;
  z-index: 5;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.dash-drag-handle::before {
  content: '';
  width: 18px;
  height: 18px;
  background-image: radial-gradient(currentColor 1px, transparent 1px);
  background-size: 4px 4px;
  opacity: 0.82;
}

.dash-drag-handle span {
  pointer-events: none;
  display: none;
}

.dash-drag-handle:hover {
  background: linear-gradient(180deg, rgba(241, 245, 249, 0.95), rgba(226, 232, 240, 0.95));
  color: rgba(30, 41, 59, 0.92);
}

.dash-drag-handle:focus-visible {
  outline: 2px solid var(--focus-ring, #2563eb);
  outline-offset: 2px;
}

.dash-dragging .dash-drag-handle {
  cursor: grabbing;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.2);
}

.dash-drag-placeholder {
  border: 2px dashed rgba(148, 163, 184, 0.55);
  border-radius: 18px;
  background-color: rgba(148, 163, 184, 0.12);
  background-image: repeating-linear-gradient(135deg, rgba(148, 163, 184, 0.18) 0, rgba(148, 163, 184, 0.18) 4px, transparent 4px, transparent 8px);
  transition: opacity 0.18s ease;
}

.dash-dragging .dash-drag-placeholder {
  opacity: 0.85;
}

.dash-gridlines {
  display: none;
  border-radius: 18px;
  border: 2px dashed rgba(148, 163, 184, 0.45);
  opacity: 0.7;
  background-size: var(--dash-grid-step-x, 320px) var(--dash-grid-step-y, 240px);
  background-image:
    repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.22) 0, rgba(148, 163, 184, 0.22) 1px, transparent 1px, transparent var(--dash-grid-step-y, 240px)),
    repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.22) 0, rgba(148, 163, 184, 0.22) 1px, transparent 1px, transparent var(--dash-grid-step-x, 320px));
}

.dash-dragging .dash-gridlines {
  display: block;
}

.dash-dragging [data-dash-widget] {
  transition: transform 0.18s ease;
}
`;
  const head = doc.head || doc.getElementsByTagName('head')[0];
  if (head) {
    head.appendChild(style);
  }
}

function slugify(text) {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findWidgetLabel(node) {
  if (!node) return '';
  const dataLabel = node.getAttribute ? node.getAttribute('data-widget-label') : null;
  if (dataLabel) return dataLabel.trim();
  try {
    const labelNode = node.querySelector('[data-ui="card-title"], .insight-head h4, .insight-head strong, h2, h3, h4, header h2, header h3, header h4, strong');
    if (labelNode && typeof labelNode.textContent === 'string') {
      return labelNode.textContent.trim();
    }
  } catch (_err) {}
  return node.id ? String(node.id).trim() : '';
}

function ensureWidgetHandle(node) {
  if (!doc || !node) return null;
  try {
    const existing = node.querySelector(':scope > .dash-drag-handle');
    if (existing) return existing;
  } catch (_err) {}
  const handle = doc.createElement('button');
  handle.type = 'button';
  handle.className = 'dash-drag-handle';
  handle.setAttribute('aria-label', 'Drag widget to reorder');
  handle.title = 'Drag to reorder widgets';
  const icon = doc.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⋮⋮';
  handle.appendChild(icon);
  handle.addEventListener('click', evt => {
    evt.preventDefault();
    evt.stopPropagation();
  });
  try {
    node.insertBefore(handle, node.firstChild || null);
  } catch (_err) {
    node.appendChild(handle);
  }
  return handle;
}

function getDashboardContainerNode() {
  if (!doc) return null;
  try {
    return doc.querySelector(DASHBOARD_CONTAINER_SELECTOR);
  } catch (_err) {
    return null;
  }
}

function collectWidgetNodes(container) {
  if (!container) return [];
  const nodes = [];
  const children = container.children ? Array.from(container.children) : [];
  children.forEach(child => {
    if (!child || child.nodeType !== 1) return;
    if (child.matches && child.matches(DASHBOARD_WIDGET_NODE_SELECTOR)) {
      nodes.push(child);
    }
  });
  return nodes;
}

function registerCanonicalKey(targetMap, key, canonical) {
  if (!targetMap || !canonical) return;
  if (!key) return;
  const value = String(key).trim();
  if (!value) return;
  if (!targetMap.has(value)) {
    targetMap.set(value, canonical);
  }
  const slug = slugify(value);
  if (slug && !targetMap.has(slug)) {
    targetMap.set(slug, canonical);
  }
}

function buildCanonicalWidgetKeyIndex(container) {
  if (!container) return null;
  const byNode = new WeakMap();
  const byKey = new Map();
  const registerNode = (node, canonical) => {
    if (!node || !canonical) return;
    try {
      byNode.set(node, canonical);
    } catch (_err) {}
    registerCanonicalKey(byKey, canonical, canonical);
    const dataset = node.dataset || {};
    registerCanonicalKey(byKey, dataset.dashWidget, canonical);
    registerCanonicalKey(byKey, dataset.widgetId, canonical);
    registerCanonicalKey(byKey, dataset.widget, canonical);
    registerCanonicalKey(byKey, dataset.widgetKey, canonical);
    registerCanonicalKey(byKey, node.id, canonical);
  };
  const resolverEntries = Object.entries(WIDGET_RESOLVERS).concat(Object.entries(WIDGET_CARD_RESOLVERS));
  resolverEntries.forEach(([canonical, resolver]) => {
    if (typeof resolver !== 'function') return;
    let resolved = null;
    try {
      resolved = resolver();
    } catch (_err) {}
    if (!resolved) return;
    const widgetNode = container.contains(resolved)
      ? resolved
      : (resolved.closest ? resolved.closest('[data-dash-widget]') : null);
    if (widgetNode && container.contains(widgetNode)) {
      registerNode(widgetNode, canonical);
    }
  });
  return { byNode, byKey };
}

function findCanonicalWidgetKey(node, candidateKey, canonicalIndex) {
  if (!node || !canonicalIndex) return '';
  const { byNode, byKey } = canonicalIndex;
  if (byNode && byNode.has(node)) {
    return byNode.get(node) || '';
  }
  const dataset = node.dataset || {};
  const candidates = [
    candidateKey,
    dataset.dashWidget,
    dataset.widgetId,
    dataset.widget,
    dataset.widgetKey,
    node.id
  ];
  if (byKey) {
    for (let i = 0; i < candidates.length; i += 1) {
      const value = candidates[i] ? String(candidates[i]).trim() : '';
      if (!value) continue;
      if (byKey.has(value)) {
        return byKey.get(value) || '';
      }
      const slug = slugify(value);
      if (slug && byKey.has(slug)) {
        return byKey.get(slug) || '';
      }
    }
  }
  return '';
}

function ensureDashboardWidgets(container) {
  const nodes = collectWidgetNodes(container);
  if (!nodes.length) return nodes;
  ensureDashboardDragStyles();
  if (container && container.classList && !container.classList.contains('dash-grid-host')) {
    container.classList.add('dash-grid-host');
  }
  const canonicalIndex = buildCanonicalWidgetKeyIndex(container);
  const seen = new Set();
  nodes.forEach((node, index) => {
    if (!node || node.nodeType !== 1) return;
    const dataset = node.dataset || {};
    let key = dataset.dashWidget || dataset.widgetId || dataset.widget || dataset.widgetKey || node.id || '';
    key = key ? String(key).trim() : '';
    const canonicalKey = findCanonicalWidgetKey(node, key, canonicalIndex);
    if (canonicalKey) {
      key = canonicalKey;
    }
    if (!key) {
      const label = findWidgetLabel(node);
      key = slugify(label) || `widget-${index + 1}`;
    }
    let uniqueKey = key;
    let dedupe = 1;
    while (seen.has(uniqueKey)) {
      dedupe += 1;
      uniqueKey = `${key}-${dedupe}`;
    }
    seen.add(uniqueKey);
    node.dataset.dashWidget = uniqueKey;
    node.setAttribute('data-dash-widget', uniqueKey);
    ensureWidgetHandle(node);
    if (node.classList && (node.classList.contains('grid') || node.classList.contains('status-stack'))) {
      node.classList.add('dash-full-width');
    }
  });
  return nodes;
}

function tryOpenContact(contactId) {
  const id = contactId == null ? '' : String(contactId).trim();
  if (!id) return;
  try {
    const result = openContactModal(id);
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        try {
          if (console && console.warn) console.warn('[dashboard] openContactModal failed', err);
        } catch (_warnErr) {}
      });
    }
  } catch (err) {
    try {
      if (console && console.warn) console.warn('[dashboard] openContactModal failed', err);
    } catch (_warnErr) {}
  }
}

function tryOpenPartner(partnerId) {
  const id = partnerId == null ? '' : String(partnerId).trim();
  if (!id) return;
  try {
    const result = openPartnerEditModal(id);
    if (result && typeof result.catch === 'function') {
      result.catch(err => {
        try {
          if (console && console.warn) console.warn('[dashboard] openPartnerEditModal failed', err);
        } catch (_warnErr) {}
      });
    }
  } catch (err) {
    try {
      if (console && console.warn) console.warn('[dashboard] openPartnerEditModal failed', err);
    } catch (_warnErr) {}
  }
}

function handleDashboardTap(evt, target) {
  if (!target) return false;
  const contactId = target.getAttribute('data-contact-id');
  if (contactId) {
    evt.preventDefault();
    evt.stopPropagation();
    tryOpenContact(contactId);
    return true;
  }
  const partnerId = target.getAttribute('data-partner-id');
  if (partnerId) {
    evt.preventDefault();
    evt.stopPropagation();
    tryOpenPartner(partnerId);
    return true;
  }
  return false;
}

function wireTileTap(container) {
  if (!container || dashDnDState.pointerHandlers) return;
  const onPointerDown = evt => {
    if (evt.pointerType !== 'touch' && evt.pointerType !== 'pen') {
      if (evt.button != null && evt.button !== 0) return;
    }
    if (evt.target && evt.target.closest && evt.target.closest('.dash-drag-handle')) return;
    const dataTarget = evt.target && evt.target.closest ? evt.target.closest('[data-contact-id],[data-partner-id]') : null;
    if (!dataTarget) return;
    pointerTapState.set(evt.pointerId, {
      startX: evt.clientX,
      startY: evt.clientY,
      dataTarget,
      cancelled: false,
      preventClick: false
    });
  };
  const onPointerMove = evt => {
    const state = pointerTapState.get(evt.pointerId);
    if (!state || state.cancelled) return;
    const dx = Math.abs(evt.clientX - state.startX);
    const dy = Math.abs(evt.clientY - state.startY);
    if (dx > DASHBOARD_CLICK_THRESHOLD || dy > DASHBOARD_CLICK_THRESHOLD) {
      state.cancelled = true;
      state.preventClick = true;
    }
  };
  const onPointerUp = evt => {
    const state = pointerTapState.get(evt.pointerId);
    pointerTapState.delete(evt.pointerId);
    if (!state) return;
    if (state.preventClick && state.dataTarget) {
      state.dataTarget[DASHBOARD_SKIP_CLICK_KEY] = Date.now() + DASHBOARD_SKIP_CLICK_WINDOW;
      return;
    }
    if (state.cancelled) return;
    const resolved = evt.target && evt.target.closest ? evt.target.closest('[data-contact-id],[data-partner-id]') : null;
    const target = resolved || state.dataTarget;
    if (!target) return;
    const handled = handleDashboardTap(evt, target);
    if (handled) {
      target[DASHBOARD_HANDLED_CLICK_KEY] = Date.now();
    }
  };
  const onPointerCancel = evt => {
    const state = pointerTapState.get(evt.pointerId);
    pointerTapState.delete(evt.pointerId);
    if (state && state.dataTarget && state.preventClick) {
      state.dataTarget[DASHBOARD_SKIP_CLICK_KEY] = Date.now() + DASHBOARD_SKIP_CLICK_WINDOW;
    }
  };
  const onKeyDown = evt => {
    if (evt.repeat) return;
    if (evt.key !== 'Enter' && evt.key !== ' ') return;
    if (evt.target && evt.target.closest && evt.target.closest('.dash-drag-handle')) return;
    const target = evt.target && evt.target.closest ? evt.target.closest('[data-contact-id],[data-partner-id]') : null;
    if (!target) return;
    const handled = handleDashboardTap(evt, target);
    if (handled) {
      target[DASHBOARD_HANDLED_CLICK_KEY] = Date.now();
    }
  };
  const onClick = evt => {
    if (evt.target && evt.target.closest && evt.target.closest('.dash-drag-handle')) return;
    const target = evt.target && evt.target.closest ? evt.target.closest('[data-contact-id],[data-partner-id]') : null;
    if (!target) return;
    const skipUntil = target[DASHBOARD_SKIP_CLICK_KEY] || 0;
    if (skipUntil && skipUntil > Date.now()) {
      target[DASHBOARD_SKIP_CLICK_KEY] = 0;
      return;
    }
    const lastHandled = target[DASHBOARD_HANDLED_CLICK_KEY] || 0;
    if (lastHandled && Date.now() - lastHandled < DASHBOARD_SKIP_CLICK_WINDOW) {
      return;
    }
    const handled = handleDashboardTap(evt, target);
    if (handled) {
      target[DASHBOARD_HANDLED_CLICK_KEY] = Date.now();
    }
  };
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  container.addEventListener('keydown', onKeyDown);
  container.addEventListener('click', onClick);
  dashDnDState.pointerHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onKeyDown, onClick };
}

function persistDashboardOrder(orderLike) {
  const normalized = normalizeOrderList(orderLike);
  const signature = normalized.join('|');
  if (signature === dashDnDState.orderSignature) return;
  dashDnDState.orderSignature = signature;
  if (!normalized.length) return;
  if (win && win.Settings) {
    try {
      const api = win.Settings;
      let result = null;
      if (typeof api.persistDashboardOrder === 'function') {
        result = api.persistDashboardOrder(normalized);
      } else if (typeof api.save === 'function') {
        result = api.save({ dashboardOrder: normalized });
      }
      if (result && typeof result.catch === 'function') {
        result.catch(err => {
          try {
            if (console && console.warn) console.warn('[dashboard] order save failed', err);
          } catch (_warnErr) {}
        });
      }
    } catch (err) {
      try {
        if (console && console.warn) console.warn('[dashboard] order save failed', err);
      } catch (_warnErr) {}
    }
  }
}

function readCurrentDashboardOrder() {
  const container = dashDnDState.container || getDashboardContainerNode();
  if (!container) return [];
  const nodes = collectWidgetNodes(container);
  if (!nodes.length) return [];
  return nodes
    .map(node => {
      if (!node) return '';
      const dataset = node.dataset || {};
      const value = dataset.dashWidget || dataset.widgetId || node.id || '';
      return value ? String(value).trim() : '';
    })
    .filter(Boolean);
}

function persistDashboardOrderImmediate() {
  const order = readCurrentDashboardOrder();
  if (!order.length) {
    syncStoredDashboardOrder(order);
    return;
  }
  const signature = order.join('|');
  if (signature !== dashDnDState.orderSignature) {
    persistDashboardOrder(order);
  }
  syncStoredDashboardOrder(order);
}

function ensureWidgetDnD() {
  const container = getDashboardContainerNode();
  if (!container) return;
  dashDnDState.container = container;
  const nodes = ensureDashboardWidgets(container);
  if (!nodes.length) {
    if (dashDnDState.controller && typeof dashDnDState.controller.disable === 'function') {
      dashDnDState.controller.disable();
    }
    return;
  }
  if (dashDnDState.controller && typeof dashDnDState.controller.enable === 'function') {
    dashDnDState.controller.enable();
  }
  if (!dashDnDState.controller) {
    try {
      dashDnDState.controller = makeDraggableGrid({
        container,
        itemSel: DASHBOARD_ITEM_SELECTOR,
        handleSel: '.dash-drag-handle',
        storageKey: DASHBOARD_ORDER_STORAGE_KEY,
        idGetter: el => (el && el.dataset && el.dataset.dashWidget) ? el.dataset.dashWidget : (el && el.id ? String(el.id).trim() : ''),
        onOrderChange: persistDashboardOrder,
        grid: { gap: 24 }
      });
    } catch (err) {
      try {
        if (console && console.warn) console.warn('[dashboard] drag init failed', err);
      } catch (_warnErr) {}
    }
  } else if (typeof dashDnDState.controller.refresh === 'function') {
    dashDnDState.controller.refresh();
  }
  wireTileTap(container);
}

function buildDefaultMap(keys) {
  const map = {};
  keys.forEach(key => {
    map[key] = true;
  });
  return map;
}

function defaultPrefs() {
  return {
    widgets: buildDefaultMap(Object.keys(WIDGET_RESOLVERS)),
    kpis: buildDefaultMap(KPI_KEYS),
    graphs: buildDefaultMap(Object.keys(GRAPH_RESOLVERS)),
    widgetCards: buildDefaultMap(Object.keys(WIDGET_CARD_RESOLVERS))
  };
}

function clonePrefs(prefs) {
  return {
    widgets: Object.assign({}, prefs.widgets),
    kpis: Object.assign({}, prefs.kpis),
    graphs: Object.assign({}, prefs.graphs),
    widgetCards: Object.assign({}, prefs.widgetCards)
  };
}

function sanitizePrefs(settings) {
  const prefs = defaultPrefs();
  const dash = settings && typeof settings === 'object' ? settings.dashboard : null;
  if (!dash || typeof dash !== 'object') return prefs;
  const widgetSource = dash.widgets && typeof dash.widgets === 'object' ? dash.widgets : null;
  if (widgetSource) {
    Object.keys(prefs.widgets).forEach(key => {
      if (typeof widgetSource[key] === 'boolean') prefs.widgets[key] = widgetSource[key];
    });
    if (typeof widgetSource.numbersGlance === 'boolean') {
      const legacyValue = widgetSource.numbersGlance;
      ['numbersPortfolio', 'numbersReferrals', 'numbersMomentum'].forEach(key => {
        if (typeof widgetSource[key] !== 'boolean') prefs.widgets[key] = legacyValue;
      });
    }
  }
  const kpiSource = dash.kpis && typeof dash.kpis === 'object' ? dash.kpis : null;
  if (kpiSource) {
    Object.keys(prefs.kpis).forEach(key => {
      if (typeof kpiSource[key] === 'boolean') prefs.kpis[key] = kpiSource[key];
    });
  }
  const graphSource = dash.graphs && typeof dash.graphs === 'object' ? dash.graphs : null;
  if (graphSource) {
    Object.keys(prefs.graphs).forEach(key => {
      if (typeof graphSource[key] === 'boolean') prefs.graphs[key] = graphSource[key];
    });
    if (typeof graphSource.numbersGlance === 'boolean') {
      const legacyValue = graphSource.numbersGlance;
      ['numbersPortfolio', 'numbersMomentum'].forEach(key => {
        if (typeof graphSource[key] !== 'boolean') prefs.graphs[key] = legacyValue;
      });
    }
  }
  const widgetCardSource = dash.widgetCards && typeof dash.widgetCards === 'object' ? dash.widgetCards : null;
  if (widgetCardSource) {
    Object.keys(prefs.widgetCards).forEach(key => {
      if (typeof widgetCardSource[key] === 'boolean') prefs.widgetCards[key] = widgetCardSource[key];
    });
  }
  return prefs;
}

function getSettingsPrefs() {
  if (prefCache.value) return Promise.resolve(clonePrefs(prefCache.value));
  if (prefCache.loading) return prefCache.loading.then(clonePrefs);
  prefCache.loading = (async () => {
    let settings = null;
    if (win && win.Settings && typeof win.Settings.get === 'function') {
      try {
        settings = await win.Settings.get();
      } catch (err) {
        if (console && console.warn) console.warn('[dashboard] settings fetch failed', err);
      }
    }
    if (settings && typeof settings === 'object') {
      const orderFromSettings = Array.isArray(settings.dashboardOrder)
        ? settings.dashboardOrder
        : (settings.dashboard && Array.isArray(settings.dashboard.order) ? settings.dashboard.order : null);
      if (orderFromSettings) syncStoredDashboardOrder(orderFromSettings);
    }
    const prefs = sanitizePrefs(settings);
    prefCache.value = prefs;
    prefCache.loading = null;
    return prefs;
  })();
  return prefCache.loading.then(clonePrefs);
}

function invalidatePrefs() {
  prefCache.value = null;
}

function applyNodeVisibility(node, show) {
  if (!node) return;
  const style = node && typeof node.style === 'object' ? node.style : null;
  const hasDataset = !!(node && node.dataset && typeof node.dataset === 'object');
  const dataset = hasDataset ? node.dataset : null;
  const storeKey = '__dashPrefDisplay';
  const hasSetAttr = typeof node.setAttribute === 'function';
  const hasRemoveAttr = typeof node.removeAttribute === 'function';

  if (show) {
    let displayValue = '';
    if (hasDataset && Object.prototype.hasOwnProperty.call(dataset, 'dashPrefDisplay')) {
      displayValue = dataset.dashPrefDisplay || '';
    } else if (!hasDataset && Object.prototype.hasOwnProperty.call(node, storeKey)) {
      displayValue = node[storeKey] || '';
    }
    if (style) {
      style.display = displayValue;
    }
    if (!hasDataset && Object.prototype.hasOwnProperty.call(node, storeKey)) {
      node[storeKey] = displayValue;
    }
    if (hasRemoveAttr) {
      node.removeAttribute('aria-hidden');
    }
  } else {
    if (style) {
      const currentDisplay = style.display || '';
      if (hasDataset) {
        if (!Object.prototype.hasOwnProperty.call(dataset, 'dashPrefDisplay')) {
          dataset.dashPrefDisplay = currentDisplay;
        }
      } else if (!Object.prototype.hasOwnProperty.call(node, storeKey)) {
        try {
          Object.defineProperty(node, storeKey, { value: currentDisplay, writable: true, configurable: true });
        } catch (_err) {
          node[storeKey] = currentDisplay;
        }
      }
      style.display = 'none';
    }
    if (hasSetAttr) {
      node.setAttribute('aria-hidden', 'true');
    }
  }
}

function applyHiddenWidgetPrefs(hiddenList) {
  refreshWidgetIdLookup();
  const items = Array.isArray(hiddenList) ? hiddenList : [];
  const hiddenKeys = new Set();
  items.forEach(entry => {
    const key = resolveWidgetKeyFromId(entry);
    if (key) hiddenKeys.add(key);
  });
  const base = prefCache.value ? clonePrefs(prefCache.value) : defaultPrefs();
  const next = clonePrefs(base);
  let changed = false;
  Object.keys(next.widgets).forEach(key => {
    const visible = !hiddenKeys.has(key);
    if (next.widgets[key] !== visible) {
      next.widgets[key] = visible;
      changed = true;
    }
  });
  if (!changed && prefCache.value) return false;
  prefCache.value = next;
  prefCache.loading = null;
  applySurfaceVisibility(next);
  ensureWidgetDnD();
  return true;
}

function applySurfaceVisibility(prefs) {
  const widgetPrefs = prefs && typeof prefs.widgets === 'object' ? prefs.widgets : {};
  const graphPrefs = prefs && typeof prefs.graphs === 'object' ? prefs.graphs : {};
  const cardPrefs = prefs && typeof prefs.widgetCards === 'object' ? prefs.widgetCards : {};
  const handledGraphs = new Set();
  const handledCards = new Set();

  Object.entries(WIDGET_RESOLVERS).forEach(([key, resolver]) => {
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const widgetEnabled = widgetPrefs[key] !== false;
    const graphEnabled = GRAPH_KEYS.has(key) ? graphPrefs[key] !== false : true;
    const cardEnabled = WIDGET_CARD_KEYS.has(key) ? cardPrefs[key] !== false : true;
    if(GRAPH_KEYS.has(key)) handledGraphs.add(key);
    if(WIDGET_CARD_KEYS.has(key)) handledCards.add(key);
    const show = widgetEnabled && graphEnabled && cardEnabled;
    applyNodeVisibility(node, show);
  });

  Object.entries(GRAPH_RESOLVERS).forEach(([key, resolver]) => {
    if(handledGraphs.has(key)) return;
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = graphPrefs[key] !== false;
    applyNodeVisibility(node, show);
  });

  Object.entries(WIDGET_CARD_RESOLVERS).forEach(([key, resolver]) => {
    if(handledCards.has(key)) return;
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = cardPrefs[key] !== false;
    applyNodeVisibility(node, show);
  });
}

function applyKpiVisibility(prefs) {
  if(!doc) return;
  const host = doc.getElementById('dashboard-kpis');
  if (!host) return;
  const grid = host.querySelector('.grid.kpi');
  if (!grid) return;
  const cards = Array.from(grid.querySelectorAll('.card'));
  let visible = 0;
  cards.forEach((card, index) => {
    const key = card.dataset && card.dataset.kpiKey ? card.dataset.kpiKey : KPI_KEYS[index] || '';
    if (card.dataset && !card.dataset.kpiKey && KPI_KEYS[index]) {
      card.dataset.kpiKey = KPI_KEYS[index];
    }
    const show = key && prefs[key] === false ? false : true;
    if (show) visible += 1;
    card.style.display = show ? '' : 'none';
    card.setAttribute('aria-hidden', show ? 'false' : 'true');
  });
  const helper = host.querySelector('[data-role="kpi-empty"]');
  if (visible === 0) {
    grid.style.display = 'none';
    if (!helper) {
      const msg = doc.createElement('div');
      msg.dataset.role = 'kpi-empty';
      msg.className = 'muted';
      msg.style.padding = '12px';
      msg.style.textAlign = 'center';
      msg.textContent = 'Enable KPI tiles in Settings to show metrics.';
      host.appendChild(msg);
    }
  } else {
    grid.style.display = '';
    if (helper) helper.remove();
  }
}

let pendingApply = false;

function scheduleApply() {
  if (pendingApply) return;
  if (!doc) return;
  pendingApply = true;
  Promise.resolve().then(async () => {
    pendingApply = false;
    try {
      ensureDashboardLegend();
      refreshWidgetIdLookup();
      const prefs = await getSettingsPrefs();
      applySurfaceVisibility(prefs);
      applyKpiVisibility(prefs.kpis);
    } catch (err) {
      if (console && console.warn) console.warn('[dashboard] apply prefs failed', err);
    }
    ensureWidgetDnD();
  });
}

function handleHiddenChange(evt) {
  const detail = evt && typeof evt === 'object' ? evt.detail : null;
  const hidden = detail && Array.isArray(detail.hidden) ? detail.hidden : [];
  applyHiddenWidgetPrefs(hidden);
  persistDashboardOrderImmediate();
  const container = dashDnDState.container || getDashboardContainerNode();
  if (container) {
    ensureDashboardWidgets(container);
  }
  if (dashDnDState.controller && typeof dashDnDState.controller.refresh === 'function') {
    dashDnDState.controller.refresh();
  } else {
    ensureWidgetDnD();
  }
}

function init() {
  if (!doc) return;
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => {
      scheduleApply();
      ensureWidgetDnD();
    }, { once: true });
  } else {
    scheduleApply();
    ensureWidgetDnD();
  }
  if (win && win.RenderGuard && typeof win.RenderGuard.registerHook === 'function') {
    try {
      win.RenderGuard.registerHook(scheduleApply);
    } catch (_err) {}
  }
  if (win) {
    win.addEventListener('hashchange', scheduleApply);
  }
  doc.addEventListener('dashboard:hidden-change', handleHiddenChange);
  doc.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope ? evt.detail.scope : '';
    if (scope === 'settings') invalidatePrefs();
    scheduleApply();
  });
}

init();
