// Labs Dashboard Widgets - Creative & Experimental
// Feel free to break the rules and experiment!

import { findLabsWidgetMeta } from './config.js';

// Utility: Random data generators for demos
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function generateSparkData(points = 20) {
  return Array.from({ length: points }, () => randomFloat(20, 100));
}

// ========================================
// VELOCITY METER WIDGET
// ========================================
export function renderVelocityWidget(container) {
  const meta = findLabsWidgetMeta('velocity');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget velocity-widget';
  wrapper.dataset.qa = 'labs-velocity';

  const velocity = randomInt(45, 95);
  const trend = velocity > 70 ? 'up' : velocity > 50 ? 'stable' : 'down';

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '⚡'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Velocity'}</h3>
      <span class="labs-widget-badge ${trend}">${trend}</span>
    </div>
    <div class="labs-widget-body">
      <div class="velocity-meter">
        <svg viewBox="0 0 200 120" class="velocity-gauge">
          <defs>
            <linearGradient id="velocity-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="#ef4444" />
              <stop offset="50%" stop-color="#f59e0b" />
              <stop offset="100%" stop-color="#10b981" />
            </linearGradient>
          </defs>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#velocity-gradient)" stroke-width="12" stroke-linecap="round" opacity="0.3"/>
          <path d="M 20 100 A 80 80 0 0 1 ${20 + (160 * velocity / 100)} ${100 - Math.sin((velocity / 100) * Math.PI) * 80}" fill="none" stroke="url(#velocity-gradient)" stroke-width="12" stroke-linecap="round" class="velocity-progress"/>
          <circle cx="100" cy="100" r="6" fill="#06b6d4" class="velocity-needle-base"/>
          <line x1="100" y1="100" x2="${100 + Math.cos(Math.PI - (velocity / 100) * Math.PI) * 70}" y2="${100 - Math.sin((velocity / 100) * Math.PI) * 70}" stroke="#06b6d4" stroke-width="3" stroke-linecap="round" class="velocity-needle"/>
        </svg>
        <div class="velocity-value">${velocity}<span class="velocity-unit">%</span></div>
        <div class="velocity-label">Deal Velocity</div>
      </div>
      <div class="velocity-stats">
        <div class="velocity-stat">
          <span class="stat-value">${randomInt(12, 45)}</span>
          <span class="stat-label">Deals/Week</span>
        </div>
        <div class="velocity-stat">
          <span class="stat-value">${randomInt(5, 15)}</span>
          <span class="stat-label">Avg Days</span>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// NETWORK GRAPH WIDGET
// ========================================
export function renderNetworkWidget(container) {
  const meta = findLabsWidgetMeta('network');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget network-widget';
  wrapper.dataset.qa = 'labs-network';

  const nodes = [
    { id: 'you', label: 'You', x: 50, y: 50, size: 24, color: '#06b6d4' },
    { id: 'p1', label: 'Partner A', x: 20, y: 30, size: 18, color: '#8b5cf6' },
    { id: 'p2', label: 'Partner B', x: 80, y: 30, size: 16, color: '#8b5cf6' },
    { id: 'p3', label: 'Partner C', x: 15, y: 70, size: 14, color: '#8b5cf6' },
    { id: 'p4', label: 'Partner D', x: 85, y: 65, size: 16, color: '#8b5cf6' },
    { id: 'c1', label: 'Client 1', x: 35, y: 15, size: 12, color: '#10b981' },
    { id: 'c2', label: 'Client 2', x: 65, y: 12, size: 12, color: '#10b981' },
    { id: 'c3', label: 'Client 3', x: 10, y: 50, size: 10, color: '#10b981' },
    { id: 'c4', label: 'Client 4', x: 90, y: 48, size: 10, color: '#10b981' },
    { id: 'c5', label: 'Client 5', x: 50, y: 85, size: 12, color: '#10b981' }
  ];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🌐'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Network'}</h3>
      <button class="labs-widget-action" title="Expand">⛶</button>
    </div>
    <div class="labs-widget-body">
      <svg viewBox="0 0 100 100" class="network-graph" preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        ${nodes.map((node, i) =>
          nodes.slice(i + 1).map(other => {
            const distance = Math.sqrt(Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2));
            return distance < 40 ? `<line x1="${node.x}" y1="${node.y}" x2="${other.x}" y2="${other.y}" stroke="${node.color}20" stroke-width="0.3" class="network-edge"/>` : '';
          }).join('')
        ).join('')}
        ${nodes.map(node => `
          <circle cx="${node.x}" cy="${node.y}" r="${node.size / 4}" fill="${node.color}" opacity="0.8" filter="url(#glow)" class="network-node">
            <title>${node.label}</title>
          </circle>
        `).join('')}
      </svg>
      <div class="network-legend">
        <span class="legend-item"><span class="legend-dot" style="background: #06b6d4"></span> You</span>
        <span class="legend-item"><span class="legend-dot" style="background: #8b5cf6"></span> Partners</span>
        <span class="legend-item"><span class="legend-dot" style="background: #10b981"></span> Clients</span>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// ACTIVITY HEATMAP WIDGET
