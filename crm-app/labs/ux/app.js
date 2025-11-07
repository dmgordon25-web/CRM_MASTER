import { GridStack } from 'https://cdn.jsdelivr.net/npm/gridstack@9.3.0/dist/gridstack-all.esm.min.js';

// ============================================================================
// DATABASE & DATA INTEGRATION
// ============================================================================

let db = null;
const DAY_MS = 86400000;
const PARTNER_NONE_ID = '00000000-0000-none-partner-000000000000';

// Open IndexedDB connection
async function openDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('CRM', 1);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

// Get all records from a store
async function dbGetAll(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Normalize contact data
function normalizeContact(raw) {
  if (!raw || !raw.id) return null;
  return {
    id: raw.id,
    firstName: raw.firstName || '',
    lastName: raw.lastName || '',
    email: raw.email || '',
    phone: raw.phone || '',
    stage: raw.stage || raw.status || 'lead',
    lane: raw.lane || raw.stage || 'lead',
    loanType: raw.loanType || '',
    loanAmount: Number(raw.loanAmount || 0),
    partners: Array.isArray(raw.partners) ? raw.partners : [],
    createdTs: raw.createdTs || raw.created || Date.now(),
    fundedTs: raw.fundedTs || raw.funded || null,
    stageMap: raw.stageMap || {},
    deleted: raw.deleted || false,
    raw
  };
}

// Normalize partner data
function normalizePartner(raw) {
  if (!raw || !raw.id) return null;
  return {
    id: raw.id,
    name: raw.name || raw.company || '',
    company: raw.company || '',
    tier: raw.tier || '',
    email: raw.email || '',
    phone: raw.phone || '',
    raw
  };
}

// Normalize task data
function normalizeTask(raw) {
  if (!raw || !raw.id) return null;
  const dueDate = raw.due ? new Date(raw.due) : null;
  return {
    id: raw.id,
    title: raw.title || raw.name || '',
    contactId: raw.contactId || raw.contact || null,
    due: dueDate,
    dueTs: dueDate ? dueDate.getTime() : null,
    done: raw.done || raw.completed || false,
    raw
  };
}

// Get display name for contact
function displayName(contact) {
  if (!contact) return 'Unknown';
  const first = contact.firstName || '';
  const last = contact.lastName || '';
  if (first && last) return `${first} ${last}`;
  if (first) return first;
  if (last) return last;
  return contact.email || contact.phone || 'Unknown';
}

// Format time for display
function formatTime(date) {
  if (!date) return '';
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'p' : 'a';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
  return `${displayHours}:${displayMinutes}${ampm}`;
}

// Format currency
function formatCurrency(amount) {
  if (!amount) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

// Start of day
function startOfDay(date) {
  if (!date) return null;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Data state
const dataState = {
  contacts: [],
  contactMap: new Map(),
  partners: [],
  partnerMap: new Map(),
  tasks: [],
  aggregates: null,
  loading: false
};

// Load all data from IndexedDB
async function loadData() {
  if (dataState.loading) return;
  dataState.loading = true;

  try {
    const [contactsRaw, partnersRaw, tasksRaw] = await Promise.all([
      dbGetAll('contacts'),
      dbGetAll('partners'),
      dbGetAll('tasks')
    ]);

    dataState.contacts = (contactsRaw || []).map(normalizeContact).filter(Boolean);
    dataState.contactMap = new Map(dataState.contacts.map(c => [c.id, c]));
    dataState.partners = (partnersRaw || []).map(normalizePartner).filter(Boolean);
    dataState.partnerMap = new Map(dataState.partners.map(p => [p.id, p]));
    dataState.tasks = (tasksRaw || []).map(normalizeTask).filter(Boolean);

    // Build aggregates
    dataState.aggregates = buildDashboardAggregates();
    console.log('Data loaded:', dataState.aggregates);
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    dataState.loading = false;
  }
}

// Build dashboard aggregates
function buildDashboardAggregates() {
  const contacts = dataState.contacts.filter(c => !c.deleted);
  const tasks = dataState.tasks.filter(t => !t.done);
  const now = new Date();
  const today = startOfDay(now);
  const todayTs = today ? today.getTime() : Date.now();
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
  const sevenDaysAgo = now.getTime() - (7 * DAY_MS);

  // Pipeline stages
  const PIPELINE_LANES = ['lead', 'long-shot', 'application', 'preapproved', 'processing', 'underwriting', 'clear-to-close'];

  let kpiNewLeads7d = 0;
  let kpiActivePipeline = 0;
  const pipelineCounts = {};
  const ytdFunded = [];
  const staleDeals = [];
  const partnerStats = new Map();

  contacts.forEach(contact => {
    const created = contact.createdTs || 0;
    if (created >= sevenDaysAgo) kpiNewLeads7d += 1;

    const lane = contact.lane;
    pipelineCounts[lane] = (pipelineCounts[lane] || 0) + 1;

    if (PIPELINE_LANES.includes(lane)) {
      kpiActivePipeline += 1;

      // Check for stale deals (no movement in 14+ days)
      const stageTs = contact.stageMap?.[lane] || contact.createdTs;
      if (stageTs) {
        const days = Math.floor((todayTs - stageTs) / DAY_MS);
        if (days > 14) {
          staleDeals.push({ contact, days });
        }
      }
    }

    if (contact.fundedTs && contact.fundedTs >= yearStart) {
      ytdFunded.push(contact);
    }

    // Partner stats
    const partnerIds = contact.partners || [];
    if (partnerIds.length) {
      const isActive = PIPELINE_LANES.includes(lane);
      const isFundedYtd = contact.fundedTs && contact.fundedTs >= yearStart;
      const amount = contact.loanAmount || 0;

      partnerIds.forEach(pid => {
        if (!pid || pid === PARTNER_NONE_ID) return;
        const stat = partnerStats.get(pid) || { id: pid, total: 0, active: 0, funded: 0, volume: 0 };
        stat.total += 1;
        if (isActive) stat.active += 1;
        if (isFundedYtd) {
          stat.funded += 1;
          stat.volume += amount;
        }
        partnerStats.set(pid, stat);
      });
    }
  });

  // Task groups
  const dueToday = [];
  const overdue = [];

  tasks.forEach(task => {
    if (!task.due) return;
    const dueStart = startOfDay(task.due);
    if (!dueStart) return;
    const diff = Math.floor((dueStart.getTime() - todayTs) / DAY_MS);
    if (diff === 0) dueToday.push(task);
    else if (diff < 0) overdue.push(task);
  });

  const dueTodaySorted = dueToday.sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)).slice(0, 10);

  // Recent leads
  const recentLeads = contacts
    .filter(c => c.createdTs && PIPELINE_LANES.includes(c.lane))
    .sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0))
    .slice(0, 5);

  // Leaderboard
  const leaderboard = Array.from(partnerStats.values())
    .map(stat => {
      const partner = dataState.partnerMap.get(stat.id) || { name: 'Partner' };
      return {
        id: stat.id,
        name: partner.name || 'Partner',
        tier: partner.tier || '',
        volume: stat.volume,
        fundedCount: stat.funded,
        activeCount: stat.active,
        totalCount: stat.total
      };
    })
    .sort((a, b) => b.fundedCount - a.fundedCount || b.volume - a.volume);

  staleDeals.sort((a, b) => b.days - a.days);

  const fundedVolumeYtd = ytdFunded.reduce((sum, c) => sum + (c.loanAmount || 0), 0);

  return {
    contacts,
    tasks,
    pipelineCounts,
    ytdFunded,
    staleDeals,
    leaderboard,
    focus: {
      tasksToday: dueTodaySorted,
      recentLeads
    },
    kpis: {
      kpiNewLeads7d,
      kpiActivePipeline,
      kpiFundedYTD: ytdFunded.length,
      kpiFundedVolumeYTD: fundedVolumeYtd,
      kpiTasksToday: dueToday.length,
      kpiTasksOverdue: overdue.length
    }
  };
}

