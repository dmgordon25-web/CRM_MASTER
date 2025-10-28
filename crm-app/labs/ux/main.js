const dayjs = window.dayjs;
const { Calendar } = window.FullCalendar;
const dayGridPlugin =
  (window.FullCalendar.DayGrid && (window.FullCalendar.DayGrid.default || window.FullCalendar.DayGrid)) || null;
const interactionPlugin =
  (window.FullCalendar.Interaction &&
    (window.FullCalendar.Interaction.default || window.FullCalendar.Interaction)) ||
  null;
const GridStack = window.GridStack;
console.debug('[UX LAB] vendors loaded', {
  calendar: Boolean(Calendar),
  dayGrid: Boolean(dayGridPlugin),
  interaction: Boolean(interactionPlugin),
  gridstack: Boolean(GridStack),
  dayjs: typeof dayjs === 'function'
});

const THEMES = {
  sunrise: {
    name: 'Sunrise',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    background: '#f8fafc',
    text: '#0f172a',
    muted: '#475569',
    navBg: 'linear-gradient(180deg, #312e81 0%, #1e3a8a 100%)',
    navText: 'rgba(255,255,255,0.92)',
    accent: '#f97316',
    border: 'rgba(148, 163, 184, 0.35)',
    shadow: '0 18px 45px rgba(15, 23, 42, 0.12)',
    chip: 'rgba(255,255,255,0.6)',
    chipActive: 'rgba(249, 115, 22, 0.18)',
    spacing: '14px',
    scrollTrack: 'rgba(255,255,255,0.4)'
  },
  aurora: {
    name: 'Aurora',
    surface: '#0f172a',
    surfaceAlt: '#111c37',
    background: '#040920',
    text: '#e2e8f0',
    muted: '#94a3b8',
    navBg: 'linear-gradient(180deg, #0f172a 0%, #312e81 100%)',
    navText: 'rgba(226,232,240,0.92)',
    accent: '#38bdf8',
    border: 'rgba(51, 65, 85, 0.65)',
    shadow: '0 18px 45px rgba(7, 11, 26, 0.6)',
    chip: 'rgba(15, 118, 110, 0.35)',
    chipActive: 'rgba(56, 189, 248, 0.3)',
    spacing: '16px',
    scrollTrack: 'rgba(148,163,184,0.25)'
  },
  tide: {
    name: 'Tidepool',
    surface: '#ffffff',
    surfaceAlt: '#e8faf8',
    background: '#d9f9f4',
    text: '#042f2e',
    muted: '#0f766e',
    navBg: 'linear-gradient(180deg, #0d9488 0%, #0f766e 100%)',
    navText: 'rgba(255,255,255,0.94)',
    accent: '#0ea5e9',
    border: 'rgba(45, 212, 191, 0.45)',
    shadow: '0 22px 45px rgba(13, 148, 136, 0.16)',
    chip: 'rgba(13,148,136,0.12)',
    chipActive: 'rgba(14,165,233,0.18)',
    spacing: '18px',
    scrollTrack: 'rgba(20,184,166,0.25)'
  }
};

const navLinks = [
  { id: 'overview', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'insights', label: 'Insights' }
];

