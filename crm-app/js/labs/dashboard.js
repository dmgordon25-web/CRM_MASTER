// Labs CRM Dashboard - Canonical mirror with modern UI shell

import { ensureDatabase, buildLabsModel, formatNumber } from './data.js';
import { CRM_WIDGET_RENDERERS } from './crm_widgets.js';

let dashboardRoot = null;
let labsModel = null;
let activeSection = 'overview';

const SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    description: 'Pipeline health and today\'s work',
    widgets: [
      { id: 'labsKpiSummary', size: 'large' },
      { id: 'labsPipelineSnapshot', size: 'large' },
      { id: 'labsTasks', size: 'medium' }
    ]
  }
];

function showLoading() {
  if (!dashboardRoot) return;
  dashboardRoot.innerHTML = `
    <div class="labs-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading CRM Data...</div>
    </div>
  `;
}

function showError(message) {
  if (!dashboardRoot) return;
  dashboardRoot.innerHTML = `
    <div class="labs-error">
      <h2>⚠️ Error</h2>
      <p>${message}</p>
      <button class="labs-btn-primary" onclick="location.reload()">Reload</button>
    </div>
  `;
}

async function hydrateModel() {
  labsModel = await buildLabsModel();
  if (!labsModel) {
    throw new Error('Labs data unavailable');
  }
}

function renderShell() {
  if (!dashboardRoot) return;
  dashboardRoot.innerHTML = '';
  dashboardRoot.className = 'labs-crm-dashboard';
  dashboardRoot.dataset.qa = 'labs-crm-dashboard';

  const header = createHeader();
  const nav = createNavigation();
  const sectionHost = document.createElement('div');
  sectionHost.className = 'labs-section-host';
  sectionHost.dataset.qa = 'labs-section-host';

  dashboardRoot.appendChild(header);
  dashboardRoot.appendChild(nav);
  dashboardRoot.appendChild(sectionHost);

  renderSection(activeSection);
}

function createHeader() {
  const header = document.createElement('header');
  header.className = 'labs-crm-header';
  header.dataset.qa = 'labs-header';
  const contactCount = formatNumber(labsModel?.contacts?.length || 0);
  const partnerCount = formatNumber(labsModel?.partners?.length || 0);
  const taskCount = formatNumber(labsModel?.tasks?.length || 0);

  header.innerHTML = `
    <div class="labs-header-content">
      <div class="labs-branding">
        <h1 class="labs-title">
          <span class="labs-icon-main">🚀</span>
          CRM Labs
          <span class="labs-badge-beta">BETA</span>
        </h1>
        <p class="labs-subtitle">Canonical data • Alternate shell • Modern visuals</p>
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
      <div class="labs-header-actions">
        <button class="labs-btn-pill" data-action="refresh">Refresh Data</button>
        <button class="labs-btn-ghost" data-action="settings">Experiments</button>
      </div>
    </div>
  `;
  return header;
}

function createNavigation() {
  const nav = document.createElement('div');
  nav.className = 'labs-nav';
  nav.dataset.qa = 'labs-nav';
  const tabs = SECTIONS.map((section) => `
    <button class="labs-nav-tab ${section.id === activeSection ? 'active' : ''}" data-section="${section.id}">
      <span class="labs-nav-label">${section.label}</span>
      <span class="labs-nav-sub">${section.description}</span>
    </button>
  `).join('');
  nav.innerHTML = tabs;
  return nav;
}

function renderSection(sectionId) {
  const host = dashboardRoot?.querySelector('.labs-section-host');
  if (!host) return;
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];
  activeSection = section.id;

  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'labs-crm-grid';
  grid.dataset.qa = `labs-grid-${section.id}`;
  host.appendChild(grid);

  renderWidgets(grid, section.widgets);
  updateNavState();
}

function updateNavState() {
  const tabs = dashboardRoot?.querySelectorAll('.labs-nav-tab');
  if (!tabs) return;
  tabs.forEach((tab) => {
    const section = tab.dataset.section;
    tab.classList.toggle('active', section === activeSection);
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
  widgetList.forEach((widget, index) => {
    const renderer = CRM_WIDGET_RENDERERS[widget.id];
    if (!renderer) return;
    const container = document.createElement('div');
    container.className = `labs-widget-container size-${widget.size || 'medium'}`;
    container.dataset.widgetId = widget.id;
    container.dataset.qa = `labs-widget-${widget.id}`;
    container.style.animationDelay = `${index * 0.04}s`;

    try {
      renderer(container, model);
      grid.appendChild(container);
    } catch (err) {
      console.error(`[labs] Error rendering widget ${widget.id}:`, err);
    }
  });
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

function attachEventListeners() {
  if (!dashboardRoot) return;
  dashboardRoot.addEventListener('click', async (event) => {
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
      showNotification('Labs experiments are enabled — this mirrors the main dashboard.', 'info');
    }
  });

  if (typeof document !== 'undefined') {
    document.addEventListener('app:data:changed', async (evt) => {
      console.info('[labs] CRM data changed, refreshing...', evt.detail);
      await refreshDashboard();
    });
  }
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

export async function initLabsCRMDashboard(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }
  dashboardRoot = root;
  showLoading();

  const dbReady = await ensureDatabase();
  if (!dbReady) {
    showError('Failed to connect to CRM database');
    return;
  }

  try {
    await hydrateModel();
    renderShell();
    attachEventListeners();
    console.info('[labs] CRM Labs dashboard rendered');
  } catch (err) {
    console.error('[labs] Failed to initialize:', err);
    showError(err.message || 'Unable to render Labs dashboard');
  }
}

export default initLabsCRMDashboard;
