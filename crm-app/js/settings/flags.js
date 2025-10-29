const DEFAULT_FLAGS = Object.freeze({
  notificationsMVP: false
});

function toObject(value) {
  if (!value || typeof value !== 'object') return {};
  return value;
}

function applyToContext(flags) {
  if (typeof window === 'undefined') return;
  window.CRM = window.CRM || {};
  window.CRM.ctx = window.CRM.ctx || {};
  const ctx = window.CRM.ctx;
  if (!ctx.featureFlags || typeof ctx.featureFlags !== 'object') {
    ctx.featureFlags = { ...flags };
    return;
  }
  ctx.featureFlags = { ...flags, ...ctx.featureFlags };
}

export const flags = (() => {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_FLAGS };
  }
  const base = toObject(window.__FEATURES__);
  const merged = { ...DEFAULT_FLAGS, ...base };
  window.__FEATURES__ = merged;
  applyToContext(merged);
  return merged;
})();

export function isFeatureEnabled(name) {
  if (!name) return false;
  const key = String(name);
  return Boolean(flags && flags[key] === true);
}

function applyFeatureVisibility(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return;
  const nodes = doc.querySelectorAll('[data-feature]');
  nodes.forEach((node) => {
    if (!node || typeof node.getAttribute !== 'function') return;
    const featureKey = node.getAttribute('data-feature');
    if (!featureKey) return;
    const enabled = isFeatureEnabled(featureKey);
    const mode = node.getAttribute('data-feature-mode') || node.dataset?.featureMode || '';
    if (enabled) {
      if (mode === 'hidden') node.hidden = false;
      if (mode !== 'remove') node.removeAttribute('data-feature-disabled');
      return;
    }
    if (mode === 'remove') {
      node.remove();
      return;
    }
    if (mode === 'hidden') {
      node.hidden = true;
      return;
    }
    node.setAttribute('data-feature-disabled', '1');
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyFeatureVisibility(document), { once: true });
  } else {
    applyFeatureVisibility(document);
  }
}

export { applyFeatureVisibility };
