export const HARD_PREREQS = {
  'app root present': () => {
    try {
      return !!(document.getElementById('app') || document.querySelector('[data-ui="app-root"], main'));
    } catch {
      return false;
    }
  },
};

export const SOFT_PREREQS = {
  'services registry ready': () => {
    try {
      const registry = window.SERVICES || window.CRM?.services;
      return !!(registry && registry.ready === true);
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
      const bell = document.getElementById('notif-bell') || document.querySelector('[data-ui="notifications-button"]');
      const panel = document.querySelector('#notif-panel, [data-ui="notifications-panel"], [data-role="notifications-panel"]');
      return !!(bell && panel);
    } catch {
      return false;
    }
  },
};

function whenServicesReady() {
  return new Promise((resolve) => {
    const ok = () => {
      try {
        const registry = window.SERVICES || window.CRM?.services;
        return !!(registry && registry.ready === true);
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
