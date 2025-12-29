# Orphan & Risk Report

## Overview
Analysis of status/stage values defined in code versus those exposed in the UI, highlighting potential "orphans" (unreachable states) and data consistency risks.

## 1. Unreachable / Hidden Stages
These stages are defined in the canonical state model but do not appear in the standard Contact Editor dropdowns (`contacts.js`).

*   **Past Client** (`past-client`)
    *   **Status**: Hidden in UI Dropdown.
    *   **Risk**: Low. Likely set automatically via automation logic (e.g., transitioning from `post-close` after X days) or legacy data.
    *   **Recommendation**: Clarify if users should manually select this or if it remains automation-only.

*   **Returning** (`returning`)
    *   **Status**: Hidden in UI Dropdown.
    *   **Risk**: Low. Intended for "Repeat Borrower" flows.
    *   **Recommendation**: Keep hidden until "New Deal" feature is fully implemented.

## 2. Inconsistent Stage/Status Models
*   **"Nurture" as Stage vs Status**
    *   **Observation**: `state_model.js` maps `nurture` *Status* to `long-shot` *Stage*. However, the UI allows selecting "Nurture" as a *Stage* directly.
    *   **Risk**: Medium. Confusion in reporting. Does a "Nurture Stage" contact show up in the "Lead" bucket or its own bucket?
    *   **Mitigation**: `normalizeStage` handles this, but report logic needs to be double-checked to ensure "Nurture Stage" contacts aren't double-counted or excluded.

*   **"Lost" / "Denied" as Stages**
    *   **Observation**: Similar to Nurture. `state_model` considers these terminal *Statuses*, but UI treats them as *Stages*.
    *   **Risk**: Low. Common pattern in CRMs to treat "Closed Lost" as a bucket.

## 3. Alias Risks
*   **CTC**
    *   **Observation**: `CTC` is widely used in industry. Code maps it to `cleared-to-close`.
    *   **Risk**: Low. `pipeline/constants.js` has robust alias mapping.
    *   **Action**: Ensure all Imports run through `normalizeStage` to catch "CTC" coming from CSVs.

## 4. Orphaned Constants
The following constants appear in code but have unclear usage:
*   `DEFAULT_STAGE_FOLLOW_UP_DAYS` (3 days): Used in `task_utils.js`. Verify if this logic is actually active or superseded by Automations.

## 5. Conclusion
The "Orphan Risk" is generally **Low**. The robust normalization layer (`pipeline/constants.js`) effectively catches most legacy/alias values (e.g. `Prospect`, `Lead`, `CTC`). The main ambiguity is the "Status vs Stage" distinction for Nurture/Lost, which is a design choice rather than a bug.
