/**
 * Advanced Mode Toggle
 * Controls visibility of advanced features throughout the application
 */

export const __esModule = true;

const STORAGE_KEY = 'crm_advanced_mode';
const ADVANCED_MODE_CLASS = 'advanced-mode-enabled';
const SIMPLE_MODE_CLASS = 'simple-mode-enabled';

let isAdvancedMode = true;
let initialized = false;

/**
 * Check if advanced mode is enabled
 */
export function isAdvancedModeEnabled() {
  return isAdvancedMode;
}

/**
 * Set advanced mode state
 */
export function setAdvancedMode(enabled) {
  isAdvancedMode = !!enabled;
  
  // Update localStorage
  try {
    localStorage.setItem(STORAGE_KEY, isAdvancedMode ? 'true' : 'false');
  } catch (err) {
    console.warn('Failed to save advanced mode preference:', err);
  }
  
  // Update body classes
  document.body.classList.toggle(ADVANCED_MODE_CLASS, isAdvancedMode);
  document.body.classList.toggle(SIMPLE_MODE_CLASS, !isAdvancedMode);
  
  // Update visibility of advanced elements
  applyAdvancedModeVisibility();
  
  // Dispatch event for other components
  const event = new CustomEvent('advancedmode:change', {
    detail: { enabled: isAdvancedMode }
  });
  document.dispatchEvent(event);
  window.dispatchEvent(event);
}

/**
 * Apply visibility to elements marked as advanced
 */
function applyAdvancedModeVisibility() {
  const advancedElements = document.querySelectorAll('[data-advanced]');
  
  advancedElements.forEach(element => {
    const show = isAdvancedMode;
    element.style.display = show ? '' : 'none';
    
    // Also update aria-hidden for accessibility
    element.setAttribute('aria-hidden', show ? 'false' : 'true');
  });
  
  // In simple mode, hide workbench and reports (client portfolio) pages
  if (!isAdvancedMode) {
    // Hide workbench nav button
    const workbenchNav = document.querySelector('[data-nav="workbench"]');
    if (workbenchNav) {
      workbenchNav.style.display = 'none';
      workbenchNav.setAttribute('aria-hidden', 'true');
    }
    
    // Hide reports nav button (Client Portfolio)
    const reportsNav = document.querySelector('[data-nav="reports"]');
    if (reportsNav) {
      reportsNav.style.display = 'none';
      reportsNav.setAttribute('aria-hidden', 'true');
    }
    
    // Hide workbench view
    const workbenchView = document.getElementById('view-workbench');
    if (workbenchView) {
      workbenchView.style.display = 'none';
      workbenchView.setAttribute('aria-hidden', 'true');
    }
    
    // Hide reports view
    const reportsView = document.getElementById('view-reports');
    if (reportsView) {
      reportsView.style.display = 'none';
      reportsView.setAttribute('aria-hidden', 'true');
    }
  } else {
    // Restore visibility in advanced mode
    const workbenchNav = document.querySelector('[data-nav="workbench"]');
    if (workbenchNav) {
      workbenchNav.style.display = '';
      workbenchNav.setAttribute('aria-hidden', 'false');
    }
    
    const reportsNav = document.querySelector('[data-nav="reports"]');
    if (reportsNav) {
      reportsNav.style.display = '';
      reportsNav.setAttribute('aria-hidden', 'false');
    }
    
    const workbenchView = document.getElementById('view-workbench');
    if (workbenchView) {
      workbenchView.style.display = '';
      workbenchView.setAttribute('aria-hidden', 'false');
    }
    
    const reportsView = document.getElementById('view-reports');
    if (reportsView) {
      reportsView.style.display = '';
      reportsView.setAttribute('aria-hidden', 'false');
    }
  }
  
  // Apply simple mode to modal fields
  applySimpleModeToModals();
}

/**
 * Apply simple mode styling to modals (hide non-required fields)
 */
function applySimpleModeToModals() {
  const modalFields = document.querySelectorAll('[data-simple-hide]');
  
  modalFields.forEach(field => {
    const show = isAdvancedMode;
    field.style.display = show ? '' : 'none';
    
    if (!show) {
      field.setAttribute('aria-hidden', 'true');
      // Disable inputs in hidden fields
      const inputs = field.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = true;
      });
    } else {
      field.setAttribute('aria-hidden', 'false');
      // Re-enable inputs in shown fields
      const inputs = field.querySelectorAll('input, select, textarea');
      inputs.forEach(input => {
        input.disabled = false;
      });
    }
  });
}

/**
 * Load saved preference from localStorage
 */
function loadSavedPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      isAdvancedMode = saved === 'true';
    }
  } catch (err) {
    console.warn('Failed to load advanced mode preference:', err);
  }
}

/**
 * Initialize advanced mode system
 */
export function initAdvancedMode() {
  if (initialized) return;
  initialized = true;
  
  // Load saved preference
  loadSavedPreference();
  
  // Apply initial state
  setAdvancedMode(isAdvancedMode);
  
  // Find and wire up the toggle in settings
  const toggle = document.getElementById('toggle-advanced-mode');
  if (toggle) {
    // Set initial checked state
    toggle.checked = isAdvancedMode;
    
    // Listen for changes
    toggle.addEventListener('change', (evt) => {
      setAdvancedMode(evt.target.checked);
    });
  }
  
  // Use MutationObserver to handle dynamically added advanced elements
  const observer = new MutationObserver((mutations) => {
    let needsUpdate = false;
    
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.hasAttribute?.('data-advanced')) {
            needsUpdate = true;
          }
          // Check descendants
          const descendants = node.querySelectorAll?.('[data-advanced]');
          if (descendants?.length > 0) {
            needsUpdate = true;
          }
        }
      });
    });
    
    if (needsUpdate) {
      applyAdvancedModeVisibility();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdvancedMode);
} else {
  // DOM is already ready
  setTimeout(initAdvancedMode, 0);
}
