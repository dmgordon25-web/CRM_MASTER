/* splash_sequence.js - Proper splash page initialization with dashboard toggles and tab cycling */

const SPLASH_SELECTOR = '#diagnostics-splash';
const BOOT_SPLASH_SELECTOR = '#boot-splash';
const TOGGLE_DELAY = 1000; // Pause 1s after each Today/All toggle
const TAB_DELAY = 700; // Time to wait for each tab to settle
const QUIET_IDLE_TIMEOUT = 900; // Max wait (ms) for idle callbacks
const QUIET_PASSES = 3;

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

function isElementVisible(node) {
  if (!node) return false;
  if (typeof node.checkVisibility === 'function') {
    try {
      return node.checkVisibility({
        visibilityProperty: 'visible',
        opacityProperty: 'visible',
        contentVisibilityAuto: true
      });
    } catch (_) {
      // Fallback to manual checks
    }
  }
  if (typeof node.offsetParent !== 'undefined' && node.offsetParent !== null) {
    return true;
  }
  if (typeof node.getBoundingClientRect === 'function') {
    const rect = node.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return true;
    }
  }
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    try {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') === 0) {
        return false;
      }
    } catch (_) {
      return false;
    }
  }
  return true;
}

function collectNavTabs() {
  if (typeof document === 'undefined') return [];
  const navRoot = document.getElementById('main-nav');
  const candidates = navRoot
    ? Array.from(navRoot.querySelectorAll('[data-nav]'))
    : Array.from(document.querySelectorAll('#main-nav [data-nav]'));
  const seen = new Set();
  const tabs = [];
  candidates.forEach((node) => {
    if (!node) return;
    const value = node.getAttribute('data-nav');
    if (!value || seen.has(value)) return;
    if (typeof node.disabled === 'boolean' && node.disabled) return;
    if (!isElementVisible(node)) return;
    seen.add(value);
    tabs.push(value);
  });
  if (!tabs.length) {
    ['dashboard', 'pipeline', 'partners', 'workbench', 'reports'].forEach((fallback) => {
      if (!seen.has(fallback)) {
        tabs.push(fallback);
        seen.add(fallback);
      }
    });
  }
  return tabs;
}

async function waitForQuietPage() {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.readyState !== 'complete') {
    await new Promise((resolve) => {
      const handler = () => {
        if (document.readyState === 'complete') {
          document.removeEventListener('readystatechange', handler);
          resolve();
        }
      };
      document.addEventListener('readystatechange', handler, { once: true });
      setTimeout(() => {
        document.removeEventListener('readystatechange', handler);
        resolve();
      }, 2000);
    });
  }
  await wait(500);
  for (let i = 0; i < QUIET_PASSES; i++) {
    if (typeof window.requestIdleCallback === 'function') {
      await new Promise((resolve) => {
        try {
          window.requestIdleCallback(() => resolve(), { timeout: QUIET_IDLE_TIMEOUT });
        } catch (_) {
          resolve();
        }
      });
    } else {
      await wait(QUIET_IDLE_TIMEOUT);
    }
  }
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
    // Wait for dashboard to be ready and reach a quiet state
    await waitForDashboard();
    await waitForQuietPage();

    // === Cycle through each available tab once ===
    const tabs = collectNavTabs();
    for (const tab of tabs) {
      const target = typeof tab === 'string' ? tab.trim() : '';
      if (!target) continue;
      if (navigateToTab(target)) {
        await wait(TAB_DELAY);
      } else {
        await wait(150);
      }
    }

    // Return to dashboard before toggles
    if (navigateToTab('dashboard')) {
      await wait(TAB_DELAY);
    }

    // Give dashboard a brief moment to settle
    await wait(400);

    // === Toggle Today/All twice each ===
    const toggleSequence = ['all', 'today', 'all', 'today'];
    for (const mode of toggleSequence) {
      toggleDashboardMode(mode);
      await wait(TOGGLE_DELAY);
    }

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
