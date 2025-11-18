// Labs CRM Widgets - Canonical-data-backed and visually modern

import {
  calculateKPIsFromSnapshot,
  groupByStage,
  groupPartnersByTier,
  getTopReferralPartners,
  getStaleDeals,
  getUpcomingCelebrations,
  getTodayTasks,
  STAGE_CONFIG,
  formatCurrency,
  formatNumber,
  formatDate,
  formatRelativeTime,
  normalizeStagesForDisplay
} from './data.js';

function renderCard(container, { title, body, badge } = {}) {
  const card = document.createElement('div');
  card.className = 'labs-crm-widget';
  card.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">${title || ''}</h3>
      ${badge ? `<span class="labs-widget-badge">${badge}</span>` : ''}
    </div>
    <div class="labs-widget-body">${body || ''}</div>
  `;
  container.appendChild(card);
  return card;
}

// =======================
// KPI tiles
// =======================
export function renderKPIsWidget(container, model) {
  const kpis = calculateKPIsFromSnapshot(model.snapshot) || {};
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
  const groups = model.snapshot?.pipelineCounts || groupByStage(model.contacts);
  const total = model.contacts.length || 1;
  const stages = Object.keys(STAGE_CONFIG);

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

  renderCard(container, {
    title: '🌊 Pipeline Momentum',
    body: `<div class="momentum-bars">${barsHTML}</div>`
  });
}

// =======================
// Partner portfolio donut
// =======================
export function renderPartnerPortfolioWidget(container, model) {
  const partners = model.partners || [];
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

  renderCard(container, {
    title: '🎯 Partner Portfolio',
    body: `
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
    `
  });
}

// =======================
// Referral leaderboard
// =======================
export function renderReferralLeaderboardWidget(container, model) {
  const topPartners = model.snapshot?.leaderboard?.slice(0, 5) || getTopReferralPartners(model.partners, 5);
  if (!topPartners.length) {
    renderCard(container, { title: '🏆 Referral Leaders', body: '<p class="empty-state">No referral data yet</p>' });
    return;
  }

  const partnersHTML = topPartners.map((partner, idx) => {
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    const ranks = ['gold', 'silver', 'bronze', 'standard', 'standard'];
    return `
      <div class="leaderboard-card rank-${ranks[idx]}" style="animation-delay:${idx * 0.1}s">
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

  renderCard(container, {
    title: '🏆 Referral Leaders',
    body: `<div class="leaderboard-list">${partnersHTML}</div>`
  });
}

// =======================
// Stale deals
// =======================
export function renderStaleDealsWidget(container, model) {
  const staleDeals = model.snapshot?.staleDeals || getStaleDeals(model.contacts, 14);
  const dealsHTML = staleDeals.slice(0, 6).map((deal, idx) => {
    const daysSince = deal.days || Math.floor((Date.now() - (deal.updatedTs || deal.createdTs || 0)) / (1000 * 60 * 60 * 24));
    const urgency = daysSince > 30 ? 'critical' : daysSince > 21 ? 'high' : 'medium';
    const stageConfig = STAGE_CONFIG[normalizeStagesForDisplay(deal.stage)] || {};
    return `
      <div class="stale-card urgency-${urgency}" style="animation-delay:${idx * 0.08}s">
        <div class="stale-header">
          <div class="stale-name">${deal.displayName || deal.name || 'Unknown'}</div>
          <div class="stale-days">${daysSince}d</div>
        </div>
        <div class="stale-details">
          <span class="stale-stage">${stageConfig.label || deal.stage}</span>
          ${deal.loanAmount ? `<span class="stale-amount">${formatCurrency(deal.loanAmount)}</span>` : ''}
        </div>
        <div class="stale-urgency-bar" style="--urgency:${Math.min(daysSince / 30, 1)}"></div>
      </div>
    `;
  }).join('');

  renderCard(container, {
    title: '⚠️ Stale Deals',
    badge: staleDeals.length,
    body: `<div class="stale-list">${dealsHTML || '<p class="empty-state">No stale deals 🎉</p>'}</div>`
  });
}

// =======================
// Today's work & celebrations
// =======================
export function renderTodayWidget(container, model) {
  const todayTasks = model.snapshot?.focus?.tasksToday || getTodayTasks(model.tasks).slice(0, 5);
  const celebrations = getUpcomingCelebrations(model.contacts, 7).slice(0, 4);
  const appointments = model.snapshot?.focus?.nextAppointments || [];

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
        <div class="today-title">${cel.contact.name || cel.contact.displayName || 'Contact'}</div>
        <div class="today-meta">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
      </div>
      <div class="today-time">${formatDate(cel.date)}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: "📅 Today's Work",
    body: `<div class="today-list">${tasksHTML || '<p class="empty-state">No tasks for today</p>'}${appointmentHTML}${celebrationsHTML}</div>`
  });
}

