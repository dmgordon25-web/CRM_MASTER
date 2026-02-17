# CI Baseline
- Timestamp (UTC): 2026-02-17T19:37:21Z
- Commit tested: d0ca5218757fd310ac147cbe8cb11a159b91df2f
- Repository sync note: Unable to fetch/pull latest `main` because no `origin` remote is configured in this environment (`git fetch origin` failed: "'origin' does not appear to be a git repository").

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

PASS/FAIL summary
| Suite | Command | Status | Notes |
| --- | --- | --- | --- |
| Install deps | `npm ci` | PASS | EXIT_CODE=0; installed packages; reported 7 moderate vulnerabilities. |
| Build verification | `npm run verify:build` | PASS | EXIT_CODE=0; `[manifest-audit] OK`; `[boot-smoke] PASS`. |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0; 15 files / 59 tests passed. |
| Count tests | `npm run test:counts` | FAIL | EXIT_CODE=1; 1 failed, 7 passed (Playwright subset). |
| E2E tests | `npm run test:e2e` | FAIL | Initial run terminated early/hung; diagnostic rerun executed with `timeout 900s npm run test:e2e`; diagnostic EXIT_CODE=1 with 3 failed, 51 passed. |
| Feature checks | `npm run check:features` | PASS | EXIT_CODE=0; `[boot-smoke] PASS`. |
| Audit gate | `npm run audit` | PASS | EXIT_CODE=0; `[audit] OK: manifest + feature checks passed`. |

Failing suite details
npm run test:e2e (FAIL)
Key error line: `3 failed`

Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › tripwire selection flow across contacts partners pipeline`
- `tests/e2e/contact_delete.spec.js` — `Contact Deletion › bulk delete updates UI immediately`
- `tests/e2e/dashboard_widget_drilldown.spec.ts` — `Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender`

npm run audit (FAIL)
Key error line: `N/A (PASS in this run: [audit] OK: manifest + feature checks passed)`

Top 5 remaining failure clusters
Group the remaining issues by area (examples):

- Action bar selection stability/tripwire parity (contacts/partners/pipeline flow)
- Contact deletion UI consistency (duplicate row visibility after delete)
- Dashboard Priority Actions drilldown/render parity across rerenders
- Selftest/manifest patch diagnostics noise during e2e (`PATCHES_MISSING`, `app:data:changed` warnings)
- Counts/e2e coverage mismatch due selection tripwire regression (`test:counts` fails on same area)
