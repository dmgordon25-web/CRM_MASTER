/* splash_sequence.js - Proper splash page initialization with dashboard toggles and tab cycling */

const SPLASH_SELECTOR = '#diagnostics-splash';
const BOOT_SPLASH_SELECTOR = '#boot-splash';
const TOGGLE_DELAY = 800; // Time to wait for each toggle to render
const TAB_DELAY = 600; // Time to wait for each tab to render
const FINAL_DELAY = 1200; // Final delay before hiding splash

let splashSequenceRan = false;

/**
 * Wait for a specified number of milliseconds
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Toggle between All and Today modes on the dashboard
 */
function toggleDashboardMode(mode) {
  if (typeof document === 'undefined') return false;
  
  // Try to find and click the mode button
  const modeButton = document.querySelector(`[data-dashboard-mode="${mode}"]`);
  if (modeButton && typeof modeButton.click === 'function') {
    try {
      modeButton.click();
      return true;
    } catch (err) {
      // Silently fail
    }
  }
  
  // Fallback: try to call setDashboardMode directly
  if (typeof window !== 'undefined' && typeof window.setDashboardMode === 'function') {
    try {
      window.setDashboardMode(mode, { force: true });
      return true;
    } catch (err) {
      // Silently fail
    }
  }
  
  return false;
}

/**
 * Navigate to a specific tab
 */
function navigateToTab(tabName) {
  if (typeof document === 'undefined') return false;
  
  const navButton = document.querySelector(`#main-nav button[data-nav="${tabName}"]`);
  if (navButton && typeof navButton.click === 'function') {
    try {
      navButton.click();
      return true;
    } catch (err) {
      // Silently fail
    }
  }
  
  return false;
}

/**
 * Wait for dashboard to be visible and ready
 */
async function waitForDashboard() {
  if (typeof document === 'undefined') return false;
  
  const maxAttempts = 50;
  const checkInterval = 100;
  
  for (let i = 0; i < maxAttempts; i++) {
    const dashboard = document.querySelector('main[data-ui="dashboard-root"]') || 
                     document.getElementById('dashboard-view') ||
                     document.querySelector('[data-nav="dashboard"].active');
    
    if (dashboard) {
      return true;
    }
    
    await wait(checkInterval);
  }
  
  return false;
}

/**
 * Hide the splash screen
 */
function hideSplash() {
  if (typeof document === 'undefined') return;
  
  try {
    const diagnosticsSplash = document.querySelector(SPLASH_SELECTOR);
    if (diagnosticsSplash) {
      diagnosticsSplash.style.opacity = '0';
      diagnosticsSplash.style.pointerEvents = 'none';
      diagnosticsSplash.style.visibility = 'hidden';
      diagnosticsSplash.style.display = 'none';
      diagnosticsSplash.setAttribute('data-state', 'hidden');
      if (diagnosticsSplash.dataset) {
        diagnosticsSplash.dataset.overlayHidden = '1';
      }
    }
    
    const bootSplash = document.querySelector(BOOT_SPLASH_SELECTOR);
    if (bootSplash) {
      bootSplash.style.opacity = '0';
      bootSplash.style.pointerEvents = 'none';
      bootSplash.style.visibility = 'hidden';
      bootSplash.style.display = 'none';
    }
    if (typeof window !== 'undefined') {
      try {
        window.__SPLASH_HIDDEN__ = true;
      } catch (_) {}
    }
  } catch (err) {
    // Silently fail
  }
}

/**
 * Run the full splash initialization sequence
 */
export async function runSplashSequence() {
  if (splashSequenceRan) {
    return;
  }
  
  splashSequenceRan = true;
  
  try {
    // Wait for dashboard to be ready
    await waitForDashboard();
    await wait(500); // Give dashboard time to fully render
    
    // === Toggle All/Today 2x BEFORE tab cycling ===
    
    // Toggle to "All" (1st time)
    toggleDashboardMode('all');
    await wait(TOGGLE_DELAY);
    
    // Toggle to "Today" (1st time)
    toggleDashboardMode('today');
    await wait(TOGGLE_DELAY);
    
    // Toggle to "All" (2nd time)
    toggleDashboardMode('all');
    await wait(TOGGLE_DELAY);
    
    // Toggle back to "Today" (2nd time)
    toggleDashboardMode('today');
    await wait(TOGGLE_DELAY);
    
    // === Cycle through tabs ===
    
    const tabs = ['pipeline', 'partners', 'dashboard'];
    for (const tab of tabs) {
      if (navigateToTab(tab)) {
        await wait(TAB_DELAY);
      }
    }
    
    // Return to dashboard
    navigateToTab('dashboard');
    await wait(TAB_DELAY);
    
    // === Toggle All/Today 2x AFTER tab cycling ===
    
    // Toggle to "All" (1st time after tabs)
    toggleDashboardMode('all');
    await wait(TOGGLE_DELAY);
    
    // Toggle to "Today" (1st time after tabs)
    toggleDashboardMode('today');
    await wait(TOGGLE_DELAY);
    
    // Toggle to "All" (2nd time after tabs - FINAL trigger)
    toggleDashboardMode('all');
    await wait(TOGGLE_DELAY);
    
    // Toggle back to "Today" (2nd time after tabs)
    toggleDashboardMode('today');
    await wait(FINAL_DELAY); // Extra time for final render
    
    // === Hide the splash page ===
    hideSplash();
    
  } catch (err) {
    // Hide splash anyway on error
    hideSplash();
  }
}

/**
 * Initialize and start the sequence when appropriate
 */
export function initSplashSequence() {
  if (typeof window === 'undefined') return;
  
  // Wait for boot to be done
  const bootDone = window.__BOOT_DONE__;
  if (bootDone && typeof bootDone.then === 'function') {
    bootDone.then(() => {
      // Give services time to initialize
      setTimeout(() => {
        runSplashSequence();
      }, 500);
    }).catch(err => {
      console.warn('[splash-seq] Boot failed, hiding splash', err);
      hideSplash();
    });
  } else {
    // Boot is already done or not tracked
    setTimeout(() => {
      runSplashSequence();
    }, 1000);
  }
}

// Auto-initialize if in browser environment
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSplashSequence, { once: true });
  } else {
    // DOM is already ready
    initSplashSequence();
  }
}
