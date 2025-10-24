import { wireAvatarBridge } from '../ui/bootstrap_features_probe.js';

let settingsAvatarRouteInitialized = false;

function ensureProfilePanelVisible(doc) {
  const settingsView = doc.getElementById('view-settings');
  if (!settingsView) return;

  const nav = doc.getElementById('settings-nav');
  if (nav) {
    const buttons = nav.querySelectorAll('button[data-panel]');
    buttons.forEach((btn) => {
      const target = btn.getAttribute('data-panel');
      const isProfile = target === 'profile';
      btn.classList.toggle('active', isProfile);
    });
  }

  const panels = settingsView.querySelectorAll('.settings-panel');
  panels.forEach((panel) => {
    const target = panel.getAttribute('data-panel');
    const isProfile = target === 'profile';
    panel.classList.toggle('active', isProfile);
    if (isProfile && panel instanceof HTMLElement) {
      panel.removeAttribute('hidden');
      panel.style.display = '';
    }
  });
}

function prepareSettingsAvatar() {
  if (typeof document === 'undefined') return;
  const doc = document;
  const settingsView = doc.getElementById('view-settings');
  if (!settingsView) return;

  settingsView.classList.remove('hidden');
  ensureProfilePanelVisible(doc);

  const input = wireAvatarBridge();
  if (!input) return;

  if (input instanceof HTMLElement) {
    input.removeAttribute('hidden');
    input.style.display = '';
  }
  const label = input.closest('label');
  if (label instanceof HTMLElement) {
    label.removeAttribute('hidden');
    label.style.display = '';
  }

  try {
    if (typeof console !== 'undefined' && typeof console.info === 'function') {
      console.info('[VIS] settings avatar input ready');
    }
  } catch (_) {}
}

export function initSettingsAvatarRoute() {
  if (settingsAvatarRouteInitialized) return;
  settingsAvatarRouteInitialized = true;
  if (typeof document === 'undefined') return;

  const doc = document;

  const runIfActive = () => {
    const settingsView = doc.getElementById('view-settings');
    if (!settingsView) return;
    if (!settingsView.classList.contains('hidden')) {
      prepareSettingsAvatar();
    }
  };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', runIfActive, { once: true });
  } else {
    runIfActive();
  }

  doc.addEventListener('app:view:changed', (event) => {
    const view = event && event.detail && event.detail.view;
    if (view === 'settings') {
      prepareSettingsAvatar();
    }
  });
}
