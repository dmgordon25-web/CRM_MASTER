# Notes

## Branch / scope
- Working branch: fix/ci-green-pack-1
- Focused on action bar selection instability first.

## Code change made
File changed:
- crm-app/js/ui/action_bar.js

Edits made in handleSelectionChanged():
1) Converted `scope` local from const -> let so it can be reconciled to active route scope.
2) Fixed scope override bug where reconciled scope could be set and then immediately overwritten by empty original scope.
3) Added deterministic current-scope reconciliation path using `reconcileFromCurrentScope(...)` so action bar count/scope come from current active selection scope host.
4) Removed store-based retained-count fallback for zero-count events in this path to avoid stale non-visible selections driving action bar state.

## Validation attempts
- Isolated run of action bar spec after patch showed pass once (8/8).
- Consecutive loop attempt failed on run 1 at tripwire case (line 279) with poll timeout.

## Artifacts
- test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/trace.zip
- test-results/action_bar_selection-Actio-92afe--contacts-partners-pipeline-chromium/error-context.md
