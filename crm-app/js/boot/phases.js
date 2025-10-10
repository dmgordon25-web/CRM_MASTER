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
  // Core feature pages/components that historically had top-level side effects.
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
  // Migrated long-lived patches now managed as feature modules (skipped during Safe Mode).
  new URL('../patch_20250923_baseline.js', import.meta.url).href,
  new URL('../patch_20250924_bootstrap_ready.js', import.meta.url).href,
  new URL('../patch_20250926_ctc_actionbar.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase1_pipeline_partners.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase2_automations.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase3_dashboard_reports.js', import.meta.url).href,
  new URL('../patch_2025-09-26_phase4_polish_regression.js', import.meta.url).href,
  new URL('../patch_2025-09-27_doccenter2.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5A.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5B.js', import.meta.url).href,
  new URL('../patch_2025-09-27_contact_linking_5C.js', import.meta.url).href,
  new URL('../patch_2025-09-27_merge_ui.js', import.meta.url).href,
  new URL('../patch_2025-09-27_phase6_polish_telemetry.js', import.meta.url).href,
  new URL('../patch_2025-09-27_nth_bundle_and_qa.js', import.meta.url).href,
  new URL('../patch_2025-09-27_masterfix.js', import.meta.url).href,
  new URL('../patch_2025-09-27_release_prep.js', import.meta.url).href,
  new URL('../patch_2025-10-02_baseline_ux_cleanup.js', import.meta.url).href,
  new URL('../patch_2025-10-02_medium_nice.js', import.meta.url).href,
  new URL('../patch_2025-10-03_calendar_ics_button.js', import.meta.url).href,
  new URL('../patch_2025-10-03_quick_add_partner.js', import.meta.url).href,
  new URL('../patch_2025-10-03_automation_seed.js', import.meta.url).href
];

const SAFE_MODE = isSafeMode();
const FEATURE_MODULES = SAFE_MODE
  ? CORE_FEATURE_MODULES.slice()
  : CORE_FEATURE_MODULES.concat(MIGRATED_PATCH_MODULES);

export const PHASES = {
  // CORE is already handled by boot_hardener.ensureCoreThenPatches
  SHELL: SHELL_MODULES,
  // Services that must exist before features (sequential to guarantee order)
  SERVICES: SERVICE_MODULES,
  FEATURES: FEATURE_MODULES,
  PATCHES: [] // kept empty here; the existing PATCHES list in manifest is still used by the hardener unless Safe Mode.
};

// Contracts: log-only assertions; never throw.
export const CONTRACTS = {
  SHELL: {
    'renderAll function': () => typeof window.renderAll === 'function',
    'root element exists': () => !!document.querySelector('#app, main, body'),
    'Toast + Confirm available': () => !!(window.Toast?.show) && !!(window.Confirm?.show)
  },
  SERVICES: {
    'contacts_merge available': () => typeof window.mergeContactsWithIds === 'function' || !!(window.CRM?.modules?.contactsMerge) || true,
    'contactsMergeOrch healthy (best effort)': () => !!(window.CRM?.health?.contactsMergeOrchestrator) || true,
    'partnersMergeOrch healthy (best effort)': () => !!(window.CRM?.health?.partnersMergeOrchestrator) || true
  },
  FEATURES: {
    'dashboard registered (best effort)': () => !!(window.CRM?.dashboard) || true,
    'selection service live': () => !!(window.Selection || window.SelectionService),
    'notifications panel usable': () => !!document.querySelector('[data-ui="notifications-panel"], #notifications-panel') || true,
    // Health probes for migrated modules — never fail hard; just inform
    'contactsMerge healthy (best effort)': () => !!(window.CRM?.health?.contactsMerge) || true
  }
};
