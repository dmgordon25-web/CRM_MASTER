# SME Deep Dive Audit — THE CRM Tool

## 1) Current State
The codebase is operationally dense: boot is orchestrated through a core+patch pipeline, runtime behavior is heavily event-driven, and many production features are still delivered as patch-layer modules rather than fully “graduated” core code. This is workable for demo-critical delivery, but it increases coupling risk when changes touch boot predicates, selection/action bar synchronization, and dashboard drilldown/editor-open flows.

In this environment, unit coverage is healthy and currently passing, while browser-driven suites are blocked by missing host Playwright dependencies (Linux system libs). That means audit confidence is high on static architecture and unit-level behavior, but runtime E2E confidence depends on CI or a host with the full browser dependency stack.

## 2) Reality Check Table
| Surface | State | Evidence / Note |
|---|---|---|
| Dashboard vs Labs parity | **PARTIAL** | Labs is default hash route and configurable dashboard is present, but parity is still test-gated by multiple Labs/Dashboard Playwright specs in the suite. |
| zNext (Gridstack) | **PARTIAL** | Gridstack vendor and labs vnext modules exist; dedicated zNext render spec exists in E2E suite. |
| Calendar toggles + accents | **DONE (code-path)** | Legend visibility persistence + accent token rendering implemented; E2E pending due browser env block. |
| Seeding profiles | **DONE (code-path)** | Seed profile UI wiring exists and routes through `runSeedProfile(profile)` and full workflow seed path. |
| Status canonicalization + orphan detector | **DONE (code-path)** | Canonical stage aliasing exists; diagnostics scanner reports canonical/orphan values across stores. |
| Imports/exports/backup/restore integrity | **PARTIAL** | Snapshot + DB export/restore paths exist, but one unit test logs notification restore warning from localStorage access edge-path. |
| Document checklist + Doc Center | **PARTIAL** | Doc Center entry/enhancer + checklist persistence tests exist, but enhancer still relies on timing (`setTimeout`) hooks. |
| Notifications consistency | **PARTIAL** | Notifications store exists and restore test coverage exists, but full end-to-end consistency currently blocked in this host env. |
| Client Portfolio reports | **PARTIAL** | Reports route and report count unit tests exist; full route lifecycle verification remains E2E-dependent. |

## 3) Bug + Risk List (ranked)
1. **High — Boot smoke reliability is tightly coupled to UI internals**: `tools/boot_smoke_test.mjs` contains aggressive DOM forcing, overlay teardown, and modal close fallbacks plus `waitForFunction` predicate checks against either E2E markers or modal attributes. Small UI behavior changes can trip CI despite app being mostly functional.
2. **High — Patch-layer timing hooks can produce non-deterministic UI sequencing**: Doc center enhancer and some boot helpers use `setTimeout(..., 0)` to re-sweep/re-render after mutations; this can drift from deterministic save-then-repaint expectations under load.
3. **Medium — Selection/action bar sync remains a recurrent fragility zone**: architecture spans selection store, adapter/fallback layers, and route-specific UI listeners; this is historically the most common cross-surface divergence cluster.
4. **Medium — Release packaging assumptions still have novice-user risk**: launcher logic is improved, but dependency on PowerShell execution policy, port availability, and optional portable node presence remain practical failure modes.
5. **Medium — Offline persistence has dual-path complexity**: IndexedDB is primary, but targeted localStorage keys (theme, calendar legend, doc filters, notifications/UI prefs) create split persistence semantics during restore and diagnostics.

## 4) Hidden / Tucked-Away Features Inventory
- Labs default-home hash routing fallback (`#/labs` unless explicit preference).
- Safe-mode boot query handling (`safe` / `safeMode`) with reduced patch loading.
- Calendar legend category filtering persisted to localStorage.
- Data diagnostics scanner in Settings for canonical/orphan stage/status inventory.
- Seed profile runner (demo-week / month-end) and full workflow seed button.
- Build-and-run release launcher (`Build and Run Release.bat`) for one-click packaging + launch.
- Post-first-paint deferred module loading registry in router bootstrap.

