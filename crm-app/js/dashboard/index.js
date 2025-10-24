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
  numbersGlance: () => doc ? doc.querySelector('#dashboard-insights .numbers-glance') : null,
  pipelineCalendar: () => {
    if(!doc) return null;
    const node = doc.getElementById('pipeline-calendar');
    return node ? node.closest('.insight-card') : null;
  }
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

const prefCache = { value: null, loading: null };
const settingsReadyState = { listeners: [], polling: false, timer: null, notified: false };
const SETTINGS_POLL_DELAY = 50;
const SETTINGS_WAIT_TIMEOUT = 4000;

function getSettingsApi() {
  if (!win || !win.Settings || typeof win.Settings.get !== 'function') return null;
  return win.Settings;
}

function scheduleSettingsPoll() {
  if (!win) return;
  if (settingsReadyState.polling) return;
  settingsReadyState.polling = true;
  const timeoutFn = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;

  const poll = () => {
    const api = getSettingsApi();
    if (api) {
      settingsReadyState.polling = false;
      settingsReadyState.timer = null;
      notifySettingsReady(api);
      return;
    }
    settingsReadyState.timer = timeoutFn(poll, SETTINGS_POLL_DELAY);
  };

  poll();
}

function notifySettingsReady(api) {
  if (!api) return;
  const listeners = settingsReadyState.listeners.splice(0, settingsReadyState.listeners.length);
  listeners.forEach(listener => {
    try {
      listener(api);
    } catch (_err) {}
  });
  if (!settingsReadyState.notified) {
    settingsReadyState.notified = true;
    onSettingsReady(api);
  }
}

function waitForSettings(timeout = SETTINGS_WAIT_TIMEOUT) {
  const api = getSettingsApi();
  if (api) return Promise.resolve(api);
  if (!win) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false;
    const clearFn = typeof win.clearTimeout === 'function' ? win.clearTimeout.bind(win) : clearTimeout;
    const timeoutFn = typeof win.setTimeout === 'function' ? win.setTimeout.bind(win) : setTimeout;
    let timer = null;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      const index = settingsReadyState.listeners.indexOf(listener);
      if (index >= 0) settingsReadyState.listeners.splice(index, 1);
      if (timer) clearFn(timer);
    };

    const listener = value => {
      cleanup();
      resolve(value);
    };

    settingsReadyState.listeners.push(listener);
    scheduleSettingsPoll();

    if (timeout > 0) {
      timer = timeoutFn(() => {
        cleanup();
        resolve(null);
      }, timeout);
    }
  });
}

function onSettingsReady() {
  invalidatePrefs();
  scheduleApply();
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
    kpis: buildDefaultMap(KPI_KEYS),
    graphs: buildDefaultMap(Object.keys(GRAPH_RESOLVERS)),
    widgetCards: buildDefaultMap(Object.keys(WIDGET_CARD_RESOLVERS))
  };
}

function clonePrefs(prefs) {
  return {
    kpis: Object.assign({}, prefs.kpis),
    graphs: Object.assign({}, prefs.graphs),
    widgetCards: Object.assign({}, prefs.widgetCards)
  };
}

function sanitizePrefs(settings) {
  const prefs = defaultPrefs();
  const dash = settings && typeof settings === 'object' ? settings.dashboard : null;
  if (!dash || typeof dash !== 'object') return prefs;
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
  }
  const widgetSource = dash.widgetCards && typeof dash.widgetCards === 'object' ? dash.widgetCards : null;
  if (widgetSource) {
    Object.keys(prefs.widgetCards).forEach(key => {
      if (typeof widgetSource[key] === 'boolean') prefs.widgetCards[key] = widgetSource[key];
    });
  }
  return prefs;
}

function getSettingsPrefs() {
  if (prefCache.value) return Promise.resolve(clonePrefs(prefCache.value));
  if (prefCache.loading) return prefCache.loading.then(clonePrefs);
  const loading = (async () => {
    const api = await waitForSettings();
    let settings = null;
    if (api && typeof api.get === 'function') {
      try {
        settings = await api.get();
      } catch (err) {
        if (console && console.warn) console.warn('[dashboard] settings fetch failed', err);
      }
    }
    const prefs = sanitizePrefs(settings);
    if (api && typeof api.get === 'function') {
      prefCache.value = prefs;
    }
    return prefs;
  })();
  prefCache.loading = loading;
  loading.finally(() => {
    if (prefCache.loading === loading) prefCache.loading = null;
  });
  return loading.then(clonePrefs);
}

function invalidatePrefs() {
  prefCache.value = null;
}

function applyNodeVisibility(node, show) {
  if (!node) return;
  if (show) {
    if (node.dataset && Object.prototype.hasOwnProperty.call(node.dataset, 'dashPrefDisplay')) {
      node.style.display = node.dataset.dashPrefDisplay || '';
    } else {
      node.style.display = '';
    }
    node.removeAttribute('aria-hidden');
  } else {
    if (node.dataset && !Object.prototype.hasOwnProperty.call(node.dataset, 'dashPrefDisplay')) {
      node.dataset.dashPrefDisplay = node.style.display || '';
    }
    node.style.display = 'none';
    node.setAttribute('aria-hidden', 'true');
  }
}

function applyGraphVisibility(prefs) {
  Object.entries(GRAPH_RESOLVERS).forEach(([key, resolver]) => {
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = prefs[key] !== false;
    applyNodeVisibility(node, show);
  });
}

function applyWidgetCardVisibility(prefs) {
  Object.entries(WIDGET_CARD_RESOLVERS).forEach(([key, resolver]) => {
    let node = null;
    try {
      node = resolver();
    } catch (_err) {
      node = null;
    }
    const show = prefs[key] !== false;
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
      applyGraphVisibility(prefs.graphs);
      applyWidgetCardVisibility(prefs.widgetCards);
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
