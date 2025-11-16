import { makeDraggableGrid, destroyDraggable, listenerCount, setDebugTodayMode, setDebugSelectedIds, bumpDebugResized } from '../ui/drag_core.js';
import { acquireRouteLifecycleToken } from '../ui/route_lifecycle.js';
import { setDashboardLayoutMode, readStoredLayoutMode, resetLayout } from '../ui/dashboard_layout.js';
import { applyDashboardConfig, getInitialDashboardMode, loadDashboardConfig } from './config.js';
import { openContactModal } from '../contacts.js';
import { openPartnerEditModal } from '../ui/modals/partner_edit/index.js';
import { createLegendPopover, STAGE_LEGEND_ENTRIES } from '../ui/legend_popover.js';
import { attachStatusBanner } from '../ui/status_banners.js';
import { attachLoadingBlock, detachLoadingBlock } from '../ui/loading_block.js';
import dashboardState from '../state/dashboard_state.js';

// Feature flag: Disable edit mode for settings-based auto-layout
const DISABLE_DASHBOARD_EDIT_MODE = true;

const doc = typeof document === 'undefined' ? null : document;
const win = typeof window === 'undefined' ? null : window;
const dashboardStateApi = dashboardState || (win && win.dashboardState) || null;
let releaseDashboardRouteToken = null;

function setDebugWidths(values) {
  if (!win || typeof win !== 'object') return;
  const root = win.__DND_DEBUG__ && typeof win.__DND_DEBUG__ === 'object' ? win.__DND_DEBUG__ : (win.__DND_DEBUG__ = {});
  root.widths = Array.isArray(values) ? values.map(val => (val == null ? '' : String(val))).filter(Boolean) : [];
}

const CELEBRATIONS_WIDGET_KEY = 'upcomingCelebrations';
const CELEBRATIONS_WIDGET_ID = 'dashboard-celebrations';
const CELEBRATIONS_WIDGET_TITLE = 'Upcoming Birthdays & Anniversaries (7 days)';
const CELEBRATIONS_WINDOW_DAYS = 7;

const DASHBOARD_CONTAINER_SELECTOR = 'main[data-ui="dashboard-root"]';
const DASHBOARD_ITEM_SELECTOR = ':scope > [data-dash-widget]';
const DASHBOARD_WIDGET_NODE_SELECTOR = 'section.card, section.grid, div.card, section.status-stack';
const DASHBOARD_ORDER_STORAGE_KEY = 'crm:dashboard:widget-order';
const DASHBOARD_LAYOUT_MODE_STORAGE_KEY = 'dash:layoutMode:v1';
const DASHBOARD_STYLE_ID = 'dashboard-dnd-style';
const DASHBOARD_STYLE_ORIGIN = 'crm:dashboard:dnd';
const DASHBOARD_CLICK_THRESHOLD = 5;
const DASHBOARD_DRILLDOWN_SELECTOR = '[data-contact-id],[data-partner-id],[data-dashboard-route],[data-dash-route],[data-dashboard-href],[data-dash-href]';
const TODAY_MODE_BUTTON_SELECTOR = '[data-dashboard-mode="today"]';
const TODAY_PRIORITIES_CONTAINER_CLASSES = ['query-shell'];
const TODAY_PRIORITIES_HEADING_CLASSES = ['insight-pill', 'core'];
const DASHBOARD_MIN_COLUMNS = 3;
const DASHBOARD_MAX_COLUMNS = 4;

const DASHBOARD_RESIZE_HANDLES = [
  { key: 'e', qa: 'resize-e', label: 'Resize from right edge' },
  { key: 'se', qa: 'resize-se', label: 'Resize from bottom right corner' },
  { key: 'ne', qa: 'resize-ne', label: 'Resize from top right corner' }
];

const DASHBOARD_WIDTH_SEQUENCE = ['third', 'half', 'twoThird', 'full'];
const DASHBOARD_WIDTH_DEBUG_LABELS = { third: '1/3', half: '1/2', twoThird: '2/3', full: '1/1' };

const DASHBOARD_WIDTH_SET = new Set(DASHBOARD_WIDTH_SEQUENCE);
const DASHBOARD_DEFAULT_WIDTH = 'third';
const DASHBOARD_DEFAULT_WIDTHS = {
  today: 'full',
  statusStack: 'full',
  pipeline: 'twoThird',
  goalProgress: 'twoThird',
  numbersMomentum: 'twoThird',
  pipelineCalendar: 'twoThird'
};
const TODAY_WIDGET_KEYS = new Set([
  'focus',
  'today',
  CELEBRATIONS_WIDGET_KEY
]);

const todayHighlightState = {
  modeObserver: null,
  modeButton: null,
  hostObserver: null,
  host: null
};

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

function ensureStyle(originId, cssText, legacyId) {
  if (!doc) return null;
  const head = doc.head || doc.getElementsByTagName('head')[0] || doc.documentElement;
  if (!head || typeof head.appendChild !== 'function') return null;
  const selector = `style[data-origin="${originId}"]`;
  let style = typeof doc.querySelector === 'function' ? doc.querySelector(selector) : null;
  if (!style && legacyId && typeof doc.getElementById === 'function') {
    style = doc.getElementById(legacyId);
  }
  if (style) {
    if (style.getAttribute && style.getAttribute('data-origin') !== originId) {
      try { style.setAttribute('data-origin', originId); }
      catch (_) {}
    }
    if (typeof cssText === 'string' && style.textContent !== cssText) {
      style.textContent = cssText;
    }
    return style;
  }
  style = doc.createElement('style');
  if (legacyId) style.id = legacyId;
  style.setAttribute('data-origin', originId);
  if (typeof cssText === 'string') {
    style.textContent = cssText;
  }
  head.appendChild(style);
  return style;
}

const WIDGET_RESOLVERS = {
  focus: () => doc ? doc.getElementById('dashboard-focus') : null,
  filters: () => doc ? doc.getElementById('dashboard-filters') : null,
  kpis: () => doc ? doc.getElementById('dashboard-kpis') : null,
  pipeline: () => doc ? doc.getElementById('dashboard-pipeline-overview') : null,
  today: () => doc ? doc.getElementById('dashboard-today') : null,
  leaderboard: () => doc ? doc.getElementById('referral-leaderboard') : null,
  stale: () => doc ? doc.getElementById('dashboard-stale') : null,
  favorites: () => doc ? doc.getElementById('favorites-card') : null,
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
  upcomingCelebrations: resolveCelebrationsWidget,
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
  favorites: 'favorites-card',
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
  upcomingCelebrations: CELEBRATIONS_WIDGET_ID,
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
let lastPersistedLayoutColumns = null;
let pendingLayoutPersist = null;

const DASHBOARD_WIDGET_EDITING_CLASS = 'dash-widget-editing';

const dashDnDState = {
  controller: null,
  container: null,
  orderSignature: '',
  pointerHandlers: null,
  active: false,
  columns: DASHBOARD_MIN_COLUMNS,
  pendingColumns: null,
  lastAppliedColumns: null,
  widths: new Map(),
  resizeSession: null,
  hostObserver: null,
  hostObserverTarget: null,
  hostNode: null,
  lastTeardownReason: '',
  editing: false,
  updatingEditing: false
};

function isDashboardEditingEnabled() {
  return !!dashDnDState.editing;
}

function applyRootEditingState(container, enabled) {
  if (!container) return;
  if (enabled) {
    try { container.setAttribute('data-editing', '1'); } catch (_err) {}
  } else {
    if (container.removeAttribute) {
      try { container.removeAttribute('data-editing'); } catch (_err) {}
    }
  }
}

function applyWidgetEditingMarkers(container, enabled) {
  if (!container) return;
  const nodes = collectWidgetNodes(container);
  if (!nodes.length) return;
  nodes.forEach(node => {
    if (!node) return;
    if (node.classList) {
      if (enabled) {
        node.classList.add(DASHBOARD_WIDGET_EDITING_CLASS);
      } else {
        node.classList.remove(DASHBOARD_WIDGET_EDITING_CLASS);
      }
    }
  });
}

const layoutToggleState = {
  button: null,
  viewLabel: null,
  editLabel: null,
  mode: false,
  wired: false,
  storageBound: false,
  bootstrapped: false,
  modeListenerBound: false
};

const layoutResetState = {
  button: null,
  pending: false
};

const pointerTapState = new Map();

function detachLayoutToggleButton(target) {
  if (!target) return;
  try { target.removeEventListener('click', handleLayoutToggleClick); }
  catch (_err) {}
  try { target.removeEventListener('keydown', handleLayoutToggleKeydown); }
  catch (_err) {}
}

function releaseLayoutToggleGlobals() {
  if (layoutToggleState.modeListenerBound && doc && typeof doc.removeEventListener === 'function') {
    try { doc.removeEventListener('dashboard:layout-mode', handleExternalLayoutMode); }
    catch (_err) {}
    layoutToggleState.modeListenerBound = false;
  }
  if (layoutToggleState.storageBound && win && typeof win.removeEventListener === 'function') {
    try { win.removeEventListener('storage', handleLayoutToggleStorage); }
    catch (_err) {}
    layoutToggleState.storageBound = false;
  }
}

function teardownLayoutControls() {
  if (layoutToggleState.button && layoutToggleState.wired) {
    detachLayoutToggleButton(layoutToggleState.button);
  }
  layoutToggleState.button = null;
  layoutToggleState.viewLabel = null;
  layoutToggleState.editLabel = null;
  layoutToggleState.wired = false;
  releaseLayoutToggleGlobals();
}

function findDashboardDrilldownTarget(node) {
  if (!node || typeof node.closest !== 'function') return null;
  const selector = DASHBOARD_DRILLDOWN_SELECTOR;
  const target = node.closest(selector);
  if (target) {
    const data = target.dataset || {};
    if (data.contactId || data.partnerId || resolveDashboardRouteTarget(target)) {
      return target;
    }
  }
  if (node.closest) {
    const anchor = node.closest('a[data-dashboard-link],a[href^="#"],a[href^="/"]');
    if (anchor && resolveDashboardRouteTarget(anchor)) return anchor;
  }
  return null;
}

function resolveDashboardRouteTarget(node) {
  if (!node) return '';
  const dataset = node.dataset || {};
  const routeCandidates = [
    dataset.dashboardRoute,
    dataset.dashRoute,
    dataset.dashboardHref,
    dataset.dashHref,
    dataset.route
  ];
  for (const candidate of routeCandidates) {
    const value = candidate == null ? '' : String(candidate).trim();
    if (value) return value;
  }
  if (node.getAttribute) {
    const direct = node.getAttribute('data-dashboard-route')
      || node.getAttribute('data-dash-route')
      || node.getAttribute('data-dashboard-href')
      || node.getAttribute('data-dash-href');
    if (direct) return String(direct).trim();
    const href = node.getAttribute('href');
    if (href && href !== '#') return String(href).trim();
  }
  return '';
}

function tryNavigateDashboardRoute(route, target) {
  const value = route == null ? '' : String(route).trim();
  if (!value) return false;
  if (win && win.location) {
    try {
      if (value.startsWith('#')) {
        win.location.hash = value;
        return true;
      }
      if (value.startsWith('/')) {
        win.location.hash = `#${value.replace(/^[#/]+/, '')}`;
        return true;
      }
    } catch (_err) {}
  }
  const detail = { view: value, trigger: target || null };
  let dispatched = false;
  if (doc) {
    try {
      doc.dispatchEvent(new CustomEvent('app:navigate', { detail }));
      dispatched = true;
    } catch (_err) {}
  }
  if (win && typeof win.dispatchEvent === 'function') {
    try {
      win.dispatchEvent(new CustomEvent('app:navigate', { detail }));
      dispatched = true;
    } catch (_err) {}
  }
  return dispatched;
}
const DASHBOARD_SKIP_CLICK_KEY = '__dashSkipClickUntil';
const DASHBOARD_HANDLED_CLICK_KEY = '__dashLastHandledAt';
const DASHBOARD_SKIP_CLICK_WINDOW = 350;
const POINTER_HANDLER_KEYS = ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel', 'onKeyDown', 'onClick'];

function countPointerHandlers() {
  const handlers = dashDnDState.pointerHandlers;
  if (!handlers || typeof handlers !== 'object') return 0;
  return POINTER_HANDLER_KEYS.reduce((count, key) => {
    return count + (typeof handlers[key] === 'function' ? 1 : 0);
  }, 0);
}

function exposeDashboardDnDHandlers() {
  if (!win || typeof win !== 'object') return;
  const api = {
    ensure: ensureWidgetDnD,
    teardown: reason => teardownWidgetDnD(reason || 'manual'),
    destroy: reason => teardownWidgetDnD(reason || 'manual'),
    destroyDraggable,
    listenerCount,
    handlerCount: () => countPointerHandlers(),
    cleanupPointerHandlers: () => cleanupPointerHandlersFor(dashDnDState.container),
    observeHost: () => observeDashboardHost(dashDnDState.container),
    get container() {
      return dashDnDState.container;
    },
    get controller() {
      return dashDnDState.controller;
    },
    get pointerHandlers() {
      return dashDnDState.pointerHandlers;
    },
    get active() {
      return !!dashDnDState.active;
    },
    get lastReason() {
      return dashDnDState.lastTeardownReason || '';
    },
    get pointerHandlerCount() {
      return countPointerHandlers();
    },
    state: dashDnDState
  };
  try {
    win.__DASH_DND_HANDLERS__ = api;
  } catch (_err) {}
}

function cleanupPointerHandlersFor(container) {
  const handlers = dashDnDState.pointerHandlers;
  const target = container && typeof container.removeEventListener === 'function'
    ? container
    : (dashDnDState.container && typeof dashDnDState.container.removeEventListener === 'function'
      ? dashDnDState.container
      : null);
  if (target && handlers) {
    try { target.removeEventListener('pointerdown', handlers.onPointerDown); } catch (_err) {}
    try { target.removeEventListener('pointermove', handlers.onPointerMove); } catch (_err) {}
    try { target.removeEventListener('pointerup', handlers.onPointerUp); } catch (_err) {}
    try { target.removeEventListener('pointercancel', handlers.onPointerCancel); } catch (_err) {}
    try { target.removeEventListener('keydown', handlers.onKeyDown); } catch (_err) {}
    try { target.removeEventListener('click', handlers.onClick); } catch (_err) {}
  }
  dashDnDState.pointerHandlers = null;
  pointerTapState.clear();
  exposeDashboardDnDHandlers();
}

function disconnectDashboardHostObserver() {
  if (dashDnDState.hostObserver) {
    try { dashDnDState.hostObserver.disconnect(); } catch (_err) {}
  }
  dashDnDState.hostObserver = null;
  dashDnDState.hostObserverTarget = null;
  dashDnDState.hostNode = null;
}

function observeDashboardHost(container) {
  if (!container) {
    disconnectDashboardHostObserver();
    return;
  }
  if (dashDnDState.hostNode === container && dashDnDState.hostObserver) return;
  const Observer = (win && win.MutationObserver) || (typeof MutationObserver !== 'undefined' ? MutationObserver : null);
  if (typeof Observer !== 'function') return;
  disconnectDashboardHostObserver();
  const observer = new Observer(() => {
    if (dashDnDState.container !== container) return;
    const connected = typeof container.isConnected === 'boolean'
      ? container.isConnected
      : (doc ? doc.contains(container) : true);
    if (!connected) {
      teardownWidgetDnD('host-removed');
    }
  });
  try {
    const parent = container.parentNode;
    if (parent) {
      observer.observe(parent, { childList: true });
    }
    const rootTarget = (doc && doc.body) || (doc && doc.documentElement) || (container.ownerDocument && container.ownerDocument.body) || parent;
    if (rootTarget) {
      observer.observe(rootTarget, { childList: true, subtree: true });
    }
    dashDnDState.hostObserver = observer;
    dashDnDState.hostObserverTarget = parent || rootTarget || null;
    dashDnDState.hostNode = container;
  } catch (_err) {
    try { observer.disconnect(); } catch (_err2) {}
  }
}

function teardownWidgetDnD(reason) {
  const container = dashDnDState.container;
  if (dashDnDState.resizeSession) {
    finishWidgetResize(null, false);
  }
  cleanupPointerHandlersFor(container);
  const controller = dashDnDState.controller;
  if (controller && typeof controller.destroy === 'function') {
    try { controller.destroy(); } catch (_err) {}
  }
  if (container) {
    try { destroyDraggable(container); } catch (_err) {}
  }
  applyWidgetEditingMarkers(container, false);
  applyRootEditingState(container, false);
  dashDnDState.controller = null;
  dashDnDState.container = null;
  dashDnDState.active = false;
  dashDnDState.lastTeardownReason = reason || '';
  disconnectDashboardHostObserver();
  celebrationsState.dndReady = false;
  exposeDashboardDnDHandlers();
  if (reason === 'route-lifecycle' || reason === 'host-removed') {
    teardownLayoutControls();
  }
}

function handleDashboardAppNavigate(evt) {
  const detail = evt && typeof evt === 'object' ? evt.detail : null;
  const nextView = detail && typeof detail.view === 'string' ? detail.view : '';
  if (nextView === 'dashboard') {
    ensureWidgetDnD();
    return;
  }
  teardownLayoutControls();
  if (!dashDnDState.container && !dashDnDState.pointerHandlers && !dashDnDState.controller) return;
  teardownWidgetDnD('app:navigate');
}

exposeDashboardDnDHandlers();

const celebrationsState = {
  node: null,
  list: null,
  statusHost: null,
  statusBanner: null,
  shouldRender: false,
  hydrated: false,
  hydrating: false,
  dirty: true,
  dndReady: false,
  hydrationScheduled: false,
  pendingHydration: false,
  bindingApplied: false,
  dateFormatter: null,
  items: [],
  lastError: null,
  fallback: null
};

const scheduleIdleTask = (typeof win !== 'undefined' && win && typeof win.requestIdleCallback === 'function')
  ? cb => win.requestIdleCallback(cb)
  : cb => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 0);