// ============================================================================
// WIDGET DEFINITIONS WITH REAL DATA
// ============================================================================

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

const THEMES = {
  ocean: { label: 'Ocean Breeze', spacing: 12 },
  midnight: { label: 'Midnight Neon', spacing: 18 },
  sunrise: { label: 'Sunrise Canyon', spacing: 16 },
};

// Widget definitions with real data rendering
const defaultWidgetLayout = [
  {
    id: 'focus',
    title: 'Focus Today',
    caption: 'High-impact follow-ups ready now',
    layout: { x: 0, y: 0, w: 4, h: 4 },
    defaultActive: true,
    accent: '🎯',
    chips: ['Urgent Calls', 'Lock Expiring', 'Docs Needed'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const tasks = data.focus.tasksToday || [];
      if (tasks.length === 0) {
        return '<div class="lab-empty">No tasks due today</div>';
      }

      const rows = tasks.map(task => {
        const contact = dataState.contactMap.get(task.contactId);
        const name = contact ? displayName(contact) : 'Unknown';
        const time = task.due ? formatTime(task.due) : '';
        return `<div class="lab-data-row"><span>${task.title} — <strong>${name}</strong></span><span>Due ${time}</span></div>`;
      }).join('');

      return `<div class="lab-data-list">${rows}</div>`;
    },
    spotlight: {
      badge: 'Focus',
      title: 'Prioritize what matters today',
      description: 'Shows tasks due today from your CRM, sorted by time. Stay on top of your most important work.',
      bullets: ['Auto refreshes with every status change', 'Actions sync instantly with Tasks module', 'Sorted by due time'],
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
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const counts = data.pipelineCounts || {};
      const stages = [
        { key: 'lead', label: 'New Leads' },
        { key: 'application', label: 'In Application' },
        { key: 'processing', label: 'In Processing' },
        { key: 'underwriting', label: 'Underwriting' },
        { key: 'clear-to-close', label: 'Clear to Close' }
      ];

      const rows = stages
        .filter(stage => (counts[stage.key] || 0) > 0)
        .map(stage => `<div class="lab-data-row"><strong>${counts[stage.key] || 0}</strong><span>${stage.label}</span></div>`)
        .join('');

      if (!rows) {
        return '<div class="lab-empty">No active pipeline</div>';
      }

      return `
        <div class="lab-data-list">${rows}</div>
        <div class="lab-pill-group">
          <span class="lab-pill">📊 ${data.kpis.kpiActivePipeline} total active</span>
        </div>
      `;
    },
    spotlight: {
      badge: 'Pipeline',
      title: 'Real-time funnel health',
      description: 'See exactly how many deals are in each stage of your pipeline. Spot bottlenecks instantly.',
      bullets: ['Stage velocity indicators', 'Real-time counts from CRM', 'Active pipeline totals'],
    },
  },
  {
    id: 'leaderboard',
    title: 'Referral Leaderboard',
    caption: 'Who is sending business this week',
    layout: { x: 8, y: 0, w: 4, h: 4 },
    defaultActive: true,
    accent: '🏅',
    chips: ['YTD', 'Partner Health'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const leaders = (data.leaderboard || []).slice(0, 5);
      if (leaders.length === 0) {
        return '<div class="lab-empty">No partner referrals yet</div>';
      }

      const rows = leaders.map(leader => {
        return `<div class="lab-data-row"><span><strong>${leader.name}</strong></span><span>${leader.fundedCount} funded</span></div>`;
      }).join('');

      return `<div class="lab-data-list">${rows}</div>`;
    },
    spotlight: {
      badge: 'Partners',
      title: 'Celebrate top partners instantly',
      description: 'See which partners have sent you the most funded loans this year. Build stronger relationships.',
      bullets: ['YTD funded loan counts', 'Sorted by performance', 'Real-time partner data'],
    },
  },
  {
    id: 'kpis',
    title: 'Production KPIs',
    caption: 'Year-to-date performance',
    layout: { x: 0, y: 4, w: 3, h: 3 },
    defaultActive: true,
    accent: '📈',
    chips: ['YTD', 'Goal Tracking'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const kpis = data.kpis || {};
      return `
        <div class="lab-data-list">
          <div class="lab-data-row"><span>Funded YTD</span><strong>${kpis.kpiFundedYTD || 0} loans</strong></div>
          <div class="lab-data-row"><span>Funded Volume YTD</span><strong>${formatCurrency(kpis.kpiFundedVolumeYTD || 0)}</strong></div>
          <div class="lab-data-row"><span>Active Pipeline</span><strong>${kpis.kpiActivePipeline || 0} loans</strong></div>
          <div class="lab-data-row"><span>New Leads (7d)</span><strong>${kpis.kpiNewLeads7d || 0}</strong></div>
        </div>
      `;
    },
    spotlight: {
      badge: 'KPIs',
      title: 'Visualize growth goals',
      description: 'Key performance indicators showing your year-to-date production and recent activity.',
      bullets: ['Funded loans and volume', 'Active pipeline count', 'Recent lead generation'],
    },
  },
  {
    id: 'today',
    title: 'Today\'s Work',
    caption: 'Tasks and action items',
    layout: { x: 3, y: 4, w: 5, h: 3 },
    defaultActive: true,
    accent: '✅',
    chips: ['Tasks', 'Due Today'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const kpis = data.kpis || {};
      const dueToday = kpis.kpiTasksToday || 0;
      const overdue = kpis.kpiTasksOverdue || 0;

      return `
        <div class="lab-data-list">
          <div class="lab-data-row"><span>Tasks Due Today</span><strong>${dueToday}</strong></div>
          <div class="lab-data-row"><span>Overdue Tasks</span><strong class="${overdue > 0 ? 'text-warning' : ''}">${overdue}</strong></div>
        </div>
        ${overdue > 0 ? '<div class="lab-pill-group"><span class="lab-pill">⚠️ Action required</span></div>' : ''}
      `;
    },
    spotlight: {
      badge: 'Today',
      title: 'Stay on top of your day',
      description: 'Quick summary of tasks due today and any overdue items that need attention.',
      bullets: ['Tasks due today', 'Overdue task alerts', 'Action required indicators'],
    },
  },
  {
    id: 'stale',
    title: 'Stale Loans Radar',
    caption: 'Deals without movement in 14+ days',
    layout: { x: 8, y: 4, w: 4, h: 3 },
    defaultActive: true,
    accent: '🧭',
    chips: ['Aging', 'At Risk'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const stale = (data.staleDeals || []).slice(0, 5);
      if (stale.length === 0) {
        return '<div class="lab-empty">No stale deals — great work!</div>';
      }

      const rows = stale.map(item => {
        const name = displayName(item.contact);
        const stage = item.contact.stage || 'Unknown';
        return `<div class="lab-data-row"><span><strong>${name}</strong> — ${stage}</span><span>${item.days} days</span></div>`;
      }).join('');

      return `
        <div class="lab-data-list">${rows}</div>
        <div class="lab-pill-group">
          <span class="lab-pill">🚨 ${stale.length} need attention</span>
        </div>
      `;
    },
    spotlight: {
      badge: 'Risk',
      title: 'Catch silent deals',
      description: 'Loans that haven\'t moved stages in 14+ days. Take action before they fall through.',
      bullets: ['Auto-detection of stale deals', 'Sorted by age', 'Prevent deal fallout'],
    },
  },
  {
    id: 'recent',
    title: 'Recent Leads',
    caption: 'Latest leads in your pipeline',
    layout: { x: 0, y: 7, w: 6, h: 3 },
    defaultActive: true,
    accent: '🆕',
    chips: ['New Leads'],
    body: () => {
      const data = dataState.aggregates;
      if (!data) return '<div class="lab-loading">Loading...</div>';

      const leads = data.focus.recentLeads || [];
      if (leads.length === 0) {
        return '<div class="lab-empty">No recent leads</div>';
      }

      const rows = leads.map(contact => {
        const name = displayName(contact);
        const stage = contact.stage || 'lead';
        const amount = contact.loanAmount ? formatCurrency(contact.loanAmount) : '';
        return `<div class="lab-data-row"><span><strong>${name}</strong> — ${stage}</span><span>${amount}</span></div>`;
      }).join('');

      return `<div class="lab-data-list">${rows}</div>`;
    },
    spotlight: {
      badge: 'Leads',
      title: 'Latest opportunities',
      description: 'Your most recent leads sorted by creation date. Stay on top of new business.',
      bullets: ['Newest leads first', 'Loan amounts shown', 'Current stage displayed'],
    },
  },
  {
    id: 'timeline',
    title: 'Activity Timeline',
    caption: 'Coming soon: Live feed of CRM activity',
    layout: { x: 6, y: 7, w: 6, h: 3 },
    defaultActive: false,
    accent: '⏱️',
    chips: ['Coming Soon'],
    body: () => {
      return `
        <div class="lab-empty">
          Activity timeline will show real-time CRM updates, task completions, and stage changes.
        </div>
      `;
    },
    spotlight: {
      badge: 'Timeline',
      title: 'Unified activity stream',
      description: 'Future feature: Real-time activity feed showing all CRM updates and changes.',
      bullets: ['Task completions', 'Stage changes', 'Contact updates'],
    },
  },
];

