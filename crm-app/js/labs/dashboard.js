// Labs CRM Dashboard - Canonical mirror with modern UI shell

import {
  ensureDatabase,
  buildLabsModel,
  formatNumber,
  countTodayTasks,
  countOverdueTasks,
  groupByStage,
  normalizeStagesForDisplay,
  computeStaleSummary
} from './data.js';
import { CRM_WIDGET_RENDERERS, WIDGET_META } from './crm_widgets.js';
import { makeDraggableGrid, makeResizableGrid } from './drag_lab.js';
import {
  applyPresetToSection,
  loadSectionLayout,
  resetSectionLayout,
  saveSectionLayout
} from './layout_state.js';
import openAnalyticsDrilldown from './analytics_drilldown.js';
import openPortfolioDrilldown from './portfolio_drilldown.js';
import { emitLabsEvent, onLabsEvent } from './labs_events.js';
import { DASH_TO_LABS_WIDGET_MAP } from './widget_parity_map.js';
import { getUiMode } from '../ui/ui_mode.js';
import { enableVNextGrid } from './vnext.js';
import { initActionBarDrag, teardownActionBarWiring } from '../ui/action_bar.js';
import { DEFAULT_VNEXT_LAYOUTS, DEFAULT_WIDGETS_BY_SECTION } from './vnext_defaults.js';
import { safeRenderWidget } from './helpers/widget_safety.js';

const USE_VNEXT_KEY = 'labs.vnext.enabled';
const VNEXT_STORAGE_PREFIX = 'labs.vnext.layout.';
const isVNextEnabled = () => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const engine = params.get('engine');
    if (engine === 'vnext') return true;
    if (engine === 'classic' || engine === 'legacy') return false;
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(USE_VNEXT_KEY);
      if (stored === 'false') return false;
      if (stored === 'true') return true;
      if (stored === null) return true;
    }
  }
  return true;
};

const LABS_DEBUG = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('labsDebug') === '1'
  : false;

let dashboardRoot = null;
let labsModel = null;
let activeSection = 'overview';
let navClickHandler = null;
let dataChangedHandler = null;
let customizeChangeHandler = null;
let presetChangeHandler = null;
let labsEventUnsubscribers = [];
let refreshThrottleTimer = null;
let labsLayoutEditMode = false;
const labsDragControllers = new Map();
const labsResizeControllers = new Map();
const openCustomizerSections = new Set();
const sectionLayoutCache = new Map();

const WIDTH_TOKENS = ['w1', 'w2', 'w3'];
const SIZE_TO_WIDTH = {
  small: 'w1',
  medium: 'w2',
  large: 'w3'
};

const WIDGET_LABELS = {
  labsKpiSummary: 'Snapshot KPIs',
  labsPipelineSnapshot: 'Pipeline Snapshot',
  goalProgress: 'Production Goals',
  labsTasks: 'Tasks Due',
  today: 'Today\'s Work',
  todo: 'To-do List',
  favorites: 'Favorites',
  priorityActions: 'Priority Actions',
  milestones: 'Milestones',
  upcomingCelebrations: 'Upcoming Celebrations',
  partnerPortfolio: 'Partner Portfolio',
  referralLeaderboard: 'Referral Leaderboard',
  referralTrends: 'Referral Trends',
  numbersMomentum: 'Pipeline Momentum',
  pipelineMomentum: 'Pipeline Momentum',
  pipelineFunnel: 'Pipeline Funnel',
  pipelineVelocity: 'Pipeline Velocity',
  pipelineRisk: 'Pipeline Risk',
  relationshipOpportunities: 'Relationship Opportunities',
  closingWatch: 'Closing Watch',
  staleDeals: 'Stale Deals',
  pipelineCalendar: 'Pipeline Calendar',
  docPulse: 'Document Pulse'
};

function normalizeStageCountMap(counts = {}) {
  const normalized = {};
  Object.entries(counts).forEach(([stage, raw]) => {
    const key = normalizeStagesForDisplay(stage);
    if (!key) return;
    const value = Number(raw) || 0;
    normalized[key] = (normalized[key] || 0) + value;
  });
  return normalized;
}

