# CI Baseline
- Timestamp (UTC): 2026-02-16T18:45:39Z
- Commit tested: d807eb6935ec6d30bf8e9d3e841677d0ebc16f37
- Repository sync note: Could not fetch/pull latest main because no `origin` remote is configured in this checkout (`fatal: 'origin' does not appear to be a git repository`). Baseline executed against current local HEAD.

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
| Install | `npm ci` | PASS | EXIT_CODE=0; install completed with npm warnings and 3 moderate vulnerabilities reported. |
| Build verify | `npm run verify:build` | PASS | EXIT_CODE=0; manifest audit + boot smoke passed. |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0; 15 files, 59 tests passed. |
| Counts suite | `npm run test:counts` | FAIL | EXIT_CODE=1; 1 failing spec in `action_bar_selection.spec.js` tripwire flow. |
| E2E suite | `npm run test:e2e` | FAIL | EXIT_CODE=1; 5 failing specs, 49 passed. |
| Features check | `npm run check:features` | PASS | EXIT_CODE=0; boot smoke PASS. |
| Audit | `npm run audit` | PASS | EXIT_CODE=0; `[audit] OK: manifest + feature checks passed`. |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `Test timeout of 60000ms exceeded.`

#### Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › should keep action bar in sync for select-all and clear`
- `tests/e2e/action_bar_selection.spec.js` — `Action Bar Selection › tripwire selection flow across contacts partners pipeline`
- `tests/e2e/calendar_entities.spec.ts` — `Calendar entity semantics › contact and partner events render distinctly and open correct editors`
- `tests/e2e/contact_delete.spec.js` — `Contact Deletion › bulk delete updates UI immediately`
- `tests/e2e/navigation_editors.spec.ts` — `Dashboard drilldown smoke › New+ and widget drilldowns open editors`

### npm run audit (PASS)
Key error line: `N/A (suite passed; [audit] OK: manifest + feature checks passed)`

## Top 5 remaining failure clusters
1. Action bar selection state sync (`data-visible`/selection tripwire inconsistencies).
2. Calendar entity interaction/open-editor flow timeouts.
3. Contact deletion immediate repaint/row removal verification.
4. Editor lifecycle close interaction blocked/intercepted in dashboard drilldown smoke.
5. Cross-surface interaction stability under longer E2E flows (timeout-prone assertion chains).
