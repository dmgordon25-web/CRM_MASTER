/* Splash coordinator: waits for boot contracts and hides the splash exactly once */

const SPLASH_SELECTOR = '#diagnostics-splash';
const BOOT_SPLASH_SELECTOR = '#boot-splash';

// FIX: Use the global flag captured in index.html
const SKIP_ANIMATION_FLAG = (typeof window !== 'undefined' && window.__SKIP_BOOT_ANIMATION__ === true);

let splashSequenceRan = false;

function setHidden(el) {
  if (!el) return;
  try {
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
    el.style.visibility = 'hidden';
    el.style.display = 'none';
    el.setAttribute('data-state', 'hidden');
  } catch (_) {}
}

function hideBootSplash() {
  if (typeof document === 'undefined') return;
  const bootSplash = document.querySelector(BOOT_SPLASH_SELECTOR);
  if (bootSplash) {
    setHidden(bootSplash);
  }
}

function hideAllSplash() {
  if (typeof document === 'undefined') return;
  const diagnosticsSplash = document.querySelector(SPLASH_SELECTOR);
  if (diagnosticsSplash) {
    setHidden(diagnosticsSplash);
    if (diagnosticsSplash.dataset) {
      diagnosticsSplash.dataset.overlayHidden = '1';
    }
  }
  hideBootSplash();
  if (typeof window !== 'undefined') {
    try {
      window.__SPLASH_HIDDEN__ = true;
    } catch (_) {}
  }
}

function showDiagnosticsSplash() {
  if (typeof document === 'undefined') return;
  const diagnosticsSplash = document.querySelector(SPLASH_SELECTOR);
  if (!diagnosticsSplash) return;
  try {
    diagnosticsSplash.style.display = '';
    diagnosticsSplash.style.opacity = '1';
    diagnosticsSplash.style.pointerEvents = 'auto';
    diagnosticsSplash.style.visibility = 'visible';
    diagnosticsSplash.removeAttribute('hidden');
    diagnosticsSplash.setAttribute('data-state', 'visible');
  } catch (_) {}
}

function snapshotBootDone() {
  if (typeof window === 'undefined') return null;
  const value = window.__BOOT_DONE__;
  if (!value || typeof value !== 'object') return null;
  if (!('fatal' in value)) return null;
  return value;
}

function snapshotAnimationComplete() {
  if (typeof window === 'undefined') return null;
  const raw = window.__BOOT_ANIMATION_COMPLETE__;
  if (!raw) return null;
  if (raw === true) {
    return { at: Date.now(), bypassed: false };
  }
  if (typeof raw === 'object') {
    const at = Number(raw.at);
    const bypassed = raw.bypassed === true;
    return {
      at: Number.isFinite(at) ? at : Date.now(),
      bypassed
    };
  }
  return { at: Date.now(), bypassed: !!raw };
}

function isAnimationDisabled() {
  if (typeof window === 'undefined') return false;

  // FIX: Check the globally captured flag first!
  if (SKIP_ANIMATION_FLAG) return true;

  // Fallback: Check URL (in case router hasn't run yet, though unlikely)
  if (window.location && typeof window.location.search === 'string') {
    if (window.location.search.includes('skipBootAnimation')) return true;
  }

  const mode = window.__BOOT_ANIMATION_MODE__;
  if (mode && typeof mode === 'object') {
    if ('enabled' in mode) {
      return Number(mode.enabled) === 0;
    }
  }
  return false;
}

function waitForDocumentEvent(type) {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    document.addEventListener(type, (event) => resolve(event), { once: true });
  });
}

async function waitForBootDone() {
  const snapshot = snapshotBootDone();
  if (snapshot) return snapshot;
  const event = await waitForDocumentEvent('boot:done');
  if (event && event.detail) return event.detail;
  return snapshotBootDone();
}

async function waitForAnimationGate() {
  const snapshot = snapshotAnimationComplete();
  if (snapshot) return snapshot;

  if (isAnimationDisabled()) {
    // FIX: Write global state immediately so Smoke Test sees it
    const result = { at: Date.now(), bypassed: true };
    if (typeof window !== 'undefined') {
        window.__BOOT_ANIMATION_COMPLETE__ = result;
    }
    return result;
  }

  const event = await waitForDocumentEvent('boot:animation-complete');
  if (event && event.detail) {
    const detail = event.detail;
    const at = Number(detail.at);
    return {
      at: Number.isFinite(at) ? at : Date.now(),
      bypassed: detail.bypassed === true
    };
  }
  return snapshotAnimationComplete();
}

export async function runSplashSequence() {
  if (splashSequenceRan) {
    return;
  }
  splashSequenceRan = true;

  try {
    // If we are skipping, don't even wait for boot done to hide visual splash,
    // but we DO need to wait for data to be ready.
    if (SKIP_ANIMATION_FLAG) {
        // Ensure the global flag is set immediately
        window.__BOOT_ANIMATION_COMPLETE__ = { at: Date.now(), bypassed: true };
    }

    const bootDone = await waitForBootDone();
    if (!bootDone) {
      hideAllSplash();
      return;
    }

    if (bootDone.fatal) {
      showDiagnosticsSplash();
      hideBootSplash();
      if (typeof window !== 'undefined') {
        try { window.__SPLASH_HIDDEN__ = true; } catch (_) {}
      }
      return;
    }

    await waitForAnimationGate();
    hideAllSplash();
  } catch (err) {
    console.error('[SPLASH] sequence failed:', err);
    hideAllSplash();
  }
}

export function initSplashSequence() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const start = () => {
    runSplashSequence().catch((err) => {
      console.error('[SPLASH] unhandled sequence error:', err);
      hideAllSplash();
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    Promise.resolve().then(start);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  initSplashSequence();
}
