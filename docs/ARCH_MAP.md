# ARCH_MAP — Patch Loading Audit (No Behavior Changes)

## Scope
This map documents the current patch-loading path in `CRM_MASTER` as implemented today.

## Where patch files are referenced

1. **`crm-app/index.html`**
   - The boot module inlines imports for `ensureCoreThenPatches` and `CORE/PATCHES/REQUIRED`, then calls `ensureCoreThenPatches({ CORE, PATCHES, REQUIRED })`. 
   - It also imports `printPatchLoadOrder` and executes it before boot so `?debugPatches=1` can print the planned order without changing runtime flow.

2. **`crm-app/js/boot/manifest.js`**
   - Loads `crm-app/patches/manifest.json` via:
     - Node file read path (`fs.readFileSync`) in Node runtime.
     - Browser `fetch()` path in browser runtime.
     - JSON module import fallback.
   - Exposes `PATCHES` from manifest order (`Object.freeze([...PATCH_LIST])`).
   - Exposes `ACTIVE_PATCHES = SAFE_MODE ? [] : PATCHES`.
   - Defines `CORE` list directly in-file.

3. **`crm-app/patches/manifest.json`**
   - Source-of-truth ordered patch list.
   - No sort keys/priority fields: order is file position.

4. **`crm-app/js/boot/boot_hardener.js`**
   - `loadModules(paths)` loops with `for (const spec of paths || [])` and imports sequentially.
   - No runtime sorting/reordering is applied; import order is preserved.
   - Runs CORE first (`fatalOnFailure=true`), then PATCHES (`fatalOnFailure=false`, except safe mode).

---

## Boot sequence diagram (text)

```text
index.html (module script)
  ├─ import printPatchLoadOrder + boot_hardener + manifest exports
  ├─ printPatchLoadOrder({core, patches}) if ?debugPatches=1
  └─ ensureCoreThenPatches({ CORE, PATCHES, REQUIRED })

ensureCoreThenPatches()
  ├─ loadModules(CORE, fatalOnFailure=true)      // sequential in CORE array order
  ├─ waitForDomReady()
  ├─ evaluatePrereqs(coreRecords, 'hard')
  ├─ set window.__EXPECTED_PATCHES__
  ├─ safe = isSafeMode()
  │   ├─ if safe: skip patch imports
  │   └─ else: loadModules(PATCHES, fatalOnFailure=false) // sequential manifest order
  ├─ maybeRenderAll()
  ├─ evaluatePrereqs(core+patchRecords, 'soft')
  ├─ gather service waiters + required-module checks
  ├─ recordSuccess()/recordFatal() + boot signals
  └─ if patches/loader.js was loaded, phase orchestration continues from that module
```

---

## Patch/Core load-order rules (exact)

- **Sorting logic:** none.
- **Normalization logic:** module IDs are normalized to URLs (`normalizeModuleId`) before import, but list order is not changed.
- **Execution order:**
  1. Entire `CORE` list from `manifest.js` (in declared order).
  2. Entire `PATCHES` list from `patches/manifest.json` (in manifest order), unless safe mode.

### CORE order (`crm-app/js/boot/manifest.js`)

| Order | Module |
|---:|---|
| 1 | `./env.js` |
| 2 | `./db.js` |
| 3 | `./core/renderGuard.js` |
| 4 | `./core/theme_injector.js` |
| 5 | `./services/selection.js` |
| 6 | `./utils.js` |
| 7 | `./render.js` |
| 8 | `./db_compat.js` |
| 9 | `./ical.js` |
| 10 | `./presets.js` |
| 11 | `../seed_data_inline.js` |
| 12 | `./seed_data.js` |
| 13 | `./ui_shims.js` |
| 14 | `./header_ui.js` |
| 15 | `./email/merge_vars.js` |
| 16 | `./contact_stage_tracker.js` |
| 17 | `./commissions.js` |
| 18 | `./post_funding.js` |
| 19 | `./qa.js` |
| 20 | `./bulk_log.js` |
| 21 | `./print.js` |
| 22 | `./snapshot.js` |
| 23 | `./app.js` |
| 24 | `./settings_forms.js` |
| 25 | `./compose.js` |
| 26 | `./services/pipelineStages.js` |
| 27 | `./services/softDelete.js` |
| 28 | `./pipeline/stages.js` |
| 29 | `./pages/workbench.js` |
| 30 | `./pages/email_templates.js` |
| 31 | `./pages/notifications.js` |
| 32 | `./boot/contracts/services.js` |
| 33 | `./boot/phases.js` |

### PATCH order (`crm-app/patches/manifest.json`)

