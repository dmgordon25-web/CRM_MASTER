# CI Baseline
- Timestamp (UTC): 2026-02-16T20:29:50Z
- Commit tested: 0d79495213e15cdea9d912752b0283a4e300ce2c
- Repository sync note: Could not fetch/pull latest main because no `origin` remote is configured in this checkout.

## Commands run
```bash
npm ci
npm run verify:build
npm run test:unit
npm run test:counts
npm run test:e2e
npm run check:features
npm run audit
timeout 900s npm run test:e2e
```

## PASS/FAIL summary
| Suite | Command | Status | Notes |
|---|---|---|---|
| Install | `npm ci` | PASS | EXIT_CODE=0 |
| Build verify | `npm run verify:build` | PASS | EXIT_CODE=0 |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0; 15 files / 59 tests passed |
| Counts suite | `npm run test:counts` | FAIL | EXIT_CODE=1; 1 failing spec (`action_bar_selection.spec.js` tripwire flow) |
| E2E suite | `npm run test:e2e` | FAIL | First run terminated early during execution (no exit code persisted); diagnostic rerun `timeout 900s npm run test:e2e` EXIT_CODE=1 with 53 failed, 1 passed |
| Features check | `npm run check:features` | PASS | EXIT_CODE=0 |
| Audit | `npm run audit` | PASS | EXIT_CODE=0 |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8080/index.html`

### Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › tripwire selection flow across contacts partners pipeline`
- `tests/e2e/calendar_entities.spec.ts` — `Calendar entity semantics › contact and partner events render distinctly and open correct editors`
- `tests/e2e/dashboard_header.spec.js` — `Dashboard Header & Toggle Parity › Dashboard loads with persistent header and without Configurable hero`
- `tests/e2e/navigation_editors.spec.ts` — `Dashboard drilldown smoke › New+ and widget drilldowns open editors`
- `tests/e2e/smoke.spec.js` — `CRM smoke › boots without console errors`

### npm run audit (FAIL)
Key error line: `N/A (suite passed; EXIT_CODE=0)`

## Top 5 remaining failure clusters
1. WebServer/baseURL/connection failures (`ERR_CONNECTION_REFUSED` dominating test:e2e failures).
2. Dashboard header/toggles parity checks failing after server instability.
3. Labs drilldowns/parity suite failures tied to navigation/setup failures.
4. Mutation repaint + editor lifecycle flows failing in longer E2E run.
5. Persistence checks (loan stage/checklist/notifications/print/recovery) failing in the same connection-failure window.
