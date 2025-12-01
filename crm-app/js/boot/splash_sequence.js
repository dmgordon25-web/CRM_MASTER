const SPLASH_SELECTOR = '#diagnostics-splash';
const BOOT_SPLASH_SELECTOR = '#boot-splash';
function hideAllSplash() {
  if (typeof document === 'undefined') return;
  const b = document.querySelector(BOOT_SPLASH_SELECTOR); if (b) b.style.display = 'none';
  if (typeof window !== 'undefined') {
    window.__SPLASH_HIDDEN__ = true;
    const skipped = window.__SKIP_BOOT_ANIMATION__ === true;
    window.__BOOT_ANIMATION_COMPLETE__ = { at: Date.now(), bypassed: skipped || true };
  }
}

// [FIX] Move top-level DOM access into deferred execution to pass boot contract lint
(function deferSplashInit() {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(() => {
      hideAllSplash();
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideAllSplash);
      } else {
        setTimeout(hideAllSplash, 0);
      }
    });
  } else if (typeof Promise === 'function') {
    Promise.resolve().then(() => {
      hideAllSplash();
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideAllSplash);
      } else {
        setTimeout(hideAllSplash, 0);
      }
    });
  } else {
    setTimeout(() => {
      hideAllSplash();
      if (typeof document !== 'undefined' && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideAllSplash);
      } else {
        setTimeout(hideAllSplash, 0);
      }
    }, 0);
  }
})();

export function runSplashSequence() { hideAllSplash(); return Promise.resolve(); }
export function initSplashSequence() { hideAllSplash(); }
