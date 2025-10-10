export const CORE_PREREQS = {
  'nav present': () => {
    try {
      return !!document.querySelector('[data-ui="nav"], #nav');
    } catch {
      return false;
    }
  },
  'services registry ready': () => {
    try {
      const registry = window.SERVICES || window.CRM?.services;
      return !!(registry && registry.ready === true);
    } catch {
      return false;
    }
  }
};
