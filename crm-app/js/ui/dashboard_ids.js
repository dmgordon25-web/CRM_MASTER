const ELEMENT_ID_CACHE = new WeakMap();
const GLOBAL_ID_MAP = new Map();

export const DASHBOARD_WIDGET_SELECTOR = [
  ':scope > section.card',
  ':scope > section.grid',
  ':scope > div.card',
  ':scope > section[data-widget]',
  ':scope > li[data-widget]',
  ':scope > div[data-widget]',
].join(', ');

const LEGACY_ID_HINTS = new Map([
  ['dashboard-focus', 'focus'],
  ['dashboard-filters', 'filters'],
  ['dashboard-kpis', 'kpis'],
  ['dashboard-pipeline-overview', 'pipeline'],
  ['dashboard-today', 'today'],
  ['referral-leaderboard', 'leaderboard'],
  ['dashboard-stale', 'stale'],
  ['dashboard-insights', 'insights'],
  ['dashboard-opportunities', 'opportunities'],
]);

function slugify(input) {
  const base = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || '';
}

function isElementAttached(el) {
  if (typeof document === 'undefined' || !el) return false;
  try {
    return document.contains(el);
  } catch (_err) {
    return false;
  }
}

function reserveId(el, base) {
  let slug = slugify(base);
  if (!slug) slug = 'widget';
  let candidate = slug;
  let counter = 2;
  while (GLOBAL_ID_MAP.has(candidate)) {
    const current = GLOBAL_ID_MAP.get(candidate);
    if (current === el || !isElementAttached(current)) {
      break;
    }
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
  GLOBAL_ID_MAP.set(candidate, el);
  if (el.dataset) {
    el.dataset.widgetId = candidate;
  }
  ELEMENT_ID_CACHE.set(el, candidate);
  return candidate;
}

function deriveLabel(el) {
  if (!el) return '';
  const selectors = [
    '[data-ui="card-title"]',
    '.card-title',
    '.insight-head',
    'header h1',
    'header h2',
    'header h3',
    'header h4',
    'header h5',
    'header h6',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    '.row > strong:first-child',
  ];
  for (const sel of selectors) {
    try {
      const node = el.querySelector(sel);
      if (!node) continue;
      const text = node.textContent ? node.textContent.trim() : '';
      if (text) return text;
    } catch (_err) {}
  }
  const aria = el.getAttribute ? String(el.getAttribute('aria-label') || '').trim() : '';
  if (aria) return aria;
  return '';
}

function fallbackFromId(el) {
  if (!el) return '';
  const dataKey = el.dataset && (el.dataset.dashWidget || el.dataset.widgetKey || el.dataset.widget);
  if (dataKey) return dataKey;
  const attr = el.getAttribute ? (el.getAttribute('data-widget') || el.getAttribute('data-section')) : '';
  if (attr) return attr;
  if (el.id) {
    const hint = LEGACY_ID_HINTS.get(el.id) || el.id;
    return hint;
  }
  const label = deriveLabel(el);
  if (label) return label;
  return 'widget';
}

export function getWidgetId(el) {
  if (!el || el.nodeType !== 1) return '';
  if (ELEMENT_ID_CACHE.has(el)) return ELEMENT_ID_CACHE.get(el);
  const datasetId = el.dataset && el.dataset.widgetId ? slugify(el.dataset.widgetId) : '';
  if (datasetId) {
    return reserveId(el, datasetId);
  }
  const attrId = el.getAttribute ? slugify(el.getAttribute('data-widget-id') || el.getAttribute('data-id')) : '';
  if (attrId) {
    return reserveId(el, attrId);
  }
  const elementId = el.id ? slugify(el.id) : '';
  if (elementId) {
    return reserveId(el, elementId);
  }
  const fallback = fallbackFromId(el);
  return reserveId(el, fallback);
}

export function scanWidgets(container, selector = DASHBOARD_WIDGET_SELECTOR) {
  if (!container) return [];
  let nodes = [];
  try {
    nodes = Array.from(container.querySelectorAll(selector));
  } catch (_err) {
    nodes = [];
  }
  const seen = new Set();
  const list = [];
  nodes.forEach((el) => {
    if (!el || el.nodeType !== 1) return;
    const id = getWidgetId(el);
    if (!id || seen.has(id)) return;
    seen.add(id);
    list.push({ el, id });
  });
  return list;
}

export function findDashboardContainer() {
  if (typeof document === 'undefined') return null;
  const root = document.querySelector('main[data-ui="dashboard-root"]')
    || document.getElementById('view-dashboard')
    || document.querySelector('[data-view="dashboard"]')
    || null;
  return root;
}

export function guessWidgetLabel(el, id) {
  const direct = deriveLabel(el);
  if (direct) return direct;
  if (el && el.dataset) {
    const key = el.dataset.dashWidget || el.dataset.widgetKey || el.dataset.widget;
    if (key) {
      return key
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (m) => m.toUpperCase());
    }
  }
  if (id) {
    return id
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }
  return 'Widget';
}
