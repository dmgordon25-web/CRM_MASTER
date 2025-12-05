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
  computeStageFunnel,
  computeStageAgeBuckets,
  computeStaleSummary,
  STAGE_CONFIG,
  ANALYTICS_SEGMENT_TYPES,
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  normalizeStagesForDisplay
} from './data.js';
import { renderWidgetBody, renderWidgetShell } from './widget_base.js';

const WIDGET_META = {
  labsKpiSummary: { title: '📊 CRM Snapshot', subtitle: 'Canonical metrics at a glance' },
  labsPipelineSnapshot: { title: '🧭 Pipeline Snapshot', subtitle: 'Stage distribution' },
  labsTasks: { title: '✅ Tasks Due', subtitle: 'Due today and overdue' },
  today: { title: "📅 Today's Work", subtitle: 'Tasks, appointments, celebrations' },
  todo: { title: '✅ To-Do', subtitle: 'Due today and overdue' },
  favorites: { title: '⭐ Favorites', subtitle: 'Recently favorited leads' },
  priorityActions: { title: '🚨 Priority Actions', subtitle: 'Overdue tasks and stale deals' },
  partnerPortfolio: { title: '🎯 Partner Portfolio', subtitle: 'Breakdown by tier' },
  referralLeaderboard: { title: '🏆 Referral Leaders', subtitle: 'Top referral partners' },
  referralTrends: { title: '📈 Referral Trends', subtitle: 'Last 30d vs prior 30d' },
  relationshipOpportunities: { title: '🤝 Client Care Radar', subtitle: 'Past and returning clients' },
  pipelineFunnel: { title: '📈 Pipeline Funnel', subtitle: 'Counts by stage' },
  pipelineVelocity: { title: '⏱ Velocity', subtitle: 'Cycle time buckets' },
  pipelineRisk: { title: '🛑 Pipeline Risk', subtitle: '14+ day stale files' },
  pipelineMomentum: { title: '🌊 Pipeline Momentum', subtitle: 'Stage mix' },
  closingWatch: { title: '🛫 Closing Watch', subtitle: 'Nearing close' },
  staleDeals: { title: '⚠️ Stale Deals', subtitle: 'Inactive for 14+ days' },
  milestones: { title: '📌 Milestones Ahead', subtitle: 'Upcoming appointments' },
  upcomingCelebrations: { title: '🎉 Upcoming Celebrations', subtitle: 'Birthdays & anniversaries' },
  pipelineCalendar: { title: '🗓 Pipeline Calendar', subtitle: 'Next appointments' },
  docPulse: { title: '📁 Document Pulse', subtitle: 'Milestone counts' }
};

