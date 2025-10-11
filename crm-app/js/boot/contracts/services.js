export const HARD_PREREQS = {
  'app root present': () => {
    try {
      return !!(document.getElementById('app') || document.querySelector('[data-ui="app-root"], main'));
    } catch {
      return false;
    }
  },
};

const POSITIVE_TOKENS = new Set([
  '1', 'true', 'yes', 'y', 'ready', 'ok', 'okay', 'done', 'complete', 'completed', 'healthy', 'health', 'online',
  'available', 'up', 'active', 'running', 'passing', 'pass', 'passed', 'green', 'success', 'succeeded', 'enabled',
  'live', 'stable', 'good'
]);

let servicesReadyFlagged = false;
let coldStartNoticeLogged = false;
let coldStartClearedLogged = false;

function markServicesReady() {
  servicesReadyFlagged = true;
  if (coldStartNoticeLogged && !coldStartClearedLogged) {
    coldStartClearedLogged = true;
    try {
      console.info('[BOOT] services registry ready (cold start complete)');
    } catch (_) {}
  }
  return true;
}

function logServicesWarming() {
  if (coldStartNoticeLogged) return;
  coldStartNoticeLogged = true;
  try {
    console.info('[BOOT] services registry warming up (expected during cold start)');
  } catch (_) {}
}

function positiveFlag(value) {
  if (value === true) return true;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (POSITIVE_TOKENS.has(normalized)) return true;
  }
  return false;
}

const READINESS_KEYS = ['ready', 'status', 'state', 'readyState', 'value', 'result', 'ok', 'health'];
const NESTED_KEYS = ['servicesRegistry', 'services', 'registry', 'service', 'module', 'payload', 'meta'];

function inspectCandidate(candidate, visited = new Set()) {
  if (servicesReadyFlagged) return true;
  if (candidate == null) return false;

  if (positiveFlag(candidate)) return true;

  if (typeof candidate === 'function') {
    try {
      const result = candidate();
      if (inspectCandidate(result, visited)) return true;
    } catch (_) {}
    return false;
  }

  if (typeof candidate !== 'object') return false;
  if (visited.has(candidate)) return false;
  visited.add(candidate);

  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      if (inspectCandidate(item, visited)) return true;
    }
  }

  if (candidate instanceof Map) {
    for (const key of READINESS_KEYS.concat(NESTED_KEYS)) {
      if (candidate.has(key) && inspectCandidate(candidate.get(key), visited)) return true;
    }
  }

  if (candidate instanceof Set) {
    for (const item of candidate) {
      if (inspectCandidate(item, visited)) return true;
    }
  }

  for (const key of READINESS_KEYS) {
    if (key in candidate) {
      const value = candidate[key];
      if (positiveFlag(value)) return true;
      if (inspectCandidate(value, visited)) return true;
    }
  }

  if ('isReady' in candidate && typeof candidate.isReady === 'function') {
    try {
      const result = candidate.isReady();
      if (inspectCandidate(result, visited)) return true;
    } catch (_) {}
  }

  if ('ready' in candidate && typeof candidate.ready === 'function') {
    try {
      const result = candidate.ready();
      if (inspectCandidate(result, visited)) return true;
    } catch (_) {}
  }

  if ('getStatus' in candidate && typeof candidate.getStatus === 'function') {
    try {
      const result = candidate.getStatus();
      if (inspectCandidate(result, visited)) return true;
    } catch (_) {}
  }

  for (const key of NESTED_KEYS) {
    if (key in candidate) {
      if (inspectCandidate(candidate[key], visited)) return true;
    }
  }

  return false;
}

function servicesRegistryReady(){
  if (servicesReadyFlagged) return true;
  try {
    const global = window;
    const crm = global.CRM || {};
    const ctx = crm.ctx || {};
    const health = crm.health || {};

    const registry = global.SERVICES
      || crm.services
      || ctx.services
      || ctx.servicesRegistry
      || ctx.registry?.services
      || crm.servicesRegistry;

    const candidates = [
      registry,
      ctx.servicesRegistryReady,
      ctx.servicesReady,
      ctx.ready,
      ctx.ready?.services,
      ctx.ready?.servicesRegistry,
      ctx.boot?.services,
      ctx.boot?.servicesRegistry,
      ctx.boot?.status,
      crm.boot,
      crm.boot?.services,
      crm.boot?.servicesRegistry,
      crm.boot?.status,
      crm.servicesReady,
      crm.servicesRegistryReady,
      crm.registry,
      crm.registry?.services,
      crm.modules?.servicesRegistry,
      health,
      health.services,
      health.servicesRegistry,
      health.servicesRegistryReady,
      health.servicesReady,
      global.__SERVICES__,
      global.__SERVICES_READY__,
      global.__SERVICES_REGISTRY_READY__,
      global.SERVICES_READY,
      global.__BOOT_DONE__?.servicesRegistry,
      global.__BOOT_DONE__?.services?.registry,
      global.__BOOT_PHASES__?.SERVICES,
      global.__BOOT_PHASES__?.services,
      global.__BOOT_PHASES__?.SERVICES?.status,
      global.__BOOT_STATUS__?.services,
      global.__BOOT_STATUS__?.servicesRegistry,
      global.__BOOT_STATUS__?.registry,
      global.__BOOT_CTX__?.services,
      global.__BOOT_CTX__?.servicesRegistry,
      global.__BOOT_CTX__?.status,
    ];

    for (const candidate of candidates) {
      if (inspectCandidate(candidate)) {
        return markServicesReady();
      }
    }
  } catch (_) {
    return servicesReadyFlagged;
  }
  return servicesReadyFlagged;
}

export const SOFT_PREREQS = {
  'services registry ready': () => {
    try {
      return servicesRegistryReady();
    } catch {
      return false;
    }
  },
  'nav present': () => {
    try {
      return !!document.querySelector('[data-ui="nav"], #main-nav [data-nav], [data-nav]');
    } catch {
      return false;
    }
  },
  'notifications panel usable': () => {
    try {
      const notifier = window.Notifier;
      const hasNotifierApi = !!(notifier
        && typeof notifier.onChanged === 'function'
        && typeof notifier.list === 'function');
      const hasRenderer = typeof window.renderNotifications === 'function';
      const hasRouteHook = typeof window.CRM?.routes?.notifications === 'function'
        || typeof window.CRM?.ctx?.activateRoute === 'function'
        || typeof window.CRM?.ctx?.openNotifications === 'function';
      return !!((hasRenderer || hasRouteHook) && hasNotifierApi);
    } catch {
      return false;
    }
  },
};

function whenServicesReady() {
  return new Promise((resolve) => {
    const ok = () => {
      try {
        return servicesRegistryReady();
      } catch {
        return false;
      }
    };
    if (ok()) return resolve(true);
    logServicesWarming();
    let ticks = 0;
    const t = setInterval(() => {
      if (ok()) {
        clearInterval(t);
        resolve(true);
        return;
      }
      ticks += 1;
      if (ticks > 160) {
        clearInterval(t);
        resolve(false);
      }
    }, 25);
  });
}

export const __WHEN_SERVICES_READY = whenServicesReady;
