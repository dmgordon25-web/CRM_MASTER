const SPLASH_SELECTOR = '#diagnostics-splash';
const BOOT_SPLASH_SELECTOR = '#boot-splash';

function hideAllSplash() {
  if (typeof document === 'undefined') return;
  const bootSplash = document.querySelector(BOOT_SPLASH_SELECTOR);
  const diagnostics = document.querySelector(SPLASH_SELECTOR);
  if(bootSplash) bootSplash.style.display = 'none';
  if(diagnostics) diagnostics.style.display = 'none';

  if (typeof window !== 'undefined') {
    window.__SPLASH_HIDDEN__ = true;
    // Use global flag captured in index.html
    const skipped = window.__SKIP_BOOT_ANIMATION__ === true;
    window.__BOOT_ANIMATION_COMPLETE__ = { at: Date.now(), bypassed: skipped || true };
  }
}
hideAllSplash();
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideAllSplash);
    else setTimeout(hideAllSplash, 0);
}
export function runSplashSequence() { hideAllSplash(); return Promise.resolve(); }
export function initSplashSequence() { hideAllSplash(); }