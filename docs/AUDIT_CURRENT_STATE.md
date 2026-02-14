# AUDIT_CURRENT_STATE

## Current State
The current `main` snapshot is **functional for core boot + unit paths**, but **not release-stable** for end-to-end parity across Dashboard/Labs/selection flows. Boot smoke, feature checks, and all unit tests passed, and core architecture remains the same offline-first IndexedDB + localStorage hybrid. However, the full Playwright suite reports broad regressions concentrated in configurable dashboard controls, selection tripwires, and multiple Labs drilldown interactions.

Architecture-wise, the app is still running the intended phased boot strategy (`boot_hardener` + manifest + phases), local-first data model, and route/view lifecycle. But there is still mixed legacy/new behavior in several areas (notably notifications and documents persistence paths), and test evidence shows unstable UI behavior under repeated cross-view interaction.

## Verification Commands Run (exact)
1. `npm ci`
2. `npm run verify:build`
3. `npm run test:unit`
4. `npm run test:e2e`
5. `npm run test:counts`
6. `npm run check:features`
7. `node devtools/audit.mjs`

### Pass/Fail Snapshot
- `npm ci` → **PASS** (with mirror/proxy warnings during Playwright browser download fallback).
- `npm run verify:build` → **PASS**.
- `npm run test:unit` → **PASS** (59/59).
- `npm run test:e2e` → **FAIL** (16 failed, 35 passed).
- `npm run test:counts` → **FAIL** (1 failed, 7 passed).
- `npm run check:features` → **PASS**.
- `node devtools/audit.mjs` → **FAIL** (`MODULE_NOT_FOUND`: `devtools/audit.mjs` missing).

### Failing Test Names + Short Log Snippets
- `tests/e2e/action_bar_selection.spec.js` → `tripwire selection flow across contacts partners pipeline`
  - Snippet: `Timeout 15000ms exceeded while waiting on the predicate` in `waitForActionBarSelection`.
- `tests/e2e/configurable_dashboard.spec.js` (multiple failures)
  - Snippet: tab/header/controls/dirty indicator assertions failing for "Dashboard (Configurable)".
- `tests/e2e/contact_delete.spec.js` → `bulk delete updates UI immediately`.
- `tests/e2e/dashboard_header.spec.js` → `Switching to All mode shows Labs View`.
- `tests/e2e/dashboard_widget_drilldown.spec.ts` → Priority Actions rerender drilldown mismatch.
- `tests/e2e/labs_parity_core.spec.js`
  - Snippet: expected `Today's Work` title not found in `.labs-widget[data-widget-id="today"]`.
- `tests/e2e/labs_parity_interaction.spec.js`
  - Snippet: expected editor modal (`.modal-dialog, .editor-panel`) not visible after Milestones drilldown.
- `node devtools/audit.mjs`
  - Snippet: `Cannot find module '/workspace/CRM_MASTER/devtools/audit.mjs'`.

## Reality Check Table
| Area | Status | Practical Read |
|---|---|---|
| Dashboard vs Labs parity status | **PARTIAL** | Core Labs surfaces mount and many parity tests pass, but key drilldowns and some parity checks fail under interaction/re-render conditions. |
| zNext (Gridstack) progress | **PARTIAL** | Gridstack wiring and persistence exist, but related configurable dashboard e2e checks are currently red. |
| Calendar + legend toggles + color categories | **PARTIAL** | Category accents + legend rendering/persistence exist and packet test passed, but broad suite instability means not fully trusted end-to-end. |
| Seeding (including new seed profiles) | **PARTIAL** | Demo Week profile is wired and e2e-covered; Production-ish option exists in UI but no dedicated e2e assertion found. |
| Status canonicalization + orphan detector | **DONE** | Canonical module + diagnostics panel exist and are covered by unit/e2e tests. |
| Imports/exports/backup/restore integrity | **PARTIAL** | Snapshot/restore flows and notification restore tests exist, but mixed storage model introduces consistency risk and one unit restore path logs notifier storage errors in test harness. |
| Document checklist + Document Center behavior | **PARTIAL** | Contact checklist persistence test passes; Document Center keeps dual persistence fallback (IDB/localStorage), which can diverge from single-source expectations. |
| Notifications consistency (localStorage vs IDB) | **PARTIAL** | Notifier source-of-truth is localStorage while `db.js` special-cases notifications during export/restore; this is operational but still dual-path complexity. |
| Client Portfolio (reports) status | **PARTIAL** | Reports and Labs portfolio widgets/drilldowns exist, but no dedicated end-to-end "client portfolio acceptance" test found proving full reporting lifecycle. |

