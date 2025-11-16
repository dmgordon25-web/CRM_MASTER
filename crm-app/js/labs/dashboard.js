// Labs Dashboard - Main Entry Point
// Mission Control Interface with Creative Freedom

import { readLabsConfig, writeLabsConfig, findLabsWidgetMeta } from './config.js';
import { WIDGET_RENDERERS } from './widgets.js';

let currentConfig = null;
let dashboardRoot = null;

// Initialize Labs Dashboard
export async function initLabsDashboard(root) {
  if (!root) {
    console.error('[labs] No root element provided');
    return;
  }

  dashboardRoot = root;
  currentConfig = readLabsConfig();

  renderDashboard();
  attachEventListeners();
  startAnimations();
}

// Render the full dashboard
function renderDashboard() {
  if (!dashboardRoot) return;

  dashboardRoot.innerHTML = '';
  dashboardRoot.className = `labs-dashboard theme-${currentConfig.theme} layout-${currentConfig.layout}`;
  dashboardRoot.dataset.qa = 'labs-dashboard';

  // Render header
  const header = createHeader();
  dashboardRoot.appendChild(header);

  // Render controls
  const controls = createControls();
  dashboardRoot.appendChild(controls);

  // Render widget grid
  const grid = createWidgetGrid();
  dashboardRoot.appendChild(grid);

  // Render widgets
  renderWidgets(grid);
}

// Create dashboard header
function createHeader() {
  const header = document.createElement('header');
  header.className = 'labs-header';
  header.dataset.qa = 'labs-header';

  header.innerHTML = `
    <div class="labs-header-content">
      <div class="labs-branding">
        <h1 class="labs-title">
          <span class="labs-icon-mission">🚀</span>
          Mission Control
          <span class="labs-badge-new">LABS</span>
        </h1>
        <p class="labs-subtitle">Experimental Dashboard • Unleash Innovation</p>
      </div>
      <div class="labs-header-actions">
        <button class="labs-btn-icon" data-action="refresh" title="Refresh All">
          <span class="icon-refresh">⟳</span>
        </button>
        <button class="labs-btn-icon" data-action="settings" title="Settings">
          <span class="icon-settings">⚙</span>
        </button>
        <button class="labs-btn-icon" data-action="fullscreen" title="Fullscreen">
          <span class="icon-fullscreen">⛶</span>
        </button>
      </div>
    </div>
    <div class="labs-status-bar">
      <div class="status-item">
        <span class="status-dot active"></span>
        <span class="status-label">System Online</span>
      </div>
      <div class="status-item">
        <span class="status-icon">📊</span>
        <span class="status-label">${currentConfig.widgets.filter(w => w.visible).length} Active Widgets</span>
      </div>
      <div class="status-item">
        <span class="status-icon">⚡</span>
        <span class="status-label">Real-time Updates</span>
      </div>
    </div>
  `;

  return header;
}

// Create dashboard controls
function createControls() {
  const controls = document.createElement('div');
  controls.className = 'labs-controls';
  controls.dataset.qa = 'labs-controls';

  controls.innerHTML = `
    <div class="labs-control-group">
      <label class="labs-label">
        <span class="label-text">Theme:</span>
        <select class="labs-select" data-control="theme">
          <option value="neon" ${currentConfig.theme === 'neon' ? 'selected' : ''}>Neon</option>
          <option value="cyber" ${currentConfig.theme === 'cyber' ? 'selected' : ''}>Cyber</option>
          <option value="aurora" ${currentConfig.theme === 'aurora' ? 'selected' : ''}>Aurora</option>
          <option value="matrix" ${currentConfig.theme === 'matrix' ? 'selected' : ''}>Matrix</option>
        </select>
      </label>
      <label class="labs-label">
        <span class="label-text">Layout:</span>
        <select class="labs-select" data-control="layout">
          <option value="masonry" ${currentConfig.layout === 'masonry' ? 'selected' : ''}>Masonry</option>
          <option value="grid" ${currentConfig.layout === 'grid' ? 'selected' : ''}>Grid</option>
          <option value="flow" ${currentConfig.layout === 'flow' ? 'selected' : ''}>Flow</option>
        </select>
      </label>
      <label class="labs-checkbox">
        <input type="checkbox" data-control="animations" ${currentConfig.animations ? 'checked' : ''}>
        <span class="checkbox-label">Animations</span>
      </label>
      <label class="labs-checkbox">
        <input type="checkbox" data-control="compact" ${currentConfig.compactMode ? 'checked' : ''}>
        <span class="checkbox-label">Compact Mode</span>
      </label>
    </div>
    <div class="labs-quick-actions">
      <button class="labs-btn-secondary" data-action="customize">
        <span class="btn-icon">✨</span>
        Customize Widgets
      </button>
      <button class="labs-btn-secondary" data-action="export">
        <span class="btn-icon">📥</span>
        Export Data
      </button>
    </div>
  `;

  return controls;
}

