/**
 * Dashboard Auto-Layout Integration Patch
 * Add this to dashboard/index.js to integrate settings-based auto-layout
 */

// Import the config module at the top of dashboard/index.js
import { applyDashboardConfig, getInitialDashboardMode, loadDashboardConfig } from './config.js';

// Feature flag to disable drag-drop (set to true to disable edit mode)
const DISABLE_EDIT_MODE = true;

// Modified updateDashboardEditingState to respect the feature flag
function updateDashboardEditingState_AutoLayout(enabled, options = {}) {
  // If edit mode is disabled, never enable drag-drop
  if (DISABLE_EDIT_MODE) {
    enabled = false;
  }
  
  const next = !!enabled;
  const container = dashDnDState.container || getDashboardContainerNode();
  
  if (!container) {
    dashDnDState.active = false;
    exposeDashboardDnDHandlers();
    return;
  }
  
  if (next === dashDnDState.active && dashDnDState.controller) {
    return;
  }
  
  if (!next) {
    // Disable drag-drop
    if (dashDnDState.controller) {
      if (typeof dashDnDState.controller.disable === 'function') {
        dashDnDState.controller.disable();
      }
    }
    dashDnDState.active = false;
    cleanupPointerHandlersFor(container);
    exposeDashboardDnDHandlers();
    return;
  }
  
  // When edit mode is disabled, never create the controller
  if (DISABLE_EDIT_MODE) {
    dashDnDState.active = false;
    return;
  }
  
  // Original drag-drop initialization code would go here
  // (kept intact for future experimentation)
}

// Modified ensureWidgetResizeControl to skip when edit mode is disabled
function ensureWidgetResizeControl_AutoLayout(node) {
  if (DISABLE_EDIT_MODE) {
    // Remove any existing resize handles
    const existingHandle = node?.querySelector(':scope > .dash-resize-handle');
    if (existingHandle) {
      existingHandle.remove();
    }
    return null;
  }
  
  // Original resize control code (kept intact for future use)
  return ensureWidgetResizeControl(node);
}

// Enhanced setDashboardMode to apply config-based filtering
function setDashboardMode_AutoLayout(mode, options = {}) {
  const normalized = mode === 'all' ? 'all' : 'today';
  
  // Apply configuration-based widget visibility
  applyDashboardConfig(normalized);
  
  // Update mode indicator
  const buttons = doc?.querySelectorAll('[data-dashboard-mode]');
  buttons?.forEach(btn => {
    const btnMode = btn.getAttribute('data-dashboard-mode');
    if (btnMode === normalized) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-pressed', 'false');
    }
  });
  
  // Update caption
  const caption = doc?.getElementById('dashboard-mode-caption');
  if (caption) {
    caption.textContent = normalized === 'today'
      ? 'Focus on today\'s priorities.'
      : 'View all dashboard widgets.';
  }
  
  // Persist mode choice
  try {
    localStorage.setItem('dashboard:last-mode', normalized);
  } catch (err) {
    console.warn('[Dashboard] Failed to persist mode:', err);
  }
  
  // Dispatch event
  if (options.dispatch !== false) {
    doc?.dispatchEvent(new CustomEvent('dashboard:mode:changed', {
      detail: { mode: normalized }
    }));
  }
  
  console.log(`[Dashboard] Mode set to: ${normalized}`);
}

// Listen for config updates from settings
if (typeof document !== 'undefined') {
  document.addEventListener('dashboard:config:updated', (evt) => {
    console.log('[Dashboard] Config updated, reapplying...');
    const currentMode = localStorage.getItem('dashboard:last-mode') || 'today';
    applyDashboardConfig(currentMode);
  });
}

// Initialize dashboard with config-based mode
function initializeDashboardWithConfig() {
  const config = loadDashboardConfig();
  const initialMode = config.defaultToAll ? 'all' : 'today';
  
  // Apply config
  setDashboardMode_AutoLayout(initialMode, { dispatch: false });
  
  console.log(`[Dashboard] Initialized with mode: ${initialMode}`);
}

// Export the modified functions
export {
  updateDashboardEditingState_AutoLayout as updateDashboardEditingState,
  ensureWidgetResizeControl_AutoLayout as ensureWidgetResizeControl,
  setDashboardMode_AutoLayout as setDashboardMode,
  initializeDashboardWithConfig,
  DISABLE_EDIT_MODE
};