## Bug + Risk List (ranked)
1. **Critical: Full e2e regression breadth indicates unstable cross-view behavior**  
   16 Playwright failures across selection stability, configurable dashboard, drilldowns, and Labs widgets indicate non-deterministic behavior under realistic user navigation. File pointers: selection tripwire and action bar assertions in `tests/e2e/action_bar_selection.spec.js`; labs/configurable failures in `tests/e2e/labs_parity_core.spec.js`, `tests/e2e/labs_parity_interaction.spec.js`, `tests/e2e/configurable_dashboard.spec.js`.

2. **High: Configurable dashboard contract appears broken vs tests**  
   Gridstack vNext implementation exists, but e2e assertions for configurable tab/header/controls/dirty-state are failing. This points to UI contract drift rather than missing framework wiring. File pointers: `crm-app/js/labs/vnext.js`, `tests/e2e/configurable_dashboard.spec.js`.

3. **High: Selection/action-bar race under route switching**  
   `waitForActionBarSelection` timeout in tripwire flow suggests selection propagation/render sync is still brittle under repeated contacts→partners→pipeline loops. File pointers: `tests/e2e/action_bar_selection.spec.js`, selection service/store integration in `crm-app/js/services/selection.js`, `crm-app/js/state/selectionStore.js`, `crm-app/js/ui/action_bar.js`.

4. **Medium: Notifications persistence is still dual-path (IDB + localStorage bridge)**  
   Notifier is localStorage-first (`notifications:queue`), while DB export/restore special-cases notifications and bypasses normal store path. It works in the happy path test but remains a consistency risk. File pointers: `crm-app/js/notifications/notifier.js`, `crm-app/js/db.js`, `tests/e2e/notifications_restore.spec.js`.

5. **Medium: Document Center persistence can split source-of-truth**  
   Document Center uses IDB when available but silently falls back to localStorage; this keeps UX resilient but introduces possible divergence if IDB reads/writes are intermittent. File pointers: `crm-app/js/doccenter_rules.js`, `crm-app/js/contacts.js`, `tests/e2e/contact_doc_checklist.spec.js`.

## Hidden / Tucked-Away Features Inventory
- **Safe mode route toggle**: `?safe=1` and `localStorage.SAFE=1` disable patch loading/boot animation behaviors (`isSafeMode`).
- **Internal feature status map**: hidden/zombie surfaces (`printSuite`, `templates`, `legacyAutomations`) tracked in internal map.
- **Dormant/low-visibility routes**:
  - Router pattern table only maps a small subset (`dashboard`, `labs`, `partners`, `workbench`).
  - App hash map still includes additional views (`reports`, `templates`, `print`, `longshots`, optional `notifications`).
- **Feature-flagged notifications surface**: `notificationsMVP` gate affects module load and nav exposure.
- **Partially-built module posture signals**:
  - vNext labeled explicitly as a spike in file header.
  - legacy patch bundles continue to coexist with migrated flow.

## Validation Sanity (early-funnel realism)
Current validation is **strict for early funnel**: email and phone are required even for initial-stage contacts, and invalid/missing values are hard errors in shared schema validation. That can block realistic novice LO intake where lead records often begin incomplete and are enriched later. The importer unit output confirms normalization and review flags, but base schema still returns required-field errors for missing email/phone.

Practical conclusion: validation is technically coherent, but may be too strict for real "just got a lead" workflow unless UI intentionally supports staged save/draft semantics.

## Workflow + Automation Sanity
- **CTC/status normalization**: Canonical stage/status machinery is present and tested; alias handling (`CTC`, `clear_to_close`) routes to canonical values.
- **Orphan diagnostics**: Settings diagnostics scans contacts/deals/documents/tasks and reports canonical/orphan buckets deterministically.
- **UI vs stored-data consistency risks**:
  - Notifications use localStorage source with export/restore bridge in DB layer.
  - Document center checklist can use IDB or localStorage fallback.
  - These are survivable, but they raise divergence risk across import/export/restore and long-running sessions.

## Verification of Recent Merged Work
### 1) Select-all/action bar hardening + Playwright stabilization
- **Behavior check**: Partial. Most action-bar tests pass, but tripwire still fails in one route-cycle case.
- **Tests**:
  - Found: `tests/e2e/action_bar_selection.spec.js` (broad coverage).
  - Result: 1 failing test in `npm run test:counts`; additional failure in full e2e run.

