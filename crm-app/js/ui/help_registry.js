export const HELP_CONTENT = {
  'dashboard-page': {
    title: 'Dashboard',
    short: 'Home surface summarizing pipeline health, docs, and follow-ups.',
    detailsHtml: '<ul><li>Widgets pull from contacts, partners, and notifications already loaded in IndexedDB.</li><li>Counts mirror the filtered records shown in their detail pages (contacts, partners, docs) and update when data changes.</li><li>Export buttons and quick actions open the same editors used elsewhere; there is no separate data copy.</li><li>Dashboard respects UI mode (Simple vs Advanced) and any active filters you applied on list views.</li></ul>'
  },
  'priority-actions': {
    title: 'Priority Actions',
    short: 'Tasks and overdue touches that need your attention first.',
    detailsHtml: '<ul><li>Rows come from contact and partner timelines tagged as tasks or follow-ups.</li><li>Counts reflect items due today or late; completing a task removes it from this list.</li><li>Entries respect Filters and saved queries applied on the originating list views.</li></ul>'
  },
  'milestones': {
    title: 'Milestones Ahead',
    short: 'Upcoming closing and contingency dates pulled from active loans.',
    detailsHtml: '<ul><li>Dates are sourced from contact loan timeline fields (closing timeline, contingencies, and reminders).</li><li>Counts reflect visible rows only and update when you edit stage/status inside the contact editor.</li><li>Calendar exports reuse the same milestones so there is no double-entry.</li></ul>'
  },
  'milestones-ahead': {
    title: 'Milestones Ahead',
    short: 'Upcoming tasks and appointments due today or later.',
    detailsHtml: '<ul><li>Shows open tasks with a due date that are not overdue; soonest due items appear first.</li><li>Limited to the next six upcoming rows to mirror the dashboard list.</li><li>Clicking a row opens the linked contact or partner editor using the same drilldown wiring as the dashboard.</li></ul>'
  },
  'referral-leaders': {
    title: 'Referral Leaders',
    short: 'Shows which partners are sending you the most client opportunities right now.',
    detailsHtml: '<ul><li>Partners are ranked by linked contacts and funded volume.</li><li>When you change a contact\'s referral partner, this widget updates automatically.</li><li>Use it to see who deserves a follow-up thank-you or co-marketing touchpoint.</li></ul>'
  },
  'pipeline-momentum': {
    title: 'Pipeline Momentum',
    short: 'Quick stage-by-stage snapshot of how many active borrowers are in motion.',
    detailsHtml: '<ul><li>Counts are grouped by pipeline stage (Application to Funded).</li><li>Numbers match the Pipeline board and Contacts view for the same filters.</li><li>Updating a stage in the editor immediately refreshes this chart.</li></ul>'
  },
  'doc-pulse': {
    title: 'Document Pulse',
    short: 'Outstanding checklist items across active loans.',
    detailsHtml: '<ul><li>Surfaces contacts with missingDocs entries and open checklist items in the contact editor.</li><li>Counts drop as you mark items received inside the Document Checklist tab.</li><li>Clicking the list opens the related contact editor for direct checklist cleanup.</li></ul>'
  },
  'contacts-view': {
    title: 'Contacts',
    short: 'Full roster of borrowers and leads.',
    detailsHtml: '<ul><li>Rows are sourced from the contacts store (including longshots) and honor Filters/saved queries.</li><li>Counts, exports, and selection state mirror the visible, filtered list only.</li><li>Stage and status edits sync with the Pipeline board and dashboard widgets.</li><li>Advanced-mode fields become available when enabled in Settings → General.</li></ul>'
  },
  'partners-view': {
    title: 'Partners',
    short: 'Referral partners with tiers, focus, and cadence.',
    detailsHtml: '<ul><li>Data comes from the partners store and respects saved Filters and saved views.</li><li>Counts and CSV export reflect the filtered table only.</li><li>Linked customer metrics use contact records that reference this partner as buyer/listing/referral partner.</li></ul>'
  },
  'pipeline-view': {
    title: 'Pipeline Board',
    short: 'Kanban of active borrowers grouped by stage.',
    detailsHtml: '<ul><li>Cards are contacts with a non-empty stage; columns map to the same stage labels used in the editor.</li><li>Counts per column reflect the current Filters scope (in-progress, clients, longshots).</li><li>Dragging a card or editing stage in the contact editor immediately moves the card and updates dashboard momentum.</li></ul>'
  },
  'calendar-view': {
    title: 'Calendar',
    short: 'Events from tasks, follow-ups, and loan milestones.',
    detailsHtml: '<ul><li>Entries are built from contact nextTouch values, logged activities, and milestone dates.</li><li>Counts respect the active month/week view and filter to what is loaded locally; Safe Mode disables editing.</li><li>Opening an event jumps to the linked contact or partner editor so data stays in sync.</li></ul>'
  },
  'reports-view': {
    title: 'Client Portfolio',
    short: 'Performance snapshots for portfolio KPIs.',
    detailsHtml: '<ul><li>KPIs and tables use contact stage/status (funded, approved, nurture) and linked partner metadata.</li><li>Date range control (All Time, 12M, 90D) gates which records are counted.</li><li>Charts respond to the same Filters applied on Contacts/Partners to keep totals consistent.</li></ul>'
  },
  'labs-view': {
    title: 'Dashboard (Configurable)',
    short: 'Customizable dashboard with saved layouts.',
    detailsHtml: '<ul><li>Pulls from the same contacts, partners, and activity timeline objects already cached.</li><li>Counts mirror what your current Filters expose; no separate data sync.</li><li>Features may change; closing the preview does not affect saved records.</li></ul>'
  },
  'notifications-view': {
    title: 'Notifications',
    short: 'Queue of alerts, reminders, and outbound messages.',
    detailsHtml: '<ul><li>Rows come from the notifications store (queued, sent, and archived entries).</li><li>Unread pill counts items without a read or archived flag; exporting honors current filters.</li><li>Throttles and quiet hours configured elsewhere still apply when scheduling from here.</li></ul>'
  },
  'task-list': {
    title: 'Task List',
    short: 'Your immediate to-dos for follow-up, reminders, and due tasks.',
    detailsHtml: '<ul><li>Includes tasks due today and upcoming items that need attention.</li><li>Completing or rescheduling a task updates this widget right away.</li><li>Use it as a daily execution list before moving to deeper views.</li></ul>'
  },
  'settings-view': {
    title: 'Settings',
    short: 'Configure display, automations, and profile defaults.',
    detailsHtml: '<ul><li>Panels write to local IndexedDB preferences (theme, UI mode, prompts) and apply immediately.</li><li>Goals, dashboard, and automation toggles feed other widgets that read from the same settings.</li><li>No changes are sent to a server; reload will respect what is saved locally.</li></ul>'
  },
  'workbench-view': {
    title: 'Workbench',
    short: 'Advanced lenses for contacts and partners.',
    detailsHtml: '<ul><li>Each window renders a saved lens definition (columns, filters, presets) against contacts or partners.</li><li>Counts reflect the rows returned after lens filters and any quick search inside the window.</li><li>Exports and selection states mirror the visible dataset only and reuse the same editor actions used elsewhere.</li></ul>'
  },
  'workbench-window': {
    title: 'Workbench Lens',
    short: 'This window shows a filtered slice of CRM data.',
    detailsHtml: '<ul><li>Data is fetched from contacts or partners according to the lens config key.</li><li>Row counts and summary badges update when you tweak filters, presets, or saved queries.</li><li>Opening a row launches the same contact/partner editor so updates stay in sync with other pages.</li></ul>'
  },
  'calendar-legend': {
    title: 'Calendar Legend',
    short: 'Color key for event sources.',
    detailsHtml: '<ul><li>Colors map to tasks, milestones, partner events, and doc follow-ups loaded in the current view.</li><li>Toggling legend items hides/shows that source without removing data.</li></ul>'
  },
  'portfolio-referrals': {
    title: 'Referral Partner Performance',
    short: 'How partners contribute to funded deals.',
    detailsHtml: '<ul><li>Rows combine funded contacts with their recorded referral partner.</li><li>Date ranges at the top of the portfolio view limit which funded deals are counted.</li><li>Sorting or exporting uses the same dataset you see here.</li></ul>'
  },
  'portfolio-funded': {
    title: 'Funded Deals',
    short: 'Clients who reached the funded stage in the selected range.',
    detailsHtml: '<ul><li>Sourced from contacts whose stage/status indicate funded/closed.</li><li>Amounts use loanAmount fields; partner column reflects linked referral partner where available.</li><li>Changing the range or filters immediately updates totals and row counts.</li></ul>'
  }
};