const focusModes = {
  today: {
    label: 'Today',
    summary: 'Concentrate on the six partners that can move deals forward before close of business.',
    metrics: [
      { label: 'Priority partners', value: '6', helper: '2 require approvals', tone: 'neutral' },
      { label: 'Next-touch kits', value: '4', helper: 'Ready to send after review', tone: 'positive' },
      { label: 'Shared campaigns', value: '3', helper: 'Launch assets queued', tone: 'accent' }
    ],
    trend: [48, 50, 55, 59, 64, 70, 75, 81, 88],
    score: 82,
    scoreLabel: 'Healthy momentum',
    capacity: 64,
    capacityLabel: 'Team capacity in use',
    timeline: [
      {
        title: 'Coffee with Ava Martinez',
        time: '09:30',
        detail: 'Deliver co-branded handouts + rate scenarios.',
        status: 'confirmed'
      },
      {
        title: 'Builder walkthrough — Ridge Homes',
        time: '11:00',
        detail: 'Finalize signage proofs before onsite review.',
        status: 'attention'
      },
      {
        title: 'Campaign sync — Coastline Advisors',
        time: '13:00',
        detail: 'Align nurture cadence with email drop.',
        status: 'in-progress'
      },
      {
        title: 'Referral follow-ups',
        time: '15:00',
        detail: 'Send amortization breakdowns for 2 buyers.',
        status: 'queued'
      }
    ]
  },
  week: {
    label: 'This week',
    summary: 'Shape the partner slate for the next sprint while keeping onboarding velocity high.',
    metrics: [
      { label: 'Active deals', value: '18', helper: '+3 vs. target', tone: 'positive' },
      { label: 'Onboarding kits', value: '5', helper: '2 waiting on legal review', tone: 'neutral' },
      { label: 'New referrals', value: '11', helper: 'Top of funnel outlook', tone: 'accent' }
    ],
    trend: [42, 44, 47, 53, 60, 65, 67, 70, 74],
    score: 76,
    scoreLabel: 'Momentum building',
    capacity: 58,
    capacityLabel: 'Capacity planned',
    timeline: [
      {
        title: 'Host builder roundtable',
        time: 'Tue',
        detail: 'Share instant approvals roadmap + service updates.',
        status: 'confirmed'
      },
      {
        title: 'Launch nurture drip v3',
        time: 'Wed',
        detail: 'Target advisors that opened last campaign.',
        status: 'queued'
      },
      {
        title: 'Partner health review',
        time: 'Thu',
        detail: 'Scorecard for top 20 partners.',
        status: 'in-progress'
      },
      {
        title: 'Co-marketing asset drop',
        time: 'Fri',
        detail: 'Deliver landing page templates to Ridge Homes.',
        status: 'attention'
      }
    ]
  },
  quarter: {
    label: 'Quarter',
    summary: 'Plan strategic pushes for partner health, pipeline velocity, and campaign resonance.',
    metrics: [
      { label: 'Net-new partners', value: '24', helper: '+6 over last quarter', tone: 'positive' },
      { label: 'Cycle time', value: '12.4 d', helper: '-1.8 d vs. last quarter', tone: 'positive' },
      { label: 'NPS', value: '64', helper: '+5 uplift', tone: 'accent' }
    ],
    trend: [38, 39, 42, 46, 52, 60, 65, 72, 80],
    score: 84,
    scoreLabel: 'Quarter pacing on track',
    capacity: 71,
    capacityLabel: 'Growth levers funded',
    timeline: [
      {
        title: 'Launch co-branded learning hub',
        time: 'Week 2',
        detail: 'Curated playlists + rate explainer modules.',
        status: 'in-progress'
      },
      {
        title: 'Mortgage summit keynote',
        time: 'Week 5',
        detail: 'Feature partner success metrics + pipeline story.',
        status: 'confirmed'
      },
      {
        title: 'API onboarding window',
        time: 'Week 7',
        detail: 'Lakeview CU + 2 credit unions testing integrations.',
        status: 'attention'
      },
      {
        title: 'Quarterly playbook refresh',
        time: 'Week 11',
        detail: 'Roll updated nurture + referral templates.',
        status: 'queued'
      }
    ]
  }
};

const overviewSignals = [
  {
    id: 'velocity',
    title: 'Cycle velocity',
    metric: '4.6 days',
    delta: '+0.8 faster',
    tone: 'positive',
    description: 'Time from new lead to locked rate averaged across the last 20 files.'
  },
  {
    id: 'campaign',
    title: 'Campaign resonance',
    metric: '63% open',
    delta: '+12% vs. control',
    tone: 'accent',
    description: 'Open + click rates for the “Ready-to-Move” nurture journey this week.'
  },
  {
    id: 'service',
    title: 'Service follow-through',
    metric: '92% on time',
    delta: '4 follow-ups aging',
    tone: 'attention',
    description: 'Milestones completed within 24h for partner escalations and VIP queue.'
  }
];

const calendarEvents = [
  {
    title: 'Coffee with Ava',
    start: dayjs().hour(9).minute(30).format('YYYY-MM-DDTHH:mm:00'),
    display: 'background',
    backgroundColor: 'rgba(56, 189, 248, 0.28)'
  },
  {
    title: 'Builder walkthrough',
    start: dayjs().add(1, 'day').hour(11).format('YYYY-MM-DDTHH:mm:00'),
    end: dayjs().add(1, 'day').hour(12).format('YYYY-MM-DDTHH:mm:00'),
    color: '#2563eb'
  },
  {
    title: 'Partner lunch — Ridge Homes',
    start: dayjs().add(3, 'day').hour(12).format('YYYY-MM-DDTHH:mm:00'),
    color: '#f97316'
  },
  {
    title: 'Homebuyer workshop',
    start: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    end: dayjs().add(6, 'day').format('YYYY-MM-DD'),
    color: '#0f766e'
  },
  {
    title: 'Referral follow-ups',
    start: dayjs().subtract(2, 'day').format('YYYY-MM-DD'),
    color: '#e11d48'
  }
];

