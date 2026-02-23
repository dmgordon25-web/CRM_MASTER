# Patch Graduation List

Generated for branch `feat/patch-graduation-report` as a planning artifact only (no runtime code changes).

## Scope and method

- Scanned every `patch_*.js` file under `crm-app/js/**`.
- Derived date from filename (`patch_YYYY-MM-DD_*` or `patch_YYYYMMDD_*`).
- Derived purpose from filename and top-of-file comments when available.
- Assigned category from dominant concern in patch name/comment:
  - `boot` / `selection` / `automation` / `docs` / `calendar` / `UI` / `misc`
- Assigned risk score (`low` / `med` / `high`) from patch traits:
  - global listeners (`window/document.addEventListener`)
  - boot-sequence touch points (bootstrap/loader/phase/render-init)
  - storage writes or persistence coupling
  - broad UI surgery (action bar, modal lifecycle, merge UI, dashboard widgeting)
- Recommendation meanings:
  - **KEEP AS PATCH**: retain as compatibility/hotfix shim for now.
  - **GRADUATE TO CORE**: fold behavior into stable core module(s), then remove patch.
  - **DEPRECATE**: retire after validating equivalent behavior now exists in core.

## Ranked patch inventory (highest-risk first)

| Rank | Patch file | Date | Purpose (best effort) | Category | Risk | Recommendation | Suggested target file(s) |
|---:|---|---|---|---|---|---|---|
| 1 | `crm-app/js/patch_2025-09-26_phase1_pipeline_partners.js` | 2025-09-26 | Phase 1 pipeline lanes + partner core stitching. | UI | high | GRADUATE TO CORE | `crm-app/js/pipeline/stages.js`, `crm-app/js/partners.js`, `crm-app/js/ui/home_view.js` |
| 2 | `crm-app/js/patch_20250926_ctc_actionbar.js` | 2025-09-26 | Stage canonicalization + hardened action bar behavior. | selection | high | GRADUATE TO CORE | `crm-app/js/state/actionBarGuards.js`, `crm-app/js/ui/action_bar.js`, `crm-app/js/workflows/status_canonical.js` |
| 3 | `crm-app/js/patch_2025-09-27_nth_bundle_and_qa.js` | 2025-09-27 | Multi-fix QA bundle touching boot/UI wiring. | misc | high | KEEP AS PATCH | `crm-app/js/app.js`, `crm-app/js/boot/phase_runner.js` |
| 4 | `crm-app/js/patch_2025-09-26_phase4_polish_regression.js` | 2025-09-26 | QA polish and regression hardening pass. | misc | high | KEEP AS PATCH | `crm-app/js/ui/route_lifecycle.js`, `crm-app/js/core/renderGuard.js` |
| 5 | `crm-app/js/patch_2025-09-26_phase3_dashboard_reports.js` | 2025-09-26 | Dashboard + reporting fixes and integration. | UI | high | GRADUATE TO CORE | `crm-app/js/dashboard/index.js`, `crm-app/js/dashboard/kpis.js`, `crm-app/js/tables/column_config.js` |
| 6 | `crm-app/js/patch_2025-09-27_masterfix.js` | 2025-09-27 | Master fixes for event symmetry, selection, automation, calendar, UX. | misc | high | KEEP AS PATCH | `crm-app/js/app.js`, `crm-app/js/ui/route_lifecycle.js` |
| 7 | `crm-app/js/patch_2025-09-26_phase2_automations.js` | 2025-09-26 | Automations engine + timeline refinements. | automation | high | GRADUATE TO CORE | `crm-app/js/tasks/api.js`, `crm-app/js/tasks/store.js`, `crm-app/js/workflow/state_model.js` |
| 8 | `crm-app/js/patch_2025-09-27_release_prep.js` | 2025-09-27 | Release-prep stability touches (storage-heavy). | misc | high | KEEP AS PATCH | `crm-app/js/app_services.js`, `crm-app/js/migrations.js` |
| 9 | `crm-app/js/patch_2025-10-02_medium_nice.js` | 2025-10-02 | Medium-priority UX niceties and cleanup pass. | UI | med | GRADUATE TO CORE | `crm-app/js/ui/home_view.js`, `crm-app/js/ui/header_toolbar.js`, `crm-app/js/ui/help_hints.js` |
| 10 | `crm-app/js/patch_2025-09-27_phase6_polish_telemetry.js` | 2025-09-27 | Polish + telemetry wiring near boot/readiness. | misc | med | GRADUATE TO CORE | `crm-app/js/diagnostics_quiet.js`, `crm-app/js/stability_check.js` |
| 11 | `crm-app/js/patch_2025-09-27_merge_ui.js` | 2025-09-27 | Merge UI alignment/fix pass. | UI | med | GRADUATE TO CORE | `crm-app/js/merge/merge_core.js`, `crm-app/js/ui/merge_modal.js` |
| 12 | `crm-app/js/patch_2025-09-27_doccenter2.js` | 2025-09-27 | Doc Center iteration v2 behavior patch. | docs | med | GRADUATE TO CORE | `crm-app/js/doc/doc_center_entry.js`, `crm-app/js/doc/doc_center_enhancer.js`, `crm-app/js/doccenter_rules.js` |
| 13 | `crm-app/js/patch_2025-09-27_contact_linking_5C.js` | 2025-09-27 | Contact-linking step 5C UI flow updates. | selection | med | GRADUATE TO CORE | `crm-app/js/referrals/linker.js`, `crm-app/js/contacts/form.js` |
| 14 | `crm-app/js/patch_2025-09-27_contact_linking_5B.js` | 2025-09-27 | Contact-linking step 5B refinements. | selection | med | GRADUATE TO CORE | `crm-app/js/referrals/linker.js`, `crm-app/js/contacts/modal.js` |
| 15 | `crm-app/js/patch_2025-10-23_session_beacon.js` | 2025-10-23 | Session beacon/state telemetry guardrails. | misc | med | KEEP AS PATCH | `crm-app/js/diagnostics_quiet.js`, `crm-app/js/app_debug.js` |
| 16 | `crm-app/js/patch_2025-10-03_calendar_ics_button.js` | 2025-10-03 | Calendar ICS export button enablement. | calendar | med | GRADUATE TO CORE | `crm-app/js/calendar_ics.js`, `crm-app/js/calendar/index.js`, `crm-app/js/ui/header_toolbar.js` |
| 17 | `crm-app/js/patch_20250924_bootstrap_ready.js` | 2025-09-24 | Ensure first render only after DB/bootstrap ready. | boot | med | GRADUATE TO CORE | `crm-app/js/boot/loader.js`, `crm-app/js/boot/phase_runner.js`, `crm-app/js/boot/phases.js` |
| 18 | `crm-app/js/patch_20250923_baseline.js` | 2025-09-23 | Baseline name/edit modal/calendar fallback/nav hooks. | UI | med | DEPRECATE | `crm-app/js/ui/partner_edit_modal.js`, `crm-app/js/ui/contact_editor_api.js`, `crm-app/js/calendar.js` |
| 19 | `crm-app/js/patch_2025-09-27_contact_linking_5A.js` | 2025-09-27 | Contact-linking step 5A base wiring. | selection | low | GRADUATE TO CORE | `crm-app/js/referrals/linker.js` |
| 20 | `crm-app/js/patch_2025-10-03_automation_seed.js` | 2025-10-03 | Seed/setup helper for automation defaults. | automation | low | DEPRECATE | `crm-app/js/data/seed.js`, `crm-app/js/seed_full.js` |
| 21 | `crm-app/js/patch_2025-10-23_actionbar_drag.js` | 2025-10-23 | Guard action bar drag singleton behavior. | UI | low | GRADUATE TO CORE | `crm-app/js/ui/drag_core.js`, `crm-app/js/ui/action_bar.js` |
| 22 | `crm-app/js/patch_2025-10-23_unify_quick_create.js` | 2025-10-23 | Unify quick-create entry path under singleton guard. | UI | low | GRADUATE TO CORE | `crm-app/js/ui/quick_create_menu.js`, `crm-app/js/ui/quick_add_unified.js` |

