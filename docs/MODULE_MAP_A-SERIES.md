# Module Map — A-Series

## Boot
- **tools/dev_server.mjs** — Dev server shim enforcing no-cache headers and exposing `/__whoami` for runtime proofs. Primary selectors/ids: `Cache-Control`, `/__whoami`, `<!-- BOOT_STAMP: crm-app-index -->` validation.
- **crm-app/index.html** — Pre-HTML splash markup, BOOT_STAMP comment, and dev cache-clearing beacon. Primary selectors/ids: `#boot-splash`, `[A_BEACON] dev SW/caches cleared`.
- **crm-app/js/boot/boot_hardener.js** — Splash hide + deterministic header preload via double rAF, safe-mode aware. Primary selectors/ids: `window.__SPLASH_HIDDEN__`, `[A_BEACON] splash hidden`, `[A_BEACON] attempted header import`.

## Header/UI
- **crm-app/js/ui/header_toolbar.js** — Forces header toolbar/“+ New” wiring, avatar upload render, and quick-add compatibility hook. Primary selectors/ids: `.header-bar`, `#btn-header-new`, `input[type="file"][accept="image/*"]`.
- **crm-app/js/ui/quick_add_compat.js** — Legacy quick add bridge to `window.openQuickAddCompat`. Primary selectors/ids: `window.openQuickAddCompat`, `#quick-add`.
- **crm-app/js/ui/route_toast_sentinel.js** — Hashchange listener emitting `#dev-route-toast` sentinel toast alongside existing toasts. Primary selectors/ids: `#dev-route-toast`, `[A_BEACON] route toast sentinel`.

## Contacts
- **crm-app/js/contacts.js** — Contact modal wiring with labeled “Add Contact” affordance and re-entry path. Primary selectors/ids: `#contact-modal`, `button[aria-label="Add Contact"]`.

## Tests/Checks
- **tools/feature_check.mjs** — Puppeteer feature enforcement invoked by `verify:build`. Primary selectors/ids: `#boot-splash`, `button:contains("New")`, `#dev-route-toast`, `[FEATURE_CHECK]` log.