const dashboardCards = [
  {
    w: 4,
    h: 2,
    x: 0,
    y: 0,
    content: `
      <article class="dashboard-card">
        <header>
          <h3>Pipeline momentum</h3>
          <span class="pill">8 active deals</span>
        </header>
        <dl class="metrics">
          <div>
            <dt>In underwriting</dt>
            <dd>4</dd>
          </div>
          <div>
            <dt>Clear to close</dt>
            <dd>2</dd>
          </div>
          <div>
            <dt>Avg. days in stage</dt>
            <dd>6.2</dd>
          </div>
        </dl>
      </article>
    `
  },
  {
    w: 4,
    h: 2,
    x: 4,
    y: 0,
    content: `
      <article class="dashboard-card">
        <header>
          <h3>Partner engagement</h3>
          <span class="pill positive">+18%</span>
        </header>
        <div class="sparkline" role="img" aria-label="Engagement trend">
          <svg viewBox="0 0 160 60" preserveAspectRatio="none">
            <polyline points="0,40 20,35 40,32 60,28 80,26 100,22 120,18 140,14 160,10" />
            <polyline class="shadow" points="0,42 20,40 40,39 60,34 80,33 100,30 120,27 140,22 160,20" />
          </svg>
        </div>
        <p class="muted">Touch-points with top 20 partners over the last 30 days.</p>
      </article>
    `
  },
  {
    w: 4,
    h: 1,
    x: 8,
    y: 0,
    content: `
      <article class="dashboard-card quick">
        <header>
          <h3>Quick actions</h3>
        </header>
        <ul class="quick-actions">
          <li><button type="button">Add partner note</button></li>
          <li><button type="button">Schedule review</button></li>
          <li><button type="button">Share dashboard</button></li>
        </ul>
      </article>
    `
  },
  {
    w: 6,
    h: 2,
    x: 0,
    y: 2,
    content: `
      <article class="dashboard-card">
        <header>
          <h3>Milestones</h3>
          <span class="pill neutral">This week</span>
        </header>
        <ul class="milestones">
          <li>
            <strong>Close Ridgewood Estates phase II</strong>
            <span>Loan package review scheduled • Thu 2:00p</span>
          </li>
          <li>
            <strong>Refinance follow-up</strong>
            <span>Send updated amortization breakdown • Fri 9:00a</span>
          </li>
          <li>
            <strong>Partner onboarding</strong>
            <span>Co-branded marketing toolkit • Due Mon</span>
          </li>
        </ul>
      </article>
    `
  },
  {
    w: 6,
    h: 2,
    x: 6,
    y: 2,
    content: `
      <article class="dashboard-card">
        <header>
          <h3>Capacity planning</h3>
          <span class="pill">3 slack days</span>
        </header>
        <div class="capacity-grid">
          <div>
            <span>New apps</span>
            <strong>6</strong>
          </div>
          <div>
            <span>Processing</span>
            <strong>5</strong>
          </div>
          <div>
            <span>Underwriting</span>
            <strong>4</strong>
          </div>
          <div>
            <span>Closing</span>
            <strong>3</strong>
          </div>
        </div>
      </article>
    `
  }
];

const contacts = [
  {
    id: 'ava-martinez',
    name: 'Ava Martinez',
    role: 'Realtor — Sunset Realty',
    segment: 'VIP',
    status: 'Hot lead',
    lastInteraction: 'Met for coffee (Today)',
    tags: ['Top referrer', 'Monthly newsletter'],
    notes:
      'Ava is co-hosting a homebuyer workshop. Needs co-branded handouts and new rate scenarios for two buyers.'
  },
  {
    id: 'clay-parker',
    name: 'Clay Parker',
    role: 'Builder — Ridge Homes',
    segment: 'Builder',
    status: 'In contract',
    lastInteraction: 'Onsite walkthrough (Tomorrow)',
    tags: ['Co-marketing', 'Digital toolkit'],
    notes:
      'Confirm signage proofs before Thursday. Interested in pilot for instant approvals dashboard.'
  },
  {
    id: 'jamila-harris',
    name: 'Jamila Harris',
    role: 'Financial Planner — Pivotal Finance',
    segment: 'Advisor',
    status: 'Nurture',
    lastInteraction: 'Shared rate update (2d ago)',
    tags: ['Quarterly briefing'],
    notes:
      'Prefers concise check-ins. Exploring home-equity webinar collaboration next quarter.'
  },
  {
    id: 'noah-lin',
    name: 'Noah Lin',
    role: 'Credit Union — Lakeview CU',
    segment: 'Lender partner',
    status: 'Exploring',
    lastInteraction: 'Demo request (Yesterday)',
    tags: ['Co-branded ads', 'Automation'],
    notes:
      'Needs onboarding timeline for API access. Considering dedicated marketing assets for branches.'
  }
];