## 5) Validation Sanity (early-funnel LO workflows)
The architecture still supports early-funnel LO workflows (New+, contacts, partners, tasks, calendar, basic reports) through existing route and modal wiring. The primary risk is not feature absence, but determinism drift across patch layers when boot, selection, or dashboard drilldowns are exercised repeatedly. The right stewardship stance is to preserve existing flows and fix only failing predicates with minimal blast radius.

## 6) Workflow + Automation Sanity
- **CTC/stage normalization**: canonical stage keys include alias handling for CTC/clear-to-close variants and normalize unknowns to baseline labels.
- **Orphan detection**: settings diagnostics scans multiple stores (`contacts`, `deals`, `documents`, `tasks`) and classifies canonical vs orphan values.
- **Automation confidence**: phase/patch architecture keeps automations loaded as patch modules; good for rapid iteration, but graduation candidates should be prioritized to reduce boot variance.

## 7) Release / Packaging Reality (Windows novice double-click)
### What release must contain
- `crm-app/` static app assets.
- Launchers: `Start CRM.bat`, `Start CRM.ps1`.
- Static server scripts under `tools/`.
- Prefer bundled portable Node under `release/CRM/node/` for novice reliability.

### Unsafe assumptions
- **System Node exists**: not safe for novice users; portable runtime should be treated as expected.
- **PowerShell unrestricted**: execution policy may block scripts.
- **No path-space issues**: launchers mostly quote paths, but mixed shell/cmd transitions remain a practical hazard.
- **Port 8080 always free**: launcher checks help, but conflict remains a common support issue.

## 8) Roadmap Packets (one surface per packet)
### Packet A — Boot-smoke determinism only
- **Success criteria**: `verify:build` green without changing tests; no broad runtime behavior changes.
- **Likely files**: `crm-app/js/dashboard/index.js` and/or a single boot-adjacent module where predicate contract originates.
- **Verification loop**: `npm run verify:build`, `npm run test:unit`, targeted manual drilldown x5 from Priority Actions row -> correct contact editor.

### Packet B — Selection/action bar consistency hardening
- **Success criteria**: counts suite stable with deterministic store↔DOM sync after select-all/clear across contacts/partners/pipeline.
- **Likely files**: `crm-app/js/state/selectionStore.js`, `crm-app/js/ui/action_bar.js`, `crm-app/js/services/selection_adapter.js`.
- **Verification loop**: `npm run test:counts`, focused Playwright spec run for selection tripwire, manual tab-switch cycle check.

### Packet C — Doc Center deterministic repaint
- **Success criteria**: remove timing dependence from enhancer re-sweeps while preserving checklist/filter persistence.
- **Likely files**: `crm-app/js/doc/doc_center_enhancer.js` (+ possibly doc center persistence adapter).
- **Verification loop**: doc checklist E2E spec + manual doc update/delete visibility checks with no stale rows.

### Packet D — Release launcher novice-proofing
- **Success criteria**: double-click path works with bundled node and clear error messaging for blocked PS/port conflicts.
- **Likely files**: `Start CRM.bat`, `Start CRM.ps1`, `build_release.ps1`, `tools/build_release.js`.
- **Verification loop**: build release, launch from packaged folder on clean Windows profile, verify browser open + healthz.

---

## Phase 0 — Repo State + Open Branch Triage
### Context
- Current branch: `work`.
- HEAD: `b2f7fa5870a847364beed4abf316fb1511963632`.
- `gh` CLI unavailable in this container; open PR list could not be fetched directly.
- Local refs contain only `work`; no remote refs are configured, so triage uses merge history.

### Open failing branch identification
The branch most likely matching the referenced “verify:build boot-smoke waitForFunction timeout” work is merge PR #1092 (`codex/add-build-and-run-release-script`), whose branch tip commit is `9425c0a` and includes direct edits to `tools/boot_smoke_test.mjs` and dashboard drilldown handling.

