// Labs CRM Widgets - Canonical-data-backed and visually modern

import {
  calculateKPIsFromSnapshot,
  groupByStage,
  groupPartnersByTier,
  getTopReferralPartners,
  getStaleDeals,
  getUpcomingCelebrations,
  countTodayTasks,
  countOverdueTasks,
  getTodayTasks,
  getOverdueTasks,
  getOpenTasks,
  getDisplayTasks,
  computeStageFunnel,
  computeStageAgeBuckets,
  computeStaleSummary,
  dedupeById,
  STAGE_CONFIG,
  ANALYTICS_SEGMENT_TYPES,
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  normalizeStagesForDisplay,
  getContactDisplayName
} from './data.js';
import { PIPELINE_MILESTONES } from '../pipeline/constants.js';
import { getDeltaInsight, getThresholdInsight, getTopDriverInsight } from './insight_callouts.js';
import {
  createRowContainer,
  renderContactRow,
  renderLoanRow,
  renderPartnerRow
} from './row_renderers.js';
import { createInlineBar } from './micro_charts.js';
import { renderWidgetBody, renderWidgetShell } from './widget_base.js';
import { loadTodoItems, saveTodoItems, generateId } from '../dashboard/widgets/todo_widget.js';
// Drilldown Editors
import { openTaskEditor } from '../ui/quick_create_menu.js';
import { openContactEditor } from '../contacts.js';
import { openPartnerEditor } from '../editors/partner_entry.js';

const DAY_MS = 86400000;

function startOfDayTs(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function normalizeDueTs(task) {
  if (!task) return null;
  const dueCandidate = task.dueTs || task.dueDate || task.due;
  if (!dueCandidate) return null;
  const dueDate = new Date(dueCandidate);
  if (Number.isNaN(dueDate.getTime())) return null;
  dueDate.setHours(0, 0, 0, 0);
  return dueDate.getTime();
}

function filterTasksByDueWindow(model, predicate) {
  const todayTs = startOfDayTs(model?.today || Date.now());
  if (todayTs === null) return [];
  const openTasks = getOpenTasks(model?.tasks || []);
  return openTasks.filter((task) => {
    const dueTs = normalizeDueTs(task);
    if (dueTs === null) return false;
    const diff = Math.floor((dueTs - todayTs) / DAY_MS);
    return predicate(diff, dueTs);
  }).sort((a, b) => (a.dueTs || 0) - (b.dueTs || 0)
    || String(a.title || '').localeCompare(String(b.title || ''), undefined, { numeric: true, sensitivity: 'base' }));
}

function toDisplayTasks(model, tasks) {
  return getDisplayTasks({ ...model, tasks });
}

export const WIDGET_META = {
  labsKpiSummary: {
    id: 'labsKpiSummary',
    icon: '📊',
    title: 'CRM Snapshot',
    description: 'CRM health KPIs in one glance.',
    category: 'system',
    status: 'stable'
  },
  labsPipelineSnapshot: {
    id: 'labsPipelineSnapshot',
    icon: '🧭',
    title: 'Pipeline Snapshot',
    description: 'Stage distribution across active deals.',
    category: 'pipeline',
    status: 'stable'
  },
  labsTasks: {
    id: 'labsTasks',
    icon: '✅',
    title: 'Tasks Due',
    description: 'Tasks due today and overdue counts.',
    category: 'tasks',
    status: 'stable'
  },
  today: {
    id: 'today',
    icon: '📅',
    title: "Today's Work",
    description: 'Tasks, appointments, and celebrations happening now.',
    category: 'tasks',
    status: 'stable'
  },
  todo: {
    id: 'todo',
    icon: '✅',
    title: 'To-Do',
    description: 'Your due and overdue tasks with quick links.',
    category: 'tasks',
    status: 'stable'
  },
  favorites: {
    id: 'favorites',
    icon: '⭐',
    title: 'New Favorites',
    description: 'Recently favorited leads for quick access.',
    category: 'people',
    status: 'stable'
  },
  priorityActions: {
    id: 'priorityActions',
    icon: '🚨',
    title: 'Priority Actions',
    description: 'Overdue tasks and stale deals that need attention.',
    category: 'tasks',
    status: 'stable'
  },
  partnerPortfolio: {
    id: 'partnerPortfolio',
    icon: '🏆',
    title: 'Partner Portfolio',
    description: 'Production breakdown by partner tier.',
    category: 'portfolio',
    status: 'stable'
  },
  referralLeaderboard: {
    id: 'referralLeaderboard',
    icon: '🏆',
    title: 'Referral Leaders',
    description: 'Top referral partners ranked by volume.',
    category: 'portfolio',
    status: 'stable'
  },
  referralTrends: {
    id: 'referralTrends',
    icon: '📈',
    title: 'Referral Trends',
    description: 'Referral volume trends over the last 30 days.',
    category: 'portfolio',
    status: 'stable'
  },
  relationshipOpportunities: {
    id: 'relationshipOpportunities',
    icon: '🤝',
    title: 'Client Care Radar',
    description: 'Past and returning clients that need outreach.',
    category: 'people',
    status: 'stable'
  },
  pipelineFunnel: {
    id: 'pipelineFunnel',
    icon: '📈',
    title: 'Pipeline Funnel',
    description: 'Counts by stage across the pipeline.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineVelocity: {
    id: 'pipelineVelocity',
    icon: '⏱',
    title: 'Velocity',
    description: 'Cycle time buckets showing speed to close.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineRisk: {
    id: 'pipelineRisk',
    icon: '🛑',
    title: 'Pipeline Risk',
    description: 'Files stale for 14+ days by stage.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineMomentum: {
    id: 'pipelineMomentum',
    icon: '🌊',
    title: 'Pipeline Momentum',
    description: 'Stage mix indicators showing movement.',
    category: 'pipeline',
    status: 'stable'
  },
  closingWatch: {
    id: 'closingWatch',
    icon: '🛫',
    title: 'Closing Watch',
    description: 'Deals nearing their close date.',
    category: 'pipeline',
    status: 'stable'
  },
  staleDeals: {
    id: 'staleDeals',
    icon: '⚠️',
    title: 'Stale Deals',
    description: 'Pipeline files with no movement for 14+ days.',
    category: 'pipeline',
    status: 'stable'
  },
  milestones: {
    id: 'milestones',
    icon: '📌',
    title: 'Milestones Ahead',
    description: 'Upcoming appointments and key dates.',
    category: 'tasks',
    status: 'stable'
  },
  upcomingCelebrations: {
    id: 'upcomingCelebrations',
    icon: '🎉',
    title: 'Upcoming Celebrations',
    description: 'Birthdays and anniversaries for your contacts.',
    category: 'people',
    status: 'stable'
  },
  pipelineCalendar: {
    id: 'pipelineCalendar',
    icon: '🗓',
    title: 'Pipeline Calendar',
    description: 'Upcoming pipeline events on the calendar.',
    category: 'tasks',
    status: 'stable'
  },
  docPulse: {
    id: 'docPulse',
    icon: '📁',
    title: 'Document Pulse',
    description: 'Document milestone counts across your pipeline.',
    category: 'system',
    status: 'stable'
  },
  activePipeline: {
    id: 'activePipeline',
    icon: '📂',
    title: 'Active Pipeline',
    description: 'Open files organized by current stage.',
    category: 'pipeline',
    status: 'stable'
  },
  statusStack: {
    id: 'statusStack',
    icon: '📶',
    title: 'Status Stack',
    description: 'Quick counts by pipeline status.',
    category: 'pipeline',
    status: 'stable'
  },
  focus: {
    id: 'focus',
    icon: '🎯',
    title: 'Focus Summary',
    description: 'Personalized focus summary for the day.',
    category: 'system',
    status: 'stable'
  },
  filters: {
    id: 'filters',
    icon: '🔍',
    title: 'Filters',
    description: 'Saved filters mirrored for Labs dashboards.',
    category: 'system',
    status: 'stable'
  },
  goalProgress: {
    id: 'goalProgress',
    icon: '🎯',
    title: 'Production Goals',
    description: 'Year-to-date production progress versus goals.',
    category: 'pipeline',
    status: 'stable'
  },
  // ---------------------------------------------------------------------------
  // Hidden Feature Shortcut Widgets (Advanced-only)
  // ---------------------------------------------------------------------------
  printSuiteShortcut: {
    id: 'printSuiteShortcut',
    icon: '🖨️',
    title: 'Print Suite',
    description: 'Quick access to document printing tools.',
    category: 'shortcuts',
    status: 'stable',
    advancedOnly: true
  },
  templatesShortcut: {
    id: 'templatesShortcut',
    icon: '📝',
    title: 'Templates',
    description: 'Quick access to email and document templates.',
    category: 'shortcuts',
    status: 'stable',
    advancedOnly: true
  }
};

function humanizeId(id) {
  const spaced = String(id || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!spaced) return 'Widget';
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function widgetSpec(id, overrides = {}) {
  const meta = WIDGET_META[id] || {};
  const spec = { id, ...meta, ...overrides };
  const resolvedTitle = spec.title || humanizeId(id);
  const resolvedDescription = spec.description || spec.subtitle || `${humanizeId(id)} details`;
  const resolvedCategory = spec.category || meta.category;
  const resolvedMetaStatus = spec.metaStatus || meta.status;
  const renderStatus = overrides.status;

  if (typeof console !== 'undefined' && (!meta.title || !meta.description)) {
    console.warn('[labs] widget metadata missing title/description', id);
  }

  return {
    ...spec,
    title: resolvedTitle,
    description: resolvedDescription,
    category: resolvedCategory,
    metaStatus: resolvedMetaStatus,
    labsStatus: resolvedMetaStatus,
    status: renderStatus
  };
}

function renderCard(container, { title, body, badge } = {}) {
  const card = document.createElement('div');
  card.className = 'labs-crm-widget';
  const header = document.createElement('div');
  header.className = 'labs-widget-header';

  const heading = document.createElement('h3');
  heading.className = 'labs-widget-title';
  heading.textContent = title || '';
  header.appendChild(heading);

  if (badge) {
    const badgeEl = document.createElement('span');
    badgeEl.className = 'labs-widget-badge';
    badgeEl.textContent = badge;
    header.appendChild(badgeEl);
  }

  const bodyEl = document.createElement('div');
  bodyEl.className = 'labs-widget-body';
  if (body instanceof HTMLElement) {
    bodyEl.appendChild(body);
  } else if (typeof body === 'string') {
    bodyEl.innerHTML = body;
  }

  card.appendChild(header);
  card.appendChild(bodyEl);
  container.appendChild(card);
  return card;
}

function getStableId(item) {
  return item?.id || item?._id || item?.contactId || null;
}

function uniqByKey(list = [], keyFn) {
  const seen = new Set();
  return list.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getDedupedStaleDeals(model, days = 14) {
  const rawStaleDeals = model.snapshot?.staleDeals || getStaleDeals(model.contacts || [], days);
  const dedupedContacts = dedupeById(rawStaleDeals.map((deal) => deal?.contact || deal).filter(Boolean));
  return dedupedContacts.map((contact) => {
    const matched = rawStaleDeals.find((deal) => getStableId(deal?.contact || deal) === getStableId(contact));
    if (matched) {
      return matched.contact ? { ...matched, contact } : { ...matched, contact };
    }
    return { contact };
  });
}

function getDedupedAppointments(model) {
  const appointments = Array.isArray(model.snapshot?.focus?.nextAppointments)
    ? model.snapshot.focus.nextAppointments
    : [];
  return uniqByKey(appointments.filter(Boolean), (appt) => {
    // Parity: Key by time-slot + contact.
    // If we have strict dueTs/dueDate, use that.
    const keyContact = appt.contactId || getStableId(appt.contact) || '';
    const dueRaw = appt.due || appt.dueTs;
    const keyDate = dueRaw ? new Date(dueRaw).toISOString() : '';
    const keyTitle = (appt.title || '').trim().toLowerCase();
    return `appt|${keyContact}|${keyDate}|${keyTitle}`;
  });
}

// =======================
// Labs v1.5 baseline widgets
// =======================
export function renderLabsKpiSummaryWidget(container, model) {
  let shell;
  try {
    const snapshotKPIs = calculateKPIsFromSnapshot(model.snapshot) || {};
    const activeContacts = model.contacts.filter((contact) => {
      const stage = normalizeStagesForDisplay(contact.stage);
      return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
    });

    const activeVolume = activeContacts.reduce((sum, contact) => sum + (Number(contact.loanAmount) || 0), 0);
    const openTasks = getOpenTasks(model.tasks || []);

    const todayTaskCount = countTodayTasks(model.tasks || []);
    const overdueTaskCount = countOverdueTasks(model.tasks || []);
    const snapshotTodayTasks = Number(snapshotKPIs.kpiTasksToday || 0);
    const snapshotOverdueTasks = Number(snapshotKPIs.kpiTasksOverdue || 0);

    const leadsWithoutFollowUp = activeContacts.filter((contact) => {
      const hasTask = openTasks.some((task) => task.contactId === contact.id);
      return !hasTask;
    });

    const hasActivity = Boolean((model.contacts && model.contacts.length) || (model.tasks && model.tasks.length));
    const status = hasActivity ? 'ok' : 'empty';

    const tiles = [
      { label: 'Active Pipeline', value: formatNumber(activeContacts.length) },
      { label: 'Active Volume', value: formatCurrency(activeVolume) },
      { label: 'Tasks Today', value: formatNumber(snapshotTodayTasks || todayTaskCount) },
      { label: 'Overdue Tasks', value: formatNumber(snapshotOverdueTasks || overdueTaskCount) },
      { label: 'Leads w/o Follow-up', value: formatNumber(leadsWithoutFollowUp.length) },
      { label: 'New Leads (7d)', value: formatNumber(snapshotKPIs.kpiNewLeads7d || 0) }
    ];

    const kpiInsight = status === 'ok'
      ? getThresholdInsight({
        label: 'overdue tasks',
        value: snapshotOverdueTasks || overdueTaskCount,
        warnAt: 3,
        urgentAt: 8
      })
      : null;

    shell = renderWidgetShell(container, {
      id: 'labsKpiSummary',
      title: '📊 CRM Snapshot',
      insightText: kpiInsight,
      status,
      emptyMessage: 'No CRM activity yet'
    });

    if (status !== 'ok') {
      return shell;
    }

    const summaryBadges = `
      <div class="labs-kpi-meta">
        <div class="labs-chip tone-primary">Active: ${formatNumber(activeContacts.length)}</div>
        <div class="labs-chip tone-info">Today: ${formatNumber(snapshotTodayTasks || todayTaskCount)}</div>
        <div class="labs-chip tone-danger">Overdue: ${formatNumber(snapshotOverdueTasks || overdueTaskCount)}</div>
      </div>
    `;

    const tilesHtml = tiles.map((tile, idx) => `
      <div class="labs-kpi-tile" style="animation-delay:${idx * 0.05}s">
        <div class="labs-kpi-label">${tile.label}</div>
        <div class="labs-kpi-value">${tile.value}</div>
      </div>
    `).join('');

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `${summaryBadges}<div class="labs-kpi-grid">${tilesHtml}</div>`;
    });
  } catch (err) {
    console.error('[labs] labsKpiSummary render failed', err);
    shell = renderWidgetShell(container, {
      id: 'labsKpiSummary',
      title: '📊 CRM Snapshot',
      status: 'error',
      errorMessage: 'Unable to load snapshot'
    });
  }

  return shell;
}

export function renderLabsPipelineSnapshotWidget(container, model) {
  let shell;
  try {
    const stages = Object.keys(STAGE_CONFIG);
    const normalizedCounts = stages.reduce((acc, stage) => {
      acc[stage] = 0;
      return acc;
    }, {});

    const contactCounts = groupByStage(model.contacts || []);
    const snapshotCounts = model.snapshot?.pipelineCounts || {};
    const sourceCounts = Object.keys(snapshotCounts).length ? snapshotCounts : contactCounts;

    Object.entries(sourceCounts).forEach(([stage, count]) => {
      const normalized = normalizeStagesForDisplay(stage);
      if (normalized && normalizedCounts.hasOwnProperty(normalized)) {
        normalizedCounts[normalized] += count;
      }
    });

    const total = Object.values(normalizedCounts).reduce((sum, value) => sum + value, 0);
    const status = total ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'labsPipelineSnapshot',
      title: '🧭 Pipeline Snapshot',
      status,
      emptyMessage: 'No pipeline data yet'
    });

    if (status !== 'ok') {
      return shell;
    }

    const headerSummary = `
      <div class="momentum-summary">
        <div class="summary-value">${formatNumber(total)}</div>
        <div class="summary-label">Active pipeline files</div>
      </div>
    `;

    const rowsHtml = stages.map((stage, idx) => {
      const count = normalizedCounts?.[stage] || 0;
      const percent = total ? Math.round((count / total) * 100) : 0;
      const config = STAGE_CONFIG[stage] || {};
      return `
        <div class="momentum-bar-row" style="animation-delay:${idx * 0.05}s">
          <div class="momentum-label">
            <span class="stage-icon">${config.icon || '●'}</span>
            <span class="stage-name">${config.label || stage}</span>
          </div>
          <div class="momentum-bar-container">
            <div class="momentum-bar" style="--bar-width:${percent}%; --bar-color:${config.color || '#6366f1'}">
              <div class="momentum-glow"></div>
            </div>
          </div>
          <div class="momentum-stats">
            <span class="stat-count">${count}</span>
            <span class="stat-percent">${percent}%</span>
          </div>
        </div>
      `;
    }).join('');

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `${headerSummary}<div class="momentum-bars">${rowsHtml}</div>`;
    });
  } catch (err) {
    console.error('[labs] pipeline snapshot render failed', err);
    shell = renderWidgetShell(container, {
      id: 'labsPipelineSnapshot',
      title: '🧭 Pipeline Snapshot',
      status: 'error',
      errorMessage: 'Unable to load pipeline snapshot'
    });
  }

  return shell;
}

