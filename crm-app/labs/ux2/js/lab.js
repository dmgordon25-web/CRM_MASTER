/* ===================================
   Lab UX2 - Experimental Dashboard
   Main JavaScript Module
   =================================== */

// Import widget configurations
import { WIDGET_CONFIGS, createWidgetElement } from './widgets.js';

// Initialize dayjs plugins if available
if (typeof dayjs !== 'undefined') {
  if (window.dayjs_plugin_relativeTime) {
    dayjs.extend(window.dayjs_plugin_relativeTime);
  }
  if (window.dayjs_plugin_calendar) {
    dayjs.extend(window.dayjs_plugin_calendar);
  }
}

// Lab State
const LabState = {
  grid: null,
  editMode: false,
  currentTheme: 'default',
  widgets: new Map(),
  initialized: false
};

// Storage keys
const STORAGE_KEYS = {
  LAYOUT: 'lab:ux2:layout:v1',
  THEME: 'lab:ux2:theme:v1',
  HIDDEN_WIDGETS: 'lab:ux2:hidden-widgets:v1'
};

// Initialize the Lab
async function init() {
  console.log('🧪 Initializing Lab Environment...');

  try {
    // Load saved theme
    loadTheme();

    // Initialize GridStack
    initializeGrid();

    // Load widgets
    await loadWidgets();

    // Setup event listeners
    setupEventListeners();

    // Hide loading, show shell
    document.getElementById('lab-loading').style.display = 'none';
    document.getElementById('lab-shell').style.display = 'flex';

    LabState.initialized = true;
    console.log('✅ Lab Environment Ready');
  } catch (error) {
    console.error('❌ Lab initialization failed:', error);
    showError('Failed to initialize Lab environment. Please check the console for details.');
  }
}

// Initialize GridStack
function initializeGrid() {
  const gridElement = document.getElementById('lab-grid');

  if (typeof GridStack === 'undefined') {
    throw new Error('GridStack library not loaded. Please check your internet connection.');
  }

  LabState.grid = GridStack.init({
    column: 12,
    cellHeight: 80,
    margin: 16,
    animate: true,
    float: false,
    disableDrag: true,
    disableResize: true,
    removable: false,
    acceptWidgets: false
  }, gridElement);

  // Save layout on change
  LabState.grid.on('change', (event, items) => {
    if (LabState.initialized && items && items.length > 0) {
      saveLayout();
    }
  });

  console.log('📊 GridStack initialized');
}

// Load all widgets
async function loadWidgets() {
  console.log('📦 Loading widgets...');

  // Get saved layout
  const savedLayout = loadLayout();
  const hiddenWidgets = loadHiddenWidgets();

  // Create widget elements
  for (const [widgetId, config] of Object.entries(WIDGET_CONFIGS)) {
    // Skip hidden widgets
    if (hiddenWidgets.has(widgetId)) {
      console.log(`⏭️ Skipping hidden widget: ${widgetId}`);
      continue;
    }

    // Find saved position or use default
    const savedWidget = savedLayout.find(w => w.id === widgetId);
    const position = savedWidget || {
      x: config.defaultX || 0,
      y: config.defaultY || 0,
      w: config.defaultW || 4,
      h: config.defaultH || 3
    };

    // Create widget element
    const widgetElement = createWidgetElement(widgetId, config);

    // Add to grid
    LabState.grid.addWidget(widgetElement, {
      x: position.x,
      y: position.y,
      w: position.w,
      h: position.h,
      id: widgetId,
      minW: config.minW || 2,
      minH: config.minH || 2,
      maxW: config.maxW || 12,
      maxH: config.maxH || 10
    });

    // Store widget reference
    LabState.widgets.set(widgetId, {
      element: widgetElement,
      config: config
    });

    console.log(`✅ Loaded widget: ${config.title}`);
  }

  // Load widget content from baseline CRM
  await loadWidgetContent();

  console.log(`📦 ${LabState.widgets.size} widgets loaded`);
}

// Load widget content from baseline CRM
async function loadWidgetContent() {
  console.log('🔄 Loading widget content from baseline CRM...');

  // For each widget, try to fetch its content from the baseline dashboard
  for (const [widgetId, widgetData] of LabState.widgets) {
    const config = widgetData.config;

    if (config.sourceUrl) {
      try {
        // If widget has a source URL, load it
        await loadWidgetFromSource(widgetId, config.sourceUrl);
      } catch (error) {
        console.warn(`⚠️ Could not load widget ${widgetId} from source:`, error);
        showWidgetPlaceholder(widgetId, config);
      }
    } else {
      // Show placeholder for widgets without source
      showWidgetPlaceholder(widgetId, config);
    }
  }

  console.log('✅ Widget content loaded');
}

// Load widget from source URL
async function loadWidgetFromSource(widgetId, sourceUrl) {
  // This would normally fetch widget content from the baseline CRM
  // For now, we'll show a placeholder
  showWidgetPlaceholder(widgetId, LabState.widgets.get(widgetId).config);
}

