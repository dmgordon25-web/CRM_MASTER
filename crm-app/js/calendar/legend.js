
import { EVENT_CATEGORIES } from './constants.js';

/**
 * Renders the calendar legend into the target container.
 * @param {HTMLElement} container - The element to append the legend to.
 */
export function renderLegend(container) {
  // If container is provided, clean up existing legend
  if (container) {
    const existing = container.querySelector('.calendar-legend');
    if (existing) {
      existing.remove();
    }
  }

  const legend = document.createElement('div');
  legend.className = 'calendar-legend';

  // Define precedence or specific items we want to show in the legend
  // We want to show distinct kinds. Multimapped icons (like phone/email/sms -> task color) 
  // might be grouped? 
  // Request says: "Legend icon must exactly match what appears in month cells."
  // So we should iterate the CATEGORIES, but maybe filter out some redundant ones if they map to same visual?
  // Actually, the user wants "Parity". If "Call" shows a phone 📞, then legend should probably have "Call"?
  // Or does "Call" show as "Task" ✅? 
  // Looking at constants:
  // Call -> 📞
  // Task -> ✅
  // Follow-up -> 🔔
  // So they ARE distinct icons. We should probably show them all, or at least the major ones used in the app.
  // The 'seed' data uses: 'task' (✅), 'nurture' (📌), 'partner' (🤝), 'milestone' (⭐), 'follow-up' (🔔).
  // Also 'contact'/'meeting' (👥).
  // Let's filter to the ones that are semantically top-level or common.

  const WANTED_KEYS = new Set(['task', 'nurture', 'partner', 'deadline', 'meeting', 'followup']);

  // Map 'deadline' to 'Milestone' label if needed, or rely on constant label

  const items = EVENT_CATEGORIES.filter(c => WANTED_KEYS.has(c.key));

  items.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    // Apply color hint via CSS variable for the ::before pseudo-element
    chip.style.setProperty('--legend-color', `var(${item.accent}, #64748b)`);

    // Icon
    const icon = document.createElement('span');
    icon.className = 'legend-icon';
    icon.textContent = item.icon;

    // Label
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    chip.appendChild(icon);
    chip.appendChild(label);
    legend.appendChild(chip);
  });

  if (container) {
    container.appendChild(legend);
  }

  // Return info for debug/testing
  return { node: legend, count: items.length };
}
