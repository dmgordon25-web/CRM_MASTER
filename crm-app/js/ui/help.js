import { helpSystem } from '../utils/help_system.js';

export function createHelpIcon(helpId, ariaLabel = 'Help') {
  if (typeof document === 'undefined' || !helpId) return null;
  const icon = document.createElement('span');
  icon.className = 'help-icon';
  icon.textContent = '?';
  icon.setAttribute('role', 'button');
  icon.setAttribute('tabindex', '0');
  icon.setAttribute('aria-label', ariaLabel);
  icon.dataset.help = helpId;
  helpSystem.attach(icon, helpId);
  return icon;
}

export function initHelp(root) {
  helpSystem.init(root);
}
