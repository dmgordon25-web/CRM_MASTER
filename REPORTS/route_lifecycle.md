# Route lifecycle diagnostics

- `window.__DIAG_BINDS__`: 0
- `window.__DIAG_UNBINDS__`: 0

## Modules migrated to route lifecycle

- `crm-app/js/ui/header_toolbar.js` now mounts and tears down the global “+ New” header affordance via `onEnter/onLeave`.
- `crm-app/js/pipeline/kanban_dnd.js` wires kanban drag-and-drop through the lifecycle registry with symmetric teardown.
- Supporting registry utilities live in `crm-app/js/router/history.js` and `crm-app/js/router/view_teardown.js`.
