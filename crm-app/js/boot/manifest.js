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

export const PATCHES = [];

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