## Proposed consolidation order (top 10)

Order is biased toward reducing long-term fragility first (high-risk + broad surface area), while avoiding chaotic simultaneous rewrites.

1. `patch_20250924_bootstrap_ready.js` → `crm-app/js/boot/loader.js`, `crm-app/js/boot/phase_runner.js`
2. `patch_20250926_ctc_actionbar.js` → `crm-app/js/state/actionBarGuards.js`, `crm-app/js/ui/action_bar.js`
3. `patch_2025-09-26_phase2_automations.js` → `crm-app/js/tasks/store.js`, `crm-app/js/tasks/api.js`
4. `patch_2025-09-26_phase3_dashboard_reports.js` → `crm-app/js/dashboard/index.js`, `crm-app/js/dashboard/kpis.js`
5. `patch_2025-09-26_phase1_pipeline_partners.js` → `crm-app/js/pipeline/stages.js`, `crm-app/js/partners.js`
6. `patch_2025-10-03_calendar_ics_button.js` → `crm-app/js/calendar_ics.js`, `crm-app/js/calendar/index.js`
7. `patch_2025-09-27_doccenter2.js` → `crm-app/js/doc/doc_center_entry.js`, `crm-app/js/doc/doc_center_enhancer.js`
8. `patch_2025-09-27_merge_ui.js` → `crm-app/js/merge/merge_core.js`, `crm-app/js/ui/merge_modal.js`
9. `patch_2025-10-23_unify_quick_create.js` → `crm-app/js/ui/quick_create_menu.js`, `crm-app/js/ui/quick_add_unified.js`
10. `patch_2025-10-23_actionbar_drag.js` → `crm-app/js/ui/drag_core.js`, `crm-app/js/ui/action_bar.js`

## Notes

- Patches marked **KEEP AS PATCH** should be treated as quarantine shims until narrower ownership can be established.
- Patches marked **DEPRECATE** should be removed only after side-by-side runtime verification confirms equivalent behavior is already in core.
- This document intentionally does not apply code changes; it is a planning/risk artifact.
