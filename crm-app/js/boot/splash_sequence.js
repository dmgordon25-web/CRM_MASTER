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
      console.info(`[splash-seq] Toggled dashboard to ${mode} mode`);
      return true;
    } catch (err) {
      console.warn('[splash-seq] Failed to click mode button', err);
    }
  }
  
  // Fallback: try to call setDashboardMode directly
  if (typeof window !== 'undefined' && typeof window.setDashboardMode === 'function') {
    try {
      window.setDashboardMode(mode, { force: true });
      console.info(`[splash-seq] Set dashboard to ${mode} mode via function`);
      return true;
    } catch (err) {
      console.warn('[splash-seq] Failed to set mode via function', err);
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
      console.info(`[splash-seq] Navigated to ${tabName} tab`);
      return true;
    } catch (err) {
      console.warn('[splash-seq] Failed to navigate to tab', tabName, err);
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
      console.info('[splash-seq] Dashboard is ready');
      return true;
    }
    
    await wait(checkInterval);
  }
  
  console.warn('[splash-seq] Dashboard did not become ready within timeout');
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
      console.info('[splash-seq] Diagnostics splash hidden');
    }
    
    const bootSplash = document.querySelector(BOOT_SPLASH_SELECTOR);
    if (bootSplash) {
      bootSplash.style.opacity = '0';
      bootSplash.style.pointerEvents = 'none';
      bootSplash.style.visibility = 'hidden';
      bootSplash.style.display = 'none';
      console.info('[splash-seq] Boot splash hidden');
    }
  } catch (err) {
    console.warn('[splash-seq] Error hiding splash', err);
  }
}

/**
 * Run the full splash initialization sequence
 */
export async function runSplashSequence() {
  if (splashSequenceRan) {
    console.info('[splash-seq] Sequence already ran, skipping');
    return;
  }
  
  splashSequenceRan = true;
  console.info('[splash-seq] Starting initialization sequence');
  
  try {
    // Wait for dashboard to be ready
    await waitForDashboard();
    await wait(500); // Give dashboard time to fully render
    
    // === Toggle All/Today 2x BEFORE tab cycling ===
    console.info('[splash-seq] Phase 1: Toggle All/Today (2x before tabs)');
    
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
    console.info('[splash-seq] Phase 2: Cycling through tabs');
    
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
    console.info('[splash-seq] Phase 3: Toggle All/Today (2x after tabs)');
    
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
    console.info('[splash-seq] Phase 4: Hiding splash page');
    hideSplash();
    
    console.info('[splash-seq] Initialization sequence complete');
    
  } catch (err) {
    console.error('[splash-seq] Sequence failed', err);
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
