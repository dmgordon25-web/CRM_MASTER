# Changelog Policy

Any change that touches boot, manifests, or contracts must include a short changelog entry with the following checklist:

- **No new console errors** – verify the steady state is silent. If you introduce a temporary warn/info during feature warm-up,
  note the tag and the retirement plan.
- **Smoke passed** – run `npm run verify:build` locally and record the run in the changelog entry. CI will re-run the same suite
  (manifest audit → contract linter → boot smoke with canaries and zero-error gate).
- **Contract impact** – call out new HARD or SOFT probes, any changes to Safe Mode behaviour, and whether the diagnostics overlay
  timing changed.

Suggested entry template:

```
## YYYY-MM-DD
- Summary of the change.
- No new console errors (verify:build ✅ <commit hash or link>)
- Smoke passed (boot canaries ✅)
- Contract notes (HARD/SOFT updates, Safe Mode, logging)
```

Do **not** remove archived documentation yet—link to `docs/archive/` when you move or supersede material.
