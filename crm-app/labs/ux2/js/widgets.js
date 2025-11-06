/* ===================================
   Lab UX2 - Widget Configurations
   All existing CRM widgets mapped for Lab
   =================================== */

// Widget Configurations
// Based on existing CRM widgets from dashboard/index.js and ui/dashboard_layout.js
export const WIDGET_CONFIGS = {
  // Core Dashboard Widgets
  'dashboard-focus': {
    title: 'Focus Summary',
    description: 'Your top priorities and focus areas',
    defaultX: 0,
    defaultY: 0,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    enabled: true,
    hint: 'Shows your most important tasks and priorities'
  },

  'dashboard-today': {
    title: "Today's Work",
    description: 'Tasks and activities for today',
    defaultX: 6,
    defaultY: 0,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    enabled: true,
    hint: 'View and manage today\'s activities'
  },

  'dashboard-kpis': {
    title: 'Key Performance Indicators',
    description: 'Your key metrics and performance data',
    defaultX: 0,
    defaultY: 3,
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
    icon: '<line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line>',
    enabled: true,
    hint: 'Track your key performance indicators'
  },

  'dashboard-pipeline-overview': {
    title: 'Pipeline Overview',
    description: 'Sales pipeline status and metrics',
    defaultX: 0,
    defaultY: 5,
    defaultW: 6,
    defaultH: 4,
    minW: 4,
    minH: 3,
    icon: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>',
    enabled: true,
    hint: 'Monitor your sales pipeline'
  },

  'dashboard-celebrations': {
    title: 'Upcoming Birthdays & Anniversaries',
    description: 'Client celebrations and milestones',
    defaultX: 6,
    defaultY: 5,
    defaultW: 6,
    defaultH: 4,
    minW: 3,
    minH: 2,
    icon: '<circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path>',
    enabled: true,
    hint: 'Never miss a client celebration'
  },

  'referral-leaderboard': {
    title: 'Referral Leaderboard',
    description: 'Top referral sources and partners',
    defaultX: 0,
    defaultY: 9,
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
    icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line>',
    enabled: false,
    hint: 'See who\'s sending the most referrals'
  },

  'dashboard-stale': {
    title: 'Stale Deals',
    description: 'Deals that need attention',
    defaultX: 4,
    defaultY: 9,
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 3,
    icon: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
    enabled: false,
    hint: 'Identify deals that need follow-up'
  },

  'favorites-card': {
    title: 'Favorites',
    description: 'Your favorited contacts and partners',
    defaultX: 8,
    defaultY: 9,
    defaultW: 4,
    defaultH: 4,
    minW: 3,
    minH: 2,
    icon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    enabled: true,
    hint: 'Quick access to your favorite contacts'
  },

  'goal-progress-card': {
    title: 'Production Goals',
    description: 'Track your production goals and progress',
    defaultX: 0,
    defaultY: 13,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
    enabled: true,
    hint: 'Monitor progress toward your goals'
  },

  'numbers-portfolio-card': {
    title: 'Partner Portfolio',
    description: 'Your partner portfolio metrics',
    defaultX: 6,
    defaultY: 13,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>',
    enabled: true,
    hint: 'View your partner portfolio statistics'
  },

  'numbers-referrals-card': {
    title: 'Referral Leaders',
    description: 'Top referral sources',
    defaultX: 0,
    defaultY: 16,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    enabled: true,
    hint: 'See who\'s driving the most referrals'
  },

  'numbers-momentum-card': {
    title: 'Pipeline Momentum',
    description: 'Pipeline velocity and trends',
    defaultX: 4,
    defaultY: 16,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    enabled: true,
    hint: 'Track pipeline velocity and momentum'
  },

  'pipeline-calendar-card': {
    title: 'Pipeline Calendar',
    description: 'Calendar view of pipeline activities',
    defaultX: 8,
    defaultY: 16,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    enabled: true,
    hint: 'View pipeline activities in calendar format'
  },

  'priority-actions-card': {
    title: 'Priority Actions',
    description: 'High-priority action items',
    defaultX: 0,
    defaultY: 19,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
    enabled: true,
    hint: 'Focus on your most important actions'
  },

  'milestones-card': {
    title: 'Milestones Ahead',
    description: 'Upcoming milestones and deadlines',
    defaultX: 6,
    defaultY: 19,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>',
    enabled: true,
    hint: 'Track upcoming milestones'
  },

  'doc-pulse-card': {
    title: 'Document Pulse',
    description: 'Recent document activity',
    defaultX: 0,
    defaultY: 22,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
    enabled: true,
    hint: 'Monitor document activity'
  },

  'rel-opps-card': {
    title: 'Relationship Opportunities',
    description: 'Potential relationship opportunities',
    defaultX: 4,
    defaultY: 22,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    enabled: true,
    hint: 'Discover new relationship opportunities'
  },

  'nurture-card': {
    title: 'Client Care Radar',
    description: 'Clients that need attention',
    defaultX: 8,
    defaultY: 22,
    defaultW: 4,
    defaultH: 3,
    minW: 3,
    minH: 2,
    icon: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>',
    enabled: true,
    hint: 'Identify clients that need nurturing'
  },

  'closing-watch-card': {
    title: 'Closing Watchlist',
    description: 'Deals approaching close',
    defaultX: 0,
    defaultY: 25,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<circle cx="12" cy="12" r="10"></circle><polyline points="16 12 12 8 8 12"></polyline><line x1="12" y1="16" x2="12" y2="8"></line>',
    enabled: true,
    hint: 'Monitor deals close to closing'
  },

  'doc-center-card': {
    title: 'Document Center',
    description: 'Access to document center',
    defaultX: 6,
    defaultY: 25,
    defaultW: 6,
    defaultH: 3,
    minW: 4,
    minH: 2,
    icon: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>',
    enabled: true,
    hint: 'Manage all your documents'
  },

  'dashboard-status-stack': {
    title: 'Status Panels',
    description: 'Quick status overview panels',
    defaultX: 0,
    defaultY: 28,
    defaultW: 12,
    defaultH: 3,
    minW: 6,
    minH: 2,
    icon: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
    enabled: true,
    hint: 'Overview of all status categories'
  },

  'dashboard-filters': {
    title: 'Dashboard Filters',
    description: 'Filter and customize your dashboard view',
    defaultX: 0,
    defaultY: 31,
    defaultW: 12,
    defaultH: 2,
    minW: 6,
    minH: 2,
    icon: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    enabled: true,
    hint: 'Apply filters to your dashboard'
  }
};