function runLabsParityDiagnostics(model) {
  if (!LABS_DEBUG && !model) return;
  try {
    // 1. Hard QA Gate: Zero-Unknown Contract
    // Scan the entire Labs container for forbidden text
    if (dashboardRoot) {
      const pageText = dashboardRoot.innerText || '';
      if (pageText.includes('(Unknown contact)') || pageText.includes('Unknown contact')) {
        console.error('❌ [Labs QA] Zero-Unknown Contract violated! Found "Unknown contact" in rendered output.');
        if (typeof window !== 'undefined' && window.alert && LABS_DEBUG) {
          // alert('Labs Zero-Unknown Contract Violated!');
        }
      } else {
        console.info('✅ [Labs QA] Zero-Unknown Contract passed (text scan).');
      }
    }

    // 2. Data Contract Check
    // Ensure no tasks or pipeline items in the model have "Unknown" names that slipped through
    const invalidTasks = (model.tasks || []).filter(t => t.contactName === 'Unknown contact' || (t.contactName && t.contactName.includes('Unknown contact')));
    if (invalidTasks.length > 0) {
      console.error('❌ [Labs QA] Model contains tasks with Unknown contact name:', invalidTasks.length);
    }
    const invalidPipeline = (model.pipeline || []).filter(p => !p.borrowerName || p.borrowerName.includes('Unknown contact'));
    if (invalidPipeline.length > 0) {
      console.error('❌ [Labs QA] Model contains pipeline items with Unknown borrower name:', invalidPipeline.length);
    }

    const mappedEntries = DASH_TO_LABS_WIDGET_MAP.filter((entry) => entry.status === 'mapped' && entry.labsId);
    const missingRenderers = mappedEntries.filter((entry) => !CRM_WIDGET_RENDERERS[entry.labsId]);
    if (missingRenderers.length) {
      console.warn('[labs:parity] Missing Renderers', missingRenderers);
    }

    const snapshotStageCounts = normalizeStageCountMap(model.snapshot?.pipelineCounts || {});
    const derivedStageGroups = groupByStage(model.contacts || []);
    const stageDiffs = [];

    Object.entries(snapshotStageCounts).forEach(([stage, value]) => {
      const derived = Array.isArray(derivedStageGroups[stage])
        ? derivedStageGroups[stage].length
        : Number(derivedStageGroups[stage] || 0);
      if (Math.abs(value - derived) > 0) {
        stageDiffs.push({ stage, snapshot: value, derived });
      }
    });

    Object.entries(derivedStageGroups).forEach(([stageKey, group]) => {
      const stage = normalizeStagesForDisplay(stageKey);
      if (!stage || snapshotStageCounts.hasOwnProperty(stage)) return;
      const derived = Array.isArray(group) ? group.length : Number(group || 0);
      if (derived > 0) {
        stageDiffs.push({ stage, snapshot: 0, derived });
      }
    });

    const taskDiffs = [];
    const todayCount = countTodayTasks(model.tasks || []);
    const overdueCount = countOverdueTasks(model.tasks || []);
    const kpiToday = Number(model.snapshot?.kpis?.kpiTasksToday);
    const kpiOverdue = Number(model.snapshot?.kpis?.kpiTasksOverdue);

    if (Number.isFinite(kpiToday) && kpiToday !== todayCount) {
      taskDiffs.push({ metric: 'tasksToday', snapshot: kpiToday, derived: todayCount });
    }
    if (Number.isFinite(kpiOverdue) && kpiOverdue !== overdueCount) {
      taskDiffs.push({ metric: 'tasksOverdue', snapshot: kpiOverdue, derived: overdueCount });
    }

    const staleDiffs = [];
    const staleFromModel = model.analytics?.staleSummary || {};
    const staleDerived = computeStaleSummary(model.activePipeline || model.contacts || []);
    Object.keys({ ...staleFromModel, ...staleDerived }).forEach((bucket) => {
      const snapshotVal = Number(staleFromModel[bucket] || 0);
      const derivedVal = Number(staleDerived[bucket] || 0);
      if (Math.abs(snapshotVal - derivedVal) > 0) {
        staleDiffs.push({ bucket, snapshot: snapshotVal, derived: derivedVal });
      }
    });

    // Top-N record ID comparison
    const idDiffs = [];

    // Helper: compare top-N IDs between derived and snapshot lists
    const compareTopNIds = (derivedList, snapshotList, n, label) => {
      const derivedIds = (derivedList || []).slice(0, n).map((item) => item?.id || item?.contactId).filter(Boolean);
      const snapshotIds = (snapshotList || []).slice(0, n).map((item) => item?.id || item?.contactId).filter(Boolean);
      derivedIds.forEach((id, idx) => {
        const snapId = snapshotIds[idx];
        if (snapId !== id) {
          const isSeed = String(id).startsWith('seed-') || String(snapId).startsWith('seed-');
          if (isSeed) return;
          idDiffs.push({ label, index: idx, derived: id, snapshot: snapId || null });
        }
      });
    };

    // Overdue tasks: compare top 5 IDs
    const overdueTasks = (model.tasks || []).filter((t) => {
      const due = t.due || t.dueTs || t.dueDate;
      if (!due) return false;
      const dueDate = new Date(due);
      return dueDate < new Date() && !t.completed;
    });
    const snapshotOverdueTasks = model.snapshot?.overdueTasks || [];
    compareTopNIds(overdueTasks, snapshotOverdueTasks, 5, 'overdueTask');

    // Stale deals: compare top 5 IDs (contacts stale 14+ days)
    const now = Date.now();
    const staleDeals = (model.contacts || []).filter((c) => {
      const updated = c.updatedTs || c.lastTouchTs || c.createdTs;
      if (!updated) return false;
      const days = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
      return days >= 14;
    });
    const snapshotStaleDeals = model.snapshot?.staleDeals || [];
    compareTopNIds(staleDeals, snapshotStaleDeals, 5, 'staleDeal');

    // Closing watch: compare top 5 IDs (approved/cleared-to-close/funded stage contacts)
    const closingContacts = (model.contacts || []).filter((c) => {
      const stageKey = normalizeStagesForDisplay(c.stage);
      return ['approved', 'cleared-to-close', 'funded'].includes(stageKey);
    });
    const snapshotClosingWatch = model.snapshot?.closingWatch || [];
    compareTopNIds(closingContacts, snapshotClosingWatch, 5, 'closingWatch');

    if (idDiffs.length) {
      console.warn('[labs:parity] Top-N ID mismatches detected', idDiffs);
    }

    if (stageDiffs.length || taskDiffs.length || staleDiffs.length) {
      console.warn('[labs:parity] Data mismatches detected', { stageDiffs, taskDiffs, staleDiffs });
    } else if (!idDiffs.length) {
      console.info('[labs:parity] Core metrics aligned with snapshot data');
    }
  } catch (err) {
    console.warn('[labs:parity] Parity diagnostics failed softly', err);
  }
}

