const STORAGE_KEY = 'dashboard:config:v1';

export const DASHBOARD_WIDGETS = [
  { id: 'focus', label: 'Focus Summary', size: 'medium', today: true },
  { id: 'filters', label: 'Filters', size: 'medium', today: true },
  { id: 'kpis', label: 'KPIs', size: 'medium', today: true },
  { id: 'pipeline', label: 'Pipeline Overview', size: 'large' },
  { id: 'today', label: "Today's Work", size: 'large', today: true },
  { id: 'leaderboard', label: 'Referral Leaderboard', size: 'medium' },
  { id: 'stale', label: 'Stale Deals', size: 'medium' },
  { id: 'goalProgress', label: 'Production Goals', size: 'large' },
  { id: 'numbersPortfolio', label: 'Partner Portfolio', size: 'medium' },
  { id: 'numbersReferrals', label: 'Referral Leaders', size: 'medium' },
  { id: 'numbersMomentum', label: 'Pipeline Momentum', size: 'large' },
  { id: 'pipelineCalendar', label: 'Pipeline Calendar', size: 'large' },
  { id: 'todo', label: 'To-Do', size: 'medium', today: true, all: true },
  { id: 'priorityActions', label: 'Priority Actions', size: 'medium', today: true },
  { id: 'milestones', label: 'Milestones Ahead', size: 'medium' },
  { id: 'docPulse', label: 'Document Pulse', size: 'medium' },
  { id: 'relationshipOpportunities', label: 'Relationship Opportunities', size: 'medium' },
  { id: 'clientCareRadar', label: 'Client Care Radar', size: 'medium' },
  { id: 'closingWatch', label: 'Closing Watchlist', size: 'medium' },
  { id: 'upcomingCelebrations', label: 'Upcoming Celebrations', size: 'medium', today: true },
  { id: 'docCenter', label: 'Document Center', size: 'large' },
  { id: 'favorites', label: 'Favorites', size: 'medium' }
];

function mapById(list = []) {
  const map = new Map();
  list.forEach(entry => {
    if (!entry || !entry.id) return;
    map.set(entry.id, entry);
  });
  return map;
}

export const DASHBOARD_WIDGET_MAP = mapById(DASHBOARD_WIDGETS);

export function buildDefaultConfig() {
  return {
    widgets: DASHBOARD_WIDGETS.map((widget, index) => ({
      id: widget.id,
      visible: true,
      order: index + 1
    })),
    defaultToAll: false,
    includeTodayInAll: true
  };
}

function cleanWidgetEntry(entry, fallbackOrder) {
  const id = entry && entry.id ? String(entry.id).trim() : '';
  if (!id) return null;
  const visible = entry && typeof entry.visible === 'boolean' ? entry.visible : true;
  const orderValue = Number.isFinite(entry?.order) ? Number(entry.order) : fallbackOrder;
  return { id, visible, order: orderValue };
}

export function normalizeDashboardConfig(rawConfig) {
  const base = buildDefaultConfig();
  const incomingWidgets = Array.isArray(rawConfig?.widgets) ? rawConfig.widgets : base.widgets;
  const normalizedWidgets = [];
  const seen = new Set();
  let nextOrder = 1;
  incomingWidgets.forEach(entry => {
    const cleaned = cleanWidgetEntry(entry, nextOrder);
    if (!cleaned) return;
    const catalogEntry = DASHBOARD_WIDGET_MAP.get(cleaned.id);
    if (!catalogEntry || seen.has(cleaned.id)) return;
    seen.add(cleaned.id);
    normalizedWidgets.push({
      id: cleaned.id,
      visible: cleaned.visible,
      order: Number.isFinite(cleaned.order) ? cleaned.order : nextOrder
    });
    nextOrder += 1;
  });
  DASHBOARD_WIDGETS.forEach(widget => {
    if (seen.has(widget.id)) return;
    normalizedWidgets.push({ id: widget.id, visible: true, order: nextOrder });
    nextOrder += 1;
  });
  normalizedWidgets.sort((a, b) => {
    if (a.order === b.order) return a.id.localeCompare(b.id);
    return a.order - b.order;
  });
  normalizedWidgets.forEach((entry, index) => { entry.order = index + 1; });
  return {
    widgets: normalizedWidgets,
    defaultToAll: rawConfig && rawConfig.defaultToAll === true,
    includeTodayInAll: rawConfig && rawConfig.includeTodayInAll === false ? false : true
  };
}

export function readDashboardConfig() {
  if (typeof localStorage === 'undefined') return buildDefaultConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = buildDefaultConfig();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeDashboardConfig(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (_err) {
    const defaults = buildDefaultConfig();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); } catch (_err2) {}
    return defaults;
  }
}

export function writeDashboardConfig(config) {
  const normalized = normalizeDashboardConfig(config);
  if (typeof localStorage === 'undefined') return normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (_err) { /* noop */ }
  return normalized;
}

export function updateDashboardConfig(mutator) {
  const current = readDashboardConfig();
  const next = typeof mutator === 'function' ? mutator(current) || current : current;
  return writeDashboardConfig(next);
}

export function findWidgetMeta(id) {
  return DASHBOARD_WIDGET_MAP.get(id) || null;
}

export function isTodayWidget(id) {
  const meta = findWidgetMeta(id);
  return !!(meta && meta.today);
}
