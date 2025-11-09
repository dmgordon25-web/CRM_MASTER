const SVG_NS = 'http://www.w3.org/2000/svg';

function clamp(value, min, max){
  return Math.min(Math.max(value, min), max);
}

export function renderSparkline(container, values, options = {}){
  if(!container || typeof document === 'undefined') return null;
  const series = Array.isArray(values) && values.length ? values.map((value) => Number(value)) : [0];
  const validSeries = series.map((value) => (Number.isFinite(value) ? value : 0));
  const min = Math.min(...validSeries);
  const max = Math.max(...validSeries);
  const range = max - min || 1;
  const spacing = options.spacing || 12;
  const viewHeight = options.height || 48;
  const offsetX = 4;
  const offsetY = 4;
  const viewWidth = Math.max((validSeries.length - 1) * spacing + offsetX * 2, 60);

  const coords = validSeries.map((value, index) => {
    const normalized = (value - min) / range;
    const x = offsetX + index * spacing;
    const y = (viewHeight - offsetY) - normalized * (viewHeight - offsetY * 2);
    return { x, y };
  });

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(viewHeight));
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.classList.add('labs-sparkline');

  const areaPath = document.createElementNS(SVG_NS, 'path');
  let pathD = `M ${coords[0].x} ${viewHeight - offsetY}`;
  coords.forEach(({ x, y }) => {
    pathD += ` L ${x} ${y}`;
  });
  pathD += ` L ${coords[coords.length - 1].x} ${viewHeight - offsetY} Z`;
  areaPath.setAttribute('d', pathD);
  areaPath.setAttribute('fill', options.fill || 'rgba(37,99,235,0.16)');
  areaPath.setAttribute('stroke', 'none');
  svg.appendChild(areaPath);

  const polyline = document.createElementNS(SVG_NS, 'polyline');
  const pointString = coords.map(({ x, y }) => `${x},${y}`).join(' ');
  polyline.setAttribute('points', pointString);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', options.stroke || '#2563eb');
  polyline.setAttribute('stroke-width', '2');
  svg.appendChild(polyline);

  if(Number.isFinite(options.baseline)){
    const ratio = clamp((Number(options.baseline) - min) / range, 0, 1);
    const baselineY = (viewHeight - offsetY) - ratio * (viewHeight - offsetY * 2);
    const baselineLine = document.createElementNS(SVG_NS, 'line');
    baselineLine.setAttribute('x1', String(coords[0].x));
    baselineLine.setAttribute('x2', String(coords[coords.length - 1].x));
    baselineLine.setAttribute('y1', String(baselineY));
    baselineLine.setAttribute('y2', String(baselineY));
    baselineLine.setAttribute('stroke', options.baselineStroke || '#94a3b8');
    baselineLine.setAttribute('stroke-width', '1');
    baselineLine.setAttribute('stroke-dasharray', '4 4');
    svg.appendChild(baselineLine);
  }

  container.innerHTML = '';
  container.appendChild(svg);
  container.classList.add('labs-sparkline-host');
  if(options.qa){
    container.dataset.qa = options.qa;
  }
  if(options.label){
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', options.label);
  }else{
    svg.setAttribute('role', 'presentation');
    svg.setAttribute('aria-hidden', 'true');
  }
  return svg;
}

export function formatDelta(current, baseline){
  const currentValue = Number(current) || 0;
  const baselineValue = Number(baseline) || 0;
  const diff = currentValue - baselineValue;
  const safeBaseline = baselineValue === 0 ? (diff === 0 ? 1 : Math.abs(diff)) : baselineValue;
  const percent = (diff / safeBaseline) * 100;
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const label = `${diff >= 0 ? '+' : '-'}${Math.abs(percent).toFixed(1)}%`;
  return { diff, percent, direction, label };
}

export function describeTrend(values){
  if(!Array.isArray(values) || values.length < 2) return 'flat';
  const first = Number(values[0]) || 0;
  const last = Number(values[values.length - 1]) || 0;
  const diff = last - first;
  const tolerance = Math.max(Math.abs(first) * 0.02, 0.5);
  if(diff > tolerance) return 'improving';
  if(diff < -tolerance) return 'regressing';
  return 'flat';
}

export default {
  renderSparkline,
  formatDelta,
  describeTrend
};
