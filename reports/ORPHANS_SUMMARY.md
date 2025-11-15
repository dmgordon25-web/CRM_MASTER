# Orphaned Module Cleanup (November 2025)

## Summary
- Added `tools/find_orphans.mjs`, a reachability auditor that merges the generated `import_graph.json` with on-disk module scans, manifest-driven dynamic imports, and inline boot loader hints to classify every `crm-app/js` module.
- Regenerated `reports/orphans.json`; the report now shows zero runtime modules marked as `unused` and flags 13 files under `QUARANTINE` for historical reference.
- Relocated legacy experiment code and dormant table helpers from `crm-app/js` into `QUARANTINE/crm-app/js`, ensuring that the runtime tree only contains active code paths.

## Modules moved to `QUARANTINE`
- `crm-app/js/labs/entry.js`
- `crm-app/js/labs/vendor/mock_chart.js`
- `crm-app/js/labs/widgets.js`
- `crm-app/js/table/column_chooser.js`
- `crm-app/js/table/csv_export.js`
- `crm-app/js/table/presets/contacts.js`
- `crm-app/js/table/presets/partners.js`
- `crm-app/js/table/presets/workbench.js`
- `crm-app/js/table/registry.js`
- `crm-app/js/ui/bootstrap_features_probe.js`
- `crm-app/js/ui/quick_add_compat.js`

Legacy support files that were already quarantined remain available under `QUARANTINE/crm-app/js/` (for example `exporter.js` and `settings/dashboard_prefs.js`).

## Next steps
- Re-run `node tools/find_orphans.mjs` after significant feature work to keep `reports/orphans.json` accurate.
- When deprecating additional modules, move them directly into `QUARANTINE` so the script can surface them as `quarantined` instead of `unused`.
