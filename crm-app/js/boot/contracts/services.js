import { safe, capability, once } from './probe_utils.js';

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
let readyEventsHooked = false;
const registryWatchVisited = new WeakSet();

const logColdStartNotice = once('services:registry:warming', 'info');
const SERVICES_WARMING_MESSAGE = '[BOOT] services registry warming up (expected during cold start)';

const READY_EVENT_NAMES = ['crm:services-ready', 'crm:servicesRegistry:ready', 'services:ready'];
const observedRegistries = new WeakSet();

function markServicesReady() {
  servicesReadyFlagged = true;
  return true;
}

function logServicesWarming() {
  logColdStartNotice(SERVICES_WARMING_MESSAGE);
}

function queueRegistryWatch(candidate) {
  if (!candidate || typeof candidate !== 'object') return;
  if (registryWatchVisited.has(candidate)) return;
  registryWatchVisited.add(candidate);
  try {
    watchRegistryForReady(candidate);
  } catch (_) {}

  try {
    for (const key of NESTED_KEYS) {
      if (candidate && typeof candidate === 'object' && key in candidate) {
        queueRegistryWatch(candidate[key]);
      }
    }
  } catch (_) {}

  try {
    if (candidate instanceof Map) {
      for (const key of NESTED_KEYS) {
        if (candidate.has(key)) {
          queueRegistryWatch(candidate.get(key));
        }
      }
    } else if (candidate instanceof Set) {
      candidate.forEach((item) => {
        queueRegistryWatch(item);
      });
    }
  } catch (_) {}
}

function handleReadyEvent(event) {
  if (servicesReadyFlagged) return;
  try {
    const detail = event?.detail;
    if (detail && typeof detail === 'object') {
      try { queueRegistryWatch(detail); } catch (_) {}
      if ('ready' in detail && !positiveFlag(detail.ready)) return;
      if ('status' in detail && !positiveFlag(detail.status)) return;
      if ('servicesRegistry' in detail) {
        queueRegistryWatch(detail.servicesRegistry);
      }
    }
  } catch (_) {}
  markServicesReady();
}

function installReadyEventObservers() {
  if (readyEventsHooked) return;
  readyEventsHooked = true;
  try {
    const targets = [];
    try { if (typeof window !== 'undefined') targets.push(window); }
    catch (_) {}
    try { if (typeof document !== 'undefined') targets.push(document); }
    catch (_) {}
    if (!targets.length) return;
    const uniqueEvents = new Set(READY_EVENT_NAMES);
    const handler = (evt) => {
      try { handleReadyEvent(evt); }
      catch (_) {}
    };
    targets.forEach((target) => {
      if (!target || typeof target.addEventListener !== 'function') return;
      uniqueEvents.forEach((eventName) => {
        try { target.addEventListener(eventName, handler, { once: false }); }
        catch (_) {}
      });
    });
  } catch (_) {}
}