function widgetSpec(id, overrides = {}) {
  return { id, ...(WIDGET_META[id] || {}), ...overrides };
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

    const leadsWithoutFollowUp = activeContacts.filter((contact) => {
      const hasTask = openTasks.some((task) => task.contactId === contact.id);
      return !hasTask;
    });

    const hasActivity = Boolean((model.contacts && model.contacts.length) || (model.tasks && model.tasks.length));
    const status = hasActivity ? 'ok' : 'empty';

    const tiles = [
      { label: 'Active Pipeline', value: formatNumber(activeContacts.length) },
      { label: 'Active Volume', value: formatCurrency(activeVolume) },
      { label: 'Tasks Today', value: formatNumber(countTodayTasks(model.tasks || [])) },
      { label: 'Overdue Tasks', value: formatNumber(countOverdueTasks(model.tasks || [])) },
      { label: 'Leads w/o Follow-up', value: formatNumber(leadsWithoutFollowUp.length) },
      { label: 'New Leads (7d)', value: formatNumber(snapshotKPIs.kpiNewLeads7d || 0) }
    ];

    shell = renderWidgetShell(container, {
      id: 'labsKpiSummary',
      title: '📊 CRM Snapshot',
      status,
      emptyMessage: 'No CRM activity yet'
    });

    if (status !== 'ok') {
      return shell;
    }

    const tilesHtml = tiles.map((tile, idx) => `
      <div class="labs-kpi-tile" style="animation-delay:${idx * 0.05}s">
        <div class="labs-kpi-label">${tile.label}</div>
        <div class="labs-kpi-value">${tile.value}</div>
      </div>
    `).join('');

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `<div class="labs-kpi-grid">${tilesHtml}</div>`;
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
      body.innerHTML = `<div class="momentum-bars">${rowsHtml}</div>`;
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
    const contactMap = new Map((model.contacts || []).map((c) => [c.id, c]));
    const openTasks = getOpenTasks(model.tasks || []);
    const todayTasks = getTodayTasks(openTasks);
    const overdueTasks = getOverdueTasks(openTasks);

    const allTasks = [
      ...todayTasks.map((task) => ({ task, status: 'Today', icon: '✓' })),
      ...overdueTasks.map((task) => ({ task, status: 'Overdue', icon: '⚠️' }))
    ];

    const VISIBLE_LIMIT = 8;
    const visibleTasks = allTasks.slice(0, VISIBLE_LIMIT);
    const hiddenCount = Math.max(allTasks.length - visibleTasks.length, 0);

    const rows = visibleTasks.map((entry, idx) => {
      const contact = contactMap.get(entry.task.contactId);
      const contactName = model.getContactDisplayName
        ? model.getContactDisplayName(entry.task.contactId)
        : (contact?.displayName || contact?.name || entry.task.contactName);
      const contactLabel = contactName && String(contactName).trim() ? contactName : 'No contact';
      const overdue = entry.status === 'Overdue';
      return `
        <div class="labs-task-row" style="animation-delay:${idx * 0.04}s">
          <div class="labs-task-icon ${overdue ? 'overdue' : 'today'}">${entry.icon}</div>
          <div class="labs-task-main">
            <div class="labs-task-title">${entry.task.title || 'Task'}</div>
            <div class="labs-task-meta">${contactLabel}</div>
          </div>
          <div class="labs-task-status ${overdue ? 'overdue' : ''}">${entry.status}</div>
        </div>
      `;
    });

    const status = rows.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'labsTasks',
      title: '✅ Tasks Due',
      status,
      emptyMessage: 'No tasks due or overdue'
    });

    if (status !== 'ok') {
      return shell;
    }

    const footer = hiddenCount > 0 ? `<div class="labs-task-footer">+${hiddenCount} more tasks</div>` : '';
    const body = `<div class="labs-tasks-list">${rows.join('')}</div>${footer}`;

    renderWidgetBody(shell, (el) => {
      el.innerHTML = body;
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

    shell = renderWidgetShell(container, {
      id: 'pipelineFunnel',
      title: '📈 Pipeline Funnel',
      status,
      emptyMessage: 'No pipeline data yet'
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

    shell = renderWidgetShell(container, {
      id: 'pipelineVelocity',
      title: '⏱ Velocity',
      status,
      emptyMessage: 'No active deals to measure'
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

    shell = renderWidgetShell(container, {
      id: 'pipelineRisk',
      title: '🛑 Pipeline Risk',
      status,
      emptyMessage: 'No stale deals 🎉'
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

      stageEntries.forEach(([stage, count], idx) => {
        const config = STAGE_CONFIG[stage] || {};
        const label = config.label || stage || 'Unknown';
        const row = document.createElement('div');
        row.className = 'risk-row';
        row.style.animationDelay = `${idx * 0.05}s`;
        if (onSegmentClick) {
          row.classList.add('segment-clickable');
          row.addEventListener('click', () => onSegmentClick({
            type: ANALYTICS_SEGMENT_TYPES.RISK,
            key: stage,
            label
          }));
        }

        const labelEl = document.createElement('div');
        labelEl.className = 'risk-label';
        labelEl.textContent = `${config.icon || '⚠️'} ${label}`;
        const countEl = document.createElement('div');
        countEl.className = 'risk-count';
        countEl.textContent = count;
        row.appendChild(labelEl);
        row.appendChild(countEl);
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

    shell = renderWidgetShell(container, widgetSpec('partnerPortfolio', {
      status,
      emptyMessage: 'No partners tracked yet.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    const tierGroups = groupPartnersByTier(partners);
    const total = partners.length || 1;
    const tiers = Object.keys(tierGroups).sort();
    const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

    let cumulativePercent = 0;
    const segments = tiers.map((tier, idx) => {
      const count = tierGroups[tier].length;
      const percent = (count / total) * 100;
      const offset = cumulativePercent;
      cumulativePercent += percent;
      return { tier, count, percent, offset, color: colors[idx % colors.length] };
    });

    renderWidgetBody(shell, (body) => {
      const legendHTML = segments.map((seg, idx) => `
        <div class="portfolio-segment" style="animation-delay:${idx * 0.1}s">
          <div class="segment-indicator" style="background:${seg.color}"></div>
          <div class="segment-info">
            <div class="segment-tier">${seg.tier}</div>
            <div class="segment-count">${seg.count} partners</div>
          </div>
          <div class="segment-percent">${seg.percent.toFixed(1)}%</div>
        </div>
      `).join('');

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
        <div class="portfolio-legend">${legendHTML}</div>
      `;

      const legendItems = body.querySelectorAll('.portfolio-segment');
      legendItems.forEach((node, idx) => {
        const seg = segments[idx];
        if (!seg || !onPortfolioSegment) return;
        node.style.cursor = 'pointer';
        node.addEventListener('click', () => {
          onPortfolioSegment({
            domain: 'partners',
            type: 'tier',
            key: seg.tier,
            label: `${seg.tier} partners`
          });
        });
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
    const status = topPartners.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('referralLeaderboard', {
      status,
      emptyMessage: 'No referral data yet.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const partnersHTML = topPartners.map((partner, idx) => {
        const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
        const ranks = ['gold', 'silver', 'bronze', 'standard', 'standard'];
        return `
          <div class="leaderboard-card rank-${ranks[idx]}" style="animation-delay:${idx * 0.1}s" data-partner-id="${partner.id || ''}" data-partner-name="${partner.name || partner.company || ''}">
            <div class="rank-badge">${medals[idx]}</div>
            <div class="partner-info">
              <div class="partner-name">${partner.name || partner.company || 'Partner'}</div>
              <div class="partner-company">${partner.tier || ''}</div>
            </div>
            <div class="partner-stats">
              <div class="stat-value">${partner.volume ? formatCurrency(partner.volume) : partner.referralVolume || 0}</div>
              <div class="stat-label">Volume</div>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = `<div class="leaderboard-list">${partnersHTML}</div>`;

      if (onPortfolioSegment) {
        const rows = body.querySelectorAll('.leaderboard-card');
        rows.forEach((row) => {
          const partnerId = row.dataset.partnerId;
          if (!partnerId) return;
          row.style.cursor = 'pointer';
          row.addEventListener('click', () => {
            const label = row.dataset.partnerName || 'Referral partner';
            onPortfolioSegment({
              domain: 'loans',
              type: 'referrals',
              key: partnerId,
              label
            });
          });
        });
      }
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
export function renderReferralTrendsWidget(container, model) {
  let shell;
  try {
    const trends = model?.analytics?.referralTrends30 || [];
    const status = trends.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('referralTrends', {
      title: 'Referral Trends',
      subtitle: 'Last 30 days vs prior 30',
      status,
      emptyMessage: 'No referral trend data yet.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const rows = trends.slice(0, 10).map((entry, idx) => {
        const direction = entry.direction === 'up' ? '▲' : (entry.direction === 'down' ? '▼' : '–');
        const deltaValue = Number(entry.delta || 0);
        const deltaText = `${deltaValue > 0 ? '+' : ''}${deltaValue}`;
        const directionClass = entry.direction === 'up'
          ? 'trend-up'
          : (entry.direction === 'down' ? 'trend-down' : 'trend-flat');
        return `
          <div class="trend-row ${directionClass}" style="animation-delay:${idx * 0.05}s">
            <div class="trend-name">${entry.partnerName || model.getPartnerDisplayName?.(entry.partnerId) || 'Partner'}</div>
            <div class="trend-stats">
              <div class="trend-current" title="Current window">${entry.currentCount || 0}</div>
              <div class="trend-delta" title="Change vs prior">${direction} ${deltaText}</div>
              <div class="trend-previous" title="Prior window">Prev ${entry.previousCount || 0}</div>
            </div>
          </div>
        `;
      }).join('');

      body.innerHTML = `<div class="trend-list">${rows}</div>`;
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
    const staleDeals = model.snapshot?.staleDeals || getStaleDeals(model.contacts || [], 14);
    const status = staleDeals.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('staleDeals', {
      status,
      emptyMessage: 'No stale deals for this view.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const dealsHTML = staleDeals.slice(0, 6).map((deal, idx) => {
        const dealContact = deal.contact || deal;
        const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(dealContact) : dealContact;
        const daysSince = deal.days || Math.floor((Date.now() - (dealContact.updatedTs || dealContact.createdTs || 0)) / (1000 * 60 * 60 * 24));
        const urgency = daysSince > 30 ? 'critical' : daysSince > 21 ? 'high' : 'medium';
        const stageConfig = STAGE_CONFIG[normalizeStagesForDisplay(loanDisplay.stage)] || {};
        const name = loanDisplay.borrowerName
          || (model.getContactDisplayName ? model.getContactDisplayName(loanDisplay.contactId || dealContact.id) : null)
          || loanDisplay.displayName
          || loanDisplay.name;
        return `
          <div class="stale-card urgency-${urgency}" style="animation-delay:${idx * 0.08}s">
            <div class="stale-header">
              <div class="stale-name">${name || 'Unknown'}</div>
              <div class="stale-days">${daysSince}d</div>
            </div>
            <div class="stale-details">
              <span class="stale-stage">${loanDisplay.stageLabel || stageConfig.label || dealContact.stage}</span>
              ${loanDisplay.loanAmount || loanDisplay.amount ? `<span class="stale-amount">${formatCurrency(loanDisplay.loanAmount || loanDisplay.amount)}</span>` : ''}
            </div>
            <div class="stale-urgency-bar" style="--urgency:${Math.min(daysSince / 30, 1)}"></div>
          </div>
        `;
      }).join('');

      body.innerHTML = `<div class="stale-list">${dealsHTML}</div>`;
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
    const openTasks = getOpenTasks(model.tasks || []);
    const todayTasks = model.snapshot?.focus?.tasksToday || getTodayTasks(openTasks).slice(0, 5);
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
      const tasksHTML = todayTasks.map((task, idx) => `
        <div class="today-item task-item" style="animation-delay:${idx * 0.05}s">
          <div class="today-icon">✓</div>
          <div class="today-content">
            <div class="today-title">${task.title || 'Task'}</div>
            <div class="today-meta">${task.contactName || ''}</div>
          </div>
          <div class="today-time">${task.dueTime || 'All day'}</div>
        </div>
      `).join('');

      const appointmentHTML = appointments.slice(0, 3).map((appt, idx) => `
        <div class="today-item appointment-item" style="animation-delay:${idx * 0.06 + 0.2}s">
          <div class="today-icon">📅</div>
          <div class="today-content">
            <div class="today-title">${appt.title || 'Appointment'}</div>
            <div class="today-meta">${appt.contactName || ''}</div>
          </div>
          <div class="today-time">${formatDate(appt.due || appt.dueTs)}</div>
        </div>
      `).join('');

      const celebrationsHTML = celebrations.map((cel, idx) => `
        <div class="today-item celebration-item" style="animation-delay:${idx * 0.05 + 0.2}s">
          <div class="today-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</div>
          <div class="today-content">
            <div class="today-title">${(model.getContactDisplayName ? model.getContactDisplayName(cel.contact.id) : null) || cel.contact.name || cel.contact.displayName || 'Contact'}</div>
            <div class="today-meta">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
          </div>
          <div class="today-time">${formatDate(cel.date)}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="today-list">${tasksHTML}${appointmentHTML}${celebrationsHTML}</div>`;
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
    const dueGroups = model.snapshot?.dueGroups || {};
    const today = dueGroups.today || [];
    const overdue = dueGroups.overdue || [];
    const status = today.length || overdue.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, {
      id: 'todo',
      title: '✅ To-Do',
      status,
      emptyMessage: 'Nothing due right now'
    });

    if (status !== 'ok') {
      return shell;
    }

    const renderTasks = (items) => items.map((item) => `<li><strong>${item.title || 'Task'}</strong> · ${formatDate(item.due || item.dueTs)}</li>`).join('')
      || '<li class="muted">Nothing queued</li>';

    renderWidgetBody(shell, (body) => {
      body.innerHTML = `
        <div class="todo-columns">
          <div>
            <div class="muted">Due Today</div>
            <ul>${renderTasks(today)}</ul>
          </div>
          <div>
            <div class="muted">Overdue</div>
            <ul>${renderTasks(overdue)}</ul>
          </div>
        </div>
      `;
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
    const overdue = model.snapshot?.dueGroups?.overdue || [];
    const staleDeals = model.snapshot?.staleDeals || getStaleDeals(model.contacts || [], 14);
    const rows = overdue.map((task) => ({
      label: task.title || 'Task',
      meta: 'Overdue',
      tone: 'danger'
    })).concat(staleDeals.slice(0, 5).map((deal) => {
      const loanDisplay = model.getLoanDisplay ? model.getLoanDisplay(deal.contact || deal) : (deal.contact || deal);
      const label = loanDisplay.borrowerName
        || (model.getContactDisplayName ? model.getContactDisplayName(loanDisplay.contactId || loanDisplay.id) : null)
        || loanDisplay.displayName
        || loanDisplay.name
        || 'Contact';
      return {
        label,
        meta: 'Stale deal',
        tone: 'warning'
      };
    }));

    const status = rows.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('priorityActions', {
      status,
      emptyMessage: 'No priority actions right now.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const list = rows.map((row, idx) => `
        <div class="priority-row tone-${row.tone}" style="animation-delay:${idx * 0.05}s">
          <span class="priority-pill">${row.meta}</span>
          <span class="priority-label">${row.label}</span>
        </div>
      `).join('');

      body.innerHTML = `<div class="priority-list">${list}</div>`;
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
    const appointments = model.snapshot?.focus?.nextAppointments || [];
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
    const celebrations = (model.celebrations || []).slice(0, 8);
    const status = celebrations.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('upcomingCelebrations', {
      status,
      emptyMessage: 'No celebrations.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const items = celebrations.map((cel, idx) => `
        <div class="celebration-row" style="animation-delay:${idx * 0.05}s">
          <span class="celebration-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</span>
          <div class="celebration-info">
            <div class="celebration-name">${cel.contact.displayName || cel.contact.name || (model.getContactDisplayName ? model.getContactDisplayName(cel.contact.id) : 'Contact')}</div>
            <div class="celebration-type">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
          </div>
          <div class="celebration-date">${formatDate(cel.date)}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="celebration-list">${items}</div>`;
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

    shell = renderWidgetShell(container, widgetSpec('relationshipOpportunities', {
      status,
      emptyMessage: 'No nurture targets right now.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const items = nurture.slice(0, 8).map((contact, idx) => `
        <div class="relationship-row" style="animation-delay:${idx * 0.05}s">
          <div class="relationship-name">${(model.getContactDisplayName ? model.getContactDisplayName(contact.id) : null) || contact.displayName || contact.name || 'Contact'}</div>
          <div class="relationship-stage">${STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage}</div>
          <div class="relationship-updated">${formatRelativeTime(contact.updatedTs)}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="relationship-list">${items}</div>`;

      const rows = body.querySelectorAll('.relationship-row');
      rows.forEach((row) => {
        if (!onPortfolioSegment) return;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
          onPortfolioSegment({
            domain: 'contacts',
            type: 'relationship',
            key: 'nurture',
            label: 'Relationship opportunities'
          });
        });
      });
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
    const closing = (model.contacts || []).filter((c) => ['approved', 'cleared-to-close', 'funded'].includes(normalizeStagesForDisplay(c.stage)));
    const status = closing.length ? 'ok' : 'empty';

    shell = renderWidgetShell(container, widgetSpec('closingWatch', {
      status,
      emptyMessage: 'No files nearing close.'
    }));

    if (status !== 'ok') {
      return shell;
    }

    renderWidgetBody(shell, (body) => {
      const items = closing.slice(0, 6).map((contact, idx) => `
        <div class="closing-row" style="animation-delay:${idx * 0.05}s">
          <div class="closing-main">
            <div class="closing-name">${(model.getContactDisplayName ? model.getContactDisplayName(contact.id) : null) || contact.displayName || contact.name || 'Contact'}</div>
            <div class="closing-stage">${STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage}</div>
          </div>
          <div class="closing-amount">${contact.loanAmount ? formatCurrency(contact.loanAmount) : ''}</div>
        </div>
      `).join('');

      body.innerHTML = `<div class="closing-list">${items}</div>`;
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
    const contacts = model.contacts || [];
    contacts.forEach((contact) => {
      const key = contact.milestone || 'Unknown';
      milestoneCounts[key] = (milestoneCounts[key] || 0) + 1;
    });

    const entries = Object.entries(milestoneCounts);
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
    const appointments = model.snapshot?.focus?.nextAppointments || [];
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
      emptyMessage: 'No items yet.'
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
  favorites: renderFavoritesWidget
};

export default CRM_WIDGET_RENDERERS;
