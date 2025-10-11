const onceRegistry = new Map();

function toConsoleMethod(level) {
  const allowed = ['info', 'warn', 'log'];
  if (typeof level !== 'string') return 'info';
  const normalized = level.toLowerCase();
  return allowed.includes(normalized) ? normalized : 'info';
}

export function safe(fn) {
  if (typeof fn !== 'function') {
    return () => false;
  }
  return () => {
    try {
      return !!fn();
    } catch (_) {
      return false;
    }
  };
}

export function capability(path) {
  const segments = typeof path === 'string'
    ? path.split('.').map((part) => part.trim()).filter(Boolean)
    : [];
  if (!segments.length) {
    return () => false;
  }
  return safe(() => {
    let ctx = typeof globalThis !== 'undefined' ? globalThis : window;
    for (const segment of segments) {
      if (segment === 'window' && ctx?.window) {
        ctx = ctx.window;
        continue;
      }
      if (ctx == null) {
        return false;
      }
      ctx = ctx[segment];
    }
    return ctx !== undefined && ctx !== null;
  });
}

export function once(tag, level = 'info') {
  const key = String(tag || '');
  const method = toConsoleMethod(level);
  return (...args) => {
    if (!key || onceRegistry.has(key)) return;
    onceRegistry.set(key, true);
    try {
      const logger = (typeof console !== 'undefined' && console)
        ? (console[method] || console.log)
        : null;
      if (typeof logger === 'function') {
        logger.apply(console, args);
      }
    } catch (_) {}
  };
}
