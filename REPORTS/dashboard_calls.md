# Dashboard Refresh Call Counts

## Scenario
- Toggle the dashboard range control: All ⟶ This Month ⟶ All
- Toggle the dashboard mode control: Today ⟶ All ⟶ Today

Counts capture the number of widget-refresh entry points invoked during each sequence. Baseline numbers reflect the previous implementation (range toggles called `window.renderAll`, mode toggles queued local renders). Updated numbers come from the unified `dashboardState.refresh` pipeline with coalesced handlers.

| Interaction | Baseline calls | Updated calls | Notes |
| --- | --- | --- | --- |
| Range toggle ×2 | `window.renderAll`: 2<br>`renderDashboard` (phase3): 2<br>`window.renderReports` (legacy): 2<br>`renderReportsView`: 2 | `dashboardState.refresh`: 2<br>`handleDashboardRefresh` (phase4): 2<br>`renderReportsView` via subscription: 2 | Baseline invoked both the phase3 dashboard hook and the legacy reports hook each time. Updated flow emits a single debounced refresh and notifies legacy reports via subscription without a global repaint. |
| Mode toggle ×2 | `queueDashboardRender`: 2 (per toggle)<br>`renderDashboard`: 2 | `dashboardState.refresh`: 2<br>`handleDashboardRefresh`: 2 | Mode toggles now rely on the shared state bus; widgets receive a single refresh per toggle without triggering `renderAll`. |

The shared state bus also suppresses secondary refreshes from task status updates and app:data events by merging options before invoking `handleDashboardRefresh`.
