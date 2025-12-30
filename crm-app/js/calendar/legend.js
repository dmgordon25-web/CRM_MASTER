
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

  // Legend items based on the system's color coding
  // Matching crm-app/js/calendar_impl.js EVENT_CATEGORIES
  const items = [
    { label: 'Contact', icon: '👥', cssVar: '--accent-contact' },
    { label: 'Partner', icon: '🤝', cssVar: '--accent-partner' },
    { label: 'Nurture', icon: '📌', cssVar: '--accent-nurture' },
    { label: 'Task', icon: '🔔', cssVar: '--accent-task' },
    { label: 'Milestone', icon: '⭐', cssVar: '--accent-milestone' }
  ];

  items.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    // Apply color hint via CSS variable for the ::before pseudo-element
    chip.style.setProperty('--legend-color', `var(${item.cssVar}, #64748b)`);

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