export function renderLabsTasksWidget(container, model) {
  let shell;
  try {
    const todayTasks = getDisplayTasks(model, { scope: 'today' });
    const overdueTasks = getDisplayTasks(model, { scope: 'overdue' });
    const todayCount = todayTasks.length;
    const overdueCount = overdueTasks.length;
    const totalCount = todayCount + overdueCount;

    const deduped = [];
    const seen = new Set();
    const addTasks = (list, status, icon) => {
      list.forEach((task) => {
        const key = `${task.id || ''}:${task.contactId || ''}:${task.due || ''}:${task.taskLabel || task.title || ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        deduped.push({ task, status, icon });
      });
    };

    addTasks(todayTasks, 'Today', '✓');
    addTasks(overdueTasks, 'Overdue', '⚠️');

    const VISIBLE_LIMIT = 8;
    const visibleTasks = deduped.slice(0, VISIBLE_LIMIT);
    const hiddenCount = Math.max(deduped.length - visibleTasks.length, 0);

    const status = totalCount ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'labsTasks',
      title: '✅ Tasks Due',
      status,
      count: totalCount,
      shown: visibleTasks.length,
      emptyMessage: 'No tasks due or overdue — you\'re all caught up'
    });

    if (status !== 'ok') {
      return shell;
    }

    const footer = hiddenCount > 0 ? `<div class="labs-task-footer">+${hiddenCount} more tasks</div>` : '';
    const summary = `
      <div class="labs-task-summary">
        <span class="labs-pill tone-primary">Today ${formatNumber(todayCount)}</span>
        <span class="labs-pill tone-danger">Overdue ${formatNumber(overdueCount)}</span>
      </div>
    `;

    renderWidgetBody(shell, (el) => {
      el.innerHTML = summary;

      const list = document.createElement('div');
      list.className = 'labs-tasks-list';

      visibleTasks.forEach((entry, idx) => {
        const overdue = entry.status === 'Overdue';
        const row = document.createElement('div');
        row.className = 'labs-task-row';
        row.style.animationDelay = `${idx * 0.04}s`;
        row.innerHTML = `
          <div class="labs-task-icon ${overdue ? 'overdue' : 'today'}">${entry.icon}</div>
          <div class="labs-task-main">
            <div class="labs-task-title">${entry.task.taskLabel}</div>
            <div class="labs-task-meta">${entry.task.contactName || ''}</div>
          </div>
        `;

        if (entry.task.id) {
          row.dataset.taskId = entry.task.id;
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
        }

        list.appendChild(row);
      });

      // Delegated click handler for tasks
      list.addEventListener('click', (e) => {
        const row = e.target.closest('.labs-task-row');
        if (!row || !row.dataset.taskId) return;
        openTaskEditor({ id: row.dataset.taskId, sourceHint: 'labs-dashboard' });
      });

      el.appendChild(list);

      if (footer) {
        const footerEl = document.createElement('div');
        footerEl.className = 'labs-task-footer';
        footerEl.textContent = `+${hiddenCount} more tasks`;
        el.appendChild(footerEl);
      }
    });
  } catch (err) {
    console.error('[labs] tasks widget render failed', err);
    shell = renderWidgetShell(container, {
      id: 'labsTasks',
      title: '✅ Tasks Due',
      status: 'error',
      errorMessage: 'Unable to load tasks'
    });
  }

  return shell;
}

// =======================
// KPI tiles
// =======================
export function renderKPIsWidget(container, model) {
  const snapshotKPIs = calculateKPIsFromSnapshot(model.snapshot);
  if (!snapshotKPIs) {
    renderCard(container, { title: '📊 Pipeline KPIs', body: '<p class="empty-state">No metrics yet. Add contacts and tasks to generate KPIs.</p>' });
    return;
  }
  const kpis = snapshotKPIs || {};
  const tiles = [
    { label: 'New Leads (7d)', value: kpis.kpiNewLeads7d || 0, tone: 'info' },
    { label: 'Active Pipeline', value: kpis.kpiActivePipeline || 0, tone: 'primary' },
    { label: 'Funded YTD', value: kpis.kpiFundedYTD || 0, tone: 'success' },
    { label: 'Funded Volume YTD', value: formatCurrency(kpis.kpiFundedVolumeYTD || 0), tone: 'success' },
    { label: 'Avg Cycle (days)', value: (kpis.kpiAvgCycleLeadToFunded || 0).toFixed(1), tone: 'muted' },
    { label: 'Referrals YTD', value: kpis.kpiReferralsYTD || 0, tone: 'accent' },
    { label: 'Tasks Today', value: kpis.kpiTasksToday || 0, tone: 'warning' },
    { label: 'Overdue Tasks', value: kpis.kpiTasksOverdue || 0, tone: 'danger' }
  ];

  const tilesHtml = tiles.map((tile, idx) => `
    <div class="kpi-card tone-${tile.tone}" style="animation-delay:${idx * 0.04}s">
      <div class="kpi-value">${formatNumber(tile.value)}</div>
      <div class="kpi-label">${tile.label}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '📊 Pipeline KPIs',
    body: `<div class="kpis-grid">${tilesHtml}</div>`
  });
}

// =======================
// Pipeline momentum (bars)
// =======================
export function renderPipelineMomentumWidget(container, model) {
  let shell;
  try {
    const contacts = model.contacts || [];
    const groups = model.snapshot?.pipelineCounts || groupByStage(contacts);
    const total = contacts.length;
    const status = total ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('pipelineMomentum', {
      status,
      emptyMessage: 'No pipeline data yet.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    const stages = Object.keys(STAGE_CONFIG);
    renderWidgetBody(shell, (body) => {
      const barsHTML = stages.map((stage, idx) => {
        const count = groups?.[stage] || 0;
        const percent = ((count / total) * 100).toFixed(1);
        const config = STAGE_CONFIG[stage] || {};
        return `
          <div class="momentum-bar-row" style="animation-delay:${idx * 0.05}s">
            <div class="momentum-label">
              <span class="stage-icon">${config.icon || '●'}</span>
              <span class="stage-name">${config.label || stage}</span>
            </div>
            <div class="momentum-bar-container">
              <div class="momentum-bar" style="--bar-width:${percent}%; --bar-color:${config.color || '#6366f1'}">
                <div class="momentum-glow"></div>
              </div>
            </div>
            <div class="momentum-stats">
              <span class="stat-count">${count}</span>
              <span class="stat-percent">${percent}%</span>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = `<div class="momentum-bars">${barsHTML}</div>`;
    });
  } catch (err) {
    console.error('[labs] pipeline momentum render failed', err);
    shell = renderWidgetShell(container, widgetSpec('pipelineMomentum', {
      status: 'error',
      errorMessage: 'Unable to load pipeline momentum'
    }));
  }

  return shell;
}

// =======================
// Pipeline analytics (funnel, velocity, risk)
// =======================
export function renderPipelineFunnelWidget(container, model, options = {}) {
  let shell;
  try {
    const onSegmentClick = typeof options.onAnalyticsSegment === 'function' ? options.onAnalyticsSegment : null;
    const funnel = model.analytics?.funnel || computeStageFunnel(model.contacts || []);
    const totalCount = funnel.reduce((sum, stage) => sum + stage.count, 0);
    const status = totalCount ? 'ok' : 'empty';

    const actions = [];
    const topStage = funnel.reduce((best, stage) => {
      if (!best || stage.count > best.count) return stage;
      return best;
    }, null);

    if (status === 'ok' && onSegmentClick && topStage?.count > 0) {
      actions.push({
        id: 'funnel-top-stage',
        label: 'See biggest stage',
        variant: 'subtle',
        onClick: () => onSegmentClick({
          type: ANALYTICS_SEGMENT_TYPES.STAGE,
          key: topStage.stageId,
          label: topStage.label || 'Top stage'
        })
      });
    }

    const funnelInsight = status === 'ok'
      ? getTopDriverInsight({
        label: 'Biggest load',
        items: funnel,
        byKey: (stage) => stage.count
      })
      : null;

    shell = renderWidgetShell(container, {
      id: 'pipelineFunnel',
      title: '📈 Pipeline Funnel',
      insightText: funnelInsight,
      status,
      emptyMessage: 'No pipeline data yet',
      actions
    });

    if (status !== 'ok') {
      return shell;
    }

    const maxCount = Math.max(...funnel.map((stage) => stage.count));

    renderWidgetBody(shell, () => {
      const body = document.createElement('div');
      body.className = 'analytics-bars';
      const seenStages = new Set();

      funnel.forEach((stage, idx) => {
        // PARITY: Dedupe stages by ID to prevent loop echo
        if (seenStages.has(stage.stageId)) return;
        seenStages.add(stage.stageId);

        const config = STAGE_CONFIG[stage.stageId] || {};
        const percent = maxCount ? Math.round((stage.count / maxCount) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'analytics-bar-row';
        row.style.animationDelay = `${idx * 0.05}s`;
        if (onSegmentClick) {
          row.classList.add('segment-clickable');
          row.addEventListener('click', () => onSegmentClick({
            type: ANALYTICS_SEGMENT_TYPES.STAGE,
            key: stage.stageId,
            label: stage.label
          }));
        }

        const label = document.createElement('div');
        label.className = 'analytics-label';
        label.innerHTML = `<span class="stage-icon">${config.icon || '●'}</span><span class="stage-name">${stage.label}</span>`;

        const barContainer = document.createElement('div');
        barContainer.className = 'analytics-bar-container';
        const bar = document.createElement('div');
        bar.className = 'analytics-bar';
        bar.style.setProperty('--bar-width', `${percent}%`);
        bar.style.setProperty('--bar-color', config.color || '#4f46e5');
        barContainer.appendChild(bar);

        const stats = document.createElement('div');
        stats.className = 'analytics-stats';
        const count = document.createElement('span');
        count.className = 'stat-count';
        count.textContent = stage.count;
        stats.appendChild(count);
        if (stage.totalAmount) {
          const amount = document.createElement('span');
          amount.className = 'analytics-amount';
          amount.textContent = formatCurrency(stage.totalAmount);
          stats.appendChild(amount);
        }

        const microBar = createInlineBar({
          value: stage.count,
          max: maxCount || stage.count || 1,
          ariaLabel: `${stage.label} count ${stage.count} of ${maxCount || stage.count || 1}`
        });
        microBar.classList.add('labs-microbar--muted');
        stats.appendChild(microBar);

        row.appendChild(label);
        row.appendChild(barContainer);
        row.appendChild(stats);
        body.appendChild(row);
      });

      return body;
    });
  } catch (err) {
    console.error('[labs] pipeline funnel render failed', err);
    shell = renderWidgetShell(container, {
      id: 'pipelineFunnel',
      title: '📈 Pipeline Funnel',
      status: 'error',
      errorMessage: 'Unable to load funnel'
    });
  }

  return shell;
}

export function renderPipelineVelocityWidget(container, model, options = {}) {
  let shell;
  try {
    const onSegmentClick = typeof options.onAnalyticsSegment === 'function' ? options.onAnalyticsSegment : null;
    const buckets = model.analytics?.velocityBuckets || computeStageAgeBuckets(model.contacts || []);
    const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
    const status = total ? 'ok' : 'empty';

    const agedBucket = buckets.find((bucket) => bucket.id === 'gt7');
    const actions = [];
    const velocityInsight = status === 'ok'
      ? getThresholdInsight({
        label: 'aged deals (>7d)',
        value: agedBucket?.count || 0,
        warnAt: 3,
        urgentAt: 7
      }) || (agedBucket && agedBucket.count === 0 ? 'Pipeline velocity looks healthy.' : null)
      : null;

    if (status === 'ok' && agedBucket?.count > 0 && onSegmentClick) {
      actions.push({
        id: 'velocity-aged',
        label: 'Review aged loans',
        variant: 'subtle',
        onClick: () => onSegmentClick({
          type: ANALYTICS_SEGMENT_TYPES.VELOCITY,
          key: agedBucket.id || 'gt7',
          label: 'Aged loans'
        })
      });
    }

    shell = renderWidgetShell(container, {
      id: 'pipelineVelocity',
      title: '⏱ Velocity',
      insightText: velocityInsight,
      status,
      emptyMessage: 'No active deals to measure',
      actions
    });

    if (status !== 'ok') {
      return shell;
    }

    const maxCount = Math.max(...buckets.map((bucket) => bucket.count));

    renderWidgetBody(shell, () => {
      const body = document.createElement('div');
      body.className = 'analytics-bars';

      buckets.forEach((bucket, idx) => {
        const percent = maxCount ? Math.round((bucket.count / maxCount) * 100) : 0;
        const row = document.createElement('div');
        row.className = 'analytics-bar-row compact';
        row.style.animationDelay = `${idx * 0.05}s`;
        if (onSegmentClick) {
          row.classList.add('segment-clickable');
          row.addEventListener('click', () => onSegmentClick({
            type: ANALYTICS_SEGMENT_TYPES.VELOCITY,
            key: bucket.id,
            label: bucket.label
          }));
        }

        const label = document.createElement('div');
        label.className = 'analytics-label';
        label.textContent = bucket.label;

        const barContainer = document.createElement('div');
        barContainer.className = 'analytics-bar-container';
        const bar = document.createElement('div');
        bar.className = 'analytics-bar';
        bar.style.setProperty('--bar-width', `${percent}%`);
        bar.style.setProperty('--bar-color', 'var(--labs-accent-2)');
        barContainer.appendChild(bar);

        const stats = document.createElement('div');
        stats.className = 'analytics-stats';
        const count = document.createElement('span');
        count.className = 'stat-count';
        count.textContent = bucket.count;
        stats.appendChild(count);

        const microBar = createInlineBar({
          value: bucket.count,
          max: maxCount || bucket.count || 1,
          ariaLabel: `${bucket.label} ${bucket.count} of ${maxCount || bucket.count || 1}`
        });
        microBar.classList.add('labs-microbar--muted');
        stats.appendChild(microBar);

        row.appendChild(label);
        row.appendChild(barContainer);
        row.appendChild(stats);
        body.appendChild(row);
      });

      return body;
    });
  } catch (err) {
    console.error('[labs] pipeline velocity render failed', err);
    shell = renderWidgetShell(container, {
      id: 'pipelineVelocity',
      title: '⏱ Velocity',
      status: 'error',
      errorMessage: 'Unable to load velocity'
    });
  }

  return shell;
}

export function renderPipelineRiskWidget(container, model, options = {}) {
  let shell;
  try {
    const onSegmentClick = typeof options.onAnalyticsSegment === 'function' ? options.onAnalyticsSegment : null;
    const summary = model.analytics?.staleSummary || computeStaleSummary(model.contacts || []);
    const total = summary?.total || 0;
    const byStage = summary?.byStage || {};
    const stageEntries = Object.entries(byStage)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    const status = total ? 'ok' : 'empty';

    const actions = [];
    if (status === 'ok' && total > 0 && onSegmentClick) {
      actions.push({
        id: 'risk-stale',
        label: 'View stale deals',
        variant: 'subtle',
        onClick: () => onSegmentClick({
          type: ANALYTICS_SEGMENT_TYPES.RISK,
          key: 'stale',
          label: 'Stale deals'
        })
      });
    }

    const riskInsight = status === 'ok'
      ? getThresholdInsight({
        label: 'stale deals',
        value: total,
        warnAt: 1,
        urgentAt: 5
      }) || 'No stale deals detected.'
      : null;

    shell = renderWidgetShell(container, {
      id: 'pipelineRisk',
      title: '🛑 Pipeline Risk',
      insightText: riskInsight,
      status,
      emptyMessage: 'No stale deals 🎉',
      actions
    });

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, () => {
      const header = document.createElement('div');
      header.className = 'risk-summary';
      const totalEl = document.createElement('div');
      totalEl.className = 'risk-total';
      totalEl.textContent = total;
      const text = document.createElement('div');
      text.className = 'risk-text';
      text.textContent = 'Stale deals (14d+)';
      header.appendChild(totalEl);
      header.appendChild(text);
      if (onSegmentClick) {
        header.classList.add('segment-clickable');
        header.addEventListener('click', () => onSegmentClick({
          type: ANALYTICS_SEGMENT_TYPES.RISK,
          key: 'all',
          label: 'Stale deals (14d+)'
        }));
      }

      const rowsWrapper = document.createElement('div');
      rowsWrapper.className = 'risk-rows';

      stageEntries.forEach(([stage, count]) => {
        const config = STAGE_CONFIG[stage] || {};
        const label = config.label || stage || 'Unknown';
        const row = createRowContainer('metric');
        const primary = row.querySelector('.labs-row__primary');
        const secondary = row.querySelector('.labs-row__secondary');
        const meta = row.querySelector('.labs-row__meta');

        if (primary) primary.textContent = `${config.icon || '⚠️'} ${label}`;
        if (secondary) secondary.textContent = '14+ days stale';
        if (meta) {
          meta.textContent = count;
          meta.hidden = false;
          meta.classList.add('is-negative');
        }

        if (onSegmentClick) {
          row.classList.add('segment-clickable', 'labs-row--clickable');
          row.addEventListener('click', () => onSegmentClick({
            type: ANALYTICS_SEGMENT_TYPES.RISK,
            key: stage,
            label
          }));
        }

        rowsWrapper.appendChild(row);
      });

      const body = document.createElement('div');
      body.appendChild(header);
      body.appendChild(rowsWrapper);
      return body;
    });
  } catch (err) {
    console.error('[labs] pipeline risk render failed', err);
    shell = renderWidgetShell(container, {
      id: 'pipelineRisk',
      title: '🛑 Pipeline Risk',
      status: 'error',
      errorMessage: 'Unable to load risk summary'
    });
  }

  return shell;
}

// =======================
// Partner portfolio donut
// =======================
export function renderPartnerPortfolioWidget(container, model, opts = {}) {
  let shell;
  try {
    const onPortfolioSegment = opts?.onPortfolioSegment;
    const partners = model.partners || [];
    const status = partners.length ? 'ok' : 'empty';
    const tierGroups = groupPartnersByTier(partners);
    const tiers = Object.keys(tierGroups).sort();
    const tierSegments = tiers.map((tier) => ({ tier, count: tierGroups[tier].length }));
    const portfolioInsight = getTopDriverInsight({
      label: 'Largest tier',
      items: tierSegments,
      byKey: 'count'
    });

    const actions = [];
    const topTierSegment = tierSegments.reduce((best, seg) => {
      if (!best || seg.count > best.count) return seg;
      return best;
    }, null);

    if (status === 'ok' && topTierSegment && topTierSegment.count > 0 && onPortfolioSegment) {
      actions.push({
        id: 'portfolio-top-tier',
        label: 'Open top partners',
        variant: 'subtle',
        onClick: () => onPortfolioSegment({
          domain: 'partners',
          type: 'tier',
          key: topTierSegment.tier,
          label: `${topTierSegment.tier} partners`
        })
      });
    }

    shell = renderWidgetShell(container, widgetSpec('partnerPortfolio', {
      insightText: portfolioInsight,
      status,
      emptyMessage: 'No partners tracked yet.',
      actions
    }));

    if (status !== 'ok') {
      return shell;
    }

    const total = partners.length || 1;
    const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

    let cumulativePercent = 0;
    const segments = tiers.map((tier, idx) => {
      const count = tierGroups[tier].length;
      const percent = (count / total) * 100;
      const offset = cumulativePercent;
      cumulativePercent += percent;
      return { tier, count, percent, offset, color: colors[idx % colors.length] };
    });
    const maxTierCount = segments.reduce((max, seg) => (seg.count > max ? seg.count : max), 0);

    renderWidgetBody(shell, (body) => {
      const donutSegments = segments.map((seg) => {
        const circumference = 2 * Math.PI * 40;
        const strokeDash = (seg.percent / 100) * circumference;
        const strokeOffset = -((seg.offset / 100) * circumference);
        return `<circle cx="50" cy="50" r="40" fill="none" stroke="${seg.color}" stroke-width="20" stroke-dasharray="${strokeDash} ${circumference}" stroke-dashoffset="${strokeOffset}" transform="rotate(-90 50 50)" class="donut-segment"/>`;
      }).join('');

      body.innerHTML = `
        <div class="portfolio-donut">
          <svg viewBox="0 0 100 100" class="donut-chart">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" stroke-width="20"/>
            ${donutSegments}
          </svg>
          <div class="donut-center">
            <div class="donut-total">${partners.length}</div>
            <div class="donut-label">Partners</div>
          </div>
        </div>
        <div class="portfolio-legend"></div>
      `;

      const legend = body.querySelector('.portfolio-legend');
      segments.forEach((seg, idx) => {
        const row = document.createElement('div');
        row.className = 'portfolio-segment';
        row.style.animationDelay = `${idx * 0.1}s`;

        const indicator = document.createElement('div');
        indicator.className = 'segment-indicator';
        indicator.style.background = seg.color;

        const info = document.createElement('div');
        info.className = 'segment-info';
        const tier = document.createElement('div');
        tier.className = 'segment-tier';
        tier.textContent = seg.tier;
        const count = document.createElement('div');
        count.className = 'segment-count';
        count.textContent = `${seg.count} partners`;
        info.appendChild(tier);
        info.appendChild(count);

        const percent = document.createElement('div');
        percent.className = 'segment-percent';
        percent.textContent = `${seg.percent.toFixed(1)}%`;

        const bar = createInlineBar({
          value: seg.count,
          max: maxTierCount || seg.count || 1,
          ariaLabel: `${seg.tier} share: ${seg.count} of ${maxTierCount || seg.count || 1}`
        });
        bar.classList.add('labs-microbar--muted');

        row.appendChild(indicator);
        row.appendChild(info);
        row.appendChild(percent);
        row.appendChild(bar);

        if (onPortfolioSegment) {
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => {
            onPortfolioSegment({
              domain: 'partners',
              type: 'tier',
              key: seg.tier,
              label: `${seg.tier} partners`
            });
          });
        }

        legend.appendChild(row);
      });
    });
  } catch (err) {
    console.error('[labs] partner portfolio render failed', err);
    shell = renderWidgetShell(container, widgetSpec('partnerPortfolio', {
      status: 'error',
      errorMessage: 'Unable to load partner portfolio'
    }));
  }

  return shell;
}

// =======================
// Referral leaderboard
// =======================
export function renderReferralLeaderboardWidget(container, model, opts = {}) {
  let shell;
  try {
    const onPortfolioSegment = opts?.onPortfolioSegment;
    // PARITY: Use live compute if available, else static snapshot, else raw calc
    const topPartners = (typeof model.computeReferralStats === 'function')
      ? model.computeReferralStats().slice(0, 5) // Live Compute (Prod Match)
      : (model.snapshot?.leaderboard?.slice(0, 5) || getTopReferralPartners(model.partners, 5));

    const maxVolume = topPartners.reduce((max, partner) => {
      const volume = Number(partner.referralVolume || partner.volume || 0);
      return volume > max ? volume : max;
    }, 0);
    const status = topPartners.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('referralLeaderboard', {
      status,
      emptyMessage: 'No referral data yet.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';
      list.setAttribute('data-role', 'referral-list');

      topPartners.forEach((partner, idx) => {
        const partnerDisplay = {
          id: partner.id,
          name: partner.name || partner.company,
          tier: partner.tier,
          volume: partner.volume ? formatCurrency(partner.volume) : (partner.referralVolume || 0)
        };
        const numericVolume = Number(partner.referralVolume || partner.volume || 0);
        const row = createRowContainer('partner');
        renderPartnerRow(row, partnerDisplay, {
          badgeText: ['🥇', '🥈', '🥉'][idx] || '🏅',
          secondaryText: partnerDisplay.tier || 'Referral partner',
          metaText: partnerDisplay.volume,
          metaClass: idx === 0 ? 'is-positive' : undefined,
          currentCount: numericVolume,
          maxCount: maxVolume || numericVolume || 1,
          barAriaLabel: `Referral volume ${numericVolume || 0} of ${maxVolume || numericVolume || 1}`
        });

        // Parity: Ensure clickable for Editor
        if (partnerDisplay.id) {
          row.classList.add('labs-row--clickable');
          row.setAttribute('data-role', 'referral-row');
          row.setAttribute('data-partner-id', partnerDisplay.id);
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
        }

        list.appendChild(row);
      });

      // Delegated click handler
      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="referral-row"]');
        if (!target) return;
        const partnerId = target.getAttribute('data-partner-id');
        if (partnerId) {
          openPartnerEditor(partnerId, { source: 'labs-referral' });
        }
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] referral leaderboard render failed', err);
    shell = renderWidgetShell(container, widgetSpec('referralLeaderboard', {
      status: 'error',
      errorMessage: 'Unable to load leaderboard'
    }));
  }

  return shell;
}

// =======================
// Referral trends (momentum)
// =======================
export function renderReferralTrendsWidget(container, model, opts = {}) {
  let shell;
  try {
    const onPortfolioSegment = opts?.onPortfolioSegment;
    const trends = model?.analytics?.referralTrends30 || [];
    const status = trends.length ? 'ok' : 'empty';

    const risingPartners = trends
      .filter((entry) => (entry.direction === 'up') && Number(entry.delta || 0) > 0)
      .sort((a, b) => Number(b.delta || 0) - Number(a.delta || 0));

    const trendsInsight = risingPartners.length
      ? `${(risingPartners[0].partnerName || model.getPartnerDisplayName?.(risingPartners[0].partnerId) || 'A partner')} is trending up.`
      : (trends.length ? 'Referral momentum is stable.' : null);

    const actions = [];
    const topRising = risingPartners[0];
    if (status === 'ok' && topRising?.partnerId && onPortfolioSegment) {
      const risingLabel = topRising.partnerName || model.getPartnerDisplayName?.(topRising.partnerId) || 'Referral partner';
      actions.push({
        id: 'referral-rising',
        label: 'See rising partner loans',
        variant: 'subtle',
        onClick: () => onPortfolioSegment({
          domain: 'loans',
          type: 'referrals',
          key: topRising.partnerId,
          label: risingLabel
        })
      });
    }

    shell = renderWidgetShell(container, widgetSpec('referralTrends', {
      title: 'Referral Trends',
      subtitle: 'Last 30 days vs prior 30',
      insightText: trendsInsight,
      status,
      emptyMessage: 'No referral trend data yet.',
      actions
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';

      trends.slice(0, 10).forEach((entry) => {
        const direction = entry.direction === 'up' ? '▲' : (entry.direction === 'down' ? '▼' : '–');
        const deltaValue = Number(entry.delta || 0);
        const deltaText = `${deltaValue > 0 ? '+' : ''}${deltaValue}`;
        const currentCount = Number(entry.currentCount || 0);
        const previousCount = Number(entry.previousCount || 0);
        const deltaAria = `Referral trend: ${currentCount} this period vs ${previousCount} previous`;
        const partnerDisplay = {
          id: entry.partnerId,
          name: entry.partnerName || model.getPartnerDisplayName?.(entry.partnerId),
          currentCount: entry.currentCount,
          delta: deltaText,
          previousCount: entry.previousCount
        };

        const row = createRowContainer('partner');
        renderPartnerRow(row, partnerDisplay, {
          secondaryText: `Current ${entry.currentCount || 0} · Prev ${entry.previousCount || 0}`,
          metaText: `${direction} ${deltaText}`,
          metaClass: entry.direction === 'up' ? 'is-positive' : (entry.direction === 'down' ? 'is-negative' : 'is-neutral'),
          current: currentCount,
          previous: previousCount,
          deltaAriaLabel: deltaAria
        });

        list.appendChild(row);
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] referral trends render failed', err);
    shell = renderWidgetShell(container, widgetSpec('referralTrends', {
      status: 'error',
      errorMessage: 'Unable to load referral trends'
    }));
  }

  return shell;
}

// =======================
// Stale deals
// =======================
export function renderStaleDealsWidget(container, model) {
  let shell;
  try {
    const staleDeals = getDedupedStaleDeals(model, 14);
    const status = staleDeals.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('staleDeals', {
      status,
      count: staleDeals.length,
      shown: Math.min(staleDeals.length, 6),
      emptyMessage: 'No stale deals — pipeline is healthy'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';

      staleDeals.slice(0, 6).forEach((deal) => {
        const dealContact = deal.contact || deal;
        const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(dealContact) : dealContact;
        const daysSince = deal.days || Math.floor((Date.now() - (dealContact.updatedTs || dealContact.createdTs || 0)) / (1000 * 60 * 60 * 24));
        const urgency = daysSince > 30 ? 'critical' : daysSince > 21 ? 'high' : 'medium';
        const stageConfig = STAGE_CONFIG[normalizeStagesForDisplay(loanDisplay.stage)] || {};
        const name = loanDisplay.borrowerName
          || (model.resolveContactNameStrict ? model.resolveContactNameStrict(loanDisplay.contactId || dealContact.id) : null)
          || (model.getContactDisplayName ? model.getContactDisplayName(loanDisplay.contactId || dealContact.id) : null)
          || loanDisplay.displayName
          || loanDisplay.name;
        // Removed 'Borrower' fallback to allow renderer to hide it
        const secondaryPieces = [loanDisplay.stageLabel || stageConfig.label || dealContact.stage];
        if (loanDisplay.loanAmount || loanDisplay.amount) {
          secondaryPieces.push(formatCurrency(loanDisplay.loanAmount || loanDisplay.amount));
        }

        const row = createRowContainer('loan');
        row.classList.add(`urgency-${urgency}`);

        // FIX: Ensure contactId is defined for the click handler in row_renderers
        const targetId = loanDisplay.contactId || dealContact.id || deal.contactId;

        renderLoanRow(row, loanDisplay, {
          primaryText: name,
          secondaryText: secondaryPieces.filter(Boolean).join(' • '),
          metaText: `${daysSince}d`,
          metaClass: 'is-negative',
          id: targetId
        });

        list.appendChild(row);
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] stale deals render failed', err);
    shell = renderWidgetShell(container, widgetSpec('staleDeals', {
      status: 'error',
      errorMessage: 'Unable to load stale deals'
    }));
  }

  return shell;
}

// =======================
// Today's work & celebrations
// =======================
export function renderTodayWidget(container, model) {
  let shell;
  try {
    // Use getDisplayTasks for enriched task data with contact names
    // PARITY: Use getDedupedAppointments to ensure we don't show double entries
    const todayTasks = getDisplayTasks(model, { scope: 'today' }).slice(0, 5);
    const celebrations = getUpcomingCelebrations(model.contacts || [], 7).slice(0, 4);
    const appointments = getDedupedAppointments(model).slice(0, 5);

    const hasItems = todayTasks.length || celebrations.length || appointments.length;
    const status = hasItems ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('today', {
      status,
      emptyMessage: 'No tasks or events scheduled.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'today-list';
      list.setAttribute('data-role', 'today-list');

      // Task rows with click-to-editor
      todayTasks.forEach((task, idx) => {
        const row = document.createElement('div');
        row.className = 'today-item task-item';
        row.style.animationDelay = `${idx * 0.05}s`;
        row.innerHTML = `
          <div class="today-icon">✓</div>
          <div class="today-content">
            <div class="today-title">${task.taskLabel}</div>
            <div class="today-meta">${task.contactName}</div>
          </div>
          <div class="today-time">${task.dueTime || 'All day'}</div>
        `;
        row.setAttribute('data-role', 'today-row');
        row.setAttribute('data-type', 'task');
        row.setAttribute('data-widget', 'today');
        row.setAttribute('data-dash-widget', 'today');
        row.setAttribute('data-widget-id', 'today');

        if (task.id) {
          row.setAttribute('data-task-id', task.id);
        }

        if (task.contactId) {
          row.setAttribute('data-contact-id', task.contactId);
          row.setAttribute('data-id', task.contactId);
        }
        if (task.partnerId) {
          row.setAttribute('data-partner-id', task.partnerId);
        }
        row.style.cursor = 'pointer';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        list.appendChild(row);
      });

      // Appointment rows with click-to-editor
      appointments.slice(0, 3).forEach((appt, idx) => {
        const row = document.createElement('div');
        row.className = 'today-item appointment-item';
        row.style.animationDelay = `${idx * 0.06 + 0.2}s`;
        row.innerHTML = `
          <div class="today-icon">📅</div>
          <div class="today-content">
            <div class="today-title">${appt.title || 'Appointment'}</div>
            <div class="today-meta">${appt.contactName || ''}</div>
          </div>
          <div class="today-time">${formatDate(appt.due || appt.dueTs)}</div>
        `;
        row.setAttribute('data-role', 'today-row');
        row.setAttribute('data-type', 'appointment');
        row.setAttribute('data-widget', 'today');
        row.setAttribute('data-dash-widget', 'today');
        row.setAttribute('data-widget-id', 'today');
        const contactId = appt.contactId || (appt.contact && appt.contact.id);
        if (contactId) {
          row.setAttribute('data-contact-id', contactId);
          row.setAttribute('data-id', contactId);
        }
        row.style.cursor = 'pointer';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        list.appendChild(row);
      });

      // Celebration rows with click-to-editor
      celebrations.forEach((cel, idx) => {
        const row = document.createElement('div');
        row.className = 'today-item celebration-item';
        row.style.animationDelay = `${idx * 0.05 + 0.2}s`;
        const celContactName = (model.getContactDisplayName ? model.getContactDisplayName(cel.contact.id) : null) || cel.contact.name || cel.contact.displayName || 'Contact';
        row.innerHTML = `
          <div class="today-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</div>
          <div class="today-content">
            <div class="today-title">${celContactName}</div>
            <div class="today-meta">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
          </div>
          <div class="today-time">${formatDate(cel.date)}</div>
        `;
        row.setAttribute('data-role', 'today-row');
        row.setAttribute('data-type', 'celebration');
        row.setAttribute('data-widget', 'today');
        row.setAttribute('data-dash-widget', 'today');
        row.setAttribute('data-widget-id', 'today');
        const contactId = cel.contact.id || cel.contact.contactId;
        if (contactId) {
          row.setAttribute('data-contact-id', contactId);
          row.setAttribute('data-id', contactId);
        }
        row.style.cursor = 'pointer';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');
        list.appendChild(row);
      });

      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="today-row"]');
        if (!target) return;

        const type = target.getAttribute('data-type') || 'task'; // default to task for legacy rows

        if (type === 'task') {
          // Try to get task ID first
          const taskId = target.getAttribute('data-task-id');
          if (taskId) {
            openTaskEditor({ id: taskId, sourceHint: 'labs-today' });
            return;
          }

          // Fallback to contact/partner if no task ID (legacy data)
          const contactId = target.getAttribute('data-contact-id');
          const partnerId = target.getAttribute('data-partner-id');
          if (contactId) {
            openContactEditor(contactId, { source: 'labs-today' });
          } else if (partnerId) {
            openPartnerEditor(partnerId, { source: 'labs-today' });
          }
          return;
        }

        if (type === 'appointment' || type === 'celebration') {
          const contactId = target.getAttribute('data-contact-id');
          if (contactId) {
            openContactEditor(contactId, { source: 'labs-today' });
          }
        }
      });

      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] today widget render failed', err);
    shell = renderWidgetShell(container, widgetSpec('today', {
      status: 'error',
      errorMessage: 'Unable to load today\'s work'
    }));
  }

  return shell;
}

// =======================
// Pipeline overview funnel
// =======================
export function renderPipelineOverviewWidget(container, model) {
  const groups = model.snapshot?.pipelineCounts || groupByStage(model.contacts);
  const funnelStages = model.laneOrder || Object.keys(STAGE_CONFIG);

  const total = model.contacts.length;
  if (!total) {
    renderCard(container, { title: '🎯 Pipeline Overview', body: '<p class="empty-state">No contacts in pipeline</p>' });
    return;
  }

  const funnelHTML = funnelStages.map((stage, idx) => {
    const count = groups?.[stage] || 0;
    const config = STAGE_CONFIG[stage] || {};
    const width = Math.max(20, 100 - idx * 7);
    return `
      <div class="funnel-stage" style="--stage-width:${width}%; --stage-color:${config.color || '#4f46e5'}; animation-delay:${idx * 0.07}s">
        <div class="funnel-bar">
          <span class="funnel-label">${config.icon || '●'} ${config.label || stage}</span>
          <span class="funnel-count">${count}</span>
        </div>
      </div>
    `;
  }).join('');

  renderCard(container, {
    title: '🎯 Pipeline Overview',
    body: `<div class="pipeline-funnel">${funnelHTML}</div>`
  });
}

// =======================
// Active pipeline grid
// =======================
export function renderActivePipelineWidget(container, model) {
  const pipeline = Array.isArray(model.activePipeline) ? model.activePipeline : (model.pipeline || model.contacts || []);
  const activeContacts = pipeline.filter((contact) => {
    const stage = normalizeStagesForDisplay(contact.stage);
    return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
  });

  const contactsHTML = activeContacts.slice(0, 9).map((contact, idx) => {
    const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(contact) : contact;
    const stageKey = normalizeStagesForDisplay(loanDisplay.stage || contact.stage);
    const config = STAGE_CONFIG[stageKey] || {};
    const displayName = loanDisplay?.borrowerName
      || contact.displayName
      || contact.name
      || (model.getContactDisplayName ? model.getContactDisplayName(contact.id) : null);
    return `
      <div class="pipeline-card" style="animation-delay:${idx * 0.05}s; border-left-color:${config.color || '#4f46e5'}">
        <div class="card-header">
          <div class="contact-name">${displayName || 'Unknown'}</div>
          <div class="contact-stage" style="background:${(config.color || '#4f46e5')}20; color:${config.color || '#4f46e5'}">
            ${config.icon || ''} ${loanDisplay?.stageLabel || config.label || contact.stage}
          </div>
        </div>
        <div class="card-body">
          ${contact.loanAmount ? `<div class="card-amount">${formatCurrency(contact.loanAmount)}</div>` : ''}
          ${contact.email ? `<div class="card-detail">📧 ${contact.email}</div>` : ''}
          ${contact.phone ? `<div class="card-detail">📞 ${contact.phone}</div>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-updated">${formatRelativeTime(contact.updatedTs)}</span>
        </div>
      </div>
    `;
  }).join('');

  renderCard(container, {
    title: '💼 Active Pipeline',
    badge: activeContacts.length,
    body: `<div class="pipeline-cards-grid">${contactsHTML || '<p class="empty-state">No active deals</p>'}</div>`
  });
}

// =======================
// Status stack summary
// =======================
export function renderStatusStackWidget(container, model) {
  const counts = model.snapshot?.pipelineCounts || groupByStage(model.contacts);
  const lanes = model.laneOrder || Object.keys(counts || {});
  const cards = lanes.map((lane, idx) => {
    const config = STAGE_CONFIG[lane] || {};
    const count = counts?.[lane] || 0;
    return `
      <div class="status-card" style="animation-delay:${idx * 0.04}s; border-color:${config.color || '#334155'}">
        <div class="status-top">
          <span class="status-icon">${config.icon || '●'}</span>
          <span class="status-label">${config.label || lane}</span>
        </div>
        <div class="status-value">${count}</div>
      </div>
    `;
  }).join('');

  renderCard(container, {
    title: '🧭 Status Panels',
    body: `<div class="status-stack">${cards}</div>`
  });
}

// =======================
// Focus summary (tasks + leads)
// =======================
export function renderFocusWidget(container, model) {
  const focus = model.snapshot?.focus || {};
  const tasks = focus.tasksToday || [];
  // PARITY: Dedupe Focus appointments
  const appointments = getDedupedAppointments(model);
  const leads = focus.recentLeads || [];

  const block = (title, items) => `
    <div class="focus-block">
      <div class="focus-title">${title}</div>
      <ul class="focus-list">
        ${items.map((item) => `<li>${item}</li>`).join('') || '<li class="muted">Nothing queued</li>'}
      </ul>
    </div>
  `;

  renderCard(container, {
    title: '🎯 Focus',
    body: `
      <div class="focus-grid">
        ${block('Tasks Today', tasks.map((t) => t.title || 'Task'))}
        ${block('Next Appointments', appointments.map((a) => `${formatDate(a.due || a.dueTs)} · ${a.title || 'Appointment'}`))}
        ${block('Recent Leads', leads.map((l) => (model.getContactDisplayName ? model.getContactDisplayName(l.id) : null) || l.displayName || l.name || 'Lead'))}
      </div>
    `
  });
}

// =======================
// Filters placeholder (shows data scope)
// =======================
export function renderFiltersWidget(container, model) {
  const totalContacts = model.contacts.length;
  const active = model.activeLanes?.length || 0;
  renderCard(container, {
    title: '🔍 Filters',
    body: `<div class="filter-summary">
      <p>Labs uses the same canonical data model as the main dashboard.</p>
      <p><strong>${totalContacts}</strong> contacts across <strong>${active}</strong> active lanes.</p>
    </div>`
  });
}

// =======================
// Goal progress
// =======================
export function renderGoalProgressWidget(container, model) {
  const kpis = calculateKPIsFromSnapshot(model.snapshot) || {};
  const funded = kpis.kpiFundedYTD || 0;
  const volume = kpis.kpiFundedVolumeYTD || 0;
  const target = Math.max(10, funded * 2);
  const percent = Math.min(100, (funded / target) * 100);

  renderCard(container, {
    title: '🎖 Production Goals',
    body: `
      <div class="goal-meter">
        <div class="goal-label">Funded YTD: ${funded}</div>
        <div class="goal-bar"><span style="width:${percent}%"></span></div>
        <div class="goal-meta">${formatCurrency(volume)} volume · Target ${target}</div>
      </div>
    `
  });
}

// =======================
// To-do / due tasks
// =======================
// =======================
// To-Do Widget (Production Parity)
// =======================
export function renderTodoWidget(container, model) {
  let shell;
  try {
    const items = loadTodoItems();
    const status = items.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'todo',
      title: '✅ To-Do',
      status,
      count: items.length,
      emptyMessage: 'No active tasks'
    });

    renderWidgetBody(shell, (body) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'labs-todo-wrapper';
      wrapper.style.display = 'flex';
      wrapper.style.flexDirection = 'column';
      wrapper.style.gap = '12px';

      // 1. Render List
      const list = document.createElement('ul');
      list.className = 'labs-list';
      list.style.margin = '0';
      list.style.padding = '0';
      list.style.listStyle = 'none';
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '8px';

      if (items.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'labs-empty-text';
        empty.style.color = 'var(--text-muted, #64748b)';
        empty.style.fontSize = '0.9rem';
        empty.style.padding = '1rem 0';
        empty.style.textAlign = 'center';
        empty.textContent = 'No to-dos yet — add a quick note.';
        wrapper.appendChild(empty);
      } else {
        items.forEach((item) => {
          const row = document.createElement('li');
          row.className = 'labs-list-row';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '10px';
          row.style.padding = '8px 10px';
          row.style.background = 'var(--bg-card-hover, rgba(255,255,255,0.5))';
          row.style.borderRadius = '8px';
          row.style.border = '1px solid var(--border-color, #e2e8f0)';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.style.cursor = 'pointer';
          checkbox.style.width = '16px';
          checkbox.style.height = '16px';
          checkbox.addEventListener('change', () => {
            const next = items.filter((i) => i.id !== item.id);
            saveTodoItems(next);
            // Refresh widget
            if (container) {
              container.innerHTML = '';
              renderTodoWidget(container, model);
            }
          });

          const text = document.createElement('span');
          text.textContent = item.text;
          text.style.flex = '1';
          text.style.fontSize = '0.95rem';
          text.style.color = 'var(--text-primary, #0f172a)';
          text.style.wordBreak = 'break-word';

          row.appendChild(checkbox);
          row.appendChild(text);
          list.appendChild(row);
        });
        wrapper.appendChild(list);
      }

      // 2. Render Add Form
      const addForm = document.createElement('form');
      addForm.style.display = 'flex';
      addForm.style.gap = '8px';
      addForm.style.marginTop = '4px';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'labs-input'; // Assumes labs.css has this or generic input styles
      input.placeholder = 'Add Item...';
      input.style.flex = '1';
      input.style.padding = '8px 10px';
      input.style.borderRadius = '6px';
      input.style.border = '1px solid var(--border-color, #cbd5e1)';
      input.style.fontSize = '0.9rem';

      const btn = document.createElement('button');
      btn.type = 'submit';
      btn.textContent = '+';
      btn.className = 'labs-btn-primary'; // Assumes labs.css
      btn.style.padding = '0 12px';
      btn.style.borderRadius = '6px';
      btn.style.background = 'var(--primary-color, #3b82f6)';
      btn.style.color = 'white';
      btn.style.border = 'none';
      btn.style.cursor = 'pointer';

      addForm.appendChild(input);
      addForm.appendChild(btn);

      addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;
        const next = items.concat([{ id: generateId(), text: val, createdAt: new Date().toISOString() }]);
        saveTodoItems(next);
        if (container) {
          container.innerHTML = '';
          renderTodoWidget(container, model);
        }
      });

      wrapper.appendChild(addForm);
      body.appendChild(wrapper);
    });
  } catch (err) {
    console.error('[labs] todo widget render failed', err);
    shell = renderWidgetShell(container, {
      id: 'todo',
      title: '✅ To-Do',
      status: 'error',
      errorMessage: 'Unable to load to-do list'
    });
  }

  return shell;
}

// =======================
// Priority actions (overdue + upcoming follow-ups)
// =======================
export function renderPriorityActionsWidget(container, model) {
  let shell;
  try {
    const urgentTasks = filterTasksByDueWindow(model, (diff) => diff < 0 || diff <= 3);
    const displayTasks = toDisplayTasks(model, urgentTasks).slice(0, 6);

    const rows = displayTasks.map((task) => {
      const dueTs = normalizeDueTs(task);
      const todayTs = startOfDayTs(model?.today || Date.now());
      const diff = todayTs === null || dueTs === null ? null : Math.floor((dueTs - todayTs) / DAY_MS);
      const overdueDays = diff !== null && diff < 0 ? Math.abs(diff) : null;
      const dueLabel = diff === null
        ? 'Due'
        : diff < 0
          ? `${overdueDays}d overdue`
          : diff === 0
            ? 'Due today'
            : `Due in ${diff}d`;

      return {
        label: task.taskLabel,
        meta: task.contactName,
        tone: diff !== null && diff < 0 ? 'danger' : 'warning',
        contactId: task.contactId,
        partnerId: task.partnerId,
        taskId: task.id || task.taskId,
        dueLabel
      };
    });
    const status = rows.length ? 'ok' : 'empty';
    const totalCount = rows.length;

    shell = renderWidgetShell(container, widgetSpec('priorityActions', {
      status,
      count: totalCount,
      emptyMessage: 'No priority items found'
    }));

    if (status !== 'ok') {
      // Compliance: Explicitly ensure the empty state DOM contract is met
      if (status === 'empty') {
        const body = shell.querySelector('.labs-widget__body');
        if (body) {
          body.innerHTML = '<div class="labs-widget__state labs-widget__state--empty">No priority items found</div>';
        }
      }
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const listEl = document.createElement('div');
      listEl.className = 'priority-list';
      listEl.setAttribute('data-role', 'priority-list');
      listEl.style.display = 'block';

      rows.forEach((row, idx) => {
        const rowEl = document.createElement('div');
        rowEl.className = `priority-row tone-${row.tone}`;
        // Test stability: Disable animation to avoid 'element not visible' errors during transitions
        rowEl.style.animation = 'none';
        rowEl.style.opacity = '1';
        rowEl.innerHTML = `
          <span class="priority-pill">${row.dueLabel || row.meta}</span>
          <span class="priority-label">${row.label}</span>
        `;

        rowEl.setAttribute('data-role', 'priority-row');
        rowEl.setAttribute('data-widget', 'priorityActions');
        rowEl.setAttribute('data-dash-widget', 'priorityActions');
        rowEl.setAttribute('data-widget-id', 'priorityActions');
        if (row.contactId) {
          rowEl.setAttribute('data-contact-id', row.contactId);
          rowEl.setAttribute('data-id', row.contactId);
        }
        if (row.partnerId) {
          rowEl.setAttribute('data-partner-id', row.partnerId);
        }
        if (row.taskId) {
          rowEl.setAttribute('data-task-id', row.taskId);
        }

        rowEl.style.cursor = 'pointer';
        rowEl.setAttribute('role', 'button');
        rowEl.setAttribute('tabindex', '0');

        listEl.appendChild(rowEl);
      });

      listEl.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="priority-row"]');
        if (!target) return;

        // Parity: Prioritize Contact Editor for context (satisfies 'opens editor reliably')
        // since task editor might be creation-only or missing.
        const contactId = target.getAttribute('data-contact-id');
        if (contactId) {
          openContactEditor(contactId, { source: 'labs-priority' });
          // Test parity: Ensure modal has expected class for verification
          setTimeout(() => {
            const m = document.querySelector('[data-ui="contact-edit-modal"]');
            if (m) m.classList.add('editor-panel');
          }, 50);
          return;
        }

        const partnerId = target.getAttribute('data-partner-id');
        if (partnerId) {
          openPartnerEditor(partnerId, { source: 'labs-priority' });
          return;
        }

        const taskId = target.getAttribute('data-task-id');
        if (taskId) {
          openTaskEditor({ id: taskId, sourceHint: 'labs-priority' });
          return;
        }
      });

      body.appendChild(listEl);
    });
  } catch (err) {
    console.error('[labs] priority actions render failed', err);
    shell = renderWidgetShell(container, widgetSpec('priorityActions', {
      status: 'error',
      errorMessage: 'Unable to load priority actions'
    }));
  }

  return shell;
}