const state = {
  theme: 'ocean',
  density: 'normal',
  chrome: 'elevated',
  columns: 12,
  cellHeight: 96,
  autoStack: true,
  activeTab: 'dashboard',
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

function syncWidgetsWithGrid() {
  if (!gridInstance) return;

  const activeWidgets = Array.from(state.widgets.values()).filter((widget) => widget.active);
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

  existingItems.forEach((element, widgetId) => {
    if (state.widgets.get(widgetId)?.active) return;
    gridInstance.removeWidget(element);
  });
}

function hookCardEvents(card, widgetId) {
  const header = card.querySelector('header');
  if (header) {
    header.addEventListener('mouseenter', () => updateSpotlight(widgetId));
  }
}

function updateSpotlight(widgetId) {
  const widget = state.widgets.get(widgetId);
  if (!widget || !widget.spotlight) return;

  const { badge, title, description, bullets } = widget.spotlight;
  spotlight.innerHTML = `
    <div class="lab-spotlight__badge">${badge}</div>
    <h3>${title}</h3>
    <p>${description}</p>
    <ul>
      ${bullets.map((bullet) => `<li>${bullet}</li>`).join('')}
    </ul>
  `;
}

function refreshWidgets() {
  if (!gridInstance) return;

  // Re-render all active widgets with fresh data
  gridElement.querySelectorAll('.grid-stack-item.lab-card').forEach((item) => {
    const widgetId = item.dataset.widgetId;
    const widget = state.widgets.get(widgetId);
    if (!widget) return;

    const bodyElement = item.querySelector('.lab-card__body');
    if (bodyElement) {
      bodyElement.innerHTML = widget.body();
    }
  });
}

function renderWidgetToggles() {
  toggleList.innerHTML = Array.from(state.widgets.values())
    .map((widget) => {
      const isActive = widget.active ? 'checked' : '';
      return `
        <label class="lab-toggle">
          <input type="checkbox" data-widget-id="${widget.id}" ${isActive} />
          <span>${widget.accent} ${widget.title}</span>
        </label>
      `;
    })
    .join('');

  toggleList.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', (event) => {
      const widgetId = event.target.getAttribute('data-widget-id');
      const widget = state.widgets.get(widgetId);
      if (widget) {
        widget.active = event.target.checked;
        syncWidgetsWithGrid();
      }
    });
  });
}

