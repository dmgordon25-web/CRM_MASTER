import "../env.js";

export const CORE = [
  '../env.js',
  '../db.js',
  '../core/renderGuard.js',
  '../services/selection.js',
  '../utils.js',
  '../render.js',
  '../db_compat.js',
  '../ui/Toast.js',
  '../ui/Confirm.js',
  '../data/settings.js',
  '../ical.js',
  '../migrations.js',
  '../presets.js',
  '../filters.js',
  '../ui_shims.js',
  '../templates.js',
  '../state/selectionStore.js',
  '../state/actionBarGuards.js',
  '../header_ui.js',
  '../ui/notifications_panel.js',
  '../add_contact.js',
  '../quick_add.js',
  '../doccenter_rules.js',
  '../contacts.js',
  '../partners.js',
  '../partners_modal.js',
  '../contacts_merge.js',
  '../dash_range.js',
  '../importer.js',
  '../reports.js',
  '../commissions.js',
  '../notifications.js',
  '../calendar_impl.js',
  '../calendar.js',
  '../calendar_ics.js',
  '../calendar_actions.js',
  '../post_funding.js',
  '../qa.js',
  '../bulk_log.js',
  '../print.js',
  '../app.js',
  '../settings_forms.js',
  '../services/pipelineStages.js',
  '../services/softDelete.js'
];

export const PATCHES = [
  '../patch_20250923_baseline.js',
  '../patch_20250924_bootstrap_ready.js',
  '../patch_20250926_ctc_actionbar.js',
  '../patch_2025-09-26_phase1_pipeline_partners.js',
  '../patch_2025-09-26_phase2_automations.js',
  '../patch_2025-09-26_phase3_dashboard_reports.js',
  '../patch_2025-09-26_phase4_polish_regression.js',
  '../patch_2025-09-27_doccenter2.js',
  '../patch_2025-09-27_contact_linking_5A.js',
  '../patch_2025-09-27_contact_linking_5B.js',
  '../patch_2025-09-27_contact_linking_5C.js',
  '../patch_2025-09-27_nth_bundle_and_qa.js',
  '../patch_2025-09-27_masterfix.js',
  '../patch_2025-09-27_release_prep.js',
  '../patch_2025-10-02_baseline_ux_cleanup.js',
  '../patch_2025-10-02_medium_nice.js',
  '../patch_2025-09-27_merge_ui.js',
  '../patch_2025-09-27_phase6_polish_telemetry.js',
  '../patch_2025-10-03_quick_add_partner.js',
  '../patch_2025-10-03_automation_seed.js'
];

// Critical modules the app cannot run without
export const REQUIRED = new Set([
  '../env.js',
  '../db.js',
  '../utils.js',
  '../render.js',
  '../ui/Toast.js',
  '../ui/Confirm.js'
]);

export default {
  CORE,
  PATCHES,
  REQUIRED
};