const segments = ['All', 'VIP', 'Builder', 'Advisor', 'Lender partner'];

const insightModes = {
  '30d': {
    label: 'Last 30 days',
    summary: 'Spot emerging signals that influence the near-term pipeline.',
    scorecards: [
      { label: 'Conversion rate', value: '28%', helper: '+3 pts vs. prior 30d', tone: 'positive' },
      { label: 'Avg. cycle', value: '11.2 d', helper: 'Stable week over week', tone: 'neutral' },
      { label: 'Partner NPS', value: '62', helper: '+4 vs. baseline', tone: 'accent' }
    ],
    heatmap: {
      columns: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      rows: [
        { label: 'VIP', values: [8, 9, 10, 8, 7] },
        { label: 'Builder', values: [6, 7, 7, 5, 4] },
        { label: 'Advisor', values: [5, 6, 6, 6, 5] },
        { label: 'Lender', values: [3, 4, 5, 4, 4] }
      ]
    },
    actions: [
      {
        title: 'Deploy follow-up kit to Ridge Homes',
        detail: 'They unlocked the highest click-through rate—double down with co-marketing assets.'
      },
      {
        title: 'Schedule micro-webinar for advisors',
        detail: 'Advisors engage mid-week; offer a 20-minute rate update session.'
      },
      {
        title: 'Elevate lender integration updates',
        detail: 'Lenders respond best early week—push API onboarding checklist on Mondays.'
      }
    ]
  },
  quarter: {
    label: 'Quarter to date',
    summary: 'Blend strategic health indicators with partner relationship trends.',
    scorecards: [
      { label: 'Conversion rate', value: '31%', helper: '+5 pts vs. same quarter last year', tone: 'positive' },
      { label: 'Avg. cycle', value: '12.4 d', helper: '-1.8 d vs. LY', tone: 'positive' },
      { label: 'Partner NPS', value: '64', helper: '+5 vs. quarter start', tone: 'accent' }
    ],
    heatmap: {
      columns: ['Jan', 'Feb', 'Mar'],
      rows: [
        { label: 'VIP', values: [24, 28, 32] },
        { label: 'Builder', values: [18, 21, 26] },
        { label: 'Advisor', values: [16, 18, 21] },
        { label: 'Lender', values: [9, 12, 14] }
      ]
    },
    actions: [
      {
        title: 'Rebalance advisor touch cadence',
        detail: 'Concentrate on March uplift by pairing insights with templated outreach.'
      },
      {
        title: 'Launch partner storytelling kit',
        detail: 'Capture VIP success stories while NPS remains elevated to anchor Q4 pipeline.'
      },
      {
        title: 'Expand builder analytics pilot',
        detail: 'Invite two more builders into the instant approvals dashboard beta.'
      }
    ]
  }
};

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.sunrise;
  document.body.dataset.labTheme = themeKey;
  Object.entries(theme).forEach(([token, value]) => {
    if (token === 'name') return;
    document.body.style.setProperty(`--lab-${token}`, value);
  });
}

