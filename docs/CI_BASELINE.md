# CI Baseline

- Timestamp (UTC): 2026-02-14T21:49:30Z
- Commit tested: `45c4b6525428a8639c2472e8d7cd6009b31a6fa5`
- Repository sync note: `git fetch origin main` could not run because no `origin` remote is configured in this environment.

## Commands run

```bash
npm ci
npm run verify:build
npm run test:unit
npm run test:counts
npm run test:e2e
npm run check:features
npm run audit
# additional diagnostic rerun for complete failing spec inventory:
timeout 900s npm run test:e2e
```

## PASS/FAIL summary

| Suite | Command | Status | Notes |
|---|---|---|---|
| Install | `npm ci` | PASS | Completed successfully. |
| Build verification | `npm run verify:build` | PASS | Completed successfully. |
| Unit tests | `npm run test:unit` | PASS | 59 passed. |
| Count checks | `npm run test:counts` | PASS | 8 passed. |
| E2E tests | `npm run test:e2e` | FAIL | Initial run terminated (`EXIT_CODE=143`), rerun completed with failures (`1 passed`, remaining failed). |
| Feature checks | `npm run check:features` | PASS | Boot smoke passed. |
| Audit | `npm run audit` | FAIL | Script exists but failed (`MODULE_NOT_FOUND`). |

## Failing suite details

### `npm run test:e2e` (FAIL)

- Key error line: `Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8080/#contacts`
- Additional signal: repeated optional module fetch failures followed by connection-refused navigation failures.

Failing specs from rerun (`timeout 900s npm run test:e2e`):
- `tests/e2e/configurable_dashboard.spec.js` — `Configurable Dashboard Consolidation › Configuration action buttons exist`
- `tests/e2e/configurable_dashboard.spec.js` — `Configurable Dashboard Consolidation › Recommended layout cannot be deleted`
- `tests/e2e/configurable_dashboard.spec.js` — `Configurable Dashboard Consolidation › Legacy dashboard does not have drag/resize UI`
- `tests/e2e/configurable_dashboard.spec.js` — `Configurable Dashboard Consolidation › Dashboard (Configurable) uses GridStack`
- `tests/e2e/configurable_dashboard.spec.js` — `Configurable Dashboard Consolidation › dirty state indicator exists but is initially hidden`
- `tests/e2e/contact_delete.spec.js` — `Contact Deletion › bulk delete updates UI immediately`
- `tests/e2e/contact_doc_checklist.spec.js` — `contact document checklist › persists checklist toggles across reload`
- `tests/e2e/contact_loan_stage.spec.js` — `Contact loan stage persistence › loan stage saves and reloads`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Dashboard loads with persistent header and without Configurable hero`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Switching to All mode shows Labs View`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Today Mode shows Legacy View`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Legend click does NOT trigger reset (View stays stable)`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Switching to Today shows Legacy Today View (Repeated Verify)`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Header hides when navigating to valid non-dashboard route`
- `tests/e2e/dashboard_widget_drilldown.spec.ts` — `Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender`
- `tests/e2e/data_diagnostics.spec.js` — `Settings data diagnostics › lists canonical and orphan stage/status values deterministically`
- `tests/e2e/help_coverage_smoke.spec.js` — `help coverage smoke across major CRM surfaces`
- `tests/e2e/labs_default.spec.js` — `Labs Default & Remaining Parity › Root / redirects to /#/labs`
- `tests/e2e/labs_default.spec.js` — `Labs Default & Remaining Parity › Can navigate to Legacy Dashboard`
- `tests/e2e/labs_default.spec.js` — `Labs Default & Remaining Parity › Upcoming Celebrations renders and handles drilldown`
- `tests/e2e/labs_default.spec.js` — `Labs Default & Remaining Parity › Favorites renders and handles drilldown`
- `tests/e2e/labs_parity_core.spec.js` — `Labs Widget Parity › Priority Actions widget renders and handles drilldown`
- `tests/e2e/labs_parity_core.spec.js` — `Labs Widget Parity › Today's Work widget renders and handles drilldown`
- `tests/e2e/labs_parity_interaction.spec.js` — `Labs Interaction Widgets Parity › Milestones Widget renders and handles drilldown`
- `tests/e2e/labs_parity_interaction.spec.js` — `Labs Interaction Widgets Parity › Referral Leaderboard renders and handles drilldown`
- `tests/e2e/labs_parity_tripwires.spec.js` — `Labs Parity Tripwires › Tripwire counts stay aligned with seed data`
- `tests/e2e/labs_znext_render.spec.js` — `Labs zNext Engine Render Verification ───`
- `tests/e2e/mutation_repaint_audit.spec.js` — `Mutation Repaint Audit › Partner Save Should Repaint UI`
- `tests/e2e/mutation_repaint_audit.spec.js` — `Mutation Repaint Audit › Contact Save Should Repaint UI`
- `tests/e2e/mutation_repaint_audit.spec.js` — `Mutation Repaint Audit › Workspace Restore Should Repaint UI`
- `tests/e2e/navigation_editors.spec.ts` — `Dashboard drilldown smoke › New+ and widget drilldowns open editors`
- `tests/e2e/notifications_restore.spec.js` — `Notifications Restore › should persist notifications across workspace export/restore`
- `tests/e2e/print_cards.spec.js` — `Print Cards › renders card blocks for contacts with mailing addresses`
- `tests/e2e/recovery_p0.spec.js` — `P0 Recovery › Reproduce Task Persistence Failure`
- `tests/e2e/select_all.spec.js` — `Select All Regression Proof › Select All behaves correctly with partial selection`
- `tests/e2e/selection_scroll.spec.js` — `selection + scroll stability › contacts editor preserves scroll and clears selection predictably`
- `tests/e2e/selection_scroll.spec.js` — `selection + scroll stability › contacts selection resets when switching views`
- `tests/e2e/smoke.spec.js` — `CRM smoke › boots without console errors ───────────`

### `npm run audit` (FAIL)

- Key error line: `Error: Cannot find module '/workspace/CRM_MASTER/scripts/audit.js'`

## Top 5 remaining failure clusters

1. **Environment/server availability for E2E navigation**
   - Repeated `net::ERR_CONNECTION_REFUSED` at `http://127.0.0.1:8080/...` across many specs.
2. **Dashboard header/toggle parity**
   - `tests/e2e/dashboard_header.spec.js` failures across mode switching and header visibility assertions.
3. **Labs drilldowns/parity coverage**
   - Failures across `labs_default`, `labs_parity_core`, `labs_parity_interaction`, and `labs_parity_tripwires` specs.
4. **Mutation repaint + editor lifecycle paths**
   - Failures in mutation repaint audit and navigation/editor smoke (`mutation_repaint_audit.spec.js`, `navigation_editors.spec.ts`).
5. **Record workflows and persistence checks**
   - Failures in delete repaint, doc checklist, loan stage persistence, notifications restore, print cards, and recovery flows.
