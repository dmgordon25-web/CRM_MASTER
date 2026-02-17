# Failures Log

Timestamp: 2026-02-17T18:37:06Z
Git HEAD: e365fc7cee490d785fb82c444a20ee9437677974

## Phase 1 capture
Commands run:
- npm ci ✅
- npm run verify:build ✅
- npm run test:unit ✅
- npm run test:counts ✅
- timeout 900s npm run test:e2e (terminated after failures observed)

Observed failing specs/assertions:
1) tests/e2e/action_bar_selection.spec.js
   - tripwire selection flow across contacts partners pipeline
   - expect.poll in waitForActionBarSelection timed out waiting for action bar visible with count >= 1
   - Assertion location: tests/e2e/action_bar_selection.spec.js:24 and :312

2) tests/e2e/calendar_entities.spec.ts
   - contact and partner events render distinctly and open correct editors
   - failed during Phase 1 full e2e run at spec line tests/e2e/calendar_entities.spec.ts:86

Harness behavior:
- Full npm run test:e2e was manually terminated during early-failure capture after 18 tests; no hard hang confirmed in this pass.

## Latest focused run failures
Command:
- npx playwright test tests/e2e/action_bar_selection.spec.js --project=chromium --workers=1 --retries=0 --trace=on --reporter=line

Failure:
- tests/e2e/action_bar_selection.spec.js:279 tripwire selection flow across contacts partners pipeline
- same expect.poll timeout in waitForActionBarSelection (line 24, call at line 312)
- trace artifact: test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/trace.zip