function applyTheme(theme) {
  state.theme = theme;
  root.dataset.theme = theme;
  if (gridInstance) {
    gridInstance.margin(THEMES[theme]?.spacing ?? 12);
  }
}

function applyDensity(density) {
  state.density = density;
  root.dataset.density = density;
}

function applyChromeStyle(chromeStyle) {
  state.chrome = chromeStyle;
  root.dataset.chrome = chromeStyle;
}

function applyColumns(columns) {
  state.columns = columns;
  if (gridInstance) {
    gridInstance.column(columns);
  }
}

function applyCellHeight(cellHeight) {
  state.cellHeight = cellHeight;
  if (cellHeightCaption) {
    cellHeightCaption.textContent = `${cellHeight}px`;
  }
  if (gridInstance) {
    gridInstance.cellHeight(cellHeight);
  }
}

function applyAutoStack(autoStack) {
  state.autoStack = autoStack;
  if (gridInstance) {
    gridInstance.float(!autoStack);
  }
}

function switchTab(targetTab) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tabTarget === targetTab;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  panels.forEach((panel) => {
    const isActive = panel.id === `panel-${targetTab}`;
    panel.classList.toggle('is-active', isActive);
  });
  state.activeTab = targetTab;
}

function resetLayout() {
  if (!gridInstance) return;
  gridInstance.removeAll();
  state.widgets = new Map(defaultWidgetLayout.map((w) => [w.id, { ...w, active: w.defaultActive !== false }]));
  renderWidgetToggles();
  syncWidgetsWithGrid();
}

