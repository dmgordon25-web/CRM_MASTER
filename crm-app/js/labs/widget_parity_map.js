// ---------------------------------------------------------------------------
// Labs Dashboard Parity Map
// ---------------------------------------------------------------------------
// Explicit mapping between classic dashboard widgets and their Labs counterparts.
// Each entry documents:
//   - dashId: widget key in classic dashboard (dashboard/index.js)
//   - labsId: corresponding widget key in Labs (labs/crm_widgets.js)
//   - status: mapped | experimental | notApplicable
//   - mountedVia: labs-native (full reimplementation) | shared-data (uses same data layer)
//   - note: implementation details
//
// PARITY STATUS LEGEND:
//   mapped         = Labs widget exists and is default-mounted
//   experimental   = Labs widget exists but opt-in only
//   notApplicable  = Classic widget superseded or deprecated in Labs
// ---------------------------------------------------------------------------

export const DASH_TO_LABS_WIDGET_MAP = [
  // Core KPI & Summary widgets
  { dashId: 'focus', labsId: 'focus', status: 'mapped', mountedVia: 'labs-native', note: 'Focus summary renderer in Labs registry', dataSource: 'Baseline snapshot derived from contacts + tasks', countLogic: 'Snapshot aggregates with funnel totals', drilldown: 'Hash navigation to contact editor', parity: '🟡 pending manual review' },
  { dashId: 'filters', labsId: 'filters', status: 'mapped', mountedVia: 'labs-native', note: 'Filters renderer with Labs styling', dataSource: 'Dashboard filter presets', countLogic: 'Boolean toggles only', drilldown: 'N/A (configuration only)', parity: '🟡 pending manual review' },
  { dashId: 'kpis', labsId: 'labsKpiSummary', status: 'mapped', mountedVia: 'labs-native', note: 'Labs Snapshot KPIs supersede classic KPIs', dataSource: 'Baseline snapshot KPIs (contacts, tasks, funded)', countLogic: 'Snapshot computed metrics', drilldown: 'N/A (display only)', parity: '🟡 pending manual review' },

  // Pipeline widgets (ONE canonical default, variants are experimental)
  { dashId: 'pipeline', labsId: 'labsPipelineSnapshot', status: 'mapped', mountedVia: 'labs-native', note: 'CANONICAL pipeline widget - default mounted', dataSource: 'Baseline snapshot stage counts', countLogic: 'Stage bucket totals', drilldown: 'Hash navigation to contact by stage rows', parity: '🟡 pending manual review' },
  { dashId: 'numbersMomentum', labsId: 'numbersMomentum', status: 'experimental', mountedVia: 'labs-native', note: 'Alternate pipeline momentum - opt-in', dataSource: 'Snapshot momentum series', countLogic: 'Trend deltas per stage', drilldown: 'N/A (chart only)', parity: '🟡 pending manual review' },

  // Task & Today widgets
  { dashId: 'today', labsId: 'today', status: 'mapped', mountedVia: 'labs-native', note: 'Uses getDisplayTasks for proper contact name resolution', dataSource: 'Display tasks due today + upcoming celebrations/appointments', countLogic: 'Visible rows rendered (tasks/appointments/celebrations)', drilldown: 'Delegated click opens contact/partner editors', parity: '✅ parity' },
  { dashId: 'todo', labsId: 'todo', status: 'mapped', mountedVia: 'labs-native', note: 'Uses getDisplayTasks for proper contact name resolution', dataSource: 'Local to-do list storage', countLogic: 'User-managed items length', drilldown: 'Checkbox completion only', parity: '🟡 pending manual review' },
  { dashId: 'priorityActions', labsId: 'priorityActions', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Open tasks with due dates (overdue and next 3 days)', countLogic: 'Urgent task rows rendered (max 6)', drilldown: 'Delegated click opens contact or partner editors via hash', parity: '✅ parity' },
  { dashId: 'milestones', labsId: 'milestones', status: 'mapped', mountedVia: 'labs-native', note: 'Appointments feed', dataSource: 'Focus snapshot appointments', countLogic: 'Appointments deduped by contact+time (max 6)', drilldown: 'Row click opens contact editor', parity: '🟡 pending manual review' },

  // Partner & Referral widgets
  { dashId: 'leaderboard', labsId: 'referralLeaderboard', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Partner referral stats', countLogic: 'Top partners by volume', drilldown: 'Partner row opens partner editor', parity: '🟡 pending manual review' },
  { dashId: 'numbersPortfolio', labsId: 'partnerPortfolio', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Partner stats by tier', countLogic: 'Counts + volume grouped by tier', drilldown: 'N/A (summary charts)', parity: '🟡 pending manual review' },
  { dashId: 'numbersReferrals', labsId: 'referralLeaderboard', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Partner referral stats', countLogic: 'Top partners by volume', drilldown: 'Partner row opens partner editor', parity: '🟡 pending manual review' },
  { dashId: 'goalProgress', labsId: 'goalProgress', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Goals settings + funded deals', countLogic: 'Monthly funded + volume progress', drilldown: 'N/A (display only)', parity: '🟡 pending manual review' },

  // Relationship & Nurture widgets
  { dashId: 'relationshipOpportunities', labsId: 'relationshipOpportunities', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Pipeline contacts needing outreach', countLogic: 'Contacts filtered by relationship rules', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },
  { dashId: 'clientCareRadar', labsId: 'relationshipOpportunities', status: 'mapped', mountedVia: 'labs-native', note: 'Shares renderer with relationship opportunities', dataSource: 'Pipeline contacts needing outreach', countLogic: 'Contacts filtered by nurture rules', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },
  { dashId: 'favorites', labsId: 'favorites', status: 'mapped', mountedVia: 'labs-native', dataSource: 'Favorite snapshot (contacts + partners)', countLogic: 'Favorites list length (max 10)', drilldown: 'Row opens contact or partner editor', parity: '🟡 pending manual review' },

  // Graduated widgets (2025-12) - now default-mounted
  { dashId: 'stale', labsId: 'staleDeals', status: 'mapped', mountedVia: 'labs-native', note: 'Files stale 14+ days - graduated 2025-12', dataSource: 'Baseline snapshot stale deals', countLogic: 'Unique stale contacts > 14 days', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },
  { dashId: 'closingWatch', labsId: 'closingWatch', status: 'mapped', mountedVia: 'labs-native', note: 'Deals nearing close date - graduated 2025-12', dataSource: 'Pipeline contacts with close date', countLogic: 'Deals nearing close date window', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },
  { dashId: 'upcomingCelebrations', labsId: 'upcomingCelebrations', status: 'mapped', mountedVia: 'labs-native', note: 'Birthdays/anniversaries - graduated 2025-12', dataSource: 'Contact celebrations (birthdays/anniversaries)', countLogic: 'Celebrations in window (max 8)', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },

  // Graduated alternates (stable, opt-in)
  { dashId: 'pipelineCalendar', labsId: 'pipelineCalendar', status: 'mapped', mountedVia: 'labs-native', note: 'Timeline styling - graduated 2025-12', dataSource: 'Pipeline tasks and events', countLogic: 'Timeline entries for next 30 days', drilldown: 'Rows open contact/partner editors via data-*', parity: '🟡 pending manual review' },
  { dashId: 'momentum', labsId: 'pipelineMomentum', status: 'mapped', mountedVia: 'labs-native', note: 'Pipeline Momentum (Bars) - graduated 2025-12', dataSource: 'Snapshot pipeline counts', countLogic: 'Momentum deltas per stage', drilldown: 'N/A (chart only)', parity: '🟡 pending manual review' },

  // Experimental widgets (still opt-in)
  { dashId: 'docPulse', labsId: 'docPulse', status: 'mapped', mountedVia: 'labs-native', note: 'Canonical milestones with actionable rows - graduated 2025-12', dataSource: 'Document requests snapshot', countLogic: 'Outstanding docs per contact', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },

  // Deprecated/Superseded
  { dashId: 'docCenter', labsId: 'docPulse', status: 'notApplicable', mountedVia: 'labs-native', note: 'Superseded by Doc Pulse in Labs', dataSource: 'Document requests snapshot', countLogic: 'Outstanding docs per contact', drilldown: 'Row opens contact editor', parity: '🟡 pending manual review' },

  // Hidden Feature Shortcuts (Labs-only, Advanced-only)
  { dashId: null, labsId: 'printSuiteShortcut', status: 'mapped', mountedVia: 'labs-native', note: 'Advanced-only, navigates to #/print', dataSource: 'Navigation shortcut', countLogic: 'N/A', drilldown: 'Direct nav to print', parity: '🟡 pending manual review' },
  { dashId: null, labsId: 'templatesShortcut', status: 'mapped', mountedVia: 'labs-native', note: 'Advanced-only, navigates to #/templates', dataSource: 'Navigation shortcut', countLogic: 'N/A', drilldown: 'Direct nav to templates', parity: '🟡 pending manual review' }
];

/**
 * Get the Labs widget ID for a classic dashboard widget
 * @param {string} dashId - Classic dashboard widget ID
 * @returns {string|null} Labs widget ID or null if not mapped
 */
export function getMappedLabsId(dashId) {
  const entry = DASH_TO_LABS_WIDGET_MAP.find((item) => item.dashId === dashId);
  return entry && entry.labsId ? entry.labsId : null;
}

/**
 * Get parity map entries filtered by status
 * @param {string} [statusFilter] - 'mapped', 'experimental', or 'notApplicable'
 * @returns {Array} Filtered entries or all entries if no filter
 */
export function getMappedEntries(statusFilter) {
  if (!statusFilter) return DASH_TO_LABS_WIDGET_MAP;
  return DASH_TO_LABS_WIDGET_MAP.filter((entry) => entry.status === statusFilter);
}

/**
 * Get count summary of parity map status
 * @returns {Object} { mapped, experimental, notApplicable }
 */
export function getParityStats() {
  const stats = { mapped: 0, experimental: 0, notApplicable: 0 };
  DASH_TO_LABS_WIDGET_MAP.forEach((entry) => {
    if (stats[entry.status] !== undefined) {
      stats[entry.status]++;
    }
  });
  return stats;
}
