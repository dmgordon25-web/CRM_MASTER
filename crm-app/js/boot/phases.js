/* crm-app/js/boot/phases.js */
import { safe, capability } from './contracts/probe_utils.js';

// SOFT probe pattern:
// const exampleCapability = capability('Namespace.feature');
// const exampleProbe = safe(() => exampleCapability());
// SOFT_PREREQS['feature ready'] = exampleProbe;
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
  new URL('../debug/overlay.js', import.meta.url).href,
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

const toastCandidates = [capability('Toast.show'), capability('toast')];
const confirmCandidates = [capability('Confirm.show'), capability('confirmAction'), capability('showConfirm')];
const notifierExists = capability('Notifier');
const notificationsRouteCallable = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.routes?.notifications === 'function';
});
const notificationsActivateCallable = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.ctx?.activateRoute === 'function';
});
const notificationsOpenCallable = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  const crm = global?.CRM;
  return typeof crm?.ctx?.openNotifications === 'function';
});
const renderNotificationsCallable = safe(() => {
  const global = typeof globalThis !== 'undefined' ? globalThis : window;
  return typeof global?.renderNotifications === 'function';
});
const selectionServiceCapability = capability('SelectionService');
const mergeContactsCapability = capability('CRM.modules.contactsMerge');
const mergeContactsFnCapability = capability('mergeContactsWithIds');
const contactsMergeHealthCapability = capability('CRM.health.contactsMerge');
const contactsMergeOrchCapability = capability('CRM.health.contactsMergeOrchestrator');
const partnersMergeOrchCapability = capability('CRM.health.partnersMergeOrchestrator');
const dashboardCapability = capability('CRM.dashboard');

const renderAllProbe = safe(() => typeof window.renderAll === 'function');
const rootElementProbe = safe(() => {
  if (typeof document === 'undefined' || !document) return false;
  if (typeof document.querySelector !== 'function') return false;
  return !!document.querySelector('#app, main, body');
});
const toastAndConfirmProbe = safe(() => {
  const hasToastCandidate = toastCandidates.some((probe) => probe());
  const hasConfirmCandidate = confirmCandidates.some((probe) => probe());
  if (!hasToastCandidate || !hasConfirmCandidate) return false;
  const toastFn = typeof window.Toast?.show === 'function' ? window.Toast.show : window.toast;
  const confirmFn = typeof window.Confirm?.show === 'function'
    ? window.Confirm.show
    : (typeof window.confirmAction === 'function'
      ? window.confirmAction
      : window.showConfirm);
  return typeof toastFn === 'function' && typeof confirmFn === 'function';
});
const selectionServiceProbe = safe(() => {
  if (selectionServiceCapability()) return true;
  const service = window.SelectionService;
  if (service && (typeof service.getIds === 'function' || typeof service.count === 'function')) {
    return true;
  }
  return !!window.Selection;
});
const notificationsPanelProbe = safe(() => {
  if (!notifierExists()) return false;
  const notifier = window.Notifier;
  const hasNotifierApi = notifier
    && typeof notifier.onChanged === 'function'
    && typeof notifier.list === 'function';
  if (!hasNotifierApi) return false;
  const hasRouteHook = notificationsRouteCallable()
    || notificationsActivateCallable()
    || notificationsOpenCallable();
  return renderNotificationsCallable() || hasRouteHook;
});
const contactsMergeProbe = safe(() => mergeContactsFnCapability() || mergeContactsCapability());

const probes = {
  renderAll: renderAllProbe,
  rootElement: rootElementProbe,
  toastAndConfirm: toastAndConfirmProbe,
  selectionService: selectionServiceProbe,
  notificationsPanel: notificationsPanelProbe,
  contactsMerge: contactsMergeProbe,
  contactsMergeOrchestrator: contactsMergeOrchCapability,
  partnersMergeOrchestrator: partnersMergeOrchCapability,
  dashboardRegistered: dashboardCapability,
  contactsMergeHealthy: contactsMergeHealthCapability
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
