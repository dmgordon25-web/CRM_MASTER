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
  { dashId: 'focus', labsId: 'focus', status: 'mapped', mountedVia: 'labs-native', note: 'Focus summary renderer in Labs registry' },
  { dashId: 'filters', labsId: 'filters', status: 'mapped', mountedVia: 'labs-native', note: 'Filters renderer with Labs styling' },
  { dashId: 'kpis', labsId: 'labsKpiSummary', status: 'mapped', mountedVia: 'labs-native', note: 'Labs Snapshot KPIs supersede classic KPIs' },

  // Pipeline widgets (ONE canonical default, variants are experimental)
  { dashId: 'pipeline', labsId: 'labsPipelineSnapshot', status: 'mapped', mountedVia: 'labs-native', note: 'CANONICAL pipeline widget - default mounted' },
  { dashId: 'numbersMomentum', labsId: 'numbersMomentum', status: 'experimental', mountedVia: 'labs-native', note: 'Alternate pipeline momentum - opt-in' },

  // Task & Today widgets
  { dashId: 'today', labsId: 'today', status: 'mapped', mountedVia: 'labs-native', note: 'Uses getDisplayTasks for proper contact name resolution' },
  { dashId: 'todo', labsId: 'todo', status: 'mapped', mountedVia: 'labs-native', note: 'Uses getDisplayTasks for proper contact name resolution' },
  { dashId: 'priorityActions', labsId: 'priorityActions', status: 'mapped', mountedVia: 'labs-native' },
  { dashId: 'milestones', labsId: 'milestones', status: 'experimental', mountedVia: 'labs-native', note: 'Appointments feed still evolving' },

  // Partner & Referral widgets
  { dashId: 'leaderboard', labsId: 'referralLeaderboard', status: 'mapped', mountedVia: 'labs-native' },
  { dashId: 'numbersPortfolio', labsId: 'partnerPortfolio', status: 'mapped', mountedVia: 'labs-native' },
  { dashId: 'numbersReferrals', labsId: 'referralLeaderboard', status: 'mapped', mountedVia: 'labs-native' },
  { dashId: 'goalProgress', labsId: 'goalProgress', status: 'mapped', mountedVia: 'labs-native' },

  // Relationship & Nurture widgets
  { dashId: 'relationshipOpportunities', labsId: 'relationshipOpportunities', status: 'mapped', mountedVia: 'labs-native' },
  { dashId: 'clientCareRadar', labsId: 'relationshipOpportunities', status: 'mapped', mountedVia: 'labs-native', note: 'Shares renderer with relationship opportunities' },
  { dashId: 'favorites', labsId: 'favorites', status: 'mapped', mountedVia: 'labs-native' },

  // Graduated widgets (2025-12) - now default-mounted
  { dashId: 'stale', labsId: 'staleDeals', status: 'mapped', mountedVia: 'labs-native', note: 'Files stale 14+ days - graduated 2025-12' },
  { dashId: 'closingWatch', labsId: 'closingWatch', status: 'mapped', mountedVia: 'labs-native', note: 'Deals nearing close date - graduated 2025-12' },
  { dashId: 'upcomingCelebrations', labsId: 'upcomingCelebrations', status: 'mapped', mountedVia: 'labs-native', note: 'Birthdays/anniversaries - graduated 2025-12' },

  // Experimental widgets (still opt-in)
  { dashId: 'pipelineCalendar', labsId: 'pipelineCalendar', status: 'experimental', mountedVia: 'labs-native', note: 'Timeline styling WIP' },
  { dashId: 'docPulse', labsId: 'docPulse', status: 'experimental', mountedVia: 'labs-native', note: 'Milestone mapping incomplete' },

  // Deprecated/Superseded
  { dashId: 'docCenter', labsId: 'docPulse', status: 'notApplicable', mountedVia: 'labs-native', note: 'Superseded by Doc Pulse in Labs' },

  // Hidden Feature Shortcuts (Labs-only, Advanced-only)
  { dashId: null, labsId: 'printSuiteShortcut', status: 'experimental', mountedVia: 'labs-native', note: 'Advanced-only, navigates to #/print' },
  { dashId: null, labsId: 'templatesShortcut', status: 'experimental', mountedVia: 'labs-native', note: 'Advanced-only, navigates to #/templates' }
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
