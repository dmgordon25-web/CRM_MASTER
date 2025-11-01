# Acceptance checks (non-visual)
- **A.P4/B.P2 — DnD teardown**: add/remove listener counts equal after 10 route toggles (instrumented counter later; delta==0).
- **A.P5/B.P2 — Style inject-once**: each style tag has a stable id; style node count invariant across 5 route toggles (later headless).
- **B.P2 — Import-time DOM**: modules only touch DOM inside init handlers, not at import time (static grep clean).
- **Policy — Zero-Error**: no console.error outside hard boot/prereq paths (repo-wide grep clean).
- **A.P7/B.P3 — ICS TZ**: ICS contains TZID or UTC normalization; importing in a different TZ preserves local time (needs browser-capable runner later).
- **Tooling**: no absolute /js/patches specs; diagnostics show normalized paths.
