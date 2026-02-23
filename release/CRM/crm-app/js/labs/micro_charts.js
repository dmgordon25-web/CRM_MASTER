// Lightweight micro chart helpers for Labs widgets
// All functions return DOM elements and avoid throwing

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function createInlineBar({ value = 0, max = 0, label, ariaLabel } = {}) {
  try {
    const container = document.createElement('div');
    container.className = 'labs-microbar';
    if (ariaLabel) {
      container.setAttribute('aria-label', ariaLabel);
      container.setAttribute('role', 'img');
    }

    const fill = document.createElement('div');
    fill.className = 'labs-microbar__fill';

    const safeMax = Math.max(safeNumber(max), 0);
    const safeValue = Math.max(safeNumber(value), 0);
    const percent = safeMax > 0 ? Math.min(100, (safeValue / safeMax) * 100) : 0;
    fill.style.width = `${percent}%`;

    container.appendChild(fill);

    if (label) {
      const labelEl = document.createElement('span');
      labelEl.className = 'labs-microbar__label';
      labelEl.textContent = label;
      container.appendChild(labelEl);
    }

    return container;
  } catch (err) {
    const fallback = document.createElement('span');
    fallback.className = 'labs-microbar labs-microbar--muted';
    if (label) fallback.textContent = label;
    return fallback;
  }
}

export function createDeltaBar({ current = 0, previous = 0, ariaLabel } = {}) {
  try {
    const currentVal = safeNumber(current);
    const previousVal = safeNumber(previous);
    const delta = currentVal - previousVal;

    const container = document.createElement('div');
    container.className = 'labs-delta';
    if (ariaLabel) {
      container.setAttribute('aria-label', ariaLabel);
      container.setAttribute('role', 'img');
    }

    const badge = document.createElement('span');
    badge.className = 'labs-delta__badge';
    badge.textContent = `${delta >= 0 ? '+' : ''}${Math.round(delta)}`;
    if (delta > 0) {
      badge.classList.add('is-positive');
    } else if (delta < 0) {
      badge.classList.add('is-negative');
    } else {
      badge.classList.add('is-neutral');
    }

    const barMax = Math.max(currentVal, previousVal, 1);
    const bar = createInlineBar({ value: currentVal, max: barMax });
    bar.classList.add('labs-delta__bar');

    container.appendChild(badge);
    container.appendChild(bar);

    return container;
  } catch (err) {
    const fallback = document.createElement('span');
    fallback.className = 'labs-delta';
    return fallback;
  }
}

export function createSparkline({ points = [], ariaLabel } = {}) {
  try {
    if (!Array.isArray(points) || points.length < 2) {
      const placeholder = document.createElement('span');
      placeholder.className = 'labs-sparkline labs-microbar--muted';
      placeholder.textContent = '–';
      return placeholder;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'labs-sparkline');
    svg.setAttribute('viewBox', '0 0 100 24');
    if (ariaLabel) {
      svg.setAttribute('aria-label', ariaLabel);
      svg.setAttribute('role', 'img');
    }

    const sanitized = points.map((p) => safeNumber(p));
    const min = Math.min(...sanitized);
    const max = Math.max(...sanitized);
    const range = max - min || 1;
    const step = 100 / (sanitized.length - 1);

    const path = sanitized.map((value, idx) => {
      const x = idx * step;
      const y = 24 - (((value - min) / range) * 24);
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', 'currentColor');
    pathEl.setAttribute('stroke-width', '1.5');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(pathEl);
    return svg;
  } catch (err) {
    const fallback = document.createElement('span');
    fallback.className = 'labs-sparkline';
    return fallback;
  }
}
