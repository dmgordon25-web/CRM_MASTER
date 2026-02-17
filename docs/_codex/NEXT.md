# Next Steps

1) Continue hardening action-bar selection derivation for tripwire instability in tests/e2e/action_bar_selection.spec.js.
   - Remaining failing command:
     npx playwright test tests/e2e/action_bar_selection.spec.js --project=chromium --workers=1 --retries=0 --trace=on --reporter=line

2) Once action_bar_selection is 5/5 consecutive green, run/fix remaining requested failing specs one-by-one with 5x pass proof:
   - tests/e2e/contact_delete.spec.js
   - tests/e2e/contact_doc_checklist.spec.js
   - tests/e2e/dashboard_widget_drilldown.spec.ts
   - tests/e2e/labs_znext_render.spec.js

3) Re-run full stability and gate sequence:
   - for i in $(seq 1 30); do npm run test:counts || exit 1; done
   - timeout 900s npm run test:e2e
   - npm ci
   - npm run verify:build
   - npm run test:unit
   - npm run test:counts
   - npm run test:e2e
   - npm run check:features
   - npm run audit

4) Investigate calendar_entities full-suite failure captured in phase 1 once action-bar flake is resolved.