function renderChrome(root) {
  const navItems = navLinks
    .map((link, index) => {
      const selected = index === 0 ? ' aria-current="page"' : '';
      return `<button type="button" class="nav-link" data-link="${link.id}"${selected}>${link.label}</button>`;
    })
    .join('');

  root.innerHTML = `
    <div class="lab-app">
      <aside class="lab-nav">
        <div class="nav-header">
          <span class="nav-kicker">UX Lab</span>
          <strong>CRM Experiment</strong>
          <p class="nav-sub">Isolated playground for future interaction ideas.</p>
        </div>
        <nav class="nav-links" aria-label="Lab navigation">
          ${navItems}
        </nav>
        <footer class="nav-footer">
          <p>Build ${dayjs().format('MMM DD, YYYY')}</p>
          <span class="nav-pill">Experimental</span>
          <a class="nav-back" href="../index.html#settings">← Back to CRM settings</a>
        </footer>
      </aside>
      <div class="lab-main">
        <header class="lab-header">
          <div>
            <h1>Experience Lab</h1>
            <p class="muted">Exploring responsive layouts, motion, and partner-centric workflows.</p>
          </div>
          <div class="header-controls">
            <label class="theme-switcher">
              <span>Theme</span>
              <select id="theme-picker" class="theme-select" aria-label="Theme picker"></select>
            </label>
            <div class="pulse-pill" role="status">Live prototype</div>
          </div>
        </header>
        <main class="lab-surfaces">
          <section class="panel" id="overview-panel" data-surface="overview">
            <header class="panel-head">
              <h2>Mission control</h2>
              <p class="muted">Focus partner energy, share quick wins, and choreograph the next wave of outreach.</p>
            </header>
            <div class="panel-body overview-body">
              <div class="overview-hero">
                <div class="hero-summary">
                  <div class="hero-head">
                    <h3>Relationship focus</h3>
                    <p class="muted" id="focus-summary"></p>
                  </div>
                  <div class="mode-switch" id="focus-mode-switch" role="tablist" aria-label="Focus horizon"></div>
                  <dl class="hero-metrics" id="focus-metrics"></dl>
                </div>
                <div class="hero-visual">
                  <div class="trend-shell">
                    <svg id="focus-trend" viewBox="0 0 320 140" role="img" aria-label="Engagement trend sparkline">
                      <defs>
                        <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stop-color="var(--lab-accent, #6366f1)" stop-opacity="0.6"></stop>
                          <stop offset="100%" stop-color="var(--lab-accent, #6366f1)" stop-opacity="0"></stop>
                        </linearGradient>
                      </defs>
                      <path id="trend-area" fill="url(#trend-fill)" d="" />
                      <polyline id="trend-line" fill="none" stroke="var(--lab-accent, #6366f1)" stroke-width="4" stroke-linecap="round" points="" />
                    </svg>
                  </div>
                  <div class="hero-stats">
                    <div class="stat-block">
                      <span class="muted label">Relationship health</span>
                      <strong id="focus-score" class="stat-value"></strong>
                      <span class="muted" id="focus-score-label"></span>
                    </div>
                    <div class="stat-block dial-block">
                      <div class="progress-dial" id="focus-dial" role="img" aria-label="Capacity usage gauge">
                        <span class="dial-value" id="focus-dial-value"></span>
                      </div>
                      <span class="muted" id="focus-dial-label"></span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="overview-lanes">
                <div>
                  <h4>Timeline</h4>
                  <ol class="timeline" id="focus-timeline"></ol>
                </div>
                <div>
                  <h4>Signal monitor</h4>
                  <ul class="signal-cards" id="signal-cards"></ul>
                </div>
              </div>
            </div>
          </section>
          <section class="panel" id="calendar-panel" data-surface="calendar">
            <header class="panel-head">
              <h2>Partner calendar</h2>
              <p class="muted">Unified view of meetings, workshops, and campaigns.</p>
            </header>
            <div class="panel-body calendar-body">
              <div id="lab-calendar" class="calendar-shell" aria-live="polite"></div>
            </div>
          </section>
          <section class="panel" id="dashboard-panel" data-surface="dashboard">
            <header class="panel-head">
              <h2>Adaptive dashboard</h2>
              <p class="muted">Drag tiles to prototype personalized workspaces.</p>
            </header>
            <div class="panel-body">
              <div class="grid-stack" id="dashboard-grid"></div>
            </div>
          </section>
          <section class="panel" id="contacts-panel" data-surface="contacts">
            <header class="panel-head">
              <h2>Partners</h2>
              <p class="muted">Filter by relationship segment to focus the outreach plan.</p>
            </header>
            <div class="panel-body">
              <div class="chip-row" id="contact-filters" role="group" aria-label="Filter partners by segment"></div>
              <div class="contact-list" id="contact-list"></div>
            </div>
          </section>
          <section class="panel" id="insights-panel" data-surface="insights">
            <header class="panel-head">
              <h2>Insights lab</h2>
              <p class="muted">Story-driven analytics for experimenting with reporting concepts.</p>
            </header>
            <div class="panel-body insights-body">
              <div class="insight-header">
                <div class="mode-switch" id="insight-mode-switch" role="tablist" aria-label="Insights timeframe"></div>
                <p class="muted" id="insight-summary"></p>
              </div>
              <div class="insight-grid">
                <article class="insight-card stretch">
                  <h3>Relationship health</h3>
                  <div class="insight-scorecards" id="insight-scorecards"></div>
                </article>
                <article class="insight-card heatmap-card">
                  <h3>Engagement heatmap</h3>
                  <div id="insight-heatmap" class="heatmap" role="img" aria-label="Partner engagement heatmap"></div>
                </article>
                <article class="insight-card actions-card">
                  <h3>Strategic actions</h3>
                  <ol id="insight-actions" class="insight-actions"></ol>
                </article>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
    <div class="lab-drawer" id="contact-drawer" aria-hidden="true">
      <div class="drawer-surface" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header class="drawer-head">
          <div>
            <h3 id="drawer-title"></h3>
            <p class="drawer-sub muted"></p>
          </div>
          <button id="drawer-close" class="btn-close" type="button" aria-label="Close details">×</button>
        </header>
        <div class="drawer-body" id="drawer-body"></div>
      </div>
    </div>
  `;
}

