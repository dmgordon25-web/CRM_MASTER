const SIZE_TO_TOKEN = {
  small: 'w1',
  medium: 'w2',
  large: 'w3'
};

const TOKEN_TO_GRID = {
  w1: 4,
  w2: 8,
  w3: 12
};

function normalizeSizeToToken(size) {
  const key = typeof size === 'string' ? size.toLowerCase() : '';
  return SIZE_TO_TOKEN[key] || 'w2';
}

function gridWidthForSize(size) {
  const token = normalizeSizeToToken(size);
  return TOKEN_TO_GRID[token] || 8;
}

function buildLayout(sectionWidgets = []) {
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  return (sectionWidgets || []).map((widget) => {
    const width = gridWidthForSize(widget.size);
    const height = widget.h || 4;

    if (x + width > 12) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }

    const position = { id: widget.id, x, y, w: width, h: height };
    x += width;
    rowHeight = Math.max(rowHeight, height);
    return position;
  });
}

export const DEFAULT_WIDGETS_BY_SECTION = {
  overview: [
    // Focus & KPI (classic Home parity)
    { id: 'focus', size: 'medium' },
    { id: 'labsKpiSummary', size: 'large' },
    { id: 'labsPipelineSnapshot', size: 'large' },
    { id: 'goalProgress', size: 'medium' },
    // Tasks & Today
    { id: 'labsTasks', size: 'medium' },
    { id: 'today', size: 'medium' },
    { id: 'todo', size: 'medium' },
    { id: 'priorityActions', size: 'medium' },
    { id: 'favorites', size: 'small', h: 3 },
    { id: 'milestones', size: 'medium' },
    // Partners & Referrals
    { id: 'partnerPortfolio', size: 'large' },
    { id: 'referralLeaderboard', size: 'medium' },
    { id: 'referralTrends', size: 'medium' },
    { id: 'relationshipOpportunities', size: 'medium' },
    // Graduated from experimental (2025-12)
    { id: 'closingWatch', size: 'medium' },
    { id: 'upcomingCelebrations', size: 'medium' }
  ],
  tasks: [
    { id: 'labsTasks', size: 'large' },
    { id: 'pipelineCalendar', size: 'large' }, // Graduated
    { id: 'priorityActions', size: 'medium' },
    { id: 'today', size: 'medium' },
    { id: 'todo', size: 'medium' }
  ],
  portfolio: [
    { id: 'partnerPortfolio', size: 'large' },
    { id: 'referralTrends', size: 'medium' },
    { id: 'referralLeaderboard', size: 'medium' },
    { id: 'relationshipOpportunities', size: 'medium' }
  ],
  analytics: [
    { id: 'pipelineFunnel', size: 'medium' },
    { id: 'pipelineVelocity', size: 'medium' },
    { id: 'pipelineRisk', size: 'medium' },
    { id: 'staleDeals', size: 'medium' },
    // Graduated 2025-12
    { id: 'statusStack', size: 'medium' },
    { id: 'activePipeline', size: 'large' }
  ],
  experimental: []
};

export const DEFAULT_VNEXT_LAYOUTS = Object.fromEntries(
  Object.entries(DEFAULT_WIDGETS_BY_SECTION).map(([sectionId, widgets]) => [
    sectionId,
    buildLayout(widgets)
  ])
);
