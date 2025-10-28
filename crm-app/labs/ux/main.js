const dayjs = window.dayjs;
const { Calendar } = window.FullCalendar;
const dayGridPlugin =
  (window.FullCalendar.DayGrid && (window.FullCalendar.DayGrid.default || window.FullCalendar.DayGrid)) ||
  null;
const interactionPlugin =
  (window.FullCalendar.Interaction &&
    (window.FullCalendar.Interaction.default || window.FullCalendar.Interaction)) ||
  null;
const GridStack = window.GridStack;
const labEvents = typeof EventTarget === 'function' ? new EventTarget() : document.createElement('div');

console.debug('[UX LAB] vendors loaded', {
  calendar: Boolean(Calendar),
  dayGrid: Boolean(dayGridPlugin),
  interaction: Boolean(interactionPlugin),
  gridstack: Boolean(GridStack),
  dayjs: typeof dayjs === 'function'
});

function cloneDeep(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

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
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'contacts', label: 'Partners' },
  { id: 'insights', label: 'Insights' },
  { id: 'settings', label: 'Settings' }
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
        id: 'ava-coffee',
        title: 'Coffee with Ava Martinez',
        time: '09:30',
        detail: 'Deliver co-branded handouts + rate scenarios.',
        status: 'confirmed'
      },
      {
        id: 'ridge-walkthrough',
        title: 'Builder walkthrough — Ridge Homes',
        time: '11:00',
        detail: 'Finalize signage proofs before onsite review.',
        status: 'attention'
      },
      {
        id: 'coastline-sync',
        title: 'Campaign sync — Coastline Advisors',
        time: '13:00',
        detail: 'Align nurture cadence with email drop.',
        status: 'in-progress'
      },
      {
        id: 'referral-follow-up',
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
        id: 'roundtable',
        title: 'Host builder roundtable',
        time: 'Tue',
        detail: 'Share instant approvals roadmap + service updates.',
        status: 'confirmed'
      },
      {
        id: 'nurture-drip',
        title: 'Launch nurture drip v3',
        time: 'Wed',
        detail: 'Target advisors that opened last campaign.',
        status: 'queued'
      },
      {
        id: 'health-review',
        title: 'Partner health review',
        time: 'Thu',
        detail: 'Scorecard for top 20 partners.',
        status: 'in-progress'
      },
      {
        id: 'asset-drop',
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
        id: 'learning-hub',
        title: 'Launch co-branded learning hub',
        time: 'Week 2',
        detail: 'Curated playlists + rate explainer modules.',
        status: 'in-progress'
      },
      {
        id: 'summit-keynote',
        title: 'Mortgage summit keynote',
        time: 'Week 5',
        detail: 'Feature partner success metrics + pipeline story.',
        status: 'confirmed'
      },
      {
        id: 'api-onboarding',
        title: 'API onboarding window',
        time: 'Week 7',
        detail: 'Lakeview CU + 2 credit unions testing integrations.',
        status: 'attention'
      },
      {
        id: 'playbook-refresh',
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

const pipelineStages = [
  {
    id: 'new',
    label: 'New',
    summary: 'Fresh referrals entering the cycle.',
    deals: [
      { id: 'marquez', name: 'Marquez • Single family', amount: 420000, status: 'Docs requested' },
      { id: 'lam-chang', name: 'Lam / Chang • Condo', amount: 390000, status: 'Needs appraisal slot' }
    ]
  },
  {
    id: 'active',
    label: 'Active',
    summary: 'In processing and underwriting stages.',
    deals: [
      { id: 'singh', name: 'Singh • Townhome', amount: 505000, status: 'Conditions review' },
      { id: 'ibarra', name: 'Ibarra • Jumbo refi', amount: 780000, status: 'UW feedback pending' },
      { id: 'ridge-homes', name: 'Ridge Homes • 6 lots', amount: 2400000, status: 'Builder docs inbound' }
    ]
  },
  {
    id: 'closing',
    label: 'Closing',
    summary: 'Scheduled for clear-to-close & signing.',
    deals: [
      { id: 'okafor', name: 'Okafor • First-time buyer', amount: 365000, status: 'Waiting homeowner policy' },
      { id: 'khan', name: 'Khan • Construction', amount: 980000, status: 'CD out • Thu 3:00p' }
    ]
  },
  {
    id: 'won',
    label: 'Won',
    summary: 'Recently funded victories to celebrate.',
    deals: [
      { id: 'harper', name: 'Harper • VA loan', amount: 410000, status: 'Funded • 2 days ago' },
      { id: 'valdez', name: 'Valdez • Investment', amount: 640000, status: 'Funded • Yesterday' }
    ]
  }
];

const initialContacts = [
  {
    id: 'ava-martinez',
    name: 'Ava Martinez',
    role: 'Realtor — Sunset Realty',
    segment: 'VIP',
    status: 'Hot lead',
    lastInteraction: 'Met for coffee (Today)',
    tags: ['Top referrer', 'Monthly newsletter'],
    email: 'ava@sunsetrealty.com',
    phone: '(415) 555-0134',
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
    email: 'clay@ridgehomes.com',
    phone: '(206) 555-0193',
    notes: 'Confirm signage proofs before Thursday. Interested in pilot for instant approvals dashboard.'
  },
  {
    id: 'jamila-harris',
    name: 'Jamila Harris',
    role: 'Financial Planner — Pivotal Finance',
    segment: 'Advisor',
    status: 'Nurture',
    lastInteraction: 'Shared rate update (2d ago)',
    tags: ['Quarterly briefing'],
    email: 'jamila@pivotalfinance.com',
    phone: '(312) 555-0171',
    notes: 'Prefers concise check-ins. Exploring home-equity webinar collaboration next quarter.'
  },
  {
    id: 'noah-lin',
    name: 'Noah Lin',
    role: 'Credit Union — Lakeview CU',
    segment: 'Lender partner',
    status: 'Exploring',
    lastInteraction: 'Demo request (Yesterday)',
    tags: ['Co-branded ads', 'Automation'],
    email: 'noah@lakeviewcu.org',
    phone: '(702) 555-0154',
    notes: 'Needs onboarding timeline for API access. Considering dedicated marketing assets for branches.'
  }
];

const segments = ['All', 'VIP', 'Builder', 'Advisor', 'Lender partner'];

const quickActions = [
  { id: 'new-partner', label: 'New partner', icon: '🤝', tone: 'primary', modal: 'new-partner' },
  { id: 'log-activity', label: 'Log touchpoint', icon: '📝', tone: 'secondary', modal: 'log-activity' },
  { id: 'schedule-event', label: 'Schedule event', icon: '📅', tone: 'secondary', modal: 'schedule-event' }
];
const defaultSettings = {
  profile: {
    name: 'Jordan Ellis',
    email: 'jordan@skyline.loans',
    phone: '(555) 010-2210',
    digest: '08:30'
  },
  workspace: {
    focus: 'today',
    digestChannel: 'Morning briefing email',
    autopilot: true
  },
  goals: {
    funded: 12,
    volume: 4200000
  },
  automations: [
    {
      id: 'welcome-kit',
      name: 'Welcome kit follow-up',
      description: 'Send onboarding kit + checklist when a partner is created.',
      enabled: true
    },
    {
      id: 'rate-watch',
      name: 'Rate watch nudges',
      description: 'Alert VIP partners when rates drop by more than 0.25%.',
      enabled: true
    },
    {
      id: 'weekly-digest',
      name: 'Weekly digest',
      description: 'Summarize pipeline moves + upcoming events each Friday afternoon.',
      enabled: false
    }
  ]
};

const SETTINGS_KEY = 'ux-lab-settings-v2';

function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return cloneDeep(defaultSettings);
    }
    const parsed = JSON.parse(raw);
    return {
      profile: { ...defaultSettings.profile, ...(parsed.profile || {}) },
      workspace: { ...defaultSettings.workspace, ...(parsed.workspace || {}) },
      goals: { ...defaultSettings.goals, ...(parsed.goals || {}) },
      automations: Array.isArray(parsed.automations)
        ? parsed.automations.map((entry) => ({ ...entry }))
        : cloneDeep(defaultSettings.automations)
    };
  } catch (error) {
    console.warn('[UX LAB] Unable to read settings from storage', error);
    return cloneDeep(defaultSettings);
  }
}