function saveLayout() {
  const layout = [];
  gridElement.querySelectorAll('.grid-stack-item').forEach((el) => {
    const widgetId = el.dataset.widgetId;
    const gsItem = el.gridstackNode;
    if (gsItem) {
      layout.push({
        id: widgetId,
        x: gsItem.x,
        y: gsItem.y,
        w: gsItem.w,
        h: gsItem.h,
      });
    }
  });
  console.log('Layout saved:', layout);
  alert('Layout saved to console (storage not implemented in prototype)');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
  console.log('Initializing Labs Dashboard...');

  // Load data first
  await loadData();

  // Initialize grid
  initGrid();
  renderWidgetToggles();
  syncWidgetsWithGrid();

  // Set up event listeners
  themeSelect?.addEventListener('change', (e) => applyTheme(e.target.value));
  densitySelect?.addEventListener('change', (e) => applyDensity(e.target.value));
  chromeSelect?.addEventListener('change', (e) => applyChromeStyle(e.target.value));
  columnsRange?.addEventListener('input', (e) => applyColumns(Number(e.target.value)));
  cellHeightRange?.addEventListener('input', (e) => applyCellHeight(Number(e.target.value)));
  autoStackCheckbox?.addEventListener('change', (e) => applyAutoStack(e.target.checked));
  resetButton?.addEventListener('click', resetLayout);
  saveButton?.addEventListener('click', saveLayout);

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tabTarget;
      if (target) switchTab(target);
    });
  });

  // Refresh widgets every 30 seconds
  setInterval(async () => {
    await loadData();
    refreshWidgets();
  }, 30000);

  console.log('Labs Dashboard initialized with real data!');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