// =======================
// Pipeline overview funnel
// =======================
export function renderPipelineOverviewWidget(container, model) {
  const groups = model.snapshot?.pipelineCounts || groupByStage(model.contacts);
  const funnelStages = model.laneOrder || Object.keys(STAGE_CONFIG);

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
  const activeContacts = model.contacts.filter((contact) => {
    const stage = normalizeStagesForDisplay(contact.stage);
    return stage && !['lost', 'funded', 'post-close', 'past-client', 'returning'].includes(stage);
  });

  const contactsHTML = activeContacts.slice(0, 9).map((contact, idx) => {
    const config = STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)] || {};
    return `
      <div class="pipeline-card" style="animation-delay:${idx * 0.05}s; border-left-color:${config.color || '#4f46e5'}">
        <div class="card-header">
          <div class="contact-name">${contact.displayName || contact.name || 'Unknown'}</div>
          <div class="contact-stage" style="background:${(config.color || '#4f46e5')}20; color:${config.color || '#4f46e5'}">
            ${config.icon || ''} ${config.label || contact.stage}
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
        ${block('Recent Leads', leads.map((l) => l.displayName || l.name || 'Lead'))}
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
  const dueGroups = model.snapshot?.dueGroups || {};
  const today = dueGroups.today || [];
  const overdue = dueGroups.overdue || [];

  const renderTasks = (items) => items.map((item) => `<li><strong>${item.title || 'Task'}</strong> · ${formatDate(item.due || item.dueTs)}</li>`).join('')
    || '<li class="muted">Nothing queued</li>';

  renderCard(container, {
    title: '✅ To-Do',
    body: `
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
    `
  });
}

// =======================
// Priority actions (overdue + stale)
// =======================
export function renderPriorityActionsWidget(container, model) {
  const overdue = model.snapshot?.dueGroups?.overdue || [];
  const staleDeals = model.snapshot?.staleDeals || getStaleDeals(model.contacts, 14);
  const rows = overdue.map((task) => ({
    label: task.title || 'Task',
    meta: 'Overdue',
    tone: 'danger'
  })).concat(staleDeals.slice(0, 5).map((deal) => ({
    label: deal.displayName || deal.name || 'Contact',
    meta: 'Stale deal',
    tone: 'warning'
  })));

  const list = rows.map((row, idx) => `
    <div class="priority-row tone-${row.tone}" style="animation-delay:${idx * 0.05}s">
      <span class="priority-pill">${row.meta}</span>
      <span class="priority-label">${row.label}</span>
    </div>
  `).join('');

  renderCard(container, {
    title: '🚨 Priority Actions',
    body: `<div class="priority-list">${list || '<p class="empty-state">All clear</p>'}</div>`
  });
}

// =======================
// Milestones / appointments
// =======================
export function renderMilestonesWidget(container, model) {
  const appointments = model.snapshot?.focus?.nextAppointments || [];
  const rows = appointments.slice(0, 6).map((appt, idx) => `
    <div class="milestone-row" style="animation-delay:${idx * 0.05}s">
      <div>
        <div class="milestone-title">${appt.title || 'Appointment'}</div>
        <div class="milestone-sub">${appt.contactName || ''}</div>
      </div>
      <div class="milestone-date">${formatDate(appt.due || appt.dueTs)}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '📌 Milestones Ahead',
    body: `<div class="milestone-list">${rows || '<p class="empty-state">No milestones</p>'}</div>`
  });
}

// =======================
// Celebrations (birthdays / anniversaries)
// =======================
export function renderUpcomingCelebrationsWidget(container, model) {
  const celebrations = model.celebrations.slice(0, 8);
  const items = celebrations.map((cel, idx) => `
    <div class="celebration-row" style="animation-delay:${idx * 0.05}s">
      <span class="celebration-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</span>
      <div class="celebration-info">
        <div class="celebration-name">${cel.contact.name || cel.contact.displayName || 'Contact'}</div>
        <div class="celebration-type">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
      </div>
      <div class="celebration-date">${formatDate(cel.date)}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '🎉 Upcoming Celebrations',
    body: `<div class="celebration-list">${items || '<p class="empty-state">No celebrations</p>'}</div>`
  });
}

// =======================
// Relationship / nurture radar
// =======================
export function renderRelationshipWidget(container, model) {
  const nurture = model.contacts.filter((c) => ['past-client', 'returning', 'post-close'].includes(normalizeStagesForDisplay(c.stage)));
  const items = nurture.slice(0, 8).map((contact, idx) => `
    <div class="relationship-row" style="animation-delay:${idx * 0.05}s">
      <div class="relationship-name">${contact.displayName || contact.name || 'Contact'}</div>
      <div class="relationship-stage">${STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage}</div>
      <div class="relationship-updated">${formatRelativeTime(contact.updatedTs)}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '🤝 Client Care Radar',
    body: `<div class="relationship-list">${items || '<p class="empty-state">No nurture targets</p>'}</div>`
  });
}

