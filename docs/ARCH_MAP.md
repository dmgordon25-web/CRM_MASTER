# CRM Patch Architecture Map (Audit Only)

## Scope
This document maps how patches are referenced and loaded **today** without changing runtime behavior.

---

## Where patch files are referenced

1. **Runtime entry point (`index.html`)**
   - Boot script imports `ensureCoreThenPatches` from `js/boot/boot_hardener.js`.
   - Boot script imports `CORE`, `PATCHES`, and `REQUIRED` from `js/boot/manifest.js`.
   - Boot script executes `ensureCoreThenPatches({ CORE, PATCHES, REQUIRED })`.

2. **Patch manifest (`js/boot/manifest.js`)**
   - Loads `crm-app/patches/manifest.json` (Node read in Node runtime, `fetch` in browser, JSON import fallback).
   - Exposes `PATCHES` directly from manifest order.
   - Exposes `ACTIVE_PATCHES = SAFE_MODE ? [] : PATCHES` (safe mode currently skips patch loading).

3. **Patch list source of truth (`patches/manifest.json`)**
   - Ordered list of patch/module specifiers consumed as-is by `manifest.js`.

4. **Loader patch inside manifest (`js/patches/loader.js`)**
   - Included as one patch entry in `patches/manifest.json`.
   - Contains additional phase orchestration logic after `ensureCoreThenPatches` completes.

---

## Boot sequence diagram (text)

```text
index.html
  ├─ imports boot_hardener.ensureCoreThenPatches
  ├─ imports manifest.{CORE, PATCHES, REQUIRED}
  └─ calls ensureCoreThenPatches({ CORE, PATCHES, REQUIRED })

ensureCoreThenPatches()
  ├─ loadModules(CORE, fatalOnFailure=true)
  │    └─ sequential dynamic import for each CORE spec (array order)
  ├─ waitForDomReady()
  ├─ evaluatePrereqs(hard)
  ├─ set expected patch list on window (__EXPECTED_PATCHES__)
  ├─ determine safe mode
  │    ├─ safe=true  -> skip patch imports
  │    └─ safe=false -> loadModules(PATCHES, fatalOnFailure=false)
  │         └─ sequential dynamic import for each PATCH spec (manifest order)
  ├─ maybeRenderAll()
  ├─ evaluatePrereqs(soft)
  ├─ finalize ready state
  ├─ if loaded patch list includes patches/loader.js -> delegate orchestration path
  └─ otherwise continue hardener animation/finalization path
```

---

## Exact load-order rules

- `loadModules()` iterates with `for (const spec of paths || [])` and imports each module sequentially.
- There is **no sorting** of `CORE` or `PATCHES` during load.
- Effective patch order = `patches/manifest.json` entry order.
- In safe mode, patch order is still defined, but execution is skipped (`PATCHES` not loaded).

---

## Patch load order table (PATCHES from `patches/manifest.json`)

| Order | Patch spec |
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

## Patches with boot/selection/automation/doc-center impact

### Boot-path / startup-impacting
- `./patch_20250924_bootstrap_ready.js` (boot readiness + app:data:changed emit)
- `./patches/polish_overlay_ready.js` (overlay readiness behavior)
- `./patches/loader.js` (phase orchestration and boot completion signaling)
- `./debug/overlay.js` and `./diagnostics_quiet.js` (boot/diagnostic overlays)

### Selection / action-bar / pipeline selection coupling
- `./patch_20250926_ctc_actionbar.js`
- `./state/selectionStore.js`
- `./state/actionBarGuards.js`
- `./ui/action_bar.js`
- `./services/selection_adapter.js`
- `./services/selection_fallback.js`
- `./patch_2025-09-26_phase1_pipeline_partners.js` (pipeline selection sync)

### Automations / reminders
- `./patch_2025-09-26_phase2_automations.js`
- `./patch_2025-10-03_automation_seed.js`
- `./notifications.js` / `./notifications/notifier.js`
- `./post_funding.js` is CORE (not PATCHES) but is in boot-critical runtime set

### Doc center
- `./patch_2025-09-27_doccenter2.js`
- `./doccenter_rules.js`
- `./doc/doc_center_enhancer.js`

---

## High-risk patches (boot / selection / automation)

1. **`./patches/loader.js`**
   - High risk because it performs post-hardener phase orchestration and re-signals boot completion.
2. **`./patch_20250924_bootstrap_ready.js`**
   - High risk because it influences boot readiness and data-change dispatch timing.
3. **`./patch_20250926_ctc_actionbar.js` + `./ui/action_bar.js` + `./state/selectionStore.js`**
   - High risk because selection/action-bar consistency depends on ordering and shared state updates.
4. **`./services/selection_adapter.js` + `./services/selection_fallback.js`**
   - High risk because they bridge/fallback selection capability and can affect global selection truth.
5. **`./patch_2025-09-26_phase2_automations.js` + `./patch_2025-10-03_automation_seed.js`**
   - High risk because reminder/automation registration must be deterministic to avoid duplicate or missing automations.