function watchRegistryForReady(registry) {
  if (!registry || typeof registry !== 'object') return;
  if (observedRegistries.has(registry)) return;
  observedRegistries.add(registry);
  const readyHandler = () => {
    try { markServicesReady(); }
    catch (_) { servicesReadyFlagged = true; }
  };
  try {
    if (typeof registry.once === 'function') {
      registry.once('ready', readyHandler);
      return;
    }
  } catch (_) {}
  try {
    if (typeof registry.on === 'function') {
      registry.on('ready', readyHandler);
      return;
    }
  } catch (_) {}
  try {
    if (typeof registry.addEventListener === 'function') {
      registry.addEventListener('ready', readyHandler, { once: true });
    }
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

function directSignalCandidates(global) {
  const crm = global.CRM || {};
  const ctx = crm.ctx || {};
  const health = crm.health || {};
  const boot = crm.boot || {};
  const bootDone = global.__BOOT_DONE__ || {};
  const bootStatus = global.__BOOT_STATUS__ || {};

  const registry = ctx.servicesRegistry
    || ctx.registry?.services
    || crm.servicesRegistry
    || crm.modules?.servicesRegistry
    || global.SERVICES;

  const directSignals = [
    ctx.servicesRegistryReady,
    ctx.servicesReady,
    boot.servicesRegistryReady,
    boot.servicesReady,
    boot.status,
    registry?.ready,
    registry?.status,
    registry?.state,
    registry?.value,
    crm.servicesRegistryReady,
    crm.servicesReady,
    crm.services?.ready,
    crm.services?.status,
    health.servicesRegistryReady,
    health.servicesReady,
    health.servicesRegistry,
    bootDone.servicesRegistry,
    bootDone.servicesRegistry?.ready,
    bootDone.services?.registry,
    bootDone.services?.registry?.ready,
    bootStatus.servicesRegistry,
    bootStatus.servicesRegistry?.ready,
    bootStatus.services,
    bootStatus.services?.ready,
    global.__SERVICES_READY__,
    global.__SERVICES_REGISTRY_READY__,
    global.SERVICES_READY,
  ];

  const searchTargets = [
    registry,
    crm.services,
    ctx.services,
    ctx.servicesRegistry,
    ctx.registry?.services,
    ctx.ready,
    ctx.ready?.services,
    ctx.ready?.servicesRegistry,
    ctx.boot,
    ctx.boot?.services,
    ctx.boot?.servicesRegistry,
    boot,
    boot.services,
    boot.servicesRegistry,
    crm.boot,
    crm.boot?.services,
    crm.boot?.servicesRegistry,
    crm.registry,
    crm.registry?.services,
    health,
    health.services,
    health.servicesRegistry,
    bootDone,
    bootDone.services,
    bootDone.servicesRegistry,
    global.__BOOT_PHASES__?.SERVICES,
    global.__BOOT_PHASES__?.services,
    global.__BOOT_PHASES__?.SERVICES?.status,
    global.__BOOT_STATUS__,
    global.__BOOT_STATUS__?.services,
    global.__BOOT_STATUS__?.servicesRegistry,
    global.__BOOT_CTX__?.services,
    global.__BOOT_CTX__?.servicesRegistry,
    global.__BOOT_CTX__?.status,
  ];

  return { directSignals, searchTargets, registry };
}

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

  queueRegistryWatch(candidate);

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
    installReadyEventObservers();
    const global = window;
    const { directSignals, searchTargets, registry } = directSignalCandidates(global);

    queueRegistryWatch(registry);

    for (const signal of directSignals) {
      if (signal && typeof signal === 'object') {
        queueRegistryWatch(signal);
      }
      if (positiveFlag(signal)) {
        return markServicesReady();
      }
      if (inspectCandidate(signal)) {
        return markServicesReady();
      }
    }

    watchRegistryForReady(registry);

    for (const candidate of searchTargets) {
      if (candidate && typeof candidate === 'object') {
        queueRegistryWatch(candidate);
      }
      if (inspectCandidate(candidate)) {
        return markServicesReady();
      }
    }
  } catch (_) {
    return servicesReadyFlagged;
  }
  return servicesReadyFlagged;
}

const servicesRegistryProbe = safe(() => {
  const ready = servicesRegistryReady();
  if (!ready) {
    logServicesWarming();
  }
  return ready;
});

const navPresentProbe = safe(() => {
  if (typeof document === 'undefined' || !document) return false;
  if (typeof document.querySelector !== 'function') return false;
  return !!document.querySelector('[data-ui="nav"], #main-nav [data-nav], [data-nav]');
});

const hasNotificationsRoute = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.routes?.notifications === 'function';
});
const hasNotificationsActivate = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.ctx?.activateRoute === 'function';
});
const hasNotificationsOpen = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.ctx?.openNotifications === 'function';
});
const hasRenderNotifications = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  return typeof global?.renderNotifications === 'function';
});

const notificationsPanelProbe = safe(() => {
  const notifier = window.Notifier;
  const hasNotifierApi = !!(notifier
    && typeof notifier.onChanged === 'function'
    && typeof notifier.list === 'function');
  if (!hasNotifierApi) return false;
  const hasRouteHook = hasNotificationsRoute()
    || hasNotificationsActivate()
    || hasNotificationsOpen();
  const renderCallable = hasRenderNotifications();
  if (renderCallable) return true;
  return hasRouteHook;
});

export const SOFT_PREREQS = {
  'services registry ready': servicesRegistryProbe,
  'nav present': navPresentProbe,
  'notifications panel usable': notificationsPanelProbe,
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
