# Document Center Contract (Canonical Entry)

## Canonical entrypoint
**Function:** `window.DocCenter.openDocumentCenter(options)`

**Accepted arguments:**
- `contextType`: `"dashboard"` | `"settings"` | `"contact"` (default: inferred from host/pane)
- `contextId`: optional string (contact or other context identifier)
- `mode`: optional string (`"checklist"` for contact Document Checklist)
- `source`: optional string for telemetry/debug attribution
- `navigate`: boolean (when `true`, updates hash to `#doc-center`)

**Behavior:**
- For `"dashboard"`/`"settings"` contexts, loads the Doc Center enhancer if the Doc Center host is present.
- For `"contact"` context, calls `window.DocCenter.renderDocs()` to render the Document Checklist pane.

## Entrypoints and mapping
1. **Route/hash entry**  
   - **Path:** `crm-app/js/app.js` → `wireDocCenter()` click delegate + surface probe  
   - **Mapping:** calls `openDocumentCenter({ contextType: 'dashboard', navigate: true })` for `#doc-center` navigation or `{ contextType: 'dashboard' }` when the Doc Center surface is detected.

2. **Dashboard widget surface**  
   - **Path:** `crm-app/index.html` → `#doc-center` host inside `#doc-center-card`  
   - **Mapping:** surface detection in `wireDocCenter()` funnels to `openDocumentCenter({ contextType: 'dashboard' })` which applies the enhancer deterministically when the host exists.

3. **Contact editor Document Checklist tab**  
   - **Path:** `crm-app/js/doccenter_rules.js` → `tryRenderIfDocsVisible()`  
   - **Mapping:** calls `openDocumentCenter({ contextType: 'contact', mode: 'checklist' })` to render the checklist through the same canonical entrypoint.

## Guaranteed
- The same Doc Center enhancer is applied every time a Doc Center host is present.
- The same Document Checklist renderer is used for the contact editor docs pane.
- Entry via route, widget surface, or editor tab all funnel through the canonical entrypoint.

## Not guaranteed
- Any functionality behind feature flags (e.g., the dashboard widget toggle) is only available when enabled.
- Non-Doc Center surfaces that merely resemble the host selectors are not automatically enhanced.
