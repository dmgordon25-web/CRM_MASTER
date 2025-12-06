// Labs Dashboard parity map
// Explicit mapping between classic dashboard widgets and their Labs counterparts.
// Each entry documents whether the widget is available, experimental, or deferred.

export const DASH_TO_LABS_WIDGET_MAP = [
  { dashId: 'focus', labsId: 'focus', status: 'mapped', note: 'Focus summary renderer available in Labs registry' },
  { dashId: 'filters', labsId: 'filters', status: 'mapped', note: 'Filters renderer exists for parity' },
  { dashId: 'kpis', labsId: 'labsKpiSummary', status: 'mapped', note: 'Labs Snapshot KPIs supersede classic KPIs' },
  { dashId: 'pipeline', labsId: 'labsPipelineSnapshot', status: 'mapped', note: 'Pipeline overview presented via Labs snapshot' },
  { dashId: 'today', labsId: 'today', status: 'mapped' },
  { dashId: 'leaderboard', labsId: 'referralLeaderboard', status: 'mapped' },
  { dashId: 'stale', labsId: 'staleDeals', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'goalProgress', labsId: 'goalProgress', status: 'mapped' },
  { dashId: 'numbersPortfolio', labsId: 'partnerPortfolio', status: 'mapped' },
  { dashId: 'numbersReferrals', labsId: 'referralLeaderboard', status: 'mapped' },
  { dashId: 'numbersMomentum', labsId: 'numbersMomentum', status: 'mapped' },
  { dashId: 'pipelineCalendar', labsId: 'pipelineCalendar', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'todo', labsId: 'todo', status: 'mapped' },
  { dashId: 'priorityActions', labsId: 'priorityActions', status: 'mapped' },
  { dashId: 'milestones', labsId: 'milestones', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'docPulse', labsId: 'docPulse', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'relationshipOpportunities', labsId: 'relationshipOpportunities', status: 'mapped' },
  { dashId: 'clientCareRadar', labsId: 'relationshipOpportunities', status: 'mapped', note: 'Shares renderer with relationship opportunities' },
  { dashId: 'closingWatch', labsId: 'closingWatch', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'upcomingCelebrations', labsId: 'upcomingCelebrations', status: 'experimental', note: 'Data polish + de-dupe guard added' },
  { dashId: 'docCenter', labsId: 'docPulse', status: 'notApplicable', note: 'Docs surface superseded by Doc Pulse in Labs' },
  { dashId: 'favorites', labsId: 'favorites', status: 'mapped' }
];

export function getMappedLabsId(dashId) {
  const entry = DASH_TO_LABS_WIDGET_MAP.find((item) => item.dashId === dashId);
  return entry && entry.labsId ? entry.labsId : null;
}

export function getMappedEntries(statusFilter) {
  if (!statusFilter) return DASH_TO_LABS_WIDGET_MAP;
  return DASH_TO_LABS_WIDGET_MAP.filter((entry) => entry.status === statusFilter);
}