function buildTrend(points, width = 320, height = 120) {
  if (!Array.isArray(points) || points.length < 2) {
    return { area: '', line: '' };
  }
  const step = width / (points.length - 1);
  const coords = points.map((value, index) => {
    const clamped = Math.max(0, Math.min(100, Number(value) || 0));
    const x = index * step;
    const y = height - (clamped / 100) * height;
    return [Number(x.toFixed(2)), Number(y.toFixed(2))];
  });
  const areaPoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = `M0,${height} L${areaPoints} L${width},${height} Z`;
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(' ');
  return { area: areaPath, line: linePoints };
}

function setupNavigation(root, options = {}) {
  const { onSurfaceActivated } = options;
  const nav = root.querySelector('.nav-links');
  const surfaces = Array.from(root.querySelectorAll('.panel[data-surface]'));
  const surfaceMap = new Map(surfaces.map((surface) => [surface.dataset.surface, surface]));

  function setActiveSurface(id) {
    surfaceMap.forEach((panel, key) => {
      if (key === id) {
        panel.removeAttribute('hidden');
      } else {
        panel.setAttribute('hidden', '');
      }
    });

    nav.querySelectorAll('button[data-link]').forEach((node) => {
      if (node.dataset.link === id) {
        node.setAttribute('aria-current', 'page');
      } else {
        node.removeAttribute('aria-current');
      }
    });

    if (typeof onSurfaceActivated === 'function') {
      onSurfaceActivated(id);
    }
  }

  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-link]');
    if (!button) return;
    setActiveSurface(button.dataset.link);
  });

  setActiveSurface('overview');
}

function renderModeSwitch(host, modes, active) {
  const buttons = Object.entries(modes)
    .map(([key, config]) => {
      const selected = key === active ? " aria-pressed='true'" : " aria-pressed='false'";
      return `<button type="button" class="chip" data-mode="${key}"${selected}>${config.label}</button>`;
    })
    .join('');
  host.innerHTML = buttons;
}