function resolveLayoutToggleButton() {
  if (!doc) return null;
  const button = doc.querySelector('[data-dashboard-action="layout-toggle"]');
  return button || null;
}

function resolveLayoutResetButton() {
  if (!doc) return null;
  const button = doc.querySelector('[data-dashboard-action="layout-reset"]');
  return button || null;
}

function ensureLayoutResetButton() {
  const button = resolveLayoutResetButton();
  layoutResetState.button = button;
  if (!button) return null;
  if (!button.__wired) {
    button.__wired = true;
    button.addEventListener('click', handleLayoutResetClick);
  }
  if (layoutResetState.pending) {
    button.disabled = true;
    button.dataset.loading = 'true';
  } else {
    button.disabled = false;
    if (button.dataset && Object.prototype.hasOwnProperty.call(button.dataset, 'loading')) {
      delete button.dataset.loading;
    } else {
      button.removeAttribute('data-loading');
    }
  }
  return button;
}

function dispatchLayoutModeEvent(enabled) {
  if (!doc || typeof doc.dispatchEvent !== 'function') return;
  const CustomEventCtor = typeof CustomEvent === 'function'
    ? CustomEvent
    : (win && typeof win.CustomEvent === 'function' ? win.CustomEvent : null);
  if (!CustomEventCtor) return;
  try {
    doc.dispatchEvent(new CustomEventCtor('dashboard:layout-mode', { detail: { enabled: !!enabled, source: 'dashboard-toggle' } }));
  } catch (_err) {}
}

function updateLayoutToggleButton(enabled) {
  const button = layoutToggleState.button || resolveLayoutToggleButton();
  if (!button) return;
  const next = !!enabled;
  button.setAttribute('aria-pressed', next ? 'true' : 'false');
  if (button.classList) {
    if (next) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  }
  const viewLabel = layoutToggleState.viewLabel && layoutToggleState.viewLabel.isConnected
    ? layoutToggleState.viewLabel
    : button.querySelector('[data-mode="view"]');
  const editLabel = layoutToggleState.editLabel && layoutToggleState.editLabel.isConnected
    ? layoutToggleState.editLabel
    : button.querySelector('[data-mode="edit"]');
  if (viewLabel) {
    viewLabel.hidden = next;
    layoutToggleState.viewLabel = viewLabel;
  }
  if (editLabel) {
    editLabel.hidden = !next;
    layoutToggleState.editLabel = editLabel;
  }
  button.dataset.layoutMode = next ? 'edit' : 'view';
}

function updateDashboardEditingState(enabled, options = {}) {
  // Disable edit mode when feature flag is set
  if (DISABLE_DASHBOARD_EDIT_MODE) {
    enabled = false;
  }
  const next = !!enabled;
  dashDnDState.editing = next;
  const wasUpdating = dashDnDState.updatingEditing;
  if (!wasUpdating) {
    dashDnDState.updatingEditing = true;
    try {
      ensureWidgetDnD();
    } finally {
      dashDnDState.updatingEditing = false;
    }
  }
  const container = dashDnDState.container || getDashboardContainerNode();
  if (container) {
    applyRootEditingState(container, next);
    applyWidgetEditingMarkers(container, next);
  }
  const controller = dashDnDState.controller;
  if (controller) {
    if (typeof controller.setEditMode === 'function') {
      controller.setEditMode(next);
    }
    if (next) {
      if (typeof controller.enable === 'function') {
        controller.enable();
      }
    } else if (typeof controller.disable === 'function') {
      controller.disable();
    }
  }
  if (!next) {
    dashDnDState.active = false;
    const shouldPersist = options.persist !== false && options.commit !== false;
    if (shouldPersist) {
      const host = dashDnDState.container || getDashboardContainerNode();
      if (host) {
        persistDashboardOrderImmediate();
        const columns = dashDnDState.columns || getPreferredLayoutColumns();
        persistDashboardLayoutState(columns, { includeWidths: true, force: true });
      }
    }
  }
  exposeDashboardDnDHandlers();
}

function applyLayoutToggleMode(enabled, options = {}) {
  const next = !!enabled;
  layoutToggleState.mode = next;
  updateLayoutToggleButton(next);
  updateDashboardEditingState(next, { commit: options.commit !== false, persist: options.persist !== false });
  if (options.commit !== false) {
    const setOptions = {};
    if (options.persist === false) setOptions.persist = false;
    if (options.force) setOptions.force = true;
    if (options.silent) setOptions.silent = true;
    setDashboardLayoutMode(next, setOptions);
  }
  if (options.dispatch !== false && options.commit !== false) {
    dispatchLayoutModeEvent(next);
  }
}

function handleLayoutToggleClick(evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  applyLayoutToggleMode(!layoutToggleState.mode, { commit: true });
}

async function handleLayoutResetClick(evt) {
  if (evt) {
    evt.preventDefault();
    evt.stopPropagation();
  }
  if (layoutResetState.pending) return;
  layoutResetState.pending = true;
  ensureLayoutResetButton();
  try {
    await resetLayout({ reason: 'toolbar-reset' });
  } catch (err) {
    try {
      if (console && console.warn) console.warn('[dashboard] layout reset failed', err);
    } catch (_warnErr) {}
  } finally {
    layoutResetState.pending = false;
    ensureLayoutResetButton();
    ensureLayoutToggle();
  }
}

function handleLayoutToggleKeydown(evt) {
  if (!evt) return;
  const key = evt.key || evt.code || '';
  if (key !== 'Enter' && key !== ' ' && key !== 'Spacebar') return;
  evt.preventDefault();
  evt.stopPropagation();
  if (evt.repeat) return;
  applyLayoutToggleMode(!layoutToggleState.mode, { commit: true });
}

function handleExternalLayoutMode(evt) {
  if (!evt) return;
  const detail = evt.detail && typeof evt.detail === 'object' ? evt.detail : {};
  if (detail.source === 'dashboard-toggle') return;
  if (!Object.prototype.hasOwnProperty.call(detail, 'enabled')) return;
  applyLayoutToggleMode(!!detail.enabled, { commit: false });
}

function handleLayoutToggleStorage(evt) {
  if (!evt || typeof evt.key !== 'string') return;
  if (evt.key !== DASHBOARD_LAYOUT_MODE_STORAGE_KEY) return;
  applyLayoutToggleMode(!!readStoredLayoutMode(), { commit: false });
}