// ========================================
export function renderHeatmapWidget(container) {
  const meta = findLabsWidgetMeta('heatmap');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget heatmap-widget';
  wrapper.dataset.qa = 'labs-heatmap';

  const weeks = 12;
  const days = 7;
  const data = Array.from({ length: weeks }, () =>
    Array.from({ length: days }, () => randomInt(0, 10))
  );

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🔥'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Activity Heatmap'}</h3>
      <div class="labs-widget-controls">
        <select class="labs-select-mini">
          <option>Last 3 months</option>
          <option>Last 6 months</option>
          <option>This year</option>
        </select>
      </div>
    </div>
    <div class="labs-widget-body">
      <div class="heatmap-container">
        <div class="heatmap-grid">
          ${data.map((week, weekIdx) => `
            <div class="heatmap-week">
              ${week.map((value, dayIdx) => {
                const intensity = value / 10;
                const color = intensity > 0.7 ? '#10b981' : intensity > 0.4 ? '#f59e0b' : intensity > 0.1 ? '#06b6d4' : '#1e293b';
                return `<div class="heatmap-cell" style="background: ${color}; opacity: ${0.3 + intensity * 0.7}" title="${dayLabels[dayIdx]}: ${value} activities"></div>`;
              }).join('')}
            </div>
          `).join('')}
        </div>
        <div class="heatmap-scale">
          <span class="scale-label">Less</span>
          <div class="scale-gradient"></div>
          <span class="scale-label">More</span>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// AI INSIGHTS WIDGET
