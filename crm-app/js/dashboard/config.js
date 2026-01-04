const STORAGE_KEY = 'dashboard:config:v1';
const DOC_CENTER_WIDGET_ENABLED = (() => {
  try { return localStorage.getItem('flag_show_doc_widget') === '1'; }
  catch (_err) { return false; }
})();

export const DEFAULT_WIDGET_SET = [
  'focus',
  'filters',
  'kpis',
  'pipeline',
  'today',
  'todo',
  'priorityActions',
  'stale'
];

const PREVIEW_WIDGET_EXTRAS = ['goalProgress', 'numbersMomentum'];
export const PREVIEW_WIDGET_SET = DEFAULT_WIDGET_SET.concat(PREVIEW_WIDGET_EXTRAS);

export const DASHBOARD_WIDGETS = [
  { id: 'focus', label: 'Focus Summary', size: 'medium', today: true },
  { id: 'filters', label: 'Filters', size: 'medium', today: true },
  { id: 'kpis', label: 'KPIs', size: 'medium', today: true },
  { id: 'pipeline', label: 'Pipeline Overview', size: 'large' },
  { id: 'today', label: "Today's Work", size: 'large', today: true },
  { id: 'todo', label: 'To-Do', size: 'medium', today: true, all: true },
  { id: 'priorityActions', label: 'Priority Actions', size: 'medium', today: true },
  { id: 'stale', label: 'Stale Deals', size: 'medium' },
  { id: 'leaderboard', label: 'Referral Leaderboard', size: 'medium' },
  { id: 'goalProgress', label: 'Production Goals', size: 'large' },
  { id: 'numbersPortfolio', label: 'Partner Portfolio', size: 'medium' },
  { id: 'numbersReferrals', label: 'Referral Leaders', size: 'medium' },
  { id: 'numbersMomentum', label: 'Pipeline Momentum', size: 'large' },
  { id: 'pipelineCalendar', label: 'Pipeline Calendar', size: 'large' },
  { id: 'milestones', label: 'Milestones Ahead', size: 'medium' },
  { id: 'docPulse', label: 'Document Pulse', size: 'medium' },
  { id: 'relationshipOpportunities', label: 'Relationship Opportunities', size: 'medium' },
  { id: 'clientCareRadar', label: 'Client Care Radar', size: 'medium' },
  { id: 'closingWatch', label: 'Closing Watchlist', size: 'medium' },
  { id: 'upcomingCelebrations', label: 'Upcoming Celebrations', size: 'medium', today: true },
  { id: 'favorites', label: 'Favorites', size: 'medium', today: true }
];
if (DOC_CENTER_WIDGET_ENABLED) {
  DASHBOARD_WIDGETS.splice(DASHBOARD_WIDGETS.length - 1, 0, { id: 'docCenter', label: 'Document Center', size: 'large' });
}

function mapById(list = []) {
  const map = new Map();
  list.forEach(entry => {
    if (!entry || !entry.id) return;
    map.set(entry.id, entry);
  });
  return map;
}

export const DASHBOARD_WIDGET_MAP = mapById(DASHBOARD_WIDGETS);

function resolveDefaultWidgetSet(mode = 'default') {
  return mode === 'preview' ? PREVIEW_WIDGET_SET : DEFAULT_WIDGET_SET;
}

export function buildDefaultConfig(mode = 'default') {
  const allowedSet = new Set(resolveDefaultWidgetSet(mode));
  const orderedIds = [];
  resolveDefaultWidgetSet(mode).forEach(id => {
    if (!orderedIds.includes(id)) orderedIds.push(id);
  });
  DASHBOARD_WIDGETS.forEach(widget => {
    if (!widget || !widget.id) return;
    if (orderedIds.includes(widget.id)) return;
    orderedIds.push(widget.id);
  });
  return {
    widgets: orderedIds.map((id, index) => ({
      id,
      visible: allowedSet.has(id),
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

export function normalizeDashboardConfig(rawConfig, options = {}) {
  const mode = options.mode === 'preview' ? 'preview' : 'default';
  const base = buildDefaultConfig(mode);
  const baseMap = mapById(base.widgets);
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
      visible: typeof cleaned.visible === 'boolean'
        ? cleaned.visible
        : (baseMap.get(cleaned.id)?.visible !== false),
      order: Number.isFinite(cleaned.order)
        ? cleaned.order
        : (Number.isFinite(baseMap.get(cleaned.id)?.order) ? baseMap.get(cleaned.id).order : nextOrder)
    });
    nextOrder += 1;
  });
  base.widgets.forEach(widget => {
    if (!widget || !widget.id || seen.has(widget.id)) return;
    normalizedWidgets.push({
      id: widget.id,
      visible: typeof widget.visible === 'boolean' ? widget.visible : true,
      order: Number.isFinite(widget.order) ? widget.order : nextOrder
    });
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

export function readDashboardConfig(mode = 'default') {
  const normalizedMode = mode === 'preview' ? 'preview' : 'default';
  if (typeof localStorage === 'undefined') return buildDefaultConfig(normalizedMode);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = buildDefaultConfig(normalizedMode);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeDashboardConfig(parsed, { mode: normalizedMode });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (_err) {
    const defaults = buildDefaultConfig(normalizedMode);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); } catch (_err2) {}
    return defaults;
  }
}

export function writeDashboardConfig(config, options = {}) {
  const normalized = normalizeDashboardConfig(config, options);
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

export { DOC_CENTER_WIDGET_ENABLED };
