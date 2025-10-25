const doc = typeof document === 'undefined' ? null : document;
const win = typeof window === 'undefined' ? null : window;

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
  });
}

function init() {
  if (!doc) return;
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', () => scheduleApply(), { once: true });
  } else {
    scheduleApply();
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