// ========================================
export function renderAIInsightsWidget(container) {
  const meta = findLabsWidgetMeta('aiInsights');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget ai-insights-widget';
  wrapper.dataset.qa = 'labs-ai-insights';

  const insights = [
    { text: 'Partner "Smith & Co" is 85% likely to send a referral this week', confidence: 85, type: 'prediction' },
    { text: '3 deals are at risk of going stale in the next 5 days', confidence: 72, type: 'warning' },
    { text: 'Best time to contact Client Johnson: Tuesday 2-4 PM', confidence: 91, type: 'recommendation' }
  ];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon animate-pulse">${meta?.icon || '🤖'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'AI Insights'}</h3>
      <span class="labs-widget-badge live">LIVE</span>
    </div>
    <div class="labs-widget-body">
      <div class="ai-insights-list">
        ${insights.map((insight, idx) => `
          <div class="ai-insight animate-slide-in" style="animation-delay: ${idx * 0.1}s">
            <div class="insight-header">
              <span class="insight-type ${insight.type}">${insight.type}</span>
              <span class="insight-confidence">
                <span class="confidence-bar" style="width: ${insight.confidence}%"></span>
                ${insight.confidence}%
              </span>
            </div>
            <p class="insight-text">${insight.text}</p>
          </div>
        `).join('')}
      </div>
      <button class="labs-btn-secondary full-width">View All Insights</button>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// EVENT TIMELINE WIDGET
// ========================================
export function renderTimelineWidget(container) {
  const meta = findLabsWidgetMeta('timeline');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget timeline-widget';
  wrapper.dataset.qa = 'labs-timeline';

  const events = [
    { time: '2m ago', icon: '📧', text: 'Email sent to ABC Corp', color: '#06b6d4' },
    { time: '15m ago', icon: '📞', text: 'Call logged with Partner Johnson', color: '#8b5cf6' },
    { time: '1h ago', icon: '✅', text: 'Deal moved to closing stage', color: '#10b981' },
    { time: '2h ago', icon: '📄', text: 'Document uploaded: Credit Report', color: '#f59e0b' },
    { time: '3h ago', icon: '👤', text: 'New contact added: Sarah Wilson', color: '#ec4899' }
  ];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '📊'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Timeline'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="timeline-stream">
        ${events.map((event, idx) => `
          <div class="timeline-event animate-slide-in" style="animation-delay: ${idx * 0.08}s">
            <div class="timeline-marker" style="background: ${event.color}">
              <span class="timeline-icon">${event.icon}</span>
            </div>
            <div class="timeline-content">
              <div class="timeline-text">${event.text}</div>
              <div class="timeline-time">${event.time}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// 3D PIPELINE FUNNEL WIDGET
// ========================================
export function renderFunnel3DWidget(container) {
  const meta = findLabsWidgetMeta('funnel3d');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget funnel3d-widget';
  wrapper.dataset.qa = 'labs-funnel3d';

  const stages = [
    { label: 'Leads', value: 245, color: '#06b6d4', width: 100 },
    { label: 'Qualified', value: 156, color: '#8b5cf6', width: 75 },
    { label: 'Proposal', value: 89, color: '#f59e0b', width: 55 },
    { label: 'Negotiation', value: 42, color: '#ec4899', width: 35 },
    { label: 'Closing', value: 18, color: '#10b981', width: 20 }
  ];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🎯'}</span>
      <h3 class="labs-widget-title">${meta?.label || '3D Funnel'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="funnel3d-container">
        ${stages.map((stage, idx) => `
          <div class="funnel-stage" style="--stage-width: ${stage.width}%; --stage-color: ${stage.color}; animation-delay: ${idx * 0.1}s">
            <div class="funnel-bar">
              <div class="funnel-label">${stage.label}</div>
              <div class="funnel-value">${stage.value}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="funnel-conversion">
        <span class="conversion-label">Overall Conversion:</span>
        <span class="conversion-value">${((stages[4].value / stages[0].value) * 100).toFixed(1)}%</span>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// ACTIVITY PULSE WIDGET
// ========================================
export function renderPulseWidget(container) {
  const meta = findLabsWidgetMeta('pulse');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget pulse-widget';
  wrapper.dataset.qa = 'labs-pulse';

  const bpm = randomInt(60, 120);
  const health = bpm < 90 ? 'healthy' : bpm < 110 ? 'active' : 'high';

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '💓'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Pulse'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="pulse-monitor">
        <svg viewBox="0 0 200 80" class="pulse-wave">
          <path d="M 0 40 L 40 40 L 50 20 L 60 60 L 70 40 L 200 40" fill="none" stroke="#10b981" stroke-width="2" class="pulse-line"/>
        </svg>
        <div class="pulse-bpm">${bpm}</div>
        <div class="pulse-label">Activities/Day</div>
        <div class="pulse-status ${health}">${health.toUpperCase()}</div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// DEAL GALAXY WIDGET
// ========================================
export function renderGalaxyWidget(container) {
  const meta = findLabsWidgetMeta('galaxy');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget galaxy-widget';
  wrapper.dataset.qa = 'labs-galaxy';

  const deals = Array.from({ length: 25 }, (_, i) => ({
    x: randomFloat(10, 90),
    y: randomFloat(10, 90),
    size: randomFloat(1, 6),
    color: ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'][randomInt(0, 4)],
    stage: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closing'][randomInt(0, 4)]
  }));

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🌌'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Deal Galaxy'}</h3>
      <button class="labs-widget-action" title="3D View">🔄</button>
    </div>
    <div class="labs-widget-body">
      <svg viewBox="0 0 100 100" class="galaxy-view">
        <defs>
          <radialGradient id="space-bg">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="100%" stop-color="#020617" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#space-bg)"/>
        ${deals.map((deal, idx) => `
          <circle cx="${deal.x}" cy="${deal.y}" r="${deal.size}" fill="${deal.color}" opacity="0.8" class="galaxy-deal" style="animation-delay: ${idx * 0.05}s">
            <title>${deal.stage}: $${(deal.size * 50000).toLocaleString()}</title>
          </circle>
        `).join('')}
      </svg>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// MARKET WEATHER WIDGET
// ========================================
export function renderWeatherWidget(container) {
  const meta = findLabsWidgetMeta('weather');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget weather-widget';
  wrapper.dataset.qa = 'labs-weather';

  const conditions = [
    { icon: '☀️', label: 'Clear', desc: 'Market conditions excellent', color: '#10b981' },
    { icon: '⛅', label: 'Partly Cloudy', desc: 'Some headwinds expected', color: '#f59e0b' },
    { icon: '🌧️', label: 'Rainy', desc: 'Challenging market', color: '#06b6d4' }
  ];
  const current = conditions[randomInt(0, 2)];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '⛅'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Market Weather'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="weather-display">
        <div class="weather-icon">${current.icon}</div>
        <div class="weather-info">
          <div class="weather-condition">${current.label}</div>
          <div class="weather-desc">${current.desc}</div>
        </div>
      </div>
      <div class="weather-metrics">
        <div class="weather-metric">
          <span class="metric-label">Rate Trend</span>
          <span class="metric-value trend-down">-0.25%</span>
        </div>
        <div class="weather-metric">
          <span class="metric-label">Competition</span>
          <span class="metric-value">Medium</span>
        </div>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// ACHIEVEMENTS WIDGET
// ========================================
export function renderAchievementsWidget(container) {
  const meta = findLabsWidgetMeta('achievements');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget achievements-widget';
  wrapper.dataset.qa = 'labs-achievements';

  const achievements = [
    { icon: '🏆', label: 'Deal Closer', progress: 100, unlocked: true },
    { icon: '🔥', label: '7-Day Streak', progress: 100, unlocked: true },
    { icon: '⭐', label: 'Rising Star', progress: 75, unlocked: false },
    { icon: '💎', label: '$1M Club', progress: 60, unlocked: false }
  ];

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🏆'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Achievements'}</h3>
      <span class="labs-widget-badge">Level 12</span>
    </div>
    <div class="labs-widget-body">
      <div class="achievements-grid">
        ${achievements.map((ach, idx) => `
          <div class="achievement ${ach.unlocked ? 'unlocked' : 'locked'}" style="animation-delay: ${idx * 0.1}s">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-label">${ach.label}</div>
            <div class="achievement-progress">
              <div class="progress-bar" style="width: ${ach.progress}%"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="achievement-xp">
        <span class="xp-label">XP:</span>
        <div class="xp-bar">
          <div class="xp-fill" style="width: 65%"></div>
        </div>
        <span class="xp-value">6,500 / 10,000</span>
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// ========================================
// MOMENTUM SCORE WIDGET
// ========================================
export function renderMomentumWidget(container) {
  const meta = findLabsWidgetMeta('momentum');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget momentum-widget';
  wrapper.dataset.qa = 'labs-momentum';

  const score = randomInt(65, 98);
  const trend = score > 80 ? '↗' : score > 60 ? '→' : '↘';

  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '🚀'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Momentum'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="momentum-score">
        <div class="momentum-value">${score}</div>
        <div class="momentum-trend">${trend}</div>
      </div>
      <div class="momentum-sparkline">
        ${Array.from({ length: 12 }, () => randomInt(40, 100)).map((v, i) => `
          <div class="spark-bar" style="height: ${v}%; animation-delay: ${i * 0.05}s"></div>
        `).join('')}
      </div>
    </div>
  `;

  container.appendChild(wrapper);
}

// Additional widgets (simplified for space)
export function renderRadarWidget(container) {
  const meta = findLabsWidgetMeta('radar');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget radar-widget';
  wrapper.dataset.qa = 'labs-radar';
  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '📡'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Radar'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="radar-scan">
        <div class="radar-sweep"></div>
        <div class="radar-blip" style="top: 30%; left: 45%"></div>
        <div class="radar-blip" style="top: 60%; left: 70%"></div>
        <div class="radar-blip" style="top: 75%; left: 25%"></div>
      </div>
      <p class="radar-status">Scanning for opportunities...</p>
    </div>
  `;
  container.appendChild(wrapper);
}

export function renderForecastWidget(container) {
  const meta = findLabsWidgetMeta('forecast');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget forecast-widget';
  wrapper.dataset.qa = 'labs-forecast';
  const data = generateSparkData(12);
  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '📈'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Forecast'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="forecast-chart">
        ${data.map((val, idx) => `
          <div class="forecast-bar" style="height: ${val}%; animation-delay: ${idx * 0.05}s">
            <div class="forecast-tooltip">$${(val * 10000).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
      <div class="forecast-summary">
        <div class="forecast-stat">
          <span class="stat-label">Projected</span>
          <span class="stat-value">$${randomInt(500, 999)}K</span>
        </div>
        <div class="forecast-stat">
          <span class="stat-label">Confidence</span>
          <span class="stat-value">${randomInt(75, 95)}%</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(wrapper);
}

export function renderSentimentWidget(container) {
  const meta = findLabsWidgetMeta('sentiment');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget sentiment-widget';
  wrapper.dataset.qa = 'labs-sentiment';
  const sentiments = ['😊', '😐', '😔'];
  const current = sentiments[randomInt(0, 2)];
  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '😊'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Sentiment'}</h3>
    </div>
    <div class="labs-widget-body">
      <div class="sentiment-display">${current}</div>
      <div class="sentiment-label">${current === '😊' ? 'Positive' : current === '😐' ? 'Neutral' : 'Needs Attention'}</div>
    </div>
  `;
  container.appendChild(wrapper);
}

export function renderAutomationWidget(container) {
  const meta = findLabsWidgetMeta('automation');
  const wrapper = document.createElement('div');
  wrapper.className = 'labs-widget automation-widget';
  wrapper.dataset.qa = 'labs-automation';
  wrapper.innerHTML = `
    <div class="labs-widget-header">
      <span class="labs-widget-icon">${meta?.icon || '⚙️'}</span>
      <h3 class="labs-widget-title">${meta?.label || 'Automation'}</h3>
      <span class="labs-widget-badge live">ACTIVE</span>
    </div>
    <div class="labs-widget-body">
      <div class="automation-list">
        <div class="automation-item">
          <span class="automation-icon">✉️</span>
          <span class="automation-name">Follow-up emails</span>
          <span class="automation-status active">ON</span>
        </div>
        <div class="automation-item">
          <span class="automation-icon">🔔</span>
          <span class="automation-name">Deal alerts</span>
          <span class="automation-status active">ON</span>
        </div>
        <div class="automation-item">
          <span class="automation-icon">📊</span>
          <span class="automation-name">Weekly reports</span>
          <span class="automation-status inactive">OFF</span>
        </div>
      </div>
    </div>
  `;
  container.appendChild(wrapper);
}

// Widget registry
export const WIDGET_RENDERERS = {
  velocity: renderVelocityWidget,
  network: renderNetworkWidget,
  heatmap: renderHeatmapWidget,
  aiInsights: renderAIInsightsWidget,
  timeline: renderTimelineWidget,
  funnel3d: renderFunnel3DWidget,
  pulse: renderPulseWidget,
  galaxy: renderGalaxyWidget,
  weather: renderWeatherWidget,
  achievements: renderAchievementsWidget,
  momentum: renderMomentumWidget,
  radar: renderRadarWidget,
  forecast: renderForecastWidget,
  sentiment: renderSentimentWidget,
  automation: renderAutomationWidget
};
