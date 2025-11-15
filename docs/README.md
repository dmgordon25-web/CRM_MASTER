# Documentation Index

## Current references
- **Boot contract:** [`../BOOT_OPTIMIZATION_2025.md`](../BOOT_OPTIMIZATION_2025.md) captures the latest agreed boot sequence, splash timing, and stabilization requirements.
- **Dashboard baseline:** [`../DASHBOARD_FEATURES_ANALYSIS.md`](../DASHBOARD_FEATURES_ANALYSIS.md) documents the present dashboard capabilities and expectations.
- **Product-wide contracts:** [`CONTRACTS.md`](CONTRACTS.md) and supporting specs in this folder remain the source of truth for shared behaviors.

## Historical notes
- **Boot investigations:** Archived boot sequencing and cycling write-ups now live in [`archive/boot/`](archive/boot/).
- **Dashboard fixes:** Prior dashboard-focused incident notes are under [`archive/dashboard/`](archive/dashboard/).
- **Other fix logs:** One-off fix digests (select-all, splash timing, etc.) are organized in [`archive/fixes/`](archive/fixes/).
- Additional long-form design history is preserved in the other files already under [`archive/`](archive/).

## Generated audits
- `docs/generated/` is populated by [`node devtools/audit.mjs`](../devtools/audit.mjs).
- The script writes the following developer-facing artifacts: `module_inventory.{json,md}`, `event_catalog.md`, `event_map.json`, `import_graph.json`, `render_usage.{json,md}`, and `storage_keys.{json,md}`.
- These outputs are for engineering analysis only—no runtime code consumes them. Some archived design docs link to the Markdown summaries for convenience.