### 2) Calendar category accents + legend toggles (persist + filter)
- **Behavior check**: Partial-pass based on packet test + implementation review.
- **Tests**:
  - Found: `tests/e2e/calendar_packet_b.spec.js` (legend + category diversity assertions).
  - **No direct test found** asserting legend toggle persistence across reload specifically.

### 3) Seed Profiles in Settings ("Demo Week" vs "Production-ish")
- **Behavior check**: Partial.
- **Tests**:
  - Found: `tests/e2e/calendar_packet_b.spec.js` (Demo Week path).
  - **No test found** explicitly executing/validating `production-ish` profile.

### 4) Canonical stage/status mapping + Orphan Detector panel in Settings
- **Behavior check**: Confirmed.
- **Tests**:
  - Found: `tests/unit/status_canonical.test.js` (stage alias canonicalization).
  - Found: `tests/e2e/data_diagnostics.spec.js` (orphan/canonical output in Settings panel).

### 5) Document Center/widget clarity changes
- **Behavior check**: Partial.
- **Tests**:
  - Found: `tests/e2e/contact_doc_checklist.spec.js` for checklist persistence.
  - **No test found** explicitly covering "Document Center/widget clarity" copy/UX presentation changes.

## Routing / Boot / Storage / Core Flow File Pointers
- Boot hardener + safe mode + completion signals: `crm-app/js/boot/boot_hardener.js`
- Manifest core/patch loading: `crm-app/js/boot/manifest.js`
- Boot phases and prereq contracts: `crm-app/js/boot/phases.js`
- Router init + default hash/home view: `crm-app/js/router/init.js`
- Router pattern table: `crm-app/js/router/patterns.js`
- IndexedDB stores + export/restore: `crm-app/js/db.js`
- Settings storage and profile keys: `crm-app/js/data/settings.js`
- Seed profiles and profile runner: `crm-app/js/seed_full.js`
- Calendar legend + category accents + persistence key: `crm-app/js/calendar/legend.js`, `crm-app/js/calendar/constants.js`, `crm-app/js/calendar_impl.js`
- Contacts/editor/checklist flow: `crm-app/js/contacts.js`
- Document Center rules/persistence adapter: `crm-app/js/doccenter_rules.js`, `crm-app/js/doc/doc_center_enhancer.js`
- Importer core + contact/partner import pipelines: `crm-app/js/importer.js`, `crm-app/js/importer_contacts.js`, `crm-app/js/importer_partners.js`
- Labs + zNext configurable dashboard: `crm-app/js/labs/dashboard.js`, `crm-app/js/labs/vnext.js`
- Reports/client portfolio logic: `crm-app/js/reports.js`, `crm-app/js/labs/portfolio_drilldown.js`
- Notifications queue manager: `crm-app/js/notifications/notifier.js`
- Relevant verification tests: `tests/e2e/*`, `tests/unit/*`, `tools/boot_smoke_test.mjs`

## Manual Proof (steps + expected results)
1. Open app at `/#/settings` and run **Demo Week** seed profile.  
   Expected: seed completes; events/pipeline/contact data materially increase.
2. Navigate to `/#/calendar`.  
   Expected: legend chips visible; multiple event categories rendered; category chips mutate visible events.
3. Navigate to `/#/contacts`, select row(s), then use select-all and clear repeatedly.  
   Expected: action bar count/visibility always matches checked state.
4. Navigate across `contacts -> partners -> pipeline` and repeat selection cycles.  
   Expected: no stuck action bar, no hidden selection residue, no console subscriber errors.
5. Open contact editor from dashboard/labs drilldown, toggle document checklist item, reload page, reopen same contact.  
   Expected: checklist state persists and editor close/open lifecycle remains stable.
6. Run Settings Data Diagnostics panel scan.  
   Expected: canonical and orphan values are displayed with deterministic counts/examples.

## Regression Confirmation (requested areas)
- **App boot**: smoke/feature checks pass; boot contract still operational.
- **Navigation**: mostly working; cross-view e2e failures indicate regressions under heavier interaction.
- **New+ behavior**: covered in navigation/editor smoke tests and unit checks; no hard failure surfaced in this run.
- **Editor open/close lifecycle**: core flows work, but some Labs drilldown tests fail to open expected modal/editor reliably.
