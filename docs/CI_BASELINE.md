# CI Baseline
- Timestamp (UTC): 2026-02-17T20:18:59Z
- Commit tested: 59129725fb64db4ca8df97271a2eab42be6b8d66
- Repository sync note: Unable to fetch `origin/main` in this environment (`origin` remote is not configured), so baseline was run against the current local branch tip.

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
|---|---|---|---|
| Install | `npm ci` | PASS | EXIT_CODE=0 |
| Build verification | `npm run verify:build` | PASS | EXIT_CODE=0 |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0 |
| Counts suite | `npm run test:counts` | FAIL | EXIT_CODE=1; 1 failing spec (`tripwire selection flow across contacts partners pipeline`) |
| E2E suite | `npm run test:e2e` | FAIL | EXIT_CODE=1; 4 failing specs, 50 passed |
| Feature checks | `npm run check:features` | PASS | EXIT_CODE=0 |
| Audit | `npm run audit` | PASS | EXIT_CODE=0 |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `4 failed ... 50 passed (8.8m)`

Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › tripwire selection flow across contacts partners pipeline`
- `tests/e2e/calendar_entities.spec.ts` — `Calendar entity semantics › contact and partner events render distinctly and open correct editors`
- `tests/e2e/contact_delete.spec.js` — `Contact Deletion › bulk delete updates UI immediately`
- `tests/e2e/dashboard_widget_drilldown.spec.ts` — `Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender`

### npm run test:counts (FAIL)
Key error line: `1 failed ... 7 passed (1.7m)`

Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › tripwire selection flow across contacts partners pipeline`

### npm run audit (FAIL)
Key error line: N/A (suite passed in this run: `[audit] OK: manifest + feature checks passed`)

## Top 5 remaining failure clusters
1. **Selection/action bar stability**
   - `action_bar_selection.spec.js` fails in both `test:counts` and `test:e2e` during poll-based visibility/count assertion.
2. **Calendar event interaction lifecycle**
   - `calendar_entities.spec.ts` times out while clicking partner event due to repeated DOM detachment/pointer interception.
3. **Delete mutation repaint/state sync**
   - `contact_delete.spec.js` fails because deleted rows remain visible when they are expected hidden.
4. **Dashboard priority drilldown editor-open reliability**
   - `dashboard_widget_drilldown.spec.ts` times out waiting for expected contact modal open signal.
5. **Cross-surface rerender contention**
   - Multiple failing specs show render/interaction races after mutations/navigation (selection visibility, detached nodes, modal open signal timing).