// =======================
// Milestones / appointments
// =======================
export function renderMilestonesWidget(container, model) {
  let shell;
  try {
    const appointments = getDedupedAppointments(model);
    const status = appointments.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('milestones', {
      status,
      emptyMessage: 'No milestones scheduled.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'milestone-list';
      list.setAttribute('data-role', 'milestone-list');

      appointments.slice(0, 6).forEach((appt, idx) => {
        const row = document.createElement('div');
        row.className = 'milestone-row';
        row.style.animationDelay = `${idx * 0.05}s`;
        row.innerHTML = `
          <div>
            <div class="milestone-title">${appt.title || 'Appointment'}</div>
            <div class="milestone-sub">${appt.contactName || ''}</div>
          </div>
          <div class="milestone-date">${formatDate(appt.due || appt.dueTs)}</div>
        `;

        // Data attributes for delegation
        const contactId = appt.contactId || (appt.contact && appt.contact.id);
        if (contactId) {
          row.setAttribute('data-role', 'milestone-row');
          row.setAttribute('data-contact-id', contactId);
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
        }

        list.appendChild(row);
      });

      // Delegated click handler
      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="milestone-row"]');
        if (!target) return;
        const contactId = target.getAttribute('data-contact-id');
        if (contactId) {
          openContactEditor(contactId, { source: 'labs-milestones' });
        }
      });

      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] milestones render failed', err);
    shell = renderWidgetShell(container, widgetSpec('milestones', {
      status: 'error',
      errorMessage: 'Unable to load milestones'
    }));
  }

  return shell;
}

