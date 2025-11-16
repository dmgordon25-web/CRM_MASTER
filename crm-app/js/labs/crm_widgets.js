// Labs CRM Widgets - Visually Stunning Versions of Actual CRM Features
// Uses real data from CRM database

import {
  calculateKPIs,
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
  formatRelativeTime
} from './data.js';

// ========================================
// KPIs WIDGET - Radial Progress Design
// ========================================
export function renderKPIsWidget(container, contacts) {
  const kpis = calculateKPIs(contacts);

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget kpis-widget';
  widget.dataset.qa = 'labs-kpis';

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">📊 Pipeline KPIs</h3>
      <button class="labs-widget-refresh" title="Refresh">⟳</button>
    </div>
    <div class="labs-widget-body">
      <div class="kpis-grid">
        <div class="kpi-card kpi-new" data-value="${kpis.newLeads}">
          <div class="kpi-radial">
            <svg class="kpi-circle" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="kpi-bg"/>
              <circle cx="50" cy="50" r="45" class="kpi-progress" style="--progress: ${Math.min(kpis.newLeads / 50, 1)}"/>
            </svg>
            <div class="kpi-value">${kpis.newLeads}</div>
          </div>
          <div class="kpi-label">New Leads</div>
        </div>

        <div class="kpi-card kpi-qualified" data-value="${kpis.qualified}">
          <div class="kpi-radial">
            <svg class="kpi-circle" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="kpi-bg"/>
              <circle cx="50" cy="50" r="45" class="kpi-progress" style="--progress: ${Math.min(kpis.qualified / 30, 1)}"/>
            </svg>
            <div class="kpi-value">${kpis.qualified}</div>
          </div>
          <div class="kpi-label">Qualified</div>
        </div>

        <div class="kpi-card kpi-won" data-value="${kpis.won}">
          <div class="kpi-radial">
            <svg class="kpi-circle" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="kpi-bg"/>
              <circle cx="50" cy="50" r="45" class="kpi-progress" style="--progress: ${Math.min(kpis.won / 20, 1)}"/>
            </svg>
            <div class="kpi-value">${kpis.won}</div>
          </div>
          <div class="kpi-label">Funded</div>
          <div class="kpi-sublabel">${formatCurrency(kpis.totalValue)}</div>
        </div>

        <div class="kpi-card kpi-lost" data-value="${kpis.lost}">
          <div class="kpi-radial">
            <svg class="kpi-circle" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="kpi-bg"/>
              <circle cx="50" cy="50" r="45" class="kpi-progress" style="--progress: ${Math.min(kpis.lost / 20, 1)}"/>
            </svg>
            <div class="kpi-value">${kpis.lost}</div>
          </div>
          <div class="kpi-label">Lost</div>
        </div>
      </div>

      <div class="kpis-summary">
        <div class="summary-stat">
          <span class="stat-icon">📈</span>
          <div>
            <div class="stat-value">${kpis.activePipeline}</div>
            <div class="stat-label">Active Pipeline</div>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// PIPELINE MOMENTUM WIDGET - Flowing Bars
// ========================================
export function renderPipelineMomentumWidget(container, contacts) {
  const groups = groupByStage(contacts);
  const total = contacts.length || 1;

  const stages = [
    'longshot',
    'application',
    'qualified',
    'processing',
    'underwriting',
    'approved',
    'cleared-to-close',
    'funded'
  ];

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget pipeline-momentum-widget';
  widget.dataset.qa = 'labs-pipeline-momentum';

  const barsHTML = stages.map((stage, idx) => {
    const count = groups[stage]?.length || 0;
    const percent = ((count / total) * 100).toFixed(1);
    const config = STAGE_CONFIG[stage] || {};

    return `
      <div class="momentum-bar-row" style="animation-delay: ${idx * 0.05}s">
        <div class="momentum-label">
          <span class="stage-icon">${config.icon || '●'}</span>
          <span class="stage-name">${config.label || stage}</span>
        </div>
        <div class="momentum-bar-container">
          <div class="momentum-bar" style="--bar-width: ${percent}%; --bar-color: ${config.color}">
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

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">🌊 Pipeline Momentum</h3>
    </div>
    <div class="labs-widget-body">
      <div class="momentum-bars">
        ${barsHTML}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// PARTNER PORTFOLIO WIDGET - Donut Chart
// ========================================
export function renderPartnerPortfolioWidget(container, partners) {
  const tierGroups = groupPartnersByTier(partners);
  const total = partners.length || 1;

  const tiers = Object.keys(tierGroups).sort();
  const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#6366f1'];

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget portfolio-widget';
  widget.dataset.qa = 'labs-portfolio';

  let cumulativePercent = 0;
  const segments = tiers.map((tier, idx) => {
    const count = tierGroups[tier].length;
    const percent = (count / total) * 100;
    const offset = cumulativePercent;
    cumulativePercent += percent;

    return {
      tier,
      count,
      percent,
      offset,
      color: colors[idx % colors.length]
    };
  });

  const segmentsHTML = segments.map((seg, idx) => `
    <div class="portfolio-segment" style="animation-delay: ${idx * 0.1}s">
      <div class="segment-indicator" style="background: ${seg.color}"></div>
      <div class="segment-info">
        <div class="segment-tier">${seg.tier}</div>
        <div class="segment-count">${seg.count} partners</div>
      </div>
      <div class="segment-percent">${seg.percent.toFixed(1)}%</div>
    </div>
  `).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">🎯 Partner Portfolio</h3>
    </div>
    <div class="labs-widget-body">
      <div class="portfolio-donut">
        <svg viewBox="0 0 100 100" class="donut-chart">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" stroke-width="20"/>
          ${segments.map(seg => {
            const circumference = 2 * Math.PI * 40;
            const strokeDash = (seg.percent / 100) * circumference;
            const strokeOffset = -((seg.offset / 100) * circumference);
            return `<circle cx="50" cy="50" r="40" fill="none" stroke="${seg.color}" stroke-width="20"
              stroke-dasharray="${strokeDash} ${circumference}"
              stroke-dashoffset="${strokeOffset}"
              transform="rotate(-90 50 50)"
              class="donut-segment"/>`;
          }).join('')}
        </svg>
        <div class="donut-center">
          <div class="donut-total">${total}</div>
          <div class="donut-label">Partners</div>
        </div>
      </div>
      <div class="portfolio-legend">
        ${segmentsHTML}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// REFERRAL LEADERBOARD WIDGET - Podium Design
// ========================================
export function renderReferralLeaderboardWidget(container, partners) {
  const topPartners = getTopReferralPartners(partners, 5);

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget leaderboard-widget';
  widget.dataset.qa = 'labs-leaderboard';

  const partnersHTML = topPartners.map((partner, idx) => {
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    const ranks = ['gold', 'silver', 'bronze', 'standard', 'standard'];

    return `
      <div class="leaderboard-card rank-${ranks[idx]}" style="animation-delay: ${idx * 0.1}s">
        <div class="rank-badge">${medals[idx]}</div>
        <div class="partner-info">
          <div class="partner-name">${partner.name || 'Unknown'}</div>
          <div class="partner-company">${partner.company || ''}</div>
        </div>
        <div class="partner-stats">
          <div class="stat-value">${partner.referralVolume || 0}</div>
          <div class="stat-label">Referrals</div>
        </div>
      </div>
    `;
  }).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">🏆 Referral Leaders</h3>
    </div>
    <div class="labs-widget-body">
      <div class="leaderboard-list">
        ${partnersHTML || '<p class="empty-state">No referral data available</p>'}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// STALE DEALS WIDGET - Urgency Cards
// ========================================
export function renderStaleDeal sWidget(container, contacts) {
  const staleDeals = getStaleDeals(contacts, 14);

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget stale-widget';
  widget.dataset.qa = 'labs-stale';

  const dealsHTML = staleDeals.slice(0, 5).map((contact, idx) => {
    const daysSince = Math.floor((Date.now() - (contact.updatedAt || contact.createdAt)) / (1000 * 60 * 60 * 24));
    const urgency = daysSince > 30 ? 'critical' : daysSince > 21 ? 'high' : 'medium';

    return `
      <div class="stale-card urgency-${urgency}" style="animation-delay: ${idx * 0.08}s">
        <div class="stale-header">
          <div class="stale-name">${contact.name || 'Unknown'}</div>
          <div class="stale-days">${daysSince}d</div>
        </div>
        <div class="stale-details">
          <span class="stale-stage">${STAGE_CONFIG[contact.stage]?.label || contact.stage}</span>
          ${contact.loanAmount ? `<span class="stale-amount">${formatCurrency(contact.loanAmount)}</span>` : ''}
        </div>
        <div class="stale-urgency-bar" style="--urgency: ${Math.min(daysSince / 30, 1)}"></div>
      </div>
    `;
  }).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">⚠️ Stale Deals</h3>
      <span class="labs-widget-badge">${staleDeals.length}</span>
    </div>
    <div class="labs-widget-body">
      <div class="stale-list">
        ${dealsHTML || '<p class="empty-state">No stale deals! 🎉</p>'}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// TODAY'S WORK WIDGET - Timeline Design
// ========================================
export function renderTodayWidget(container, tasks, contacts) {
  const todayTasks = getTodayTasks(tasks);
  const celebrations = getUpcomingCelebrations(contacts, 7);

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget today-widget';
  widget.dataset.qa = 'labs-today';

  const tasksHTML = todayTasks.slice(0, 5).map((task, idx) => `
    <div class="today-item task-item" style="animation-delay: ${idx * 0.05}s">
      <div class="today-icon">✓</div>
      <div class="today-content">
        <div class="today-title">${task.title || 'Untitled Task'}</div>
        <div class="today-meta">${task.contactName || ''}</div>
      </div>
      <div class="today-time">${task.dueTime || 'All day'}</div>
    </div>
  `).join('');

  const celebrationsHTML = celebrations.slice(0, 3).map((cel, idx) => `
    <div class="today-item celebration-item" style="animation-delay: ${idx * 0.05 + 0.2}s">
      <div class="today-icon">${cel.type === 'birthday' ? '🎂' : '💍'}</div>
      <div class="today-content">
        <div class="today-title">${cel.contact.name}</div>
        <div class="today-meta">${cel.type === 'birthday' ? 'Birthday' : 'Anniversary'}</div>
      </div>
      <div class="today-time">${formatDate(cel.date)}</div>
    </div>
  `).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">📅 Today's Work</h3>
    </div>
    <div class="labs-widget-body">
      <div class="today-list">
        ${tasksHTML || '<p class="empty-state">No tasks for today</p>'}
        ${celebrationsHTML}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// PIPELINE OVERVIEW WIDGET - 3D Funnel
// ========================================
export function renderPipelineOverviewWidget(container, contacts) {
  const groups = groupByStage(contacts);

  const funnelStages = [
    { key: 'longshot', width: 100 },
    { key: 'application', width: 85 },
    { key: 'qualified', width: 70 },
    { key: 'processing', width: 55 },
    { key: 'underwriting', width: 45 },
    { key: 'approved', width: 35 },
    { key: 'cleared-to-close', width: 25 },
    { key: 'funded', width: 15 }
  ];

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget pipeline-overview-widget';
  widget.dataset.qa = 'labs-pipeline-overview';

  const funnelHTML = funnelStages.map((stage, idx) => {
    const count = groups[stage.key]?.length || 0;
    const config = STAGE_CONFIG[stage.key] || {};

    return `
      <div class="funnel-stage" style="--stage-width: ${stage.width}%; --stage-color: ${config.color}; animation-delay: ${idx * 0.08}s">
        <div class="funnel-bar">
          <span class="funnel-label">${config.icon} ${config.label}</span>
          <span class="funnel-count">${count}</span>
        </div>
      </div>
    `;
  }).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">🎯 Pipeline Overview</h3>
    </div>
    <div class="labs-widget-body">
      <div class="pipeline-funnel">
        ${funnelHTML}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// ========================================
// ACTIVE PIPELINE WIDGET - Card Grid
// ========================================
export function renderActivePipelineWidget(container, contacts) {
  const activeContacts = contacts.filter(c => {
    const stage = c.stage;
    return stage && !['lost', 'denied', 'funded', 'post-close'].includes(stage);
  });

  const widget = document.createElement('div');
  widget.className = 'labs-crm-widget active-pipeline-widget';
  widget.dataset.qa = 'labs-active-pipeline';

  const contactsHTML = activeContacts.slice(0, 8).map((contact, idx) => {
    const config = STAGE_CONFIG[contact.stage] || {};

    return `
      <div class="pipeline-card" style="animation-delay: ${idx * 0.05}s; border-left-color: ${config.color}">
        <div class="card-header">
          <div class="contact-name">${contact.name || 'Unknown'}</div>
          <div class="contact-stage" style="background: ${config.color}20; color: ${config.color}">
            ${config.icon} ${config.label}
          </div>
        </div>
        <div class="card-body">
          ${contact.loanAmount ? `<div class="card-amount">${formatCurrency(contact.loanAmount)}</div>` : ''}
          ${contact.email ? `<div class="card-detail">📧 ${contact.email}</div>` : ''}
          ${contact.phone ? `<div class="card-detail">📞 ${contact.phone}</div>` : ''}
        </div>
        <div class="card-footer">
          <span class="card-updated">${formatRelativeTime(contact.updatedAt)}</span>
        </div>
      </div>
    `;
  }).join('');

  widget.innerHTML = `
    <div class="labs-widget-header">
      <h3 class="labs-widget-title">💼 Active Pipeline</h3>
      <span class="labs-widget-badge">${activeContacts.length}</span>
    </div>
    <div class="labs-widget-body">
      <div class="pipeline-cards-grid">
        ${contactsHTML || '<p class="empty-state">No active deals</p>'}
      </div>
    </div>
  `;

  container.appendChild(widget);
}

// Export all widget renderers
export const CRM_WIDGET_RENDERERS = {
  kpis: renderKPIsWidget,
  pipelineMomentum: renderPipelineMomentumWidget,
  partnerPortfolio: renderPartnerPortfolioWidget,
  referralLeaderboard: renderReferralLeaderboardWidget,
  staleDeals: renderStaleDealsWidget,
  today: renderTodayWidget,
  pipelineOverview: renderPipelineOverviewWidget,
  activePipeline: renderActivePipelineWidget
};
