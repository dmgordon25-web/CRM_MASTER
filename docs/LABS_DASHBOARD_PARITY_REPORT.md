# Labs Dashboard Parity Report

> Generated: 2025-12-05  
> Status: **Full Parity Achieved** ✅

---

## Summary

All 22 classic dashboard widgets are represented in Labs. Labs now includes 36+ widget renderers covering every classic widget plus experimental analytics and hidden feature shortcuts.

---

## Classic → Labs Widget Mapping

| Classic ID | Labs ID | Status | Notes |
|------------|---------|--------|-------|
| focus | focus | ✅ mapped | Focus summary |
| filters | filters | ✅ mapped | Filters renderer |
| kpis | labsKpiSummary | ✅ mapped | Enhanced KPI snapshot |
| pipeline | labsPipelineSnapshot | ✅ mapped | Canonical pipeline widget |
| today | today | ✅ mapped | Today's work |
| leaderboard | referralLeaderboard | ✅ mapped | Referral leaders |
| stale | staleDeals | ✅ mapped | Stale deals 14+ days |
| goalProgress | goalProgress | ✅ mapped | Production goals |
| numbersPortfolio | partnerPortfolio | ✅ mapped | Partner portfolio |
| numbersReferrals | referralLeaderboard | ✅ mapped | Referral leaders |
| numbersMomentum | numbersMomentum | ⚗️ experimental | Pipeline momentum variant |
| pipelineCalendar | pipelineCalendar | ⚗️ experimental | Timeline WIP |
| todo | todo | ✅ mapped | To-do list |
| priorityActions | priorityActions | ✅ mapped | Priority actions |
| milestones | milestones | ✅ mapped | Appointments feed |
| docPulse | docPulse | ⚗️ experimental | Document milestones |
| relationshipOpportunities | relationshipOpportunities | ✅ mapped | Client care radar |
| clientCareRadar | clientCareRadar | ✅ mapped | Shares renderer |
| closingWatch | closingWatch | ✅ mapped | Deals near close |
| upcomingCelebrations | upcomingCelebrations | ✅ mapped | Birthdays/anniversaries |
| docCenter | docPulse | ❌ notApplicable | Superseded |
| favorites | favorites | ✅ mapped | Favorites list |

---

## Hidden Feature Shortcuts (Advanced-only)

| Labs ID | Route | Status |
|---------|-------|--------|
| printSuiteShortcut | #/print | ⚗️ experimental |
| templatesShortcut | #/templates | ⚗️ experimental |

---

## Coverage Statistics

- **Mapped (default-mounted):** 18 widgets
- **Experimental (opt-in):** 5 widgets
- **Not Applicable:** 1 widget
- **Hidden Shortcuts:** 2 widgets

**Total Coverage:** 100% of classic widgets represented

---

## Files Modified (v3)

- [crm_widgets.js](../crm-app/js/labs/crm_widgets.js) — Added click-through handlers
- [dashboard.js](../crm-app/js/labs/dashboard.js) — Graduated milestones widget
- [widget_parity_map.js](../crm-app/js/labs/widget_parity_map.js) — Parity updates
- [LABS_DASHBOARD_PARITY_REPORT.md](LABS_DASHBOARD_PARITY_REPORT.md) — Status update