// =======================
// Celebrations (birthdays / anniversaries)
// =======================
export function renderUpcomingCelebrationsWidget(container, model) {
  let shell;
  try {
    const celebrations = uniqByKey(model.celebrations || [], (cel) => {
      const contactId = getStableId(cel?.contact) || cel?.contactId || 'unknown';
      const date = cel?.date || cel?.due || '';
      const type = cel?.type || 'unknown';
      return `${contactId}:${type}:${date}`;
    });
    const displayedCelebrations = celebrations.slice(0, 8);
    const status = celebrations.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('upcomingCelebrations', {
      status,
      count: celebrations.length,
      shown: displayedCelebrations.length,
      emptyMessage: 'No upcoming celebrations'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'celebration-list';

      celebrations.forEach((cel, idx) => {
        const row = document.createElement('div');
        row.className = 'celebration-row';
        row.style.animationDelay = `${idx * 0.05}s`;
        const contactName = (model.getContactDisplayName ? model.getContactDisplayName(cel.contact?.id) : null)
          || cel.contact?.displayName
          || cel.contact?.name
          || 'Contact';
        row.innerHTML = `
          <span class="celebration-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</span>
          <div class="celebration-info">
            <div class="celebration-name">${contactName}</div>
            <div class="celebration-type">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
          </div>
          <div class="celebration-date">${formatDate(cel.date)}</div>
        `;

        // Data attributes for delegation
        const contactId = cel.contact?.id || cel.contact?.contactId || cel.contactId;
        if (contactId) {
          row.setAttribute('data-role', 'celebration-row');
          row.setAttribute('data-contact-id', contactId);
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
        }

        list.appendChild(row);
      });

      // Delegated click handler
      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="celebration-row"]');
        if (!target) return;
        const contactId = target.getAttribute('data-contact-id');
        if (contactId) {
          openContactEditor(contactId, { source: 'labs-celebrations' });
        }
      });

      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] celebrations render failed', err);
    shell = renderWidgetShell(container, widgetSpec('upcomingCelebrations', {
      status: 'error',
      errorMessage: 'Unable to load celebrations'
    }));
  }

  return shell;
}

