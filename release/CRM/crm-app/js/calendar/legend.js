import { EVENT_CATEGORIES, categoryForKey } from './constants.js';

const PREFERRED_ORDER = ['meeting', 'partner', 'followup', 'task', 'deadline', 'nurture', 'call', 'email', 'sms', 'postal'];

function resolveLegendItems() {
  const order = new Set(PREFERRED_ORDER);
  const items = [];
  order.forEach((key) => {
    const meta = categoryForKey(key);
    if (meta && !items.some((item) => item.key === meta.key)) items.push(meta);
  });
  EVENT_CATEGORIES.forEach((meta) => {
    if (!items.some((item) => item.key === meta.key)) items.push(meta);
  });
  return items;
}

function isEnabled(key, visibility) {
  if (!visibility || typeof visibility !== 'object') return true;
  return visibility[key] !== false;
}

/**
 * Renders the calendar legend into the target container.
 * @param {HTMLElement} container - The element to append the legend to.
 * @param {object} options - Visibility + toggle handler for live filtering.
 */
export function renderLegend(container, options = {}) {
  const { visibility = {}, onToggle, onReset } = options;

  if (container) {
    const existing = container.querySelector('.calendar-legend');
    if (existing) existing.remove();
  }

  const legend = document.createElement('div');
  legend.className = 'calendar-legend';
  legend.dataset.qa = 'cal-legend';

  const items = resolveLegendItems();

  items.forEach((item) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'legend-chip';
    chip.dataset.key = item.key;
    chip.dataset.type = item.type || 'other';
    chip.style.setProperty('--legend-color', `var(${item.accent}, #64748b)`);
    const enabled = isEnabled(item.key, visibility);
    chip.dataset.enabled = enabled ? '1' : '0';
    chip.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    if (!enabled) chip.classList.add('is-muted');

    const icon = document.createElement('span');
    icon.className = 'legend-icon icon';
    icon.textContent = item.icon;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    chip.appendChild(icon);
    chip.appendChild(label);

    chip.addEventListener('click', () => {
      if (typeof onToggle === 'function') {
        onToggle(item.key, !isEnabled(item.key, visibility));
      }
    });

    legend.appendChild(chip);
  });

  const hasDisabled = items.some((item) => !isEnabled(item.key, visibility));
  if (hasDisabled) {
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'legend-reset';
    reset.dataset.qa = 'cal-legend-reset';
    reset.textContent = 'Show all';
    reset.addEventListener('click', () => {
      if (typeof onReset === 'function') onReset();
    });
    legend.appendChild(reset);
  }

  if (container) {
    container.appendChild(legend);
  }

  return { node: legend, count: items.length };
}