// Show placeholder content for widget
function showWidgetPlaceholder(widgetId, config) {
  const widgetData = LabState.widgets.get(widgetId);
  if (!widgetData) return;

  const bodyElement = widgetData.element.querySelector('.lab-widget-body');
  if (!bodyElement) return;

  // Create placeholder content
  bodyElement.innerHTML = `
    <div class="lab-widget-placeholder" style="
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px;
      text-align: center;
      color: var(--lab-text-muted);
    ">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px; opacity: 0.5;">
        ${config.icon || '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>'}
      </svg>
      <h4 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: var(--lab-text);">
        ${config.title}
      </h4>
      <p style="margin: 0; font-size: 14px;">
        ${config.description || 'Widget content will appear here'}
      </p>
      ${config.hint ? `<p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.7;">${config.hint}</p>` : ''}
    </div>
  `;
}

// Setup event listeners
function setupEventListeners() {
  // Theme switcher
  document.querySelectorAll('.lab-theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      setTheme(theme);
    });
  });

  // Reset layout
  document.getElementById('lab-reset-layout').addEventListener('click', () => {
    if (confirm('Reset dashboard layout to default? This cannot be undone.')) {
      resetLayout();
    }
  });

  // Toggle edit mode
  document.getElementById('lab-toggle-edit').addEventListener('click', () => {
    toggleEditMode();
  });

  console.log('👂 Event listeners attached');
}

// Theme Management
function setTheme(theme) {
  LabState.currentTheme = theme;
  document.documentElement.setAttribute('data-lab-theme', theme);

  // Update active button
  document.querySelectorAll('.lab-theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });

  // Save to storage
  localStorage.setItem(STORAGE_KEYS.THEME, theme);

  console.log(`🎨 Theme changed to: ${theme}`);
}

function loadTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  if (savedTheme) {
    setTheme(savedTheme);
  }
}

// Edit Mode
function toggleEditMode() {
  LabState.editMode = !LabState.editMode;

  if (LabState.editMode) {
    LabState.grid.enable();
    document.getElementById('lab-grid').classList.add('lab-edit-mode');
    document.getElementById('lab-toggle-edit').style.background = 'var(--lab-primary)';
    document.getElementById('lab-toggle-edit').style.color = 'white';
    console.log('✏️ Edit mode enabled');
  } else {
    LabState.grid.disable();
    document.getElementById('lab-grid').classList.remove('lab-edit-mode');
    document.getElementById('lab-toggle-edit').style.background = '';
    document.getElementById('lab-toggle-edit').style.color = '';
    console.log('🔒 Edit mode disabled');
  }
}

// Layout Management
function saveLayout() {
  const layout = [];

  LabState.grid.engine.nodes.forEach(node => {
    layout.push({
      id: node.id,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h
    });
  });

  localStorage.setItem(STORAGE_KEYS.LAYOUT, JSON.stringify(layout));
  console.log('💾 Layout saved');
}

function loadLayout() {
  const saved = localStorage.getItem(STORAGE_KEYS.LAYOUT);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (error) {
      console.warn('⚠️ Could not parse saved layout:', error);
    }
  }
  return [];
}

function resetLayout() {
  localStorage.removeItem(STORAGE_KEYS.LAYOUT);

  // Reload the page to apply default layout
  window.location.reload();
}

// Hidden Widgets Management
function loadHiddenWidgets() {
  const saved = localStorage.getItem(STORAGE_KEYS.HIDDEN_WIDGETS);
  if (saved) {
    try {
      return new Set(JSON.parse(saved));
    } catch (error) {
      console.warn('⚠️ Could not parse hidden widgets:', error);
    }
  }
  return new Set();
}

// Widget Actions
function toggleWidget(widgetId) {
  const hiddenWidgets = loadHiddenWidgets();

  if (hiddenWidgets.has(widgetId)) {
    hiddenWidgets.delete(widgetId);
  } else {
    hiddenWidgets.add(widgetId);
  }

  localStorage.setItem(STORAGE_KEYS.HIDDEN_WIDGETS, JSON.stringify([...hiddenWidgets]));

  // Reload to apply changes
  window.location.reload();
}

function removeWidget(widgetId) {
  if (confirm('Remove this widget from the dashboard?')) {
    toggleWidget(widgetId);
  }
}

// Error Display
function showError(message) {
  console.error('Lab Error:', message);
  const loadingElement = document.getElementById('lab-loading');
  if (loadingElement) {
    loadingElement.innerHTML = `
      <div style="text-align: center; padding: 24px; max-width: 600px; margin: 0 auto;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #ef4444; margin-bottom: 16px;">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <h3 style="margin: 0 0 8px 0; color: #ef4444;">Lab Initialization Error</h3>
        <p style="margin: 0 0 16px 0; color: #64748b;">${message}</p>
        <a href="../../index.html" style="display: inline-block; padding: 8px 16px; background: #3b82f6; color: white; text-decoration: none; border-radius: 4px;">
          Return to Dashboard
        </a>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export for debugging
window.LabState = LabState;
window.LabActions = {
  toggleWidget,
  removeWidget,
  resetLayout,
  setTheme,
  toggleEditMode
};
