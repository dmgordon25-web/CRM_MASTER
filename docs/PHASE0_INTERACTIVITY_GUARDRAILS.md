# Phase 0 — Interactivity Guardrails

## Contract: Restore Interactivity After Every Modal/Overlay Close
- **Invariant:** after any modal, dialog, or overlay closes, the underlying view (including the dashboard) must be fully interactive: pointer events on the body/root restored, visibility/unhidden state cleared, and `aria-hidden`/`inert` removed from previously covered regions.
- **Enforcement shims:**
  - `resetUiInteractivity` scrubs backdrops/overlays, releases scroll locks, removes `[inert]`, and resets `body` pointer/overflow styles before returning control. It also exposes `window.unfreezeCrmUi` for last-resort recovery during tests.【F:crm-app/js/ui/modal_singleton.js†L11-L104】
  - `closeContactEditor` and `closeQuickAddOverlayIfOpen` explicitly release modal shells, hide contact dialogs, clear pointer-events, drop `aria-hidden`, and reactivate dashboard cards after closing the contact editor.【F:crm-app/js/contacts.js†L3045-L3078】【F:crm-app/js/contacts.js†L3667-L3741】
- **Test coverage:** `tests/e2e/dashboard_widget_drilldown.spec.ts` opens/closes the contact modal repeatedly and asserts dashboard pointer-events restore after every close, preventing regressions in drilldown interactivity.【F:tests/e2e/dashboard_widget_drilldown.spec.ts†L186-L244】

## Freeze Zones (do not modify casually)
- **Contact modal lifecycle:** modal teardown, scroll lock release, and dashboard unfreeze logic in `crm-app/js/contacts.js` plus the shared `resetUiInteractivity` helper are stability-critical; avoid changes without explicit test proof.【F:crm-app/js/contacts.js†L3045-L3078】【F:crm-app/js/ui/modal_singleton.js†L11-L104】
- **Dashboard click delegation:** drilldown resolver and logging hooks in `crm-app/js/dashboard/index.js` drive contact/partner opens and emit diagnostics; altering capture/bubbling or target resolution can break e2e drilldowns.【F:crm-app/js/dashboard/index.js†L2681-L2891】
- **Quick create overlay logic:** overlay reset and visibility forcing in `crm-app/js/ui/quick_create_menu.js` keep the floating menu from trapping clicks; changes can reintroduce pointer-event locks or hidden menus.【F:crm-app/js/ui/quick_create_menu.js†L9-L71】
- **Action bar / selection guards:** selection-derived visibility, pill wiring, and guard bookkeeping in `crm-app/js/ui/action_bar.js` are sensitive to listener duplication and selection state resets; treat as protected surface.【F:crm-app/js/ui/action_bar.js†L1-L121】

## Phase-0 Instrumentation Audit (no removals yet)
- **Forced widget visibility + seeded rows (Playwright):** the drilldown e2e test exposes the Priority Actions card, seeds IndexedDB records, and synthesizes a DOM row when absent to guarantee deterministic drilldowns. Classification: **test-only**, keep until dashboard data seeding is native.【F:tests/e2e/dashboard_widget_drilldown.spec.ts†L25-L126】
- **E2E lifecycle beacons:** contact editor emits `window.__E2E__` open/close markers consumed by tests and smoke checks. Classification: **permanent guard for test visibility**; only remove after replacing with dedicated hooks/tests.【F:crm-app/js/contacts.js†L52-L67】【F:tests/e2e/dashboard_widget_drilldown.spec.ts†L186-L233】
- **Interactivity safety nets:** `resetUiInteractivity` + `unfreezeCrmUi` exist from the incident fix to recover pointer/aria state. Classification: **permanent guard**; required to uphold the interactivity contract.【F:crm-app/js/ui/modal_singleton.js†L11-L104】
- **Dashboard debug traces:** `__DASH_DEBUG`, `__CLICK_TRACE`, and `__QC_TRACE` logging inside dashboard click handling aid incident forensics. Classification: **candidate for later cleanup** once drilldown stability is proven across releases.【F:crm-app/js/dashboard/index.js†L2701-L2838】
- **Quick Create overlay force-hide:** `resetQuickCreateOverlay` hard-sets `hidden`, `display`, `visibility`, and `pointerEvents` on menu/task overlays to avoid stray focus/pointer capture. Classification: **permanent guard** while overlays coexist with modals.【F:crm-app/js/ui/quick_create_menu.js†L9-L71】

## Extension Safety Checklist (must hold before merge)
- Do not change pointer/visibility/aria states for modals or overlays without demonstrating `resetUiInteractivity`/contact close continue to restore the dashboard; rerun the dashboard drilldown Playwright test to confirm.【F:crm-app/js/ui/modal_singleton.js†L11-L104】【F:tests/e2e/dashboard_widget_drilldown.spec.ts†L186-L244】
- Avoid adding new global listeners; reuse existing delegates like `handleDashboardClick` to preserve capture ordering and prevent duplicate bindings.【F:crm-app/js/dashboard/index.js†L2681-L2891】
- Validate that quick create overlays and contact modals can open/close repeatedly without leaving `[inert]`, `hidden`, or `pointer-events: none` on the underlying view; manual checks must cover open→close→re-render cycles.【F:crm-app/js/ui/quick_create_menu.js†L9-L71】【F:crm-app/js/contacts.js†L3667-L3741】
- Any changes touching selection/stateful UI must preserve action bar guard bookkeeping and avoid duplicate listeners; confirm selection-count-driven visibility still matches guard calculations.【F:crm-app/js/ui/action_bar.js†L1-L121】

## CI / Verification Alignment
- Changes within any freeze zone require green runs of the boot smoke gate (`npm run verify:build`) plus the dashboard drilldown Playwright spec (`npx playwright test tests/e2e/dashboard_widget_drilldown.spec.ts`) to ensure modal interactivity and dashboard routing stay intact.【F:tests/e2e/dashboard_widget_drilldown.spec.ts†L186-L244】
- Include Manual Proof in PRs: document steps covering app boot, navigation, modal open/close, and dashboard drilldown paths when touching freeze zones, per repository guardrails.【F:AGENTS.md†L9-L32】
