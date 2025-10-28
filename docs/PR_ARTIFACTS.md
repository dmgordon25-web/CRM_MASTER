# Pull Request Artifacts & Diff References

This document collects the concrete implementation notes, file references, and follow-up
checks for the workflow items completed in the "Import/export dry-run + dedupe; seed/persistence;
save consistency; doc upload + Document Center" iteration.

## Document Center upload experience

* Dashboard card registration for the Document Center lives in `crm-app/js/ui/dashboard_layout.js`
  under the `docCenter` widget entry so the module loads alongside the other dashboard cards.
* The borrower-facing workflow (drag/drop, IndexedDB persistence, record linking, status actions,
  and download support) is implemented in `crm-app/js/doccenter_rules.js`, which prefers the
  IndexedDB `documents` store and gracefully falls back to `localStorage` when unavailable.

## Seed coverage and persistence checks

* Idempotent seed dispatches that keep legacy listeners active while emitting structured coverage
  data run out of `crm-app/js/seed_data.js`, ensuring the core statuses survive a reload.
* Database helpers exposed to the broader modules are defined in `crm-app/js/db.js`.

## Import/export enhancements

* Normalized email and phone dedupe for import dry-runs, plus the confirm-before-commit flow, are
  handled inside `crm-app/js/importer.js`. Schema parity checks for exports live alongside the
  importer so both paths remain consistent.

## Verifying diffs locally

1. Fetch the latest changes: `git fetch origin work`.
2. Inspect file-level changes: `git show --stat origin/work..HEAD`.
3. Review full patches for a specific file, e.g. `git diff origin/work -- crm-app/js/doccenter_rules.js`.
4. When satisfied, run `npm run verify:build` to execute the manifest audit, contract linter, and boot
   smoke test before creating the PR.

## Creating the PR message

After committing and running the checks above, use your normal Git hosting workflow (for example,
`gh pr create` or the repository web UI) to create the pull request. Include the summary material from
this document alongside the automated test evidence (e.g., `npm run verify:build`).
