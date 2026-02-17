# FAILURES
Current failing command: npm run test:counts

Primary failure signature:
- `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:8080/#contacts`
- Affected tests:
  - should show action bar when multiple rows are selected
  - should show action bar for partners selection
  - should show action bar for pipeline selection
  - should keep action bar in sync for select-all and clear
  - should toggle select-all across contacts partners pipeline
  - should keep action bar stable across tab switching select-all cycles
  - tripwire selection flow across contacts partners pipeline

Recent log tail:
  7 failed
    [chromium] › tests/e2e/action_bar_selection.spec.js:173:9 › Action Bar Selection › should show action bar when multiple rows are selected
    [chromium] › tests/e2e/action_bar_selection.spec.js:191:9 › Action Bar Selection › should show action bar for partners selection
    [chromium] › tests/e2e/action_bar_selection.spec.js:206:9 › Action Bar Selection › should show action bar for pipeline selection
    [chromium] › tests/e2e/action_bar_selection.spec.js:225:9 › Action Bar Selection › should keep action bar in sync for select-all and clear
    [chromium] › tests/e2e/action_bar_selection.spec.js:255:9 › Action Bar Selection › should toggle select-all across contacts partners pipeline
    [chromium] › tests/e2e/action_bar_selection.spec.js:261:9 › Action Bar Selection › should keep action bar stable across tab switching select-all cycles
    [chromium] › tests/e2e/action_bar_selection.spec.js:279:9 › Action Bar Selection › tripwire selection flow across contacts partners pipeline
  1 passed (21.3s)