// Create widget grid container
function createWidgetGrid() {
  const grid = document.createElement('div');
  grid.className = `labs-widget-grid layout-${currentConfig.layout}`;
  grid.dataset.qa = 'labs-widget-grid';

  if (currentConfig.compactMode) {
    grid.classList.add('compact');
  }

  return grid;
}

// Render all visible widgets
function renderWidgets(grid) {
  const visibleWidgets = currentConfig.widgets
    .filter(w => w.visible)
    .sort((a, b) => a.order - b.order);

  visibleWidgets.forEach((widget, index) => {
    const meta = findLabsWidgetMeta(widget.id);
    if (!meta) return;

    const renderer = WIDGET_RENDERERS[widget.id];
    if (!renderer) {
      console.warn(`[labs] No renderer for widget: ${widget.id}`);
      return;
    }

    const container = document.createElement('div');
    container.className = `labs-widget-container size-${meta.size}`;
    container.dataset.widgetId = widget.id;
    container.dataset.qa = `labs-widget-container-${widget.id}`;
    container.style.animationDelay = `${index * 0.05}s`;

    if (widget.pinned) {
      container.classList.add('pinned');
    }

    try {
      renderer(container);
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
  dashboardRoot.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    switch (action) {
      case 'refresh':
        refreshDashboard();
        break;
      case 'settings':
        showSettings();
        break;
      case 'fullscreen':
        toggleFullscreen();
        break;
      case 'customize':
        showCustomizeModal();
        break;
      case 'export':
        exportDashboardData();
        break;
    }
  });

  // Control changes
  dashboardRoot.addEventListener('change', (e) => {
    const control = e.target.closest('[data-control]')?.dataset.control;
    if (!control) return;

    switch (control) {
      case 'theme':
        updateTheme(e.target.value);
        break;
      case 'layout':
        updateLayout(e.target.value);
        break;
      case 'animations':
        updateAnimations(e.target.checked);
        break;
      case 'compact':
        updateCompactMode(e.target.checked);
        break;
    }
  });

  // Widget interactions
  dashboardRoot.addEventListener('click', (e) => {
    const widgetAction = e.target.closest('.labs-widget-action');
    if (widgetAction) {
      const container = widgetAction.closest('.labs-widget-container');
      if (container) {
        expandWidget(container);
      }
    }
  });
}

// Start animations
function startAnimations() {
  if (!currentConfig.animations) return;

  // Pulse animations for live indicators
  const pulseElements = dashboardRoot?.querySelectorAll('.animate-pulse');
  pulseElements?.forEach(el => {
    el.style.animation = 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite';
  });

  // Slide-in animations
  const slideElements = dashboardRoot?.querySelectorAll('.animate-slide-in');
  slideElements?.forEach((el, idx) => {
    el.style.animation = `slideIn 0.5s ease-out ${idx * 0.05}s both`;
  });
}

// Dashboard actions
function refreshDashboard() {
  const grid = dashboardRoot?.querySelector('.labs-widget-grid');
  if (grid) {
    grid.style.opacity = '0.5';
    setTimeout(() => {
      renderDashboard();
      grid.style.opacity = '1';
      showNotification('Dashboard refreshed', 'success');
    }, 300);
  }
}

function showSettings() {
  showNotification('Settings panel coming soon!', 'info');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    dashboardRoot?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function showCustomizeModal() {
  showNotification('Widget customization coming soon!', 'info');
}

function exportDashboardData() {
  showNotification('Export feature coming soon!', 'info');
}

// Config updates
function updateTheme(theme) {
  currentConfig.theme = theme;
  writeLabsConfig(currentConfig);
  dashboardRoot.className = `labs-dashboard theme-${theme} layout-${currentConfig.layout}`;
  showNotification(`Theme changed to ${theme}`, 'success');
}

function updateLayout(layout) {
  currentConfig.layout = layout;
  writeLabsConfig(currentConfig);
  renderDashboard();
  showNotification(`Layout changed to ${layout}`, 'success');
}

function updateAnimations(enabled) {
  currentConfig.animations = enabled;
  writeLabsConfig(currentConfig);
  if (enabled) {
    startAnimations();
  }
  showNotification(`Animations ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

function updateCompactMode(enabled) {
  currentConfig.compactMode = enabled;
  writeLabsConfig(currentConfig);
  renderDashboard();
  showNotification(`Compact mode ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

function expandWidget(container) {
  container.classList.toggle('expanded');
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
export default initLabsDashboard;
