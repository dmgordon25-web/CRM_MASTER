# CI Baseline
- Timestamp (UTC): 2026-02-16T06:04:35Z
- Commit tested: 26e4cff1dfe38e6863aee8e8998b30fe3814eb98
- Repository sync note: Unable to fetch/pull latest `main` because no `origin` remote is configured in this local clone.

## Commands run
```bash
npm ci
npm run verify:build
npm run test:unit
npm run test:counts
npm run test:e2e
npm run check:features
npm run audit
```

## PASS/FAIL summary
| Suite | Command | Status | Notes |
| --- | --- | --- | --- |
| Install | `npm ci` | PASS | EXIT_CODE=0; completed postinstall playwright setup with apt proxy warning. |
| Build verification | `npm run verify:build` | PASS | EXIT_CODE=0; manifest audit + boot smoke passed. |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0; 15 files, 59 tests passed. |
| E2E subset counts | `npm run test:counts` | FAIL | EXIT_CODE=1; 2 failures in `tests/e2e/action_bar_selection.spec.js`. |
| Full E2E | `npm run test:e2e` | FAIL | EXIT_CODE=1; 3 failed, 49 passed (52 total). |
| Feature checks | `npm run check:features` | PASS | EXIT_CODE=0; boot-smoke PASS. |
| Audit | `npm run audit` | PASS | EXIT_CODE=0; `[audit] OK: manifest + feature checks passed`. |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `Error: expect(locator).toHaveAttribute(expected) failed`.

#### Failing specs list (spec file — test title)
- `tests/e2e/contact_delete.spec.js` — `Contact Deletion › bulk delete updates UI immediately`
- `tests/e2e/dashboard_widget_drilldown.spec.ts` — `Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender`
- `tests/e2e/navigation_editors.spec.ts` — `Dashboard drilldown smoke › New+ and widget drilldowns open editors`

### npm run audit (FAIL)
Key error line: `N/A (command passed: [audit] OK: manifest + feature checks passed)`.

## Top 5 remaining failure clusters
1. WebServer/baseURL/connection
   - No dominant connection failures in this run; failures are assertion-driven.
2. Dashboard header/toggles
   - No failures observed in `dashboard_header.spec.js` in this run.
3. Labs drilldowns/parity
   - Priority Actions drilldown rerender path fails to locate expected row/widget attributes.
4. Mutation repaint + editor lifecycle
   - New+/drilldown editor lifecycle mismatch: partner edit modal expected visible but remained hidden.
5. Persistence checks (loan stage/checklist/notifications/print/recovery)
   - Persistence suites in this run were green; remaining failure is contact delete immediate UI update assertion.
