const LABS_DEBUG = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('labsDebug') === '1'
  : false;

function debugLog(message, detail) {
  if (LABS_DEBUG) {
    console.debug('[labs][insight]', message, detail || '');
  }
}

function safeValue(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function describeItem(item) {
  if (!item || typeof item !== 'object') return 'Item';
  const candidates = [item.label, item.name, item.tier, item.stage, item.stageId, item.id];
  const picked = candidates.find((val) => typeof val === 'string' && val.trim());
  return picked ? String(picked).trim() : 'Item';
}

function formatDeltaValue(value, unit) {
  const rounded = Math.abs(Math.round(value * 10) / 10);
  if (!rounded) return '';
  return unit ? `${rounded}${unit}` : `${rounded}`;
}

function safeCompute(fn) {
  try {
    return fn();
  } catch (err) {
    debugLog('insight computation failed', err);
    return null;
  }
}

export function getDeltaInsight({ label = 'Metric', current, previous, unit } = {}) {
  return safeCompute(() => {
    const curr = safeValue(current);
    const prev = safeValue(previous);
    if (curr === null || prev === null) return null;
    if (prev === 0 && curr === 0) return null;

    const delta = curr - prev;
    const pctChange = prev !== 0 ? Math.abs(delta / prev) : 1;
    if (delta === 0 || pctChange < 0.05) {
      return `${label} is steady.`;
    }

    const direction = delta > 0 ? 'up' : 'down';
    const changeText = formatDeltaValue(delta, unit);
    const suffix = changeText ? ` (${changeText})` : '';
    return `${label} is ${direction} vs last period${suffix}.`;
  });
}

export function getThresholdInsight({ label = 'Value', value, warnAt, urgentAt } = {}) {
  return safeCompute(() => {
    const val = safeValue(value);
    if (val === null || val < 0) return null;

    if (val === 0) {
      return `No ${label} detected.`;
    }

    const urgentBound = safeValue(urgentAt);
    const warnBound = safeValue(warnAt);

    if (urgentBound !== null && val >= urgentBound) {
      return `${val} ${label} need attention.`;
    }

    if (warnBound !== null && val >= warnBound) {
      return `${val} ${label} to monitor.`;
    }

    return null;
  });
}

export function getTopDriverInsight({ label = 'Top driver', items, byKey, take = 1 } = {}) {
  return safeCompute(() => {
    const source = Array.isArray(items) ? items : [];
    if (!source.length) return null;

    const extractor = typeof byKey === 'function'
      ? byKey
      : (item) => (byKey ? item?.[byKey] : item?.value ?? item?.count);

    const scored = source
      .map((item) => ({ item, score: safeValue(extractor(item)) }))
      .filter((entry) => entry.score !== null && entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (!scored.length) return null;

    const top = scored.slice(0, Math.max(1, take))[0];
    const descriptor = label ? `${label}` : 'Top driver';
    const itemName = describeItem(top.item);
    return `${descriptor} is in ${itemName}.`;
  });
}
