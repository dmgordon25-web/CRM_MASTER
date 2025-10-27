const dayjs = window.dayjs;
const { Calendar } = window.FullCalendar;
const dayGridPlugin = (window.FullCalendar.DayGrid && (window.FullCalendar.DayGrid.default || window.FullCalendar.DayGrid)) || null;
const interactionPlugin =
  (window.FullCalendar.Interaction && (window.FullCalendar.Interaction.default || window.FullCalendar.Interaction)) || null;
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
          <section class="panel" id="calendar-panel">
            <header class="panel-head">
              <h2>Partner calendar</h2>
              <p class="muted">Unified view of meetings, workshops, and campaigns.</p>
            </header>
            <div class="panel-body calendar-body">
              <div id="lab-calendar" class="calendar-shell" aria-live="polite"></div>
            </div>
          </section>
          <section class="panel" id="dashboard-panel">
            <header class="panel-head">
              <h2>Adaptive dashboard</h2>
              <p class="muted">Drag tiles to prototype personalized workspaces.</p>
            </header>
            <div class="panel-body">
              <div class="grid-stack" id="dashboard-grid"></div>
            </div>
          </section>
          <section class="panel" id="contacts-panel">
            <header class="panel-head">
              <h2>Partners</h2>
              <p class="muted">Filter by relationship segment to focus the outreach plan.</p>
            </header>
            <div class="panel-body">
              <div class="chip-row" id="contact-filters" role="group" aria-label="Filter partners by segment"></div>
              <div class="contact-list" id="contact-list"></div>
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

function setupNavigation(root) {
  const nav = root.querySelector('.nav-links');
  nav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-link]');
    if (!button) return;
    nav.querySelectorAll('button[data-link]').forEach((node) => {
      node.removeAttribute('aria-current');
    });
    button.setAttribute('aria-current', 'page');
  });
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

function init() {
  const root = document.getElementById('lab-root');
  applyTheme(document.body.dataset.labTheme || 'sunrise');
  renderChrome(root);
  try {
    setupNavigation(root);
    setupThemeSwitcher(root);
    setupCalendar();
    setupDashboard();
    setupContacts();
  } catch (error) {
    console.error('[UX LAB] boot error', error);
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', init);
