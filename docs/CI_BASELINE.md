# CI Baseline
- Timestamp (UTC): 2026-02-17T04:52:17Z
- Commit tested: 911139407c5fd841519892c8174aaf5ebfe4fbeb
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
```

## PASS/FAIL summary
| Suite | Command | Status | Notes |
| Suite | Command | Status | Notes |
| Install | npm ci | PASS | EXIT_CODE=0 |
| Build verify | npm run verify:build | PASS | EXIT_CODE=0 |
| Unit tests | npm run test:unit | PASS | EXIT_CODE=0; 15 files / 59 tests passed |
| Counts suite | npm run test:counts | PASS | EXIT_CODE=0; 8 passed |
| E2E suite | npm run test:e2e | FAIL | Initial run terminated early/hung during execution; diagnostic rerun `timeout 900s npm run test:e2e` => EXIT_CODE=1 with 5 failed, 49 passed |
| Features check | npm run check:features | PASS | EXIT_CODE=0 |
| Audit | npm run audit | PASS | EXIT_CODE=0 |

## Failing suite details
### npm run test:e2e (FAIL)
Key error line: `Error: expect(locator).toBeChecked() failed`

### Failing specs list (spec file — test title)
- tests/e2e/action_bar_selection.spec.js — Action Bar Selection › should keep action bar stable across tab switching select-all cycles
- tests/e2e/contact_delete.spec.js — Contact Deletion › bulk delete updates UI immediately
- tests/e2e/contact_doc_checklist.spec.js — contact document checklist › persists checklist toggles across reload
- tests/e2e/dashboard_widget_drilldown.spec.ts — Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender
- tests/e2e/labs_znext_render.spec.js — Labs zNext Engine Render Verification

### npm run audit (PASS)
Key error line: `[audit] OK: manifest + feature checks passed`

## Top 5 remaining failure clusters
1. Action bar selection stability across tab switching + select-all cycles.
2. Contact deletion UI update lifecycle.
3. Contact document checklist persistence across reload.
4. Dashboard Priority Actions drilldown/editor open lifecycle after rerender.
5. Labs zNext grid render sizing/parity (grid height expectation unmet).
