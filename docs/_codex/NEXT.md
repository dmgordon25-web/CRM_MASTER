# Exact Next Steps

1. Reproduce each failing spec with trace:

```bash
npx playwright test tests/e2e/action_bar_selection.spec.js -g "tripwire selection flow" --project=chromium --workers=1 --retries=0 --trace=on
npx playwright test tests/e2e/contact_delete.spec.js --project=chromium --workers=1 --retries=0 --trace=on
npx playwright test tests/e2e/contact_doc_checklist.spec.js --project=chromium --workers=1 --retries=0 --trace=on
npx playwright test tests/e2e/dashboard_widget_drilldown.spec.ts -g "Priority Actions opens the correct contact before and after rerender" --project=chromium --workers=1 --retries=0 --trace=on
npx playwright test tests/e2e/navigation_editors.spec.ts -g "New+ and widget drilldowns open editors" --project=chromium --workers=1 --retries=0 --trace=on
```

2. After each fix, run 5x stability loop per spec:

```bash
for i in 1 2 3 4 5; do npx playwright test <SPEC> --project=chromium --workers=1 --retries=0; done
```

3. Run regression gate:

```bash
npm run test:counts
timeout 900s npm run test:e2e
```

4. Run full gate in order:

```bash
npm ci
npm run verify:build
npm run test:unit
npm run test:counts
npm run test:e2e
npm run check:features
npm run audit
```
