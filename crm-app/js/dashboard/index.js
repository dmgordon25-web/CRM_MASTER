import { makeDraggableGrid } from '../ui/drag_core.js';
import { openContactModal } from '../contacts.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';

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
[data-dash-widget] {
  position: relative;
}

.dash-drag-handle {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(71, 85, 105, 0.85);
  font-size: 18px;
  line-height: 1;
  cursor: grab;
  z-index: 5;
  transition: background-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.dash-drag-handle:hover {
  background: rgba(148, 163, 184, 0.15);
  color: rgba(30, 41, 59, 0.85);
}

.dash-drag-handle:focus-visible {
  outline: 2px solid var(--focus-ring, #2563eb);
  outline-offset: 2px;
}

.dash-drag-handle span {
  pointer-events: none;
}

.dash-dragging .dash-drag-handle {
  cursor: grabbing;
}

.dash-gridlines {
  display: none;
  border-radius: 18px;
  border: 2px dashed rgba(148, 163, 184, 0.45);
  background-image:
    repeating-linear-gradient(0deg, rgba(148, 163, 184, 0.22) 0, rgba(148, 163, 184, 0.22) 1px, transparent 1px, transparent 32px),
    repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.22) 0, rgba(148, 163, 184, 0.22) 1px, transparent 1px, transparent 32px);
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
  handle.setAttribute('aria-label', 'Drag widget');
  handle.title = 'Drag to reorder';
  const icon = doc.createElement('span');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '⠿';
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

function ensureDashboardWidgets(container) {
  const nodes = collectWidgetNodes(container);
  if (!nodes.length) return nodes;
  ensureDashboardDragStyles();
  const seen = new Set();
  nodes.forEach((node, index) => {
    if (!node || node.nodeType !== 1) return;
    const dataset = node.dataset || {};
    let key = dataset.dashWidget || dataset.widgetId || dataset.widget || dataset.widgetKey || node.id || '';
    key = key ? String(key).trim() : '';
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
      cancelled: false
    });
  };
  const onPointerMove = evt => {
    const state = pointerTapState.get(evt.pointerId);
    if (!state || state.cancelled) return;
    const dx = Math.abs(evt.clientX - state.startX);
    const dy = Math.abs(evt.clientY - state.startY);
    if (dx > DASHBOARD_CLICK_THRESHOLD || dy > DASHBOARD_CLICK_THRESHOLD) {
      state.cancelled = true;
    }
  };
  const onPointerUp = evt => {
    const state = pointerTapState.get(evt.pointerId);
    pointerTapState.delete(evt.pointerId);
    if (!state || state.cancelled) return;
    const resolved = evt.target && evt.target.closest ? evt.target.closest('[data-contact-id],[data-partner-id]') : null;
    handleDashboardTap(evt, resolved || state.dataTarget);
  };
  const onPointerCancel = evt => {
    pointerTapState.delete(evt.pointerId);
  };
  container.addEventListener('pointerdown', onPointerDown);
  container.addEventListener('pointermove', onPointerMove);
  container.addEventListener('pointerup', onPointerUp);
  container.addEventListener('pointercancel', onPointerCancel);
  dashDnDState.pointerHandlers = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };
}

function persistDashboardOrder(orderLike) {
  const normalized = normalizeOrderList(orderLike);
  const signature = normalized.join('|');
  if (signature === dashDnDState.orderSignature) return;
  dashDnDState.orderSignature = signature;
  if (!normalized.length) return;
  if (win && win.Settings && typeof win.Settings.save === 'function') {
    try {
      Promise.resolve(win.Settings.save({ dashboardOrder: normalized })).catch(err => {
        try {
          if (console && console.warn) console.warn('[dashboard] order save failed', err);
        } catch (_warnErr) {}
      });
    } catch (err) {
      try {
        if (console && console.warn) console.warn('[dashboard] order save failed', err);
      } catch (_warnErr) {}
    }
  }
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
        onOrderChange: persistDashboardOrder
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
      const prefs = await getSettingsPrefs();
      applySurfaceVisibility(prefs);
      applyKpiVisibility(prefs.kpis);
    } catch (err) {
      if (console && console.warn) console.warn('[dashboard] apply prefs failed', err);
    }
    ensureWidgetDnD();
  });
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
  doc.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope ? evt.detail.scope : '';
    if (scope === 'settings') invalidatePrefs();
    scheduleApply();
  });
}

init();
