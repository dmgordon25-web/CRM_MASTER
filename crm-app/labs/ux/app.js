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

let gridInstance = null;

function initGrid() {
  gridInstance = GridStack.init(
    {
      column: state.columns,
      cellHeight: state.cellHeight,
      margin: THEMES[state.theme]?.spacing ?? 12,
      disableOneColumnMode: true,
      float: !state.autoStack,
      animate: true,
      resizable: { handles: 'e, se, s' },
      dragOut: true,
    },
    gridElement,
  );
}

function renderWidgetCard(widget) {
  const item = document.createElement('div');
  item.className = 'grid-stack-item lab-card';
  item.dataset.widgetId = widget.id;
  item.setAttribute('gs-id', widget.id);

  const content = document.createElement('div');
  content.className = 'grid-stack-item-content';
  content.innerHTML = `
    <header>
      <div class="title-block">
        <div class="lab-chip">${widget.accent} ${widget.title}</div>
        <span>${widget.caption}</span>
      </div>
      <div class="lab-pill-group">
        ${widget.chips.map((chip) => `<span class="lab-pill">${chip}</span>`).join('')}
      </div>
    </header>
    <div class="lab-card__body">${widget.body()}</div>
  `;

  content.querySelectorAll('.lab-pill, .lab-chip, .lab-data-row').forEach((element) => {
    element.addEventListener('mouseenter', () => updateSpotlight(widget.id));
    element.addEventListener('focus', () => updateSpotlight(widget.id));
  });

  item.appendChild(content);
  return item;
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

  activeWidgets.forEach((widget) => {
    if (existingItems.has(widget.id)) return;
    const card = renderWidgetCard(widget);
    const options = { ...widget.layout, id: widget.id, autoPosition: true };
    gridInstance.addWidget(card, options);
    hookCardEvents(card, widget.id);
  });

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

function buildToggleList() {
  toggleList.innerHTML = '';
  state.widgets.forEach((widget) => {
    const row = document.createElement('label');
    row.className = 'lab-toggle';
    row.dataset.widgetId = widget.id;
    row.innerHTML = `
      <div>
        <strong>${widget.title}</strong>
        <span>${widget.caption}</span>
      </div>
      <input type="checkbox" data-widget-toggle="${widget.id}" ${widget.active ? 'checked' : ''} />
    `;
    row.addEventListener('mouseenter', () => updateSpotlight(widget.id));
    row.addEventListener('focusin', () => updateSpotlight(widget.id));
    toggleList.appendChild(row);
  });
}

function updateSpotlight(widgetId) {
  const widget = widgetId ? state.widgets.get(widgetId) : null;
  const target = widget?.spotlight;
  if (!target) {
    spotlight.innerHTML = `
      <div class="lab-spotlight__badge">Experiment</div>
      <h3>Pick a widget to inspect</h3>
      <p>Hover cards or toggles to preview why they matter. The spotlight calls out how CRM data powers the widget.</p>
    `;
    return;
  }

  spotlight.innerHTML = `
    <div class="lab-spotlight__badge">${target.badge}</div>
    <h3>${target.title}</h3>
    <p>${target.description}</p>
    <ul>
      ${target.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}
    </ul>
  `;
}

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  const themeMeta = THEMES[theme];
  if (gridInstance && themeMeta) {
    gridInstance.margin(themeMeta.spacing);
  }
}

function applyDensity(density) {
  state.density = density;
  root.dataset.density = density;
}

function applyChrome(chrome) {
  state.chrome = chrome;
  root.dataset.chrome = chrome;
}

function applyColumns(columns) {
  state.columns = columns;
  if (gridInstance) {
    gridInstance.column(columns);
  }
}

function applyCellHeight(value) {
  state.cellHeight = value;
  if (gridInstance) {
    gridInstance.cellHeight(value);
  }
  if (cellHeightCaption) {
    cellHeightCaption.textContent = `${value}px`;
  }
}

function applyAutoStack(enabled) {
  state.autoStack = enabled;
  if (gridInstance) {
    gridInstance.float(!enabled);
  }
}

function resetLayout() {
  state.widgets.forEach((widget, id) => {
    state.widgets.set(id, { ...widget, active: widget.defaultActive !== false });
  });
  buildToggleList();
  if (gridInstance) {
    gridInstance.removeAll();
  }
  syncWidgetsWithGrid();
  updateSpotlight();
  if (gridInstance) {
    const { spacing } = THEMES[state.theme] ?? { spacing: 12 };
    gridInstance.margin(spacing);
  }
}

function captureSnapshot() {
  if (!gridInstance) return;
  const snapshot = gridInstance.save(false);
  const summary = snapshot
    .map((node) => `${node.id ?? node._id}: (${node.x},${node.y}) ${node.w}×${node.h}`)
    .join('<br>');
  spotlight.innerHTML = `
    <div class="lab-spotlight__badge">Layout saved</div>
    <h3>Session snapshot captured</h3>
    <p>The positions below hold until you refresh. Share the configuration with your team for feedback.</p>
    <p class="lab-muted">${summary}</p>
  `;
  gridElement.querySelectorAll('.grid-stack-item.lab-card').forEach((card) => {
    card.classList.add('is-saving');
    window.setTimeout(() => card.classList.remove('is-saving'), 1200);
  });
}

function wireEvents() {
  themeSelect.addEventListener('change', (event) => {
    applyTheme(event.target.value);
  });

  densitySelect.addEventListener('change', (event) => {
    applyDensity(event.target.value);
  });

  chromeSelect.addEventListener('change', (event) => {
    applyChrome(event.target.value);
  });

  columnsRange.addEventListener('input', (event) => {
    const value = Number.parseInt(event.target.value, 10) || state.columns;
    applyColumns(value);
  });

  cellHeightRange.addEventListener('input', (event) => {
    const value = Number.parseInt(event.target.value, 10) || state.cellHeight;
    applyCellHeight(value);
  });

  autoStackCheckbox.addEventListener('change', (event) => {
    applyAutoStack(event.target.checked);
  });

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

  resetButton.addEventListener('click', () => {
    resetLayout();
  });

  saveButton.addEventListener('click', () => {
    captureSnapshot();
  });

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

hydrate();
