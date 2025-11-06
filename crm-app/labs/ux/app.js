const GRID_COLUMNS = 12;
const GRID_CELL_HEIGHT = 120;
const GRID_GAP = 16;
const LAYOUT_STORAGE_KEY = 'labs:layout:v1';

const DEFAULT_LAYOUT = [
  { id: 'dashboard-focus', x: 0, y: 0, w: 4, h: 3 },
  { id: 'dashboard-filters', x: 4, y: 0, w: 4, h: 3 },
  { id: 'dashboard-kpis', x: 8, y: 0, w: 4, h: 3 },
  { id: 'dashboard-pipeline-overview', x: 0, y: 3, w: 6, h: 4 },
  { id: 'dashboard-today', x: 6, y: 3, w: 6, h: 4 },
  { id: 'referral-leaderboard', x: 0, y: 7, w: 4, h: 3 },
  { id: 'dashboard-stale', x: 4, y: 7, w: 4, h: 3 },
  { id: 'favorites-card', x: 8, y: 7, w: 4, h: 3 },
  { id: 'goal-progress-card', x: 0, y: 10, w: 4, h: 3 },
  { id: 'numbers-portfolio-card', x: 4, y: 10, w: 4, h: 3 },
  { id: 'numbers-referrals-card', x: 8, y: 10, w: 4, h: 3 },
  { id: 'numbers-momentum-card', x: 0, y: 13, w: 6, h: 4 },
  { id: 'pipeline-calendar-card', x: 6, y: 13, w: 6, h: 4 },
  { id: 'priority-actions-card', x: 0, y: 17, w: 6, h: 3 },
  { id: 'milestones-card', x: 6, y: 17, w: 6, h: 3 },
  { id: 'doc-pulse-card', x: 0, y: 20, w: 6, h: 3 },
  { id: 'rel-opps-card', x: 6, y: 20, w: 6, h: 3 },
  { id: 'nurture-card', x: 0, y: 23, w: 6, h: 3 },
  { id: 'closing-watch-card', x: 6, y: 23, w: 6, h: 3 },
  { id: 'doc-center-card', x: 0, y: 26, w: 6, h: 3 },
  { id: 'dashboard-status-stack', x: 0, y: 29, w: 12, h: 4 }
import { GridStack } from 'https://cdn.jsdelivr.net/npm/gridstack@9.3.0/dist/gridstack-all.esm.min.js';

const root = document.getElementById('lab-app');
const gridElement = document.getElementById('lab-grid');
const themeSelect = document.getElementById('lab-theme-select');
const densitySelect = document.getElementById('lab-density-select');
const toggleList = document.getElementById('widget-toggle-list');
const spotlight = document.getElementById('widget-spotlight');
const columnsRange = document.getElementById('grid-columns');
const cellHeightRange = document.getElementById('grid-cell-height');
const cellHeightCaption = document.querySelector('[data-role="cell-height-caption"]');
const chromeSelect = document.getElementById('chrome-style');
const autoStackCheckbox = document.getElementById('auto-stack');
const tabs = Array.from(document.querySelectorAll('.lab-tab'));
const panels = Array.from(document.querySelectorAll('.lab-panel'));
const resetButton = document.querySelector('[data-action="reset-layout"]');
const saveButton = document.querySelector('[data-action="save-layout"]');
const scopeButtons = Array.from(document.querySelectorAll('[data-lab-scope]'));

const THEMES = {
  ocean: { label: 'Ocean Breeze', spacing: 12 },
  midnight: { label: 'Midnight Neon', spacing: 18 },
  sunrise: { label: 'Sunrise Canyon', spacing: 16 },
};

const defaultWidgetLayout = [
  {
    id: 'focus',
    title: 'Focus Today',
    caption: 'High-impact follow-ups ready now',
    layout: { x: 0, y: 0, w: 4, h: 4 },
    defaultActive: true,
    accent: '🎯',
    chips: ['Urgent Calls', 'Lock Expiring', 'Docs Needed'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span>Mortgage pre-approval — <strong>Lee Household</strong></span><span>Due 11:00a</span></div>
        <div class="lab-data-row"><span>Milestone update — <strong>Howard Refi</strong></span><span>Due 1:30p</span></div>
        <div class="lab-data-row"><span>Doc upload reminder — <strong>Mina Patel</strong></span><span>Due 3:15p</span></div>
        <div class="lab-data-row"><span>Escalate underwriting — <strong>Reynolds</strong></span><span>Due 4:45p</span></div>
      </div>
    `,
    spotlight: {
      badge: 'Focus',
      title: 'Prioritize what matters today',
      description: 'Pairs CRM tasks with urgency scoring so the dashboard surfaces only the work that moves loans forward right now.',
      bullets: ['Auto refreshes with every status change', 'Actions sync instantly with Tasks module', 'One-click call sheet exports'],
    },
  },
  {
    id: 'pipeline',
    title: 'Pipeline Pulse',
    caption: 'Snapshot of every stage in-flight',
    layout: { x: 4, y: 0, w: 4, h: 4 },
    defaultActive: true,
    accent: '📊',
    chips: ['Pre-Qual', 'Processing', 'Clear to Close'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><strong>12</strong><span>Leads nurturing</span></div>
        <div class="lab-data-row"><strong>8</strong><span>In processing</span></div>
        <div class="lab-data-row"><strong>6</strong><span>Submitted to UW</span></div>
        <div class="lab-data-row"><strong>3</strong><span>Clear to close</span></div>
      </div>
      <div class="lab-pill-group">
        <span class="lab-pill">⚡️ 4 ahead of pace</span>
        <span class="lab-pill">🕒 2 waiting on docs</span>
      </div>
    `,
    spotlight: {
      badge: 'Pipeline',
      title: 'Real-time funnel health',
      description: 'Combines CRM status with LOS milestones so you know exactly where volume is at risk.',
      bullets: ['Stage velocity indicators', 'Bulk nudges to processors', 'Heatmap overlay for branch rollups'],
    },
  },
  {
    id: 'leaderboard',
    title: 'Referral Leaderboard',
    caption: 'Who is sending business this week',
    layout: { x: 8, y: 0, w: 4, h: 4 },
    defaultActive: true,
    accent: '🏅',
    chips: ['Weekly', 'Partner Health'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span><strong>Aurora Realty</strong></span><span>7 files</span></div>
        <div class="lab-data-row"><span><strong>Summit Homes</strong></span><span>5 files</span></div>
        <div class="lab-data-row"><span><strong>Northview Agents</strong></span><span>4 files</span></div>
        <div class="lab-data-row"><span><strong>Brightside Team</strong></span><span>3 files</span></div>
      </div>
    `,
    spotlight: {
      badge: 'Partners',
      title: 'Celebrate top partners instantly',
      description: 'Live partner scoring matches CRM partner notes so you can reward wins the moment they happen.',
      bullets: ['Auto-email kudos templates', 'Compare branch vs personal leaderboard', 'Filter by partner tiers'],
    },
  },
  {
    id: 'kpis',
    title: 'Production KPIs',
    caption: 'Month-to-date targets',
    layout: { x: 0, y: 4, w: 3, h: 3 },
    defaultActive: true,
    accent: '📈',
    chips: ['MTD', 'Goal Tracking'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span>Funded Volume</span><strong>$3.8M / $5M</strong></div>
        <div class="lab-data-row"><span>Average Lock-to-Close</span><strong>21 days</strong></div>
        <div class="lab-data-row"><span>Net Promoter Score</span><strong>72</strong></div>
      </div>
    `,
    spotlight: {
      badge: 'KPIs',
      title: 'Visualize growth goals',
      description: 'Compact cards show progress vs goal, pulling from reports so you don’t have to open another tab.',
      bullets: ['Auto-adjusts for purchase/refi mix', 'Exports straight into pipeline reports', 'Highlights stalled metrics in red'],
    },
  },
  {
    id: 'insights',
    title: 'Advisor Insights',
    caption: 'Signals curated from CRM intelligence',
    layout: { x: 3, y: 4, w: 5, h: 3 },
    defaultActive: true,
    accent: '🧠',
    chips: ['AI Assist', 'Narratives'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span><strong>Alert:</strong> Processing backlog predicted Thursday</span><span>Plan: offer rush assist slots</span></div>
        <div class="lab-data-row"><span><strong>Opportunity:</strong> 6 pre-approvals expiring in 7 days</span><span>Action: send rate check explainer</span></div>
        <div class="lab-data-row"><span><strong>Win:</strong> Referral time-to-contact improved 18%</span><span>Keep: automated partner SMS</span></div>
      </div>
    `,
    spotlight: {
      badge: 'Insights',
      title: 'Narrative guidance, not just charts',
      description: 'Dynamic recommendations blend CRM activity, pipeline timing, and partner health for immediate follow-up suggestions.',
      bullets: ['Story mode timeline', 'One-click convert to tasks', 'Surfaced by urgency & impact'],
    },
  },
  {
    id: 'stale',
    title: 'Stale Loans Radar',
    caption: 'Deals without movement in the last 5 days',
    layout: { x: 8, y: 4, w: 4, h: 3 },
    defaultActive: false,
    accent: '🧭',
    chips: ['Aging', 'Automation Ready'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span><strong>Lopez VA Purchase</strong></span><span>Last touch: 6 days</span></div>
        <div class="lab-data-row"><span><strong>Cheng Cash-Out Refi</strong></span><span>Last touch: 8 days</span></div>
        <div class="lab-data-row"><span><strong>Reed New Build</strong></span><span>Last touch: 10 days</span></div>
      </div>
      <div class="lab-pill-group">
        <span class="lab-pill">Trigger auto-email</span>
        <span class="lab-pill">Assign rescue owner</span>
      </div>
    `,
    spotlight: {
      badge: 'Risk',
      title: 'Catch silent deals',
      description: 'Surfaces any file that has not moved so you can orchestrate next best action before fallout.',
      bullets: ['Auto-flag stale partners', 'Escalation assignments', 'Batch text follow-ups'],
    },
  },
  {
    id: 'filters',
    title: 'Smart Filters',
    caption: 'Instant views powered by CRM search presets',
    layout: { x: 0, y: 7, w: 4, h: 3 },
    defaultActive: false,
    accent: '🗂️',
    chips: ['Segmentations'],
    body: () => `
      <div class="lab-chip-set">
        <span class="lab-chip">🔥 Hot leads 48h</span>
        <span class="lab-chip">📝 Needs disclosures</span>
        <span class="lab-chip">🪄 Automation ready</span>
        <span class="lab-chip">🛎️ Partner follow-up</span>
      </div>
      <p class="lab-muted">Re-order filters and pin favorites for quick switching.</p>
    `,
    spotlight: {
      badge: 'Filters',
      title: 'One-tap saved searches',
      description: 'Pulls from CRM saved filters and lets you pin them into the dashboard for single-click pivots.',
      bullets: ['Supports partner + contact filter sets', 'Syncs with Workbench searches', 'Drag to reorder pinned filters'],
    },
  },
  {
    id: 'timeline',
    title: 'Activity Timeline',
    caption: 'Live feed of CRM + LOS activity',
    layout: { x: 4, y: 7, w: 8, h: 3 },
    defaultActive: true,
    accent: '⏱️',
    chips: ['Cross-team'],
    body: () => `
      <div class="lab-data-list">
        <div class="lab-data-row"><span><strong>09:05</strong> Partner note added by Jenna</span><span>Aurora Realty</span></div>
        <div class="lab-data-row"><span><strong>09:22</strong> Disclosure package e-signed</span><span>Howard Refi</span></div>
        <div class="lab-data-row"><span><strong>09:48</strong> New referral from Summit Homes</span><span>$540k purchase</span></div>
        <div class="lab-data-row"><span><strong>10:03</strong> Rate lock expiring soon</span><span>Lopez VA Purchase</span></div>
      </div>
    `,
    spotlight: {
      badge: 'Timeline',
      title: 'Unified activity stream',
      description: 'Blends CRM and LOS data streams with real-time updates so the dashboard becomes a mission control feed.',
      bullets: ['Color-coded by team', 'Keyboard shortcuts for quick replies', 'Filters by urgency or loan status'],
    },
  },
];

const LAB_SCOPE_TODAY_WIDGETS = new Set(['focus', 'pipeline', 'leaderboard', 'kpis', 'timeline', 'filters']);

const state = {
  active: false,
  shell: null,
  gridHost: null,
  placeholders: new Map(),
  items: new Map(),
  layout: new Map(),
  scopeObserver: null,
  pointer: null
  theme: 'ocean',
  density: 'normal',
  chrome: 'elevated',
  columns: 12,
  cellHeight: 96,
  autoStack: true,
  activeTab: 'dashboard',
  scopeMode: 'today',
  widgets: new Map(defaultWidgetLayout.map((w) => [w.id, { ...w, active: w.defaultActive !== false }])),
};

function logLabsError(message, error) {
  if (error) {
    console.error(`[Labs] ${message}`, error);
  } else {
    console.error(`[Labs] ${message}`);
  }
}

function wrapHandler(label, handler) {
  return function wrappedHandler(...args) {
    try {
      return handler.apply(this, args);
    } catch (err) {
      logLabsError(label, err);
      return undefined;
    }
  };
}

function isLabsRequested() {
  const hash = (window.location.hash || '').toLowerCase();
  if (hash.includes('labs')) return true;
  const params = new URLSearchParams(window.location.search || '');
  return params.has('labs');
}

function updateLocationForLabs(enabled) {
  try {
    const url = new URL(window.location.href);
    if (enabled) {
      if (!url.hash || url.hash.toLowerCase() !== '#labs') {
        url.hash = 'labs';
        history.replaceState(null, '', url.toString());
      }
    } else {
      if (url.hash) {
        url.hash = '';
      }
      if (url.searchParams.has('labs')) {
        url.searchParams.delete('labs');
      }
      history.replaceState(null, '', url.toString());
    }
  } catch (_) {}
}

function ensureShell() {
  if (state.shell) return state.shell;
  const container = document.querySelector('.container');
  if (!container) return null;
  const shell = document.createElement('section');
  shell.className = 'labs-shell';
  shell.setAttribute('data-labs-shell', '');
  shell.innerHTML = `
    <header class="labs-header">
      <div class="labs-header__left">
        <button type="button" class="labs-back" data-labs-exit>← Back to CRM</button>
        <div class="labs-title">
          <span class="labs-eyebrow">Labs</span>
          <h1>Drag &amp; Resize Dashboard</h1>
        </div>
      </div>
      <div class="labs-header__right" data-labs-scope></div>
    </header>
    <div class="labs-toolbar">
      <button type="button" class="labs-reset" data-labs-reset>Reset layout</button>
      <p class="labs-hint">Widgets are live CRM tiles. Drag with the handle, resize from the corner. Layouts stay local to this session.</p>
    </div>
    <div class="labs-grid" data-labs-grid></div>
  `;
  container.appendChild(shell);
  state.shell = shell;
  return shell;
}

function captureNode(node) {
  if (!node) return null;
  if (state.placeholders.has(node)) {
    return state.placeholders.get(node);
  }
  const parent = node.parentNode;
  if (!parent) return null;
  const marker = document.createComment(`labs-placeholder:${node.id || node.dataset?.widgetId || 'node'}`);
  parent.insertBefore(marker, node);
  const record = { parent, marker };
  state.placeholders.set(node, record);
  return record;
}

function restoreNode(node) {
  const record = state.placeholders.get(node);
  if (!record) return;
  const { parent, marker } = record;
  if (parent && parent.isConnected) {
    parent.insertBefore(node, marker);
  }
  if (marker && marker.parentNode) {
    marker.parentNode.removeChild(marker);
  }
  state.placeholders.delete(node);
}

function loadStoredLayout() {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Map();
    const map = new Map();
    parsed.forEach(entry => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const [id, spec] = entry;
      if (!id || typeof spec !== 'object' || spec == null) return;
      const normalized = normalizeSpec(spec, { id });
      map.set(String(id), normalized);
    });
    return map;
  } catch (_) {
    return new Map();
  }
}
function shouldDisplayWidget(widget) {
  if (!widget || widget.active !== true) {
    return false;
  }
  const mode = state.scopeMode === 'all' ? 'all' : 'today';
  if (mode === 'today') {
    return LAB_SCOPE_TODAY_WIDGETS.has(widget.id);
  }
  return true;
}

function syncWidgetsWithGrid() {
  if (!gridInstance) return;

  const activeWidgets = Array.from(state.widgets.values()).filter((widget) => shouldDisplayWidget(widget));
  const existingItems = new Map();
  gridElement.querySelectorAll('.grid-stack-item.lab-card').forEach((el) => {
    existingItems.set(el.dataset.widgetId, el);
  });

function persistLayout() {
  if (!state.active) return;
  try {
    const payload = [];
    state.layout.forEach((spec, id) => {
      payload.push([id, { x: spec.x, y: spec.y, w: spec.w, h: spec.h }]);
    });
    if (payload.length) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(payload));
    } else {
      localStorage.removeItem(LAYOUT_STORAGE_KEY);
    }
  } catch (_) {}
}

function clearStoredLayout() {
  try {
    localStorage.removeItem(LAYOUT_STORAGE_KEY);
  } catch (_) {}
}

function normalizeSpec(value, fallback = {}) {
  const base = {
    id: typeof fallback.id === 'string' ? fallback.id : String(fallback.id || value.id || ''),
    x: Number.isFinite(fallback.x) ? fallback.x : 0,
    y: Number.isFinite(fallback.y) ? fallback.y : 0,
    w: Number.isFinite(fallback.w) ? fallback.w : 1,
    h: Number.isFinite(fallback.h) ? fallback.h : 1
  };
  const spec = {
    id: base.id || '',
    x: Number.isFinite(value?.x) ? Number(value.x) : base.x,
    y: Number.isFinite(value?.y) ? Number(value.y) : base.y,
    w: Number.isFinite(value?.w) ? Number(value.w) : base.w,
    h: Number.isFinite(value?.h) ? Number(value.h) : base.h
  };
  if (spec.x < 0) spec.x = 0;
  if (spec.y < 0) spec.y = 0;
  if (spec.w < 1) spec.w = 1;
  if (spec.h < 1) spec.h = 1;
  if (spec.x + spec.w > GRID_COLUMNS) {
    spec.x = Math.max(0, Math.min(spec.x, GRID_COLUMNS - 1));
    spec.w = Math.max(1, GRID_COLUMNS - spec.x);
  }
  return spec;
  let removedAny = false;
  existingItems.forEach((element, widgetId) => {
    if (shouldDisplayWidget(state.widgets.get(widgetId))) return;
    gridInstance.removeWidget(element);
    removedAny = true;
  });

  if (removedAny && typeof gridInstance.compact === 'function') {
    gridInstance.compact();
  }
}

function refreshScopeButtons() {
  const mode = state.scopeMode === 'all' ? 'all' : 'today';
  scopeButtons.forEach((button) => {
    const buttonMode = button.dataset.labScope === 'all' ? 'all' : 'today';
    const isActive = buttonMode === mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function applyScope(mode) {
  const normalized = mode === 'all' ? 'all' : 'today';
  if (state.scopeMode !== normalized) {
    state.scopeMode = normalized;
  }
  refreshScopeButtons();
  syncWidgetsWithGrid();
  updateSpotlight();
}

function hookCardEvents(card, widgetId) {
  card.addEventListener('mouseenter', () => updateSpotlight(widgetId));
  card.addEventListener('focusin', () => updateSpotlight(widgetId));
}

function buildLayout() {
  const defaults = new Map();
  DEFAULT_LAYOUT.forEach(spec => {
    if (!spec || !spec.id) return;
    defaults.set(spec.id, normalizeSpec(spec));
  });
  const stored = loadStoredLayout();
  stored.forEach((spec, id) => {
    if (!defaults.has(id)) return;
    defaults.set(id, normalizeSpec(spec, defaults.get(id)));
  });
  const entries = [];
  defaults.forEach((spec, id) => {
    const node = document.getElementById(id);
    if (!node) {
      defaults.delete(id);
      return;
    }
    entries.push({ id, spec, node });
  });
  return { entries, layout: defaults };
}

function applySpecToElement(id) {
  const entry = state.items.get(id);
  const spec = state.layout.get(id);
  if (!entry || !spec) return;
  entry.wrapper.style.gridColumn = `${spec.x + 1} / span ${spec.w}`;
  entry.wrapper.style.gridRow = `${spec.y + 1} / span ${spec.h}`;
}

function applyAllSpecs() {
  state.layout.forEach((_, id) => applySpecToElement(id));
}

function collides(id, proposed) {
  if (!proposed) return false;
  let collision = false;
  state.layout.forEach((spec, otherId) => {
    if (collision || otherId === id) return;
    if (!spec) return;
    const overlap = !(
      proposed.x + proposed.w <= spec.x ||
      proposed.x >= spec.x + spec.w ||
      proposed.y + proposed.h <= spec.y ||
      proposed.y >= spec.y + spec.h
    );
    if (overlap) collision = true;
  });
  return collision;
}

function computeGridMetrics() {
  const grid = state.gridHost;
  if (!grid) {
    return {
      colWidth: 0,
      rowHeight: GRID_CELL_HEIGHT,
      gapX: GRID_GAP,
      gapY: GRID_GAP,
      colStep: GRID_CELL_HEIGHT,
      rowStep: GRID_CELL_HEIGHT
    };
  }
  const styles = window.getComputedStyle(grid);
  const gapX = Number.parseFloat(styles.columnGap || styles.gap || GRID_GAP) || 0;
  const gapY = Number.parseFloat(styles.rowGap || styles.gap || GRID_GAP) || 0;
  const autoRows = styles.gridAutoRows || `${GRID_CELL_HEIGHT}px`;
  const rowHeight = Number.parseFloat(autoRows) || GRID_CELL_HEIGHT;
  const width = grid.clientWidth || grid.offsetWidth || 0;
  const colWidth = GRID_COLUMNS > 0
    ? (width - gapX * (GRID_COLUMNS - 1)) / GRID_COLUMNS
    : width;
  const colStep = (colWidth || GRID_CELL_HEIGHT) + gapX;
  const rowStep = rowHeight + gapY;
  return {
    colWidth: colWidth || GRID_CELL_HEIGHT,
    rowHeight,
    gapX,
    gapY,
    colStep: colStep || GRID_CELL_HEIGHT,
    rowStep: rowStep || GRID_CELL_HEIGHT
  };
}

function cancelPointerInteraction() {
  const pointer = state.pointer;
  if (!pointer) return;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerEnd);
  window.removeEventListener('pointercancel', onPointerEnd);
  const item = state.items.get(pointer.id);
  if (item) {
    item.wrapper.classList.remove('labs-grid-item--dragging');
    item.wrapper.classList.remove('labs-grid-item--resizing');
  }
  state.pointer = null;
}

function onPointerMove(evt) {
  const pointer = state.pointer;
  if (!pointer || evt.pointerId !== pointer.pointerId) return;
  try {
    const spec = state.layout.get(pointer.id);
    if (!spec) return;
    const metrics = pointer.metrics;
    const deltaX = evt.clientX - pointer.startX;
    const deltaY = evt.clientY - pointer.startY;
    if (pointer.type === 'drag') {
      const stepX = metrics.colStep || GRID_CELL_HEIGHT;
      const stepY = metrics.rowStep || GRID_CELL_HEIGHT;
      const moveX = Math.round(deltaX / stepX);
      const moveY = Math.round(deltaY / stepY);
      let nextX = pointer.originX + moveX;
      let nextY = pointer.originY + moveY;
      if (nextX < 0) nextX = 0;
      if (nextY < 0) nextY = 0;
      if (nextX + spec.w > GRID_COLUMNS) {
        nextX = GRID_COLUMNS - spec.w;
      }
      const proposed = { x: nextX, y: nextY, w: spec.w, h: spec.h };
      if (!collides(pointer.id, proposed)) {
        if (spec.x !== proposed.x || spec.y !== proposed.y) {
          spec.x = proposed.x;
          spec.y = proposed.y;
          applySpecToElement(pointer.id);
        }
      }
    } else if (pointer.type === 'resize') {
      const stepX = metrics.colStep || GRID_CELL_HEIGHT;
      const stepY = metrics.rowStep || GRID_CELL_HEIGHT;
      const resizeX = Math.round(deltaX / stepX);
      const resizeY = Math.round(deltaY / stepY);
      let nextW = pointer.originW + resizeX;
      let nextH = pointer.originH + resizeY;
      if (nextW < 1) nextW = 1;
      if (nextH < 1) nextH = 1;
      if (pointer.originX + nextW > GRID_COLUMNS) {
        nextW = GRID_COLUMNS - pointer.originX;
      }
      const proposed = { x: spec.x, y: spec.y, w: nextW, h: nextH };
      if (!collides(pointer.id, proposed)) {
        if (spec.w !== proposed.w || spec.h !== proposed.h) {
          spec.w = proposed.w;
          spec.h = proposed.h;
          applySpecToElement(pointer.id);
        }
      }
    }
    evt.preventDefault();
  } catch (err) {
    logLabsError('pointer-move', err);
    cancelPointerInteraction();
  }
}

function onPointerEnd(evt) {
  const pointer = state.pointer;
  if (!pointer || evt.pointerId !== pointer.pointerId) return;
  try {
    cancelPointerInteraction();
    persistLayout();
  } catch (err) {
    logLabsError('pointer-end', err);
    cancelPointerInteraction();
  }
}

function startDrag(id, evt) {
  if (state.pointer) return;
  try {
    const spec = state.layout.get(id);
    const item = state.items.get(id);
    if (!spec || !item) return;
    const metrics = computeGridMetrics();
    state.pointer = {
      id,
      pointerId: evt.pointerId,
      type: 'drag',
      startX: evt.clientX,
      startY: evt.clientY,
      originX: spec.x,
      originY: spec.y,
      originW: spec.w,
      originH: spec.h,
      metrics
    };
    item.wrapper.classList.add('labs-grid-item--dragging');
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    evt.preventDefault();
  } catch (err) {
    logLabsError('start-drag', err);
    cancelPointerInteraction();
  }
}

function startResize(id, evt) {
  if (state.pointer) return;
  try {
    const spec = state.layout.get(id);
    const item = state.items.get(id);
    if (!spec || !item) return;
    const metrics = computeGridMetrics();
    state.pointer = {
      id,
      pointerId: evt.pointerId,
      type: 'resize',
      startX: evt.clientX,
      startY: evt.clientY,
      originX: spec.x,
      originY: spec.y,
      originW: spec.w,
      originH: spec.h,
      metrics
    };
    item.wrapper.classList.add('labs-grid-item--resizing');
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    evt.preventDefault();
  } catch (err) {
    logLabsError('start-resize', err);
    cancelPointerInteraction();
  }
}

function wirePointerControls(id, handle, resize) {
  if (handle) {
    handle.addEventListener('pointerdown', wrapHandler('labs-pointerdown-drag', evt => {
      if (evt.button !== 0 && evt.pointerType !== 'touch') return;
      startDrag(id, evt);
    }));
  }
  if (resize) {
    resize.addEventListener('pointerdown', wrapHandler('labs-pointerdown-resize', evt => {
      if (evt.button !== 0 && evt.pointerType !== 'touch') return;
      startResize(id, evt);
    }));
  }
}

function createGridItems(gridHost, entries, layout) {
  gridHost.innerHTML = '';
  state.items.clear();
  state.layout = layout;
  state.gridHost = gridHost;
  entries.forEach(({ id, spec, node }) => {
    if (!node) return;
    const placeholder = captureNode(node);
    if (!placeholder) {
      layout.delete(id);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.className = 'labs-grid-item';
    wrapper.dataset.widgetId = id;

    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'labs-drag-handle';
    handle.setAttribute('aria-label', 'Drag widget');
    handle.innerHTML = '<span aria-hidden="true">⠿</span>';

    const content = document.createElement('div');
    content.className = 'labs-grid-item-content';
    content.appendChild(node);

    const resize = document.createElement('button');
    resize.type = 'button';
    resize.className = 'labs-resize-handle';
    resize.setAttribute('aria-label', 'Resize widget');
    resize.innerHTML = '↘';

    wrapper.appendChild(handle);
    wrapper.appendChild(content);
    wrapper.appendChild(resize);
    gridHost.appendChild(wrapper);
    state.items.set(id, { wrapper, node, handle, resize });
    applySpecToElement(id);
    wirePointerControls(id, handle, resize);
  });
}

function resetLabsLayout() {
  cancelPointerInteraction();
  const defaults = new Map();
  DEFAULT_LAYOUT.forEach(spec => {
    if (!spec || !spec.id) return;
    defaults.set(spec.id, normalizeSpec(spec));
  });
  state.layout.forEach((_, id) => {
    const base = defaults.get(id);
    if (!base) return;
    const current = state.layout.get(id);
    if (!current) return;
    current.x = base.x;
    current.y = base.y;
    current.w = base.w;
    current.h = base.h;
    applySpecToElement(id);
  });
  clearStoredLayout();
}

function attachLabsEvents(shell) {
  const exitBtn = shell.querySelector('[data-labs-exit]');
  if (exitBtn) {
    exitBtn.addEventListener('click', wrapHandler('labs-exit', evt => {
      evt.preventDefault();
      deactivateLabs();
    }));
  }
  const resetBtn = shell.querySelector('[data-labs-reset]');
  if (resetBtn) {
    resetBtn.addEventListener('click', wrapHandler('labs-reset', evt => {
      evt.preventDefault();
      resetLabsLayout();
    }));
  }
}

function setupScopeControls(shell) {
  const host = shell.querySelector('[data-labs-scope]');
  if (!host) return;
  host.innerHTML = '';
  teardownScopeObserver();
  const baseToday = document.querySelector('[data-dashboard-mode="today"]');
  const baseAll = document.querySelector('[data-dashboard-mode="all"]');

  const createBtn = (label, target, mode) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'labs-scope-btn';
    btn.dataset.mode = mode;
    btn.textContent = label;
    btn.addEventListener('click', evt => {
      evt.preventDefault();
      if (target && typeof target.click === 'function') {
        target.click();
      }
    });
    host.appendChild(btn);
    return btn;
  };

  const todayBtn = createBtn('Today', baseToday, 'today');
  const allBtn = createBtn('All', baseAll, 'all');

  const update = () => {
    const todayActive = baseToday && baseToday.classList.contains('active');
    const allActive = baseAll && baseAll.classList.contains('active');
    todayBtn.classList.toggle('is-active', !!todayActive);
    allBtn.classList.toggle('is-active', !!allActive);
  };
  update();

  const observer = new MutationObserver(update);
  state.scopeObserver = observer;
  [baseToday, baseAll].forEach(node => {
    if (!node) return;
    observer.observe(node, { attributes: true, attributeFilter: ['class', 'aria-pressed'] });
  });
}

function restoreWidgets() {
  cancelPointerInteraction();
  state.items.forEach(({ node }) => {
    restoreNode(node);
  });
  state.items.clear();
  state.layout.clear();
  state.placeholders.clear();
  state.gridHost = null;
}

function activateLabs() {
  if (state.active) return;
  try {
    const main = document.querySelector('main[data-ui="dashboard-root"]');
    if (!main) return;
    const shell = ensureShell();
    if (!shell) return;
    const gridHost = shell.querySelector('[data-labs-grid]');
    if (!gridHost) return;
    const { entries, layout } = buildLayout();
    if (!entries.length) return;
    createGridItems(gridHost, entries, layout);
    setupScopeControls(shell);
    attachLabsEvents(shell);
    document.body.classList.add('labs-mode');
    const labsLink = document.querySelector('[data-dashboard-labs]');
    if (labsLink) {
      labsLink.classList.add('active');
      labsLink.setAttribute('aria-pressed', 'true');
    }
    state.active = true;
    updateLocationForLabs(true);
  } catch (err) {
    logLabsError('activate-labs', err);
    teardownScopeObserver();
    try {
      restoreWidgets();
    } catch (restoreErr) {
      logLabsError('restore-after-activate-failure', restoreErr);
    }
    if (state.shell) {
      state.shell.remove();
      state.shell = null;
    }
    document.body.classList.remove('labs-mode');
    const labsLink = document.querySelector('[data-dashboard-labs]');
    if (labsLink) {
      labsLink.classList.remove('active');
      labsLink.removeAttribute('aria-pressed');
    }
  }
}
  toggleList.addEventListener('change', (event) => {
    const input = event.target.closest('input[data-widget-toggle]');
    if (!input) return;
    const widgetId = input.dataset.widgetToggle;
    const widget = state.widgets.get(widgetId);
    if (!widget) return;
    const updatedWidget = { ...widget, active: input.checked };
    state.widgets.set(widgetId, updatedWidget);
    syncWidgetsWithGrid();
    if (shouldDisplayWidget(updatedWidget)) {
      updateSpotlight(widgetId);
    } else {
      updateSpotlight();
    }
  });

function teardownScopeObserver() {
  if (state.scopeObserver) {
    try { state.scopeObserver.disconnect(); }
    catch (_) {}
    state.scopeObserver = null;
  }
}

function deactivateLabs() {
  if (!state.active) return;
  try {
    teardownScopeObserver();
    restoreWidgets();
    if (state.shell) {
      state.shell.remove();
      state.shell = null;
    }
    document.body.classList.remove('labs-mode');
    const labsLink = document.querySelector('[data-dashboard-labs]');
    if (labsLink) {
      labsLink.classList.remove('active');
      labsLink.removeAttribute('aria-pressed');
    }
    state.active = false;
    updateLocationForLabs(false);
  } catch (err) {
    logLabsError('deactivate-labs', err);
  }
}

function syncLabsState() {
  try {
    const requested = isLabsRequested();
    if (requested && !state.active) {
      activateLabs();
    } else if (!requested && state.active) {
      deactivateLabs();
    }
  } catch (err) {
    logLabsError('sync-labs-state', err);
  }
}

function handleLabsLink(evt) {
  try {
    evt.preventDefault();
    if (state.active) return;
    try {
      const url = new URL(window.location.href);
      url.hash = 'labs';
      history.pushState(null, '', url.toString());
    } catch (_) {
      window.location.hash = 'labs';
    }
    syncLabsState();
  } catch (err) {
    logLabsError('labs-link', err);
  }
  scopeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      applyScope(button.dataset.labScope);
    });
  });

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tabTarget;
      if (!target) return;
      state.activeTab = target;
      tabs.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.tabTarget === target);
        btn.setAttribute('aria-selected', String(btn.dataset.tabTarget === target));
      });
      panels.forEach((panel) => {
        panel.classList.toggle('is-active', panel.id === `panel-${target}`);
      });
    });
  });
}

function hydrate() {
  initGrid();
  buildToggleList();
  applyScope(state.scopeMode);
  applyTheme(state.theme);
  applyDensity(state.density);
  applyChrome(state.chrome);
  wireEvents();
}

document.addEventListener('DOMContentLoaded', wrapHandler('labs-dom-ready', () => {
  const labsLink = document.querySelector('[data-dashboard-labs]');
  if (labsLink) {
    labsLink.addEventListener('click', wrapHandler('labs-link-click', handleLabsLink));
  }
  window.addEventListener('hashchange', wrapHandler('labs-hashchange', syncLabsState));
  window.addEventListener('popstate', wrapHandler('labs-popstate', syncLabsState));
  if (isLabsRequested()) {
    syncLabsState();
  }
}));

export { activateLabs, deactivateLabs };
