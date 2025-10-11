export const HARD_PREREQS = {
  'app root present': () => {
    try {
      return !!(document.getElementById('app') || document.querySelector('[data-ui="app-root"], main'));
    } catch {
      return false;
    }
  },
};

function servicesRegistryReady(){
  try {
    const global = window;
    const crm = global.CRM || {};
    const registry = global.SERVICES
      || crm.services
      || crm.ctx?.services;

    const readyFlag = (value) => {
      if (value === true) return true;
      if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized === 'ready' || normalized === 'ok' || normalized === 'complete';
      }
      return false;
    };

    if (registry) {
      if (readyFlag(registry.ready)) return true;
      if (readyFlag(registry.status)) return true;
      if (readyFlag(registry.state)) return true;
      if (readyFlag(registry.readyState)) return true;
      if (typeof registry.isReady === 'function') {
        try {
          if (registry.isReady() === true) return true;
        } catch (_) {}
      }
    }

    if (readyFlag(global.__SERVICES_READY__)) return true;
    if (readyFlag(global.SERVICES_READY)) return true;
    if (readyFlag(crm.servicesReady)) return true;
    if (crm.servicesReady && typeof crm.servicesReady === 'object') {
      if (readyFlag(crm.servicesReady.ready)) return true;
      if (readyFlag(crm.servicesReady.status)) return true;
      if (readyFlag(crm.servicesReady.state)) return true;
    }
    if (typeof crm.servicesReady === 'function') {
      try {
        if (crm.servicesReady() === true) return true;
      } catch (_) {}
    }

    const health = crm.health || {};
    if (readyFlag(health.servicesRegistry)) return true;
    if (readyFlag(health.servicesRegistryReady)) return true;
    if (readyFlag(health.services)) return true;
    if (readyFlag(health.servicesReady)) return true;
    const registryHealth = health.servicesRegistry;
    if (registryHealth && typeof registryHealth === 'object') {
      if (readyFlag(registryHealth.ready)) return true;
      if (readyFlag(registryHealth.status)) return true;
      if (readyFlag(registryHealth.state)) return true;
    }

    return false;
  } catch {
    return false;
  }
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
