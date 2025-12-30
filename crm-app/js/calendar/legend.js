
/**
 * Renders the calendar legend into the target container.
 * @param {HTMLElement} container - The element to append the legend to.
 */
export function renderLegend(container) {
  if (!container) return;
  
  // Clean up existing legend if present to avoid dupes
  const existing = container.querySelector('.calendar-legend');
  if (existing) {
    existing.remove();
  }

  const legend = document.createElement('div');
  legend.className = 'calendar-legend';

  // Legend items based on the system's color coding
  // Matching crm-app/js/calendar_impl.js EVENT_CATEGORIES
  const items = [
    { label: 'Contact', icon: '👥', cssVar: '--accent-contact' },
    { label: 'Partner', icon: '🤝', cssVar: '--accent-partner' },
    { label: 'Task', icon: '🔔', cssVar: '--accent-task' },
    { label: 'Milestone', icon: '⭐', cssVar: '--accent-milestone' }
  ];

  items.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    
    const icon = document.createElement('span');
    icon.className = 'legend-icon';
    icon.textContent = item.icon;
    
    // We use a small dot or background to show the color
    // But the requirements ask for "icon + swatch + label" or similar
    // The calendar events usually have a left border or specific background.
    // We'll mimic a "chip" look.
    
    const label = document.createElement('span');
    label.className = 'legend-label';
    label.textContent = item.label;

    // Apply color hint
    // We can set a style on the chip to use the CSS variable
    chip.style.setProperty('--legend-color', `var(${item.cssVar}, #64748b)`);

    chip.appendChild(icon);
    chip.appendChild(label);
    legend.appendChild(chip);
  });

  container.appendChild(legend);
}
