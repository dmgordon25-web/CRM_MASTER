# zNext Host Readiness Check

The Labs vNext host (`js/labs/vnext.js`) adapts Gridstack for widget drag/resize in Labs and is the basis for zNext embedding.

## Observations
- **Drag/resize support:** Enabled via GridStack initialization (`draggable.handle = '.widget-header'`, `resizable.handles = 'e, se, s, sw, w'`). Widgets are wrapped with `grid-stack-item` containers and `grid-stack-item-content` children before init.
- **Layout persistence:** Layouts are saved to `localStorage` under `labs.vnext.layout.<sectionId>` using `grid.save(false)` output, and loaded on init with width/height/x/y preserved.
- **Mount/unmount stability:** Existing grids are destroyed via `destroy(false)` before re-init to avoid double-mounts; active grids tracked in `activeGrids` map. DOM is rebuilt using a fragment to avoid duplicate nodes.
- **Sizing defaults:** Width/height inferred from saved layout or existing `w2/w3` classes, with CSS variables `--gs-column-width`/`--gs-cell-height` set explicitly for compatibility.

## Gaps / Risks
- **CSS dependency:** Assumes Gridstack styles are already loaded; no runtime check/injection beyond JS import.
- **Event noise:** Logs (`console.log`/`console.debug`) remain; consider gating for production if noise is an issue.
- **Drag handle assumption:** Requires `.widget-header` within each widget; mismatches could block dragging until templates align.
- **Limit awareness:** No guard against incompatible third-party widgets that lack `data-widget-id`—they are ignored instead of flagged.

## Readiness verdict
The host supports drag, resize, and persistent layouts without double-mounting. It is **conditionally ready** for zNext provided stylesheet delivery and drag handle class names stay consistent. No major upgrades were implemented in this pass.