const LABS_PRESETS = {
  overview: {
    default: {
      label: 'Default layout',
      order: [
        'focus', 'labsKpiSummary', 'labsPipelineSnapshot', 'goalProgress',
        'labsTasks', 'today', 'todo', 'priorityActions', 'favorites',
        'milestones',
        'partnerPortfolio', 'referralLeaderboard', 'referralTrends', 'relationshipOpportunities',
        'closingWatch', 'upcomingCelebrations'
      ],
      visibility: {
        focus: true, labsKpiSummary: true, labsPipelineSnapshot: true, goalProgress: true,
        labsTasks: true, today: true, todo: true, priorityActions: true, favorites: true,
        milestones: true,
        partnerPortfolio: true, referralLeaderboard: true, referralTrends: true, relationshipOpportunities: true,
        closingWatch: true, upcomingCelebrations: true
      },
      widths: {
        focus: 'w3', labsKpiSummary: 'w3', labsPipelineSnapshot: 'w3', goalProgress: 'w1',
        labsTasks: 'w2', today: 'w2', todo: 'w2', priorityActions: 'w1', favorites: 'w1',
        milestones: 'w2',
        partnerPortfolio: 'w3', referralLeaderboard: 'w2', referralTrends: 'w2', relationshipOpportunities: 'w2',
        closingWatch: 'w2', upcomingCelebrations: 'w2'
      }
    },
    kpiFocused: {
      label: 'KPI focus',
      order: ['labsKpiSummary', 'labsPipelineSnapshot', 'today', 'todo', 'favorites', 'labsTasks'],
      visibility: {
        labsKpiSummary: true,
        labsPipelineSnapshot: true,
        labsTasks: true,
        today: true,
        todo: true,
        favorites: true
      },
      widths: {
        labsKpiSummary: 'w3',
        labsPipelineSnapshot: 'w3',
        favorites: 'w1'
      }
    },
    weeklyReview: {
      label: 'Weekly Review',
      order: [
        'labsKpiSummary',
        'goalProgress',
        'labsPipelineSnapshot',
        'pipelineVelocity',
        'pipelineRisk',
        'closingWatch',
        'referralTrends',
        'partnerPortfolio',
        'relationshipOpportunities',
        'priorityActions',
        'todo',
        'favorites'
      ],
      visibility: {
        labsKpiSummary: true,
        goalProgress: true,
        labsPipelineSnapshot: true,
        pipelineVelocity: true,
        pipelineRisk: true,
        closingWatch: true,
        referralTrends: true,
        partnerPortfolio: true,
        relationshipOpportunities: true,
        priorityActions: true,
        todo: true,
        favorites: true
      },
      widths: {
        labsKpiSummary: 'w3',
        goalProgress: 'w2',
        labsPipelineSnapshot: 'w3',
        pipelineVelocity: 'w2',
        pipelineRisk: 'w2',
        closingWatch: 'w2',
        referralTrends: 'w2',
        partnerPortfolio: 'w3',
        relationshipOpportunities: 'w2',
        priorityActions: 'w2',
        todo: 'w2',
        favorites: 'w1'
      },
      description: 'A 10-minute weekly planning layout'
    },
    monthlyReview: {
      label: 'Monthly Review',
      order: [
        'labsKpiSummary',
        'goalProgress',
        'pipelineVelocity',
        'pipelineRisk',
        'labsPipelineSnapshot',
        'referralTrends',
        'partnerPortfolio',
        'referralLeaderboard',
        'relationshipOpportunities',
        'closingWatch',
        'priorityActions',
        'todo',
        'favorites',
        'labsTasks',
        'today'
      ],
      visibility: {
        labsKpiSummary: true,
        goalProgress: true,
        pipelineVelocity: true,
        pipelineRisk: true,
        labsPipelineSnapshot: true,
        referralTrends: true,
        partnerPortfolio: true,
        referralLeaderboard: true,
        relationshipOpportunities: true,
        closingWatch: true,
        priorityActions: false,
        todo: false,
        favorites: false,
        labsTasks: false,
        today: false
      },
      widths: {
        labsKpiSummary: 'w3',
        goalProgress: 'w2',
        pipelineVelocity: 'w2',
        pipelineRisk: 'w2',
        labsPipelineSnapshot: 'w2',
        referralTrends: 'w3',
        partnerPortfolio: 'w2',
        referralLeaderboard: 'w2',
        relationshipOpportunities: 'w2',
        closingWatch: 'w2',
        priorityActions: 'w1',
        todo: 'w1',
        favorites: 'w1',
        labsTasks: 'w1',
        today: 'w1'
      },
      description: 'Strategic month-in-review with velocity, partner momentum, and relationship risk'
    },
    tasksFocused: {
      label: 'Tasks focus',
      order: ['labsTasks', 'today', 'todo', 'favorites', 'labsPipelineSnapshot', 'labsKpiSummary'],
      visibility: {
        labsTasks: true,
        today: true,
        todo: true,
        favorites: true,
        labsPipelineSnapshot: true,
        labsKpiSummary: true
      },
      widths: {
        labsTasks: 'w3',
        today: 'w2',
        todo: 'w2'
      }
    }
  },
  tasks: {
    default: { label: 'Default layout' },
    execution: {
      label: 'Execution focus',
      order: ['labsTasks', 'priorityActions', 'today', 'todo'],
      visibility: {
        labsTasks: true,
        priorityActions: true,
        today: true,
        todo: true
      },
      widths: {
        labsTasks: 'w3',
        priorityActions: 'w2',
        today: 'w2'
      }
    },
    planning: {
      label: 'Planning focus',
      order: ['priorityActions', 'today', 'labsTasks', 'todo'],
      visibility: {
        priorityActions: true,
        today: true,
        labsTasks: true,
        todo: true
      },
      widths: {
        priorityActions: 'w2',
        today: 'w2',
        labsTasks: 'w3'
      }
    }
  },
  portfolio: {
    default: { label: 'Default layout' },
    partners: {
      label: 'Partner focus',
      order: ['partnerPortfolio', 'referralLeaderboard', 'relationshipOpportunities'],
      visibility: {
        partnerPortfolio: true,
        referralLeaderboard: true,
        relationshipOpportunities: true
      },
      widths: {
        partnerPortfolio: 'w3',
        referralLeaderboard: 'w2'
      }
    },
    pipeline: {
      label: 'Pipeline focus',
      order: ['partnerPortfolio', 'referralLeaderboard', 'relationshipOpportunities'],
      visibility: {
        partnerPortfolio: true,
        referralLeaderboard: true,
        relationshipOpportunities: true
      },
      widths: {
        partnerPortfolio: 'w3'
      }
    }
  }
};


const EXPERIMENTAL_WIDGETS = [
  // Consolidating valid widgets into main sections.
  // This section is now reserved for true WIP items.
];

// ---------------------------------------------------------------------------
// Labs Widget Catalog Audit (2025-12)
// ---------------------------------------------------------------------------
// CANONICAL (stable, default-mounted):
//   labsKpiSummary, labsPipelineSnapshot, labsTasks, today, todo, favorites,
//   priorityActions, partnerPortfolio, referralLeaderboard, referralTrends,
//   relationshipOpportunities, goalProgress, pipelineVelocity, pipelineRisk,
//   pipelineFunnel, closingWatch, staleDeals, upcomingCelebrations, milestones
//
// OPT-IN VISUAL ALTERNATES (stable, in picker):
//   pipelineMomentum (Bars), pipelineOverview (Funnel)
//
// EXPERIMENTAL (opt-in via Experimental section):
//   activePipeline, statusStack
//
// HIDDEN FEATURE SHORTCUTS (Advanced-only, stable):
//   printSuiteShortcut, templatesShortcut
//
// PARITY NOTES:
//   - Only ONE pipeline snapshot widget (labsPipelineSnapshot) is default-mounted
//   - Pipeline variants are registered stable but opt-in
//   - Tasks widget shows real labels + contact names via getDisplayTasks()
//   - Shortcut widgets only visible when Advanced mode is enabled
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Pipeline health and today\'s work',
    widgets: DEFAULT_WIDGETS_BY_SECTION.overview
  },
  {
    id: 'tasks',
    label: 'Tasks',
    description: 'Today\'s work and follow-ups',
    widgets: DEFAULT_WIDGETS_BY_SECTION.tasks
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    description: 'Clients, partners, and referrals',
    widgets: DEFAULT_WIDGETS_BY_SECTION.portfolio
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Funnels, velocity, and pipeline risk',
    widgets: DEFAULT_WIDGETS_BY_SECTION.analytics
  },
  {
    id: 'experimental',
    label: 'Experimental',
    description: 'Early widgets under active development',
    widgets: EXPERIMENTAL_WIDGETS
  }
];

function normalizeWidthToken(token) {
  const raw = typeof token === 'string' ? token.trim() : '';
  if (WIDTH_TOKENS.includes(raw)) return raw;
  const lower = raw.toLowerCase();
  if (SIZE_TO_WIDTH[lower]) return SIZE_TO_WIDTH[lower];
  return '';
}

function defaultWidthToken(size) {
  const key = typeof size === 'string' ? size.toLowerCase() : '';
  return SIZE_TO_WIDTH[key] || 'w2';
}

function getSection(sectionId) {
  return SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];
}

function cacheSectionLayout(sectionId, layout) {
  sectionLayoutCache.set(sectionId, layout);
}

function getCachedLayout(sectionId) {
  return sectionLayoutCache.get(sectionId) || null;
}