| Order | Patch |
|---:|---|
| 1 | `./patch_20250923_baseline.js` |
| 2 | `./patch_20250924_bootstrap_ready.js` |
| 3 | `./patch_2025-09-26_phase1_pipeline_partners.js` |
| 4 | `./patch_2025-09-26_phase2_automations.js` |
| 5 | `./patch_20250926_ctc_actionbar.js` |
| 6 | `./patch_2025-09-27_doccenter2.js` |
| 7 | `./patch_2025-09-27_contact_linking_5A.js` |
| 8 | `./patch_2025-09-27_contact_linking_5B.js` |
| 9 | `./patch_2025-09-27_contact_linking_5C.js` |
| 10 | `./patch_2025-09-27_merge_ui.js` |
| 11 | `./patch_2025-09-27_nth_bundle_and_qa.js` |
| 12 | `./patch_2025-09-27_masterfix.js` |
| 13 | `./patch_2025-09-27_release_prep.js` |
| 14 | `./patches/polish_overlay_ready.js` |
| 15 | `./patch_2025-10-02_baseline_ux_cleanup.js` |
| 16 | `./patch_2025-10-02_medium_nice.js` |
| 17 | `./patch_2025-10-03_calendar_ics_button.js` |
| 18 | `./patch_2025-10-03_automation_seed.js` |
| 19 | `./contacts_merge.js` |
| 20 | `./contacts_merge_orchestrator.js` |
| 21 | `./pipeline/kanban_dnd.js` |
| 22 | `./patches/patch_2025-10-23_session_beacon.js` |
| 23 | `./ui/Toast.js` |
| 24 | `./ui/Confirm.js` |
| 25 | `./data/settings.js` |
| 26 | `./data/seed.js` |
| 27 | `./migrations.js` |
| 28 | `./templates.js` |
| 29 | `./filters.js` |
| 30 | `./state/selectionStore.js` |
| 31 | `./state/actionBarGuards.js` |
| 32 | `./ui/notifications_panel.js` |
| 33 | `./ui/action_bar.js` |
| 34 | `./ui/merge_modal.js` |
| 35 | `./debug/overlay.js` |
| 36 | `./quick_add.js` |
| 37 | `./doccenter_rules.js` |
| 38 | `./contacts.js` |
| 39 | `./partners.js` |
| 40 | `./partners_detail.js` |
| 41 | `./partners_modal.js` |
| 42 | `./partners/list.js` |
| 43 | `./partners_merge.js` |
| 44 | `./partners_merge_orchestrator.js` |
| 45 | `./dash_range.js` |
| 46 | `./importer.js` |
| 47 | `./reports.js` |
| 48 | `./notifications.js` |
| 49 | `./calendar_impl.js` |
| 50 | `./calendar_actions.js` |
| 51 | `./calendar.js` |
| 52 | `./calendar_ics.js` |
| 53 | `./diagnostics_quiet.js` |
| 54 | `./doc/doc_center_enhancer.js` |
| 55 | `./email/templates_store.js` |
| 56 | `./importer_contacts.js` |
| 57 | `./importer_helpers.js` |
| 58 | `./importer_partners.js` |
| 59 | `./merge/merge_core.js` |
| 60 | `./notifications/notifier.js` |
| 61 | `./patches/loader.js` |
| 62 | `./selftest.js` |
| 63 | `./selftest_panel.js` |
| 64 | `../seed_test_data.js` |
| 65 | `./ui/GhostButton.js` |
| 66 | `./ui/PrimaryButton.js` |
| 67 | `./ui/loading_block.js` |
| 68 | `./ui/form_footer.js` |
| 69 | `./ui/header_toolbar.js` |
| 70 | `./ui/table_layout.js` |
| 71 | `./ui/route_toast_sentinel.js` |
| 72 | `./ui/quick_add_unified.js` |
| 73 | `./ui/settings_form.js` |
| 74 | `./ui/strings.js` |
| 75 | `./util/strings.js` |
| 76 | `./ux/svg_sanitizer.js` |
| 77 | `./services/selection_adapter.js` |
| 78 | `./services/selection_fallback.js` |
| 79 | `./core/capabilities_probe.js` |

---

## Patches/modules that register listeners or mutate critical paths

### Boot-path mutators
- `./patch_20250924_bootstrap_ready.js`
  - Installs DOM-ready init and updates `window.__PATCHES_LOADED__`.
- `./patches/loader.js`
  - Re-runs `ensureCoreThenPatches`, executes phase runner contracts, dispatches `boot:done`.
- `./patches/polish_overlay_ready.js`
  - Startup overlay/readiness polish behavior.

### Selection-path mutators/listeners
- `./patch_20250926_ctc_actionbar.js`
  - Registers a document click listener to trigger action-bar behavior.
- `./state/selectionStore.js`
  - Dispatches `selection:changed` through `document` and `window`.
- `./services/selection_adapter.js`
  - Bridges legacy/global selection APIs and dispatches `ui:selection-ready`.
- `./services/selection_fallback.js`
  - Adds `document` change listener (capture) when fallback is active and dispatches `selection:changed`.

### Automation-path mutators/listeners
- `./patch_2025-09-26_phase2_automations.js`
  - Automation engine wiring and timeline interactions.
- `./patch_2025-10-03_automation_seed.js`
  - Automation seed initialization at startup.
- `./notifications.js` / `./notifications/notifier.js`
  - Notification queue sync + `notifications:changed` event surface used by automation-adjacent reminder flows.

### Doc-center mutators/listeners
- `./patch_2025-09-27_doccenter2.js`
  - Doc-center patch wiring and app-data changed dispatch.
- `./doccenter_rules.js`
  - Seeds/maintains doc-center rules and hydrates on `DOMContentLoaded`.
- `./doc/doc_center_enhancer.js`
  - Adds UI listeners (`click`, `input`) and listens for `app:data:changed` to refresh doc-center controls.

---

## High-risk patches (boot / selection / automation)

1. **`./patches/loader.js`**
   - High-risk: it controls post-hardener orchestration and emits completion signals.
2. **`./patch_20250924_bootstrap_ready.js`**
   - High-risk: participates in startup readiness and patch bookkeeping.
3. **`./patch_20250926_ctc_actionbar.js` + selection service/store modules**
   - High-risk: selection/event consistency affects action bar, bulk actions, and row targeting.
4. **`./patch_2025-09-26_phase2_automations.js` + `./patch_2025-10-03_automation_seed.js`**
   - High-risk: startup automation registration must remain deterministic to avoid duplicate/missing rules.

---

## Dev-only runtime helper

- `crm-app/js/dev/debug_patch_order.js` prints planned module order only when URL contains `?debugPatches=1`.
- Wired from `crm-app/index.html` boot script and executes before `ensureCoreThenPatches(...)`.