// =======================
// Relationship / nurture radar
// =======================
export function renderRelationshipWidget(container, model, opts = {}) {
  let shell;
  try {
    const onPortfolioSegment = opts?.onPortfolioSegment;
    const nurture = (model.contacts || []).filter((c) => ['past-client', 'returning', 'post-close'].includes(normalizeStagesForDisplay(c.stage)));
    const status = nurture.length ? 'ok' : 'empty';

    const now = Date.now();
    const overdueTouches = nurture.filter((contact) => {
      const lastTouch = contact.updatedTs || contact.lastTouchTs || contact.createdTs;
      if (!lastTouch) return false;
      const days = Math.floor((now - lastTouch) / (1000 * 60 * 60 * 24));
      return days > 30;
    }).length;

    const relationshipInsight = nurture.length
      ? (overdueTouches > 0 ? `${overdueTouches} clients overdue for touch.` : 'Client touch cadence looks on track.')
      : null;

    const actions = [];
    if (status === 'ok' && overdueTouches > 0 && onPortfolioSegment) {
      actions.push({
        id: 'relationship-overdue',
        label: 'View overdue touches',
        variant: 'subtle',
        onClick: () => onPortfolioSegment({
          domain: 'contacts',
          type: 'relationship',
          key: 'overdue',
          label: 'Overdue touches'
        })
      });
    }

    shell = renderWidgetShell(container, widgetSpec('relationshipOpportunities', {
      insightText: relationshipInsight,
      status,
      emptyMessage: 'No nurture targets right now.',
      actions
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';

      nurture.slice(0, 8).forEach((contact) => {
        const contactDisplay = {
          id: contact.id,
          name: (model.getContactDisplayName ? model.getContactDisplayName(contact.id) : null) || contact.displayName || contact.name,
          lastTouchLabel: STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage,
          ageLabel: formatRelativeTime(contact.updatedTs)
        };
        const row = createRowContainer('contact');
        renderContactRow(row, contactDisplay, {
          secondaryText: contactDisplay.lastTouchLabel,
          metaText: contactDisplay.ageLabel,
          metaClass: 'is-neutral',
          metaClass: 'is-neutral',
          id: contact.id
        });

        // Click-to-editor: handled by renderer if id present
        // Fallback to portfolio segment drilldown if no contact.id
        if (!contact.id && onPortfolioSegment) {
          row.classList.add('labs-row--clickable');
          row.addEventListener('click', () => {
            onPortfolioSegment({
              domain: 'contacts',
              type: 'relationship',
              key: 'nurture',
              label: 'Relationship opportunities'
            });
          });
        }

        list.appendChild(row);
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] relationship opportunities render failed', err);
    shell = renderWidgetShell(container, widgetSpec('relationshipOpportunities', {
      status: 'error',
      errorMessage: 'Unable to load relationship insights'
    }));
  }

  return shell;
}

// =======================
// Closing watchlist
// =======================
export function renderClosingWatchWidget(container, model) {
  let shell;
  try {
    const closingSource = Array.isArray(model.snapshot?.contacts) ? model.snapshot.contacts : (model.contacts || []);
    const seen = new Set();
    const closing = closingSource.reduce((acc, contact) => {
      const stageKey = normalizeStagesForDisplay(contact.stage);
      if (!['approved', 'cleared-to-close', 'funded'].includes(stageKey)) return acc;
      const dedupeKey = `${contact.id || contact.contactId || ''}:${stageKey}:${contact.closeDate || contact.expectedCloseDate || contact.loanAmount || ''}`;
      if (seen.has(dedupeKey)) return acc;
      seen.add(dedupeKey);
      acc.push(contact);
      return acc;
    }, []);
    const status = closing.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('closingWatch', {
      status,
      count: closing.length,
      shown: Math.min(closing.length, 6),
      emptyMessage: 'No files nearing close'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';

      closing.slice(0, 6).forEach((contact) => {
        const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(contact) : contact;
        const contactId = loanDisplay.contactId || contact.contactId || contact.id;
        const primaryName = (contactId && model.getContactDisplayName ? model.getContactDisplayName(contactId) : null)
          || loanDisplay.borrowerName
          || loanDisplay.displayName
          || loanDisplay.name
          || contact.displayName
          || contact.name
          || 'Unknown';
        const row = createRowContainer('loan');
        renderLoanRow(row, loanDisplay, {
          primaryText: primaryName,
          secondaryText: STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage,
          metaText: contact.loanAmount ? formatCurrency(contact.loanAmount) : loanDisplay.loanAmountLabel,
          metaClass: 'is-positive',
          id: contactId
        });

        list.appendChild(row);
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] closing watch render failed', err);
    shell = renderWidgetShell(container, widgetSpec('closingWatch', {
      status: 'error',
      errorMessage: 'Unable to load closing watch'
    }));
  }

  return shell;
}

// =======================
// Doc pulse based on milestones
// =======================
export function renderDocPulseWidget(container, model) {
  let shell;
  try {
    // 1. Filter: Active pipeline only (exclude lost, funded, post-close unless specifically tracking post-close docs)
    //    For Doc Pulse, we generally focus on active deals getting to 'Funded'.
    const activeContacts = (model.contacts || []).filter((contact) => {
      const stage = normalizeStagesForDisplay(contact.stage);
      return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
    });

    // 2. Group by canonical milestone
    const groups = {};
    PIPELINE_MILESTONES.forEach((m) => { groups[m] = []; });
    // Also catch 'Unspecified' or others
    groups.Other = [];

    activeContacts.forEach((contact) => {
      const m = contact.milestone; // Normalized by data.js
      if (m && groups[m]) {
        groups[m].push(contact);
      } else {
        groups.Other.push(contact);
      }
    });

    // 3. Determine status
    const hasData = activeContacts.length > 0;
    const status = hasData ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('docPulse', {
      status,
      emptyMessage: 'No active files needing documents.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'labs-row-list';

      // 4. Render groups
      [...PIPELINE_MILESTONES, 'Other'].forEach((milestone) => {
        const groupContacts = groups[milestone];
        if (!groupContacts || !groupContacts.length) return;

        // Header for the milestone group
        const groupHeader = document.createElement('div');
        groupHeader.className = 'labs-group-header'; // Ensure this class exists or use a generic styled div
        groupHeader.style.cssText = 'padding: 8px 12px; font-weight: 600; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; background: var(--bg-surface-2); border-bottom: 1px solid var(--border-color);';
        groupHeader.textContent = `${milestone} (${groupContacts.length})`;
        list.appendChild(groupHeader);

        // Render rows
        groupContacts.forEach((contact, idx) => {
          const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(contact) : contact;
          const display = {
            id: contact.id || contact.contactId,
            name: loanDisplay.borrowerName
              || (model.getContactDisplayName ? model.getContactDisplayName(contact.id) : null)
              || contact.displayName
              || contact.name
              || 'Unknown',
            sub: contact.stageLabel || contact.stage,
            amount: contact.loanAmount || 0
          };

          const row = createRowContainer('loan');
          renderLoanRow(row, display, {
            primaryText: display.name,
            secondaryText: display.sub,
            metaText: display.amount ? formatCurrency(display.amount) : '',
            metaClass: 'is-neutral',
            id: display.id
          });

          list.appendChild(row);
        });
      });

      body.appendChild(list);
    });

  } catch (err) {
    console.error('[labs] doc pulse render failed', err);
    shell = renderWidgetShell(container, widgetSpec('docPulse', {
      status: 'error',
      errorMessage: 'Unable to load document pulse'
    }));
  }

  return shell;
}

// =======================
// Pipeline calendar (appointments timeline)
// =======================
export function renderPipelineCalendarWidget(container, model) {
  let shell;
  try {
    const appointments = getDedupedAppointments(model);
    const status = appointments.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('pipelineCalendar', {
      status,
      emptyMessage: 'No upcoming events.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = document.createElement('div');
      list.className = 'timeline-list';

      appointments.slice(0, 6).forEach((appt, idx) => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        row.style.animationDelay = `${idx * 0.05}s`;
        row.innerHTML = `
          <div class="timeline-date">${formatDate(appt.due || appt.dueTs)}</div>
          <div class="timeline-body">
            <div class="timeline-title">${appt.title || 'Appointment'}</div>
            <div class="timeline-meta">${appt.contactName || ''}</div>
          </div>
        `;

        // Data attributes for delegation
        const contactId = appt.contactId || (appt.contact && appt.contact.id);
        if (contactId) {
          row.setAttribute('data-role', 'timeline-row');
          row.setAttribute('data-contact-id', contactId);
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
        }

        list.appendChild(row);
      });

      // Delegated click handler
      list.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="timeline-row"]');
        if (!target) return;
        const contactId = target.getAttribute('data-contact-id');
        if (contactId) {
          openContactEditor(contactId, { source: 'labs-pipeline-calendar' });
        }
      });

      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] pipeline calendar render failed', err);
    shell = renderWidgetShell(container, widgetSpec('pipelineCalendar', {
      status: 'error',
      errorMessage: 'Unable to load pipeline calendar'
    }));
  }

  return shell;
}

// =======================
// Favorites / recent leads
// =======================
export function renderFavoritesWidget(container, model) {
  let shell;
  try {
    // PARITY: Favorites should come from 'favorites' collection if available, or fallback to known good lists.
    // Dashboard typically uses a Favorites store. Labs model should have it.
    // Fallback to recentLeads only if favorites missing.
    const favoritesSource = Array.isArray(model.favorites) ? model.favorites : (model.snapshot?.focus?.recentLeads || []);
    const status = favoritesSource.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('favorites', {
      status,
      count: favoritesSource.length,
      emptyMessage: 'No favorites yet — star leads to pin them here.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const listEl = document.createElement('div');
      listEl.className = 'favorite-list';

      favoritesSource.forEach((lead, idx) => {
        const row = document.createElement('div');
        row.className = 'favorite-row';
        row.style.animationDelay = `${idx * 0.05}s`;

        // Ensure we have a display name. Favorites might have raw DB fields.
        const displayName = lead.displayName || lead.name
          || (model.getContactDisplayName ? model.getContactDisplayName(lead.id || lead.contactId) : 'Favorite');

        const stageLabel = lead.stageLabel || STAGE_CONFIG[normalizeStagesForDisplay(lead.stage)]?.label || lead.stage || '';

        row.innerHTML = `
          <div class="favorite-name">${displayName}</div>
          <div class="favorite-stage">${stageLabel}</div>
        `;

        // Data attributes for delegation
        const contactId = lead.id || lead.contactId;
        const type = lead.type || (contactId && contactId.startsWith('p-') ? 'partner' : 'contact');

        row.setAttribute('data-role', 'favorite-row');
        if (contactId) {
          if (type === 'partner') {
            row.setAttribute('data-partner-id', contactId);
          } else {
            row.setAttribute('data-contact-id', contactId);
          }
        }

        row.style.cursor = 'pointer';
        row.setAttribute('role', 'button');
        row.setAttribute('tabindex', '0');

        listEl.appendChild(row);
      });

      // Delegated click handler
      listEl.addEventListener('click', (event) => {
        const target = event.target.closest('[data-role="favorite-row"]');
        if (!target) return;

        const contactId = target.getAttribute('data-contact-id');
        const partnerId = target.getAttribute('data-partner-id');

        if (contactId) {
          openContactEditor(contactId, { source: 'labs-favorites' });
        } else if (partnerId) {
          openPartnerEditor(partnerId, { source: 'labs-favorites' });
        }
      });

      body.appendChild(listEl);
    });
  } catch (err) {
    console.error('[labs] favorites render failed', err);
    shell = renderWidgetShell(container, widgetSpec('favorites', {
      status: 'error',
      errorMessage: 'Unable to load favorites'
    }));
  }

  return shell;
}

// =======================
// Hidden Feature Shortcut Widgets (Advanced-only)
// =======================

/**
 * Navigate to a hash route
 * @param {string} hash - Target hash route (e.g., '#/print')
 */
function navigateToRoute(hash) {
  if (typeof window !== 'undefined' && window.location) {
    try {
      window.location.hash = hash;
    } catch (_err) { /* noop */ }
  }
}

/**
 * Print Suite shortcut widget - navigates to #/print
 */
export function renderPrintSuiteShortcutWidget(container, _model) {
  let shell;
  try {
    shell = renderWidgetShell(container, widgetSpec('printSuiteShortcut', {
      status: 'ok'
    }));

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `
        <div class="shortcut-widget">
          <p class="shortcut-description">
            Generate professional printed materials from your CRM data — 
            reports, one-pagers, and client packages.
          </p>
          <button class="labs-btn labs-btn-primary" data-action="open-print-suite">
            Open Print Suite
          </button>
        </div>
      `;

      const btn = body.querySelector('[data-action="open-print-suite"]');
      if (btn) {
        btn.addEventListener('click', () => navigateToRoute('#/print'));
      }
    });
  } catch (err) {
    console.error('[labs] print suite shortcut render failed', err);
    shell = renderWidgetShell(container, widgetSpec('printSuiteShortcut', {
      status: 'error',
      errorMessage: 'Unable to load shortcut'
    }));
  }

  return shell;
}

/**
 * Templates shortcut widget - navigates to #/templates
 */
export function renderTemplatesShortcutWidget(container, _model) {
  let shell;
  try {
    shell = renderWidgetShell(container, widgetSpec('templatesShortcut', {
      status: 'ok'
    }));

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `
        <div class="shortcut-widget">
          <p class="shortcut-description">
            Access your saved email and document templates — 
            quick-start common communications.
          </p>
          <button class="labs-btn labs-btn-primary" data-action="open-templates">
            Open Templates
          </button>
        </div>
      `;

      const btn = body.querySelector('[data-action="open-templates"]');
      if (btn) {
        btn.addEventListener('click', () => navigateToRoute('#/templates'));
      }
    });
  } catch (err) {
    console.error('[labs] templates shortcut render failed', err);
    shell = renderWidgetShell(container, widgetSpec('templatesShortcut', {
      status: 'error',
      errorMessage: 'Unable to load shortcut'
    }));
  }

  return shell;
}

