/* crm-app/js/boot/phases.js */
function isSafeMode(){
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get('safe') === '1') return true;
  } catch (_) {}
  try {
    if (window.localStorage.getItem('SAFE') === '1') return true;
  } catch (_) {}
  return false;
}

const SHELL_MODULES = [
  new URL('../ui_shims.js', import.meta.url).href,
  new URL('../ui/action_bar.js', import.meta.url).href,
  new URL('../ui/debug_overlay.js', import.meta.url).href,
  new URL('../templates.js', import.meta.url).href,
  new URL('../filters.js', import.meta.url).href,
  new URL('../render.js', import.meta.url).href
];

const SERVICE_MODULES = [
  new URL('../contacts_merge.js', import.meta.url).href,
  new URL('../contacts_merge_orchestrator.js', import.meta.url).href,
  new URL('../partners_merge_orchestrator.js', import.meta.url).href
];

const CORE_FEATURE_MODULES = [
  new URL('../dashboard/index.js', import.meta.url).href,
  new URL('../pages/workbench.js', import.meta.url).href,
  new URL('../calendar_impl.js', import.meta.url).href,
  new URL('../calendar_actions.js', import.meta.url).href,
  new URL('../calendar.js', import.meta.url).href,
  new URL('../contacts.js', import.meta.url).href,
  new URL('../partners.js', import.meta.url).href,
  new URL('../notifications.js', import.meta.url).href,
  new URL('../ui/notifications_panel.js', import.meta.url).href
];

const MIGRATED_PATCH_MODULES = [
  new URL('../patch_2025-09-26_phase1_pipeline_partners.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase2_automations.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase3_dashboard_reports.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase4_polish_regression.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5A.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5B.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5C.js', import.meta.url).href,
  new URL('../patch_2025-09-27_doccenter2.js', import.meta.url).href,
  new URL('../patch_2025-09-27_masterfix.js', import.meta.url).href,
  new URL('../patch_2025-09-27_merge_ui.js', import.meta.url).href,
  new URL('../patch_2025-09-27_nth_bundle_and_qa.js', import.meta.url).href,
  new URL('../patch_2025-09-27_phase6_polish_telemetry.js', import.meta.url).href,
  new URL('../patch_2025-09-27_release_prep.js', import.meta.url).href,
  new URL('../patch_2025-10-02_baseline_ux_cleanup.js', import.meta.url).href,
  new URL('../patch_2025-10-02_medium_nice.js', import.meta.url).href,
  new URL('../patch_2025-10-03_automation_seed.js', import.meta.url).href,
  new URL('../patch_2025-10-03_calendar_ics_button.js', import.meta.url).href,
  new URL('../patch_2025-10-03_quick_add_partner.js', import.meta.url).href,
  new URL('../patch_20250923_baseline.js', import.meta.url).href,
  new URL('../patch_20250924_bootstrap_ready.js', import.meta.url).href,
  new URL('../patch_20250926_ctc_actionbar.js', import.meta.url).href
];

function getFeatureModules(){
  const base = CORE_FEATURE_MODULES.slice();
  return isSafeMode() ? base : base.concat(MIGRATED_PATCH_MODULES);
}

export const PHASES = {
  get SHELL(){ return SHELL_MODULES.slice(); },
  get SERVICES(){ return SERVICE_MODULES.slice(); },
  get FEATURES(){ return getFeatureModules(); },
  PATCHES: []
};

const probes = {
  renderAll: () => {
    try {
      return typeof window.renderAll === 'function';
    } catch {
      return false;
    }
  },
  rootElement: () => {
    try {
      return !!document.querySelector('#app, main, body');
    } catch {
      return false;
    }
  },
  toastAndConfirm: () => {
    try {
      return !!(window.Toast?.show) && !!(window.Confirm?.show);
    } catch {
      return false;
    }
  },
  selectionService: () => {
    try {
      return !!(window.Selection || window.SelectionService);
    } catch {
      return false;
    }
  },
  notificationsPanel: () => {
    try {
      return !!document.querySelector('[data-ui="notifications-panel"], #notifications-panel');
    } catch {
      return false;
    }
  },
  contactsMerge: () => {
    try {
      return (
        typeof window.mergeContactsWithIds === 'function' ||
        !!(window.CRM?.modules?.contactsMerge)
      );
    } catch {
      return false;
    }
  },
  contactsMergeOrchestrator: () => {
    try {
      return !!(window.CRM?.health?.contactsMergeOrchestrator);
    } catch {
      return false;
    }
  },
  partnersMergeOrchestrator: () => {
    try {
      return !!(window.CRM?.health?.partnersMergeOrchestrator);
    } catch {
      return false;
    }
  },
  dashboardRegistered: () => {
    try {
      return !!window.CRM?.dashboard;
    } catch {
      return false;
    }
  },
  contactsMergeHealthy: () => {
    try {
      return !!window.CRM?.health?.contactsMerge;
    } catch {
      return false;
    }
  }
};

export const HARD_PREREQS = {
  'renderAll function': probes.renderAll,
  'root element exists': probes.rootElement
};

export const SOFT_PREREQS = {
  'selection service live': probes.selectionService,
  'notifications panel usable': probes.notificationsPanel,
  'Toast + Confirm available': probes.toastAndConfirm
};

export const CONTRACTS = {
  SHELL: {
    'renderAll function': probes.renderAll,
    'root element exists': probes.rootElement,
    'Toast + Confirm available (best effort)': probes.toastAndConfirm,
    'Selection service present (best effort)': probes.selectionService
  },
  SERVICES: {
    'contacts_merge available': probes.contactsMerge,
    'contactsMergeOrch healthy (best effort)': probes.contactsMergeOrchestrator,
    'partnersMergeOrch healthy (best effort)': probes.partnersMergeOrchestrator
  },
  FEATURES: {
    'dashboard registered (best effort)': probes.dashboardRegistered,
    'selection service live': probes.selectionService,
    'notifications panel usable': probes.notificationsPanel,
    'contactsMerge healthy (best effort)': probes.contactsMergeHealthy
  }
};

// No top-level DOM queries or immediate probe invocations; module must be side-effect free on import.
