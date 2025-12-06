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
  normalizeStagesForDisplay
} from './data.js';
import { getDeltaInsight, getThresholdInsight, getTopDriverInsight } from './insight_callouts.js';
import {
  createRowContainer,
  renderContactRow,
  renderLoanRow,
  renderPartnerRow
} from './row_renderers.js';
import { createInlineBar } from './micro_charts.js';
import { renderWidgetBody, renderWidgetShell } from './widget_base.js';

const WIDGET_META = {
  labsKpiSummary: {
    id: 'labsKpiSummary',
    title: '📊 CRM Snapshot',
    description: 'CRM health KPIs in one glance.',
    category: 'system',
    status: 'stable'
  },
  labsPipelineSnapshot: {
    id: 'labsPipelineSnapshot',
    title: '🧭 Pipeline Snapshot',
    description: 'Stage distribution across active deals.',
    category: 'pipeline',
    status: 'stable'
  },
  labsTasks: {
    id: 'labsTasks',
    title: '✅ Tasks Due',
    description: 'Tasks due today and overdue counts.',
    category: 'tasks',
    status: 'stable'
  },
  today: {
    id: 'today',
    title: "📅 Today's Work",
    description: 'Tasks, appointments, and celebrations happening now.',
    category: 'tasks',
    status: 'stable'
  },
  todo: {
    id: 'todo',
    title: '✅ To-Do',
    description: 'Your due and overdue tasks with quick links.',
    category: 'tasks',
    status: 'stable'
  },
  favorites: {
    id: 'favorites',
    title: '⭐ Favorites',
    description: 'Recently favorited leads for quick access.',
    category: 'people',
    status: 'stable'
  },
  priorityActions: {
    id: 'priorityActions',
    title: '🚨 Priority Actions',
    description: 'Overdue tasks and stale deals that need attention.',
    category: 'tasks',
    status: 'stable'
  },
  partnerPortfolio: {
    id: 'partnerPortfolio',
    title: '🎯 Partner Portfolio',
    description: 'Production breakdown by partner tier.',
    category: 'portfolio',
    status: 'stable'
  },
  referralLeaderboard: {
    id: 'referralLeaderboard',
    title: '🏆 Referral Leaders',
    description: 'Top referral partners ranked by volume.',
    category: 'portfolio',
    status: 'stable'
  },
  leaderboard: {
    id: 'leaderboard',
    title: '🏆 Referral Leaders',
    description: 'Top referral partners ranked by volume.',
    category: 'portfolio',
    status: 'stable'
  },
  referralTrends: {
    id: 'referralTrends',
    title: '📈 Referral Trends',
    description: 'Referral volume trends over the last 30 days.',
    category: 'portfolio',
    status: 'stable'
  },
  relationshipOpportunities: {
    id: 'relationshipOpportunities',
    title: '🤝 Client Care Radar',
    description: 'Past and returning clients that need outreach.',
    category: 'people',
    status: 'stable'
  },
  clientCareRadar: {
    id: 'clientCareRadar',
    title: '🤝 Client Care Radar',
    description: 'Past and returning clients that need outreach.',
    category: 'people',
    status: 'stable'
  },
  pipelineFunnel: {
    id: 'pipelineFunnel',
    title: '📈 Pipeline Funnel',
    description: 'Counts by stage across the pipeline.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineVelocity: {
    id: 'pipelineVelocity',
    title: '⏱ Velocity',
    description: 'Cycle time buckets showing speed to close.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineRisk: {
    id: 'pipelineRisk',
    title: '🛑 Pipeline Risk',
    description: 'Files stale for 14+ days by stage.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineMomentum: {
    id: 'pipelineMomentum',
    title: '🌊 Pipeline Momentum',
    description: 'Stage mix indicators showing movement.',
    category: 'pipeline',
    status: 'experimental'
  },
  numbersMomentum: {
    id: 'numbersMomentum',
    title: '🌊 Pipeline Momentum',
    description: 'Stage mix indicators showing movement.',
    category: 'pipeline',
    status: 'experimental'
  },
  closingWatch: {
    id: 'closingWatch',
    title: '🛫 Closing Watch',
    description: 'Deals nearing their close date.',
    category: 'pipeline',
    status: 'stable'
  },
  staleDeals: {
    id: 'staleDeals',
    title: '⚠️ Stale Deals',
    description: 'Pipeline files with no movement for 14+ days.',
    category: 'pipeline',
    status: 'stable'
  },
  stale: {
    id: 'stale',
    title: '⚠️ Stale Deals',
    description: 'Pipeline files with no movement for 14+ days.',
    category: 'pipeline',
    status: 'stable'
  },
  milestones: {
    id: 'milestones',
    title: '📌 Milestones Ahead',
    description: 'Upcoming appointments and key dates.',
    category: 'tasks',
    status: 'experimental'
  },
  upcomingCelebrations: {
    id: 'upcomingCelebrations',
    title: '🎉 Upcoming Celebrations',
    description: 'Birthdays and anniversaries for your contacts.',
    category: 'people',
    status: 'stable'
  },
  pipelineCalendar: {
    id: 'pipelineCalendar',
    title: '🗓 Pipeline Calendar',
    description: 'Upcoming pipeline events on the calendar.',
    category: 'tasks',
    status: 'experimental'
  },
  docPulse: {
    id: 'docPulse',
    title: '📁 Document Pulse',
    description: 'Document milestone counts across your pipeline.',
    category: 'system',
    status: 'experimental'
  },
  docCenter: {
    id: 'docCenter',
    title: '📁 Document Pulse',
    description: 'Document milestone counts across your pipeline.',
    category: 'system',
    status: 'experimental'
  },
  kpis: {
    id: 'kpis',
    title: '📊 KPI Overview',
    description: 'Classic KPI rollup for quick reference.',
    category: 'system',
    status: 'stable'
  },
  pipeline: {
    id: 'pipeline',
    title: '🧭 Pipeline Snapshot',
    description: 'Stage distribution across active deals.',
    category: 'pipeline',
    status: 'stable'
  },
  pipelineOverview: {
    id: 'pipelineOverview',
    title: '🧭 Pipeline Snapshot',
    description: 'Stage distribution across active deals.',
    category: 'pipeline',
    status: 'stable'
  },
  activePipeline: {
    id: 'activePipeline',
    title: '📂 Active Pipeline',
    description: 'Open files organized by current stage.',
    category: 'pipeline',
    status: 'stable'
  },
  statusStack: {
    id: 'statusStack',
    title: '📶 Status Stack',
    description: 'Quick counts by pipeline status.',
    category: 'pipeline',
    status: 'stable'
  },
  focus: {
    id: 'focus',
    title: '🎯 Focus Summary',
    description: 'Personalized focus summary for the day.',
    category: 'system',
    status: 'stable'
  },
  filters: {
    id: 'filters',
    title: '🔍 Filters',
    description: 'Saved filters mirrored for Labs dashboards.',
    category: 'system',
    status: 'stable'
  },
  goalProgress: {
    id: 'goalProgress',
    title: '🎯 Production Goals',
    description: 'Year-to-date production progress versus goals.',
    category: 'pipeline',
    status: 'stable'
  },
  numbersPortfolio: {
    id: 'numbersPortfolio',
    title: '🎯 Partner Portfolio',
    description: 'Production breakdown by partner tier.',
    category: 'portfolio',
    status: 'stable'
  },
  numbersReferrals: {
    id: 'numbersReferrals',
    title: '🏆 Referral Leaders',
    description: 'Top referral partners ranked by volume.',
    category: 'portfolio',
    status: 'stable'
  },
  // ---------------------------------------------------------------------------
  // Hidden Feature Shortcut Widgets (Advanced-only)
  // ---------------------------------------------------------------------------
  printSuiteShortcut: {
    id: 'printSuiteShortcut',
    title: '🖨️ Print Suite',
    description: 'Quick access to document printing tools.',
    category: 'shortcuts',
    status: 'experimental',
    advancedOnly: true
  },
  templatesShortcut: {
    id: 'templatesShortcut',
    title: '📝 Templates',
    description: 'Quick access to email and document templates.',
    category: 'shortcuts',
    status: 'experimental',
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
    const keyContact = appt.contactId || getStableId(appt.contact) || '';
    const keyDate = appt.due || appt.dueTs || '';
    const keyTitle = appt.title || '';
    return `${keyContact}:${keyDate}:${keyTitle}`;
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

    const rows = visibleTasks.map((entry, idx) => {
      const overdue = entry.status === 'Overdue';
      return `
        <div class="labs-task-row" style="animation-delay:${idx * 0.04}s">
          <div class="labs-task-icon ${overdue ? 'overdue' : 'today'}">${entry.icon}</div>
          <div class="labs-task-main">
            <div class="labs-task-title">${entry.task.taskLabel}</div>
            <div class="labs-task-meta">${entry.task.contactName}</div>
          </div>
          <div class="labs-task-status ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue' : 'Due today'}</div>
        </div>
      `;
    });

    const status = rows.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'labsTasks',
      title: '✅ Tasks Due',
      status,
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
            <div class="labs-task-meta">${entry.task.contactName}</div>
          </div>
          <div class="labs-task-status ${overdue ? 'overdue' : ''}">${overdue ? 'Overdue' : 'Due today'}</div>
        `;

        // Click-to-editor: navigate to contact view
        const contactId = entry.task.contactId;
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }

        list.appendChild(row);
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

      funnel.forEach((stage, idx) => {
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
    const topPartners = model.snapshot?.leaderboard?.slice(0, 5) || getTopReferralPartners(model.partners, 5);
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

        if (onPortfolioSegment && partnerDisplay.id) {
          row.classList.add('labs-row--clickable');
          row.addEventListener('click', () => {
            const label = partnerDisplay.name || 'Referral partner';
            onPortfolioSegment({
              domain: 'loans',
              type: 'referrals',
              key: partnerDisplay.id,
              label
            });
          });
        }

        list.appendChild(row);
      });

      body.innerHTML = '';
      body.appendChild(list);
    });
  } catch (err) {
    console.error('[labs] referral leaderboard render failed', err);
    shell = renderWidgetShell(container, widgetSpec('referralLeaderboard', {
      status: 'error',
      errorMessage: 'Unable to load referral leaders'
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
      emptyMessage: 'No stale deals for this view.'
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
          || (model.getContactDisplayName ? model.getContactDisplayName(loanDisplay.contactId || dealContact.id) : null)
          || loanDisplay.displayName
          || loanDisplay.name
          || 'Borrower';
        const secondaryPieces = [loanDisplay.stageLabel || stageConfig.label || dealContact.stage];
        if (loanDisplay.loanAmount || loanDisplay.amount) {
          secondaryPieces.push(formatCurrency(loanDisplay.loanAmount || loanDisplay.amount));
        }

        const row = createRowContainer('loan');
        row.classList.add(`urgency-${urgency}`);
        renderLoanRow(row, loanDisplay, {
          primaryText: name,
          secondaryText: secondaryPieces.filter(Boolean).join(' • '),
          metaText: `${daysSince}d`,
          metaClass: 'is-negative'
        });

        // Click-to-editor: navigate to contact view
        const contactId = loanDisplay.contactId || dealContact.id || dealContact.contactId;
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }

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
    const todayTasks = getDisplayTasks(model, { scope: 'today' }).slice(0, 5);
    const celebrations = getUpcomingCelebrations(model.contacts || [], 7).slice(0, 4);
    const appointments = model.snapshot?.focus?.nextAppointments || [];

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
        if (task.contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${task.contactId}`;
          });
        }
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
        const contactId = appt.contactId || (appt.contact && appt.contact.id);
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }
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
        const contactId = cel.contact.id || cel.contact.contactId;
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }
        list.appendChild(row);
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
  const appointments = focus.nextAppointments || [];
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
export function renderTodoWidget(container, model) {
  let shell;
  try {
    // Use getDisplayTasks for enriched task data with contact names
    const todayTasks = getDisplayTasks(model, { scope: 'today' });
    const overdueTasks = getDisplayTasks(model, { scope: 'overdue' });
    const status = todayTasks.length || overdueTasks.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'todo',
      title: '✅ To-Do',
      status,
      emptyMessage: 'Nothing due right now'
    });

    if (status !== 'ok') {
      return shell;
    }

    const renderTaskList = (items, parentUl) => {
      if (!items.length) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = 'Nothing queued';
        parentUl.appendChild(li);
        return;
      }
      items.slice(0, 5).forEach((task) => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${task.taskLabel}</strong><span class="muted"> · ${task.contactName}</span>`;
        if (task.contactId) {
          li.style.cursor = 'pointer';
          li.setAttribute('role', 'button');
          li.setAttribute('tabindex', '0');
          li.addEventListener('click', () => {
            window.location.hash = `#/contacts/${task.contactId}`;
          });
        }
        parentUl.appendChild(li);
      });
    };

    renderWidgetBody(shell, (body) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'todo-columns';

      const todayCol = document.createElement('div');
      const todayLabel = document.createElement('div');
      todayLabel.className = 'muted';
      todayLabel.textContent = `Due Today (${todayTasks.length})`;
      todayCol.appendChild(todayLabel);
      const todayUl = document.createElement('ul');
      renderTaskList(todayTasks, todayUl);
      todayCol.appendChild(todayUl);

      const overdueCol = document.createElement('div');
      const overdueLabel = document.createElement('div');
      overdueLabel.className = 'muted';
      overdueLabel.textContent = `Overdue (${overdueTasks.length})`;
      overdueCol.appendChild(overdueLabel);
      const overdueUl = document.createElement('ul');
      renderTaskList(overdueTasks, overdueUl);
      overdueCol.appendChild(overdueUl);

      wrapper.appendChild(todayCol);
      wrapper.appendChild(overdueCol);
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
// Priority actions (overdue + stale)
// =======================
export function renderPriorityActionsWidget(container, model) {
  let shell;
  try {
    const overdueTasks = getDisplayTasks(model, { scope: 'overdue' }).slice(0, 5);
    const taskRows = overdueTasks.map((task) => ({
      label: task.taskLabel,
      meta: task.contactName,
      tone: 'danger',
      contactId: task.contactId
    }));

    const staleDeals = getDedupedStaleDeals(model, 14);
    const staleRows = staleDeals.slice(0, 3).map((deal) => {
      const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(deal.contact || deal) : (deal.contact || deal);
      const contactId = loanDisplay.contactId || loanDisplay.id || deal.contactId;
      const nameFromModel = contactId && model.getContactDisplayName ? model.getContactDisplayName(contactId) : null;
      const label = nameFromModel
        || loanDisplay.borrowerName
        || loanDisplay.displayName
        || loanDisplay.name
        || 'Contact';
      return {
        label,
        meta: 'Stale deal',
        tone: 'warning',
        contactId
      };
    });

    const rows = taskRows.concat(staleRows);

    const status = rows.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('priorityActions', {
      status,
      emptyMessage: 'No priority actions right now.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const listEl = document.createElement('div');
      listEl.className = 'priority-list';

      rows.forEach((row, idx) => {
        const rowEl = document.createElement('div');
        rowEl.className = `priority-row tone-${row.tone}`;
        rowEl.style.animationDelay = `${idx * 0.05}s`;
        rowEl.innerHTML = `
          <span class="priority-pill">${row.meta}</span>
          <span class="priority-label">${row.label}</span>
        `;

        // Click-to-editor: navigate to contact view
        if (row.contactId) {
          rowEl.style.cursor = 'pointer';
          rowEl.setAttribute('role', 'button');
          rowEl.setAttribute('tabindex', '0');
          rowEl.addEventListener('click', () => {
            window.location.hash = `#/contacts/${row.contactId}`;
          });
        }

        listEl.appendChild(rowEl);
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
      const rows = appointments.slice(0, 6).map((appt, idx) => `
        <div class="milestone-row" style="animation-delay:${idx * 0.05}s">
          <div>
            <div class="milestone-title">${appt.title || 'Appointment'}</div>
            <div class="milestone-sub">${appt.contactName || ''}</div>
          </div>
          <div class="milestone-date">${formatDate(appt.due || appt.dueTs)}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="milestone-list">${rows}</div>`;
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
    }).slice(0, 8);
    const status = celebrations.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('upcomingCelebrations', {
      status,
      emptyMessage: 'No celebrations.'
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

        // Click-to-editor: navigate to contact view
        const contactId = cel.contact?.id || cel.contact?.contactId || cel.contactId;
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }

        list.appendChild(row);
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
          metaClass: 'is-neutral'
        });

        if (onPortfolioSegment) {
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
      emptyMessage: 'No files nearing close.'
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
          || 'Unknown contact';
        const row = createRowContainer('loan');
        renderLoanRow(row, loanDisplay, {
          primaryText: primaryName,
          secondaryText: STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage,
          metaText: contact.loanAmount ? formatCurrency(contact.loanAmount) : loanDisplay.loanAmountLabel,
          metaClass: 'is-positive'
        });

        // Click-to-editor: navigate to contact view
        if (contactId) {
          row.style.cursor = 'pointer';
          row.setAttribute('role', 'button');
          row.setAttribute('tabindex', '0');
          row.addEventListener('click', () => {
            window.location.hash = `#/contacts/${contactId}`;
          });
        }

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
    const milestoneCounts = {};
    const contacts = dedupeById(model.contacts || []);
    contacts.forEach((contact) => {
      const rawLabel = (contact.milestoneLabel || contact.milestone || '').toString().trim();
      const normalized = rawLabel ? rawLabel : 'Unspecified';
      const normalizedLower = normalized.toLowerCase();
      const bucketed = ['unknown', 'unspecified', 'n/a', 'na', 'none'].includes(normalizedLower) ? 'Unspecified' : normalized;
      milestoneCounts[bucketed] = (milestoneCounts[bucketed] || 0) + 1;
    });

    const entries = Object.entries(milestoneCounts).sort((a, b) => b[1] - a[1]);
    const status = entries.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('docPulse', {
      status,
      emptyMessage: 'No milestone data.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const rows = entries.map(([milestone, count], idx) => `
        <div class="doc-row" style="animation-delay:${idx * 0.04}s">
          <span class="doc-milestone">${milestone}</span>
          <span class="doc-count">${count}</span>
        </div>
      `).join('');

      body.innerHTML = `<div class="doc-list">${rows}</div>`;
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
      const timeline = appointments.slice(0, 6).map((appt, idx) => `
        <div class="timeline-row" style="animation-delay:${idx * 0.05}s">
          <div class="timeline-date">${formatDate(appt.due || appt.dueTs)}</div>
          <div class="timeline-body">
            <div class="timeline-title">${appt.title || 'Appointment'}</div>
            <div class="timeline-meta">${appt.contactName || ''}</div>
          </div>
        </div>
      `).join('');

      body.innerHTML = `<div class="timeline-list">${timeline}</div>`;
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
    const leads = model.snapshot?.focus?.recentLeads || [];
    const status = leads.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('favorites', {
      status,
      emptyMessage: 'No favorites yet — star leads from Focus to pin them here.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = leads.map((lead, idx) => `
        <div class="favorite-row" style="animation-delay:${idx * 0.05}s">
          <div class="favorite-name">${lead.displayName || lead.name || 'Lead'}</div>
          <div class="favorite-stage">${STAGE_CONFIG[normalizeStagesForDisplay(lead.stage)]?.label || lead.stage}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="favorite-list">${list}</div>`;
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
