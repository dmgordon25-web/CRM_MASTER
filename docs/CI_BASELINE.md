# CI Baseline
- Timestamp (UTC): 2026-02-16T08:47:51Z
- Commit tested: e8618d6703ddda01d5f43891977f3645ac8b726e
- Repository sync note: Unable to fetch/pull from `origin` in this environment (`fatal: 'origin' does not appear to be a git repository`), so baseline was run against the current local branch state.

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
| Install | `npm ci` | PASS | EXIT_CODE=0; postinstall Playwright dependency install completed with apt warning for `mise.jdx.dev` mirror, then continued successfully. |
| Build verification | `npm run verify:build` | PASS | EXIT_CODE=0; manifest audit + boot smoke passed. |
| Unit tests | `npm run test:unit` | PASS | EXIT_CODE=0; 15 files / 59 tests passed. |
| Counts suite | `npm run test:counts` | PASS | EXIT_CODE=0; 8 passed. |
| E2E suite | `npm run test:e2e` | FAIL | EXIT_CODE=1; 5 failed, 49 passed (7.7m). |
| Feature checks | `npm run check:features` | PASS | EXIT_CODE=0; boot smoke passed. |
| Audit | `npm run audit` | PASS | EXIT_CODE=0; `[audit] OK: manifest + feature checks passed`. |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `Error: expect(received).toBe(expected) // Object.is equality`

#### Failing specs list (spec file — test title)
- `tests/e2e/action_bar_selection.spec.js` — Action Bar Selection › tripwire selection flow across contacts partners pipeline
- `tests/e2e/backup_restore_roundtrip.spec.js` — Snapshot backup/restore roundtrip › restores IDB data plus primary localStorage keys
- `tests/e2e/contact_delete.spec.js` — Contact Deletion › bulk delete updates UI immediately
- `tests/e2e/dashboard_widget_drilldown.spec.ts` — Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender
- `tests/e2e/select_all.spec.js` — Select All Regression Proof › Select All behaves correctly with partial selection

### npm run audit (PASS)
Key error line: N/A (suite passed).

## Top 5 remaining failure clusters
1. **Action bar selection state parity**
   - `action_bar_selection.spec.js` tripwire failed waiting for visible action bar/count sync.
   - `select_all.spec.js` failed on expected `data-count` vs actual `0`.

2. **Backup/restore API surface**
   - `backup_restore_roundtrip.spec.js` failed with `TypeError` on `restoreJSON` being undefined.

3. **Deletion/render consistency**
   - `contact_delete.spec.js` failed due to duplicate row locator resolution when verifying hidden state after delete.

4. **Dashboard widget drilldown lifecycle**
   - `dashboard_widget_drilldown.spec.ts` failed to find expected Priority Actions row with required widget attributes.

5. **Cross-surface mutation propagation timing/assertions**
   - Multiple failing assertions indicate selection/mutation propagation inconsistencies across Contacts/Dashboard surfaces rather than network connection refusal/startup errors.