const labState = {
  contacts: cloneDeep(initialContacts),
  pipeline: cloneDeep(pipelineStages),
  settings: loadSettings()
};

let calendarInstance = null;

function persistSettings() {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(labState.settings));
  } catch (error) {
    console.warn('[UX LAB] Unable to persist settings', error);
  }
}

function formatCurrency(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(number);
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function applyWorkspacePreferences() {
  const { workspace } = labState.settings;
  document.body.dataset.labFocus = workspace.focus;
  document.body.dataset.labAutopilot = workspace.autopilot ? 'on' : 'off';
  labEvents.dispatchEvent(
    new CustomEvent('settings:applied', {
      detail: { workspace }
    })
  );
}

function moveDeal(dealId, targetStageId, status) {
  let movedDeal = null;
  labState.pipeline.forEach((stage) => {
    const index = stage.deals.findIndex((deal) => deal.id === dealId);
    if (index !== -1) {
      movedDeal = { ...stage.deals[index] };
      stage.deals.splice(index, 1);
    }
  });
  if (!movedDeal) {
    return false;
  }
  const targetStage = labState.pipeline.find((stage) => stage.id === targetStageId);
  if (!targetStage) {
    return false;
  }
  movedDeal.status = status || movedDeal.status;
  targetStage.deals.unshift(movedDeal);
  return true;
}

const calendarEvents = [
  {
    id: 'event-ava',
    title: 'Coffee with Ava',
    start: dayjs().hour(9).minute(30).format('YYYY-MM-DDTHH:mm:00'),
    display: 'background',
    backgroundColor: 'rgba(56, 189, 248, 0.28)'
  },
  {
    id: 'event-walkthrough',
    title: 'Builder walkthrough',
    start: dayjs().add(1, 'day').hour(11).format('YYYY-MM-DDTHH:mm:00'),
    end: dayjs().add(1, 'day').hour(12).format('YYYY-MM-DDTHH:mm:00'),
    color: '#2563eb'
  },
  {
    id: 'event-lunch',
    title: 'Partner lunch — Ridge Homes',
    start: dayjs().add(3, 'day').hour(12).format('YYYY-MM-DDTHH:mm:00'),
    color: '#f97316'
  },
  {
    id: 'event-workshop',
    title: 'Homebuyer workshop',
    start: dayjs().add(5, 'day').format('YYYY-MM-DD'),
    end: dayjs().add(6, 'day').format('YYYY-MM-DD'),
    color: '#0f766e'
  },
  {
    id: 'event-referrals',
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

const modalDefinitions = {
  'new-partner': {
    title: 'Create partner profile',
    description: 'Capture relationship essentials and drop them into the workspace.',
    submitLabel: 'Add partner',
    fields: () => [
      { type: 'text', name: 'name', label: 'Partner name', required: true, placeholder: 'Summit Realty' },
      {
        type: 'text',
        name: 'role',
        label: 'Role / organization',
        required: true,
        placeholder: 'Realtor — Summit Realty'
      },
      {
        type: 'select',
        name: 'segment',
        label: 'Segment',
        required: true,
        options: segments
          .filter((segment) => segment !== 'All')
          .map((segment) => ({ value: segment, label: segment }))
      },
      { type: 'email', name: 'email', label: 'Email', placeholder: 'partner@example.com' },
      { type: 'tel', name: 'phone', label: 'Phone', placeholder: '(555) 555-0110' },
      {
        type: 'textarea',
        name: 'notes',
        label: 'Notes',
        rows: 3,
        placeholder: 'Key priorities, follow-up context'
      }
    ],
    onSubmit: (formData) => {
      const name = String(formData.get('name') || '').trim();
      if (!name) return;
      const id = slugify(name) || `partner-${Date.now()}`;
      const segment = formData.get('segment') || 'VIP';
      const partner = {
        id,
        name,
        role: String(formData.get('role') || 'Partner'),
        segment,
        status: 'New partner',
        lastInteraction: `Created ${dayjs().format('MMM D')}`,
        tags: ['New', segment],
        email: String(formData.get('email') || ''),
        phone: String(formData.get('phone') || ''),
        notes: String(formData.get('notes') || '—')
      };
      labState.contacts.unshift(partner);
      if (!segments.includes(segment)) {
        segments.push(segment);
      }
      focusModes.today.timeline.unshift({
        id: `welcome-${id}`,
        title: `Welcome ${partner.name}`,
        time: dayjs().format('HH:mm'),
        detail: 'Kickoff touch scheduled from the action bar.',
        status: 'queued'
      });
      if (focusModes.today.timeline.length > 6) {
        focusModes.today.timeline.length = 6;
      }
      labEvents.dispatchEvent(
        new CustomEvent('contacts:changed', { detail: { type: 'added', contact: partner } })
      );
      labEvents.dispatchEvent(new CustomEvent('overview:refresh'));
      showToast('Partner added to roster.', 'success');
      closeModal();
    }
  },
  'log-activity': {
    title: 'Log partner touchpoint',
    description: 'Document a call, meeting, or task so automations can follow up.',
    submitLabel: 'Log activity',
    fields: () => [
      {
        type: 'select',
        name: 'contact',
        label: 'Partner',
        required: true,
        options: labState.contacts.map((contact) => ({ value: contact.id, label: contact.name }))
      },
      {
        type: 'select',
        name: 'activity',
        label: 'Activity type',
        required: true,
        options: [
          { value: 'Call', label: 'Call' },
          { value: 'Meeting', label: 'Meeting' },
          { value: 'Email', label: 'Email' },
          { value: 'Review', label: 'File review' }
        ]
      },
      {
        type: 'textarea',
        name: 'notes',
        label: 'Outcome notes',
        rows: 3,
        placeholder: 'Summarize commitments or blockers.'
      }
    ],
    onSubmit: (formData) => {
      const contactId = formData.get('contact');
      const contact = labState.contacts.find((entry) => entry.id === contactId);
      if (!contact) return;
      const activity = String(formData.get('activity') || 'Touchpoint');
      const notes = String(formData.get('notes') || '').trim();
      contact.lastInteraction = `${activity} logged (${dayjs().format('MMM D')})`;
      if (notes) {
        contact.notes = `${notes}\n\n${contact.notes}`;
      }
      focusModes.today.timeline.unshift({
        id: `activity-${contactId}-${Date.now()}`,
        title: `${activity} — ${contact.name}`,
        time: dayjs().format('HH:mm'),
        detail: notes || 'Captured from mission control.',
        status: 'in-progress'
      });
      if (focusModes.today.timeline.length > 6) {
        focusModes.today.timeline.length = 6;
      }
      labEvents.dispatchEvent(
        new CustomEvent('contacts:changed', { detail: { type: 'updated', contact } })
      );
      labEvents.dispatchEvent(new CustomEvent('overview:refresh'));
      showToast('Activity logged for the partner.', 'success');
      closeModal();
    }
  },
  'schedule-event': {
    title: 'Schedule partner event',
    description: 'Reserve time on the shared calendar and sync with your digest.',
    submitLabel: 'Add to calendar',
    fields: () => [
      { type: 'text', name: 'title', label: 'Event title', required: true, placeholder: 'Lunch with Ridge Homes' },
      { type: 'date', name: 'date', label: 'Date', required: true, value: dayjs().format('YYYY-MM-DD') },
      { type: 'time', name: 'time', label: 'Start time', required: true, value: '10:00' },
      {
        type: 'select',
        name: 'duration',
        label: 'Duration',
        required: true,
        options: [
          { value: '30', label: '30 minutes' },
          { value: '45', label: '45 minutes' },
          { value: '60', label: '60 minutes' }
        ],
        value: '60'
      },
      {
        type: 'select',
        name: 'contact',
        label: 'Partner (optional)',
        options: [{ value: '', label: 'General' }].concat(
          labState.contacts.map((contact) => ({ value: contact.id, label: contact.name }))
        )
      }
    ],
    onSubmit: (formData) => {
      const title = String(formData.get('title') || '').trim();
      if (!title) return;
      const date = String(formData.get('date') || dayjs().format('YYYY-MM-DD'));
      const startTime = String(formData.get('time') || '10:00');
      const duration = Number(formData.get('duration') || 60);
      const start = dayjs(`${date}T${startTime}`);
      const end = start.add(duration, 'minute');
      const event = {
        id: `event-${Date.now()}`,
        title,
        start: start.format(),
        end: end.format(),
        color: '#0ea5e9'
      };
      calendarEvents.push(event);
      if (calendarInstance) {
        calendarInstance.addEvent(event);
      }
      const contactId = formData.get('contact');
      const contact = labState.contacts.find((entry) => entry.id === contactId);
      if (contact) {
        contact.lastInteraction = `Event scheduled (${dayjs().format('MMM D')})`;
        labEvents.dispatchEvent(
          new CustomEvent('contacts:changed', { detail: { type: 'updated', contact } })
        );
      }
      focusModes.today.timeline.unshift({
        id: `event-${event.id}`,
        title: title,
        time: start.format('MMM D'),
        detail: 'Added via scheduling flow.',
        status: 'confirmed'
      });
      if (focusModes.today.timeline.length > 6) {
        focusModes.today.timeline.length = 6;
      }
      labEvents.dispatchEvent(new CustomEvent('overview:refresh'));
      showToast('Event added to the lab calendar.', 'success');
      closeModal();
    }
  },
  'pipeline-update': {
    title: 'Update deal stage',
    description: 'Shift the file to the right lane and capture the latest status.',
    submitLabel: 'Update pipeline',
    fields: (context) => [
      {
        type: 'select',
        name: 'stage',
        label: 'Stage',
        required: true,
        options: labState.pipeline.map((stage) => ({ value: stage.id, label: stage.label })),
        value: context?.stageId || 'active'
      },
      {
        type: 'textarea',
        name: 'status',
        label: 'Status note',
        rows: 2,
        required: true,
        value: context?.status || ''
      }
    ],
    onSubmit: (formData, context) => {
      const stage = formData.get('stage');
      const status = String(formData.get('status') || '');
      if (!stage || !context?.dealId) return;
      const success = moveDeal(context.dealId, stage, status);
      if (!success) return;
      labEvents.dispatchEvent(
        new CustomEvent('pipeline:changed', {
          detail: { dealId: context.dealId, stage }
        })
      );
      showToast('Pipeline updated.', 'success');
      closeModal();
    }
  },
  'edit-contact': {
    title: 'Edit partner profile',
    description: 'Update status, contact channels, and relationship notes.',
    submitLabel: 'Save changes',
    fields: (context) => {
      const contact = labState.contacts.find((entry) => entry.id === context?.contactId);
      return [
        {
          type: 'text',
          name: 'name',
          label: 'Name',
          required: true,
          value: contact?.name || ''
        },
        {
          type: 'text',
          name: 'role',
          label: 'Role / organization',
          required: true,
          value: contact?.role || ''
        },
        {
          type: 'select',
          name: 'segment',
          label: 'Segment',
          required: true,
          options: segments
            .filter((segment) => segment !== 'All')
            .map((segment) => ({ value: segment, label: segment })),
          value: contact?.segment || 'VIP'
        },
        {
          type: 'text',
          name: 'status',
          label: 'Status',
          required: true,
          value: contact?.status || ''
        },
        { type: 'email', name: 'email', label: 'Email', value: contact?.email || '' },
        { type: 'tel', name: 'phone', label: 'Phone', value: contact?.phone || '' },
        { type: 'textarea', name: 'notes', label: 'Notes', rows: 3, value: contact?.notes || '' }
      ];
    },
    onSubmit: (formData, context) => {
      const contact = labState.contacts.find((entry) => entry.id === context?.contactId);
      if (!contact) return;
      contact.name = String(formData.get('name') || contact.name);
      contact.role = String(formData.get('role') || contact.role);
      contact.segment = String(formData.get('segment') || contact.segment);
      contact.status = String(formData.get('status') || contact.status);
      contact.email = String(formData.get('email') || contact.email);
      contact.phone = String(formData.get('phone') || contact.phone);
      contact.notes = String(formData.get('notes') || contact.notes);
      if (!segments.includes(contact.segment)) {
        segments.push(contact.segment);
      }
      labEvents.dispatchEvent(
        new CustomEvent('contacts:changed', { detail: { type: 'updated', contact } })
      );
      showToast('Partner profile updated.', 'success');
      closeModal();
    }
  }
};

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const modalState = {
  host: null,
  form: null,
  title: null,
  description: null,
  close: null,
  key: null,
  context: null
};

function renderField(field) {
  const { type, name, label, required, placeholder, rows, options, value } = field;
  const id = `modal-${name}`;
  const requirement = required ? ' required' : '';
  const fieldLabel = label ? `<label for="${id}">${escapeHtml(label)}</label>` : '';
  const baseAttrs = `id="${id}" name="${name}"${requirement}`;

  switch (type) {
    case 'textarea':
      return `
        <div class="modal-field">
          ${fieldLabel}
          <textarea ${baseAttrs} rows="${rows || 3}" placeholder="${escapeHtml(placeholder || '')}">${escapeHtml(
        value || ''
      )}</textarea>
        </div>
      `;
    case 'select':
      if (!Array.isArray(options)) {
        return '';
      }
      const renderedOptions = options
        .map((option) => {
          const selected = value != null && String(option.value) === String(value) ? ' selected' : '';
          return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
        })
        .join('');
      return `
        <div class="modal-field">
          ${fieldLabel}
          <select ${baseAttrs}>${renderedOptions}</select>
        </div>
      `;
    default:
      return `
        <div class="modal-field">
          ${fieldLabel}
          <input ${baseAttrs} type="${type}" value="${escapeHtml(value || '')}" placeholder="${escapeHtml(
        placeholder || ''
      )}" />
        </div>
      `;
  }
}

function renderFields(fields) {
  return fields.map((field) => renderField(field)).join('');
}

function setupModalSystem() {
  modalState.host = document.getElementById('lab-modal');
  modalState.form = modalState.host.querySelector('#modal-form');
  modalState.title = modalState.host.querySelector('#modal-title');
  modalState.description = modalState.host.querySelector('#modal-description');
  modalState.close = modalState.host.querySelector('[data-modal-close]');

  modalState.close.addEventListener('click', () => {
    closeModal();
  });
  modalState.host.addEventListener('click', (event) => {
    if (event.target === modalState.host) {
      closeModal();
    }
  });
  modalState.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const config = modalDefinitions[modalState.key];
    if (!config) return;
    const formData = new FormData(modalState.form);
    config.onSubmit(formData, modalState.context || {});
  });
}

function openModal(key, context = {}) {
  const config = modalDefinitions[key];
  if (!config || !modalState.host) return;
  modalState.key = key;
  modalState.context = context;
  modalState.title.textContent = config.title;
  modalState.description.textContent = config.description || '';
  const fieldsFactory = typeof config.fields === 'function' ? config.fields : () => config.fields || [];
  const fields = fieldsFactory(context) || [];
  modalState.form.innerHTML = `${renderFields(fields)}
    <div class="modal-actions">
      <button type="submit" class="btn-primary">${escapeHtml(config.submitLabel || 'Save')}</button>
      <button type="button" class="btn-ghost" data-modal-cancel>Cancel</button>
    </div>`;
  const cancelButton = modalState.form.querySelector('[data-modal-cancel]');
  cancelButton.addEventListener('click', () => {
    closeModal();
  });
  modalState.host.removeAttribute('aria-hidden');
  modalState.host.classList.add('open');
  const firstInput = modalState.form.querySelector('input, select, textarea');
  if (firstInput) {
    firstInput.focus();
  }
}

function closeModal() {
  if (!modalState.host) return;
  modalState.host.setAttribute('aria-hidden', 'true');
  modalState.host.classList.remove('open');
  modalState.form.innerHTML = '';
  modalState.key = null;
  modalState.context = null;
}

function showToast(message, tone = 'default') {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" aria-label="Dismiss">×</button>`;
  toast.querySelector('button').addEventListener('click', () => {
    toast.remove();
  });
  stack.appendChild(toast);
  stack.scrollTop = stack.scrollHeight;
}

function renderChrome(root) {
  const navItems = navLinks
    .map((link, index) => {
      const selected = index === 0 ? ' aria-current="page"' : '';
      return `<button type="button" class="nav-link" data-link="${link.id}"${selected}>${link.label}</button>`;
    })
    .join('');

  const automationList = labState.settings.automations
    .map((automation) => {
      const checked = automation.enabled ? ' checked' : '';
      return `
        <label class="automation-toggle">
          <input type="checkbox" data-automation="${automation.id}"${checked} />
          <div>
            <strong>${escapeHtml(automation.name)}</strong>
            <p class="muted">${escapeHtml(automation.description)}</p>
          </div>
        </label>
      `;
    })
    .join('');

  const goalFunded = formatNumber(labState.settings.goals.funded);
  const goalVolume = formatCurrency(labState.settings.goals.volume);
  const digestChannel = escapeHtml(labState.settings.workspace.digestChannel);
  const autopilotLabel = labState.settings.workspace.autopilot
    ? 'Autopilot nudges on'
    : 'Autopilot paused';

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
          <a class="nav-back" href="../../index.html#settings">← Back to CRM settings</a>
        </footer>
      </aside>
      <div class="lab-main">
        <header class="lab-header">
          <div class="header-top">
            <div>
              <h1>Experience Lab</h1>
              <p class="muted">Exploring responsive layouts, motion, and partner-centric workflows.</p>
              <div class="header-meta">
                <span class="meta-chip" id="workspace-digest">${digestChannel}</span>
                <span class="meta-chip" id="workspace-autopilot">${escapeHtml(autopilotLabel)}</span>
              </div>
            </div>
            <div class="header-controls">
              <label class="theme-switcher">
                <span>Theme</span>
                <select id="theme-picker" class="theme-select" aria-label="Theme picker"></select>
              </label>
              <div class="pulse-pill" role="status">Live prototype</div>
            </div>
          </div>
          <div class="action-bar" id="action-bar" role="toolbar" aria-label="Primary lab actions"></div>
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
                  <div class="hero-footnotes">
                    <div class="footnote-block">
                      <span class="muted label">Monthly goals</span>
                      <strong id="goal-funded-target">${goalFunded} funded</strong>
                      <span class="muted" id="goal-volume-target">${goalVolume} volume</span>
                    </div>
                    <div class="footnote-block">
                      <span class="muted label">Daily digest</span>
                      <strong id="goal-digest-channel">${digestChannel}</strong>
                      <span class="muted" id="goal-autopilot-label">${escapeHtml(autopilotLabel)}</span>
                    </div>
                  </div>
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
          <section class="panel" id="pipeline-panel" data-surface="pipeline">
            <header class="panel-head">
              <h2>Pipeline storyboard</h2>
              <p class="muted">Track deals moving from new referral to funded celebration.</p>
            </header>
            <div class="panel-body pipeline-body">
              <div class="pipeline-board" id="pipeline-board"></div>
              <aside class="pipeline-digest">
                <h3>Daily brief</h3>
                <ul class="pipeline-metrics" id="pipeline-metrics"></ul>
                <div class="pipeline-playbooks">
                  <h4>Automation snippets</h4>
                  <ul>
                    <li>Stage alerts notify assigned LOs and assistants.</li>
                    <li>Escalations auto-create partner tasks when aging beyond SLA.</li>
                    <li>Won files trigger thank-you notes + testimonial requests.</li>
                  </ul>
                </div>
              </aside>
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
              <div class="contacts-toolbar">
                <div class="chip-row" id="contact-filters" role="group" aria-label="Filter partners by segment"></div>
                <div class="contact-search">
                  <label for="contact-search-input" class="muted">Search</label>
                  <input id="contact-search-input" type="search" placeholder="Find partner" />
                </div>
              </div>
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
          <section class="panel" id="settings-panel" data-surface="settings">
            <header class="panel-head">
              <h2>Settings & automations</h2>
              <p class="muted">Tune workflow preferences, goals, and proactive nudges.</p>
            </header>
            <div class="panel-body settings-body">
              <form id="profile-settings" class="settings-card">
                <h3>Profile & digest</h3>
                <div class="settings-grid">
                  <label>
                    <span>Display name</span>
                    <input type="text" name="name" value="${escapeHtml(labState.settings.profile.name)}" required />
                  </label>
                  <label>
                    <span>Email</span>
                    <input type="email" name="email" value="${escapeHtml(labState.settings.profile.email)}" required />
                  </label>
                  <label>
                    <span>Phone</span>
                    <input type="tel" name="phone" value="${escapeHtml(labState.settings.profile.phone)}" />
                  </label>
                  <label>
                    <span>Digest send time</span>
                    <input type="time" name="digest" value="${escapeHtml(labState.settings.profile.digest)}" required />
                  </label>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary">Save profile</button>
                </div>
              </form>
              <form id="goal-settings" class="settings-card">
                <h3>Goals</h3>
                <div class="settings-grid">
                  <label>
                    <span>Funded loans target</span>
                    <input type="number" min="0" name="funded" value="${escapeHtml(String(
    labState.settings.goals.funded
  ))}" required />
                  </label>
                  <label>
                    <span>Loan volume target</span>
                    <input type="number" min="0" step="10000" name="volume" value="${escapeHtml(String(
    labState.settings.goals.volume
  ))}" required />
                  </label>
                  <label>
                    <span>Focus mode preference</span>
                    <select name="focus">
                      <option value="today"${labState.settings.workspace.focus === 'today' ? ' selected' : ''}>Today</option>
                      <option value="week"${labState.settings.workspace.focus === 'week' ? ' selected' : ''}>This week</option>
                      <option value="quarter"${labState.settings.workspace.focus === 'quarter' ? ' selected' : ''}>Quarter</option>
                    </select>
                  </label>
                  <label class="toggle">
                    <input type="checkbox" name="autopilot"${labState.settings.workspace.autopilot ? ' checked' : ''} />
                    <span>Enable autopilot nudges</span>
                  </label>
                  <label>
                    <span>Digest channel</span>
                    <input type="text" name="digestChannel" value="${escapeHtml(
                      labState.settings.workspace.digestChannel
                    )}" />
                  </label>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary">Save goals</button>
                </div>
              </form>
              <section class="settings-card">
                <h3>Automations</h3>
                <div class="automation-list" id="automation-list">${automationList}</div>
              </section>
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
    <div class="lab-modal" id="lab-modal" aria-hidden="true">
      <div class="modal-surface" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header class="modal-head">
          <div>
            <h3 id="modal-title"></h3>
            <p class="muted" id="modal-description"></p>
          </div>
          <button type="button" class="btn-close" data-modal-close aria-label="Close modal">×</button>
        </header>
        <form id="modal-form" class="modal-body"></form>
      </div>
    </div>
    <div class="toast-stack" id="toast-stack" aria-live="assertive" aria-atomic="true"></div>
  `;
}

function applyTheme(themeKey) {
  const theme = THEMES[themeKey] || THEMES.sunrise;
  document.body.dataset.labTheme = themeKey;
  Object.entries(theme).forEach(([token, value]) => {
    if (token === 'name') return;
    document.body.style.setProperty(`--lab-${token}`, value);
  });
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

function setupNavigation(root) {
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

function setupActionBar() {
  const host = document.getElementById('action-bar');
  if (!host) return;
  host.innerHTML = quickActions
    .map(
      (action) => `
        <button type="button" class="action-button action-${action.tone}" data-action="${action.id}">
          <span class="action-icon" aria-hidden="true">${action.icon}</span>
          <span>${action.label}</span>
        </button>
      `
    )
    .join('');

  host.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = quickActions.find((entry) => entry.id === button.dataset.action);
    if (!action) return;
    openModal(action.modal);
  });

  labEvents.addEventListener('settings:applied', (event) => {
    if (!event.detail?.workspace) return;
    const autopilot = event.detail.workspace.autopilot;
    host.dataset.autopilot = autopilot ? 'on' : 'off';
  });
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
  const goalFunded = document.querySelector('#goal-funded-target');
  const goalVolume = document.querySelector('#goal-volume-target');
  const digestChannel = document.querySelector('#goal-digest-channel');
  const autopilotLabel = document.querySelector('#goal-autopilot-label');
  const digestChip = document.querySelector('#workspace-digest');
  const autopilotChip = document.querySelector('#workspace-autopilot');

  let activeMode = labState.settings.workspace.focus in focusModes ? labState.settings.workspace.focus : 'today';

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

  function refreshSettings() {
    const { goals, workspace } = labState.settings;
    goalFunded.textContent = `${formatNumber(goals.funded)} funded`;
    goalVolume.textContent = `${formatCurrency(goals.volume)} volume`;
    digestChannel.textContent = workspace.digestChannel;
    autopilotLabel.textContent = workspace.autopilot ? 'Autopilot nudges on' : 'Autopilot paused';
    digestChip.textContent = workspace.digestChannel;
    autopilotChip.textContent = workspace.autopilot ? 'Autopilot nudges on' : 'Autopilot paused';
  }

  switchHost.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    applyMode(button.dataset.mode);
  });

  renderSignals();
  refreshSettings();
  applyMode(activeMode);

  labEvents.addEventListener('overview:refresh', () => {
    applyMode(activeMode);
  });

  labEvents.addEventListener('settings:applied', () => {
    refreshSettings();
    if (labState.settings.workspace.focus !== activeMode) {
      applyMode(labState.settings.workspace.focus);
    } else {
      applyMode(activeMode);
    }
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
  select.value = document.body.dataset.labTheme || 'sunrise';
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
  calendarInstance = calendar;
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

function setupPipeline() {
  const board = document.getElementById('pipeline-board');
  const metricsHost = document.getElementById('pipeline-metrics');

  function renderBoard() {
    board.innerHTML = labState.pipeline
      .map((stage) => {
        const cards = stage.deals
          .map(
            (deal) => `
              <article class="pipeline-card" data-deal="${deal.id}" data-stage="${stage.id}">
                <header>
                  <strong>${deal.name}</strong>
                  <span class="muted">${formatCurrency(deal.amount)}</span>
                </header>
                <p class="muted">${escapeHtml(deal.status)}</p>
                <button type="button" class="pill" data-pipeline-edit="${deal.id}">Advance</button>
              </article>
            `
          )
          .join('');

        return `
          <section class="pipeline-stage" data-stage="${stage.id}">
            <header>
              <h3>${stage.label}</h3>
              <p class="muted">${stage.summary}</p>
            </header>
            <div class="pipeline-stage-body">${cards}</div>
          </section>
        `;
      })
      .join('');
  }

  function renderMetrics() {
    const allDeals = labState.pipeline.flatMap((stage) => stage.deals.map((deal) => ({ ...deal, stage: stage.id })));
    const activeCount = allDeals.filter((deal) => deal.stage !== 'won').length;
    const wonVolume = allDeals
      .filter((deal) => deal.stage === 'won')
      .reduce((sum, deal) => sum + Number(deal.amount || 0), 0);
    const attentionCount = allDeals.filter((deal) => /pending|waiting|needs/i.test(deal.status)).length;

    metricsHost.innerHTML = `
      <li><span class="metric-label">Active deals</span><strong>${formatNumber(activeCount)}</strong></li>
      <li><span class="metric-label">Won volume</span><strong>${formatCurrency(wonVolume)}</strong></li>
      <li><span class="metric-label">Follow-ups flagged</span><strong>${formatNumber(attentionCount)}</strong></li>
    `;
  }

  board.addEventListener('click', (event) => {
    const button = event.target.closest('[data-pipeline-edit]');
    if (!button) return;
    const dealId = button.dataset.pipelineEdit;
    const stage = button.closest('.pipeline-card')?.dataset.stage;
    const deal = labState.pipeline
      .flatMap((stageEntry) => stageEntry.deals.map((item) => ({ ...item, stage: stageEntry.id })))
      .find((entry) => entry.id === dealId);
    openModal('pipeline-update', { dealId, stageId: stage, status: deal?.status || '' });
  });

  renderBoard();
  renderMetrics();

  labEvents.addEventListener('pipeline:changed', () => {
    renderBoard();
    renderMetrics();
  });
}

function setupContacts() {
  const filterHost = document.querySelector('#contact-filters');
  const listHost = document.querySelector('#contact-list');
  const searchInput = document.querySelector('#contact-search-input');
  const drawer = document.querySelector('#contact-drawer');
  const drawerTitle = drawer.querySelector('#drawer-title');
  const drawerSub = drawer.querySelector('.drawer-sub');
  const drawerBody = drawer.querySelector('#drawer-body');
  const drawerClose = drawer.querySelector('#drawer-close');

  let activeFilter = 'All';
  let searchTerm = '';

  function renderFilters() {
    filterHost.innerHTML = segments
      .map((segment) => {
        const selected = segment === activeFilter ? ' aria-pressed="true"' : '';
        return `<button type="button" class="chip" data-filter="${segment}"${selected}>${segment}</button>`;
      })
      .join('');
  }

  function renderList() {
    const normalizedSearch = searchTerm.toLowerCase();
    const rows = labState.contacts
      .filter((contact) => activeFilter === 'All' || contact.segment === activeFilter)
      .filter((contact) =>
        !normalizedSearch ||
        contact.name.toLowerCase().includes(normalizedSearch) ||
        contact.role.toLowerCase().includes(normalizedSearch)
      )
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

    listHost.innerHTML = rows || '<p class="muted empty-state">No partners match the current filters.</p>';
  }

  function openDrawer(contactId) {
    const contact = labState.contacts.find((entry) => entry.id === contactId);
    if (!contact) return;
    drawerTitle.textContent = contact.name;
    drawerSub.textContent = `${contact.role} • ${contact.segment}`;
    drawerBody.innerHTML = `
      <section>
        <h4>Next steps</h4>
        <p>${escapeHtml(contact.notes)}</p>
      </section>
      <section class="drawer-meta">
        <div>
          <span class="muted">Status</span>
          <strong>${escapeHtml(contact.status)}</strong>
        </div>
        <div>
          <span class="muted">Last interaction</span>
          <strong>${escapeHtml(contact.lastInteraction)}</strong>
        </div>
        <div>
          <span class="muted">Email</span>
          <strong>${escapeHtml(contact.email || '—')}</strong>
        </div>
        <div>
          <span class="muted">Phone</span>
          <strong>${escapeHtml(contact.phone || '—')}</strong>
        </div>
      </section>
      <section class="drawer-actions">
        <button type="button" class="btn-primary" data-drawer-edit="${contact.id}">Edit profile</button>
        <button type="button" class="btn-ghost" data-drawer-schedule="${contact.id}">Schedule follow-up</button>
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

  searchInput.addEventListener('input', (event) => {
    searchTerm = event.target.value || '';
    renderList();
  });

  drawer.addEventListener('click', (event) => {
    if (event.target === drawer) {
      closeDrawer();
    }
  });

  drawerBody.addEventListener('click', (event) => {
    const editButton = event.target.closest('[data-drawer-edit]');
    const scheduleButton = event.target.closest('[data-drawer-schedule]');
    if (editButton) {
      openModal('edit-contact', { contactId: editButton.dataset.drawerEdit });
    } else if (scheduleButton) {
      openModal('schedule-event', { contactId: scheduleButton.dataset.drawerSchedule });
    }
  });

  drawerClose.addEventListener('click', () => {
    closeDrawer();
  });

  renderFilters();
  renderList();

  labEvents.addEventListener('contacts:changed', () => {
    renderFilters();
    renderList();
  });
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

