export const HELP_CONTENT = {
  'dashboard-page': {
    title: 'Dashboard',
    short: 'Your daily command center for pipeline health, tasks, and document follow-through.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A one-screen summary of your active borrower workflow.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Uses the same locally saved contacts, partners, and tasks shown in their full pages.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Badges and widget totals reflect records currently in scope (including any active filters).</li></ul><p><strong>Common actions</strong></p><ul><li>Open a row to edit, send follow-ups, or complete checklist items.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>If a count looks off, check filters and stage/status values first.</li></ul>'
  },
  'doc-pulse': {
    title: 'Document Pulse',
    short: 'Tracks missing borrower documents so files do not stall underwriting.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A focused list of contacts with incomplete document checklists.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Reads required docs by loan program and each contact’s checked/unchecked checklist items.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Total shows how many borrowers still have outstanding docs.</li></ul><p><strong>Common actions</strong></p><ul><li>Open borrower, check off received docs, then sync checklist.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Changing loan program can change required docs, so re-sync after updates.</li></ul>'
  },
  'labs-view': {
    title: 'Dashboard (Configurable)',
    short: 'A customizable dashboard version with movable widgets and saved layouts.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A flexible home view built from the same CRM data as the classic dashboard.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Widgets read your local contacts/partners/tasks and refresh from those stores.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Widget counts mirror matching list pages and pipeline stages.</li></ul><p><strong>Common actions</strong></p><ul><li>Switch layout, save layout, and drill into records from widgets.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Layout changes do not change your borrower data—only how it is displayed.</li></ul>'
  },
  'calendar-view': {
    title: 'Calendar',
    short: 'Timeline for touches, tasks, meetings, and milestone dates.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A shared schedule combining borrower and partner follow-up events.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Builds events from contacts, tasks, and milestone dates saved in your workspace.</li></ul><p><strong>What the counts mean</strong></p><ul><li>You are seeing only events in the selected day/week/month window.</li></ul><p><strong>Common actions</strong></p><ul><li>Switch views, export CSV/ICS, click events to jump into the linked record.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Legend toggles can hide categories—use “Show all” if events seem missing.</li></ul>'
  },
  'calendar-legend': {
    title: 'Calendar Legend & Colors',
    short: 'Controls which event categories are visible and explains each color chip.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>The category key for calls, tasks, milestones, partner events, and follow-ups.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Each event category maps to a fixed color and icon.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Muted legend chips are hidden from the calendar until re-enabled.</li></ul><p><strong>Common actions</strong></p><ul><li>Click chips to hide/show categories. Use “Show all” to reset quickly.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Hidden categories still exist—they are only filtered from view.</li></ul>'
  },
  'contacts-view': {
    title: 'Contacts',
    short: 'Main borrower/lead table for pipeline execution and follow-up.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Your full contact list, including active borrowers and leads.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Rows come from local contact records and respond to search + filters.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Export and selection actions apply to the rows currently shown.</li></ul><p><strong>Common actions</strong></p><ul><li>Search, filter, export CSV, then open a contact to update stage/docs.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>If a borrower is not visible, clear filters or check if they moved to another status bucket.</li></ul>'
  },
  'contact-editor': {
    title: 'Contact Editor',
    short: 'Where you update borrower profile, loan progress, partner links, and follow-up details.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>The full borrower workspace across Profile, Loan, Relationships, and Docs tabs.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Reads/writes one contact record in local storage and updates connected widgets immediately.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Stage/status chips and checklist totals reflect this borrower only.</li></ul><p><strong>Common actions</strong></p><ul><li>Update stage, set next follow-up, link referral partner, and save.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Save after major edits so dashboard and pipeline counts refresh correctly.</li></ul>'
  },
  'contact-doc-checklist': {
    title: 'Contact Document Checklist',
    short: 'Per-borrower document tracker to keep files complete before close.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A borrower-specific checklist of requested and received documents.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Required docs are based on loan program; checked items are stored on that contact.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Received vs outstanding tells you what is still needed.</li></ul><p><strong>Common actions</strong></p><ul><li>Sync required docs, check received items, and email request list.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Checklist appears after the contact is saved and loan program is set.</li></ul>'
  },
  'partners-view': {
    title: 'Partners',
    short: 'Referral partner table with activity and production context.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Your network of Realtors and other referral sources.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Partner metrics use linked contacts that reference each partner role.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Referrals/funded/active totals show deal flow tied to that partner.</li></ul><p><strong>Common actions</strong></p><ul><li>Open partner record, update cadence, review linked customers, export CSV.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Link contacts correctly to partner roles so rollups stay accurate.</li></ul>'
  },
  'partner-editor': {
    title: 'Partner Editor',
    short: 'Detailed partner profile for relationship planning and follow-up rhythm.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>The partner profile with overview, contact info, engagement notes, and linked borrowers.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Linked customer list is pulled from contacts connected to this partner.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Active borrower totals indicate current pipeline tied to this partner.</li></ul><p><strong>Common actions</strong></p><ul><li>Adjust tier/cadence, set next touch, add strategy notes, then save.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Use clear cadence and next-touch dates so partner follow-up does not slip.</li></ul>'
  },
  'pipeline-view': {
    title: 'Pipeline Board',
    short: 'Kanban + tables showing borrower flow from application through funded.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Visual stage management for active borrowers, including the client lane (Approved/CTC/Funded).</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Cards and rows come from contact stage/status values.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Column totals are borrowers currently in each stage bucket.</li></ul><p><strong>Common actions</strong></p><ul><li>Drag cards to new stages, open rows for detailed edits, export stage tables.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>CTC means “Cleared to Close”; keep status current so closing forecasts are reliable.</li></ul>'
  },
  'priority-actions': {
    title: 'Priority Actions',
    short: 'Your urgent follow-ups due now or overdue.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A shortlist of high-priority borrower and partner tasks.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Built from due/overdue task and follow-up fields.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Count drops as you complete or reschedule items.</li></ul><p><strong>Common actions</strong></p><ul><li>Open row, complete action, schedule next touch.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Check this first each day to protect closings.</li></ul>'
  },
  milestones: {
    title: 'Milestones Ahead',
    short: 'Upcoming key dates tied to active borrower pipelines.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Timeline of next milestones and deadlines.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Uses closing timeline, milestone, and due-date fields on contacts.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Shows upcoming items still requiring action.</li></ul><p><strong>Common actions</strong></p><ul><li>Open contact, update milestone, set next follow-up.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Keep stage and milestone aligned to avoid confusing reminders.</li></ul>'
  },
  'referral-leaders': {
    title: 'Referral Leaders',
    short: 'Highlights top partner sources driving new borrower volume.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Leaderboard of partners producing active/funded opportunities.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Counts linked contacts and production tied to each partner.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Higher totals mean stronger current pipeline contribution.</li></ul><p><strong>Common actions</strong></p><ul><li>Open partner record, schedule appreciation touchpoint.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Unlinked referrals will undercount partner performance.</li></ul>'
  },
  'pipeline-momentum': {
    title: 'Pipeline Momentum',
    short: 'Stage-by-stage snapshot of borrower volume movement.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A quick visual of pipeline distribution by stage.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Groups active contacts by current stage.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Each number is borrower count in that stage bucket.</li></ul><p><strong>Common actions</strong></p><ul><li>Open bottleneck stages and push next-step updates.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>If counts look stale, verify contact stage updates were saved.</li></ul>'
  },
  'reports-view': {
    title: 'Client Portfolio',
    short: 'Performance and production snapshots over selected ranges.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>KPI and portfolio reporting for your pipeline and funded outcomes.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Uses contact stages, amounts, referral links, and selected date range.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Totals refresh when date range or filters change.</li></ul><p><strong>Common actions</strong></p><ul><li>Switch range, review referral performance, export CSV.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>All-time vs 90-day can look very different—confirm range before sharing numbers.</li></ul>'
  },
  'notifications-view': {
    title: 'Notifications',
    short: 'Reminder and alert feed for tasks and CRM events.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A queue of alerts, reminders, and communication prompts.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Built from local notification records and task events.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Unread totals represent items not marked read/archived.</li></ul><p><strong>Common actions</strong></p><ul><li>Open item, complete follow-up, archive when done.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Archived items leave counts but remain in history if filters include them.</li></ul>'
  },
  'portfolio-referrals': {
    title: 'Referral Partner Performance',
    short: 'Shows how partner relationships contribute to funded outcomes.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Partner-level rollup inside portfolio reporting.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Matches funded contacts to their referral partner links.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Rows show deals/volume attributed to each partner.</li></ul><p><strong>Common actions</strong></p><ul><li>Sort leaders, export list, plan relationship follow-ups.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Missing referral assignments reduce attributed volume.</li></ul>'
  },
  'portfolio-funded': {
    title: 'Funded Deals',
    short: 'List of borrowers who reached funded status in range.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Detailed funded borrower table for the selected reporting window.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Includes contacts with funded/closed stage markers and matching dates.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Total rows are funded deals in the selected timeframe.</li></ul><p><strong>Common actions</strong></p><ul><li>Review funded mix, export CSV, identify referral patterns.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Date range changes can remove/add deals instantly.</li></ul>'
  },
  'settings-view': {
    title: 'Settings',
    short: 'Control local preferences, data tools, and workflow defaults.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Configuration center for this device’s CRM workspace.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Settings persist locally and immediately affect related views.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Diagnostics and utility summaries report local record state.</li></ul><p><strong>Common actions</strong></p><ul><li>Adjust preferences, run diagnostics, export backups.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Changes are local to this machine unless you export and move snapshots.</li></ul>'
  },
  'imports-csv': {
    title: 'CSV Import',
    short: 'Brings contacts/partners into the CRM with normalization and routing.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>A guided import tool for adding contacts or partners from CSV files.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Columns are mapped, common values are normalized, and rows are routed to the right record type.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Import feedback reports how many rows were created, updated, or skipped.</li></ul><p><strong>Common actions</strong></p><ul><li>Use template, import file, review summary, then spot-check key records.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Keep stage/status labels clean in CSV to avoid orphan values.</li></ul>'
  },
  'exports-csv-ics': {
    title: 'Exports (CSV / ICS)',
    short: 'Downloads list data or calendar schedules for reporting and sharing.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Export tools across tables and calendar views.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>CSV exports the records currently visible in that table scope; ICS exports calendar-style events.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Exported row/event totals match your on-screen filter scope.</li></ul><p><strong>Common actions</strong></p><ul><li>Set filters first, export, then share or archive the file.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>If export looks incomplete, check active filters and date range.</li></ul>'
  },
  'backup-restore': {
    title: 'Backup & Restore',
    short: 'Workspace snapshots for local data safety and recovery.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Export/import of full workspace snapshots on this device.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Snapshot includes your CRM records and settings saved locally.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Import summary indicates merged/replaced records after restore.</li></ul><p><strong>Common actions</strong></p><ul><li>Export before big cleanup, then restore with merge or replace as needed.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Replace mode can overwrite current local data—confirm carefully.</li></ul>'
  },
  'seed-profiles': {
    title: 'Seed Profiles',
    short: 'Loads preset demo scenarios for training and workflow walkthroughs.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>One-click sample datasets like Demo Week or Production-ish.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Creates staged contacts, partners, and timeline variety based on selected profile.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Generated volume depends on selected count/options in the seed form.</li></ul><p><strong>Common actions</strong></p><ul><li>Pick profile, preview description, run seed, then validate dashboard/pipeline.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Seeding overwrites demo workspace content on this machine.</li></ul>'
  },
  'status-orphan-detector': {
    title: 'Status Orphan Detector',
    short: 'Finds non-standard stage/status values that can break reporting consistency.',
    detailsHtml: '<p><strong>What this is</strong></p><ul><li>Data diagnostics scan for values outside expected stage/status lists.</li></ul><p><strong>How it’s calculated</strong></p><ul><li>Compares saved contact values against canonical CRM options.</li></ul><p><strong>What the counts mean</strong></p><ul><li>Canonical list = valid values. Orphan list = values needing cleanup.</li></ul><p><strong>Common actions</strong></p><ul><li>Run scan, copy report, then correct records with orphaned labels.</li></ul><p><strong>Tips / gotchas</strong></p><ul><li>Run after imports to catch mismatched labels early.</li></ul>'
  }
};
