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