function setupSettings() {
  const profileForm = document.getElementById('profile-settings');
  const goalForm = document.getElementById('goal-settings');
  const automationList = document.getElementById('automation-list');

  profileForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(profileForm);
    labState.settings.profile.name = String(data.get('name') || labState.settings.profile.name);
    labState.settings.profile.email = String(data.get('email') || labState.settings.profile.email);
    labState.settings.profile.phone = String(data.get('phone') || labState.settings.profile.phone);
    labState.settings.profile.digest = String(data.get('digest') || labState.settings.profile.digest);
    persistSettings();
    applyWorkspacePreferences();
    showToast('Profile preferences saved.', 'success');
  });

  goalForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(goalForm);
    labState.settings.goals.funded = Number(data.get('funded') || labState.settings.goals.funded);
    labState.settings.goals.volume = Number(data.get('volume') || labState.settings.goals.volume);
    labState.settings.workspace.focus = String(data.get('focus') || labState.settings.workspace.focus);
    labState.settings.workspace.autopilot = data.get('autopilot') === 'on';
    labState.settings.workspace.digestChannel = String(
      data.get('digestChannel') || labState.settings.workspace.digestChannel
    );
    persistSettings();
    applyWorkspacePreferences();
    showToast('Goal targets updated.', 'success');
  });

  automationList.addEventListener('change', (event) => {
    const toggle = event.target.closest('input[data-automation]');
    if (!toggle) return;
    const automation = labState.settings.automations.find((entry) => entry.id === toggle.dataset.automation);
    if (!automation) return;
    automation.enabled = toggle.checked;
    persistSettings();
    showToast('Automation preferences saved.', 'success');
  });
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
  try {
    setupModalSystem();
    setupNavigation(root);
    setupThemeSwitcher(root);
    setupActionBar();
    setupOverview();
    setupCalendar();
    setupDashboard();
    setupPipeline();
    setupContacts();
    setupInsights();
    setupSettings();
    applyWorkspacePreferences();
  } catch (error) {
    console.error('[UX LAB] boot error', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', init);