function notifyLayoutChanged(sectionId, layout, source = 'dashboard') {
  if (!sectionId || !layout) return;
  emitLabsEvent('labs:layout:changed', { sectionId, layout, source });
}

function getWidgetLabel(widgetId) {
  if (!widgetId) return '';
  return WIDGET_LABELS[widgetId] || widgetId;
}

function applyDefaultVNextLayout(sectionId) {
  if (!sectionId || typeof localStorage === 'undefined') return;
  const defaults = DEFAULT_VNEXT_LAYOUTS[sectionId];
  if (!defaults) return;
  const storageKey = `${VNEXT_STORAGE_PREFIX}${sectionId}`;
  if (localStorage.getItem(storageKey)) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(defaults));
  } catch (err) {
    console.warn('[labs] Unable to seed vNext defaults', err);
  }
}

function buildSectionRenderData(section) {
  const layoutState = loadSectionLayout(section.id, section.widgets);
  cacheSectionLayout(section.id, layoutState);
  const widgetsInOrder = layoutState.order
    .map((id) => (section.widgets || []).find((widget) => widget?.id === id))
    .filter((widget) => widget && layoutState.visibility[widget.id] !== false);
  return { layoutState, widgetsInOrder };
}

function commitLayout(sectionId, updater) {
  const section = getSection(sectionId);
  if (!section || typeof updater !== 'function') return null;
  const current = loadSectionLayout(sectionId, section.widgets) || {};
  const next = updater({ ...current }) || current;
  const normalized = saveSectionLayout(sectionId, next, section.widgets);
  cacheSectionLayout(sectionId, normalized);
  notifyLayoutChanged(sectionId, normalized);
  return normalized;
}

function updateVisibility(sectionId, widgetId, isVisible) {
  if (!sectionId || !widgetId) return;
  commitLayout(sectionId, (state) => {
    const next = state || {};
    next.visibility = next.visibility && typeof next.visibility === 'object' ? { ...next.visibility } : {};
    next.visibility[widgetId] = !!isVisible;
    return next;
  });
}

function applyWidthClass(element, token) {
  if (!element) return;
  WIDTH_TOKENS.forEach((t) => element.classList.remove(`labs-${t}`));
  element.classList.add(`labs-${token}`);
}

function getWidgetWidthToken(sectionId, widget) {
  const widgetId = typeof widget === 'string' ? widget : widget?.id;
  if (!widgetId) return 'w2';
  const cached = getCachedLayout(sectionId);
  if (cached?.widths?.[widgetId]) return cached.widths[widgetId];
  const section = getSection(sectionId);
  const widgetDef = (section.widgets || []).find((entry) => entry?.id === widgetId);
  return defaultWidthToken(widgetDef?.size);
}

function setWidgetWidthToken(sectionId, widgetId, token) {
  const normalized = normalizeWidthToken(token);
  if (!sectionId || !widgetId || !normalized) return;
  commitLayout(sectionId, (state) => {
    const next = state || {};
    next.widths = next.widths && typeof next.widths === 'object' ? { ...next.widths } : {};
    next.widths[widgetId] = normalized;
    return next;
  });
}

function persistLayout(sectionId, order) {
  if (!sectionId) return;
  const normalized = Array.isArray(order) ? order.map(String) : [];
  commitLayout(sectionId, (state) => ({ ...state, order: normalized }));
}

function resetSectionLayoutToDefault(sectionId) {
  if (!sectionId) return null;
  const section = getSection(sectionId);
  if (!section) return null;
  const defaults = resetSectionLayout(sectionId, section.widgets);
  cacheSectionLayout(sectionId, defaults);
  notifyLayoutChanged(sectionId, defaults);
  return defaults;
}

function getPresetOptions(sectionId) {
  const presets = LABS_PRESETS[sectionId];
  if (!presets) return [];
  return Object.entries(presets).map(([key, config]) => ({
    key,
    label: config?.label || key
  }));
}

function getPresetSelection(sectionId) {
  const section = getSection(sectionId);
  const layout = loadSectionLayout(sectionId, section?.widgets || []);
  const presets = LABS_PRESETS[sectionId];
  const stored = layout?.preset;
  if (stored && presets && presets[stored]) return stored;
  if (presets?.default) return 'default';
  return '';
}

function applyPreset(sectionId, presetKey) {
  const section = getSection(sectionId);
  if (!sectionId || !presetKey || !section) return;
  const presets = LABS_PRESETS[section.id] || {};
  const preset = presets[presetKey];
  const layout = applyPresetToSection(section.id, presetKey, section.widgets, preset || {});
  cacheSectionLayout(section.id, layout);
  notifyLayoutChanged(section.id, layout);
}