function ensureLayoutToggle() {
  const button = resolveLayoutToggleButton();
  if (!button) {
    if (layoutToggleState.button && layoutToggleState.wired) {
      detachLayoutToggleButton(layoutToggleState.button);
    }
    layoutToggleState.button = null;
    layoutToggleState.viewLabel = null;
    layoutToggleState.editLabel = null;
    layoutToggleState.wired = false;
    releaseLayoutToggleGlobals();
    return null;
  }
  if (layoutToggleState.button && layoutToggleState.button !== button && layoutToggleState.wired) {
    detachLayoutToggleButton(layoutToggleState.button);
    layoutToggleState.wired = false;
  }
  layoutToggleState.button = button;
  ensureLayoutResetButton();
  if (!layoutToggleState.bootstrapped) {
    applyLayoutToggleMode(!!readStoredLayoutMode(), { commit: true, persist: false, force: true, dispatch: false });
    layoutToggleState.bootstrapped = true;
  } else {
    updateLayoutToggleButton(layoutToggleState.mode);
  }
  if (!layoutToggleState.wired) {
    button.addEventListener('click', handleLayoutToggleClick);
    button.addEventListener('keydown', handleLayoutToggleKeydown);
    layoutToggleState.wired = true;
  }
  if (!layoutToggleState.modeListenerBound && doc) {
    doc.addEventListener('dashboard:layout-mode', handleExternalLayoutMode);
    layoutToggleState.modeListenerBound = true;
  }
  if (!layoutToggleState.storageBound && win && typeof win.addEventListener === 'function') {
    win.addEventListener('storage', handleLayoutToggleStorage);
    layoutToggleState.storageBound = true;
  }
  return button;
}

function resolveCelebrationsWidget() {
  const { node } = celebrationsState;
  if (node && node.isConnected) return node;
  return null;
}

function ensureCelebrationsWidgetShell() {
  if (!doc) return null;
  let { node, list, statusHost } = celebrationsState;
  const container = getDashboardContainerNode();
  if (!container) return (node && node.isConnected) ? node : null;
  const ensureInserted = target => {
    if (!target) return;
    if (target.parentElement === container) return;
    const before = doc.getElementById('dashboard-status-stack');
    if (before && before.parentElement === container) {
      container.insertBefore(target, before);
    } else {
      container.appendChild(target);
    }
  };
  if (!node || !node.isConnected) {
    if (!node) {
      node = doc.createElement('section');
      node.className = 'card insight-card';
      node.id = CELEBRATIONS_WIDGET_ID;
      node.setAttribute('data-widget-label', CELEBRATIONS_WIDGET_TITLE);
      node.dataset.widgetId = CELEBRATIONS_WIDGET_KEY;
      const head = doc.createElement('div');
      head.className = 'insight-head';
      const icon = doc.createElement('div');
      icon.className = 'insight-icon celebrations';
      icon.textContent = '🎉';
      const textWrap = doc.createElement('div');
      const title = doc.createElement('h4');
      title.textContent = CELEBRATIONS_WIDGET_TITLE;
      const subtitle = doc.createElement('p');
      subtitle.className = 'muted';
      subtitle.textContent = 'Celebrate clients before their big day.';
      textWrap.appendChild(title);
      textWrap.appendChild(subtitle);
      head.appendChild(icon);
      head.appendChild(textWrap);
      node.appendChild(head);
      statusHost = doc.createElement('div');
      statusHost.className = 'celebrations-status muted';
      statusHost.dataset.role = 'celebrations-status';
      statusHost.style.display = 'flex';
      statusHost.style.alignItems = 'center';
      statusHost.style.gap = '8px';
      statusHost.style.minHeight = '24px';
      node.appendChild(statusHost);
      list = doc.createElement('ul');
      list.className = 'insight-list spotlight';
      list.id = `${CELEBRATIONS_WIDGET_ID}-list`;
      list.dataset.widget = CELEBRATIONS_WIDGET_KEY;
      node.appendChild(list);
      celebrationsState.node = node;
      celebrationsState.list = list;
      celebrationsState.statusHost = statusHost;
      celebrationsState.statusBanner = attachStatusBanner(statusHost, { tone: 'muted' });
    } else {
      ensureInserted(node);
    }
  }
  if (!list || !list.isConnected) {
    list = node ? node.querySelector('ul.insight-list') : null;
    celebrationsState.list = list;
  }
  if (!statusHost || !statusHost.isConnected) {
    statusHost = node ? node.querySelector('[data-role="celebrations-status"]') : null;
    celebrationsState.statusHost = statusHost;
    celebrationsState.statusBanner = statusHost ? attachStatusBanner(statusHost, { tone: 'muted' }) : null;
  } else if (!celebrationsState.statusBanner) {
    celebrationsState.statusBanner = attachStatusBanner(statusHost, { tone: 'muted' });
  }
  if (node) {
    ensureInserted(node);
    if (!node.dataset.widgetId) node.dataset.widgetId = CELEBRATIONS_WIDGET_KEY;
    if (!node.dataset.dashWidget) node.dataset.dashWidget = CELEBRATIONS_WIDGET_KEY;
  }
  if (celebrationsState.list && !celebrationsState.bindingApplied) {
    celebrationsState.list.addEventListener('click', handleCelebrationsListClick);
    celebrationsState.bindingApplied = true;
  }
  return celebrationsState.node || null;
}

function clearCelebrationsFallback() {
  const { fallback } = celebrationsState;
  if (!fallback) return;
  try {
    if (fallback.parentElement) {
      fallback.parentElement.removeChild(fallback);
    }
  } catch (_err) {
    try { fallback.remove(); }
    catch (_removeErr) {}
  }
  celebrationsState.fallback = null;
}

function createCelebrationsActionButton(label, handler, variant) {
  if (!doc) return null;
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = label || '';
  button.className = 'btn';
  button.style.fontSize = '13px';
  button.style.padding = '6px 12px';
  button.style.lineHeight = '1.2';
  button.style.borderRadius = '8px';
  if (variant === 'primary') {
    button.classList.add('brand');
  } else {
    button.classList.add('subtle');
  }
  if (typeof handler === 'function') {
    button.addEventListener('click', evt => {
      evt.preventDefault();
      handler(evt);
    });
  }
  return button;
}

function navigateToDashboardSettings() {
  if (!win || !win.location) return;
  const hash = '#settings/dashboard';
  try {
    if (win.location.hash !== hash) {
      win.location.hash = hash;
      return;
    }
    if (doc && typeof doc.dispatchEvent === 'function') {
      try {
        doc.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'settings', panel: 'dashboard' } }));
      } catch (_err) {}
    }
  } catch (_err) {}
}

function renderCelebrationsFallback(message, options = {}) {
  const node = ensureCelebrationsWidgetShell();
  if (!node) return;
  const { list, statusBanner } = celebrationsState;
  if (statusBanner && typeof statusBanner.clear === 'function') {
    statusBanner.clear();
  }
  if (list) {
    list.hidden = true;
    if (list.style) list.style.display = 'none';
  }
  clearCelebrationsFallback();
  if (!doc) return;
  const fallback = doc.createElement('div');
  fallback.dataset.role = 'celebrations-fallback';
  fallback.style.display = 'flex';
  fallback.style.flexDirection = 'column';
  fallback.style.gap = '8px';
  fallback.style.padding = '12px';
  fallback.style.marginTop = '8px';
  fallback.style.border = '1px dashed var(--border-subtle, #CBD5F5)';
  fallback.style.borderRadius = '12px';
  fallback.style.background = 'var(--surface-subtle, #f8fafc)';
  const body = doc.createElement('p');
  body.textContent = message || 'We couldn\'t load celebrations.';
  body.className = 'muted';
  body.style.margin = '0';
  fallback.appendChild(body);
  const actions = doc.createElement('div');
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.gap = '8px';
  const { onRetry, onConfigure } = options;
  if (typeof onRetry === 'function') {
    const retryButton = createCelebrationsActionButton('Retry', onRetry, 'primary');
    if (retryButton) actions.appendChild(retryButton);
  }
  const configureHandler = typeof onConfigure === 'function' ? onConfigure : navigateToDashboardSettings;
  if (configureHandler) {
    const configureButton = createCelebrationsActionButton('Configure', configureHandler, 'secondary');
    if (configureButton) actions.appendChild(configureButton);
  }
  if (!actions.childElementCount) {
    const configureButton = createCelebrationsActionButton('Configure', navigateToDashboardSettings, 'secondary');
    if (configureButton) actions.appendChild(configureButton);
  }
  fallback.appendChild(actions);
  node.appendChild(fallback);
  celebrationsState.fallback = fallback;
}

function requestCelebrationsRetry() {
  celebrationsState.lastError = null;
  celebrationsState.dirty = true;
  scheduleCelebrationsHydration();
}

function handleCelebrationsListClick(evt) {
  const target = evt.target && evt.target.closest ? evt.target.closest('li[data-contact-id]') : null;
  if (!target) return;
  evt.preventDefault();
  const contactId = target.getAttribute('data-contact-id') || target.dataset.contactId || '';
  if (!contactId) return;
  tryOpenContact(contactId);
}

function formatCelebrationDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  if (!celebrationsState.dateFormatter) {
    try {
      celebrationsState.dateFormatter = new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        weekday: 'short'
      });
    } catch (_err) {
      celebrationsState.dateFormatter = null;
    }
  }
  if (celebrationsState.dateFormatter) {
    try {
      return celebrationsState.dateFormatter.format(date);
    } catch (_err) {}
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatCelebrationCountdown(days) {
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function renderCelebrationsItems(items) {
  const node = ensureCelebrationsWidgetShell();
  const { list, statusBanner } = celebrationsState;
  celebrationsState.items = Array.isArray(items) ? items.slice() : [];
  clearCelebrationsFallback();
  if (!node || !list) return;
  while (list.firstChild) {
    list.removeChild(list.firstChild);
  }
  if (!items || !items.length) {
    if (list.style) list.style.display = 'none';
    list.hidden = true;
    if (statusBanner) {
      statusBanner.showEmpty('No upcoming celebrations in the next 7 days.');
    }
    return;
  }
  if (list.style) list.style.display = '';
  list.hidden = false;
  if (statusBanner) {
    statusBanner.clear();
  }
  const frag = doc.createDocumentFragment();
  items.forEach(item => {
    const li = doc.createElement('li');
    li.dataset.widget = CELEBRATIONS_WIDGET_KEY;
    if (item.contactId) {
      li.dataset.id = item.contactId;
      li.dataset.contactId = item.contactId;
      li.setAttribute('data-contact-id', item.contactId);
    }
    const main = doc.createElement('div');
    main.className = 'list-main';
    const avatar = doc.createElement('span');
    avatar.className = 'insight-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = item.icon || '🎉';
    const textWrap = doc.createElement('div');
    const title = doc.createElement('div');
    title.className = 'insight-title';
    title.textContent = item.name || 'Contact';
    const subtitle = doc.createElement('div');
    subtitle.className = 'insight-sub';
    const dateLabel = formatCelebrationDate(item.date);
    subtitle.textContent = item.label && dateLabel ? `${item.label} • ${dateLabel}` : (item.label || dateLabel || '');
    textWrap.appendChild(title);
    textWrap.appendChild(subtitle);
    main.appendChild(avatar);
    main.appendChild(textWrap);
    li.appendChild(main);
    const meta = doc.createElement('div');
    meta.className = 'insight-meta';
    meta.textContent = formatCelebrationCountdown(item.daysUntil || 0);
    li.appendChild(meta);
    frag.appendChild(li);
  });
  list.appendChild(frag);
}

function getFieldValue(source, pathList) {
  if (!source || typeof source !== 'object') return null;
  for (let i = 0; i < pathList.length; i += 1) {
    const parts = String(pathList[i] || '').split('.');
    let cur = source;
    let found = true;
    for (let j = 0; j < parts.length; j += 1) {
      const key = parts[j];
      if (!key) continue;
      if (!cur || typeof cur !== 'object' || !(key in cur)) {
        found = false;
        break;
      }
      cur = cur[key];
    }
    if (!found) continue;
    if (cur != null && cur !== '') return cur;
  }
  return null;
}

function parseMonthDay(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { month: value.getMonth() + 1, day: value.getDate() };
  }
  const str = String(value).trim();
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const month = Number.parseInt(iso[2], 10);
    const day = Number.parseInt(iso[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  const dash = str.match(/^(\d{1,2})-(\d{1,2})$/);
  if (dash) {
    const month = Number.parseInt(dash[1], 10);
    const day = Number.parseInt(dash[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slash) {
    const month = Number.parseInt(slash[1], 10);
    const day = Number.parseInt(slash[2], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { month, day };
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return { month: parsed.getMonth() + 1, day: parsed.getDate() };
  }
  return null;
}

function nextOccurrence(md, baseDate) {
  if (!md) return null;
  const year = baseDate.getFullYear();
  let next = new Date(year, md.month - 1, md.day);
  const base = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  if (next < base) {
    next = new Date(year + 1, md.month - 1, md.day);
  }
  return next;
}

function daysBetween(baseDate, futureDate) {
  const baseUtc = Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const futureUtc = Date.UTC(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate());
  return Math.round((futureUtc - baseUtc) / 86400000);
}

function formatContactName(contact) {
  if (!contact || typeof contact !== 'object') return 'Contact';
  const preferred = contact.preferredName || contact.nickname;
  const first = contact.first;
  const last = contact.last;
  let name = '';
  if (preferred) {
    name = `${preferred}${last ? ` ${last}` : ''}`.trim();
  }
  if (!name) {
    const parts = [];
    if (first) parts.push(first);
    if (last) parts.push(last);
    name = parts.join(' ').trim();
  }
  if (!name) {
    const company = contact.company || contact.organization || contact.businessName;
    if (company) name = String(company).trim();
  }
  if (!name && contact.email) {
    name = String(contact.email).trim();
  }
  if (!name && contact.phone) {
    name = String(contact.phone).trim();
  }
  if (!name && contact.id != null) {
    name = `Contact ${contact.id}`;
  }
  return name || 'Contact';
}

function appendCelebrationsForContact(items, contact, baseDate) {
  if (!contact || typeof contact !== 'object') return;
  const contactId = contact.id == null ? '' : String(contact.id).trim();
  if (!contactId) return;
  const name = formatContactName(contact);
  const birthday = getFieldValue(contact, ['birthday', 'extras.birthday']);
  const anniversary = getFieldValue(contact, ['anniversary', 'extras.anniversary']);
  const events = [];
  if (birthday) events.push({ raw: birthday, type: 'birthday', label: 'Birthday', icon: '🎂' });
  if (anniversary) events.push({ raw: anniversary, type: 'anniversary', label: 'Anniversary', icon: '💍' });
  events.forEach(event => {
    const md = parseMonthDay(event.raw);
    if (!md) return;
    const next = nextOccurrence(md, baseDate);
    if (!next) return;
    const days = daysBetween(baseDate, next);
    if (days < 0 || days > CELEBRATIONS_WINDOW_DAYS) return;
    items.push({
      contactId,
      name,
      type: event.type,
      label: event.label,
      icon: event.icon,
      date: next,
      daysUntil: days,
      sortName: name.toLowerCase()
    });
  });
}

function computeCelebrationItems(contacts, baseDate) {
  return new Promise(resolve => {
    if (!Array.isArray(contacts) || !contacts.length) {
      resolve([]);
      return;
    }
    const items = [];
    const total = contacts.length;
    let index = 0;
    const step = deadline => {
      const start = Date.now();
      while (index < total) {
        appendCelebrationsForContact(items, contacts[index], baseDate);
        index += 1;
        if (deadline && typeof deadline.timeRemaining === 'function') {
          if (deadline.timeRemaining() <= 0) break;
        } else if (Date.now() - start >= 8) {
          break;
        }
      }
      if (index < total) {
        scheduleIdleTask(step);
        return;
      }
      items.sort((a, b) => {
        const timeDiff = a.date.getTime() - b.date.getTime();
        if (timeDiff !== 0) return timeDiff;
        if (a.sortName && b.sortName) {
          const nameDiff = a.sortName.localeCompare(b.sortName);
          if (nameDiff !== 0) return nameDiff;
        }
        return a.type.localeCompare(b.type);
      });
      resolve(items);
    };
    scheduleIdleTask(step);
  });
}

function scheduleCelebrationsHydration() {
  if (!celebrationsState.shouldRender) return;
  const node = ensureCelebrationsWidgetShell();
  if (!node) return;
  if (!celebrationsState.dndReady) {
    celebrationsState.pendingHydration = true;
    return;
  }
  if (!celebrationsState.dirty && celebrationsState.hydrated) return;
  if (celebrationsState.hydrating) {
    celebrationsState.pendingHydration = true;
    return;
  }
  if (celebrationsState.hydrationScheduled) return;
  celebrationsState.hydrationScheduled = true;
  Promise.resolve().then(() => {
    celebrationsState.hydrationScheduled = false;
    runCelebrationsHydration();
  });
}

async function runCelebrationsHydration() {
  if (!celebrationsState.shouldRender) return;
  if (!celebrationsState.dndReady) {
    celebrationsState.pendingHydration = true;
    return;
  }
  const node = ensureCelebrationsWidgetShell();
  const { list, statusBanner } = celebrationsState;
  if (!node || !list) return;
  celebrationsState.hydrating = true;
  celebrationsState.pendingHydration = false;
  let releaseLoadingBlock = null;
  if (node) {
    try {
      attachLoadingBlock(node, { lines: 4, reserve: 'widget', minHeight: 220, message: 'Loading…', size: 'sm' });
      releaseLoadingBlock = () => {
        try { detachLoadingBlock(node); }
        catch (_err) {}
      };
    } catch (_err) {
      releaseLoadingBlock = null;
    }
  }
  if (statusBanner) {
    statusBanner.showLoading('Loading…');
  }
  let contacts = [];
  try {
    if (win && typeof win.dbGetAll === 'function') {
      try {
        contacts = await win.dbGetAll('contacts');
      } catch (err) {
        contacts = [];
        celebrationsState.hydrating = false;
        celebrationsState.hydrated = false;
        celebrationsState.lastError = err;
        if (statusBanner) {
          statusBanner.showError('We couldn’t load celebrations. Please try again.', {
            onRetry: () => {
              celebrationsState.lastError = null;
              celebrationsState.dirty = true;
              scheduleCelebrationsHydration();
            }
          });
        }
        renderCelebrationsFallback('We couldn’t load celebrations. Please try again.', {
          onRetry: requestCelebrationsRetry
        });
        return;
      }
    } else if (typeof window !== 'undefined' && typeof window.dbGetAll === 'function') {
      try {
        contacts = await window.dbGetAll('contacts');
      } catch (err) {
        contacts = [];
        celebrationsState.hydrating = false;
        celebrationsState.hydrated = false;
        celebrationsState.lastError = err;
        if (statusBanner) {
          statusBanner.showError('We couldn’t load celebrations. Please try again.', {
            onRetry: () => {
              celebrationsState.lastError = null;
              celebrationsState.dirty = true;
              scheduleCelebrationsHydration();
            }
          });
        }
        renderCelebrationsFallback('We couldn’t load celebrations. Please try again.', {
          onRetry: requestCelebrationsRetry
        });
        return;
      }
    }
    const today = new Date();
    const baseDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    let items = [];
    try {
      items = await computeCelebrationItems(contacts, baseDate);
    } catch (err) {
      celebrationsState.hydrating = false;
      celebrationsState.hydrated = false;
      celebrationsState.lastError = err;
      if (statusBanner) {
        statusBanner.showError('We couldn’t process celebrations. Please try again.', {
          onRetry: () => {
            celebrationsState.lastError = null;
            celebrationsState.dirty = true;
            scheduleCelebrationsHydration();
          }
        });
      }
      renderCelebrationsFallback('We couldn’t process celebrations. Please try again.', {
        onRetry: requestCelebrationsRetry
      });
      return;
    }
    if (!celebrationsState.shouldRender) {
      celebrationsState.hydrating = false;
      celebrationsState.items = items;
      return;
    }
    celebrationsState.hydrating = false;
    celebrationsState.hydrated = true;
    celebrationsState.dirty = false;
    celebrationsState.lastError = null;
    renderCelebrationsItems(items);
    if (celebrationsState.pendingHydration || celebrationsState.dirty) {
      celebrationsState.pendingHydration = false;
      scheduleCelebrationsHydration();
    }
  } finally {
    if (releaseLoadingBlock) {
      releaseLoadingBlock();
    }
  }
}

function markCelebrationsDirty() {
  celebrationsState.dirty = true;
  celebrationsState.hydrated = false;
  if (celebrationsState.shouldRender && celebrationsState.dndReady) {
    scheduleCelebrationsHydration();
  }
}

function maybeHydrateCelebrations(prefs) {
  const widgetPrefs = prefs && typeof prefs.widgets === 'object' ? prefs.widgets : {};
  const mode = prefs && prefs.mode === 'all' ? 'all' : 'today';
  const forceTodayMode = mode === 'today';
  const enabled = forceTodayMode ? true : widgetPrefs[CELEBRATIONS_WIDGET_KEY] !== false;
  const previouslyEnabled = celebrationsState.shouldRender;
  celebrationsState.shouldRender = enabled;
  if (!enabled) {
    clearCelebrationsFallback();
    return;
  }
  ensureCelebrationsWidgetShell();
  if (!previouslyEnabled) {
    celebrationsState.dirty = true;
    celebrationsState.hydrated = false;
  }
  if (celebrationsState.dirty || !celebrationsState.hydrated) {
    scheduleCelebrationsHydration();
  }
}

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
  ensureStyle(DASHBOARD_STYLE_ORIGIN, `
[data-ui="dashboard-root"] > [data-dash-widget] {
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
  display: none;
  align-items: center;
  justify-content: center;
  color: rgba(51, 65, 85, 0.88);
  font-size: 18px;
  line-height: 1;
  cursor: grab;
  z-index: 3;
  pointer-events: none;
  opacity: 0;
  transition: transform 0.18s ease, opacity 0.18s ease;
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

[data-dash-layout-mode="on"] .dash-drag-handle,
main[data-ui="dashboard-root"][data-editing="1"] .dash-drag-handle,
.dash-widget-editing > .dash-drag-handle {
  display: inline-flex;
  pointer-events: auto;
  opacity: 1;
}

.dash-dragging .dash-drag-handle {
  cursor: grabbing;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.2);
}

.dash-drag-placeholder {
  border: 2px dashed rgba(148, 163, 184, 0.5);
  border-radius: 18px;
  background-color: rgba(148, 163, 184, 0.1);
  transition: opacity 0.18s ease, transform 0.2s ease;
}

.dash-dragging .dash-drag-placeholder {
  opacity: 0.85;
  transform: scale(0.995);
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

.dash-drag-ghost {
  opacity: 0.45 !important;
  transform: translateZ(0) scale(0.96);
  border-radius: 18px;
  pointer-events: none !important;
  backdrop-filter: blur(2px);
}

.dash-drag-ghost::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: rgba(15, 23, 42, 0.12);
  pointer-events: none;
}

.dash-resize-handle {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: none;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 6px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  background: rgba(248, 250, 252, 0.92);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  z-index: 3;
}

[data-dash-layout-mode="on"] [data-dash-widget]:hover > .dash-resize-handle,
[data-dash-layout-mode="on"] .dash-resize-handle:focus-within,
main[data-ui="dashboard-root"][data-editing="1"] [data-dash-widget]:hover > .dash-resize-handle,
main[data-ui="dashboard-root"][data-editing="1"] .dash-resize-handle:focus-within,
.dash-widget-editing:hover > .dash-resize-handle,
.dash-widget-editing > .dash-resize-handle:focus-within {
  opacity: 1;
}

.dash-gridlines.dragging {
  display: block;
}

main[data-ui="dashboard-root"].dash-gridlines-visible {
  position: relative;
}

main[data-ui="dashboard-root"].dash-gridlines-visible > .dash-gridlines {
  display: block;
}

.dash-drag-placeholder.dragging,
.dash-resize-preview.dragging {
  opacity: 0.85;
}

[data-dash-layout-mode="on"] .dash-resize-handle,
main[data-ui="dashboard-root"][data-editing="1"] .dash-resize-handle,
.dash-widget-editing > .dash-resize-handle {
  inset: 0;
  right: auto;
  bottom: auto;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
  opacity: 0.35;
  display: block;
  pointer-events: none;
}

.dash-resize-handle .dash-resize-grip {
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.55);
  background: rgba(255, 255, 255, 0.96);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(30, 41, 59, 0.82);
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.18s ease;
}

.dash-resize-handle .dash-resize-grip:focus-visible {
  outline: 2px solid var(--focus-ring, #2563eb);
  outline-offset: 2px;
}

.dash-resize-handle .dash-resize-grip::after {
  content: '';
  width: 8px;
  height: 8px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  opacity: 0.7;
}

.dash-resize-handle [data-qa="resize-e"] {
  top: 50%;
  right: -9px;
  margin-top: -9px;
  cursor: ew-resize;
}

.dash-resize-handle [data-qa="resize-ne"] {
  top: -9px;
  right: -9px;
  cursor: nesw-resize;
}

.dash-resize-handle [data-qa="resize-se"] {
  bottom: -9px;
  right: -9px;
  cursor: nwse-resize;
}

.dash-resize-preview {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 18px;
  border: 2px dashed rgba(148, 163, 184, 0.45);
  background-color: rgba(148, 163, 184, 0.12);
  pointer-events: none;
  opacity: 0;
  z-index: 3;
  transition: opacity 0.18s ease;
}

.dash-resize-feedback {
  position: absolute;
  right: 10px;
  bottom: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: #fff;
  background: rgba(15, 23, 42, 0.78);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.3);
  pointer-events: none;
  opacity: 0;
  transform: translate3d(0, 6px, 0);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.dash-resize-preview.dragging .dash-resize-feedback {
  opacity: 1;
  transform: translate3d(0, 0, 0);
}
`, DASHBOARD_STYLE_ID);
}

function applyDashboardLayoutClasses(container) {
  if (!container || !container.classList) return;
  const { classList } = container;
  if (!classList || typeof classList.contains !== 'function') return;
  if (classList.contains('dash-grid-host') && typeof classList.remove === 'function') {
    classList.remove('dash-grid-host');
  }
  if (!classList.contains('grid') && typeof classList.add === 'function') {
    classList.add('grid');
  }
  if (!classList.contains('insights-grid') && typeof classList.add === 'function') {
    classList.add('insights-grid');
  }
  const header = container.querySelector('#dashboard-header');
  if (header && header.classList && !header.classList.contains('span-full')) {
    header.classList.add('span-full');
  }
}

function resolveGridGap(container) {
  if (!container) return 12;
  try {
    const win = container.ownerDocument ? container.ownerDocument.defaultView : null;
    const styles = win && typeof win.getComputedStyle === 'function' ? win.getComputedStyle(container) : null;
    if (styles) {
      const gap = styles.gap || styles.gridGap || '';
      if (typeof gap === 'string' && gap.trim()) {
        const first = gap.trim().split(/\s+/)[0];
        const parsed = parseFloat(first);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
  } catch (_err) {}
  return 12;
}

function normalizeColumnCount(value) {
  const result = { value: DASHBOARD_MIN_COLUMNS, coerced: true };
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    const rounded = Math.round(numeric);
    const clamped = Math.min(DASHBOARD_MAX_COLUMNS, Math.max(DASHBOARD_MIN_COLUMNS, rounded));
    result.value = clamped;
    result.coerced = clamped !== rounded;
    return result;
  }
  return result;
}

function normalizeWidthToken(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (DASHBOARD_WIDTH_SET.has(raw)) return raw;
  const lower = raw.toLowerCase();
  if (DASHBOARD_WIDTH_SET.has(lower)) return lower;
  return '';
}

function normalizeWidthMap(source) {
  const map = {};
  if (!source || typeof source !== 'object') return map;
  Object.keys(source).forEach(key => {
    const normalizedKey = key == null ? '' : String(key).trim();
    if (!normalizedKey) return;
    const normalizedValue = normalizeWidthToken(source[key]);
    if (!normalizedValue) return;
    map[normalizedKey] = normalizedValue;
  });
  return map;
}

function spanForWidthToken(token, columns) {
  const cols = Math.max(1, Number(columns) || DASHBOARD_MIN_COLUMNS);
  const normalized = normalizeWidthToken(token) || DASHBOARD_DEFAULT_WIDTH;
  let span = 1;
  switch (normalized) {
    case 'full':
      span = cols;
      break;
    case 'twoThird':
      span = Math.max(1, Math.round((cols * 2) / 3));
      break;
    case 'half':
      span = Math.max(1, Math.round(cols / 2));
      break;
    case 'third':
    default:
      span = Math.max(1, Math.round(cols / 3));
      break;
  }
  if (span > cols) span = cols;
  if (span < 1) span = 1;
  return span;
}

function inferDefaultWidth(key, node) {
  const normalizedKey = key ? String(key).trim() : '';
  if (normalizedKey && Object.prototype.hasOwnProperty.call(DASHBOARD_DEFAULT_WIDTHS, normalizedKey)) {
    return DASHBOARD_DEFAULT_WIDTHS[normalizedKey];
  }
  if (node && node.classList) {
    if (node.classList.contains('status-stack')) return 'full';
    if (node.classList.contains('span-2')) return 'twoThird';
  }
  const id = node && node.id ? String(node.id).trim() : '';
  if (id === 'dashboard-today') return 'full';
  if (id === 'dashboard-status-stack') return 'full';
  return DASHBOARD_DEFAULT_WIDTH;
}

function getWidthPrefsMap() {
  if (!prefCache.value) {
    prefCache.value = defaultPrefs();
  }
  if (!prefCache.value.layout || typeof prefCache.value.layout !== 'object') {
    prefCache.value.layout = { columns: DASHBOARD_MIN_COLUMNS, widths: {} };
  }
  const widths = prefCache.value.layout.widths;
  if (!widths || typeof widths !== 'object') {
    prefCache.value.layout.widths = {};
    return prefCache.value.layout.widths;
  }
  return widths;
}

function resolveWidgetWidth(key, node) {
  const map = getWidthPrefsMap();
  const normalizedKey = key ? String(key).trim() : '';
  if (normalizedKey && Object.prototype.hasOwnProperty.call(map, normalizedKey)) {
    const stored = normalizeWidthToken(map[normalizedKey]);
    if (stored) {
      dashDnDState.widths.set(normalizedKey, stored);
      return stored;
    }
  }
  if (normalizedKey && dashDnDState.widths.has(normalizedKey)) {
    return dashDnDState.widths.get(normalizedKey);
  }
  const fallback = inferDefaultWidth(normalizedKey, node);
  if (normalizedKey) {
    dashDnDState.widths.set(normalizedKey, fallback);
  }
  return fallback;
}

function setNodeWidthStyle(node, widthKey, columns) {
  if (!node) return;
  const token = normalizeWidthToken(widthKey) || inferDefaultWidth(node && node.dataset ? node.dataset.dashWidget : '', node);
  const span = spanForWidthToken(token, columns);
  if (node.style) {
    node.style.gridColumn = span ? `span ${span}` : '';
  }
  if (node.dataset) {
    node.dataset.dashWidth = token;
  }
  const key = node && node.dataset ? (node.dataset.dashWidget || node.dataset.widgetId || '') : '';
  if (key) {
    dashDnDState.widths.set(key, token);
  }
}

function ensureWidgetResizeControl(node) {
  // Skip resize handles when edit mode is disabled
  if (DISABLE_DASHBOARD_EDIT_MODE) {
    const existingHandle = node?.querySelector(':scope > .dash-resize-handle');
    if (existingHandle) {
      existingHandle.remove();
    }
    return null;
  }
  if (!doc || !node) return null;
  let handle = node.querySelector(':scope > .dash-resize-handle');
  if (!handle || !handle.querySelector('.dash-resize-grip')) {
    if (handle) handle.remove();
    handle = doc.createElement('div');
    handle.className = 'dash-resize-handle';
    handle.setAttribute('aria-label', 'Resize widget width');
    node.appendChild(handle);
  }
  DASHBOARD_RESIZE_HANDLES.forEach(config => {
    let grip = handle.querySelector(`[data-qa="${config.qa}"]`);
    if (!grip) {
      grip = doc.createElement('button');
      grip.type = 'button';
      grip.className = 'dash-resize-grip';
      grip.setAttribute('data-qa', config.qa);
      grip.setAttribute('aria-label', config.label);
      grip.addEventListener('pointerdown', evt => beginWidgetResize(node, evt));
      grip.addEventListener('click', evt => { evt.preventDefault(); evt.stopPropagation(); });
      handle.appendChild(grip);
    }
  });
  return handle;
}

function applyWidgetWidths(container) {
  const host = container || dashDnDState.container || getDashboardContainerNode();
  if (!host) return;
  const columns = dashDnDState.lastAppliedColumns || dashDnDState.columns || getPreferredLayoutColumns();
  const nodes = collectWidgetNodes(host);
  nodes.forEach(node => {
    if (!node) return;
    ensureWidgetResizeControl(node);
    const dataset = node.dataset || {};
    const key = dataset.dashWidget || dataset.widgetId || node.id || '';
    const widthKey = resolveWidgetWidth(key, node);
    setNodeWidthStyle(node, widthKey, columns);
  });
  snapshotLayoutWidths(host);
}

function setWidgetWidth(node, widthKey, options = {}) {
  if (!node) return;
  const dataset = node.dataset || {};
  const widgetKey = dataset.dashWidget || dataset.widgetId || dataset.widget || dataset.widgetKey || node.id || '';
  const normalizedKey = widgetKey ? String(widgetKey).trim() : '';
  const normalizedWidth = normalizeWidthToken(widthKey) || inferDefaultWidth(normalizedKey, node);
  const columns = dashDnDState.lastAppliedColumns || dashDnDState.columns || getPreferredLayoutColumns();
  setNodeWidthStyle(node, normalizedWidth, columns);
  if (normalizedKey) {
    const map = getWidthPrefsMap();
    if (map[normalizedKey] !== normalizedWidth) {
      map[normalizedKey] = normalizedWidth;
      if (options.persist) {
        bumpDebugResized();
        persistDashboardLayoutState(columns, { force: true, includeWidths: true, widths: map });
      }
    }
  }
  snapshotLayoutWidths();
}

function widthPixelsForToken(token, columns, colWidth, gap) {
  const span = spanForWidthToken(token, columns);
  return (colWidth * span) + (gap * Math.max(0, span - 1));
}

function updateResizeFeedback(session, token) {
  if (!session || !session.feedback) return;
  const activeToken = token || session.pendingToken || session.startToken;
  const span = spanForWidthToken(activeToken, session.columns || DASHBOARD_MIN_COLUMNS);
  const label = span === 1 ? '1 col' : `${span} cols`;
  session.feedback.textContent = label;
}

function snapshotLayoutWidths(host) {
  const container = host || dashDnDState.container || getDashboardContainerNode();
  if (!container) { setDebugWidths([]); return; }
  const widths = collectWidgetNodes(container).filter(node => node && (!node.getAttribute || node.getAttribute('aria-hidden') !== 'true') && !(node.style && node.style.display === 'none') && (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || window.getComputedStyle(node).display !== 'none')).map(node => {
      const dataset = node.dataset || {}, key = dataset.dashWidget || dataset.widgetId || node.id || '';
      const token = normalizeWidthToken(dataset.dashWidth) || (key && dashDnDState.widths.get(key)) || inferDefaultWidth(key, node);
      const normalized = normalizeWidthToken(token) || DASHBOARD_DEFAULT_WIDTH;
      return DASHBOARD_WIDTH_DEBUG_LABELS[normalized] || normalized;
    });
  setDebugWidths(widths);
}

function handleWidgetResizeMove(evt) {
  const session = dashDnDState.resizeSession;
  if (!session) return;
  if (session.pointerId != null && evt.pointerId != null && evt.pointerId !== session.pointerId) return;
  evt.preventDefault();
  const width = Math.min(Math.max(session.minWidth, session.startWidth + (evt.clientX - session.startX)), session.maxWidth);
  const snap = DASHBOARD_WIDTH_SEQUENCE.reduce((acc, option) => {
    const candidate = widthPixelsForToken(option, session.columns, session.colWidth, session.gap);
    const delta = Math.abs(candidate - width);
    return delta < acc.delta ? { token: option, width: candidate, delta } : acc;
  }, { token: session.startToken || DASHBOARD_DEFAULT_WIDTH, width, delta: Number.POSITIVE_INFINITY });
  session.pendingToken = snap.token;
  if (session.placeholder) session.placeholder.style.width = `${Math.max(1, Math.round(snap.width))}px`;
  updateResizeFeedback(session, snap.token);
}

function onResizePointerMove(evt) { handleWidgetResizeMove(evt); }
function onResizePointerUp(evt) { finishWidgetResize(evt, true); }
function onResizePointerCancel(evt) { finishWidgetResize(evt, false); }

function finishWidgetResize(evt, commit) {
  const session = dashDnDState.resizeSession;
  if (!session) return;
  if (evt && session.pointerId != null && evt.pointerId != null && evt.pointerId !== session.pointerId && evt.type !== 'pointercancel') {
    return;
  }
  if (evt && evt.preventDefault) evt.preventDefault();
  if (evt && evt.stopPropagation) evt.stopPropagation();
  const docTarget = session.node ? (session.node.ownerDocument || doc) : doc;
  if (docTarget) {
    docTarget.removeEventListener('pointermove', onResizePointerMove);
    docTarget.removeEventListener('pointerup', onResizePointerUp);
    docTarget.removeEventListener('pointercancel', onResizePointerCancel);
  }
  try {
    if (session.node && session.node.releasePointerCapture && session.pointerId != null) session.node.releasePointerCapture(session.pointerId);
  } catch (_err) {}
  const placeholder = session.placeholder;
  if (placeholder) {
    placeholder.classList.remove('dragging');
    if (placeholder.parentElement) try { placeholder.remove(); } catch (_err) {}
  }
  session.container.classList.remove('dash-resizing', 'dragging');
  session.node.classList.remove('dash-resize-active');
  session.feedback = null;
  dashDnDState.resizeSession = null;
  if (commit && session.node && session.pendingToken) {
    setWidgetWidth(session.node, session.pendingToken, { persist: true });
  } else {
    snapshotLayoutWidths();
  }
}

function beginWidgetResize(node, evt) {
  if (!node || !evt) return;
  if (evt.pointerType !== 'touch' && evt.pointerType !== 'pen') {
    if (evt.button != null && evt.button !== 0) return;
  }
  if (!isDashboardEditingEnabled()) return;
  const container = dashDnDState.container || getDashboardContainerNode();
  if (!container) return;
  if (dashDnDState.resizeSession) finishWidgetResize(null, false);
  evt.preventDefault(); evt.stopPropagation();
  const nodeRect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
  const containerRect = container.getBoundingClientRect ? container.getBoundingClientRect() : null;
  if (!nodeRect || !containerRect) return;
  const columns = dashDnDState.lastAppliedColumns || dashDnDState.columns || getPreferredLayoutColumns();
  const gap = resolveGridGap(container);
  const availableWidth = Math.max(1, containerRect.width - gap * Math.max(0, columns - 1));
  const colWidth = availableWidth / Math.max(1, columns || 1);
  const dataset = node.dataset || {};
  const key = dataset.dashWidget || dataset.widgetId || node.id || '';
  const startToken = normalizeWidthToken(dataset.dashWidth || (key && dashDnDState.widths.get(key))) || inferDefaultWidth(key, node);
  if (!doc) return;
  const placeholder = doc.createElement('div');
  placeholder.className = 'dash-resize-preview';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.setAttribute('data-qa', 'dnd-placeholder');
  placeholder.style.pointerEvents = 'none';
  const feedback = doc.createElement('div');
  feedback.className = 'dash-resize-feedback';
  feedback.setAttribute('aria-hidden', 'true');
  placeholder.appendChild(feedback);
  container.appendChild(placeholder);
  const style = placeholder.style;
  style.left = `${nodeRect.left - containerRect.left}px`; style.top = `${nodeRect.top - containerRect.top}px`;
  style.width = `${Math.max(1, Math.round(nodeRect.width))}px`; style.height = `${Math.max(1, Math.round(nodeRect.height))}px`;
  placeholder.classList.add('dragging');
  container.classList.add('dash-resizing', 'dragging');
  node.classList.add('dash-resize-active');
  const session = {
    node,
    container,
    pointerId: evt.pointerId,
    startX: evt.clientX,
    startWidth: nodeRect.width,
    columns,
    gap,
    colWidth,
    minWidth: widthPixelsForToken(DASHBOARD_WIDTH_SEQUENCE[0], columns, colWidth, gap),
    maxWidth: widthPixelsForToken(DASHBOARD_WIDTH_SEQUENCE[DASHBOARD_WIDTH_SEQUENCE.length - 1], columns, colWidth, gap),
    startToken,
    pendingToken: startToken,
    placeholder,
    feedback
  };
  dashDnDState.resizeSession = session;
  updateResizeFeedback(session, startToken);
  const docTarget = node.ownerDocument || doc;
  if (docTarget) {
    docTarget.addEventListener('pointermove', onResizePointerMove);
    docTarget.addEventListener('pointerup', onResizePointerUp);
    docTarget.addEventListener('pointercancel', onResizePointerCancel);
  }
  try {
    if (node.setPointerCapture && evt.pointerId != null) node.setPointerCapture(evt.pointerId);
  } catch (_err) {}
  handleWidgetResizeMove(evt);
}

function persistDashboardLayoutState(columns, options = {}) {
  const normalized = normalizeColumnCount(columns);
  const value = normalized.value;
  const force = !!options.force;
  const widthSource = options.widths || getWidthPrefsMap();
  const widthMap = normalizeWidthMap(widthSource);
  const includeWidths = options.includeWidths || Object.keys(widthMap).length > 0;
  if (!force && !includeWidths && lastPersistedLayoutColumns === value && !normalized.coerced) return;
  lastPersistedLayoutColumns = value;
  if (!win || !win.Settings || typeof win.Settings.save !== 'function') return;
  const layoutPayload = { columns: value };
  if (includeWidths) {
    layoutPayload.widths = widthMap;
  }
  const payload = { dashboard: { layout: layoutPayload } };
  const promise = Promise.resolve(win.Settings.save(payload))
    .catch(err => {
      try {
        if (console && console.warn) console.warn('[dashboard] layout save failed', err);
      } catch (_warnErr) {}
    })
    .finally(() => {
      if (pendingLayoutPersist === promise) pendingLayoutPersist = null;
    });
  pendingLayoutPersist = promise;
}

function persistDashboardLayoutColumns(columns, options = {}) {
  persistDashboardLayoutState(columns, options);
}

function applyLayoutColumns(columns) {
  const normalized = normalizeColumnCount(columns);
  const value = normalized.value;
  dashDnDState.columns = value;
  if (prefCache.value && prefCache.value.layout && typeof prefCache.value.layout === 'object') {
    prefCache.value.layout.columns = value;
  }
  const container = dashDnDState.container || getDashboardContainerNode();
  if (!container) {
    dashDnDState.pendingColumns = value;
    return;
  }
  dashDnDState.pendingColumns = null;
  dashDnDState.lastAppliedColumns = value;
  if (container.dataset) {
    container.dataset.dashColumns = String(value);
  }
  if (container.style) {
    container.style.gridTemplateColumns = `repeat(${value}, minmax(0, 1fr))`;
  }
  applyWidgetWidths(container);
  const gap = resolveGridGap(container);
  if (dashDnDState.controller && typeof dashDnDState.controller.setGrid === 'function') {
    dashDnDState.controller.setGrid({
      gap,
      columns: value,
      minColumns: DASHBOARD_MIN_COLUMNS,
      maxColumns: DASHBOARD_MAX_COLUMNS
    });
  }
}

function getPreferredLayoutColumns() {
  const sourcePrefs = prefCache.value || defaultPrefs();
  const layoutValue = sourcePrefs.layout && typeof sourcePrefs.layout === 'object'
    ? sourcePrefs.layout.columns
    : DASHBOARD_MIN_COLUMNS;
  return normalizeColumnCount(layoutValue).value;
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

function findWidgetNode(container, key) {
  if (!container || !key) return null;
  const target = String(key).trim();
  if (!target) return null;
  const nodes = collectWidgetNodes(container);
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (!node) continue;
    const dataset = node.dataset || {};
    const candidates = [dataset.dashWidget, dataset.widgetId, dataset.widget, dataset.widgetKey, node.id];
    if (candidates.some(candidate => candidate && String(candidate).trim() === target)) {
      return node;
    }
  }
  return null;
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
  applyDashboardLayoutClasses(container);
  const nodes = collectWidgetNodes(container);
  if (!nodes.length) {
    ensureDashboardDragStyles();
    return nodes;
  }
  ensureDashboardDragStyles();
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
    if (node.classList) {
      if (node.classList.contains('dash-full-width')) {
        node.classList.remove('dash-full-width');
      }
      if (node.classList.contains('grid') || node.classList.contains('status-stack')) {
        node.classList.add('span-full');
      }
      if (!node.classList.contains('span-full') && node.dataset && node.dataset.dashWidget === 'statusStack') {
        node.classList.add('span-full');
      }
    }
  });
  applyWidgetEditingMarkers(container, isDashboardEditingEnabled());
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

function logDrilldownSuccess(target, fallbackKey) {
  let key = '';
  if (target && target.closest) {
    const widgetNode = target.closest('[data-dash-widget]');
    if (widgetNode && widgetNode.dataset) {
      key = widgetNode.dataset.dashWidget || widgetNode.dataset.widgetId || widgetNode.dataset.widget || widgetNode.id || '';
    }
  }
  if (!key && fallbackKey) {
    key = fallbackKey;
  }
  if (!key && target && target.id) {
    key = resolveWidgetKeyFromId(target.id);
  }
  if (!key && target && target.dataset && target.dataset.widgetId) {
    key = target.dataset.widgetId;
  }
  if (!key) return;
  try {
    console.log(`DRILLDOWN_OK:${key}`);
  } catch (_err) {}
}

function handleDashboardTap(evt, target) {
  if (!target) return false;
  if (isDashboardEditingEnabled()) return false;
  const dataset = target.dataset || {};
  const contactId = dataset.contactId || target.getAttribute('data-contact-id');
  if (contactId) {
    evt.preventDefault();
    evt.stopPropagation();
    tryOpenContact(contactId);
    logDrilldownSuccess(target);
    return true;
  }
  const partnerId = dataset.partnerId || target.getAttribute('data-partner-id');
  if (partnerId) {
    evt.preventDefault();
    evt.stopPropagation();
    tryOpenPartner(partnerId);
    logDrilldownSuccess(target);
    return true;
  }
  const route = resolveDashboardRouteTarget(target);
  if (route) {
    evt.preventDefault();
    evt.stopPropagation();
    const navigated = tryNavigateDashboardRoute(route, target);
    if (navigated) {
      logDrilldownSuccess(target);
      return true;
    }
  }
  return false;
}

function wireTileTap(container) {
  if (!container || dashDnDState.pointerHandlers) return;
  const onPointerDown = evt => {
    if (evt.pointerType !== 'touch' && evt.pointerType !== 'pen') {
      if (evt.button != null && evt.button !== 0) return;
    }
    if (evt.target && evt.target.closest && (evt.target.closest('.dash-drag-handle') || evt.target.closest('.dash-resize-handle'))) return;
    const dataTarget = findDashboardDrilldownTarget(evt.target);
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
    if (evt.target && evt.target.closest && evt.target.closest('.dash-resize-handle')) return;
    const resolved = findDashboardDrilldownTarget(evt.target);
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
    if (evt.target && evt.target.closest && (evt.target.closest('.dash-drag-handle') || evt.target.closest('.dash-resize-handle'))) return;
    const target = findDashboardDrilldownTarget(evt.target);
    if (!target) return;
    const handled = handleDashboardTap(evt, target);
    if (handled) {
      target[DASHBOARD_HANDLED_CLICK_KEY] = Date.now();
    }
  };
  const onClick = evt => {
    if (evt.target && evt.target.closest && (evt.target.closest('.dash-drag-handle') || evt.target.closest('.dash-resize-handle'))) return;
    const target = findDashboardDrilldownTarget(evt.target);
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
  exposeDashboardDnDHandlers();
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
    snapshotLayoutWidths();
    return;
  }
  const signature = order.join('|');
  if (signature !== dashDnDState.orderSignature) {
    persistDashboardOrder(order);
  }
  syncStoredDashboardOrder(order);
  snapshotLayoutWidths();
}

function ensureDashboardRouteLifecycle() {
  if (releaseDashboardRouteToken || typeof acquireRouteLifecycleToken !== 'function') return;
  const release = acquireRouteLifecycleToken('dashboard', {
    mount() {
      try {
        ensureWidgetDnD();
      } catch (err) {
        try { if (console && console.warn) console.warn('[dashboard] route mount failed', err); }
        catch (_warnErr) {}
      }
    },
    unmount() {
      teardownWidgetDnD('route-lifecycle');
    }
  });
  releaseDashboardRouteToken = typeof release === 'function' ? release : () => {};
}

function ensureWidgetDnD() {
  const container = getDashboardContainerNode();
  if (!container) {
    celebrationsState.dndReady = false;
    teardownWidgetDnD('missing-container');
    return;
  }
  if (dashDnDState.container && dashDnDState.container !== container) {
    teardownWidgetDnD('container-replaced');
  }
  if (typeof ensureLayoutToggle === 'function' && !dashDnDState.updatingEditing) {
    ensureLayoutToggle();
  }
  dashDnDState.container = container;
  dashDnDState.lastTeardownReason = '';
  const editing = isDashboardEditingEnabled();
  applyRootEditingState(container, editing);
  const columns = getPreferredLayoutColumns();
  dashDnDState.columns = columns;
  applyLayoutColumns(columns);
  const nodes = ensureDashboardWidgets(container);
  applyWidgetEditingMarkers(container, editing);
  const hasNodes = Array.isArray(nodes) && nodes.length > 0;
  celebrationsState.dndReady = hasNodes;
  observeDashboardHost(container);
  if (!hasNodes) {
    if (dashDnDState.controller) {
      if (typeof dashDnDState.controller.setEditMode === 'function') {
        dashDnDState.controller.setEditMode(editing);
      }
      if (typeof dashDnDState.controller.disable === 'function') {
        dashDnDState.controller.disable();
      }
    }
    dashDnDState.active = false;
    cleanupPointerHandlersFor(container);
    exposeDashboardDnDHandlers();
    return;
  }
  const gap = resolveGridGap(container);
  const gridOptions = {
    gap,
    columns,
    minColumns: DASHBOARD_MIN_COLUMNS,
    maxColumns: DASHBOARD_MAX_COLUMNS
  };
  if (!dashDnDState.controller) {
    try {
      dashDnDState.controller = makeDraggableGrid({
        container,
        itemSel: DASHBOARD_ITEM_SELECTOR,
        handleSel: '.dash-drag-handle',
        storageKey: DASHBOARD_ORDER_STORAGE_KEY,
        idGetter: el => (el && el.dataset && el.dataset.dashWidget) ? el.dataset.dashWidget : (el && el.id ? String(el.id).trim() : ''),
        onOrderChange: persistDashboardOrder,
        grid: gridOptions,
        enabled: editing
      });
      if (dashDnDState.controller && typeof dashDnDState.controller.setGrid === 'function') {
        dashDnDState.controller.setGrid(gridOptions);
      }
      if (dashDnDState.pendingColumns != null) {
        applyLayoutColumns(dashDnDState.pendingColumns);
      }
    } catch (err) {
      try {
        if (console && console.warn) console.warn('[dashboard] drag init failed', err);
      } catch (_warnErr) {}
    }
  } else {
    if (typeof dashDnDState.controller.setGrid === 'function') {
      dashDnDState.controller.setGrid(gridOptions);
    }
  }
  const controller = dashDnDState.controller;
  if (controller) {
    if (typeof controller.setEditMode === 'function') {
      controller.setEditMode(editing);
    }
    if (editing) {
      if (typeof controller.enable === 'function') {
        controller.enable();
      }
    } else if (typeof controller.disable === 'function') {
      controller.disable();
    }
    if (typeof controller.refresh === 'function') {
      controller.refresh();
    }
  }
  const enabled = controller && typeof controller.isEnabled === 'function'
    ? controller.isEnabled()
    : editing;
  dashDnDState.active = !!(hasNodes && enabled);
  wireTileTap(container);
  exposeDashboardDnDHandlers();
  if (celebrationsState.shouldRender) {
    if (celebrationsState.dirty || celebrationsState.pendingHydration || !celebrationsState.hydrated) {
      celebrationsState.pendingHydration = false;
      scheduleCelebrationsHydration();
    }
  }
}

function buildDefaultMap(keys) {
  const map = {};
  keys.forEach(key => {
    map[key] = true;
  });
  return map;
}

function readDashboardBusMode() {
  if (dashboardStateApi && typeof dashboardStateApi.getMode === 'function') {
    const mode = dashboardStateApi.getMode();
    return mode === 'all' ? 'all' : 'today';
  }
  return 'today';
}

function defaultPrefs() {
  const widgets = buildDefaultMap(Object.keys(WIDGET_RESOLVERS));
  return {
    mode: readDashboardBusMode(),
    widgets,
    kpis: buildDefaultMap(KPI_KEYS),
    graphs: buildDefaultMap(Object.keys(GRAPH_RESOLVERS)),
    widgetCards: buildDefaultMap(Object.keys(WIDGET_CARD_RESOLVERS)),
    layout: { columns: DASHBOARD_MIN_COLUMNS, widths: {} }
  };
}

function clonePrefs(prefs) {
  const columnSource = prefs.layout && typeof prefs.layout === 'object' ? prefs.layout.columns : DASHBOARD_MIN_COLUMNS;
  const normalizedColumns = normalizeColumnCount(columnSource).value;
  const widthSource = prefs.layout && typeof prefs.layout === 'object' ? prefs.layout.widths : null;
  return {
    mode: prefs.mode === 'all' ? 'all' : 'today',
    widgets: Object.assign({}, prefs.widgets),
    kpis: Object.assign({}, prefs.kpis),
    graphs: Object.assign({}, prefs.graphs),
    widgetCards: Object.assign({}, prefs.widgetCards),
    layout: { columns: normalizedColumns, widths: Object.assign({}, widthSource || {}) }
  };
}

function sanitizePrefs(settings) {
  const prefs = defaultPrefs();
  const dash = settings && typeof settings === 'object' ? settings.dashboard : null;
  if (!dash || typeof dash !== 'object') {
    lastPersistedLayoutColumns = prefs.layout.columns;
    persistDashboardLayoutColumns(prefs.layout.columns, { force: true });
    return prefs;
  }
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
  const layoutSource = dash.layout && typeof dash.layout === 'object' ? dash.layout : null;
  const normalizedLayout = layoutSource && Object.prototype.hasOwnProperty.call(layoutSource, 'columns')
    ? normalizeColumnCount(layoutSource.columns)
    : normalizeColumnCount(undefined);
  prefs.mode = dash.mode === 'all' ? 'all' : 'today';
  const widthSource = layoutSource && typeof layoutSource.widths === 'object' ? layoutSource.widths : null;
  prefs.layout.columns = normalizedLayout.value;
  prefs.layout.widths = normalizeWidthMap(widthSource);
  lastPersistedLayoutColumns = normalizedLayout.value;
  if (normalizedLayout.coerced) {
    persistDashboardLayoutColumns(normalizedLayout.value, { force: true });
  }
  if (dashboardStateApi && typeof dashboardStateApi.setMode === 'function') {
    try {
      dashboardStateApi.setMode(prefs.mode, { notify: false, refresh: false, reason: 'dashboard:index:hydrate' });
    } catch (_err) {}
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
  const previousVisibility = Object.assign({}, base.widgets);
  let changed = false;
  Object.keys(next.widgets).forEach(key => {
    const visible = !hiddenKeys.has(key);
    if (next.widgets[key] !== visible) {
      next.widgets[key] = visible;
      changed = true;
    }
  });
  if (!changed && prefCache.value) return false;
  const newlyVisible = [];
  Object.keys(next.widgets).forEach(key => {
    const prevVisible = previousVisibility[key] !== false;
    const nextVisible = next.widgets[key] !== false;
    if (nextVisible && !prevVisible) newlyVisible.push(key);
  });
  prefCache.value = next;
  prefCache.loading = null;
  applySurfaceVisibility(next);
  maybeHydrateCelebrations(next);
  const container = dashDnDState.container || getDashboardContainerNode();
  if (container && newlyVisible.length) {
    newlyVisible.forEach(key => {
      const node = findWidgetNode(container, key);
      if (node) {
        try {
          container.appendChild(node);
        } catch (_err) {}
      }
    });
    applyWidgetWidths(container);
    persistDashboardOrderImmediate();
  }
  ensureWidgetDnD();
  return true;
}

function isTodayModeActive() {
  if (prefCache.value && prefCache.value.mode) {
    return prefCache.value.mode !== 'all';
  }
  if (!doc) return false;
  const btn = doc.querySelector(TODAY_MODE_BUTTON_SELECTOR);
  if (!btn || !btn.classList) return false;
  return btn.classList.contains('active');
}

function applyTodayPrioritiesHighlight() {
  if (!doc) return;
  const host = doc.getElementById('dashboard-today');
  if (!host || !host.firstElementChild) return;
  const highlight = isTodayModeActive();
  const container = host.firstElementChild;
  if (container && container.classList) {
    if (highlight) {
      if (container.dataset) container.dataset.todayHighlightContainer = 'on';
      TODAY_PRIORITIES_CONTAINER_CLASSES.forEach(cls => {
        container.classList.add(cls);
      });
    } else if (!container.dataset || container.dataset.todayHighlightContainer === 'on') {
      TODAY_PRIORITIES_CONTAINER_CLASSES.forEach(cls => {
        container.classList.remove(cls);
      });
      if (container.dataset) delete container.dataset.todayHighlightContainer;
    }
  }
  const headerRow = container && container.querySelector ? container.querySelector(':scope > .row') : null;
  const heading = headerRow && headerRow.querySelector ? headerRow.querySelector('strong') : null;
  if (heading && heading.classList) {
    if (highlight) {
      if (heading.dataset) heading.dataset.todayHighlightHeading = 'on';
      TODAY_PRIORITIES_HEADING_CLASSES.forEach(cls => {
        heading.classList.add(cls);
      });
    } else if (!heading.dataset || heading.dataset.todayHighlightHeading === 'on') {
      TODAY_PRIORITIES_HEADING_CLASSES.forEach(cls => {
        heading.classList.remove(cls);
      });
      if (heading.dataset) delete heading.dataset.todayHighlightHeading;
    }
  }
}

function getDashboardMode() {
  if (prefCache.value) {
    if (prefCache.value.mode === 'all') return 'all';
    if (prefCache.value.mode === 'today') return 'today';
  }
  return readDashboardBusMode();
}

function applyModeButtonState(mode) {
  if (!doc) return;
  const buttons = doc.querySelectorAll('[data-dashboard-mode]');
  const activeMode = mode === 'all' ? 'all' : 'today';
  buttons.forEach(btn => {
    const btnMode = btn.getAttribute('data-dashboard-mode') === 'all' ? 'all' : 'today';
    if (btnMode === activeMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

function persistDashboardMode(mode) {
  if (!win || !win.Settings || typeof win.Settings.save !== 'function') return;
  Promise.resolve(win.Settings.save({ dashboard: { mode } }))
    .catch(err => {
      try {
        if (console && console.warn) console.warn('[dashboard] mode save failed', err);
      } catch (_warnErr) {}
    });
}

function setDashboardMode(mode, options = {}) {
  const normalized = mode === 'all' ? 'all' : 'today';
  const current = getDashboardMode();
  const force = !!options.force;
  const fromBus = options.fromBus === true;
  const skipPersist = options.skipPersist === true || fromBus;
  const skipBus = options.skipBus === true || fromBus;
  if (current === normalized && !force) {
    applyModeButtonState(normalized);
    applyTodayPrioritiesHighlight();
    return normalized;
  }
  if (!prefCache.value) {
    prefCache.value = defaultPrefs();
  }
  prefCache.value.mode = normalized;
  applyModeButtonState(normalized);
  applySurfaceVisibility(prefCache.value);
  maybeHydrateCelebrations(prefCache.value);
  
  // Apply configuration-based widget visibility and order
  try {
    applyDashboardConfig(normalized);
  } catch (err) {
    if (console && console.warn) console.warn('[Dashboard] Failed to apply config:', err);
  }
  ensureWidgetDnD();
  applyTodayPrioritiesHighlight();
  if (!skipPersist) {
    persistDashboardMode(normalized);
  }
  if (!skipBus && dashboardStateApi && typeof dashboardStateApi.setMode === 'function') {
    try {
      dashboardStateApi.setMode(normalized, { reason: 'dashboard:index:set-mode' });
    } catch (_err) {}
  }
  return normalized;
}

function syncModeFromButtons() {
  if (!doc) return;
  const activeBtn = doc.querySelector('[data-dashboard-mode].active');
  const inferred = activeBtn && activeBtn.getAttribute('data-dashboard-mode') === 'all' ? 'all' : 'today';
  const current = getDashboardMode();
  if (inferred === current) return;
  setDashboardMode(inferred, { skipPersist: true, skipBus: true });
}

function ensureTodayModeObserver() {
  const { modeObserver } = todayHighlightState;
  if (!doc || typeof MutationObserver !== 'function') {
    if (modeObserver) modeObserver.disconnect();
    todayHighlightState.modeObserver = null;
    todayHighlightState.modeButton = null;
    return;
  }
  const btn = doc.querySelector(TODAY_MODE_BUTTON_SELECTOR);
  if (!btn) {
    if (modeObserver) modeObserver.disconnect();
    todayHighlightState.modeObserver = null;
    todayHighlightState.modeButton = null;
    return;
  }
  if (todayHighlightState.modeButton === btn && modeObserver) return;
  if (modeObserver) modeObserver.disconnect();
  const observer = new MutationObserver(() => {
    syncModeFromButtons();
    applyTodayPrioritiesHighlight();
  });
  observer.observe(btn, { attributes: true, attributeFilter: ['class'] });
  todayHighlightState.modeObserver = observer;
  todayHighlightState.modeButton = btn;
  syncModeFromButtons();
}

function ensureTodayHostObserver() {
  const { hostObserver } = todayHighlightState;
  if (!doc || typeof MutationObserver !== 'function') {
    if (hostObserver) hostObserver.disconnect();
    todayHighlightState.hostObserver = null;
    todayHighlightState.host = null;
    return;
  }
  const host = doc.getElementById('dashboard-today');
  if (!host) {
    if (hostObserver) hostObserver.disconnect();
    todayHighlightState.hostObserver = null;
    todayHighlightState.host = null;
    return;
  }
  if (todayHighlightState.host === host && hostObserver) return;
  if (hostObserver) hostObserver.disconnect();
  const observer = new MutationObserver(() => {
    applyTodayPrioritiesHighlight();
  });
  observer.observe(host, { childList: true });
  todayHighlightState.hostObserver = observer;
  todayHighlightState.host = host;
}

function refreshTodayHighlightWiring() {
  ensureTodayModeObserver();
  ensureTodayHostObserver();
  applyTodayPrioritiesHighlight();
}

function applySurfaceVisibility(prefs) {
  const widgetPrefs = prefs && typeof prefs.widgets === 'object' ? prefs.widgets : {};
  const graphPrefs = prefs && typeof prefs.graphs === 'object' ? prefs.graphs : {};
  const cardPrefs = prefs && typeof prefs.widgetCards === 'object' ? prefs.widgetCards : {};
  const handledGraphs = new Set();
  const handledCards = new Set();
  const mode = prefs && prefs.mode === 'all' ? 'all' : 'today';
  const restrictToToday = mode === 'today';
  const visibleKeys = [];

  Object.entries(WIDGET_RESOLVERS).forEach(([key, resolver]) => {
    const isTodayWidget = TODAY_WIDGET_KEYS.has(key);
    const forceTodayVisibility = restrictToToday && isTodayWidget;
    // Ensure today widget is always visible when in today mode
    const widgetEnabled = forceTodayVisibility ? true : widgetPrefs[key] !== false;
    const graphEnabled = forceTodayVisibility ? true : (GRAPH_KEYS.has(key) ? graphPrefs[key] !== false : true);
    const cardEnabled = forceTodayVisibility ? true : (WIDGET_CARD_KEYS.has(key) ? cardPrefs[key] !== false : true);
    if (key === CELEBRATIONS_WIDGET_KEY && widgetEnabled && graphEnabled && cardEnabled) {
      ensureCelebrationsWidgetShell();
    }
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    if (GRAPH_KEYS.has(key)) handledGraphs.add(key);
    if (WIDGET_CARD_KEYS.has(key)) handledCards.add(key);
    // Force show today widgets when in today mode, regardless of other settings
    const show = (forceTodayVisibility || (widgetEnabled && graphEnabled && cardEnabled)) && (!restrictToToday || isTodayWidget);
    applyNodeVisibility(node, show);
    if (show) visibleKeys.push(key);
  });

  Object.entries(GRAPH_RESOLVERS).forEach(([key, resolver]) => {
    if (handledGraphs.has(key)) return;
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = graphPrefs[key] !== false && (!restrictToToday || TODAY_WIDGET_KEYS.has(key));
    applyNodeVisibility(node, show);
  });

  Object.entries(WIDGET_CARD_RESOLVERS).forEach(([key, resolver]) => {
    if (handledCards.has(key)) return;
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = cardPrefs[key] !== false && (!restrictToToday || TODAY_WIDGET_KEYS.has(key));
    applyNodeVisibility(node, show);
  });

  applyWidgetWidths();
  setDebugSelectedIds(visibleKeys);
  setDebugTodayMode(restrictToToday);
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
    let prefs = null;
    try {
      ensureDashboardLegend();
      refreshWidgetIdLookup();
      prefs = await getSettingsPrefs();
      applyModeButtonState(prefs.mode);
      applySurfaceVisibility(prefs);
      applyKpiVisibility(prefs.kpis);
      applyLayoutColumns(prefs.layout && prefs.layout.columns);
    } catch (err) {
      if (console && console.warn) console.warn('[dashboard] apply prefs failed', err);
    }
    if (prefs) {
      maybeHydrateCelebrations(prefs);
    } else {
      const fallbackPrefs = prefCache.value || defaultPrefs();
      applyModeButtonState(fallbackPrefs.mode);
      applyLayoutColumns(fallbackPrefs.layout && fallbackPrefs.layout.columns);
      maybeHydrateCelebrations(fallbackPrefs);
    }
    refreshTodayHighlightWiring();
    ensureWidgetDnD();
  });
}

function handleHiddenChange(evt) {
  const detail = evt && typeof evt === 'object' ? evt.detail : null;
  const hidden = detail && Array.isArray(detail.hidden) ? detail.hidden : [];
  const container = dashDnDState.container || getDashboardContainerNode();
  if (container) {
    persistDashboardOrderImmediate();
  }
  const changed = applyHiddenWidgetPrefs(hidden);
  if (container && changed) {
    ensureDashboardWidgets(container);
  }
  if (changed) {
    if (dashDnDState.controller && typeof dashDnDState.controller.refresh === 'function') {
      dashDnDState.controller.refresh();
    } else {
      ensureWidgetDnD();
    }
  }
  refreshTodayHighlightWiring();
}

function handleLayoutColumnsChange(evt) {
  const detail = evt && typeof evt === 'object' ? evt.detail : null;
  const raw = detail && Object.prototype.hasOwnProperty.call(detail, 'columns') ? detail.columns : detail;
  const normalized = normalizeColumnCount(raw);
  const value = normalized.value;
  const current = prefCache.value && prefCache.value.layout && typeof prefCache.value.layout === 'object'
    ? prefCache.value.layout.columns
    : null;
  if (current === value) {
    applyLayoutColumns(value);
    return;
  }
  if (!prefCache.value) {
    prefCache.value = defaultPrefs();
  }
  if (!prefCache.value.layout || typeof prefCache.value.layout !== 'object') {
    prefCache.value.layout = { columns: value, widths: {} };
  } else {
    prefCache.value.layout.columns = value;
    if (!prefCache.value.layout.widths || typeof prefCache.value.layout.widths !== 'object') {
      prefCache.value.layout.widths = {};
    }
  }
  applyLayoutColumns(value);
  persistDashboardLayoutColumns(value);
  ensureWidgetDnD();
}

function init() {
  if (!doc) return;
  ensureDashboardRouteLifecycle();
  
  // Ensure proper widget visibility on boot by toggling modes AFTER splash screen hides
  const ensureProperBootState = () => {
    const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
    
    const performToggle = () => {
      // Simple toggle: from current mode to alternate and back
      const current = getDashboardMode();
      const alternate = current === 'today' ? 'all' : 'today';
      
      // Toggle to alternate mode to force re-render
      setDashboardMode(alternate, { skipPersist: true, force: true, skipBus: true });
      
      // Toggle back to desired mode after one RAF
      raf(() => {
        setDashboardMode(current, { skipPersist: true, force: true, skipBus: true });
        
        // Emit ready event after toggle completes
        raf(() => {
          if (doc) {
            try {
              const evt = new CustomEvent('dashboard:widgets:ready', { bubbles: true });
              doc.dispatchEvent(evt);
            } catch (_) {}
          }
        });
      });
    };
    
    // Wait for splash screen to hide before performing toggle
    const checkSplashHidden = () => {
      if (win && win.__SPLASH_HIDDEN__) {
        // Wait one more frame after splash hidden to ensure DOM is stable
        raf(() => performToggle());
        return;
      }
      // Try again after delay
      setTimeout(checkSplashHidden, 100);
    };
    
    // Start checking for splash hidden
    setTimeout(checkSplashHidden, 200);
  };
  
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => {
      if (typeof ensureLayoutToggle === 'function') {
        ensureLayoutToggle();
      }
      scheduleApply();
      ensureWidgetDnD();
      ensureProperBootState();
    }, { once: true });
  } else {
    if (typeof ensureLayoutToggle === 'function') {
      ensureLayoutToggle();
    }
    scheduleApply();
    ensureWidgetDnD();
    ensureProperBootState();
  }
  if (win && win.RenderGuard && typeof win.RenderGuard.registerHook === 'function') {
    try {
      win.RenderGuard.registerHook(scheduleApply);
    } catch (_err) {}
  }
  if (win) {
    win.addEventListener('hashchange', scheduleApply);
  }
  doc.addEventListener('app:navigate', handleDashboardAppNavigate);
  doc.addEventListener('dashboard:hidden-change', handleHiddenChange);
  doc.addEventListener('dashboard:layout-columns', handleLayoutColumnsChange);
  doc.addEventListener('app:data:changed', evt => {
    const scope = evt && evt.detail && evt.detail.scope ? evt.detail.scope : '';
    if (scope === 'settings') invalidatePrefs();
    const normalizedScope = typeof scope === 'string' ? scope.toLowerCase() : '';
    if (!normalizedScope || normalizedScope.includes('contact') || normalizedScope.includes('setting')) {
      markCelebrationsDirty();
    }
    scheduleApply();
  });
  refreshTodayHighlightWiring();
}

if (dashboardStateApi && typeof dashboardStateApi.subscribe === 'function') {
  try {
    dashboardStateApi.subscribe((state, changed) => {
      if (!changed || typeof changed.has !== 'function' || !changed.has('mode')) return;
      setDashboardMode(state.mode, { skipPersist: true, fromBus: true, force: true, skipBus: true });
    });
  } catch (_err) {}
}

init();
