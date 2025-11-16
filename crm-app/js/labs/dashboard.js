// Labs CRM Dashboard - Visually Stunning Version of Actual CRM
// Uses real data from CRM database

import { ensureDatabase, getAllContacts, getAllPartners, getAllTasks } from './data.js';
import { CRM_WIDGET_RENDERERS } from './crm_widgets.js';

let dashboardRoot = null;
let crmData = {
  contacts: [],
  partners: [],
  tasks: []
};

// Initialize Labs CRM Dashboard
export async function initLabsCRMDashboard(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }

  dashboardRoot = root;

  // Show loading state
  showLoading();

  // Connect to database and load data
  const dbReady = await ensureDatabase();
  if (!dbReady) {
    showError('Failed to connect to CRM database');
    return;
  }

  await loadCRMData();
  renderDashboard();
  attachEventListeners();
}

// Load CRM data from database
async function loadCRMData() {
  try {
    const [contacts, partners, tasks] = await Promise.all([
      getAllContacts(),
      getAllPartners(),
      getAllTasks()
    ]);

    crmData = { contacts, partners, tasks };

    console.info(`[labs] Loaded ${contacts.length} contacts, ${partners.length} partners, ${tasks.length} tasks`);
  } catch (err) {
    console.error('[labs] Failed to load CRM data:', err);
  }
}

// Show loading state
function showLoading() {
  if (!dashboardRoot) return;

  dashboardRoot.innerHTML = `
    <div class="labs-loading">
      <div class="loading-spinner"></div>
      <div class="loading-text">Loading CRM Data...</div>
    </div>
  `;
}

// Show error state
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

// Render the full CRM dashboard
function renderDashboard() {
  if (!dashboardRoot) return;

  dashboardRoot.innerHTML = '';
  dashboardRoot.className = 'labs-crm-dashboard';
  dashboardRoot.dataset.qa = 'labs-crm-dashboard';

  // Render header
  const header = createHeader();
  dashboardRoot.appendChild(header);

  // Render widget grid
  const grid = createWidgetGrid();
  dashboardRoot.appendChild(grid);

  // Render all widgets
  renderWidgets(grid);
}

// Create dashboard header
function createHeader() {
  const header = document.createElement('header');
  header.className = 'labs-crm-header';
  header.dataset.qa = 'labs-header';

  header.innerHTML = `
    <div class="labs-header-content">
      <div class="labs-branding">
        <h1 class="labs-title">
          <span class="labs-icon-main">🚀</span>
          CRM Labs
          <span class="labs-badge-beta">BETA</span>
        </h1>
        <p class="labs-subtitle">Experimental Visual Dashboard • Real CRM Data</p>
      </div>
      <div class="labs-header-stats">
        <div class="header-stat">
          <div class="stat-value">${crmData.contacts.length}</div>
          <div class="stat-label">Contacts</div>
        </div>
        <div class="header-stat">
          <div class="stat-value">${crmData.partners.length}</div>
          <div class="stat-label">Partners</div>
        </div>
        <div class="header-stat">
          <div class="stat-value">${crmData.tasks.length}</div>
          <div class="stat-label">Tasks</div>
        </div>
      </div>
      <div class="labs-header-actions">
        <button class="labs-btn-icon" data-action="refresh" title="Refresh Data">
          <span class="icon-refresh">⟳</span>
        </button>
        <button class="labs-btn-icon" data-action="settings" title="Settings">
          <span class="icon-settings">⚙</span>
        </button>
      </div>
    </div>
  `;

  return header;
}

// Create widget grid container
function createWidgetGrid() {
  const grid = document.createElement('div');
  grid.className = 'labs-crm-grid';
  grid.dataset.qa = 'labs-widget-grid';

  return grid;
}

// Render all CRM widgets
function renderWidgets(grid) {
  const { contacts, partners, tasks } = crmData;

  // Define widget layout
  const widgets = [
    { id: 'kpis', renderer: CRM_WIDGET_RENDERERS.kpis, args: [contacts], size: 'large' },
    { id: 'pipelineMomentum', renderer: CRM_WIDGET_RENDERERS.pipelineMomentum, args: [contacts], size: 'large' },
    { id: 'pipelineOverview', renderer: CRM_WIDGET_RENDERERS.pipelineOverview, args: [contacts], size: 'large' },
    { id: 'partnerPortfolio', renderer: CRM_WIDGET_RENDERERS.partnerPortfolio, args: [partners], size: 'medium' },
    { id: 'referralLeaderboard', renderer: CRM_WIDGET_RENDERERS.referralLeaderboard, args: [partners], size: 'medium' },
    { id: 'staleDeals', renderer: CRM_WIDGET_RENDERERS.staleDeals, args: [contacts], size: 'medium' },
    { id: 'today', renderer: CRM_WIDGET_RENDERERS.today, args: [tasks, contacts], size: 'medium' },
    { id: 'activePipeline', renderer: CRM_WIDGET_RENDERERS.activePipeline, args: [contacts], size: 'large' }
  ];

  widgets.forEach((widget, index) => {
    if (!widget.renderer) {
      console.warn(`[labs] No renderer for widget: ${widget.id}`);
      return;
    }

    const container = document.createElement('div');
    container.className = `labs-widget-container size-${widget.size}`;
    container.dataset.widgetId = widget.id;
    container.dataset.qa = `labs-widget-container-${widget.id}`;
    container.style.animationDelay = `${index * 0.05}s`;

    try {
      widget.renderer(container, ...widget.args);
      grid.appendChild(container);
    } catch (err) {
      console.error(`[labs] Error rendering widget ${widget.id}:`, err);
    }
  });
}

// Attach event listeners
function attachEventListeners() {
  if (!dashboardRoot) return;

  // Header action buttons
  dashboardRoot.addEventListener('click', async (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'refresh':
        await refreshDashboard();
        break;
      case 'settings':
        showNotification('Settings coming soon!', 'info');
        break;
    }
  });

  // Widget refresh buttons
  dashboardRoot.addEventListener('click', async (e) => {
    if (e.target.closest('.labs-widget-refresh')) {
      await refreshDashboard();
    }
  });

  // Listen for CRM data changes
  if (typeof document !== 'undefined') {
    document.addEventListener('app:data:changed', handleDataChange);
  }
}

// Handle data change events from main CRM
async function handleDataChange(event) {
  console.info('[labs] CRM data changed, refreshing...', event.detail);
  await refreshDashboard();
}

// Refresh dashboard data and widgets
async function refreshDashboard() {
  const grid = dashboardRoot?.querySelector('.labs-crm-grid');
  if (!grid) return;

  // Add loading overlay
  grid.style.opacity = '0.5';
  grid.style.pointerEvents = 'none';

  try {
    await loadCRMData();
    grid.innerHTML = '';
    renderWidgets(grid);
    showNotification('Dashboard refreshed', 'success');
  } catch (err) {
    console.error('[labs] Refresh failed:', err);
    showNotification('Refresh failed', 'error');
  } finally {
    grid.style.opacity = '1';
    grid.style.pointerEvents = 'auto';
  }
}

// Notification system
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `labs-notification ${type}`;
  notification.textContent = message;

  dashboardRoot?.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('show');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Export
export default initLabsCRMDashboard;