### Diff inventory vs main baseline of that PR
Using merge parent comparison (`e675309...9425c0a`):
- **A) Runtime CRM changes**: `crm-app/js/dashboard/index.js`.
- **B) Release/launcher/build scripts**: `Build and Run Release.bat`.
- **C) CI/tools/tests changes**: `tools/boot_smoke_test.mjs` (test/tooling harness), no assertion-weakening test file edits.

### Option Decision
**OPTION 1: Continue the open branch (if still open) and stabilize with small patch.**
Practical reasons:
1. Very small file footprint (3 files) with clear isolation of boot-smoke and release launcher intent.
2. Includes necessary novice-release workflow enhancement (`Build and Run Release.bat`) worth preserving.
3. Lower blast radius than re-spinning from scratch unless new regressions appear beyond boot predicate behavior.

---

## Execution / Verification Results (required commands)
| Command | Result | Notes |
|---|---|---|
| `npm ci` | PASS | Dependencies installed; postinstall detected browsers already installed, but host libs still missing at runtime. |
| `npm run verify:build` | WARN | Fails at boot smoke browser launch due to missing host Playwright system libraries. |
| `npm run test:unit` | PASS | 16 files / 62 tests passed; one logged restore warning in test output but suite passed. |
| `npm run test:counts` | WARN | Playwright cannot launch browser due to missing host libs; all tests fail from environment constraint. |
| `timeout 900s npm run test:e2e` | WARN | Same Playwright host dependency block across full suite. |
| `npm run check:features` | WARN | Depends on boot smoke; blocked by missing browser host libs. |
| `npm run audit` | WARN | Audit fails downstream because feature check/boot smoke cannot launch browser. |

---

## Decision
### A) What to do with the OPEN failing branch
**Continue and fix.**
- Branch scope is compact and directly related to the failing predicate zone (boot smoke + dashboard drilldown).
- Contains useful release launcher increment that should not be discarded without cause.
- Regression likelihood is lower with surgical predicate contract hardening than with a full restart.

### B) Two ready-to-copy Codex prompts
#### 1) Continue on open branch and make CI green (boot-smoke waitForFunction)
```text
You are on the existing failing branch for THE CRM Tool.
Goal: make `npm run verify:build` green by fixing app-side determinism for boot smoke, without changing tests.

Hard constraints:
- DO NOT edit any test files under `tests/**`.
- DO NOT weaken assertions or add retries/timeouts in tests.
- Minimal surgical patch; avoid refactors.
- Preserve offline-first behavior and existing data.

Required workflow:
1) Read `tools/boot_smoke_test.mjs` and identify the exact `waitForFunction` predicate that times out.
2) Trace where the app should set the matching state (e.g., contact open marker/modal open contract) in runtime code.
3) Patch runtime code so the predicate is satisfied deterministically every time from dashboard Priority Actions drilldown.
4) Enforce save-then-repaint ordering and avoid timing hacks.
5) Run and report:
   - npm run verify:build
   - npm run test:unit
   - npm run test:counts
6) Provide a concise root-cause note with before/after behavior and files changed.
```

#### 2) Start fresh from main with minimal blast radius for same issue
```text
Start from latest `main` for THE CRM Tool.
Goal: fix the boot-smoke `waitForFunction` timeout in `npm run verify:build` with minimal blast radius.

Hard constraints:
- DO NOT change tests under `tests/**`.
- No broad refactors, no store unification, no global listener additions.
- One-surface patch only (dashboard drilldown/contact editor-open contract).
- Deterministic render flow; no setTimeout polling hacks.

Required workflow:
1) Reproduce `npm run verify:build` failure.
2) Read `tools/boot_smoke_test.mjs` and document exact predicate expected by boot smoke.
3) Patch only runtime code needed so Priority Actions click always opens correct contact editor and exposes expected deterministic marker/state.
4) Verify with:
   - npm run verify:build
   - npm run test:unit
   - npm run test:counts
5) Include manual proof steps (repeat 5x): Dashboard Priority Actions row click -> correct editor opens -> close -> navigation still works.
6) Summarize why this minimal patch is lower risk than touching boot/test tooling.
```
