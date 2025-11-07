/* ===================================
   Lab UX2 - Experimental Dashboard
   Main JavaScript Module
   =================================== */

console.log('🧪 [MODULE] lab.js loading...');

// Import widget configurations
import { WIDGET_CONFIGS, createWidgetElement } from './widgets.js';

console.log('🧪 [MODULE] Widgets imported:', Object.keys(WIDGET_CONFIGS).length, 'widgets');

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
  console.log('🧪 [1/6] Initializing Lab Environment...');
  console.log('🧪 [DEBUG] Document ready state:', document.readyState);
  console.log('🧪 [DEBUG] GridStack available:', typeof GridStack !== 'undefined');

  try {
    // Load saved theme
    console.log('🧪 [2/6] Loading theme...');
    loadTheme();
    console.log('✅ Theme loaded');

    // Initialize GridStack
    console.log('🧪 [3/6] Initializing GridStack...');
    initializeGrid();
    console.log('✅ GridStack initialized');

    // Load widgets
    console.log('🧪 [4/6] Loading widgets...');
    await loadWidgets();
    console.log('✅ Widgets loaded');

    // Setup event listeners
    console.log('🧪 [5/6] Setting up event listeners...');
    setupEventListeners();
    console.log('✅ Event listeners attached');

    // Hide loading, show shell
    console.log('🧪 [6/6] Showing Lab shell...');
    const loadingEl = document.getElementById('lab-loading');
    const shellEl = document.getElementById('lab-shell');
    console.log('🧪 [DEBUG] Loading element:', loadingEl ? 'found' : 'NOT FOUND');
    console.log('🧪 [DEBUG] Shell element:', shellEl ? 'found' : 'NOT FOUND');

    if (loadingEl) loadingEl.style.display = 'none';
    if (shellEl) shellEl.style.display = 'flex';

    LabState.initialized = true;
    console.log('✅ Lab Environment Ready - All systems go!');
  } catch (error) {
    console.error('❌ Lab initialization failed:', error);
    console.error('❌ Error stack:', error.stack);
    showError(`Failed to initialize Lab: ${error.message}`);
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

  // Create hidden iframe to load baseline dashboard
  const iframe = document.createElement('iframe');
  iframe.id = 'baseline-loader';
  iframe.src = '../../index.html#/dashboard';
  iframe.style.cssText = 'position:absolute;width:0;height:0;border:none;visibility:hidden;';
  document.body.appendChild(iframe);

  // Wait for baseline to load and initialize
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Baseline load timeout')), 15000);

    iframe.onload = () => {
      clearTimeout(timeout);
      console.log('✅ Baseline dashboard loaded');

      // Wait longer for baseline to fully initialize all widgets
      // Check periodically if widgets are rendered
      let attempts = 0;
      const maxAttempts = 20; // 10 seconds total
      const checkInterval = setInterval(() => {
        attempts++;
        const baselineDoc = iframe.contentDocument || iframe.contentWindow.document;
        const widgetCount = baselineDoc.querySelectorAll('.card[id], [data-widget-id]').length;

        console.log(`🔍 Checking baseline widgets... Found: ${widgetCount} (attempt ${attempts}/${maxAttempts})`);

        if (widgetCount >= 10 || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          console.log(`✅ Baseline ready with ${widgetCount} widgets`);
          resolve();
        }
      }, 500);
    };

    iframe.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load baseline'));
    };
  });

  // Clone widgets from baseline
  try {
    const baselineDoc = iframe.contentDocument || iframe.contentWindow.document;
    console.log('📋 Starting widget clone process...');

    let successCount = 0;
    let failCount = 0;

    for (const [widgetId, widgetData] of LabState.widgets) {
      const config = widgetData.config;
      const labWidgetBody = widgetData.element.querySelector('.lab-widget-body');

      if (!labWidgetBody) {
        console.warn(`⚠️ No widget body found for ${widgetId}`);
        continue;
      }

      // Try multiple selectors to find the widget
      const selectors = [
        `#${widgetId}`,
        `[data-widget-id="${widgetId}"]`,
        `[data-widget-id="${widgetId.replace('dashboard-', '')}"]`,
        `.card[id="${widgetId}"]`
      ];

      let baselineWidget = null;
      let usedSelector = null;

      for (const selector of selectors) {
        baselineWidget = baselineDoc.querySelector(selector);
        if (baselineWidget) {
          usedSelector = selector;
          break;
        }
      }

      if (baselineWidget) {
        // Clone the widget content deeply - preserve ALL baseline styling
        const clonedContent = baselineWidget.cloneNode(true);

        // Only set width for grid layout - preserve all other baseline styles
        clonedContent.style.width = '100%';
        clonedContent.style.margin = '0';

        // Clear loading placeholder
        labWidgetBody.innerHTML = '';
        labWidgetBody.appendChild(clonedContent);

        successCount++;
        console.log(`✅ Cloned widget: ${widgetId} (using ${usedSelector})`);
        console.log(`   Content length: ${clonedContent.innerHTML.length} chars`);
      } else {
        failCount++;
        console.warn(`⚠️ Widget not found in baseline: ${widgetId}`);
        console.warn(`   Tried selectors:`, selectors);
        showWidgetPlaceholder(widgetId, config);
      }
    }

    console.log(`✅ Widget cloning complete: ${successCount} success, ${failCount} failed`);
  } catch (error) {
    console.error('❌ Error loading widgets from baseline:', error);
    console.error('Error stack:', error.stack);

    // Fall back to placeholders
    for (const [widgetId, widgetData] of LabState.widgets) {
      showWidgetPlaceholder(widgetId, widgetData.config);
    }
  }
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
  console.log('🧪 [DEBUG] Setting up event listeners...');

  // Theme switcher
  const themeButtons = document.querySelectorAll('.lab-theme-btn');
  console.log('🧪 [DEBUG] Found theme buttons:', themeButtons.length);

  themeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const theme = btn.getAttribute('data-theme');
      console.log('🧪 [DEBUG] Theme button clicked:', theme);
      setTheme(theme);
    });
  });

  // Reset layout
  const resetBtn = document.getElementById('lab-reset-layout');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset dashboard layout to default? This cannot be undone.')) {
        resetLayout();
      }
    });
  }

  // Toggle edit mode
  const editBtn = document.getElementById('lab-toggle-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      toggleEditMode();
    });
  }

  console.log('👂 Event listeners attached');
}

// Theme Management
function setTheme(theme) {
  console.log(`🎨 [THEME] Setting theme to: ${theme}`);

  LabState.currentTheme = theme;
  const root = document.documentElement;
  root.setAttribute('data-lab-theme', theme);
  console.log(`🎨 [THEME] Applied attribute to root:`, root.getAttribute('data-lab-theme'));

  // Update active button
  document.querySelectorAll('.lab-theme-btn').forEach(btn => {
    const btnTheme = btn.getAttribute('data-theme');
    const isActive = btnTheme === theme;
    btn.classList.toggle('active', isActive);
    console.log(`🎨 [THEME] Button ${btnTheme}: active=${isActive}`);
  });

  // Save to storage
  localStorage.setItem(STORAGE_KEYS.THEME, theme);
  console.log(`🎨 [THEME] Saved to localStorage`);

  console.log(`✅ Theme changed to: ${theme}`);
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
console.log('🧪 [MODULE] Setting up initialization...');
console.log('🧪 [MODULE] Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  console.log('🧪 [MODULE] DOM still loading, will wait for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🧪 [EVENT] DOMContentLoaded fired, calling init()...');
    init();
  });
} else {
  console.log('🧪 [MODULE] DOM already ready, calling init() immediately...');
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
