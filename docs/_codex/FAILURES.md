Failing assertion (latest full gate):
[chromium] tests/e2e/action_bar_selection.spec.js:261:9
expect(locator('[data-ui="action-bar"]').first()).not.toBeVisible()
Expected: not visible
Received: visible
Observed element: <div id="actionbar" ... data-count="1" data-scope="contacts" class="actionbar has-selection">...</div>

Additional full-suite failures in same run:
- tests/e2e/action_bar_selection.spec.js:225:9
- tests/e2e/action_bar_selection.spec.js:279:9
- tests/e2e/contact_delete.spec.js:4:5
- tests/e2e/dashboard_widget_drilldown.spec.ts:261:7
- tests/e2e/navigation_editors.spec.ts:140:7

Last 200 lines of relevant logs (/tmp/gate_test_e2e.log):
  1) [chromium] › tests/e2e/action_bar_selection.spec.js:225:9 › Action Bar Selection › should keep action bar in sync for select-all and clear › Expect "poll toBe" 

    Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

    Expected: [32mtrue[39m
    Received: [31mfalse[39m

    Call Log:
    - Timeout 15000ms exceeded while waiting on the predicate

      22 |
      23 | async function waitForActionBarSelection(page, table, actionBar, minCount = 1) {
    > 24 |     await expect.poll(async () => {
         |     ^
      25 |         const count = Number(await actionBar.getAttribute('data-count') || '0');
      26 |         const visible = await actionBar.isVisible();
      27 |         return visible && count >= minCount;
        at waitForActionBarSelection (/workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:24:5)
        at /workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:246:9

    Error Context: test-results/action_bar_selection-Actio-58d45-nc-for-select-all-and-clear-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/action_bar_selection-Actio-58d45-nc-for-select-all-and-clear-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/action_bar_selection-Actio-58d45-nc-for-select-all-and-clear-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  2) [chromium] › tests/e2e/action_bar_selection.spec.js:261:9 › Action Bar Selection › should keep action bar stable across tab switching select-all cycles › Expect "poll toBe" 

    Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

    Expected: [32mtrue[39m
    Received: [31mfalse[39m

    Call Log:
    - Timeout 15000ms exceeded while waiting on the predicate

      22 |
      23 | async function waitForActionBarSelection(page, table, actionBar, minCount = 1) {
    > 24 |     await expect.poll(async () => {
         |     ^
      25 |         const count = Number(await actionBar.getAttribute('data-count') || '0');
      26 |         const visible = await actionBar.isVisible();
      27 |         return visible && count >= minCount;
        at waitForActionBarSelection (/workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:24:5)
        at assertSelectAllToggle (/workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:130:5)
        at /workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:271:13

    Error Context: test-results/action_bar_selection-Actio-04e45-switching-select-all-cycles-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/action_bar_selection-Actio-04e45-switching-select-all-cycles-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/action_bar_selection-Actio-04e45-switching-select-all-cycles-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  3) [chromium] › tests/e2e/action_bar_selection.spec.js:279:9 › Action Bar Selection › tripwire selection flow across contacts partners pipeline › Expect "poll toBe" 

    Error: [2mexpect([22m[31mreceived[39m[2m).[22mtoBe[2m([22m[32mexpected[39m[2m) // Object.is equality[22m

    Expected: [32mtrue[39m
    Received: [31mfalse[39m

    Call Log:
    - Timeout 15000ms exceeded while waiting on the predicate

      22 |
      23 | async function waitForActionBarSelection(page, table, actionBar, minCount = 1) {
    > 24 |     await expect.poll(async () => {
         |     ^
      25 |         const count = Number(await actionBar.getAttribute('data-count') || '0');
      26 |         const visible = await actionBar.isVisible();
      27 |         return visible && count >= minCount;
        at waitForActionBarSelection (/workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:24:5)
        at /workspace/CRM_MASTER/tests/e2e/action_bar_selection.spec.js:312:13

    Error Context: test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  4) [chromium] › tests/e2e/contact_delete.spec.js:4:5 › Contact Deletion › bulk delete updates UI immediately 

    Error: expect.toBeHidden: Error: strict mode violation: locator('tr[data-id="del-1"]') resolved to 2 elements:
        1) <tr data-city="" data-loan="" data-owner="" data-phone="" data-id="del-1" data-amount="0" data-last-touch="" data-next-action="" data-ref="none|none" data-name="delete me1" data-contact-id="del-1" data-stage="application" data-status="inprogress" data-row-tone="qualified" data-created-at="2026-02-17" data-updated-at="2026-02-17" data-email="del1@example.com" data-stage-canonical="qualified" data-pipeline-milestone="application submitted" class="status-row contact-stage-row stage-qualified">…</tr> aka getByText('☆Delete Me1Qualified—')
        2) <tr data-city="" data-loan="" data-owner="" data-phone="" data-id="del-1" data-amount="0" data-selected="1" data-last-touch="" data-next-action="" data-ref="none|none" data-name="delete me1" data-contact-id="del-1" data-stage="application" data-status="inprogress" data-row-tone="qualified" data-created-at="2026-02-17" data-updated-at="2026-02-17" data-email="del1@example.com" data-stage-canonical="qualified" data-pipeline-milestone="application submitted" class="status-row contact-stage-row stage-…>…</tr> aka getByRole('row', { name: 'Add contact to favorites Delete Me1 del1@example.com — — inprogress —' })

    Call log:
    [2m  - Expect "toBeHidden" with timeout 5000ms[22m
    [2m  - waiting for locator('tr[data-id="del-1"]')[22m


      102 |
      103 |         // 5. Verify rows are gone immediately
    > 104 |         await expect(page.locator('tr[data-id="del-1"]')).toBeHidden();
          |                                                           ^
      105 |         await expect(page.locator('tr[data-id="del-2"]')).toBeHidden();
      106 |         await expect(page.locator('tr[data-id="del-3"]')).toBeHidden();
      107 |
        at /workspace/CRM_MASTER/tests/e2e/contact_delete.spec.js:104:59

    Error Context: test-results/contact_delete-Contact-Del-45a6c-lete-updates-UI-immediately-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/contact_delete-Contact-Del-45a6c-lete-updates-UI-immediately-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/contact_delete-Contact-Del-45a6c-lete-updates-UI-immediately-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  5) [chromium] › tests/e2e/dashboard_widget_drilldown.spec.ts:261:7 › Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoHaveAttribute[2m([22m[32mexpected[39m[2m)[22m failed

    Locator: locator('#priority-actions-card li[data-contact-id="boot-smoke-priority-contact"]').first()
    Expected pattern: [32m/priorityActions/[39m
    Received: <element(s) not found>
    Timeout: 15000ms

    Call log:
    [2m  - Expect "toHaveAttribute" with timeout 15000ms[22m
    [2m  - waiting for locator('#priority-actions-card li[data-contact-id="boot-smoke-priority-contact"]').first()[22m


      82 |   }, { contactId: CONTACT_ID, contactName: CONTACT_NAME });
      83 |   const row = page.locator(`#priority-actions-card li[data-contact-id="${CONTACT_ID}"]`).first();
    > 84 |   await expect(row).toHaveAttribute('data-dash-widget', /priorityActions/, { timeout: 15000 });
         |                     ^
      85 |   await expect(row).toHaveAttribute('data-widget', /priorityActions/);
      86 |   return row;
      87 | }
        at ensurePriorityRowReady (/workspace/CRM_MASTER/tests/e2e/dashboard_widget_drilldown.spec.ts:84:21)
        at openAndClosePriorityActionsRow (/workspace/CRM_MASTER/tests/e2e/dashboard_widget_drilldown.spec.ts:249:15)
        at /workspace/CRM_MASTER/tests/e2e/dashboard_widget_drilldown.spec.ts:265:5

    Error Context: test-results/dashboard_widget_drilldown-5ac1a-t-before-and-after-rerender-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/dashboard_widget_drilldown-5ac1a-t-before-and-after-rerender-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/dashboard_widget_drilldown-5ac1a-t-before-and-after-rerender-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  6) [chromium] › tests/e2e/navigation_editors.spec.ts:140:7 › Dashboard drilldown smoke › New+ and widget drilldowns open editors 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m()[22m failed

    Locator:  locator('[data-ui="partner-edit-modal"], #partner-modal')
    Expected: visible
    Received: hidden
    Timeout:  5000ms

    Call log:
    [2m  - Expect "toBeVisible" with timeout 5000ms[22m
    [2m  - waiting for locator('[data-ui="partner-edit-modal"], #partner-modal')[22m
    [2m    9 × locator resolved to <div role="dialog" data-open="0" data-opening="0" id="partner-modal" aria-hidden="true" data-partner-id="" data-ui="partner-edit-modal" class="record-modal modal partner-edit-modal hidden">…</div>[22m
    [2m      - unexpected value "hidden"[22m


      85 |     await closeContactModal(page);
      86 |   } else if (partnerId) {
    > 87 |     await expect(page.locator('[data-ui="partner-edit-modal"], #partner-modal')).toBeVisible({ timeout: 5000 });
         |                                                                                  ^
      88 |     await closePartnerModal(page);
      89 |   } else {
      90 |     throw new Error('Row missing contact/partner id');
        at openRowAndAssertEditor (/workspace/CRM_MASTER/tests/e2e/navigation_editors.spec.ts:87:82)
        at /workspace/CRM_MASTER/tests/e2e/navigation_editors.spec.ts:145:5

    Error Context: test-results/navigation_editors-Dashboa-8e58d-get-drilldowns-open-editors-chromium/error-context.md

    attachment #2: trace (application/zip) ─────────────────────────────────────────────────────────
    test-results/navigation_editors-Dashboa-8e58d-get-drilldowns-open-editors-chromium/trace.zip
    Usage:

        npx playwright show-trace test-results/navigation_editors-Dashboa-8e58d-get-drilldowns-open-editors-chromium/trace.zip

    ────────────────────────────────────────────────────────────────────────────────────────────────

  6 failed
    [chromium] › tests/e2e/action_bar_selection.spec.js:225:9 › Action Bar Selection › should keep action bar in sync for select-all and clear 
    [chromium] › tests/e2e/action_bar_selection.spec.js:261:9 › Action Bar Selection › should keep action bar stable across tab switching select-all cycles 
    [chromium] › tests/e2e/action_bar_selection.spec.js:279:9 › Action Bar Selection › tripwire selection flow across contacts partners pipeline 
    [chromium] › tests/e2e/contact_delete.spec.js:4:5 › Contact Deletion › bulk delete updates UI immediately 
    [chromium] › tests/e2e/dashboard_widget_drilldown.spec.ts:261:7 › Dashboard widget drilldowns › Priority Actions opens the correct contact before and after rerender 
    [chromium] › tests/e2e/navigation_editors.spec.ts:140:7 › Dashboard drilldown smoke › New+ and widget drilldowns open editors 
  48 passed (6.3m)
