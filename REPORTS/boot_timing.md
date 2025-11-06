# Boot Timing Update - Deferred Non-critical Modules

## First Paint Timing
- **TTFP (pre-change):** Not measured (headless environment).
- **TTFP (post-change):** Not measured (headless environment).
- Added performance marks `crm:first-route-ready` and `crm:post-first-paint-start` to trace the hand-off from initial route resolution to deferred module loading. Marks are echoed to the console for environments without the Performance API timeline UI.

## Deferred Modules
The following modules now load after the first route settles and the initial paint completes:
- `./js/ui/debug_overlay.js`
- `./js/ui/universal_search.js`
- `./js/table/table_export.js`
- `./js/ui/help_hints.js`
- `./js/ui/advanced_mode.js`

Loading is triggered via a post-first-paint hook that prefers `requestIdleCallback` with a `setTimeout` fallback to avoid delaying interaction readiness.