function showLoading() {
  if (!dashboardRoot) return;
  const loading = document.createElement('div');
  loading.className = 'labs-loading';
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Loading CRM Data...</div>
  `;
  dashboardRoot.replaceChildren(loading);
}

function showError(message) {
  if (!dashboardRoot) return;
  const error = document.createElement('div');
  error.className = 'labs-error';
  error.innerHTML = `
    <h2>⚠️ Error</h2>
    <p>${message}</p>
    <button class="labs-btn-primary" onclick="location.reload()">Reload</button>
  `;
  dashboardRoot.replaceChildren(error);
}

async function hydrateModel() {
  try {
    const model = await buildLabsModel();
    if (!model) {
      console.warn('[labs] Data build returned null, using empty model');
      labsModel = { contacts: [], partners: [], tasks: [], pipeline: [], analytics: { funnel: [], velocityBuckets: [], staleSummary: [] } };
    } else {
      labsModel = model;
    }
    return labsModel;
  } catch (err) {
    console.error('[labs] Fatal hydrate error (softened)', err);
    labsModel = { contacts: [], partners: [], tasks: [], pipeline: [], analytics: { funnel: [], velocityBuckets: [], staleSummary: [] } };
    return labsModel;
  }
}

function renderShell() {
  if (!dashboardRoot) return;
  dashboardRoot.className = 'labs-crm-dashboard';
  dashboardRoot.dataset.qa = 'labs-crm-dashboard';
  dashboardRoot.classList.toggle('labs-layout-edit-mode', labsLayoutEditMode);

  const header = createHeader();
  const nav = createNavigation();
  const sectionHost = document.createElement('div');
  sectionHost.className = 'labs-section-host';
  sectionHost.dataset.qa = 'labs-section-host';

  const contentShell = document.createElement('div');
  contentShell.className = 'labs-content-shell';
  contentShell.append(header, nav, sectionHost);

  dashboardRoot.replaceChildren(contentShell);

  renderSection(activeSection);
}

function createHeader() {
  const header = document.createElement('header');
  header.className = 'labs-crm-header';
  header.dataset.qa = 'labs-header';
  const contactCount = formatNumber(labsModel?.contacts?.length || 0);
  const partnerCount = formatNumber(labsModel?.partners?.length || 0);
  const taskCount = formatNumber(labsModel?.tasks?.length || 0);
  const warningBadge = LABS_DEBUG && labsModel?.validationWarnings?.length
    ? `<div class="labs-debug-indicator" title="Dashboard (Preview) model warnings">${labsModel.validationWarnings.length} warning${labsModel.validationWarnings.length === 1 ? '' : 's'}</div>`
    : '';

  header.innerHTML = `
    <div class="labs-header-content">
      <div class="labs-branding">
        <h1 class="labs-title">
          <span class="labs-icon-main">🚀</span>
          Dashboard (Preview)
          <span class="labs-badge-beta">BETA</span>
        </h1>
        <p class="labs-subtitle">Preview of the next-generation dashboard powered by your live data.</p>
        <a href="#/dashboard" class="labs-link-legacy" style="display:inline-block; margin-top:4px; font-size:0.85rem; color:var(--text-muted); text-decoration:none; border-bottom:1px dashed currentColor;">
          ← Return to Dashboard
        </a>
      </div>
        <div class="labs-header-stats">
          <div class="header-stat">
            <div class="stat-value">${contactCount}</div>
            <div class="stat-label">Contacts</div>
          </div>
        <div class="header-stat">
          <div class="stat-value">${partnerCount}</div>
          <div class="stat-label">Partners</div>
        </div>
        <div class="header-stat">
          <div class="stat-value">${taskCount}</div>
          <div class="stat-label">Tasks</div>
        </div>
      </div>
        <button class="labs-btn-pill" data-action="refresh">Refresh Data</button>
        <button class="labs-btn-ghost" data-action="settings">Experiments</button>
        <button class="labs-btn-ghost" data-action="layout-toggle" aria-pressed="${labsLayoutEditMode}">
          ${labsLayoutEditMode ? 'Layout: On' : 'Layout: Off'}
        </button>
        <button class="labs-btn-ghost" data-action="toggle-engine" style="min-width: 140px;" title="Switch between Classic and vNext grid engines">
            ${isVNextEnabled() ? 'Engine: vNext (Beta)' : 'Engine: Classic'}
        </button>
      </div>
    </div>
  `;
  return header;
}

function updateLayoutToggleUi() {
  const toggle = dashboardRoot?.querySelector('[data-action="layout-toggle"]');
  if (!toggle) return;
  toggle.textContent = labsLayoutEditMode ? 'Layout: On' : 'Layout: Off';
  toggle.setAttribute('aria-pressed', String(labsLayoutEditMode));
  toggle.classList.toggle('active', labsLayoutEditMode);
  toggle.disabled = false;
  toggle.style.opacity = '';
  toggle.style.cursor = '';
}

function createNavigation() {
  const nav = document.createElement('div');
  nav.className = 'labs-nav';
  nav.dataset.qa = 'labs-nav';
  nav.setAttribute('role', 'tablist');
  const tabs = SECTIONS.map((section) => `
    <button class="labs-nav-tab ${section.id === activeSection ? 'active' : ''}" data-section="${section.id}" role="tab" aria-selected="${section.id === activeSection}" tabindex="${section.id === activeSection ? '0' : '-1'}">
      <span class="labs-nav-label">${section.label}</span>
      <span class="labs-nav-sub">${section.description}</span>
    </button>
  `).join('');
  nav.innerHTML = tabs;
  return nav;
}

function createSectionControls(section, layoutState, selectedPreset, isCustomizerOpen) {
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-section-controls';
  wrapper.dataset.sectionId = section.id;

  const meta = document.createElement('div');
  meta.className = 'labs-section-meta';
  meta.innerHTML = `
    <div class="labs-section-title">${section.label}</div>
    <div class="labs-section-desc">${section.description}</div>
  `;
  wrapper.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'labs-section-actions';

  const presetOptions = getPresetOptions(section.id);
  if (presetOptions.length) {
    const presetLabel = document.createElement('label');
    presetLabel.className = 'labs-preset-label';
    presetLabel.textContent = 'Preset:';

    const presetSelect = document.createElement('select');
    presetSelect.className = 'labs-select labs-preset-select';
    presetSelect.dataset.action = 'change-preset';
    presetSelect.dataset.sectionId = section.id;

    presetOptions.forEach((preset) => {
      const option = document.createElement('option');
      option.value = preset.key;
      option.textContent = preset.label;
      presetSelect.appendChild(option);
    });

    presetSelect.value = selectedPreset || 'default';
    presetLabel.appendChild(presetSelect);
    actions.appendChild(presetLabel);
  }

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'labs-btn-ghost labs-reset-layout';
  resetBtn.dataset.action = 'reset-layout';
  resetBtn.dataset.sectionId = section.id;
  resetBtn.textContent = 'Reset layout';
  actions.appendChild(resetBtn);

  const customizeBtn = document.createElement('button');
  customizeBtn.type = 'button';
  customizeBtn.className = 'labs-btn-ghost labs-customize-trigger';
  customizeBtn.dataset.action = 'toggle-customize';
  customizeBtn.dataset.sectionId = section.id;
  customizeBtn.setAttribute('aria-expanded', isCustomizerOpen ? 'true' : 'false');
  customizeBtn.textContent = 'Customize widgets';

  actions.appendChild(customizeBtn);
  wrapper.appendChild(actions);

  const panel = createCustomizePanel(section, layoutState, isCustomizerOpen);
  if (panel) wrapper.appendChild(panel);

  return wrapper;
}

function createCustomizePanel(section, layoutState, isOpen) {
  const panel = document.createElement('div');
  panel.className = 'labs-customize-panel';
  panel.dataset.sectionId = section.id;
  panel.hidden = !isOpen;

  const currentMode = getUiMode();

  // Sort widgets by current layout order
  const orderMap = new Map();
  layoutState.order.forEach((id, index) => orderMap.set(id, index));

  const widgetsToShow = (section.widgets || [])
    .filter((widget) => {
      if (!widget?.id) return false;
      const meta = WIDGET_META[widget.id];
      if (meta?.advancedOnly && currentMode === 'simple') return false;
      return true;
    })
    .sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
      return idxA - idxB;
    });

  const hiddenCount = widgetsToShow.filter((w) => layoutState.visibility[w.id] === false).length;

  const header = document.createElement('div');
  header.className = 'labs-customize-header';
  const countBadge = hiddenCount > 0 ? ` <span class="labs-hidden-count">(${hiddenCount} hidden)</span>` : '';
  header.innerHTML = `Drag to reorder • Show or hide${countBadge}`;
  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'labs-customize-list';

  // Drag State
  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.widgetId);
    this.classList.add('is-dragging');
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.labs-customize-row');
    if (target && target !== dragSrcEl && list.contains(target)) {
      const children = [...list.children];
      const srcIndex = children.indexOf(dragSrcEl);
      const targetIndex = children.indexOf(target);

      if (srcIndex < targetIndex) {
        target.after(dragSrcEl);
      } else {
        target.before(dragSrcEl);
      }
    }
    return false;
  }

  function handleDragEnd(e) {
    this.classList.remove('is-dragging');
    dragSrcEl = null;

    // Save new order
    const newOrder = [];
    [...list.querySelectorAll('.labs-customize-row')].forEach((row) => {
      if (row.dataset.widgetId) {
        newOrder.push(row.dataset.widgetId);
      }
    });
    persistLayout(section.id, newOrder);
  }

  widgetsToShow.forEach((widget) => {
    const row = document.createElement('div');
    row.className = 'labs-customize-row';
    row.draggable = true;
    row.dataset.widgetId = widget.id;

    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('dragend', handleDragEnd);

    const checkWrapper = document.createElement('div');
    checkWrapper.className = 'labs-check-wrapper';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.widgetId = widget.id;
    checkbox.dataset.sectionId = section.id;
    checkbox.checked = layoutState.visibility[widget.id] !== false;

    const label = document.createElement('span');
    label.className = 'labs-customize-label';
    label.textContent = getWidgetLabel(widget.id);

    checkWrapper.appendChild(checkbox);
    checkWrapper.appendChild(label);

    const handle = document.createElement('div');
    handle.className = 'labs-list-drag-handle';
    handle.innerHTML = '⋮⋮';
    handle.setAttribute('aria-hidden', 'true');

    row.appendChild(checkWrapper);
    row.appendChild(handle);
    list.appendChild(row);
  });

  panel.appendChild(list);
  return panel;
}

function renderSection(sectionId, options = {}) {
  const host = dashboardRoot?.querySelector('.labs-section-host');
  if (!host) return;
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];


  const previousSection = activeSection;
  if (previousSection && previousSection !== section.id) {
    destroySectionController(previousSection);
    destroyResizeController(previousSection);
  }

  activeSection = section.id;

  destroySectionController(section.id);
  destroyResizeController(section.id);

  host.innerHTML = '';

  const { layoutState, widgetsInOrder } = buildSectionRenderData(section);
  const isCustomizerOpen = options.forceCustomizerOpen || openCustomizerSections.has(section.id);
  if (isCustomizerOpen) {
    openCustomizerSections.add(section.id);
  }

  const selectedPreset = getPresetSelection(section.id);

  const controls = createSectionControls(
    section,
    layoutState,
    selectedPreset,
    openCustomizerSections.has(section.id)
  );
  host.appendChild(controls);

  const gridShell = document.createElement('div');
  gridShell.className = 'labs-grid-shell';

  const grid = document.createElement('div');
  grid.className = 'labs-crm-grid labs-static-grid';
  grid.dataset.qa = `labs-grid-${section.id}`;
  grid.dataset.sectionId = section.id;
  grid.classList.toggle('labs-grid-editable', labsLayoutEditMode);
  gridShell.appendChild(grid);
  host.appendChild(gridShell);

  renderWidgets(grid, widgetsInOrder);

  if (isVNextEnabled()) {
    try {
      applyDefaultVNextLayout(section.id);

      enableVNextGrid(grid, section.id);
    } catch (err) {
      console.error('[labs] vNext failed to initialize, falling back to Classic', err);
      if (labsLayoutEditMode) {
        registerGridDrag(section, grid);
        registerResizeHandles(section, grid);
      }
    }
  } else {
    if (labsLayoutEditMode) {
      registerGridDrag(section, grid);
      registerResizeHandles(section, grid);
    }
  }

  updateNavState();
  updateLayoutToggleUi();
}

function updateNavState() {
  const tabs = dashboardRoot?.querySelectorAll('.labs-nav-tab');
  if (!tabs) return;
  tabs.forEach((tab) => {
    const section = tab.dataset.section;
    tab.classList.toggle('active', section === activeSection);
    tab.setAttribute('aria-selected', section === activeSection ? 'true' : 'false');
    tab.tabIndex = section === activeSection ? 0 : -1;
  });
}

function renderWidgets(grid, widgetList = []) {
  const model = labsModel || {
    contacts: [],
    partners: [],
    tasks: [],
    snapshot: { pipelineCounts: {} },
    celebrations: [],
    laneOrder: [],
    activeLanes: []
  };
  const onPortfolioSegment = (segment) => {
    if (!segment) return;
    openPortfolioDrilldown(model, segment);
  };
  widgetList.forEach((widget, index) => {
    const renderer = CRM_WIDGET_RENDERERS[widget.id];
    if (!renderer) return;
    const widthToken = getWidgetWidthToken(grid.dataset.sectionId, widget);

    const item = document.createElement('div');
    item.className = `labs-grid-item size-${widget.size || 'medium'} labs-${widthToken}`;
    item.dataset.widgetId = widget.id;

    const handle = document.createElement('div');
    handle.className = 'labs-widget-drag-handle';
    handle.innerHTML = '<span class="handle-icon">↕</span><span class="handle-label">Drag</span>';

    const content = document.createElement('div');
    content.className = `labs-widget-container size-${widget.size || 'medium'} labs-${widthToken}`;
    content.role = 'presentation';
    content.dataset.widgetId = widget.id;
    content.dataset.qa = `labs-widget-${widget.id}`;
    content.style.animationDelay = `${index * 0.04}s`;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'labs-widget-resize-handle';
    resizeHandle.dataset.labsResizeHandle = 'true';
    resizeHandle.setAttribute('aria-label', 'Resize widget');

    safeRenderWidget(widget.id, () => {
      const rendered = renderer(content, model, { onAnalyticsSegment, onPortfolioSegment });
      if (typeof rendered === 'string') {
        content.innerHTML = rendered;
      } else if (rendered instanceof HTMLElement) {
        content.appendChild(rendered);
      }
    }, content, { onAnalyticsSegment, onPortfolioSegment, model });

    item.appendChild(handle);
    item.appendChild(content);
    item.appendChild(resizeHandle);
    grid.appendChild(item);
    console.debug(`[LABS] rendered widget ${widget.id}`);
  });
}

function destroySectionController(sectionId) {
  if (!sectionId) return;
  const existing = labsDragControllers.get(sectionId);
  if (existing && typeof existing.destroy === 'function') {
    try {
      existing.destroy();
    } catch (_err) { }
  }
  labsDragControllers.delete(sectionId);
}

function destroyResizeController(sectionId) {
  if (!sectionId) return;
  const teardown = labsResizeControllers.get(sectionId);
  if (typeof teardown === 'function') {
    try { teardown(); } catch (_err) { }
  }
  labsResizeControllers.delete(sectionId);
}

function registerGridDrag(section, grid) {
  if (!section || !grid) return;
  try {
    const controller = makeDraggableGrid({
      container: grid,
      itemSel: '.labs-grid-item',
      handleSel: '.labs-widget-drag-handle',
      idGetter: (el) => (el?.dataset?.widgetId ? String(el.dataset.widgetId).trim() : ''),
      onOrderChange: (order) => persistLayout(section.id, order),
      enabled: labsLayoutEditMode
    });
    if (controller) {
      if (typeof controller.setEditMode === 'function') {
        controller.setEditMode(labsLayoutEditMode);
      }
      if (labsLayoutEditMode && typeof controller.enable === 'function') {
        controller.enable();
      } else if (!labsLayoutEditMode && typeof controller.disable === 'function') {
        controller.disable();
      }
      if (typeof controller.refresh === 'function') {
        controller.refresh();
      }
      labsDragControllers.set(section.id, controller);
    }
  } catch (err) {
    try {
      if (console && console.warn) console.warn('[labs] drag init failed', err);
    } catch (_warnErr) { }
  }
}

function registerResizeHandles(section, grid) {
  if (!section || !grid) return;
  destroyResizeController(section.id);

  const resizable = makeResizableGrid({ container: grid });

  let active = null;

  const onPointerMove = (evt) => {
    if (!active || evt.pointerId !== active.pointerId) return;
    const dx = evt.clientX - active.startX;
    const threshold = 50;
    let delta = 0;
    if (dx > threshold) delta = 1;
    if (dx < -threshold) delta = -1;
    if (!delta) return;
    const currentIndex = WIDTH_TOKENS.indexOf(active.token);
    const nextIndex = Math.min(WIDTH_TOKENS.length - 1, Math.max(0, currentIndex + delta));
    if (nextIndex === currentIndex) return;
    const nextToken = WIDTH_TOKENS[nextIndex];
    active.token = nextToken;
    applyWidthClass(active.item, nextToken);
    if (active.content) applyWidthClass(active.content, nextToken);

    // We defer persistence to pointerup to avoid thrashing storage
    if (resizable && typeof resizable.reflow === 'function') {
      resizable.reflow();
    }
  };

  const stop = (evt) => {
    if (active) {
      if (active.handle) {
        try {
          active.handle.releasePointerCapture(evt.pointerId);
          active.handle.removeEventListener('pointermove', onPointerMove);
          active.handle.removeEventListener('pointerup', stop);
          active.handle.removeEventListener('pointercancel', stop);
        } catch (_e) { }
      }
      if (active.token) {
        setWidgetWidthToken(active.sectionId, active.widgetId, active.token);
      }
      active = null;
    }
  };

  const onPointerDown = (evt) => {
    if (!labsLayoutEditMode) return;
    const handle = evt.target.closest('[data-labs-resize-handle]');
    if (!handle) return;
    const item = handle.closest('.labs-grid-item');
    if (!item) return;

    // Only primary button
    if (evt.button !== 0) return;

    evt.preventDefault();
    evt.stopPropagation();

    const widgetId = item.dataset.widgetId || '';
    if (!widgetId) return;
    const content = item.querySelector('.labs-widget-container');
    const initialToken = WIDTH_TOKENS.find((token) => item.classList.contains(`labs-${token}`))
      || getWidgetWidthToken(section.id, { id: widgetId });

    active = {
      pointerId: evt.pointerId,
      handle,
      widgetId,
      sectionId: section.id,
      item,
      content,
      startX: evt.clientX,
      token: initialToken
    };

    handle.setPointerCapture(evt.pointerId);
    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  };

  grid.addEventListener('pointerdown', onPointerDown);

  const teardown = () => {
    grid.removeEventListener('pointerdown', onPointerDown);
    if (active && active.handle) {
      try { active.handle.releasePointerCapture(active.pointerId); } catch (e) { }
    }
  };

  labsResizeControllers.set(section.id, teardown);
}

function scheduleLabsModelRefresh(reason) {
  if (refreshThrottleTimer) return;
  refreshThrottleTimer = setTimeout(async () => {
    refreshThrottleTimer = null;
    console.debug('[labs] scheduling model recompute', reason || '');
    await refreshDashboard();
  }, 80);
}

async function refreshDashboard() {
  const grid = dashboardRoot?.querySelector('.labs-crm-grid');
  if (!grid) return;
  grid.setAttribute('aria-busy', 'true');
  grid.style.opacity = '0.5';
  try {
    await hydrateModel();
    renderSection(activeSection);
    showNotification('Dashboard refreshed', 'success');
  } catch (err) {
    console.error('[labs] Refresh failed:', err);
    showNotification('Refresh failed', 'error');
  } finally {
    grid.removeAttribute('aria-busy');
    grid.style.opacity = '1';
  }
}

function teardownLabsEvents() {
  labsEventUnsubscribers.forEach((unsubscribe) => {
    try {
      if (typeof unsubscribe === 'function') unsubscribe();
    } catch (err) {
      console.warn('[labs] failed to teardown labs event listener', err);
    }
  });
  labsEventUnsubscribers = [];
}

function registerLabsEventListeners() {
  teardownLabsEvents();

  labsEventUnsubscribers.push(onLabsEvent('labs:model:recompute', (detail) => {
    scheduleLabsModelRefresh(detail?.source || 'labs:model:recompute');
  }));

  labsEventUnsubscribers.push(onLabsEvent('labs:tasks:changed', (detail) => {
    emitLabsEvent('labs:model:recompute', { source: 'labs:tasks:changed', detail });
  }));

  labsEventUnsubscribers.push(onLabsEvent('labs:pipeline:changed', (detail) => {
    emitLabsEvent('labs:model:recompute', { source: 'labs:pipeline:changed', detail });
  }));

  labsEventUnsubscribers.push(onLabsEvent('labs:layout:changed', (detail) => {
    if (detail?.source === 'dashboard') return;
    const targetSection = detail?.sectionId || activeSection;
    if (!targetSection) return;
    renderSection(targetSection, { forceCustomizerOpen: openCustomizerSections.has(targetSection) });
  }));
}

function attachEventListeners() {
  if (!dashboardRoot) return;

  if (navClickHandler) {
    dashboardRoot.removeEventListener('click', navClickHandler);
  }
  navClickHandler = async (event) => {
    const navButton = event.target.closest('.labs-nav-tab');
    if (navButton && navButton.dataset.section) {
      renderSection(navButton.dataset.section);
      return;
    }

    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'refresh') {
      await refreshDashboard();
    }
    if (action === 'settings') {
      showNotification('Dashboard (Preview) experiments are enabled — this mirrors the main dashboard.', 'info');
    }
    if (action === 'toggle-customize') {
      const sectionId = event.target.closest('[data-section-id]')?.dataset.sectionId || activeSection;
      if (!sectionId) return;
      if (openCustomizerSections.has(sectionId)) {
        openCustomizerSections.delete(sectionId);
      } else {
        openCustomizerSections.add(sectionId);
      }
      renderSection(sectionId, { forceCustomizerOpen: openCustomizerSections.has(sectionId) });
      return;
    }
    if (action === 'reset-layout') {
      const sectionId = event.target.closest('[data-section-id]')?.dataset.sectionId || activeSection;
      if (!sectionId) return;
      resetSectionLayoutToDefault(sectionId);
      renderSection(sectionId, { forceCustomizerOpen: openCustomizerSections.has(sectionId) });
      showNotification('Layout reset to default', 'info');
      return;
    }
    if (action === 'toggle-engine') {
      const next = !isVNextEnabled();
      localStorage.setItem(USE_VNEXT_KEY, String(next));
      window.location.reload();
      return;
    }
    if (action === 'layout-toggle') {
      setLayoutMode(!labsLayoutEditMode);
    }
  };
  dashboardRoot.addEventListener('click', navClickHandler);

  if (customizeChangeHandler) {
    dashboardRoot.removeEventListener('change', customizeChangeHandler);
  }
  customizeChangeHandler = (event) => {
    const checkbox = event.target.closest('input[type="checkbox"][data-widget-id][data-section-id]');
    if (!checkbox) return;
    const sectionId = checkbox.dataset.sectionId;
    const widgetId = checkbox.dataset.widgetId;
    updateVisibility(sectionId, widgetId, checkbox.checked);
    renderSection(sectionId, { forceCustomizerOpen: true });
  };
  dashboardRoot.addEventListener('change', customizeChangeHandler);

  if (presetChangeHandler) {
    dashboardRoot.removeEventListener('change', presetChangeHandler);
  }
  presetChangeHandler = (event) => {
    const select = event.target.closest('select[data-action="change-preset"][data-section-id]');
    if (!select) return;
    const sectionId = select.dataset.sectionId;
    const presetKey = select.value;
    applyPreset(sectionId, presetKey);
    renderSection(sectionId, { forceCustomizerOpen: openCustomizerSections.has(sectionId) });
  };
  dashboardRoot.addEventListener('change', presetChangeHandler);

  if (typeof document !== 'undefined') {
    if (dataChangedHandler) {
      document.removeEventListener('app:data:changed', dataChangedHandler);
    }
    dataChangedHandler = (evt) => {
      // Guard: Only react if Labs is mounted and visible
      if (!dashboardRoot || !document.contains(dashboardRoot)) return;

      const detail = evt?.detail || {};
      // Guard: Ignore internal Labs layout events or self-loops to prevent storms
      if (detail.source === 'labs:layout' || detail.reason === 'labs:refresh') return;

      console.info('[labs] CRM data changed, refreshing...', detail);
      emitLabsEvent('labs:model:recompute', { source: 'app:data:changed', payload: detail });
    };
    document.addEventListener('app:data:changed', dataChangedHandler);
  }

  registerLabsEventListeners();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `labs-notification ${type}`;
  notification.textContent = message;
  dashboardRoot?.appendChild(notification);
  requestAnimationFrame(() => notification.classList.add('show'));
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 250);
  }, 2600);
}

function setLayoutMode(enabled) {
  labsLayoutEditMode = !!enabled;
  dashboardRoot?.classList.toggle('labs-layout-edit-mode', labsLayoutEditMode);
  const grid = dashboardRoot?.querySelector('.labs-crm-grid');
  if (grid) {
    grid.classList.toggle('labs-grid-editable', labsLayoutEditMode);
  }
  if (labsLayoutEditMode) {
    const grid = dashboardRoot?.querySelector('.labs-crm-grid');
    const section = getSection(activeSection);
    if (grid && section) {
      // Re-register to ensure hooks are active
      if (!isVNextEnabled()) {
        registerGridDrag(section, grid);
        registerResizeHandles(section, grid);
      } else {
        // vNext handles its own state usually, but fallback might be needed
        // For now, assume vNext is always active if enabled, or check logic
        // But the requirement is about hooks.
        // If vNext is enabled, enableVNextGrid was called in renderSection.
      }
    }
  } else {
    // Teardown
    destroySectionController(activeSection);
    destroyResizeController(activeSection);
  }

  // Strict quarantine: Only attach action bar drag in editing mode
  if (labsLayoutEditMode) {
    initActionBarDrag();
  } else {
    teardownActionBarWiring();
  }

  updateLayoutToggleUi();
  showNotification(labsLayoutEditMode ? 'Layout editing enabled' : 'Layout saved', 'info');
}

export function unmountLabsDashboard() {
  if (typeof document !== 'undefined' && dataChangedHandler) {
    document.removeEventListener('app:data:changed', dataChangedHandler);
    dataChangedHandler = null;
  }

  if (dashboardRoot) {
    if (navClickHandler) {
      dashboardRoot.removeEventListener('click', navClickHandler);
      navClickHandler = null;
    }
    if (customizeChangeHandler) {
      dashboardRoot.removeEventListener('change', customizeChangeHandler);
      customizeChangeHandler = null;
    }
    if (presetChangeHandler) {
      dashboardRoot.removeEventListener('change', presetChangeHandler);
      presetChangeHandler = null;
    }
  }

  // Teardown drag controllers
  if (labsDragControllers) {
    labsDragControllers.forEach((controller) => {
      if (controller && typeof controller.destroy === 'function') {
        try { controller.destroy(); } catch (e) { console.warn(e); }
      }
    });
    labsDragControllers.clear();
  }

  // Teardown resize controllers
  if (labsResizeControllers) {
    labsResizeControllers.forEach((teardown) => {
      if (typeof teardown === 'function') {
        try { teardown(); } catch (e) { console.warn(e); }
      }
    });
    labsResizeControllers.clear();
  }

  // Force Action Bar cleanup
  teardownActionBarWiring();

  // Reset state
  labsLayoutEditMode = false;
  if (labsEventUnsubscribers) {
    labsEventUnsubscribers.forEach(u => typeof u === 'function' && u());
    labsEventUnsubscribers = [];
  }

  dashboardRoot = null;
  console.info('[labs] unmounted');
}



async function mountLabsDashboard(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }
  console.debug('[LABS] mountLabsDashboard called');
  if (dashboardRoot && dashboardRoot !== root) {
    if (navClickHandler) {
      dashboardRoot.removeEventListener('click', navClickHandler);
    }
  }
  dashboardRoot = root;
  if (dashboardRoot?.dataset) {
    dashboardRoot.dataset.dashboardCompat = 'true';
  }
  showLoading();

  const dbReady = await ensureDatabase();
  if (!dbReady) {
    showError('Failed to connect to CRM database');
    return;
  }

  try {
    await hydrateModel();
    renderShell();
    runLabsParityDiagnostics(labsModel);
    attachEventListeners();
    console.info('[labs] CRM Dashboard (Preview) rendered');
  } catch (err) {
    console.error('[labs] Failed to initialize:', err);
    showError(err.message || 'Unable to render the Dashboard (Preview)');
  }
}

export { mountLabsDashboard as initLabsCRMDashboard };
export default mountLabsDashboard;
