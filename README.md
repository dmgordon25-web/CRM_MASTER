# CRM Master

CRM Master is a single-user mortgage CRM demo that runs entirely in the browser with an offline-first data model (IndexedDB). A lightweight Node launcher serves the static bundle locally for Windows users while preserving the same code paths used in development.

## Run the app (dev/demo)
1. Install dependencies: `npm ci`
2. Start the local static server: `node tools/node_static_server.js crm-app` (default: http://127.0.0.1:8080/)
3. Open the app in your browser.
4. Windows click-to-run launcher: `Start CRM.bat`

## Verification
- Build/runtime verification: `npm run verify:build`
- Unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`

## Client handoff packaging (canonical)
- Canonical command: `npm run build:client-handoff`
- Canonical artifact path: `release/CLIENT_TO_SEND/CRM Tool Client.zip`
- Canonical unzipped root: `RUN ME FIRST - Install CRM Tool.bat`, `BEGIN HERE.txt`, `_payload/`

Packaging output prints:
- `CLIENT HANDOFF ARTIFACT: <path>`
- `Repo root is developer source. Client should not use this folder.`
- `FINAL ROOT ENTRIES: <entries>`
- `DO NOT SEND THE REPO ZIP. SEND ONLY THE CLIENT HANDOFF ARTIFACT ABOVE.`

## Documentation
- See `docs/README.md` for the documentation index and archived references.
