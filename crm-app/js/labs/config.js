// Labs Dashboard Configuration
// Experimental widgets with creative freedom - no rules!

const STORAGE_KEY = 'labs:dashboard:config:v1';
const STATE_KEY = 'labs:dashboard:state:v1';

export const LABS_WIDGETS = [
  { id: 'velocity', label: 'Velocity Meter', size: 'medium', category: 'performance', icon: '⚡' },
  { id: 'network', label: 'Relationship Network', size: 'large', category: 'insights', icon: '🌐' },
  { id: 'heatmap', label: 'Activity Heatmap', size: 'large', category: 'analytics', icon: '🔥' },
  { id: 'aiInsights', label: 'AI Insights', size: 'medium', category: 'intelligence', icon: '🤖' },
  { id: 'timeline', label: 'Event Stream', size: 'medium', category: 'activity', icon: '📊' },
  { id: 'funnel3d', label: '3D Pipeline Funnel', size: 'large', category: 'pipeline', icon: '🎯' },
  { id: 'pulse', label: 'Activity Pulse', size: 'small', category: 'monitoring', icon: '💓' },
  { id: 'galaxy', label: 'Deal Galaxy', size: 'large', category: 'visualization', icon: '🌌' },
  { id: 'weather', label: 'Market Weather', size: 'medium', category: 'forecasting', icon: '⛅' },
  { id: 'achievements', label: 'Achievements', size: 'medium', category: 'gamification', icon: '🏆' },
  { id: 'momentum', label: 'Momentum Score', size: 'small', category: 'performance', icon: '🚀' },
  { id: 'radar', label: 'Opportunity Radar', size: 'medium', category: 'insights', icon: '📡' },
  { id: 'forecast', label: 'Revenue Forecast', size: 'large', category: 'analytics', icon: '📈' },
  { id: 'sentiment', label: 'Team Sentiment', size: 'small', category: 'monitoring', icon: '😊' },
  { id: 'automation', label: 'Automation Hub', size: 'medium', category: 'productivity', icon: '⚙️' }
];

function mapById(list = []) {
  const map = new Map();
  list.forEach(entry => {
    if (!entry || !entry.id) return;
    map.set(entry.id, entry);
  });
  return map;
}

export const LABS_WIDGET_MAP = mapById(LABS_WIDGETS);

export function buildDefaultLabsConfig() {
  return {
    widgets: LABS_WIDGETS.map((widget, index) => ({
      id: widget.id,
      visible: true,
      order: index + 1,
      pinned: false
    })),
    layout: 'masonry', // masonry, grid, flow
    theme: 'neon', // neon, cyber, aurora, matrix
    animations: true,
    compactMode: false
  };
}

function cleanWidgetEntry(entry, fallbackOrder) {
  const id = entry && entry.id ? String(entry.id).trim() : '';
  if (!id) return null;
  const visible = entry && typeof entry.visible === 'boolean' ? entry.visible : true;
  const orderValue = Number.isFinite(entry?.order) ? Number(entry.order) : fallbackOrder;
  const pinned = entry && typeof entry.pinned === 'boolean' ? entry.pinned : false;
  return { id, visible, order: orderValue, pinned };
}

export function normalizeLabsConfig(rawConfig) {
  const base = buildDefaultLabsConfig();
  const incomingWidgets = Array.isArray(rawConfig?.widgets) ? rawConfig.widgets : base.widgets;
  const normalizedWidgets = [];
  const seen = new Set();
  let nextOrder = 1;

  incomingWidgets.forEach(entry => {
    const cleaned = cleanWidgetEntry(entry, nextOrder);
    if (!cleaned) return;
    const catalogEntry = LABS_WIDGET_MAP.get(cleaned.id);
    if (!catalogEntry || seen.has(cleaned.id)) return;
    seen.add(cleaned.id);
    normalizedWidgets.push({
      id: cleaned.id,
      visible: cleaned.visible,
      order: Number.isFinite(cleaned.order) ? cleaned.order : nextOrder,
      pinned: cleaned.pinned
    });
    nextOrder += 1;
  });

  LABS_WIDGETS.forEach(widget => {
    if (seen.has(widget.id)) return;
    normalizedWidgets.push({ id: widget.id, visible: true, order: nextOrder, pinned: false });
    nextOrder += 1;
  });

  normalizedWidgets.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    if (a.order === b.order) return a.id.localeCompare(b.id);
    return a.order - b.order;
  });

  normalizedWidgets.forEach((entry, index) => { entry.order = index + 1; });

  return {
    widgets: normalizedWidgets,
    layout: rawConfig?.layout || 'masonry',
    theme: rawConfig?.theme || 'neon',
    animations: rawConfig?.animations !== false,
    compactMode: rawConfig?.compactMode === true
  };
}

export function readLabsConfig() {
  if (typeof localStorage === 'undefined') return buildDefaultLabsConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const defaults = buildDefaultLabsConfig();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
      return defaults;
    }
    const parsed = JSON.parse(raw);
    const normalized = normalizeLabsConfig(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (_err) {
    const defaults = buildDefaultLabsConfig();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults)); } catch (_err2) {}
    return defaults;
  }
}

export function writeLabsConfig(config) {
  const normalized = normalizeLabsConfig(config);
  if (typeof localStorage === 'undefined') return normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (_err) { /* noop */ }
  return normalized;
}

export function updateLabsConfig(mutator) {
  const current = readLabsConfig();
  const next = typeof mutator === 'function' ? mutator(current) || current : current;
  return writeLabsConfig(next);
}

export function findLabsWidgetMeta(id) {
  return LABS_WIDGET_MAP.get(id) || null;
}

// Labs state management
export function getLabsState() {
  if (typeof localStorage === 'undefined') return { activeFilters: [], quickActions: true };
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? JSON.parse(raw) : { activeFilters: [], quickActions: true };
  } catch (_) {
    return { activeFilters: [], quickActions: true };
  }
}

export function setLabsState(state) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (_) {}
}
