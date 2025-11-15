/**
 * Dashboard Configuration Management
 * Settings-based widget visibility, ordering, and preferences
 */

const STORAGE_KEY = 'dashboard:config:v2';
const TODAY_WIDGET_KEYS = new Set(['focus', 'today', 'upcomingCelebrations']);

// Default widget list with metadata
const DEFAULT_WIDGETS = [
  { id: 'focus', label: 'Focus Summary', size: 'large', defaultOrder: 1 },
  { id: 'filters', label: 'Filters', size: 'large', defaultOrder: 2 },
  { id: 'kpis', label: 'KPIs', size: 'large', defaultOrder: 3 },
  { id: 'pipeline', label: 'Pipeline Overview', size: 'large', defaultOrder: 4 },
  { id: 'today', label: 'Today\'s Work', size: 'large', defaultOrder: 5 },
  { id: 'leaderboard', label: 'Referral Leaderboard', size: 'medium', defaultOrder: 6 },
  { id: 'stale', label: 'Stale Deals', size: 'medium', defaultOrder: 7 },
  { id: 'goalProgress', label: 'Production Goals', size: 'large', defaultOrder: 8 },
  { id: 'numbersPortfolio', label: 'Partner Portfolio', size: 'medium', defaultOrder: 9 },
  { id: 'numbersReferrals', label: 'Referral Leaders', size: 'medium', defaultOrder: 10 },
  { id: 'numbersMomentum', label: 'Pipeline Momentum', size: 'large', defaultOrder: 11 },
  { id: 'pipelineCalendar', label: 'Pipeline Calendar', size: 'large', defaultOrder: 12 },
  { id: 'priorityActions', label: 'Priority Actions', size: 'medium', defaultOrder: 13 },
  { id: 'milestones', label: 'Milestones Ahead', size: 'medium', defaultOrder: 14 },
  { id: 'docPulse', label: 'Document Pulse', size: 'medium', defaultOrder: 15 },
  { id: 'relationshipOpportunities', label: 'Relationship Opportunities', size: 'medium', defaultOrder: 16 },
  { id: 'clientCareRadar', label: 'Client Care Radar', size: 'medium', defaultOrder: 17 },
  { id: 'closingWatch', label: 'Closing Watchlist', size: 'medium', defaultOrder: 18 },
  { id: 'upcomingCelebrations', label: 'Upcoming Celebrations', size: 'medium', defaultOrder: 19 },
  { id: 'docCenter', label: 'Document Center', size: 'large', defaultOrder: 20 },
  { id: 'statusStack', label: 'Status Panels', size: 'large', defaultOrder: 21 }
];

// Get default configuration
function getDefaultConfig() {
  return {
    widgets: DEFAULT_WIDGETS.map(w => ({
      id: w.id,
      visible: true,
      order: w.defaultOrder,
      size: w.size
    })),
    defaultToAll: false,
    includeTodayInAll: true
  };
}

// Load configuration from localStorage
export function loadDashboardConfig() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultConfig();
    
    const config = JSON.parse(stored);
    
    // Ensure all default widgets are present
    const storedIds = new Set(config.widgets.map(w => w.id));
    const missingWidgets = DEFAULT_WIDGETS
      .filter(w => !storedIds.has(w.id))
      .map(w => ({
        id: w.id,
        visible: true,
        order: w.defaultOrder,
        size: w.size
      }));
    
    if (missingWidgets.length > 0) {
      config.widgets = [...config.widgets, ...missingWidgets];
    }
    
    // Ensure all widgets have size property
    config.widgets.forEach(w => {
      if (!w.size) {
        const defaultWidget = DEFAULT_WIDGETS.find(dw => dw.id === w.id);
        w.size = defaultWidget ? defaultWidget.size : 'medium';
      }
    });
    
    return {
      widgets: config.widgets || [],
      defaultToAll: config.defaultToAll !== undefined ? config.defaultToAll : false,
      includeTodayInAll: config.includeTodayInAll !== undefined ? config.includeTodayInAll : true
    };
  } catch (err) {
    console.warn('[DashboardConfig] Failed to load config, using defaults:', err);
    return getDefaultConfig();
  }
}

// Save configuration to localStorage
export function saveDashboardConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (err) {
    console.error('[DashboardConfig] Failed to save config:', err);
    return false;
  }
}

// Get widget metadata
export function getWidgetMetadata(widgetId) {
  return DEFAULT_WIDGETS.find(w => w.id === widgetId);
}

// Check if widget is a "Today" widget
export function isTodayWidget(widgetId) {
  return TODAY_WIDGET_KEYS.has(widgetId);
}

// Get visible widgets for current mode
export function getVisibleWidgets(mode, config) {
  const { widgets, includeTodayInAll } = config;
  
  if (mode === 'today') {
    // Today mode: only show today widgets
    return widgets
      .filter(w => w.visible && isTodayWidget(w.id))
      .sort((a, b) => a.order - b.order);
  } else {
    // All mode: show all enabled widgets
    if (includeTodayInAll) {
      return widgets
        .filter(w => w.visible)
        .sort((a, b) => a.order - b.order);
    } else {
      return widgets
        .filter(w => w.visible && !isTodayWidget(w.id))
        .sort((a, b) => a.order - b.order);
    }
  }
}

// Apply configuration to DOM
export function applyDashboardConfig(mode) {
  const config = loadDashboardConfig();
  const visibleWidgets = getVisibleWidgets(mode, config);
  const visibleIds = new Set(visibleWidgets.map(w => w.id));
  
  // Apply to each widget in DOM
  const container = document.querySelector('main[data-ui="dashboard-root"]');
  if (!container) {
    console.warn('[DashboardConfig] Dashboard container not found');
    return;
  }
  
  const allWidgets = container.querySelectorAll('[data-dash-widget]');
  allWidgets.forEach(element => {
    const widgetId = element.dataset.dashWidget || element.dataset.widgetId;
    if (!widgetId) return;
    
    const widgetConfig = config.widgets.find(w => w.id === widgetId);
    if (!widgetConfig) return;
    
    // Set visibility
    if (visibleIds.has(widgetId)) {
      element.removeAttribute('data-widget-hidden');
      element.style.display = '';
    } else {
      element.setAttribute('data-widget-hidden', 'true');
      element.style.display = 'none';
    }
    
    // Set order
    element.style.order = widgetConfig.order;
    
    // Set size class
    element.classList.remove('widget-small', 'widget-medium', 'widget-large');
    if (widgetConfig.size) {
      element.classList.add(`widget-${widgetConfig.size}`);
    }
  });
  
  console.log(`[DashboardConfig] Applied config for ${mode} mode: ${visibleWidgets.length} widgets visible`);
}

// Get initial dashboard mode based on settings
export function getInitialDashboardMode() {
  const config = loadDashboardConfig();
  return config.defaultToAll ? 'all' : 'today';
}

export const DashboardConfig = {
  load: loadDashboardConfig,
  save: saveDashboardConfig,
  getDefaultConfig,
  getWidgetMetadata,
  isTodayWidget,
  getVisibleWidgets,
  apply: applyDashboardConfig,
  getInitialMode: getInitialDashboardMode,
  DEFAULT_WIDGETS
};