// Create widget element
export function createWidgetElement(widgetId, config) {
  const widget = document.createElement('div');
  widget.className = 'grid-stack-item';
  widget.setAttribute('gs-id', widgetId);

  widget.innerHTML = `
    <div class="grid-stack-item-content">
      <div class="lab-widget">
        <div class="lab-widget-header">
          <h3 class="lab-widget-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${config.icon}
            </svg>
            ${config.title}
          </h3>
          <div class="lab-widget-actions">
            <button class="lab-widget-action" title="Widget Settings" data-action="settings" data-widget="${widgetId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M12 1v6m0 6v6m5.66-13.66l-4.24 4.24m0 6l-4.24 4.24m10.48-2.34l-6-6m-6 6l-6-6"></path>
              </svg>
            </button>
            <button class="lab-widget-action" title="Remove Widget" data-action="remove" data-widget="${widgetId}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="lab-widget-body">
          <!-- Widget content will be loaded here -->
          <div class="lab-widget-loading" style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--lab-text-muted);
          ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
              <style>
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              </style>
              <line x1="12" y1="2" x2="12" y2="6"></line>
              <line x1="12" y1="18" x2="12" y2="22"></line>
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
              <line x1="2" y1="12" x2="6" y2="12"></line>
              <line x1="18" y1="12" x2="22" y2="12"></line>
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
            </svg>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add event listeners for widget actions
  const settingsBtn = widget.querySelector('[data-action="settings"]');
  const removeBtn = widget.querySelector('[data-action="remove"]');

  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      console.log(`⚙️ Settings for widget: ${widgetId}`);
      // TODO: Implement widget settings
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.LabActions && window.LabActions.removeWidget) {
        window.LabActions.removeWidget(widgetId);
      }
    });
  }

  return widget;
}

// Get enabled widgets
export function getEnabledWidgets() {
  return Object.entries(WIDGET_CONFIGS)
    .filter(([_, config]) => config.enabled)
    .map(([id]) => id);
}

// Get all widgets
export function getAllWidgets() {
  return Object.keys(WIDGET_CONFIGS);
}
