const DEV_LOG = () => typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.DEV === true;

const state = {
  count: 0,
  owners: new Set(),
  previousOverflow: '',
  previousPaddingRight: '',
  appliedPadding: false
};

function getBody() {
  if (typeof document === 'undefined') return null;
  return document.body || document.documentElement || null;
}

function log(action, owner, extra) {
  if (!DEV_LOG()) return;
  try {
    console.debug(`[scroll-lock] ${action}`, { owner, count: state.count, owners: Array.from(state.owners), ...(extra || {}) });
  } catch (_) { }
}

function restoreStyles(body) {
  if (!body) return;
  try { body.style.overflow = state.previousOverflow; }
  catch (_) { }
  try { body.style.paddingRight = state.appliedPadding ? state.previousPaddingRight : body.style.paddingRight; }
  catch (_) { }
  if (body.dataset) {
    try { delete body.dataset.scrollLock; }
    catch (_) { }
  }
  state.appliedPadding = false;
}

function applyStyles(body) {
  if (!body) return;
  state.previousOverflow = body.style ? body.style.overflow : '';
  state.previousPaddingRight = body.style ? body.style.paddingRight : '';
  let appliedPadding = false;
  try {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) {
      body.style.paddingRight = `${gap}px`;
      appliedPadding = true;
    }
  } catch (_) { }
  if (body.style) {
    try { body.style.overflow = 'hidden'; }
    catch (_) { }
  }
  if (body.dataset) {
    try { body.dataset.scrollLock = '1'; }
    catch (_) { }
  }
  state.appliedPadding = appliedPadding;
}

function acquire(owner = 'anonymous') {
  const body = getBody();
  if (!body) return () => { };
  const key = String(owner || 'anonymous');
  if (state.count === 0) {
    applyStyles(body);
  }
  state.count += 1;
  state.owners.add(key);
  log('acquire', key);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    release(key);
  };
}

function release(owner = 'anonymous') {
  const body = getBody();
  if (!body) return;
  const key = String(owner || 'anonymous');
  if (state.count <= 0) {
    state.count = 0;
    if (DEV_LOG()) {
      try { console.warn('[scroll-lock] release with empty stack', { owner: key }); }
      catch (_) { }
    }
    return;
  }
  state.count -= 1;
  state.owners.delete(key);
  log('release', key);
  if (state.count <= 0) {
    state.count = 0;
    state.owners.clear();
    restoreStyles(body);
  }
}

function reset(owner = 'force-reset') {
  const body = getBody();
  if (!body) return;
  state.count = 0;
  state.owners.clear();
  restoreStyles(body);
  log('reset', owner);
}

export { acquire as acquireScrollLock, release as releaseScrollLock, reset as resetScrollLock };
function acquireContactScrollLock() {
  return acquire('contact-modal');
}

function releaseContactScrollLock(handle) {
  if (typeof handle === 'function') {
    try { handle(); }
    catch (_) { }
    return true;
  }
  release('contact-modal');
  return false;
}

export { acquireContactScrollLock, releaseContactScrollLock };
export default {
  acquireScrollLock: acquire,
  releaseScrollLock: release,
  resetScrollLock: reset,
  acquireContactScrollLock,
  releaseContactScrollLock
};