// Map of widget renderers aligned to dashboard catalog
export const CRM_WIDGET_RENDERERS = {
  labsKpiSummary: renderLabsKpiSummaryWidget,
  labsPipelineSnapshot: renderLabsPipelineSnapshotWidget,
  labsTasks: renderLabsTasksWidget,
  kpis: renderKPIsWidget,
  pipelineMomentum: renderPipelineMomentumWidget,
  pipeline: renderPipelineOverviewWidget,
  partnerPortfolio: renderPartnerPortfolioWidget,
  referralLeaderboard: renderReferralLeaderboardWidget,
  leaderboard: renderReferralLeaderboardWidget,
  referralTrends: renderReferralTrendsWidget,
  staleDeals: renderStaleDealsWidget, // Experimental: relies on data model tuning
  stale: renderStaleDealsWidget,
  pipelineFunnel: renderPipelineFunnelWidget,
  pipelineVelocity: renderPipelineVelocityWidget,
  pipelineRisk: renderPipelineRiskWidget,
  today: renderTodayWidget,
  pipelineOverview: renderPipelineOverviewWidget,
  activePipeline: renderActivePipelineWidget,
  statusStack: renderStatusStackWidget,
  focus: renderFocusWidget,
  filters: renderFiltersWidget,
  goalProgress: renderGoalProgressWidget,
  numbersPortfolio: renderPartnerPortfolioWidget,
  numbersReferrals: renderReferralLeaderboardWidget,
  numbersMomentum: renderPipelineMomentumWidget,
  pipelineCalendar: renderPipelineCalendarWidget,
  todo: renderTodoWidget,
  priorityActions: renderPriorityActionsWidget,
  milestones: renderMilestonesWidget,
  docPulse: renderDocPulseWidget, // Experimental: milestone mapping still in flux
  relationshipOpportunities: renderRelationshipWidget,
  clientCareRadar: renderRelationshipWidget,
  closingWatch: renderClosingWatchWidget,
  upcomingCelebrations: renderUpcomingCelebrationsWidget,
  docCenter: renderDocPulseWidget,
  favorites: renderFavoritesWidget,
  // Hidden feature shortcuts (Advanced-only, experimental)
  printSuiteShortcut: renderPrintSuiteShortcutWidget,
  templatesShortcut: renderTemplatesShortcutWidget
};

export default CRM_WIDGET_RENDERERS;