// =======================
// Closing watchlist
// =======================
export function renderClosingWatchWidget(container, model) {
  const closing = model.contacts.filter((c) => ['approved', 'cleared-to-close', 'funded'].includes(normalizeStagesForDisplay(c.stage)));
  const items = closing.slice(0, 6).map((contact, idx) => `
    <div class="closing-row" style="animation-delay:${idx * 0.05}s">
      <div class="closing-main">
        <div class="closing-name">${contact.displayName || contact.name || 'Contact'}</div>
        <div class="closing-stage">${STAGE_CONFIG[normalizeStagesForDisplay(contact.stage)]?.label || contact.stage}</div>
      </div>
      <div class="closing-amount">${contact.loanAmount ? formatCurrency(contact.loanAmount) : ''}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '🛫 Closing Watch',
    body: `<div class="closing-list">${items || '<p class="empty-state">No files nearing close</p>'}</div>`
  });
}

// =======================
// Doc pulse based on milestones
// =======================
export function renderDocPulseWidget(container, model) {
  const milestoneCounts = {};
  model.contacts.forEach((contact) => {
    const key = contact.milestone || 'Unknown';
    milestoneCounts[key] = (milestoneCounts[key] || 0) + 1;
  });

  const rows = Object.entries(milestoneCounts).map(([milestone, count], idx) => `
    <div class="doc-row" style="animation-delay:${idx * 0.04}s">
      <span class="doc-milestone">${milestone}</span>
      <span class="doc-count">${count}</span>
    </div>
  `).join('');

  renderCard(container, {
    title: '📁 Document Pulse',
    body: `<div class="doc-list">${rows || '<p class="empty-state">No milestone data</p>'}</div>`
  });
}

// =======================
// Pipeline calendar (appointments timeline)
// =======================
export function renderPipelineCalendarWidget(container, model) {
  const appointments = model.snapshot?.focus?.nextAppointments || [];
  const timeline = appointments.slice(0, 6).map((appt, idx) => `
    <div class="timeline-row" style="animation-delay:${idx * 0.05}s">
      <div class="timeline-date">${formatDate(appt.due || appt.dueTs)}</div>
      <div class="timeline-body">
        <div class="timeline-title">${appt.title || 'Appointment'}</div>
        <div class="timeline-meta">${appt.contactName || ''}</div>
      </div>
    </div>
  `).join('');

  renderCard(container, {
    title: '🗓 Pipeline Calendar',
    body: `<div class="timeline-list">${timeline || '<p class="empty-state">No upcoming events</p>'}</div>`
  });
}

// =======================
// Favorites / recent leads
// =======================
export function renderFavoritesWidget(container, model) {
  const leads = model.snapshot?.focus?.recentLeads || [];
  const list = leads.map((lead, idx) => `
    <div class="favorite-row" style="animation-delay:${idx * 0.05}s">
      <div class="favorite-name">${lead.displayName || lead.name || 'Lead'}</div>
      <div class="favorite-stage">${STAGE_CONFIG[normalizeStagesForDisplay(lead.stage)]?.label || lead.stage}</div>
    </div>
  `).join('');

  renderCard(container, {
    title: '⭐ Favorites',
    body: `<div class="favorite-list">${list || '<p class="empty-state">No saved favorites</p>'}</div>`
  });
}

// Map of widget renderers aligned to dashboard catalog
export const CRM_WIDGET_RENDERERS = {
  kpis: renderKPIsWidget,
  pipelineMomentum: renderPipelineMomentumWidget,
  partnerPortfolio: renderPartnerPortfolioWidget,
  referralLeaderboard: renderReferralLeaderboardWidget,
  staleDeals: renderStaleDealsWidget,
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
  docPulse: renderDocPulseWidget,
  relationshipOpportunities: renderRelationshipWidget,
  clientCareRadar: renderRelationshipWidget,
  closingWatch: renderClosingWatchWidget,
  upcomingCelebrations: renderUpcomingCelebrationsWidget,
  docCenter: renderDocPulseWidget,
  favorites: renderFavoritesWidget
};

export default CRM_WIDGET_RENDERERS;