function setupOverview() {
  const summary = document.querySelector('#focus-summary');
  const switchHost = document.querySelector('#focus-mode-switch');
  const metricsHost = document.querySelector('#focus-metrics');
  const trendArea = document.querySelector('#trend-area');
  const trendLine = document.querySelector('#trend-line');
  const scoreValue = document.querySelector('#focus-score');
  const scoreLabel = document.querySelector('#focus-score-label');
  const dial = document.querySelector('#focus-dial');
  const dialValue = document.querySelector('#focus-dial-value');
  const dialLabel = document.querySelector('#focus-dial-label');
  const timelineHost = document.querySelector('#focus-timeline');
  const signalsHost = document.querySelector('#signal-cards');

  let activeMode = 'today';

  function renderMetrics(metrics) {
    metricsHost.innerHTML = metrics
      .map((metric) => {
        const toneClass = metric.tone ? ` metric-${metric.tone}` : '';
        return `
          <div class="metric${toneClass}">
            <dt>${metric.label}</dt>
            <dd>${metric.value}</dd>
            <span class="muted">${metric.helper}</span>
          </div>
        `;
      })
      .join('');
  }

  function renderTimeline(items) {
    timelineHost.innerHTML = items
      .map((item) => {
        const statusClass = item.status ? ` timeline-${item.status}` : '';
        return `
          <li class="timeline-item${statusClass}">
            <div class="timeline-time">${item.time}</div>
            <div class="timeline-detail">
              <strong>${item.title}</strong>
              <p class="muted">${item.detail}</p>
            </div>
          </li>
        `;
      })
      .join('');
  }

  function renderSignals() {
    signalsHost.innerHTML = overviewSignals
      .map((signal) => {
        const toneClass = signal.tone ? ` signal-${signal.tone}` : '';
        return `
          <li class="signal-card${toneClass}">
            <header>
              <h5>${signal.title}</h5>
              <span class="signal-metric">${signal.metric}</span>
            </header>
            <p class="muted">${signal.description}</p>
            <span class="signal-delta">${signal.delta}</span>
          </li>
        `;
      })
      .join('');
  }

  function applyMode(modeKey) {
    const mode = focusModes[modeKey] || focusModes.today;
    activeMode = modeKey;
    summary.textContent = mode.summary;
    renderMetrics(mode.metrics);
    const { area, line } = buildTrend(mode.trend);
    trendArea.setAttribute('d', area);
    trendLine.setAttribute('points', line);
    scoreValue.textContent = `${mode.score}`;
    scoreLabel.textContent = mode.scoreLabel;
    dial.style.setProperty('--dial-fill', `${Math.round(mode.capacity * 3.6)}deg`);
    dialValue.textContent = `${mode.capacity}%`;
    dialLabel.textContent = mode.capacityLabel;
    renderTimeline(mode.timeline);
    renderModeSwitch(switchHost, focusModes, activeMode);
  }

  switchHost.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    applyMode(button.dataset.mode);
  });

  renderSignals();
  applyMode(activeMode);
}

function setupThemeSwitcher(root) {
  const select = root.querySelector('#theme-picker');
  const options = Object.entries(THEMES)
    .map(([key, theme]) => `<option value="${key}">${theme.name}</option>`)
    .join('');
  select.innerHTML = options;
  select.value = document.body.dataset.labTheme;
  select.addEventListener('change', (event) => {
    const themeKey = event.target.value;
    applyTheme(themeKey);
  });
}

function setupCalendar() {
  const calendarElement = document.querySelector('#lab-calendar');
  const calendar = new Calendar(calendarElement, {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    height: 'auto',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: ''
    },
    events: calendarEvents,
    displayEventEnd: true,
    nowIndicator: true,
    aspectRatio: 1.5
  });
  calendar.render();
}

function setupDashboard() {
  const grid = GridStack.init(
    {
      float: true,
      margin: 12,
      cellHeight: 140,
      disableOneColumnMode: true,
      resizable: {
        handles: 'e, se, s'
      }
    },
    '#dashboard-grid'
  );

  grid.load(
    dashboardCards.map((card) => ({
      ...card,
      noResize: false,
      noMove: false
    }))
  );
}

function setupContacts() {
  const filterHost = document.querySelector('#contact-filters');
  const listHost = document.querySelector('#contact-list');
  const drawer = document.querySelector('#contact-drawer');
  const drawerTitle = drawer.querySelector('#drawer-title');
  const drawerSub = drawer.querySelector('.drawer-sub');
  const drawerBody = drawer.querySelector('#drawer-body');
  const drawerClose = drawer.querySelector('#drawer-close');

  let activeFilter = 'All';

  function renderFilters() {
    filterHost.innerHTML = segments
      .map((segment) => {
        const selected = segment === activeFilter ? ' aria-pressed="true"' : '';
        return `<button type="button" class="chip" data-filter="${segment}"${selected}>${segment}</button>`;
      })
      .join('');
  }

  function renderList() {
    const rows = contacts
      .filter((contact) => activeFilter === 'All' || contact.segment === activeFilter)
      .map(
        (contact) => `
          <article class="contact-card" data-contact="${contact.id}">
            <div>
              <h3>${contact.name}</h3>
              <p class="muted">${contact.role}</p>
            </div>
            <div class="meta">
              <span class="status">${contact.status}</span>
              <span class="muted">${contact.lastInteraction}</span>
            </div>
            <div class="tags">
              ${contact.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
            </div>
            <button type="button" class="details">Open brief</button>
          </article>
        `
      )
      .join('');

    listHost.innerHTML = rows;
  }

  function openDrawer(contactId) {
    const contact = contacts.find((entry) => entry.id === contactId);
    if (!contact) return;
    drawerTitle.textContent = contact.name;
    drawerSub.textContent = `${contact.role} • ${contact.segment}`;
    drawerBody.innerHTML = `
      <section>
        <h4>Next steps</h4>
        <p>${contact.notes}</p>
      </section>
      <section class="drawer-meta">
        <div>
          <span class="muted">Status</span>
          <strong>${contact.status}</strong>
        </div>
        <div>
          <span class="muted">Last interaction</span>
          <strong>${contact.lastInteraction}</strong>
        </div>
      </section>
    `;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
  }

  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  filterHost.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    renderFilters();
    renderList();
  });

  listHost.addEventListener('click', (event) => {
    const card = event.target.closest('.contact-card');
    if (!card) return;
    openDrawer(card.dataset.contact);
  });

  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) {
      closeDrawer();
    }
  });

  drawerClose.addEventListener('click', () => {
    closeDrawer();
  });

  renderFilters();
  renderList();
}

