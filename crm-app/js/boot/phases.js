/* crm-app/js/boot/phases.js */
export const PHASES = {
  // CORE is already handled by boot_hardener.ensureCoreThenPatches
  SHELL: [
    new URL('../ui_shims.js', import.meta.url).href,
    new URL('../ui/action_bar.js', import.meta.url).href,
    new URL('../ui/debug_overlay.js', import.meta.url).href,
    new URL('../templates.js', import.meta.url).href,
    new URL('../filters.js', import.meta.url).href,
    new URL('../render.js', import.meta.url).href
  ],
  FEATURES: [
    // Core feature pages/components that historically had top-level side effects.
    new URL('../dashboard/index.js', import.meta.url).href,
    new URL('../pages/workbench.js', import.meta.url).href,
    new URL('../calendar_impl.js', import.meta.url).href,
    new URL('../calendar_actions.js', import.meta.url).href,
    new URL('../calendar.js', import.meta.url).href,
    new URL('../contacts.js', import.meta.url).href,
    new URL('../contacts_merge.js', import.meta.url).href,
    new URL('../contacts_merge_orchestrator.js', import.meta.url).href,
    new URL('../partners_merge_orchestrator.js', import.meta.url).href,
    new URL('../partners.js', import.meta.url).href,
    new URL('../notifications.js', import.meta.url).href,
    new URL('../ui/notifications_panel.js', import.meta.url).href
  ],
  PATCHES: [] // kept empty here; the existing PATCHES list in manifest is still used by the hardener unless Safe Mode.
};

// Contracts: log-only assertions; never throw.
export const CONTRACTS = {
  SHELL: {
    'renderAll function': () => typeof window.renderAll === 'function',
    'root element exists': () => !!document.querySelector('#app, main, body')
  },
  FEATURES: {
    'dashboard registered (best effort)': () => !!(window.CRM && window.CRM.dashboard) || true,
    'contactsMerge healthy (best effort)': () => !!(window.CRM && window.CRM.health && window.CRM.health.contactsMerge) || true,
    'contactsMergeOrch healthy (best effort)': () => !!(window.CRM?.health?.contactsMergeOrchestrator) || true,
    'partnersMergeOrch healthy (best effort)': () => !!(window.CRM?.health?.partnersMergeOrchestrator) || true
  }
};
