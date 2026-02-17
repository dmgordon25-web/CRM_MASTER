# CI Failures Snapshot

## Full gate run (`npm run test:e2e`)
Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

### 1) `tests/e2e/action_bar_selection.spec.js`
- Test: `tripwire selection flow across contacts partners pipeline`
- Assertion:
  - `expect.poll(...).toBe(true)` timed out in `waitForActionBarSelection`
  - `Expected: true`
  - `Received: false`

### 2) `tests/e2e/contact_delete.spec.js`
- Test: `bulk delete updates UI immediately`
- Assertion:
  - `expect(locator('tr[data-id="del-1"]')).toBeHidden()` failed due strict mode violation
  - Locator resolved to 2 elements (duplicate `tr[data-id="del-1"]`)

### 3) `tests/e2e/contact_doc_checklist.spec.js`
- Test: `persists checklist toggles across reload`
- Assertion:
  - Fails during persisted checklist verification after reload (spec listed failing in full run)

### 4) `tests/e2e/dashboard_widget_drilldown.spec.ts`
- Test: `Priority Actions opens the correct contact before and after rerender`
- Assertion:
  - `expect(locator('#priority-actions-card li[data-contact-id="boot-smoke-priority-contact"]').first()).toHaveAttribute('data-widget', /priorityActions/)`
  - `Received: <element(s) not found>`

### 5) `tests/e2e/navigation_editors.spec.ts`
- Test: `New+ and widget drilldowns open editors`
- Assertion:
  - Timeout closing partner modal
  - `locator('[data-ui="partner-edit-modal"], #partner-modal').locator('[data-close],[data-close-partner],[data-ui="close"]').first().click()`
  - element resolved but not visible

## Isolated reproductions run

### `npx playwright test tests/e2e/contact_delete.spec.js --project=chromium --workers=1 --retries=0 --trace=on`
- Reproduced failure with duplicate `tr[data-id="del-1"]` strict-mode error.

### `npx playwright test tests/e2e/action_bar_selection.spec.js -g "tripwire selection flow" --project=chromium --workers=1 --retries=0 --trace=on`
- Passed once (indicates flake; still fails in suite).