function setupInsights() {
  const switchHost = document.querySelector('#insight-mode-switch');
  const summary = document.querySelector('#insight-summary');
  const scorecardHost = document.querySelector('#insight-scorecards');
  const heatmapHost = document.querySelector('#insight-heatmap');
  const actionsHost = document.querySelector('#insight-actions');

  let activeMode = '30d';

  function renderScorecards(cards) {
    scorecardHost.innerHTML = cards
      .map((card) => {
        const toneClass = card.tone ? ` insight-${card.tone}` : '';
        return `
          <div class="insight-score${toneClass}">
            <span class="muted">${card.label}</span>
            <strong>${card.value}</strong>
            <span class="insight-helper">${card.helper}</span>
          </div>
        `;
      })
      .join('');
  }

  function renderHeatmap(heatmap) {
    const maxValue = Math.max(
      ...heatmap.rows.flatMap((row) => row.values.map((value) => Number(value) || 0))
    );
    const tableRows = heatmap.rows
      .map((row) => {
        const cells = row.values
          .map((value) => {
            const numeric = Number(value) || 0;
            const intensity = maxValue === 0 ? 0 : numeric / maxValue;
            const percent = Math.round(intensity * 100);
            return `
              <td class="heat-cell" style="--heat-intensity:${percent};">
                <span>${numeric}</span>
              </td>
            `;
          })
          .join('');
        return `
          <tr>
            <th scope="row">${row.label}</th>
            ${cells}
          </tr>
        `;
      })
      .join('');

    const headerCells = heatmap.columns.map((column) => `<th scope="col">${column}</th>`).join('');

    heatmapHost.innerHTML = `
      <table class="heatmap-table">
        <thead>
          <tr>
            <th scope="col">Segment</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;
  }

  function renderActions(actions) {
    actionsHost.innerHTML = actions
      .map(
        (action) => `
          <li>
            <strong>${action.title}</strong>
            <p class="muted">${action.detail}</p>
          </li>
        `
      )
      .join('');
  }

  function applyMode(modeKey) {
    const mode = insightModes[modeKey] || insightModes['30d'];
    activeMode = modeKey;
    summary.textContent = mode.summary;
    renderScorecards(mode.scorecards);
    renderHeatmap(mode.heatmap);
    renderActions(mode.actions);
    renderModeSwitch(switchHost, insightModes, activeMode);
  }

  switchHost.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    applyMode(button.dataset.mode);
  });

  applyMode(activeMode);
}

function init() {
  const root = document.getElementById('lab-root');
  applyTheme(document.body.dataset.labTheme || 'sunrise');
  renderChrome(root);
  const deferredSurfaces = new Map([
    ['calendar', setupCalendar],
    ['dashboard', setupDashboard]
  ]);

  function initializeSurface(surfaceId) {
    const initializer = deferredSurfaces.get(surfaceId);
    if (!initializer) return;
    initializer();
    deferredSurfaces.delete(surfaceId);
  }

  try {
    setupNavigation(root, {
      onSurfaceActivated: initializeSurface
    });
    setupThemeSwitcher(root);
    setupOverview();
    setupContacts();
    setupInsights();
  } catch (error) {
    console.error('[UX LAB] boot error', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', init);
